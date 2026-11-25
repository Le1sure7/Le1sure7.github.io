const MusicPlayer = (() => {
  const defaultVolume = 0.3;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let useNativeVolume = !AudioContext || !/^https?:$/.test(location.protocol);
  let audioContext;

  if (!useNativeVolume) {
    // Some mobile browsers briefly report the assigned volume without applying it.
    const probe = new Audio();
    probe.addEventListener('volumechange', () => {
      useNativeVolume = probe.volume === defaultVolume;
    }, { once: true });
    probe.volume = defaultVolume;
  }

  const playIcon = '<span class="music-play-icon" aria-hidden="true"></span>';
  const coverButton = '<button type="button" class="music-cover" data-search-ignore>' +
    '<span class="music-disc" aria-hidden="true"><img alt="" hidden></span>' +
    '<span class="music-cover-overlay" aria-hidden="true">' + playIcon + '</span></button>';
  const speakerIcon = '<img class="emoji music-speaker" width="20" height="20" alt="">';
  const volumeControl = '<span class="music-volume">' +
    '<button type="button" class="music-volume-trigger" aria-label="音量" aria-expanded="false">' + speakerIcon +
    '</button><span class="music-volume-panel" hidden>' +
    '<input type="range" min="0" max="1" step="0.01" value="' + defaultVolume + '" aria-label="音量" aria-orientation="vertical">' +
    '<span class="music-volume-percent" aria-hidden="true"></span>' +
    '<button type="button" class="music-mute" aria-label="静音">' + speakerIcon + '</button></span></span>';

  function formatTime(seconds) {
    const whole = Math.floor(seconds || 0);
    return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
  }

  function parseLyrics(source) {
    const offset = Number(source.match(/^\s*\[offset:([+-]?\d+)\]/im)?.[1] || 0) / 1000;
    const lines = [];
    for (const line of source.split(/\r?\n/)) {
      const stamps = [...line.matchAll(/\[(\d+):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
      const last = stamps.at(-1);
      if (!last) continue;
      const text = line.slice(last.index + last[0].length).trim();
      if (!text) continue;
      for (const [, minutes, seconds, fraction] of stamps) {
        const time = Number(minutes) * 60 + Number(seconds) + Number('0.' + (fraction || '0'));
        lines.push({ time: Math.max(0, time - offset), text });
      }
    }
    return lines.sort((first, second) => first.time - second.time);
  }

  function setCover(button, source) {
    const cover = button.querySelector('img');
    cover.addEventListener('error', () => { cover.hidden = true; });
    setArtwork(button, source);
  }

  function setArtwork(button, source) {
    const cover = button.querySelector('img');
    cover.hidden = !source;
    if (source) cover.src = source;
    else cover.removeAttribute('src');
  }

  function setPlayback(button, playing, title) {
    const label = playing ? '暂停' : '播放';
    button.setAttribute('aria-label', label + ' ' + title);
    button.dataset.playing = playing;
  }

  function createVolumeOutput(audio) {
    let level = defaultVolume;
    let gain;
    audio.volume = level;

    function syncGain() {
      gain.gain.value = audio.muted ? 0 : level;
    }

    return {
      get value() { return gain || !useNativeVolume ? level : audio.volume; },
      set(value, muted = false) {
        level = value;
        if (!gain) audio.volume = value;
        audio.muted = muted;
        if (gain) syncGain();
      },
      prepare() {
        if (!gain && useNativeVolume) return;
        audioContext ??= new AudioContext();
        if (!gain) {
          const node = audioContext.createGain();
          node.gain.value = audio.muted ? 0 : level;
          node.connect(audioContext.destination);
          audioContext.createMediaElementSource(audio).connect(node);
          gain = node;
          audio.volume = 1;
          audio.addEventListener('volumechange', syncGain);
        }
        if (audioContext.state !== 'running') return audioContext.resume();
      }
    };
  }

  function bindVolume(root, getTrack) {
    const trigger = root.querySelector('.music-volume-trigger');
    const panel = root.querySelector('.music-volume-panel');
    const input = panel.querySelector('input');
    const percent = panel.querySelector('.music-volume-percent');
    const mute = panel.querySelector('.music-mute');
    const icons = root.querySelectorAll('.music-speaker');

    function update() {
      const track = getTrack();
      if (!track) return;
      const { audio, output } = track;
      const value = audio.muted ? 0 : output.value;
      const level = value === 0 ? 'mute' : value <= 1 / 3 ? 'low' : value <= 2 / 3 ? 'medium' : 'high';
      const label = Math.round(value * 100) + '%';
      if (root.dataset.level !== level) {
        root.dataset.level = level;
        for (const icon of icons) icon.src = 'assets/emoji/volume-' + level + '.svg';
      }
      input.value = value;
      input.setAttribute('aria-valuetext', label);
      percent.textContent = label;
      trigger.setAttribute('aria-label', '音量 ' + label);
      mute.setAttribute('aria-label', value === 0 ? '取消静音' : '静音');
    }

    function toggleMute() {
      const track = getTrack();
      if (!track) return;
      const { audio, output } = track;
      const value = output.value;
      output.set(value || track.lastVolume, !audio.muted && value > 0);
      track.syncVolume();
    }

    function positionPanel() {
      const { top, bottom } = trigger.getBoundingClientRect();
      const remainingBelow = window.innerHeight - bottom;
      root.toggleAttribute('data-opens-down', top < panel.offsetHeight && remainingBelow > top);
    }

    function setOpen(open) {
      if (open === !panel.hidden) return;
      if (!open && panel.contains(document.activeElement)) trigger.focus({ preventScroll: true });
      panel.hidden = !open;
      trigger.setAttribute('aria-expanded', open);
      if (open) positionPanel();
    }

    root.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') setOpen(true);
    });
    root.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse') setOpen(false);
    });
    function bindButton(button, click, tap) {
      let contact;
      let tappedAt = -Infinity;
      button.addEventListener('pointerdown', event => {
        if (event.pointerType === 'touch' && event.isPrimary) {
          contact = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }
      });
      button.addEventListener('pointercancel', () => { contact = undefined; });
      button.addEventListener('pointerup', event => {
        if (contact?.id !== event.pointerId) return;
        const { x, y } = contact;
        contact = undefined;
        if (Math.hypot(event.clientX - x, event.clientY - y) > 10) return;
        tappedAt = performance.now();
        tap();
      });
      button.addEventListener('click', event => {
        if (event.pointerType === 'touch' ||
            (!event.pointerType && event.detail && performance.now() - tappedAt < 700)) return;
        click(event);
      });
    }

    bindButton(trigger, event => {
      if (event.pointerType === 'mouse') {
        toggleMute();
      } else {
        setOpen(panel.hidden);
        if (event.detail === 0 && !panel.hidden) input.focus({ preventScroll: true });
      }
    }, () => setOpen(panel.hidden));
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) {
        event.stopPropagation();
        setOpen(false);
      }
    });
    root.addEventListener('focusout', event => {
      if (!root.contains(event.relatedTarget) && !root.matches(':hover')) setOpen(false);
    });
    document.addEventListener('pointerdown', event => {
      if (!root.contains(event.target)) setOpen(false);
    });
    window.addEventListener('resize', () => {
      if (!panel.hidden) positionPanel();
    });
    bindButton(mute, toggleMute, toggleMute);
    input.addEventListener('input', () => {
      const track = getTrack();
      if (!track) return;
      const value = Number(input.value);
      if (value > 0) track.lastVolume = value;
      track.output.set(value);
      track.syncVolume();
    });
    return { update, close: () => setOpen(false) };
  }

  function addLyrics(player, source, translation, seekTo) {
    const lines = parseLyrics(source || '');
    if (!lines.length) return;
    const translations = new Map(parseLyrics(translation || '').map(line =>
      [Math.round(line.time * 1000), line.text]));
    const panel = player.querySelector('.music-lyrics');
    if (lines[0].time > 0) lines.unshift({ time: 0, text: '前奏' });
    for (const line of lines) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'music-line';
      const stamp = document.createElement('time');
      stamp.className = 'music-line-time';
      stamp.dateTime = 'PT' + line.time + 'S';
      stamp.textContent = formatTime(line.time);
      const lyric = document.createElement('span');
      lyric.className = 'music-line-text';
      lyric.textContent = line.text;
      row.append(stamp, lyric);
      row.addEventListener('click', () => seekTo(line.time));
      line.translation = translations.get(Math.round(line.time * 1000));
      if (line.translation) {
        const second = document.createElement('span');
        second.className = 'music-line-translation';
        second.lang = 'zh-CN';
        second.textContent = line.translation;
        lyric.append(second);
      }
      line.row = row;
      panel.append(row);
    }
    panel.hidden = false;
    const lyrics = { panel, lines, index: -1, browsingUntil: 0 };
    const browse = () => { lyrics.browsingUntil = performance.now() + 2000; };
    panel.addEventListener('wheel', browse, { passive: true });
    panel.addEventListener('touchmove', browse, { passive: true });
    return lyrics;
  }

  function syncLyrics(lyrics, time) {
    if (!lyrics) return;
    const index = lyrics.lines.findLastIndex(line => line.time <= time);
    if (index === lyrics.index) return;
    lyrics.lines[lyrics.index]?.row.removeAttribute('aria-current');
    lyrics.index = index;
    const row = lyrics.lines[index].row;
    row.setAttribute('aria-current', 'true');
    if (performance.now() < lyrics.browsingUntil) return;
    lyrics.panel.scrollTo({
      top: row.offsetTop - (lyrics.panel.clientHeight - row.offsetHeight) / 2,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
  }


  function enableDockDragging(dock) {
    const handle = dock.querySelector('.music-dock-copy');
    const cover = dock.querySelector('.music-cover');
    const resizeEdges = dock.querySelectorAll('.music-resize-edge');
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'music-edge-tab';
    tab.setAttribute('aria-label', '展开悬浮播放器');
    tab.setAttribute('aria-controls', dock.id);
    tab.setAttribute('aria-expanded', 'false');
    tab.hidden = true;
    dock.after(tab);

    const minimumFullWidth = 220;
    const minimumFullHeight = 82;
    const margin = 8;
    const hideThreshold = 1 / 5;
    const pullThreshold = 10;
    const inward = { left: [1, 0], right: [-1, 0], top: [0, 1], bottom: [0, -1] };
    const directions = new Map([
      ['ArrowLeft', [-1, 0]], ['ArrowRight', [1, 0]],
      ['ArrowUp', [0, -1]], ['ArrowDown', [0, 1]]
    ]);
    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
    const viewportWidth = () => document.documentElement.clientWidth;
    let position;
    let edge = '';
    let gesture;
    let skipClick;
    let hideTimer;
    let pinned = false;
    let parkedAt = -Infinity;

    function compact() {
      return dock.hasAttribute('data-compact');
    }

    function reveal(show) {
      const tucked = Boolean(edge && !show);
      if (tucked && dock.contains(document.activeElement) && !tab.hidden) tab.focus({ preventScroll: true });
      dock.toggleAttribute('data-tucked', tucked);
      dock.inert = tucked;
      tab.setAttribute('aria-expanded', Boolean(edge && show));
    }

    function setEdge(next) {
      edge = next;
      pinned = false;
      dock.dataset.edge = edge;
      tab.dataset.edge = edge;
      tab.hidden = !edge || dock.hidden;
      if (edge) parkedAt = performance.now();
      reveal(!edge);
    }

    function place(left, top, allowOverflow = false) {
      const { offsetWidth: width, offsetHeight: height } = dock;
      const viewport = viewportWidth();
      const limitX = Math.max(0, viewport - width);
      const limitY = Math.max(0, window.innerHeight - height);
      const gapX = Math.min(margin, limitX / 2);
      const gapY = Math.min(margin, limitY / 2);
      const alignedEdge = gesture?.kind === 'pull' && gesture.moved ? '' : edge;
      if (allowOverflow) {
        left = clamp(left, 22 - width, viewport - 22);
        top = clamp(top, 22 - height, window.innerHeight - 22);
      } else {
        left = clamp(left, gapX, limitX - gapX);
        top = clamp(top, gapY, limitY - gapY);
        if (alignedEdge === 'left') left = gapX;
        if (alignedEdge === 'right') left = limitX - gapX;
        if (alignedEdge === 'top') top = gapY;
        if (alignedEdge === 'bottom') top = limitY - gapY;
      }
      position = { left, top };
      dock.style.setProperty('--dock-left', left + 'px');
      dock.style.setProperty('--dock-top', top + 'px');
      dock.dataset.positioned = '';
      if (alignedEdge) {
        const side = alignedEdge === 'left' || alignedEdge === 'right';
        const center = side ? top + height / 2 : left + width / 2;
        const limit = side ? window.innerHeight : viewport;
        const length = side ? tab.offsetHeight : tab.offsetWidth;
        const gap = Math.min(margin, Math.max(0, (limit - length) / 2));
        tab.style.setProperty('--edge-offset', clamp(center - length / 2, gap, limit - length - gap) + 'px');
      }
    }

    function keepInView() {
      tab.hidden = !edge || dock.hidden;
      if (dock.hidden) {
        pinned = false;
        reveal(false);
      } else if (position && !gesture?.moved) {
        place(position.left, position.top);
      }
    }

    function alignResizedDock(rect, side) {
      const left = side === 'left' ? rect.right - dock.offsetWidth : rect.left;
      const top = side === 'top' ? rect.bottom - dock.offsetHeight : rect.top;
      place(left, top);
    }

    function resize(value, side, rect) {
      const vertical = side === 'top' || side === 'bottom';
      const available = Math.max(0, (vertical ? window.innerHeight : viewportWidth()) - 2 * margin);
      const minimum = Math.min(vertical ? minimumFullHeight : minimumFullWidth, available);
      const shrink = value < minimum;
      dock.toggleAttribute('data-compact', shrink);
      if (!shrink) {
        const size = Math.min(value, available, vertical ? 184 : 448);
        dock.style.setProperty(vertical ? '--dock-height' : '--dock-width', size + 'px');
        if (vertical) dock.dataset.heightAdjusted = '';
      }
      alignResizedDock(rect, side);
    }

    function closeAfterLeave() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (edge && !pinned && !gesture && !tab.matches(':hover') && !dock.matches(':hover') &&
            !dock.matches(':has(:focus-visible)')) reveal(false);
      }, 220);
    }

    for (const target of [dock, tab]) {
      target.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'mouse') return;
        clearTimeout(hideTimer);
        if (edge && performance.now() - parkedAt > 300) reveal(true);
      });
      target.addEventListener('pointerleave', event => {
        if (event.pointerType === 'mouse') closeAfterLeave();
      });
      target.addEventListener('keydown', event => {
        if (event.key === 'Escape' && edge && !dock.inert) {
          event.stopPropagation();
          pinned = false;
          reveal(false);
        }
      });
    }
    function toggleTab(focusCover) {
      pinned = !pinned;
      reveal(pinned);
      if (pinned && focusCover) cover.focus({ preventScroll: true });
    }

    tab.addEventListener('click', event => {
      if (event.detail && skipClick === tab) {
        skipClick = undefined;
        return;
      }
      if (event.pointerType === 'mouse') {
        reveal(true);
      } else {
        toggleTab(event.detail === 0);
      }
    });
    document.addEventListener('pointerdown', event => {
      if (edge && !dock.inert && !tab.contains(event.target) && !dock.contains(event.target)) {
        pinned = false;
        reveal(false);
      }
    });

    function start(event, kind, side) {
      if (!event.isPrimary || event.button !== 0 || gesture) return;
      skipClick = undefined;
      gesture = {
        target: event.currentTarget, id: event.pointerId, kind, side,
        rect: kind === 'pull' ? position : dock.getBoundingClientRect(),
        x: event.clientX, y: event.clientY, moved: false
      };
      if (event.pointerType === 'mouse') {
        event.preventDefault();
        if (kind === 'move') event.currentTarget.focus({ preventScroll: true });
      }
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    function move(event) {
      if (gesture?.id !== event.pointerId || dock.hidden) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      const { kind, rect, side } = gesture;
      if (!gesture.moved) {
        if (kind === 'pull') {
          if (Math.hypot(dx, dy) < pullThreshold) return;
          gesture.swiped = true;
          const [x, y] = inward[side];
          if (dx * x + dy * y < pullThreshold) return;
        } else if (Math.hypot(dx, dy) < 5) return;
        gesture.moved = true;
        dock.dataset.dragging = '';
        if (kind === 'move' && edge) setEdge('');
        // Keep the tab available for pointer capture until the pull ends.
        if (kind === 'pull') reveal(true);
      }
      if (kind === 'resize') {
        const vertical = side === 'top' || side === 'bottom';
        const fromStart = side === 'left' || side === 'top';
        const delta = (vertical ? dy : dx) * (fromStart ? -1 : 1);
        resize((vertical ? rect.height : rect.width) + delta, side, rect);
      } else {
        place(rect.left + dx, rect.top + dy, kind === 'move');
      }
    }

    function finish(event, commit) {
      if (gesture?.id !== event.pointerId) return;
      const { moved, swiped, target, kind, rect, x, y } = gesture;
      gesture = undefined;
      delete dock.dataset.dragging;
      if (moved || (kind === 'pull' && commit)) skipClick = target;
      if (dock.hidden) return;
      if (!moved) {
        if (kind === 'pull' && commit && !swiped && Math.hypot(event.clientX - x, event.clientY - y) < pullThreshold) {
          toggleTab(false);
        }
        return;
      }
      if (kind === 'pull') {
        if (commit) setEdge('');
        else {
          reveal(pinned);
          place(rect.left, rect.top);
        }
      } else if (kind === 'move' && commit) {
        const { left, right, top, bottom, width, height } = dock.getBoundingClientRect();
        const overflow = [
          ['left', -left / width], ['right', (right - viewportWidth()) / width],
          ['top', -top / height], ['bottom', (bottom - window.innerHeight) / height]
        ];
        const [side, fraction] = overflow.reduce((largest, current) => current[1] > largest[1] ? current : largest);
        if (fraction > hideThreshold) setEdge(side);
      }
      keepInView();
    }

    handle.addEventListener('pointerdown', event => start(event, 'move'));
    cover.addEventListener('pointerdown', event => {
      if (compact()) start(event, 'move');
    });
    tab.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') {
        if (skipClick === tab) skipClick = undefined;
      } else if (edge) {
        start(event, 'pull', edge);
      }
    });
    for (const bar of resizeEdges) {
      bar.addEventListener('pointerdown', event => start(event, 'resize', bar.dataset.resizeEdge));
    }
    for (const target of [handle, cover, tab, ...resizeEdges]) {
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', event => finish(event, true));
      target.addEventListener('pointercancel', event => finish(event, false));
      target.addEventListener('lostpointercapture', event => finish(event, false));
    }
    dock.addEventListener('click', event => {
      if (event.detail && skipClick?.contains(event.target)) {
        event.stopImmediatePropagation();
        skipClick = undefined;
      }
    }, true);

    handle.addEventListener('keydown', event => {
      const direction = directions.get(event.key);
      if (!direction) return;
      event.preventDefault();
      const { left, top } = dock.getBoundingClientRect();
      if (edge) setEdge('');
      place(left + direction[0] * 16, top + direction[1] * 16);
    });
    window.addEventListener('resize', keepInView);
    return keepInView;
  }

  function mount(article, tracks = {}) {
    const players = [...article.querySelectorAll('.article-audio')];
    if (!players.length) return;

    const settings = new Map(Object.entries(tracks).map(([source, track]) =>
      [new URL(source, document.baseURI).href, track]));
    let active;
    let dockTrack;
    const dock = document.createElement('aside');
    dock.className = 'music-dock';
    dock.id = 'music-dock';
    dock.setAttribute('aria-label', '悬浮音乐播放器');
    dock.hidden = true;
    dock.innerHTML = coverButton + '<div class="music-dock-copy" tabindex="0" role="group" ' +
      'aria-label="移动播放器，可用方向键" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight" title="拖动播放器">' +
      '<strong></strong><span></span><span class="music-dock-translation" lang="zh-CN" hidden></span></div>' +
      '<div class="music-dock-actions"><button type="button" class="music-return">回到播放器</button>' +
      volumeControl + '</div>' +
      ['top', 'right', 'bottom', 'left'].map(side =>
        '<span class="music-resize-edge" data-resize-edge="' + side + '" aria-hidden="true"></span>').join('');
    document.body.append(dock);
    const keepDockInView = enableDockDragging(dock);
    const floatingCover = dock.querySelector('.music-cover');
    const dockTitle = dock.querySelector('strong');
    const dockDetail = dock.querySelector('.music-dock-copy span');
    const dockTranslation = dock.querySelector('.music-dock-translation');
    const dockVolume = bindVolume(dock.querySelector('.music-volume'), () => active);
    setCover(floatingCover);
    floatingCover.addEventListener('click', () => active?.toggle());
    dock.querySelector('.music-return').addEventListener('click', () => {
      active.player.scrollIntoView({ block: 'center' });
      active.cover.focus({ preventScroll: true });
    });

    function refreshDock() {
      const show = active && !active.visible && !active.audio.ended;
      const wasHidden = dock.hidden;
      dock.hidden = !show;
      if (!show) {
        dockVolume.close();
        if (!wasHidden) keepDockInView();
        return;
      }
      if (dockTrack !== active) {
        dockTrack = active;
        setArtwork(floatingCover, active.artwork);
        dockTitle.textContent = active.title;
        dockVolume.update();
      }
      const { audio, title, lyrics, details } = active;
      const playing = !audio.paused;
      dock.dataset.playing = playing;
      setPlayback(floatingCover, playing, title);
      const currentLine = lyrics?.lines[lyrics.index];
      dock.toggleAttribute('data-has-lyrics', Boolean(currentLine));
      const translation = currentLine?.translation || '';
      const translationVisibilityChanged = dockTranslation.hidden === Boolean(translation);
      dockDetail.textContent = currentLine?.text || details || formatTime(audio.currentTime);
      dockTranslation.hidden = !translation;
      dockTranslation.textContent = translation;
      if (wasHidden || translationVisibilityChanged) keepDockInView();
    }

    const states = new Map();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) states.get(entry.target).visible = entry.isIntersecting;
      refreshDock();
    });

    for (const player of players) {
      const audio = player.querySelector('audio');
      const output = createVolumeOutput(audio);
      const titleNode = player.querySelector('.article-audio-title');
      const title = titleNode.textContent;
      const track = settings.get(audio.src) || {};
      const details = [track.artist, track.album].filter(Boolean).join('\u2002·\u2002');

      const layout = document.createElement('span');
      layout.className = 'music-layout';
      layout.innerHTML = '<span class="music-header">' + coverButton +
        '<span class="music-info"><span class="music-details" data-search-ignore></span>' +
        '<input class="music-seek" aria-label="播放进度" type="range" min="0" max="1" step="0.1" value="0" disabled>' +
        '<span class="music-controls" data-search-ignore>' +
        '<button type="button" class="music-play-button">' + playIcon + '</button>' +
        '<span class="music-timestamps"><span>0:00</span><span>--:--</span></span>' + volumeControl + '</span>' +
        '<span class="music-status" role="status" data-search-ignore hidden></span></span></span>' +
        '<span class="music-lyrics" role="region" aria-label="同步歌词" tabindex="0" data-search-ignore hidden></span>';
      player.prepend(layout);
      layout.querySelector('.music-info').prepend(titleNode);
      const detailsNode = layout.querySelector('.music-details');
      detailsNode.textContent = details;
      detailsNode.hidden = !details;
      const cover = layout.querySelector('.music-cover');
      const playButton = layout.querySelector('.music-play-button');
      const seek = layout.querySelector('.music-seek');
      const volume = bindVolume(layout.querySelector('.music-volume'), () => state);
      const [elapsed, duration] = layout.querySelectorAll('.music-timestamps > span');
      const status = layout.querySelector('.music-status');
      const lyrics = addLyrics(layout, track.lyrics, track.translation, seekTo);
      let seekDrag;
      setCover(cover, track.cover);

      function showSeekTime(time) {
        elapsed.textContent = formatTime(time);
        seek.setAttribute('aria-valuetext', elapsed.textContent + ' / ' + duration.textContent);
      }

      function syncProgress() {
        const hasDuration = Number.isFinite(audio.duration);
        seek.disabled = !hasDuration;
        if (hasDuration) seek.max = audio.duration;
        duration.textContent = hasDuration ? formatTime(audio.duration) : '--:--';
        if (!seekDrag) {
          seek.value = audio.currentTime;
          showSeekTime(audio.currentTime);
        }
        syncLyrics(lyrics, audio.currentTime);
        if (active === state) refreshDock();
      }

      function seekTo(time) {
        if (lyrics) lyrics.browsingUntil = 0;
        audio.currentTime = Number.isFinite(audio.duration) ? Math.min(time, audio.duration) : time;
        syncProgress();
      }

      function finishSeekDrag(time) {
        seekDrag = undefined;
        if (time === undefined || seek.disabled) syncProgress();
        else seekTo(time);
      }

      function syncPlayback() {
        const playing = !audio.paused && !audio.ended;
        player.dataset.playing = playing;
        setPlayback(cover, playing, title);
        setPlayback(playButton, playing, title);
        syncProgress();
      }

      function syncVolume() {
        volume.update();
        if (active === state) dockVolume.update();
      }

      async function toggle() {
        if (!audio.paused && !audio.ended) {
          audio.pause();
          return;
        }
        status.hidden = true;
        try {
          const ready = output.prepare();
          await Promise.all([audio.play(), ready]);
        } catch (error) {
          if (error.name !== 'AbortError') {
            status.textContent = '无法播放此音频';
            status.hidden = false;
          }
        }
      }

      const state = {
        player, audio, output, cover, title, details, lyrics, artwork: track.cover,
        visible: true, lastVolume: defaultVolume, toggle, syncVolume
      };
      states.set(player, state);
      observer.observe(player);
      cover.addEventListener('click', toggle);
      playButton.addEventListener('click', toggle);
      seek.addEventListener('pointerdown', event => {
        if (event.isPrimary && event.button === 0 && !seek.disabled) {
          seekDrag = { pointerId: event.pointerId };
        }
      });
      seek.addEventListener('input', () => {
        const time = seek.valueAsNumber;
        if (seekDrag) {
          seekDrag.time = time;
          showSeekTime(time);
        } else {
          seekTo(time);
        }
      });
      window.addEventListener('pointerup', event => {
        const drag = seekDrag;
        if (drag?.pointerId !== event.pointerId) return;
        // The native range control can send its final input after pointerup.
        setTimeout(() => {
          if (seekDrag === drag) finishSeekDrag(drag.time);
        }, 0);
      });
      window.addEventListener('pointercancel', event => {
        if (seekDrag?.pointerId === event.pointerId) finishSeekDrag();
      });
      window.addEventListener('blur', () => {
        if (seekDrag) finishSeekDrag();
      });
      syncVolume();
      audio.addEventListener('volumechange', syncVolume);
      audio.addEventListener('play', () => {
        const previous = active;
        active = state;
        if (previous && previous !== state) previous.audio.pause();
        syncPlayback();
      });
      for (const event of ['pause', 'ended']) audio.addEventListener(event, syncPlayback);
      for (const event of ['timeupdate', 'durationchange', 'seeking']) audio.addEventListener(event, syncProgress);

      player.dataset.enhanced = '';
      audio.controls = false;
      audio.hidden = true;
      syncPlayback();
    }
  }

  return { mount };
})();
