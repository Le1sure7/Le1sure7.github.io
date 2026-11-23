const $ = selector => document.querySelector(selector);
function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function category(post) {
  return post.category || '未分类';
}

function tags(post) {
  return [...new Set([...(post.tags || []), post.tag].filter(Boolean))];
}

function archiveMonth(post) {
  return /^\d{4}-(?:0[1-9]|1[0-2])-\d{2}$/.test(post.date) ? post.date.slice(0, 7) : '';
}

function archiveLabel(month) {
  const [year, number] = month.split('-');
  return year + ' 年 ' + Number(number) + ' 月';
}

function dateLabel(post) {
  return post.date || '日期待填写';
}

function readingTime(post) {
  return '约 ' + BlogArticle.get(post).minutes + ' 分钟阅读';
}

function postLink(post, query) {
  const params = new URLSearchParams({ id: post.id });
  if (query) params.set('q', query);
  return './post.html?' + params;
}

function filterLink(field, value) {
  return './index.html?' + new URLSearchParams({ [field]: value }) + '#journal';
}

function animateCover() {
  const title = $('#cover-title');
  const text = title.textContent;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || title.querySelector('mark')) return;
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
  const query = $('#query');
  const search = $('.search');
  const find = $('#find');
  const hits = $('#hits');
  const params = new URLSearchParams(location.search);
  const alphabetic = (a, b) => a.localeCompare(b, 'zh-CN');
  const filters = [
    { name: 'category', values: posts.map(category), includes: (post, value) => category(post) === value },
    { name: 'tag', values: posts.flatMap(tags), includes: (post, value) => tags(post).includes(value) },
    { name: 'archive', values: posts.map(archiveMonth), includes: (post, value) => archiveMonth(post) === value }
  ];

  for (const filter of filters) {
    const select = $('#filter-' + filter.name);
    const values = [...new Set(filter.values.filter(Boolean))];
    if (filter.name === 'archive') values.sort().reverse();
    else values.sort(alphabetic);
    for (const value of values) {
      select.add(new Option(filter.name === 'archive' ? archiveLabel(value) : value, value));
    }
    const selected = params.get(filter.name);
    if (values.includes(selected)) select.value = selected;
    filter.select = select;
    select.addEventListener('change', render);
  }
  query.value = params.get('q') || '';

  function showSearch(open) {
    query.hidden = !open;
    hits.hidden = !open || !query.value.trim();
    find.setAttribute('aria-expanded', String(open));
  }

  function saveFilters(term) {
    const url = new URL(location.href);
    for (const [key, value] of [['q', term], ...filters.map(filter => [filter.name, filter.select.value])]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (url.href !== location.href && url.protocol !== 'file:') history.replaceState(null, '', url);
  }

  function entry(post, href, snippet) {
    const link = element('a', '');
    link.className = 'entry';
    link.href = href;
    const date = element('time', dateLabel(post));
    if (post.date) date.dateTime = post.date;
    const metadata = element('div', '');
    metadata.className = 'entry-meta';
    metadata.append(date, element('span', readingTime(post)));
    link.append(
      element('small', [category(post), ...tags(post)].join(' · ')),
      element('h3', post.title),
      element('p', snippet || post.summary || ''),
      metadata
    );
    return link;
  }

  function render() {
    const term = query.value.trim();
    const pattern = BlogArticle.queryPattern(term);
    const entries = [];
    const suggestions = [];

    for (const post of posts) {
      if (!filters.every(filter => !filter.select.value || filter.includes(post, filter.select.value))) continue;
      const bodyMatch = pattern && BlogArticle.find(post, pattern);
      const otherMatch = pattern && [post.title, category(post), ...tags(post), post.summary]
        .filter(Boolean).find(text => !text.matchAll(pattern).next().done);
      if (pattern && !bodyMatch && !otherMatch) continue;

      const href = postLink(post, term);
      const card = entry(post, href, bodyMatch);
      if (pattern) {
        BlogArticle.highlight(card, pattern);
        if (suggestions.length < 5) {
          const suggestion = element('a', '');
          suggestion.href = href;
          suggestion.append(element('strong', post.title));
          if (bodyMatch || otherMatch !== post.title) {
            suggestion.append(element('small', bodyMatch || otherMatch));
          }
          BlogArticle.highlight(suggestion, pattern);
          suggestions.push(suggestion);
        }
      }
      entries.push(card);
    }

    $('#entries').replaceChildren(...entries);
    $('#empty').hidden = entries.length > 0;
    const searchSummary = $('#search-summary');
    searchSummary.hidden = !term;
    searchSummary.querySelector('span').textContent = term ? '“' + term + '” 的搜索结果' : '';
    if (term && !suggestions.length) suggestions.push(element('p', '没有匹配的文章'));
    hits.replaceChildren(...suggestions);
    hits.hidden = !term || query.hidden;
    saveFilters(term);
  }

  search.onpointerenter = event => {
    if (event.pointerType === 'mouse') showSearch(true);
  };
  search.onpointerleave = event => {
    if (event.pointerType === 'mouse' && !search.matches(':focus-within')) showSearch(false);
  };
  find.onclick = () => {
    showSearch(true);
    query.focus();
  };
  search.onfocusout = event => {
    if (!search.contains(event.relatedTarget) && !search.matches(':hover')) showSearch(false);
  };
  document.addEventListener('pointerdown', event => {
    if (!search.contains(event.target)) showSearch(false);
  });
  query.addEventListener('input', render);
  query.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing) return;
    if (location.hash === '#journal') $('#journal').scrollIntoView();
    else location.hash = 'journal';
    $('#journal-title').focus({ preventScroll: true });
    showSearch(false);
  });
  function clearSearch() {
    query.value = '';
    render();
    showSearch(false);
  }
  search.onkeydown = event => {
    if (event.key !== 'Escape' || event.isComposing) return;
    clearSearch();
    find.focus();
  };
  $('#clear-search').addEventListener('click', () => {
    clearSearch();
    $('#journal-title').focus({ preventScroll: true });
  });
  render();
}

