/* ===== Plataformas ===== */
const PLAT = {
  x:        { label: 'X',         short: 'X'   },
  threads:  { label: 'Threads',   short: 'Th'  },
  instagram:{ label: 'Instagram', short: 'IG'  },
  tiktok:   { label: 'TikTok',    short: 'TT'  },
  youtube:  { label: 'YouTube',   short: 'YT'  },
  web:      { label: 'Outros',    short: 'Web' }
};
const CORES = ['laranja','ouro','marrom','verde','azul','rosa'];
const CORES_NOME = { laranja:'Carmim', ouro:'Amarelo', marrom:'Caramelo', verde:'Verde', azul:'Azul', rosa:'Rosa' };
const TRACK = /^(utm_|fbclid|gclid|igsh|igshid|si$|feature$|ref$|ref_src|ref_url|s$|t$|share|is_from_webapp|sender_device|_t$|_r$|mibextid|xmt|slof|pp$)/i;

/* ===== Leitura do link ===== */
function parseLink(raw) {
  let s = String(raw || '').trim();
  if (!s) return { error: 'vazio' };
  if (/\s/.test(s)) return { error: 'espaco' };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    if (/^[^\s\/?#]+\.[a-z]{2,}([\/?#]|$)/i.test(s)) s = 'https://' + s; else return { error: 'invalido' };
  }
  let u;
  try { u = new URL(s); } catch (e) { return { error: 'invalido' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'invalido' };
  if (!u.hostname.includes('.')) return { error: 'invalido' };

  const host = u.hostname.toLowerCase();
  const bare = host.replace(/^(www|m|mobile|web)\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  let plataforma = 'web', tipo = 'Link', autor = null, key = null, keepQuery = [];

  if (bare === 'x.com' || bare === 'twitter.com') {
    plataforma = 'x';
    if (parts[1] === 'status' && parts[2]) { tipo = 'Post'; autor = parts[0] === 'i' ? null : '@' + parts[0]; key = 'x:' + parts[2]; }
    else if (parts[0] && !['i', 'home', 'explore', 'search', 'hashtag'].includes(parts[0])) { tipo = 'Perfil'; autor = '@' + parts[0]; key = 'x:perfil:' + parts[0].toLowerCase(); }
    else { tipo = 'Link'; }
  } else if (bare === 'threads.net' || bare === 'threads.com') {
    plataforma = 'threads';
    if (parts[0] && parts[0][0] === '@') {
      autor = parts[0];
      if (parts[1] === 'post' && parts[2]) { tipo = 'Post'; key = 'threads:' + parts[2]; }
      else { tipo = 'Perfil'; key = 'threads:perfil:' + parts[0].toLowerCase(); }
    } else if (parts[0] === 't' && parts[1]) { tipo = 'Post'; key = 'threads:' + parts[1]; }
  } else if (bare === 'instagram.com' || bare === 'instagr.am') {
    plataforma = 'instagram';
    let i = 0;
    if (parts[0] && !['p', 'reel', 'reels', 'tv', 'stories', 'explore'].includes(parts[0]) && parts[1] && ['p', 'reel', 'reels', 'tv'].includes(parts[1])) { autor = '@' + parts[0]; i = 1; }
    const k = parts[i];
    if (['reel', 'reels'].includes(k) && parts[i + 1]) { tipo = 'Reel'; key = 'ig:' + parts[i + 1]; }
    else if (k === 'p' && parts[i + 1]) { tipo = 'Post'; key = 'ig:' + parts[i + 1]; }
    else if (k === 'tv' && parts[i + 1]) { tipo = 'Vídeo'; key = 'ig:' + parts[i + 1]; }
    else if (k === 'stories' && parts[1]) { tipo = 'Story'; autor = '@' + parts[1]; key = 'ig:story:' + parts.slice(1).join('/'); }
    else if (k && k !== 'explore') { tipo = 'Perfil'; autor = '@' + k; key = 'ig:perfil:' + k.toLowerCase(); }
  } else if (bare.endsWith('tiktok.com')) {
    plataforma = 'tiktok';
    if (parts[0] && parts[0][0] === '@') {
      autor = parts[0];
      if (parts[1] === 'video' && parts[2]) { tipo = 'Vídeo'; key = 'tt:' + parts[2]; }
      else if (parts[1] === 'photo' && parts[2]) { tipo = 'Post'; key = 'tt:' + parts[2]; }
      else { tipo = 'Perfil'; key = 'tt:perfil:' + parts[0].toLowerCase(); }
    } else { tipo = 'Vídeo'; key = 'tt:' + bare + u.pathname.replace(/\/$/, ''); }
  } else if (bare === 'youtube.com' || bare === 'music.youtube.com' || bare === 'youtu.be' || bare === 'youtube-nocookie.com') {
    plataforma = 'youtube';
    if (bare === 'youtu.be' && parts[0]) { tipo = 'Vídeo'; key = 'yt:' + parts[0]; }
    else if (parts[0] === 'shorts' && parts[1]) { tipo = 'Short'; key = 'yt:' + parts[1]; }
    else if (parts[0] === 'live' && parts[1]) { tipo = 'Live'; key = 'yt:' + parts[1]; }
    else if (parts[0] === 'watch' && u.searchParams.get('v')) { tipo = 'Vídeo'; key = 'yt:' + u.searchParams.get('v'); keepQuery = ['v', 'list']; }
    else if (parts[0] === 'playlist' && u.searchParams.get('list')) { tipo = 'Playlist'; key = 'yt:pl:' + u.searchParams.get('list'); keepQuery = ['list']; }
    else if (parts[0] && parts[0][0] === '@') { tipo = 'Canal'; autor = parts[0]; key = 'yt:canal:' + parts[0].toLowerCase(); }
    else if (['channel', 'c', 'user'].includes(parts[0]) && parts[1]) { tipo = 'Canal'; key = 'yt:canal:' + parts[1].toLowerCase(); }
  }

  // endereço limpo: sem rastreadores e sem âncora
  const clean = new URL(u.origin + u.pathname);
  if (plataforma === 'web') {
    u.searchParams.forEach((v, k) => { if (!TRACK.test(k)) clean.searchParams.append(k, v); });
  } else {
    keepQuery.forEach(k => { const v = u.searchParams.get(k); if (v) clean.searchParams.set(k, v); });
  }
  let url = clean.toString();
  if (clean.pathname.length > 1 && url.endsWith('/') && !clean.search) url = url.slice(0, -1);
  if (!key) key = 'url:' + bare + clean.pathname.replace(/\/$/, '') + clean.search;
  return { plataforma, tipo, autor, key, url, host: bare };
}

function autoTitle(l) {
  const a = l.autor;
  switch (l.plataforma) {
    case 'x': return l.tipo === 'Perfil' ? 'Perfil ' + a : (a ? 'Post de ' + a : 'Post no X');
    case 'threads': return l.tipo === 'Perfil' ? 'Perfil ' + a : (a ? 'Post de ' + a : 'Post no Threads');
    case 'instagram':
      if (l.tipo === 'Perfil') return 'Perfil ' + a;
      if (l.tipo === 'Story') return 'Story de ' + a;
      return (l.tipo === 'Reel' ? 'Reel' : l.tipo === 'Vídeo' ? 'Vídeo' : 'Post') + (a ? ' de ' + a : ' no Instagram');
    case 'tiktok': return l.tipo === 'Perfil' ? 'Perfil ' + a : (a ? (l.tipo === 'Post' ? 'Post de ' : 'Vídeo de ') + a : 'Vídeo no TikTok');
    case 'youtube':
      if (l.tipo === 'Canal') return a ? 'Canal ' + a : 'Canal do YouTube';
      return (l.tipo === 'Short' ? 'Short' : l.tipo === 'Playlist' ? 'Playlist' : l.tipo === 'Live' ? 'Live' : 'Vídeo') + ' do YouTube';
    default: return l.host || (l.url ? shortUrl(l.url).split('/')[0].replace(/^(m|mobile)\./, '') : 'Link');
  }
}
function shortUrl(u) { return u.replace(/^https?:\/\/(www\.)?/, ''); }
function ago(ms) {
  const d = Math.floor((Date.now() - ms) / 864e5);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 7) return 'há ' + d + ' dias';
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const $ = id => document.getElementById(id);

/* ===== Estado e armazenamento ===== */
const S = { folders: [], links: [], loaded: false, loadError: false, mode: 'local', view: 'all', q: '', plat: 'all', editing: null, draft: null, dest: '', flash: null, modal: null, layout: 'cards', selecting: false, sel: [] };
try { if (localStorage.getItem('brica.layout') === 'list') S.layout = 'list'; } catch (e) {}
let backend = null;

function snapToList(snap) {
  const docs = snap && snap.docs ? snap.docs : (Array.isArray(snap) ? snap : []);
  const out = [];
  docs.forEach(d => {
    const data = typeof d.data === 'function' ? d.data() : (d.data || d);
    out.push(Object.assign({}, data, { id: d.id || data.id }));
  });
  return out;
}
function localBackend() {
  const key = 'roni.v2';
  let data = { folders: [], links: [] };
  try { const raw = localStorage.getItem(key); if (raw) data = Object.assign(data, JSON.parse(raw)); } catch (e) {}
  const persist = () => { try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {} };
  return {
    mode: 'local',
    start(onData) { onData({ folders: data.folders.slice(), links: data.links.slice() }); },
    async set(col, id, rec) { const a = data[col]; const i = a.findIndex(x => x.id === id); const r = Object.assign({}, rec, { id }); if (i < 0) a.push(r); else a[i] = r; persist(); },
    async remove(col, id) { data[col] = data[col].filter(x => x.id !== id); persist(); }
  };
}


/* ===== Supabase (login por link no e-mail, dados por usuário) ===== */
const CFG = window.BB_CONFIG || {};
let sb = null;
function supabaseBackend(client) {
  const toRec = r => Object.assign({}, r.data, { id: r.id });
  const load = async () => {
    const [f, l] = await Promise.all([client.from('folders').select('id,data'), client.from('links').select('id,data')]);
    if (f.error) throw f.error; if (l.error) throw l.error;
    return { folders: f.data.map(toRec), links: l.data.map(toRec) };
  };
  return {
    mode: 'cloud',
    async start(onData, onError) {
      const refresh = async () => { try { onData(await load()); } catch (e) { onError(e); } };
      await refresh();
      client.channel('bb-sync').on('postgres_changes', { event: '*', schema: 'public' }, () => { if (!S.editing && !S.modal) refresh(); }).subscribe();
    },
    async set(col, id, rec) { const data = Object.assign({}, rec); delete data.id; const { error } = await client.from(col).upsert({ id, data }); if (error) throw error; },
    async remove(col, id) { const { error } = await client.from(col).delete().eq('id', id); if (error) throw error; }
  };
}
function authHeaders() {
  return sb ? sb.auth.getSession().then(r => { const t = r.data && r.data.session && r.data.session.access_token; return t ? { Authorization: 'Bearer ' + t } : {}; }) : Promise.resolve({});
}
function renderLogin(msg, kind) {
  document.body.innerHTML = '<main class="login"><div class="brand"><b>brica-braca</b></div><p class="lead">Entre com o seu e-mail. Vamos enviar um link para você entrar, sem senha.</p>' +
    '<form id="login-form"><label class="f">E-mail<input type="email" id="login-email" autocomplete="email" required placeholder="voce@email.com"></label>' +
    '<button class="btn primary" type="submit">Enviar link</button></form><p class="msg ' + (kind || '') + '" id="login-msg" role="status" aria-live="polite">' + esc(msg || '') + '</p></main>';
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('login-email').value.trim();
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
    const m = $('login-msg');
    if (error) { m.className = 'msg err'; m.textContent = 'Não consegui enviar o link. Confira o e-mail e tente de novo.'; }
    else { m.className = 'msg ok'; m.textContent = 'Link enviado para ' + email + '. Abra o e-mail neste aparelho.'; }
  });
}

/* ===== Preview automático (título e imagem) ===== */
const enriching = new Set();
async function enrich(l) {
  if (!CFG.previewApi || l.enriquecido || enriching.has(l.id)) return;
  enriching.add(l.id);
  try {
    const r = await fetch(CFG.previewApi + '?url=' + encodeURIComponent(l.url), { headers: await authHeaders() });
    const d = r.ok ? await r.json() : null;
    const cur = S.links.find(x => x.id === l.id);
    if (!cur) return;
    const next = Object.assign({}, cur, { enriquecido: true });
    if (d && d.title) next.tituloAuto = d.title;
    if (d && d.image) next.thumb = d.image;
    if (r.ok) await save('links', next);
  } catch (e) { /* tenta de novo na próxima visita */ }
  finally { enriching.delete(l.id); }
}
function enrichPending() {
  const pend = S.links.filter(l => !l.enriquecido).slice(0, 40);
  let i = 0;
  const worker = async () => { while (i < pend.length) await enrich(pend[i++]); };
  worker(); worker(); worker();
}

function upsert(arr, rec) { const i = arr.findIndex(x => x.id === rec.id); if (i < 0) arr.push(rec); else arr[i] = rec; }
async function save(col, rec) {
  upsert(S[col], rec); render();
  try { await backend.set(col, rec.id, rec); } catch (e) { toast('Não consegui salvar agora. Tente de novo.'); }
}
async function remove(col, id) {
  S[col] = S[col].filter(x => x.id !== id); render();
  try { await backend.remove(col, id); } catch (e) { toast('Não consegui excluir agora. Tente de novo.'); }
}

/* ===== Consultas ===== */
const hashN = str => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; };
const colorOf = f => (f && Number.isInteger(f.cor)) ? f.cor % 8 : hashN((f && f.id) || '') % 8;
const newFolder = nome => ({ id: uid(), nome, cor: S.folders.length % 8, criadaEm: Date.now() });
const folderById = id => S.folders.find(f => f.id === id) || null;
const sortedFolders = () => S.folders.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
function inView(l) {
  if (S.view === 'all') return true;
  if (S.view === 'none') return !l.pastaId || !folderById(l.pastaId);
  return l.pastaId === S.view;
}
function viewTitle() {
  if (S.view === 'all') return 'Todos os links';
  if (S.view === 'none') return 'Sem pasta';
  const f = folderById(S.view); return f ? f.nome : 'Todos os links';
}
function visibleLinks() {
  const q = S.q.trim().toLowerCase();
  return S.links.filter(inView).filter(l => S.plat === 'all' || l.plataforma === S.plat).filter(l => {
    if (!q) return true;
    const f = folderById(l.pastaId);
    return [l.titulo, autoTitle(l), l.nota, l.autor, l.url, f && f.nome].filter(Boolean).join(' ').toLowerCase().includes(q);
  }).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
}

