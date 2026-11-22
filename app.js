const $ = s => document.querySelector(s);
function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
function bodyText(post) {
  if (post.markdown) return post.markdown.replace(/[*~#>`]/g, ' ');
  return (post.paragraphs || []).join(' ');
}
function inlineNodes(text) {
  const fragment = document.createDocumentFragment();
  const pattern = /\*\*\*([^*]+?)\*\*\*|\*\*([^*]+?)\*\*|\*([^*]+?)\*|~~([^~]+?)~~/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) fragment.append(text.slice(cursor, match.index));
    const [whole, boldItalic, bold, italic, strike] = match;
    const wrap = document.createElement(boldItalic || bold ? 'strong' : italic ? 'em' : 'del');
    const target = boldItalic ? wrap.appendChild(document.createElement('em')) : wrap;
    target.append(inlineNodes(boldItalic ?? bold ?? italic ?? strike));
    fragment.append(wrap);
    cursor = pattern.lastIndex;
  }
  if (cursor < text.length) fragment.append(text.slice(cursor));
  return fragment;
}
function parseMarkdown(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const indents = lines.filter(line => line.trim()).map(line => /^ */.exec(line)[0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  const blocks = [];
  const stack = [];
  for (const raw of lines) {
    const line = raw.slice(cut).replace(/\t/g, '  ');
    const text = line.trim();
    if (!text) continue;
    const heading = /^(#{1,3})\s+(.+)$/.exec(text);
    if (heading) {
      blocks.push({ type: 'h', level: heading[1].length, text: heading[2] });
      stack.length = 0;
      continue;
    }
    const item = /^(\s*)([-*+]|\d+[.)])\s+(.+)$/.exec(line);
    if (!item) {
      blocks.push({ type: 'p', text });
      stack.length = 0;
      continue;
    }
    const indent = item[1].length;
    const ordered = /^\d/.test(item[2]);
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack.length ? stack[stack.length - 1].item : null;
    const container = parent ? (parent.children ||= []) : blocks;
    let list = container[container.length - 1];
    if (!list || list.type !== 'list' || list.ordered !== ordered) {
      list = { type: 'list', ordered, items: [] };
      container.push(list);
    }
    const entry = { text: item[3] };
    list.items.push(entry);
    stack.push({ indent, item: entry });
  }
  return blocks;
}
function markdownList(block) {
  const list = document.createElement(block.ordered ? 'ol' : 'ul');
  for (const item of block.items) {
    const li = document.createElement('li');
    li.append(inlineNodes(item.text));
    if (item.children) for (const child of item.children) li.append(markdownList(child));
    list.append(li);
  }
  return list;
}
function renderMarkdown(container, blocks) {
  for (const block of blocks) {
    if (block.type === 'list') {
      container.append(markdownList(block));
      continue;
    }
    if (block.type === 'h') {
      const heading = document.createElement('h' + Math.min(block.level + 1, 4));
      heading.append(inlineNodes(block.text));
      container.append(heading);
      continue;
    }
    const paragraph = document.createElement('p');
    paragraph.append(inlineNodes(block.text));
    container.append(paragraph);
  }
}
function animateCover() {
  const title = $('#cover-title');
  const text = title.textContent;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;
  const cover = $('.cover');
  const petals = $('.petals');
  for (let i = 0; i < 14; i++) {
    const petal = element('i', '');
    petal.className = 'petal';
    petal.style.setProperty('--x', ((i * 37) % 100) + '%');
    petal.style.setProperty('--w', (6 + i % 5) + 'px');
    petal.style.setProperty('--duration', (9 + i % 7) + 's');
    petal.style.setProperty('--delay', -(i * 2.37) + 's');
    petals.append(petal);
  }
  const reserve = element('span', text);
  reserve.className = 'type-reserve';
  const line = element('span', '');
  line.className = 'type-line';
  line.setAttribute('aria-hidden', 'true');
  const letters = document.createTextNode('');
  const cursor = element('span', '');
  cursor.className = 'cursor';
  line.append(letters, cursor);
  title.setAttribute('aria-label', text);
  title.replaceChildren(reserve, line);
  const glyphs = Array.from(text);
  let position = 0;
  let timer = setTimeout(type, 180);
  function type() {
    letters.appendData(glyphs[position++]);
    if (position < glyphs.length) timer = setTimeout(type, Math.min(90, 1500 / glyphs.length));
  }
  motion.addEventListener('change', () => {
    if (motion.matches) {
      clearTimeout(timer);
      title.textContent = text;
    }
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => cover.classList.toggle('offscreen', !entry.isIntersecting)).observe(cover);
  }
}

function renderIndex() {
  function render(term = '') {
    const matches = posts.filter(p => [p.title,p.tag,p.summary,bodyText(p)].join(' ').toLowerCase().includes(term.trim().toLowerCase()));
    $('#entries').replaceChildren(...matches.map(p => {
      const a = document.createElement('a');
      a.className = 'entry';
      a.href = './post.html?id=' + encodeURIComponent(p.id);
      a.append(element('small',p.tag),element('h3',p.title),element('p',p.summary),element('time',p.date || '日期待填写'));
      return a;
    }));
    $('#empty').hidden = matches.length > 0;
    const hits = $('#hits');
    hits.replaceChildren();
    if (term.trim()) {
      for (const p of matches.slice(0, 5)) {
        const link = element('a', p.title);
        link.href = './post.html?id=' + encodeURIComponent(p.id);
        hits.append(link);
      }
      if (!matches.length) hits.append(element('p', '没有匹配的文章'));
    }
    hits.hidden = !term.trim() || $('#query').hidden;
  }
  render();
  const q = $('#query');
  const search = $('.search');
  const find = $('#find');
  function showSearch(open) {
    q.hidden = !open;
    $('#hits').hidden = !open || !q.value.trim();
    find.setAttribute('aria-expanded', String(open));
  }
  search.onpointerenter = e => {
    if (e.pointerType === 'mouse') showSearch(true);
  };
  search.onpointerleave = e => {
    if (e.pointerType === 'mouse') showSearch(false);
  };
  find.onclick = () => {
    q.hidden = false;
    q.focus();
    showSearch(true);
  };
  search.onfocusout = e => {
    if (!search.contains(e.relatedTarget) && !search.matches(':hover')) showSearch(false);
  };
  document.addEventListener('pointerdown', e => {
    if (!search.contains(e.target)) showSearch(false);
  });
  q.oninput = () => render(q.value);
  q.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) { showSearch(false); location.hash = 'journal'; $('#journal-title').focus({preventScroll:true}); }
  });
  search.onkeydown = e => {
    if (e.key === 'Escape') {
      q.value = '';
      render();
      showSearch(false);
      find.focus();
    }
  };
}

function renderPost() {
  const p = posts.find(item => item.id === new URLSearchParams(location.search).get('id'));
  const article = $('#story article');
  const title = p ? p.title : '找不到这篇文章';
  $('#cover-title').textContent = title;
  document.title = title + " · Le1SurE7_7's Blog";
  if (p) {
    $('#post-meta').textContent = [p.tag, p.date || '日期待填写'].join('　·　');
    if (p.markdown) renderMarkdown(article, parseMarkdown(p.markdown));
    else article.append(...(p.paragraphs || []).map(t => element('p', t)));
  } else {
    article.append(element('p', '可以返回博客查看文章列表。'));
  }
}

function start() {
  if ($('#entries')) renderIndex();
  else renderPost();
  animateCover();
}
window.libraryReady.then(start);
const menu = $('.menu');
document.addEventListener('click', e => {
  if (!menu.contains(e.target) || e.target.closest('a')) menu.open = false;
});
menu.addEventListener('keydown', e => {
  if (e.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); }
});