function renderPost() {
  const params = new URLSearchParams(location.search);
  const post = posts.find(item => item.id === params.get('id'));
  const article = $('#story article');
  const title = post ? post.title : '找不到这篇文章';
  $('#cover-title').textContent = title;
  document.title = title + " · Le1SurE7_7's Blog";
  if (!post) {
    article.append(element('p', '可以返回博客查看文章列表。'));
    return;
  }

  $('#post-meta').textContent = [dateLabel(post), readingTime(post)].join('　·　');
  const details = $('#article-details');
  const info = [
    ['category', category(post), '分类：'],
    ...tags(post).map(tag => ['tag', tag, '标签：'])
  ];
  const month = archiveMonth(post);
  if (month) info.push(['archive', month, '归档：']);
  for (const [field, value, label] of info) {
    const link = element('a', label + (field === 'archive' ? archiveLabel(value) : value));
    link.href = filterLink(field, value);
    details.append(link);
  }
  details.hidden = false;

  BlogArticle.render(post, article, $('#contents'), $('#copy-status'));
  const pattern = BlogArticle.queryPattern(params.get('q') || '');
  let target;
  if (pattern) {
    target = BlogArticle.highlight(article, pattern) ||
      BlogArticle.highlight($('#cover-title'), pattern) ||
      BlogArticle.highlight(details, pattern);
    if (!target && post.summary) {
      const summary = element('p', post.summary);
      target = BlogArticle.highlight(summary, pattern);
      if (target) {
        summary.className = 'search-context';
        article.before(summary);
      }
    }
  }
  if (target) {
    target.setAttribute('tabindex', '-1');
    requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
    });
  } else if (location.hash.startsWith('#heading-')) {
    try {
      const heading = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      requestAnimationFrame(() => heading?.scrollIntoView({ behavior: 'instant' }));
    } catch {
      // A malformed URL fragment has no target.
    }
  }
}

function enableCoverDescent() {
  const cover = $('.cover');
  const link = cover.querySelector('.descend');
  const target = $(link.hash);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let startedByWheel = false;

  function isDownwardWheel(event) {
    return event.deltaY > Math.abs(event.deltaX) &&
      !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
  }

  function handleWheelDuringDescent(event) {
    if (event.defaultPrevented) return;
    if (startedByWheel && event.cancelable && isDownwardWheel(event)) {
      event.preventDefault();
    } else {
      cancelDescent();
    }
  }

  function cancelDescent() {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
    window.removeEventListener('wheel', handleWheelDuringDescent);
  }

  function descendToContent(event, fromWheel = false) {
    const start = window.scrollY;
    const scroller = document.scrollingElement;
    const end = Math.min(start + target.getBoundingClientRect().top, scroller.scrollHeight - scroller.clientHeight);
    const distance = end - start;
    if (distance <= 0) return;

    event.preventDefault();
    cancelDescent();
    startedByWheel = fromWheel;
    if (!fromWheel && location.hash !== link.hash) history.pushState(history.state, '', link.hash);

    const duration = Math.max(320, Math.min(680, distance * 0.6));
    let startedAt;
    function descend(now) {
      startedAt ??= now;
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress ** 2 * (3 - 2 * progress);
      window.scrollTo({ top: start + distance * eased, behavior: 'instant' });
      if (progress === 1) {
        cancelDescent();
        if (!fromWheel) target.focus({ preventScroll: true });
      } else {
        frame = requestAnimationFrame(descend);
      }
    }
    frame = requestAnimationFrame(descend);
    window.addEventListener('wheel', handleWheelDuringDescent, { passive: false });
  }

  for (const type of ['touchstart', 'pointerdown']) {
    window.addEventListener(type, cancelDescent, { passive: true });
  }
  window.addEventListener('keydown', cancelDescent);
  window.addEventListener('popstate', cancelDescent);
  motion.addEventListener('change', cancelDescent);

  cover.addEventListener('click', event => {
    const anchor = event.target.closest('a');
    if (anchor?.getAttribute('href') !== link.hash || event.defaultPrevented || event.button !== 0 ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || motion.matches) return;
    descendToContent(event);
  });

  cover.addEventListener('wheel', event => {
    if (frame || motion.matches || event.defaultPrevented || !event.cancelable || !isDownwardWheel(event)) return;
    descendToContent(event, true);
  }, { passive: false });
}

function start() {
  if ($('#entries')) renderIndex();
  else renderPost();
  animateCover();
  enableCoverDescent();
}
window.libraryReady.then(start);
const menu = $('.menu');
document.addEventListener('click', e => {
  if (!menu.contains(e.target) || e.target.closest('a')) menu.open = false;
});
menu.addEventListener('keydown', e => {
  if (e.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); }
});