/* ===== Renderização ===== */
function render() {
  if (S.view !== 'all' && S.view !== 'none' && !folderById(S.view)) S.view = 'all';
  renderNav(); renderDest(); renderBanner(); renderHead(); renderTools(); renderList(); renderBulk();
}
function renderNav() {
  const total = S.links.length, none = S.links.filter(l => !l.pastaId || !folderById(l.pastaId)).length;
  const cur = v => S.view === v ? ' aria-current="true"' : '';
  let h = '<button class="nav-btn" data-view="all"' + cur('all') + '><span class="nm">Todos os links</span><span class="ct">' + total + '</span></button>';
  h += '<button class="nav-btn" data-view="none"' + cur('none') + '><span class="nm">Sem pasta</span><span class="ct">' + none + '</span></button>';
  h += '<div class="nav-h"><span>Pastas</span></div>';
  sortedFolders().forEach(f => {
    const n = S.links.filter(l => l.pastaId === f.id).length;
    h += '<button class="nav-btn" data-view="' + esc(f.id) + '"' + cur(f.id) + '><span class="nm">' + esc(f.nome) + '</span><span class="ct">' + n + '</span></button>';
  });
  h += '<button class="add-folder" data-act="new-folder">+ Nova pasta</button>';
  if (S.loaded && !S.folders.length) {
    h += '<div class="starter"><p>Comece por uma destas:</p>' + ['Receitas', 'Decoração', 'Pet'].map(n => '<button class="chip" data-act="starter" data-name="' + n + '">' + n + '</button>').join('') + '</div>';
  }
  $('nav').innerHTML = h;
  $('foot').textContent = S.mode === 'cloud' ? 'Seus links ficam salvos na sua conta e aparecem em qualquer aparelho.' : 'Modo local: seus links ficam só neste navegador.';
}
function renderDest() {
  const sel = $('dest');
  const opts = ['<option value="">Sem pasta</option>'].concat(sortedFolders().map(f => '<option value="' + esc(f.id) + '">' + esc(f.nome) + '</option>')).concat(['<option value="__new__">+ Nova pasta…</option>']);
  if (S.dest && !folderById(S.dest)) S.dest = '';
  sel.innerHTML = opts.join(''); sel.value = S.dest || '';
}
function renderBanner() {
  let h = '';
  if (S.loadError) h = '<div class="banner" role="alert">Não consegui carregar seus links agora. Feche e abra o brica-braca de novo em alguns instantes.</div>';
  else if (S.mode === 'local') h = '<div class="banner">Você está no modo local. Os links ficam só neste navegador e não aparecem em outros aparelhos.</div>';
  $('banner').innerHTML = h;
}
function renderHead() {
  const n = visibleLinks().length, base = S.links.filter(inView).length;
  const f = (S.view !== 'all' && S.view !== 'none') ? folderById(S.view) : null;
  $('head').innerHTML = '<div><h1 id="view-title">' + esc(viewTitle()) + '</h1><p>' + (base === 1 ? '1 link' : base + ' links') + (n !== base ? ' · ' + n + ' no filtro' : '') + '</p></div>' +
    (f ? '<button class="btn outline sm" data-act="edit-folder">Editar pasta</button>' : '');
}
function setLayout(v) {
  S.layout = v === 'list' ? 'list' : 'cards';
  try { localStorage.setItem('brica.layout', S.layout); } catch (e) {}
  renderTools(); renderList();
}
$('tools').addEventListener('click', e => { const b = e.target.closest('[data-layout]'); if (b) setLayout(b.dataset.layout); });
function renderTools() {
  const base = S.links.filter(inView);
  if (!S.links.length) { $('tools').innerHTML = ''; return; }
  const counts = {}; base.forEach(l => { counts[l.plataforma] = (counts[l.plataforma] || 0) + 1; });
  const present = Object.keys(PLAT).filter(k => counts[k]);
  if (S.plat !== 'all' && !counts[S.plat]) S.plat = 'all';
  let h = '<label class="sr" for="q">Buscar nos links</label><input class="search" id="q" type="search" placeholder="Buscar por título, autor, nota ou endereço" value="' + esc(S.q) + '">' +
    '<button type="button" class="btn outline" data-act="select-mode" aria-pressed="' + S.selecting + '">Selecionar</button>' +
    '<div class="seg" role="group" aria-label="Visualização">' +
    '<button type="button" data-layout="cards" aria-pressed="' + (S.layout !== 'list') + '" aria-label="Ver em cartões" title="Ver em cartões"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1.2"/><rect x="9" y="2" width="5" height="5" rx="1.2"/><rect x="2" y="9" width="5" height="5" rx="1.2"/><rect x="9" y="9" width="5" height="5" rx="1.2"/></svg></button>' +
    '<button type="button" data-layout="list" aria-pressed="' + (S.layout === 'list') + '" aria-label="Ver em lista" title="Ver em lista"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><path d="M2.5 4h.01M2.5 8h.01M2.5 12h.01"/></svg></button></div>';
  if (present.length > 1) {
    h += '<div class="chips" role="group" aria-label="Filtrar por rede"><button class="chip" data-plat="all" aria-pressed="' + (S.plat === 'all') + '">Tudo<span class="n">' + base.length + '</span></button>' +
      present.map(k => '<button class="chip" data-plat="' + k + '" aria-pressed="' + (S.plat === k) + '">' + PLAT[k].label + '<span class="n">' + counts[k] + '</span></button>').join('') + '</div>';
  }
  const had = document.activeElement && document.activeElement.id === 'q';
  const caret = had ? document.activeElement.selectionStart : 0;
  $('tools').innerHTML = h;
  if (had) { const q = $('q'); q.focus(); try { q.setSelectionRange(caret, caret); } catch (e) {} }
}
function thumbOf(l) {
  if (l.thumb && /^https:\/\//i.test(l.thumb)) return l.thumb;
  return '';
}
document.addEventListener('error', e => { const i = e.target; if (i && i.tagName === 'IMG' && i.parentNode && i.parentNode.classList.contains('preview')) i.remove(); }, true);
function linkHtml(l) {
  const p = PLAT[l.plataforma] || PLAT.web;
  const f = folderById(l.pastaId);
  const titulo = l.titulo || l.tituloAuto || autoTitle(l);
  const d0 = S.draft && S.draft.id === l.id ? S.draft : null; const curPasta = d0 && d0.pasta !== undefined ? d0.pasta : (l.pastaId || '');
  const folderOpts = ['<option value="">Sem pasta</option>'].concat(sortedFolders().map(x => '<option value="' + esc(x.id) + '"' + (x.id === curPasta ? ' selected' : '') + '>' + esc(x.nome) + '</option>')).concat(['<option value="__new__">+ Nova pasta…</option>']).join('');
  const d = S.draft && S.draft.id === l.id ? S.draft : null;
  let h = '<article class="link' + (S.flash === l.id ? ' flash' : '') + '" data-id="' + esc(l.id) + '" aria-selected="' + (S.sel.indexOf(l.id) >= 0) + '">' +
    '<button type="button" class="pick" data-act="pick" role="checkbox" aria-checked="' + (S.sel.indexOf(l.id) >= 0) + '" aria-label="Selecionar link"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg></button>' +
    '<div class="preview" aria-hidden="true">' + p.short + (thumbOf(l) ? '<img src="' + esc(thumbOf(l)) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</div>' +
    '<div class="ltext"><h3 class="ttl">' + esc(titulo) + '</h3>' +
    '<p class="meta"><span>' + p.label + ' · ' + esc(l.tipo || 'Link') + '</span><span>' + ago(l.criadoEm || Date.now()) + '</span>' +
    '</p>' +
    '<p class="url" title="' + esc(l.url) + '">' + esc(shortUrl(l.url)) + '</p>' +
    (l.nota ? '<p class="note">' + esc(l.nota) + '</p>' : '') +
    '</div>' +
    '<div class="acts">' +
    (f ? '<span class="tag" data-c="' + colorOf(f) + '" title="' + esc(f.nome) + '">' + esc(f.nome) + '</span>' : '') +
    '<button class="btn outline sm icon" data-act="copy" aria-label="Copiar link" title="Copiar link"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.8"/><path d="M10.5 3.5v-.2a1.8 1.8 0 0 0-1.8-1.8H3.8a1.8 1.8 0 0 0-1.8 1.8v4.9a1.8 1.8 0 0 0 1.8 1.8h.2"/></svg></button>' +
    '<a class="btn outline sm icon" href="https://wa.me/?text=' + encodeURIComponent(titulo + '\n' + l.url) + '" target="_blank" rel="noopener noreferrer" aria-label="Enviar no WhatsApp" title="Enviar no WhatsApp"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8a6.2 6.2 0 0 0-5.3 9.4L1.9 14l2.9-.8A6.2 6.2 0 1 0 8 1.8z"/><path d="M5.9 5.4c.3 2.3 2.3 4.3 4.7 4.7l.7-1.2-1.5-.8-.6.5c-.8-.3-1.5-1-1.8-1.8l.5-.6-.8-1.5z"/></svg></a>' +
    '<button class="btn outline sm icon" data-act="edit" aria-pressed="' + (S.editing === l.id) + '" aria-label="' + (S.editing === l.id ? 'Fechar edição' : 'Editar') + '" title="' + (S.editing === l.id ? 'Fechar edição' : 'Editar') + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.6 2.9a1.6 1.6 0 0 1 2.5 2.5L5.4 13.1 2 14l.9-3.4z"/><path d="m9.5 4 2.5 2.5"/></svg></button>' +
    '<a class="btn primary sm" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">Abrir</a>' +
    '</div>';
  if (S.editing === l.id) {
    h += '<form class="edit" data-act="editform"><label>Título<input name="titulo" type="text" maxlength="140" placeholder="' + esc(autoTitle(l)) + '" value="' + esc(d ? d.titulo : (l.titulo || '')) + '"></label>' +
      '<label>Pasta<select class="sel" name="pasta">' + folderOpts + '</select></label>' +
      '<label>Nota<textarea name="nota" maxlength="600" placeholder="Por que você guardou este link?">' + esc(d ? d.nota : (l.nota || '')) + '</textarea></label>' +
      '<div class="row"><button type="button" class="btn danger sm" data-act="del" style="margin-right:auto">Excluir link</button><button type="button" class="btn outline sm" data-act="edit">Cancelar</button><button type="submit" class="btn primary sm">Salvar alterações</button></div></form>';
  }
  return h + '</article>';
}
function renderList() {
  const el = $('list');
  el.className = 'list ' + (S.layout === 'list' ? 'compact' : 'grid') + (S.selecting && S.links.length ? ' selecting' : '');
  if (!S.loaded && !S.loadError) { el.innerHTML = '<div class="empty"><b>Carregando seus links</b></div>'; return; }
  if (S.loadError) { el.innerHTML = ''; return; }
  const ls = visibleLinks();
  const base = S.links.filter(inView).length;
  if (S.editing) {
    const f = el.querySelector('.edit');
    if (f) S.draft = { id: S.editing, titulo: f.elements.titulo.value, nota: f.elements.nota.value, pasta: f.elements.pasta.value === '__new__' ? undefined : f.elements.pasta.value };
  }
  if (!ls.length) {
    let t, p;
    if (!S.links.length) { t = 'Nada salvo ainda'; p = 'Cole um link acima. O brica-braca reconhece X, Threads, Instagram, TikTok e YouTube, inclusive Shorts.'; }
    else if (base && (S.q || S.plat !== 'all')) { t = 'Nenhum link bate com o filtro'; p = 'Limpe a busca ou escolha outra rede.'; }
    else if (S.view === 'none') { t = 'Tudo o que você salvou está em alguma pasta'; p = 'Links sem pasta aparecem aqui.'; }
    else { t = 'Esta pasta está vazia'; p = 'Cole um link acima e ele entra em ' + viewTitle() + '.'; }
    el.innerHTML = '<div class="empty"><b>' + esc(t) + '</b><p>' + esc(p) + '</p></div>';
    return;
  }
  const hadEdit = S.editing && document.activeElement && document.activeElement.closest && document.activeElement.closest('.edit');
  const focusName = hadEdit ? document.activeElement.name : null;
  el.innerHTML = ls.map(linkHtml).join('');
  if (focusName) { const n = el.querySelector('.edit [name="' + focusName + '"]'); if (n) n.focus(); }
}

/* ===== Avisos ===== */
let toastTimer = null;
function toast(text, label, fn) {
  const t = $('toast');
  t.innerHTML = '<span>' + esc(text) + '</span>' + (label ? '<button type="button" id="toast-act">' + esc(label) + '</button>' : '');
  t.hidden = false;
  if (label) $('toast-act').onclick = () => { t.hidden = true; fn(); };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 6500);
}
function say(text, kind, actionLabel, actionFn) {
  const m = $('msg'); m.className = 'msg' + (kind ? ' ' + kind : ''); m.textContent = text || '';
  if (actionLabel) { const b = document.createElement('button'); b.type = 'button'; b.textContent = actionLabel; b.onclick = actionFn; m.append(' ', b); }
}

/* ===== Captura ===== */
function describeError(code) {
  if (code === 'espaco') return 'Cole um link por vez, sem espaços no meio. Para vários, cole um por linha.';
  return 'Isso não parece um link. Cole o endereço completo, começando com http ou www.';
}
function updateDetected() {
  const v = $('url').value.trim(), d = $('detected');
  let ok = false;
  if (v) {
    const p = parseLink(v);
    if (!p.error) { ok = true; d.textContent = PLAT[p.plataforma].label + ' · ' + p.tipo; }
  }
  d.hidden = !ok;
  $('save').hidden = !ok; $('paste').hidden = ok;
  if (v) hideClip(); else checkClipboard();
}
/* ===== Link copiado ===== */
const SOCIAL = ['x', 'threads', 'instagram', 'tiktok', 'youtube'];
let clipDismissed = null, clipBusy = false;
function clipCandidate(txt) {
  const m = (txt || '').match(/https?:\/\/[^\s]+/i); if (!m) return null;
  const p = parseLink(m[0]);
  if (p.error || SOCIAL.indexOf(p.plataforma) < 0) return null;
  if (S.links.some(l => l.chave === p.key)) return null;
  return { url: m[0], key: p.key };
}
function hideClip() { S.clip = null; $('clip').hidden = true; $('clip').innerHTML = ''; }
function showClip(c) {
  S.clip = c; const el = $('clip');
  el.innerHTML = '<span>Encontrei um link copiado. Quer colar aqui?</span><span class="acts"><button type="button" class="btn primary sm" data-clip="paste">Colar</button><button type="button" class="btn outline sm" data-clip="no">Agora não</button></span>';
  el.hidden = false;
}
async function checkClipboard() {
  if (clipBusy || !S.loaded || S.modal || $('url').value.trim()) return;
  if (!navigator.clipboard || !navigator.clipboard.readText) return;
  clipBusy = true;
  try {
    const c = clipCandidate(await navigator.clipboard.readText());
    if (c && c.key !== clipDismissed && !$('url').value.trim()) showClip(c); else if (!c) hideClip();
  } catch (e) { /* sem permissão: o botão Colar continua disponível */ }
  clipBusy = false;
}
async function pasteFromClipboard() {
  let txt = '';
  try { txt = await navigator.clipboard.readText(); }
  catch (e) { say('Não consegui ler o que você copiou. Toque no campo e cole com o atalho do teclado.', 'err'); $('url').focus(); return; }
  if (!txt || !txt.trim()) { say('Não há nada copiado.', 'err'); return; }
  if (/https?:\/\/\S+[\s\S]*https?:\/\/\S+/i.test(txt)) { addLinks(txt); return; }
  $('url').value = txt.trim(); say(''); updateDetected(); $('url').focus();
}
$('paste').addEventListener('click', pasteFromClipboard);
$('clip').addEventListener('click', e => {
  const b = e.target.closest('[data-clip]'); if (!b) return;
  if (b.dataset.clip === 'paste' && S.clip) { $('url').value = S.clip.url; hideClip(); say(''); updateDetected(); $('save').focus(); }
  else { clipDismissed = S.clip && S.clip.key; hideClip(); }
});
window.addEventListener('focus', checkClipboard);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkClipboard(); });
function addLinks(raw) {
  const found = raw.match(/https?:\/\/[^\s]+/gi);
  const items = found && found.length ? found : [raw.trim()];
  const dest = S.dest || '';
  let saved = 0, dup = null, bad = null, last = null;
  items.forEach(it => {
    const p = parseLink(it);
    if (p.error) { bad = bad || p.error; return; }
    const exist = S.links.find(l => l.chave === p.key);
    if (exist) { dup = dup || exist; return; }
    const rec = { id: uid(), url: p.url, chave: p.key, plataforma: p.plataforma, tipo: p.tipo, autor: p.autor, titulo: '', nota: '', pastaId: dest || null, criadoEm: Date.now() + saved, enriquecido: false };
    S.links.push(rec); save('links', rec).then(() => enrich(rec)); saved++; last = rec;
  });
  const where = dest ? (folderById(dest) || {}).nome : 'Sem pasta';
  if (saved) {
    S.flash = last.id; setTimeout(() => { S.flash = null; }, 1800);
    if (S.view !== 'all' && S.view !== (dest || 'none')) S.view = dest || 'none';
    S.q = ''; S.plat = 'all';
    $('url').value = ''; updateDetected();
    const extra = (dup ? ' ' + (items.length - saved - (bad ? 1 : 0)) + ' já estava salvo.' : '');
    say((saved === 1 ? 'Salvo em ' + where + '.' : saved + ' links salvos em ' + where + '.') + extra, 'ok');
    render();
    const row = document.querySelector('.link[data-id="' + last.id + '"]'); if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }
  if (dup) {
    const fo = folderById(dup.pastaId);
    say('Esse link já está salvo em ' + (fo ? fo.nome : 'Sem pasta') + '.', 'err', 'Ver', () => { S.view = fo ? fo.id : 'none'; S.q = ''; S.plat = 'all'; S.flash = dup.id; setTimeout(() => { S.flash = null; }, 1800); render(); const r = document.querySelector('.link[data-id="' + dup.id + '"]'); if (r) r.scrollIntoView({ block: 'center' }); });
    return;
  }
  say(describeError(bad), 'err');
}

