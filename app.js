const $ = s => document.querySelector(s);
function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
if ($('#entries')) {
  function render(term = '') {
    const matches = posts.filter(p => [p.title,p.tag,p.summary,...p.paragraphs].join(' ').toLowerCase().includes(term.trim().toLowerCase()));
    $('#entries').replaceChildren(...matches.map(p => {
      const a = document.createElement('a');
      a.className = 'entry';
      a.href = './post.html?id=' + encodeURIComponent(p.id);
      a.append(element('small',p.tag),element('h3',p.title),element('p',p.summary),element('time',p.date || '日期待填写'));
      return a;
    }));
    $('#empty').hidden = matches.length > 0;
  }
  render();
  const q = $('#query');
  function toggleSearch(open) {
    q.hidden = !open;
    $('#find').setAttribute('aria-expanded',String(open));
    if (open) q.focus(); else {q.value=''; render(); $('#find').focus();}
  }
  $('#find').onclick = () => toggleSearch(q.hidden);
  q.oninput = () => render(q.value);
  q.onkeydown = e => {if(e.key === 'Escape') toggleSearch(false);};
  $('#mini').onclick = () => $('#mini').setAttribute('aria-expanded',String($('#music').classList.toggle('opened')));
  const audio = $('audio');
  let localUrl;
  if(playlistTrack.src) {audio.src=playlistTrack.src; $('#song').textContent=playlistTrack.title;}
  $('#file').onchange = e => {
    const f=e.target.files[0]; if(!f) return;
    if(localUrl) URL.revokeObjectURL(localUrl);
    localUrl=URL.createObjectURL(f); audio.src=localUrl;
    $('#song').textContent=f.name; audio.play().catch(()=>{});
  };
} else {
  const p=posts.find(item => item.id === new URLSearchParams(location.search).get('id'));
  const article=$('#story');
  if(p) {
    document.title=p.title+' · 夜色手记';
    article.append(element('small',p.tag),element('h1',p.title),element('time',p.date || '日期待填写'),...p.paragraphs.map(t=>element('p',t)));
  } else article.append(element('h1','找不到这篇文章'));
}
