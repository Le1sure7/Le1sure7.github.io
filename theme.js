(() => {
  const base = new URL('.', document.currentScript.src);
  // Phones and computers draw from separate libraries, so each device gets art framed for its screen.
  const wallpapers = {
    day: {
      desktop: [
        { file: 'KOn_day.jpg', focus: '32% 48%', title: '50%', titleY: '22%' },
        { file: 'Kanade_day.jpg', focus: '41% 42%', title: '73%' },
        { file: 'Misaki_day.jpg', focus: '79% 31%', title: '28%' },
        { file: 'sakura_ai_day.jpg', focus: '49% 26%', title: '26%' }
      ],
      mobile: [
        { file: 'KOn_day.jpg' },
        { file: 'Kanade_day.jpg' },
        { file: 'Misaki_day.jpg' },
        { file: 'sakura_ai_day.jpg' }
      ]
    },
    night: {
      desktop: [
        { file: 'Nastume_Night.jpg', focus: '49% 4%', title: '76%' },
        { file: 'sola_night.jpg', focus: '49% 7%', title: '75%' }
      ],
      mobile: [
        { file: 'Nastume_Night.jpg' },
        { file: 'sola_night.jpg' }
      ]
    }
  };
  // Tall phone screens (narrower than 3:5) use the phone library; tablets, computers and landscape phones use the computer one.
  const wide = matchMedia('(min-aspect-ratio: 3/5)');
  const device = () => (wide.matches ? 'desktop' : 'mobile');
  const remaining = { day: { desktop: [], mobile: [] }, night: { desktop: [], mobile: [] } };
  function draw(theme, previous) {
    const kind = device();
    const pool = remaining[theme][kind];
    if (!pool.length) pool.push(...wallpapers[theme][kind]);
    const options = pool.filter(item => item !== previous);
    const next = options[Math.floor(Math.random() * options.length)] || pool[0];
    pool.splice(pool.indexOf(next), 1);
    return next;
  }
  function imageURL(theme, item) {
    return new URL('wallpaper_' + theme + '/' + device() + '/' + item.file, base).href;
  }
  const icons = { day: '2600.svg', night: '1f319.svg' };
  const key = 'leisure.theme';
  const modes = ['auto', 'day', 'night'];
  const localPreview = location.protocol === 'file:';
  const url = new URL(location.href);
  const previewChoice = localPreview && url.searchParams.get('theme');
  function savedMode() {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function persist(value) {
    try { localStorage.setItem(key, value); } catch { /* Storage may be disabled. */ }
  }
  let choice = modes.includes(previewChoice) ? previewChoice : savedMode();
  if (!modes.includes(choice)) choice = 'auto';
  if (modes.includes(previewChoice)) persist(choice);
  const selected = {};
  function apply() {
    const hour = new Date().getHours();
    const theme = choice === 'auto' ? (hour >= 6 && hour < 18 ? 'day' : 'night') : choice;
    document.documentElement.dataset.theme = theme;
    const slot = theme + ':' + device();
    if (!selected[slot]) selected[slot] = draw(theme);
    const item = selected[slot];
    const style = document.documentElement.style;
    style.setProperty('--cover', 'url("' + imageURL(theme, item) + '")');
    style.setProperty('--cover-position', item.focus || 'center');
    style.setProperty('--title-x', item.title || '50%');
    style.setProperty('--title-y', item.titleY || '57%');
    const button = document.querySelector('[data-toggle-theme]');
    if (button) {
      const target = theme === 'day' ? 'night' : 'day';
      const label = target === 'night' ? '切换到夜间模式' : '切换到日间模式';
      button.title = label;
      button.setAttribute('aria-label', label);
      const icon = new URL('assets/emoji/' + icons[target], base).href;
      if (button.firstElementChild.src !== icon) button.firstElementChild.src = icon;
      button.hidden = false;
    }
    const auto = document.querySelector('[data-auto-theme]');
    if (auto) {
      auto.disabled = choice === 'auto';
      auto.textContent = auto.disabled ? '已跟随时间' : '恢复自动主题';
    }
  }
  function choose(value) {
    choice = value;
    persist(value);
    apply();
    if (localPreview && url.searchParams.has('theme')) {
      url.searchParams.set('theme', value);
      try { history.replaceState(null, '', url); } catch { /* file URL restrictions */ }
    }
  }
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelector('[data-toggle-theme]')?.addEventListener('click', () =>
      choose(document.documentElement.dataset.theme === 'day' ? 'night' : 'day'));
    document.querySelector('[data-auto-theme]')?.addEventListener('click', () => choose('auto'));
    const shuffle = document.querySelector('[data-shuffle-wallpaper]');
    if (shuffle) {
      shuffle.hidden = false;
      shuffle.addEventListener('click', async () => {
        const theme = document.documentElement.dataset.theme;
        const slot = theme + ':' + device();
        const next = draw(theme, selected[slot]);
        const image = new Image();
        image.src = imageURL(theme, next);
        shuffle.disabled = true;
        try {
          await image.decode();
          selected[slot] = next;
          apply();
        } catch {
          // Keep the current wallpaper if the new image fails to load.
        } finally {
          shuffle.disabled = false;
        }
      });
    }
    // Browsers may isolate storage for each file during local previews.
    if (localPreview) document.addEventListener('click', e => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const next = new URL(link.href);
      if (next.protocol === 'file:' && next.pathname !== location.pathname && next.pathname.endsWith('.html')) {
        next.searchParams.set('theme', choice);
        link.href = next.href;
      }
    }, true);
  });
  function sync() { const saved = savedMode(); if (modes.includes(saved)) choice = saved; apply(); }
  wide.addEventListener('change', apply);
  setInterval(apply, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  window.addEventListener('pageshow', sync);
  window.addEventListener('storage', e => { if (e.key === key) sync(); });
})();