/* ===== Modal de pasta ===== */
let lastFocus = null;
function openModal(m) { lastFocus = document.activeElement; S.modal = m; renderModal(); }
function closeModal() { S.modal = null; $('modal-root').innerHTML = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
function renderModal() {
  const m = S.modal, root = $('modal-root');
  if (!m) { root.innerHTML = ''; return; }
  let body;
  if (m.kind === 'confirm') {
    const f = folderById(m.id); const n = S.links.filter(l => l.pastaId === m.id).length;
    body = '<h2 id="mt">Excluir a pasta ' + esc(f ? f.nome : '') + '?</h2><p>' + (n ? (n === 1 ? 'O 1 link dela vai' : 'Os ' + n + ' links dela vão') + ' para Sem pasta. Nenhum link é apagado.' : 'A pasta está vazia.') + '</p>' +
      '<div class="row"><button class="btn outline" data-m="cancel">Cancelar</button><button class="btn destructive" data-m="confirm-del">Excluir pasta</button></div>';
  } else {
    const f = m.kind === 'edit' ? folderById(m.id) : null;
        body = '<h2 id="mt">' + (f ? 'Editar pasta' : 'Nova pasta') + '</h2>' +
      '<form id="folder-form" novalidate style="display:flex;flex-direction:column;gap:16px">' +
      '<label class="f">Nome<input type="text" name="nome" maxlength="40" autocomplete="off" value="' + esc(f ? f.nome : (m.nome || '')) + '" placeholder="Por exemplo, Receitas"></label>' +
      '<p class="ferr" id="ferr" role="alert"></p>' +
      '<div class="row">' + (f ? '<button type="button" class="btn danger" data-m="ask-del" style="margin-right:auto">Excluir pasta</button>' : '') +
      '<button type="button" class="btn outline" data-m="cancel">Cancelar</button><button type="submit" class="btn primary">' + (f ? 'Salvar' : 'Criar pasta') + '</button></div></form>';
  }
  root.innerHTML = '<div class="overlay" data-m="overlay"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt">' + body + '</div></div>';
  const first = root.querySelector('input[type=text]') || root.querySelector('button.destructive') || root.querySelector('button');
  if (first) first.focus();
}
function submitFolder(e) {
  e.preventDefault();
  const fm = e.target, nome = fm.nome.value.trim();
  const m = S.modal, editId = m.kind === 'edit' ? m.id : null;
  const err = $('ferr');
  if (!nome) { err.textContent = 'Dê um nome para a pasta.'; fm.nome.focus(); return; }
  if (S.folders.some(f => f.id !== editId && f.nome.toLowerCase() === nome.toLowerCase())) { err.textContent = 'Você já tem uma pasta com esse nome.'; fm.nome.focus(); return; }
  const rec = editId ? Object.assign({}, folderById(editId), { nome }) : newFolder(nome);
  closeModal();
  save('folders', rec);
  const th = m.then;
  if (!editId && th && th.type === 'dest') { S.dest = rec.id; render(); say('Pasta ' + rec.nome + ' criada. O link vai para ela.'); }
  else if (!editId && th && th.type === 'edit-pasta') { if (S.draft && S.draft.id === th.linkId) S.draft.pasta = rec.id; render(); }
  else if (!editId && th && th.type === 'move-many') { bulkMove(rec.id); }
  else if (!editId) { S.view = rec.id; S.dest = rec.id; render(); }
}
async function deleteFolder(id) {
  const f = folderById(id); if (!f) return;
  const affected = S.links.filter(l => l.pastaId === id);
  closeModal();
  S.view = 'none';
  for (const l of affected) { const r = Object.assign({}, l, { pastaId: null }); await save('links', r); }
  await remove('folders', id);
  toast('Pasta ' + f.nome + ' excluída.');
}


/* ===== Seleção em massa ===== */
function pruneSel() { const vis = visibleLinks().map(l => l.id); S.sel = S.sel.filter(id => vis.indexOf(id) >= 0); }
function renderBulk() {
  const b = $('bulk'); const on = S.selecting && S.links.length;
  $('list').classList.toggle('selecting', !!on);
  if (!on) { b.hidden = true; b.innerHTML = ''; return; }
  pruneSel();
  const n = S.sel.length, all = visibleLinks().length;
  const opts = '<option value="__none__" selected disabled>Mover para</option><option value="">Sem pasta</option>' + sortedFolders().map(x => '<option value="' + esc(x.id) + '">' + esc(x.nome) + '</option>').join('') + '<option value="__new__">+ Nova pasta…</option>';
  const had = document.activeElement && document.activeElement.closest && document.activeElement.closest('#bulk');
  b.hidden = false;
  b.innerHTML = '<span class="n">' + (n ? n + (n === 1 ? ' selecionado' : ' selecionados') : 'Selecione os links') + '</span>' +
    '<button type="button" class="btn outline sm" data-act="bulk-all">' + (n && n === all ? 'Limpar' : 'Selecionar todos') + '</button>' +
    '<label><span class="sr">Mover selecionados para a pasta</span><select class="sel" data-act="bulk-move"' + (n ? '' : ' disabled') + '>' + opts + '</select></label>' +
    '<button type="button" class="btn danger sm" data-act="bulk-del"' + (n ? '' : ' disabled') + '>Excluir</button>' +
    '<button type="button" class="btn outline sm" data-act="bulk-cancel">Cancelar</button>';
  if (had) { const x = b.querySelector('[data-act="bulk-all"]'); if (x) x.focus(); }
}
function setSelecting(v) { S.selecting = v; if (!v) S.sel = []; if (v) { S.editing = null; S.draft = null; } render(); }
function toggleSel(id) { const i = S.sel.indexOf(id); if (i < 0) S.sel.push(id); else S.sel.splice(i, 1); renderList(); renderBulk(); }
function bulkMove(dest) {
  const items = S.links.filter(l => S.sel.indexOf(l.id) >= 0 && (l.pastaId || null) !== dest);
  const prev = items.map(l => ({ id: l.id, pastaId: l.pastaId || null }));
  items.forEach(l => save('links', Object.assign({}, l, { pastaId: dest })));
  const fo = folderById(dest), n = items.length;
  setSelecting(false);
  if (!n) { toast('Esses links já estão nessa pasta.'); return; }
  toast((n === 1 ? '1 link movido para ' : n + ' links movidos para ') + (fo ? fo.nome : 'Sem pasta') + '.', 'Desfazer', () => prev.forEach(p => { const cur = S.links.find(x => x.id === p.id); if (cur) save('links', Object.assign({}, cur, { pastaId: p.pastaId })); }));
}
function bulkDelete() {
  const items = S.links.filter(l => S.sel.indexOf(l.id) >= 0).map(l => Object.assign({}, l));
  if (!items.length) return;
  items.forEach(l => remove('links', l.id));
  setSelecting(false);
  toast(items.length === 1 ? 'Link excluído.' : items.length + ' links excluídos.', 'Desfazer', () => items.forEach(l => save('links', l)));
}

/* ===== Eventos ===== */
document.addEventListener('click', e => {
  if (S.selecting) {
    const card = e.target.closest('.link');
    if (card && !e.target.closest('a,select,input,textarea,label,.edit,[data-act]:not([data-act="pick"])')) { toggleSel(card.dataset.id); return; }
  }
  const t = e.target.closest('[data-view],[data-plat],[data-act],[data-m]');
  if (!t) return;
  if (t.dataset.act === 'select-mode') { setSelecting(!S.selecting); return; }
  if (t.dataset.act === 'bulk-cancel') { setSelecting(false); return; }
  if (t.dataset.act === 'bulk-all') { const vis = visibleLinks().map(l => l.id); S.sel = (S.sel.length === vis.length) ? [] : vis; renderList(); renderBulk(); return; }
  if (t.dataset.act === 'bulk-del') { bulkDelete(); return; }
  if (t.dataset.act === 'pick') { toggleSel(t.closest('.link').dataset.id); return; }
  if (t.dataset.m) {
    const k = t.dataset.m;
    if (k === 'overlay') { if (e.target === t) closeModal(); return; }
    if (k === 'cancel') closeModal();
    else if (k === 'ask-del') { const id = S.modal.id; S.modal = { kind: 'confirm', id }; renderModal(); }
    else if (k === 'confirm-del') deleteFolder(S.modal.id);
    return;
  }
  if (t.dataset.view) { S.view = t.dataset.view; S.plat = 'all'; S.editing = null; S.draft = null; if (S.view !== 'all' && S.view !== 'none') S.dest = S.view; render(); return; }
  if (t.dataset.plat) { S.plat = t.dataset.plat; render(); return; }
  const act = t.dataset.act;
  if (act === 'new-folder') { openModal({ kind: 'new' }); return; }
  if (act === 'starter') { const rec = newFolder(t.dataset.name); S.view = rec.id; S.dest = rec.id; save('folders', rec); return; }
  if (act === 'edit-folder') { openModal({ kind: 'edit', id: S.view }); return; }
  const row = t.closest('.link'); const id = row && row.dataset.id; const l = id && S.links.find(x => x.id === id);
  if (!l) return;
  if (act === 'edit') { S.editing = S.editing === id ? null : id; S.draft = null; render(); if (S.editing) { const i = document.querySelector('.edit [name=titulo]'); if (i) i.focus(); } }
  else if (act === 'copy') { (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(l.url) : Promise.reject()).then(() => toast('Link copiado.')).catch(() => toast('Não consegui copiar. Abra o link e copie pelo endereço.')); }
  else if (act === 'del') { const copy = Object.assign({}, l); remove('links', id); if (S.editing === id) S.editing = null; toast('Link excluído.', 'Desfazer', () => save('links', copy)); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'dest') {
    if (t.value === '__new__') { t.value = S.dest || ''; openModal({ kind: 'new', then: { type: 'dest' } }); return; }
    S.dest = t.value; return;
  }
  if (t.matches('.edit select[name="pasta"]')) {
    if (t.value === '__new__') {
      const f = t.form, l = S.links.find(x => x.id === S.editing);
      t.value = (S.draft && S.draft.pasta !== undefined ? S.draft.pasta : (l && l.pastaId)) || '';
      S.draft = { id: S.editing, titulo: f.elements.titulo.value, nota: f.elements.nota.value, pasta: t.value };
      openModal({ kind: 'new', then: { type: 'edit-pasta', linkId: S.editing } });
    }
    return;
  }
  if (t.matches('select[data-act="bulk-move"]')) {
    const v = t.value; t.value = '__none__';
    if (v === '__none__') return;
    if (v === '__new__') { openModal({ kind: 'new', then: { type: 'move-many' } }); return; }
    bulkMove(v || null); return;
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'url') { updateDetected(); if (!e.target.value) say(''); }
  else if (e.target.id === 'q') { S.q = e.target.value; renderHead(); renderList(); }
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.id === 'capture') { e.preventDefault(); const v = $('url').value; if (!v.trim()) { say('Cole um link para salvar.', 'err'); $('url').focus(); return; } addLinks(v); $('url').focus(); }
  else if (f.id === 'folder-form') submitFolder(e);
  else if (f.dataset && f.dataset.act === 'editform') {
    e.preventDefault();
    const l = S.links.find(x => x.id === S.editing); if (!l) return;
    const novaPasta = f.elements.pasta.value || null, antes = l.pastaId || null;
    const rec = Object.assign({}, l, { titulo: f.elements.titulo.value.trim(), nota: f.elements.nota.value.trim(), pastaId: novaPasta });
    S.editing = null; S.draft = null; save('links', rec);
    if (novaPasta !== antes) { const fo = folderById(novaPasta); toast('Movido para ' + (fo ? fo.nome : 'Sem pasta') + '.', 'Desfazer', () => { const cur = S.links.find(x => x.id === l.id); if (cur) save('links', Object.assign({}, cur, { pastaId: antes })); }); }
    else toast('Alterações salvas.');
  }
});
$('url').addEventListener('paste', e => {
  const txt = (e.clipboardData || window.clipboardData || {}).getData ? (e.clipboardData || window.clipboardData).getData('text') : '';
  if (txt && /https?:\/\/\S+[\s\S]*https?:\/\/\S+/i.test(txt)) { e.preventDefault(); addLinks(txt); }
  else setTimeout(updateDetected, 0);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (S.modal) { closeModal(); return; }
    if (S.editing) { S.editing = null; S.draft = null; render(); }
    else if (S.selecting) setSelecting(false);
  }
  if (e.key === 'Tab' && S.modal) {
    const els = Array.from($('modal-root').querySelectorAll('button, input, select, textarea, a[href]')).filter(x => !x.disabled && x.offsetParent !== null);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/* ===== Início ===== */
async function boot() {
  render();
  let session = null;
  if (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase) {
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
    const r = await sb.auth.getSession();
    session = r.data && r.data.session;
    if (!session) { renderLogin(); sb.auth.onAuthStateChange((ev, s) => { if (s) location.reload(); }); return; }
    backend = supabaseBackend(sb);
  } else {
    backend = localBackend();
  }
  S.mode = backend.mode;
  let firstLoad = false;
  const onData = d => {
    S.folders = d.folders; S.links = d.links; S.loaded = true; S.loadError = false;
    if (S.dest && !folderById(S.dest)) S.dest = '';
    render();
    if (!firstLoad) { firstLoad = true; checkClipboard(); enrichPending(); }
  };
  try { await backend.start(onData, () => { S.loadError = true; render(); }); } catch (e) { S.loadError = true; render(); }
}
boot();
