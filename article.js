const BlogArticle = (() => {
  const { MarkdownIt, katex, hljs } = BlogVendor;
  const markdown = new MarkdownIt({ breaks: true }).use(katex, {
    delimiters: 'all',
    trust: false,
    throwOnError: false
  });
  const escape = markdown.utils.escapeHtml;
  const defaultImage = markdown.renderer.rules.image;

  function codeBlock(source, language) {
    const name = language === 'c++' ? 'cpp' : language;
    const grammar = hljs.getLanguage(name);
    const code = grammar ? hljs.highlight(source, { language: name, ignoreIllegals: true }).value : escape(source);
    const label = escape(grammar?.name || language || '纯文本');
    return '<div class="code-block"><div class="code-toolbar" data-search-ignore>' +
      '<span>' + label + '</span><button type="button" class="copy-code">复制代码</button>' +
      '</div><pre><code class="hljs">' + code + '</code></pre></div>\n';
  }

  markdown.renderer.rules.code_block = (tokens, index) => codeBlock(tokens[index].content, '');
  markdown.renderer.rules.fence = (tokens, index) => {
    const { content, info } = tokens[index];
    const language = info.trim().split(/\s+/, 1)[0].toLowerCase();
    if (language === 'animation') {
      return '<details class="article-animation" data-search-ignore><summary>播放 HTML 动画</summary>' +
        '<template>' + escape(content) + '</template></details>\n';
    }
    return codeBlock(content, language);
  };

  markdown.renderer.rules.image = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    const url = token.attrGet('src');
    const path = url.split(/[?#]/, 1)[0];
    if (/^(?:\.\/)?media\/.+\.(?:flac|mp3|m4a|aac|wav|ogg|oga|opus|weba)$/i.test(path) &&
        new URL(path, document.baseURI).href.startsWith(new URL('media/', document.baseURI).href)) {
      const label = escape(renderer.renderInlineAsText(token.children, options, env) || '文章音频');
      const source = escape(url);
      return '<span class="article-audio"><span class="article-audio-title">' + label + '</span>' +
        '<audio src="' + source + '" aria-label="' + label + '" controls preload="none" data-search-ignore>' +
        '<a href="' + source + '">打开音频文件</a></audio></span>';
    }
    if (/\.(?:mp4|webm|ogv)$/i.test(path) && !/^data:/i.test(url)) {
      const label = escape(renderer.renderInlineAsText(token.children, options, env) || '文章视频');
      return '<video class="article-video" src="' + escape(url) + '" aria-label="' + label +
        '" controls playsinline preload="none"><a href="' + escape(url) + '">' + label + '</a></video>';
    }
    token.attrSet('loading', 'lazy');
    token.attrSet('decoding', 'async');
    return defaultImage(tokens, index, options, env, renderer);
  };

  markdown.core.ruler.push('article_headings', state => {
    for (const token of state.tokens) {
      if (token.type !== 'heading_open' && token.type !== 'heading_close') continue;
      const level = Number(token.tag.slice(1));
      token.tag = 'h' + Math.min(level + 1, 6);
      if (token.type === 'heading_open') token.attrSet('data-heading-level', level);
    }
  });

  function removeCommonIndent(source) {
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
    const first = lines.find(line => line.trim());
    let indent = first?.match(/^[ \t]*/)[0] || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      while (!line.startsWith(indent)) indent = indent.slice(0, -1);
      if (!indent) break;
    }
    return lines.map(line => line.slice(indent.length)).join('\n');
  }

  function collectBlocks(root) {
    const boundaries = 'p,h1,h2,h3,h4,h5,h6,pre,li,td,th,blockquote';
    const blocks = [];
    let text = '';
    let ranges = [];

    function append(value, node, atomic = false) {
      if (!value) return;
      if (node) ranges.push({ node, atomic, start: text.length, end: text.length + value.length });
      text += value;
    }

    function flush() {
      if (text.trim()) blocks.push({ text, ranges });
      text = '';
      ranges = [];
    }

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        append(node.data, node);
      } else if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        node.childNodes.forEach(walk);
      } else if (node.nodeType === Node.ELEMENT_NODE && !node.matches('[data-search-ignore]')) {
        if (node.matches('br')) {
          append(' ');
        } else if (node.matches('.katex, img, video')) {
          const value = node.querySelector('annotation')?.textContent ||
            node.getAttribute('alt') || node.getAttribute('aria-label');
          append(value, node, true);
        } else {
          const boundary = node.matches(boundaries);
          if (boundary) flush();
          node.childNodes.forEach(walk);
          if (boundary) flush();
        }
      }
    }

    walk(root);
    flush();
    return blocks;
  }

  const articles = new WeakMap();
  function get(post) {
    if (!articles.has(post)) {
      const template = document.createElement('template');
      if (post.markdown) {
        template.innerHTML = markdown.render(removeCommonIndent(post.markdown));
      } else {
        for (const text of post.paragraphs || []) {
          const paragraph = document.createElement('p');
          paragraph.textContent = text;
          template.content.append(paragraph);
        }
      }
      const blocks = collectBlocks(template.content);
      const text = blocks.map(block => block.text).join(' ');
      const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;
      const characters = (text.match(cjk) || []).length;
      const words = (text.replace(cjk, ' ').match(/[\p{L}\p{N}]+/gu) || []).length;
      const minutes = Math.max(1, Math.ceil(characters / 400 + words / 220));
      articles.set(post, { template, blocks, minutes });
    }
    return articles.get(post);
  }

  function queryPattern(query) {
    const term = query.trim().replace(/\s+/g, ' ');
    if (!term) return null;
    const literal = term.replace(/[.*+?^\x24{}()|[\]\\]/g, '\\$&');
    return new RegExp(literal.replace(/ /g, '\\s+'), 'giu');
  }

  function find(post, pattern) {
    for (const { text } of get(post).blocks) {
      const match = text.matchAll(pattern).next().value;
      if (!match) continue;
      const start = Math.max(0, match.index - 28);
      const end = Math.min(text.length, match.index + match[0].length + 55);
      return ((start ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : ''))
        .trim().replace(/\s+/g, ' ');
    }
    return '';
  }

  function highlight(root, pattern) {
    const parts = new Map();
    for (const { text, ranges } of collectBlocks(root)) {
      let cursor = 0;
      for (const match of text.matchAll(pattern)) {
        const start = match.index;
        const end = start + match[0].length;
        while (cursor < ranges.length && ranges[cursor].end <= start) cursor++;
        for (let i = cursor; i < ranges.length && ranges[i].start < end; i++) {
          const range = ranges[i];
          if (!parts.has(range.node)) parts.set(range.node, []);
          if (!range.atomic) {
            parts.get(range.node).push([
              Math.max(0, start - range.start), Math.min(range.end, end) - range.start
            ]);
          }
        }
      }
    }
    let first;
    for (const [node, matches] of parts) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        node.classList.add('search-highlight');
        first ||= node;
        continue;
      }
      let mark;
      for (const [start, end] of matches.reverse()) {
        const matched = node.splitText(start);
        matched.splitText(end - start);
        mark = document.createElement('mark');
        mark.textContent = matched.data;
        matched.replaceWith(mark);
      }
      first ||= mark;
    }
    return first;
  }

  function renderContents(article, contents, maxLevel = 6) {
    const ids = new Set();
    const headings = [...article.querySelectorAll('[data-heading-level]')]
      .filter(heading => Number(heading.dataset.headingLevel) <= maxLevel);
    if (!headings.length) return;
    const firstLevel = Math.min(...headings.map(heading => Number(heading.dataset.headingLevel)));
    const list = contents.querySelector('ol');
    for (const heading of headings) {
      const title = collectBlocks(heading).map(block => block.text.trim()).join(' ');
      const slug = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
      const base = 'heading-' + (slug || 'section');
      let id = base;
      for (let suffix = 2; ids.has(id); suffix++) id = base + '-' + suffix;
      ids.add(id);
      heading.id = id;
      const link = document.createElement('a');
      link.href = '#' + encodeURIComponent(id);
      link.textContent = title || '小节';
      const item = document.createElement('li');
      item.style.setProperty('--depth', Number(heading.dataset.headingLevel) - firstLevel);
      item.append(link);
      list.append(item);
    }
    contents.hidden = false;
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      return;
    } catch {
      // Also support local files and browsers without the Clipboard API.
    }
    const previous = document.activeElement;
    const field = document.createElement('textarea');
    field.className = 'clipboard-field';
    field.value = code;
    field.readOnly = true;
    document.body.append(field);
    field.select();
    try {
      if (!document.execCommand('copy')) throw new Error('Copy failed');
    } finally {
      field.remove();
      previous?.focus({ preventScroll: true });
    }
  }

  function addCodeCopy(article, status) {
    article.addEventListener('click', async event => {
      const button = event.target.closest('.copy-code');
      if (!button) return;
      const code = button.closest('.code-block').querySelector('code').textContent;
      try {
        await copyCode(code);
        button.textContent = '已复制';
        status.textContent = '代码已复制';
      } catch {
        button.textContent = '重试复制';
        status.textContent = '复制失败，可以选中代码手动复制';
      }
    });
  }

  function addAnimations(article) {
    for (const demo of article.querySelectorAll('.article-animation')) {
      demo.addEventListener('toggle', () => {
        const existing = demo.querySelector('iframe');
        if (!demo.open) {
          existing?.remove();
        } else if (!existing) {
          const frame = document.createElement('iframe');
          frame.title = '文章 HTML 动画';
          frame.setAttribute('sandbox', 'allow-scripts');
          frame.srcdoc = '<!doctype html><html lang="zh-CN"><meta charset="utf-8">' +
            '<meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; ' +
            'script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; form-action \'none\'">' +
            '<style>:root{color-scheme:light dark} @media(prefers-reduced-motion:reduce)' +
            '{*,*::before,*::after{animation:none!important;transition:none!important}}</style>' +
            demo.querySelector('template').content.textContent;
          demo.append(frame);
        }
      });
    }
  }

  function render(post, article, contents, status) {
    article.append(get(post).template.content.cloneNode(true));
    renderContents(article, contents, post.contentsDepth);
    addCodeCopy(article, status);
    addAnimations(article);
  }

  return { get, render, find, highlight, queryPattern };
})();
