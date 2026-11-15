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
const S = { folders: [], links: [], loaded: false, loadError: false, mode: 'local', view: 'all', q: '', plats: [], fp: [], from: '', to: '', filtersOpen: false, editing: null, draft: null, dest: '', flash: null, modal: null, layout: 'cards', sel: [], anchor: null, menu: false, adding: false };
try { if (localStorage.getItem('brica.layout') === 'list') S.layout = 'list'; } catch (e) {}
const touchMq = window.matchMedia ? window.matchMedia('(hover: none)') : { matches: false };
const wideMq = window.matchMedia ? window.matchMedia('(min-width: 901px)') : { matches: true };
const isList = () => S.layout === 'list' && wideMq.matches;
/* Limite do título do cartão: 138 caracteres em notebook e desktop, menos em telas menores */
const midMq = window.matchMedia ? window.matchMedia('(min-width: 641px)') : { matches: true };
const smMq = window.matchMedia ? window.matchMedia('(min-width: 401px)') : { matches: true };
const titleMax = () => wideMq.matches ? 138 : midMq.matches ? 105 : smMq.matches ? 80 : 60;
function clipTitle(t) {
  const max = titleMax(); t = String(t || '');
  if (t.length <= max) return t;
  let cut = t.slice(0, max - 1); const sp = cut.lastIndexOf(' ');
  if (sp > max - 25) cut = cut.slice(0, sp);
  return cut.replace(/[\s.,;:!?-]+$/, '') + '…';
}
[midMq, smMq].forEach(m => { if (m.addEventListener) m.addEventListener('change', () => { if (S.loaded) renderList(); }); });
if (wideMq.addEventListener) wideMq.addEventListener('change', () => { if (S.loaded) { renderTools(); renderList(); } });
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
  document.body.innerHTML = '<div class="brand" role="banner" aria-label="disorder"><b aria-hidden="true">disorder</b></div><main class="login"><p class="lead">Entre com o seu e-mail. Vamos enviar um link para você entrar, sem senha.</p>' +
    '<form id="login-form"><label class="f">E-mail<span class="inw"><input type="email" id="login-email" autocomplete="email" required placeholder="voce@email.com"></span></label>' +
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
async function enrich(l, force) {
  if (!CFG.previewApi || (l.enriquecido && !force) || enriching.has(l.id)) return false;
  enriching.add(l.id);
  try {
    const r = await fetch(CFG.previewApi + '?url=' + encodeURIComponent(l.url), { headers: await authHeaders() });
    const d = r.ok ? await r.json() : null;
    const cur = S.links.find(x => x.id === l.id);
    if (!cur) return false;
    const next = Object.assign({}, cur, { enriquecido: true });
    let got = false;
    if (d && d.title) { next.tituloAuto = d.title; got = true; }
    if (d && d.image) { next.thumb = d.image; got = true; }
    if (r.ok) await save('links', next);
    return got;
  } catch (e) { return false; /* tenta de novo na próxima visita */ }
  finally { enriching.delete(l.id); }
}
let refreshing = false;
async function refreshPreviews(auto) {
  if (!CFG.previewApi || refreshing) return;
  const all = S.links.filter(l => !l.arquivadoEm).slice(0, 300);
  if (!all.length) { if (!auto) toast('Nenhum link para atualizar.'); return; }
  refreshing = true; if (S.view === 'settings') render();
  let i = 0, ok = 0;
  const worker = async () => { while (i < all.length) { if (await enrich(all[i++], true)) ok++; } };
  await Promise.all([worker(), worker(), worker()]);
  refreshing = false;
  render();
  toast(ok + ' de ' + all.length + ' links com título e imagem atualizados.');
}
function enrichPending() {
  let done = false; try { done = localStorage.getItem('disorder.refresh.v1') === '1'; } catch (e) {}
  if (!done && S.links.length) { try { localStorage.setItem('disorder.refresh.v1', '1'); } catch (e) {} refreshPreviews(true); return; }
  const pend = S.links.filter(l => !l.enriquecido).slice(0, 40);
  let i = 0;
  const worker = async () => { while (i < pend.length) await enrich(pend[i++]); };
  worker(); worker(); worker();
}

/* ===== Receber link do compartilhar do sistema ===== */
function takeShare() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.has('url') && !q.has('text') && !q.has('title')) return;
    const m = [q.get('url'), q.get('text'), q.get('title')].filter(Boolean).join(' ').match(/https?:\/\/[^\s]+/i);
    if (m) localStorage.setItem('disorder.share', JSON.stringify({ url: m[0], at: Date.now() }));
    history.replaceState(null, '', location.pathname);
  } catch (e) {}
}
function applyShare() {
  try {
    const raw = localStorage.getItem('disorder.share'); if (!raw) return false;
    localStorage.removeItem('disorder.share');
    const s = JSON.parse(raw);
    if (!s || !s.url || Date.now() - s.at > 30 * 60 * 1000) return false;
    S.view = 'all'; render(); openAdd(s.url); return true;
  } catch (e) { return false; }
}
takeShare();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

/* ===== Ajustes: ações que dependem da conta ===== */
document.addEventListener('click', e => {
  if (e.target.closest('[data-act="refresh-previews"]')) { refreshPreviews(false); return; }
  if (e.target.closest('[data-act="sign-out"]') && sb) { sb.auth.signOut().then(() => location.reload()); }
});

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
const ordOf = f => Number.isFinite(f.ordem) ? f.ordem : 1e9;
const newFolder = nome => { const f = { id: uid(), nome, cor: S.folders.length % 8, criadaEm: Date.now() }; const o = S.folders.filter(x => Number.isFinite(x.ordem)).map(x => x.ordem); if (o.length) f.ordem = Math.max.apply(null, o) + 1; return f; };
const folderById = id => S.folders.find(f => f.id === id) || null;
const sortedFolders = () => S.folders.slice().sort((a, b) => (ordOf(a) - ordOf(b)) || (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
const isArch = l => !!l.arquivadoEm;
const active = () => S.links.filter(l => !isArch(l));
function inView(l) {
  if (S.view === 'settings') return false;
  if (S.view === 'archived') return isArch(l);
  if (isArch(l)) return false;
  if (S.view === 'all') return true;
  if (S.view === 'none') return !l.pastaId || !folderById(l.pastaId);
  return l.pastaId === S.view;
}
function viewTitle() {
  if (S.view === 'all') return 'Todos os links';
  if (S.view === 'none') return 'Sem pasta';
  if (S.view === 'archived') return 'Arquivados';
  if (S.view === 'settings') return 'Ajustes';
  const f = folderById(S.view); return f ? f.nome : 'Todos os links';
}
function dayStart(iso) { const a = String(iso).split('-').map(Number); return new Date(a[0], (a[1] || 1) - 1, a[2] || 1).getTime(); }
function isoDay(ms) { const d = new Date(ms), z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
function filterCount() { return (S.q.trim() ? 1 : 0) + (S.plats.length ? 1 : 0) + (S.view === 'all' && S.fp.length ? 1 : 0) + (S.from || S.to ? 1 : 0); }
function resetFilters() { S.q = ''; S.plats = []; S.fp = []; S.from = ''; S.to = ''; }
function datePreset(days) { const to = isoDay(Date.now()); return { from: isoDay(Date.now() - (days - 1) * 864e5), to }; }
function toggleIn(arr, v) { const i = arr.indexOf(v); if (i < 0) arr.push(v); else arr.splice(i, 1); }
function syncFilterUi() {
  const root = $('tools'); if (!root) return;
  root.querySelectorAll('[data-plat]').forEach(b => b.setAttribute('aria-pressed', String(S.plats.includes(b.dataset.plat))));
  root.querySelectorAll('[data-fpasta]').forEach(b => b.setAttribute('aria-pressed', String(S.fp.includes(b.dataset.fpasta))));
  root.querySelectorAll('[data-fdate]').forEach(b => { const d = datePreset(+b.dataset.fdate); b.setAttribute('aria-pressed', String(S.from === d.from && S.to === d.to)); });
  const n = filterCount(), f = root.querySelector('.btn.filt'), c = f && f.querySelector('.cnt');
  if (f) { if (n && !c) { const x = document.createElement('span'); x.className = 'cnt'; f.appendChild(x); } if (!n && c) c.remove(); const k = f.querySelector('.cnt'); if (k) { k.textContent = n; k.setAttribute('aria-label', n + (n === 1 ? ' filtro ativo' : ' filtros ativos')); } }
  const clr = root.querySelector('[data-act=f-clear]'); if (clr) clr.disabled = !n;
}
function visibleLinks() {
  const q = S.q.trim().toLowerCase();
  const t0 = S.from ? dayStart(S.from) : 0, t1 = S.to ? dayStart(S.to) + 864e5 : 0;
  const byFolder = S.view === 'all' && S.fp.length;
  return S.links.filter(inView).filter(l => !S.plats.length || S.plats.includes(l.plataforma)).filter(l => !byFolder || S.fp.includes(l.pastaId || 'none')).filter(l => (!t0 || (l.criadoEm || 0) >= t0) && (!t1 || (l.criadoEm || 0) < t1)).filter(l => {
    if (!q) return true;
    const f = folderById(l.pastaId);
    return [l.titulo, autoTitle(l), l.nota, l.autor, l.url, f && f.nome].filter(Boolean).join(' ').toLowerCase().includes(q);
  }).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
}

/* ===== Ajustes: perfil, pastas e dados ===== */
const PROFILE = { nome: '', email: '' };
try { PROFILE.nome = localStorage.getItem('disorder.nome') || ''; } catch (e) {}
let THEME = 'light';
try { THEME = localStorage.getItem('disorder.theme') || 'light'; } catch (e) {}
function applyTheme(t) { const r = document.documentElement; if (t === 'light' || t === 'dark') r.dataset.theme = t; else delete r.dataset.theme; }
applyTheme(THEME);
function persistName(n) { try { localStorage.setItem('disorder.nome', n); } catch (e) {} return sb ? sb.auth.updateUser({ data: { nome: n } }).then(r => { if (r.error) throw r.error; }) : Promise.resolve(); }
function accountExtras() { return sb ? '<div class="srow"><div class="st"><b>Sair</b><span>Encerra a sessão neste aparelho. Seus links continuam na conta.</span></div><button type="button" class="btn" data-act="sign-out" data-fk="sign-out">Sair da conta</button></div>' : ''; }
function dataExtras() { return CFG.previewApi ? '<div class="srow"><div class="st"><b>Atualizar previews</b><span>Busca de novo o título e a imagem de todos os links não arquivados.</span></div><button type="button" class="btn" data-act="refresh-previews" data-fk="refresh"' + (refreshing ? ' disabled' : '') + '>' + (refreshing ? 'Atualizando' : 'Atualizar previews') + '</button></div>' : ''; }
function storageNote() { return S.mode === 'cloud' ? 'Seus links ficam salvos na sua conta e aparecem em qualquer aparelho.' : 'Modo local: seus links ficam só neste navegador.'; }
const SW_NAMES = ['Rosa', 'Laranja', 'Amarelo', 'Verde', 'Ciano', 'Azul', 'Lilás', 'Lima'];
const ICO_BACK = '<svg class="gear" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 8h-11M7 3.5 2.5 8 7 12.5"/></svg>';
function backView() { const v = S.prevView || 'all'; return (v === 'all' || v === 'none' || v === 'archived' || folderById(v)) ? v : 'all'; }
function backTitle() { const v = backView(); return v === 'all' ? 'Todos os links' : v === 'none' ? 'Sem pasta' : v === 'archived' ? 'Arquivados' : folderById(v).nome; }
const ICO_SET = '<svg class="gear" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.45 3.24L6.65 1.23L9.35 1.23L9.55 3.24L11.35 4.28L13.19 3.45L14.53 5.78L12.89 6.96L12.89 9.04L14.53 10.22L13.19 12.55L11.35 11.72L9.55 12.76L9.35 14.77L6.65 14.77L6.45 12.76L4.65 11.72L2.81 12.55L1.47 10.22L3.11 9.04L3.11 6.96L1.47 5.78L2.81 3.45L4.65 4.28Z"/><circle cx="8" cy="8" r="1.9"/></svg>';
function settingsHtml() {
  const fs = sortedFolders(), act = active();
  const seg = [['light', 'Claro'], ['dark', 'Escuro'], ['system', 'Sistema']].map(o => '<button type="button" data-act="theme" data-theme-v="' + o[0] + '" data-fk="theme:' + o[0] + '" aria-pressed="' + (THEME === o[0]) + '">' + o[1] + '</button>').join('');
  let h = '<section class="sblock" aria-labelledby="s-perfil"><h2 id="s-perfil">Perfil</h2>' +
    '<label class="f">Nome<span class="inw"><input type="text" id="pf-nome" data-fk="pf-nome" maxlength="60" autocomplete="name" placeholder="Como você quer ser chamado" value="' + esc(PROFILE.nome) + '"></span></label>' +
    (PROFILE.email ? '<div class="f">E-mail<p class="sval">' + esc(PROFILE.email) + '</p></div>' : '') +
    '<div class="f" role="group" aria-labelledby="s-tema"><span id="s-tema">Tema</span><div class="seg txt">' + seg + '</div></div>' + accountExtras() + '</section>';
  h += '<section class="sblock" aria-labelledby="s-pastas"><div class="shead"><h2 id="s-pastas">Pastas</h2><button type="button" class="btn sm" data-act="f-new" data-fk="f-new">Nova pasta</button></div>';
  if (!fs.length) h += '<p class="snote">Nenhuma pasta ainda. Crie a primeira para organizar seus links.</p>';
  else {
    h += '<p class="snote">Use as setas para mudar a ordem. Com mouse, também dá para arrastar. A ordem vale para o menu e para a lista de pastas ao salvar.</p><ul class="flist" id="flist">';
    fs.forEach((f, i) => {
      const n = act.filter(l => l.pastaId === f.id).length, c = colorOf(f), id = esc(f.id), nm = esc(f.nome);
      h += '<li class="frow" draggable="true" data-id="' + id + '">' +
        '<button type="button" class="sw-btn" style="background:var(--tag' + c + '-bg)" data-act="f-color" data-id="' + id + '" data-fk="color:' + id + '" aria-expanded="' + (S.pal === f.id) + '" aria-label="Cor da pasta ' + nm + ', ' + SW_NAMES[c] + '. Trocar cor" title="Trocar cor"></button>' +
        '<span class="inw"><input type="text" class="fname" data-fname="' + id + '" data-fk="name:' + id + '" maxlength="40" autocomplete="off" aria-label="Nome da pasta" value="' + nm + '"></span>' +
        '<span class="fct">' + plural(n, '1 link', 'links') + '</span>' +
        '<span class="fa"><button type="button" class="btn sm icon" data-act="f-up" data-id="' + id + '" data-fk="up:' + id + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Subir ' + nm + '" title="Subir"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg></button>' +
        '<button type="button" class="btn sm icon" data-act="f-down" data-id="' + id + '" data-fk="down:' + id + '"' + (i === fs.length - 1 ? ' disabled' : '') + ' aria-label="Descer ' + nm + '" title="Descer"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3.5 8.5 8 13l4.5-4.5"/></svg></button>' +
        '<button type="button" class="btn sm icon danger" data-act="f-del" data-id="' + id + '" data-fk="del:' + id + '" aria-label="Excluir pasta ' + nm + '" title="Excluir pasta"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/></svg></button></span>' +
        (S.pal === f.id ? '<div class="pal" role="radiogroup" aria-label="Cor da pasta ' + nm + '">' + SW_NAMES.map((name, k) => '<button type="button" class="sw-btn" role="radio" aria-checked="' + (k === c) + '" style="background:var(--tag' + k + '-bg)" data-act="f-setcolor" data-id="' + id + '" data-cor="' + k + '" data-fk="pal:' + id + ':' + k + '" aria-label="' + name + '" title="' + name + '"></button>').join('') + '</div>' : '') +
        '</li>';
    });
    h += '</ul>';
  }
  h += '</section>';
  h += '<section class="sblock" aria-labelledby="s-dados"><h2 id="s-dados">Dados</h2><p class="snote">' + esc(storageNote()) + '</p>' +
    '<div class="srow"><div class="st"><b>Exportar</b><span>Baixa um arquivo com ' + plural(S.links.length, '1 link', 'links') + ' e ' + plural(S.folders.length, '1 pasta', 'pastas') + ', incluindo os arquivados.</span></div><button type="button" class="btn" data-act="export" data-fk="export"' + (S.links.length || S.folders.length ? '' : ' disabled') + '>Exportar arquivo</button></div>' +
    '<div class="srow"><div class="st"><b>Importar</b><span>Lê um arquivo exportado pelo disorder. Soma ao que já existe, sem duplicar links e sem apagar nada.</span></div><button type="button" class="btn" data-act="import" data-fk="import">Importar arquivo</button><input type="file" id="imp-file" accept="application/json,.json" hidden></div>' +
    dataExtras() + '</section>';
  return h;
}
function renderSettings(el) {
  const ae = document.activeElement, fk = ae && ae.dataset ? ae.dataset.fk : null;
  el.className = 'settings'; el.innerHTML = settingsHtml();
  if (fk) {
    let n = el.querySelector('[data-fk="' + fk + '"]');
    if (n && n.disabled) { const row = n.closest('.frow'); n = row && row.querySelector('button:not([disabled])[data-act^="f-"]'); }
    if (n) n.focus();
  }
}
function renameFolder(id, value) {
  const f = folderById(id), nome = String(value || '').trim();
  if (!f || nome === f.nome) { render(); return; }
  if (!nome) { toast('A pasta precisa de um nome.'); render(); return; }
  if (S.folders.some(x => x.id !== id && x.nome.toLowerCase() === nome.toLowerCase())) { toast('Você já tem uma pasta com esse nome.'); render(); return; }
  save('folders', Object.assign({}, f, { nome }));
}
function moveFolder(id, to) {
  const arr = sortedFolders(), i = arr.findIndex(f => f.id === id);
  if (i < 0 || to < 0 || to >= arr.length || to === i) return;
  const f = arr.splice(i, 1)[0]; arr.splice(to, 0, f);
  arr.forEach((x, k) => {
    if (x.ordem === k) return;
    const rec = Object.assign({}, x, { ordem: k }); upsert(S.folders, rec);
    Promise.resolve(backend.set('folders', rec.id, rec)).catch(() => toast('Não consegui salvar a ordem agora. Tente de novo.'));
  });
  render();
}
function exportData() {
  const data = { app: 'disorder', versao: 1, exportadoEm: new Date().toISOString(), folders: sortedFolders(), links: S.links };
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'disorder-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Arquivo exportado.');
  } catch (e) { toast('Não consegui gerar o arquivo neste navegador.'); }
}
async function importData(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Arquivo grande demais. O limite é 5 MB.'); return; }
  let d;
  try { d = JSON.parse(await file.text()); } catch (e) { toast('Não consegui ler esse arquivo. Use um arquivo exportado pelo disorder.'); return; }
  const fs = Array.isArray(d && d.folders) ? d.folders : [], ls = Array.isArray(d && d.links) ? d.links : [];
  if (!fs.length && !ls.length) { toast('Esse arquivo não tem links nem pastas do disorder.'); return; }
  const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  const map = {}, jobs = []; let nf = 0, nl = 0, dup = 0, bad = 0;
  fs.slice(0, 500).forEach(f => {
    const nome = str(f && f.nome, 40).trim(); if (!nome) return;
    const same = S.folders.find(x => x.nome.toLowerCase() === nome.toLowerCase());
    if (same) { map[f.id] = same.id; return; }
    const rec = newFolder(nome); if (Number.isInteger(f.cor)) rec.cor = ((f.cor % 8) + 8) % 8;
    map[f.id] = rec.id; S.folders.push(rec); jobs.push(['folders', rec]); nf++;
  });
  ls.slice(0, 5000).forEach(l => {
    const p = parseLink(str(l && l.url, 2000));
    if (p.error) { bad++; return; }
    if (S.links.some(x => x.chave === p.key)) { dup++; return; }
    const rec = { id: uid(), url: p.url, chave: p.key, plataforma: p.plataforma, tipo: p.tipo, autor: p.autor, titulo: str(l.titulo, 140), nota: str(l.nota, 600), pastaId: (l.pastaId && map[l.pastaId]) || null, criadoEm: Number.isFinite(l.criadoEm) ? l.criadoEm : Date.now(), enriquecido: !!l.enriquecido };
    const ta = str(l.tituloAuto, 300), th = str(l.thumb, 2000);
    if (ta) rec.tituloAuto = ta;
    if (/^https:\/\//i.test(th)) rec.thumb = th;
    if (Number.isFinite(l.arquivadoEm)) rec.arquivadoEm = l.arquivadoEm;
    S.links.push(rec); jobs.push(['links', rec]); nl++;
  });
  render();
  if (!jobs.length) { toast('Nada novo para importar.' + (dup ? ' ' + plural(dup, '1 link já existia', 'links já existiam') + '.' : '')); return; }
  toast('Importando ' + plural(nl, '1 link', 'links') + '.');
  let fail = 0;
  for (const j of jobs) { try { await backend.set(j[0], j[1].id, j[1]); } catch (e) { fail++; } }
  render();
  toast(plural(nl, '1 link importado', 'links importados') + ' e ' + plural(nf, '1 pasta criada', 'pastas criadas') + '.' + (dup ? ' ' + plural(dup, '1 já existia', 'já existiam') + '.' : '') + (bad ? ' ' + plural(bad, '1 endereço inválido ficou de fora', 'endereços inválidos ficaram de fora') + '.' : '') + (fail ? ' ' + plural(fail, '1 item não foi salvo', 'itens não foram salvos') + ', tente importar de novo.' : ''));
}
function settingsAct(act, t) {
  const id = t.dataset.id;
  if (act === 'theme') { THEME = t.dataset.themeV; try { localStorage.setItem('disorder.theme', THEME); } catch (e) {} applyTheme(THEME); render(); return true; }
  if (act === 'f-new') { openModal({ kind: 'new', then: { type: 'stay' } }); return true; }
  if (act === 'f-color') { S.pal = S.pal === id ? null : id; render(); return true; }
  if (act === 'f-setcolor') { const f = folderById(id); S.pal = null; if (f) save('folders', Object.assign({}, f, { cor: Number(t.dataset.cor) })); const b = document.querySelector('[data-fk="color:' + id + '"]'); if (b) b.focus(); return true; }
  if (act === 'f-up' || act === 'f-down') { const i = sortedFolders().findIndex(f => f.id === id); moveFolder(id, i + (act === 'f-up' ? -1 : 1)); return true; }
  if (act === 'f-del') { openModal({ kind: 'confirm', id }); return true; }
  if (act === 'export') { exportData(); return true; }
  if (act === 'import') { const i = $('imp-file'); if (i) { i.value = ''; i.click(); } return true; }
  return false;
}
let dragId = null;
document.addEventListener('dragstart', e => { const r = e.target.closest && e.target.closest('.frow'); if (!r || e.target.closest('input')) return; dragId = r.dataset.id; r.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {} });
document.addEventListener('dragover', e => { if (!dragId) return; const r = e.target.closest && e.target.closest('.frow'); if (!r) return; e.preventDefault(); document.querySelectorAll('.frow.over').forEach(x => x.classList.remove('over')); if (r.dataset.id !== dragId) r.classList.add('over'); });
document.addEventListener('drop', e => { if (!dragId) return; const r = e.target.closest && e.target.closest('.frow'); const id = dragId; dragId = null; if (!r) { render(); return; } e.preventDefault(); const to = sortedFolders().findIndex(f => f.id === r.dataset.id); if (to >= 0 && r.dataset.id !== id) moveFolder(id, to); else render(); });
document.addEventListener('dragend', () => { if (dragId) { dragId = null; render(); } });

/* ===== Renderização ===== */
function render() {
  if (S.view !== 'all' && S.view !== 'none' && S.view !== 'archived' && S.view !== 'settings' && !folderById(S.view)) S.view = 'all';
  renderNav(); renderDest(); renderBanner(); renderHead(); renderTools(); renderList(); renderBar();
}
function renderNav() {
  const act = active(), total = act.length, none = act.filter(l => !l.pastaId || !folderById(l.pastaId)).length, arch = S.links.length - total;
  const cur = v => S.view === v ? ' aria-current="true"' : '';
  let h = '<button class="nav-btn" data-view="all"' + cur('all') + '><span class="nm">Todos os links</span><span class="ct">' + total + '</span></button>';
  h += '<button class="nav-btn" data-view="none"' + cur('none') + '><span class="nm">Sem pasta</span><span class="ct">' + none + '</span></button>';
  h += '<div class="nav-h"><span>Pastas</span></div>';
  sortedFolders().forEach(f => {
    const n = act.filter(l => l.pastaId === f.id).length;
    h += '<button class="nav-btn" data-view="' + esc(f.id) + '"' + cur(f.id) + '><span class="nm">' + esc(f.nome) + '</span><span class="ct">' + n + '</span></button>';
  });
  h += '<button class="add-folder" data-act="new-folder">+ Nova pasta</button>';
  if (arch || S.view === 'archived') h += '<button class="nav-btn arch" data-view="archived"' + cur('archived') + '><span class="nm">Arquivados</span><span class="ct">' + arch + '</span></button>';
  if (S.loaded && !S.folders.length) {
    h += '<div class="starter"><p>Comece por uma destas:</p>' + ['Receitas', 'Decoração', 'Pet'].map(n => '<button class="chip" data-act="starter" data-name="' + n + '">' + n + '</button>').join('') + '</div>';
  }
  h += '<button class="nav-btn set" data-view="settings"' + cur('settings') + '><span class="nm">Ajustes</span></button>';
  $('nav').innerHTML = h;
}
function renderDest() {
  const sel = $('dest');
  const opts = ['<option value="">Sem pasta</option>'].concat(sortedFolders().map(f => '<option value="' + esc(f.id) + '">' + esc(f.nome) + '</option>')).concat(['<option value="__new__">+ Nova pasta…</option>']);
  if (S.dest && !folderById(S.dest)) S.dest = '';
  sel.innerHTML = opts.join(''); sel.value = S.dest || '';
}
function renderBanner() {
  let h = '';
  if (S.loadError) h = '<div class="banner" role="alert">Não consegui carregar seus links agora. Feche e abra o disorder de novo em alguns instantes.</div>';
  $('banner').innerHTML = h;
}
function renderHead() {
  const f = (S.view !== 'all' && S.view !== 'none' && S.view !== 'archived' && S.view !== 'settings') ? folderById(S.view) : null;
  $('head').innerHTML = '<div class="ht"><div class="tl"><h1 id="view-title">' + esc(viewTitle()) + '</h1>' +
    (f ? '<button class="btn icon ghost" data-act="edit-folder" aria-label="Editar pasta ' + esc(f.nome) + '" title="Editar pasta"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.6 2.9a1.6 1.6 0 0 1 2.5 2.5L5.4 13.1 2 14l.9-3.4z"/><path d="m9.5 4 2.5 2.5"/></svg></button>' : '') +
    '</div></div><div class="hr">' +
    (S.view !== 'settings' ? '<button class="btn icon ghost set-btn" data-view="settings" aria-label="Ajustes" title="Ajustes">' + ICO_SET + '</button>'
      : '<button class="btn icon ghost set-btn back-btn" data-view="' + esc(backView()) + '" aria-label="Voltar para ' + esc(backTitle()) + '" title="Voltar">' + ICO_BACK + '</button>') +
    '</div>';
  document.body.classList.toggle('v-arch', S.view === 'archived');
  document.body.classList.toggle('v-set', S.view === 'settings');
}
function setLayout(v) {
  S.layout = v === 'list' ? 'list' : 'cards';
  try { localStorage.setItem('brica.layout', S.layout); } catch (e) {}
  renderTools(); renderList();
}
$('tools').addEventListener('click', e => {
  const b = e.target.closest('[data-layout]'); if (b) { setLayout(b.dataset.layout); return; }
  if (e.target.closest('[data-act=filters]')) { S.filtersOpen = !S.filtersOpen; renderTools(); if (S.filtersOpen && window.matchMedia('(hover: hover)').matches) { const q = $('q'); if (q) q.focus(); } return; }
  const pl = e.target.closest('[data-plat]'), fo = e.target.closest('[data-fpasta]'), dt = e.target.closest('[data-fdate]');
  if (pl) toggleIn(S.plats, pl.dataset.plat);
  else if (fo) toggleIn(S.fp, fo.dataset.fpasta);
  else if (dt) { const d = datePreset(+dt.dataset.fdate); if (S.from === d.from && S.to === d.to) { S.from = ''; S.to = ''; } else { S.from = d.from; S.to = d.to; } const a = $('fd-from'), z = $('fd-to'); if (a) a.value = S.from; if (z) z.value = S.to; }
  else if (e.target.closest('[data-act=f-clear]')) { resetFilters(); renderTools(); renderList(); renderHead(); return; }
  else return;
  syncFilterUi(); renderList();
});
function renderTools() {
  const base = S.links.filter(inView);
  if (!S.links.length || S.view === 'settings') { $('tools').innerHTML = ''; return; }
  const counts = {}; base.forEach(l => { counts[l.plataforma] = (counts[l.plataforma] || 0) + 1; });
  const present = Object.keys(PLAT).filter(k => counts[k]);
  S.plats = S.plats.filter(k => counts[k]);
  const fs = sortedFolders(); S.fp = S.fp.filter(id => id === 'none' || fs.some(f => f.id === id));
  const open = !!S.filtersOpen, n = filterCount();
  const plus = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>';
  let h = (S.view !== 'archived' ? '<button type="button" class="btn primary add-row" data-act="open-add">' + plus + 'Salvar link</button>' : '<span class="tools-sp"></span>') +
    '<button type="button" class="btn filt" data-act="filters" aria-expanded="' + open + '" aria-controls="fpanel"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3.5h12M4.5 8h7M7 12.5h2"/></svg>Filtros' + (n ? '<span class="cnt" aria-label="' + n + (n === 1 ? ' filtro ativo' : ' filtros ativos') + '">' + n + '</span>' : '') + '</button>' +
    '<div class="seg" role="group" aria-label="Visualização">' +
    '<button type="button" data-layout="cards" aria-pressed="' + (S.layout !== 'list') + '" aria-label="Ver em cartões" title="Ver em cartões"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1.2"/><rect x="9" y="2" width="5" height="5" rx="1.2"/><rect x="2" y="9" width="5" height="5" rx="1.2"/><rect x="9" y="9" width="5" height="5" rx="1.2"/></svg></button>' +
    '<button type="button" data-layout="list" aria-pressed="' + (S.layout === 'list') + '" aria-label="Ver em lista" title="Ver em lista"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><path d="M2.5 4h.01M2.5 8h.01M2.5 12h.01"/></svg></button></div>';
  if (open) {
    const chip = (attr, val, label, cnt, on) => '<button type="button" class="chip" ' + attr + '="' + esc(val) + '" aria-pressed="' + on + '">' + esc(label) + (cnt != null ? '<span class="n">' + cnt + '</span>' : '') + '</button>';
    h += '<div class="fpanel" id="fpanel" role="group" aria-label="Filtros">' +
      '<div class="fp-head"><b>Filtros</b><button type="button" class="btn sm" data-act="f-clear"' + (n ? '' : ' disabled') + '>Limpar</button></div>' +
      '<label class="f" for="q">Busca<span class="inw"><input class="search" id="q" type="search" placeholder="Título, autor, nota ou endereço" autocomplete="off" value="' + esc(S.q) + '"></span></label>';
    if (S.view === 'all' && fs.length) {
      const noneN = base.filter(l => !l.pastaId).length;
      h += '<div class="fgrp" role="group" aria-label="Filtrar por pasta"><span class="fl">Pastas</span><div class="chips">' +
        (noneN ? chip('data-fpasta', 'none', 'Sem pasta', noneN, S.fp.includes('none')) : '') +
        fs.map(f => chip('data-fpasta', f.id, f.nome, base.filter(l => l.pastaId === f.id).length, S.fp.includes(f.id))).join('') + '</div></div>';
    }
    if (present.length > 1) {
      h += '<div class="fgrp" role="group" aria-label="Filtrar por origem"><span class="fl">Origem</span><div class="chips">' +
        present.map(k => chip('data-plat', k, PLAT[k].label, counts[k], S.plats.includes(k))).join('') + '</div></div>';
    }
    const pv = d => { const x = datePreset(d); return S.from === x.from && S.to === x.to; };
    h += '<div class="fgrp" role="group" aria-label="Filtrar por data"><span class="fl">Data de salvamento</span><div class="chips">' +
      chip('data-fdate', '7', 'Últimos 7 dias', null, pv(7)) + chip('data-fdate', '30', 'Últimos 30 dias', null, pv(30)) + chip('data-fdate', '90', 'Últimos 90 dias', null, pv(90)) + '</div>' +
      '<div class="fdates"><label class="f" for="fd-from">De<span class="inw"><input type="date" id="fd-from" value="' + esc(S.from) + '"></span></label>' +
      '<label class="f" for="fd-to">Até<span class="inw"><input type="date" id="fd-to" value="' + esc(S.to) + '"></span></label></div></div></div>';
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
function previewHtml(l, cls) {
  const p = PLAT[l.plataforma] || PLAT.web;
  return '<div class="preview' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + p.short + (thumbOf(l) ? '<img src="' + esc(thumbOf(l)) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '</div>';
}
function linkHtml(l) {
  const p = PLAT[l.plataforma] || PLAT.web;
  const f = folderById(l.pastaId);
  const titulo = l.titulo || l.tituloAuto || autoTitle(l);
  let h = '<article class="link' + (S.flash === l.id ? ' flash' : '') + '" data-id="' + esc(l.id) + '" aria-selected="' + (S.sel.indexOf(l.id) >= 0) + '">' +
    '<button type="button" class="pick" data-act="pick" role="checkbox" aria-checked="' + (S.sel.indexOf(l.id) >= 0) + '" aria-label="Selecionar ' + esc(titulo) + '"><span class="box"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg></span></button>' +
    previewHtml(l) +
    '<div class="ltext"><h3 class="ttl"' + (clipTitle(titulo) !== titulo ? ' title="' + esc(titulo) + '"' : '') + '>' + esc(clipTitle(titulo)) + '</h3>' +
    '<p class="meta"><span>' + p.label + ' · ' + esc(l.tipo || 'Link') + '</span><span>' + ago(l.criadoEm || Date.now()) + '</span>' +
    '</p>' +
    '<p class="url" title="' + esc(l.url) + '">' + esc(shortUrl(l.url)) + '</p>' +
    (l.nota ? '<p class="note">' + esc(l.nota) + '</p>' : '') +
    '</div>' +
    '<div class="acts">' +
    (f ? '<span class="tag" data-c="' + colorOf(f) + '" title="' + esc(f.nome) + '">' + esc(f.nome) + '</span>' : '') +
    '<button class="btn outline sm icon" data-act="copy" aria-label="Copiar link" title="Copiar link"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.8"/><path d="M10.5 3.5v-.2a1.8 1.8 0 0 0-1.8-1.8H3.8a1.8 1.8 0 0 0-1.8 1.8v4.9a1.8 1.8 0 0 0 1.8 1.8h.2"/></svg></button>' +
    '<a class="btn outline sm icon" href="https://wa.me/?text=' + encodeURIComponent(titulo + '\n' + l.url) + '" target="_blank" rel="noopener noreferrer" aria-label="Enviar no WhatsApp" title="Enviar no WhatsApp"><svg class="fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg></a>' +
    '<button class="btn outline sm icon" data-act="edit" aria-label="Editar" title="Editar"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.6 2.9a1.6 1.6 0 0 1 2.5 2.5L5.4 13.1 2 14l.9-3.4z"/><path d="m9.5 4 2.5 2.5"/></svg></button>' +
    '<a class="btn outline sm" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">Abrir</a>' +
    '</div>';
  return h + '</article>';
}
function renderList() {
  const el = $('list');
  if (S.view === 'settings' && S.loaded) { renderSettings(el); return; }
  el.className = 'list ' + (isList() ? 'compact' : 'grid') + (S.sel.length ? ' has-sel' : '');
  if (!S.loaded && !S.loadError) { el.innerHTML = '<div class="empty"><b>Carregando seus links</b></div>'; return; }
  if (S.loadError) { el.innerHTML = ''; return; }
  const ls = visibleLinks();
  const base = S.links.filter(inView).length;
  if (!ls.length) {
    let t, p;
    if (!S.links.length) { t = 'Nada salvo ainda'; p = 'Guarde aqui o que você encontra no X, Threads, Instagram, TikTok e YouTube.'; }
    else if (base && filterCount()) { t = 'Nenhum link bate com o filtro'; p = 'Limpe os filtros ou tente outra combinação.'; }
    else if (S.view === 'archived') { t = 'Nada arquivado'; p = 'Links arquivados saem das pastas e ficam guardados aqui. Você pode restaurar quando quiser.'; }
    else if (S.view === 'none') { t = 'Tudo o que você salvou está em alguma pasta'; p = 'Links sem pasta aparecem aqui.'; }
    else { t = 'Esta pasta está vazia'; p = 'O que você salvar aqui entra em ' + viewTitle() + '.'; }
    const cta = (S.view !== 'archived' && !(base && filterCount())) ? '<button class="btn primary" data-act="open-add"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>Salvar link</button><p class="hint">ou cole um link em qualquer lugar desta página</p>' : '';
    el.innerHTML = '<div class="empty"><b>' + esc(t) + '</b><p>' + esc(p) + '</p>' + cta + '</div>';
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

/* ===== Preview no diálogo de salvar ===== */
let PV = null, pvTimer = null;
function fetchPreview(url) { if (!CFG.previewApi) return Promise.resolve(null); return authHeaders().then(h => fetch(CFG.previewApi + '?url=' + encodeURIComponent(url), { headers: h })).then(r => r.ok ? r.json() : null).then(d => d && (d.title || d.image) ? d : null); }
function renderPv() {
  const el = $('pv');
  if (!PV) { el.hidden = true; el.innerHTML = ''; $('add-hint').hidden = false; return; }
  const p = PV.p, pl = PLAT[p.plataforma] || PLAT.web, d = PV.data || {};
  const img = d.image && /^https:\/\//i.test(d.image) ? '<img src="' + esc(d.image) + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()">' : '';
  el.innerHTML = '<div class="preview" aria-hidden="true">' + pl.short + img + '</div><div class="pt"><b class="t">' + esc(d.title || autoTitle(p)) + '</b><span class="m">' + pl.label + ' · ' + p.tipo + '</span>' + (PV.loading ? '<span class="st">Buscando preview</span>' : '') + '</div>';
  el.hidden = false; $('add-hint').hidden = true;
}
function updatePv(p) {
  if (!p) { PV = null; clearTimeout(pvTimer); renderPv(); return; }
  if (PV && PV.key === p.key) return;
  const me = PV = { key: p.key, p, data: null, loading: true };
  renderPv(); clearTimeout(pvTimer);
  pvTimer = setTimeout(() => {
    fetchPreview(p.url).then(d => { if (PV !== me) return; me.data = d; me.loading = false; renderPv(); }).catch(() => { if (PV === me) { me.loading = false; renderPv(); } });
  }, 350);
}

/* ===== Captura ===== */
function describeError(code) {
  if (code === 'espaco') return 'Cole um link por vez, sem espaços no meio. Para vários, cole um por linha.';
  return 'Isso não parece um link. Cole o endereço completo, começando com http ou www.';
}
function updateDetected() {
  const v = $('url').value.trim(), d = $('detected');
  let ok = false, one = null;
  if (v) {
    const many = v.match(/https?:\/\/[^\s]+/gi);
    if (many && many.length > 1) { const n = many.filter(u => !parseLink(u).error).length; if (n) { ok = true; d.textContent = n + ' links'; } }
    else { const p = parseLink(v); if (!p.error) { ok = true; one = p; d.textContent = PLAT[p.plataforma].label + ' · ' + p.tipo; } }
  }
  d.hidden = !ok; updatePv(one);
  $('save').disabled = !ok; $('paste').hidden = ok;
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
  const d = currentDest(), fo = folderById(d);
  el.innerHTML = '<span>Encontrei um link copiado.</span><span class="acts"><button type="button" class="btn outline sm" data-clip="no">Agora não</button><button type="button" class="btn primary sm" data-clip="paste">' + (S.view === 'all' ? 'Salvar' : 'Salvar em ' + esc(fo ? fo.nome : 'Sem pasta')) + '</button></span>';
  el.hidden = false;
}
async function checkClipboard() {
  if (clipBusy || !S.loaded || S.modal || S.adding || S.view === 'archived' || S.view === 'settings') return;
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
  if (b.dataset.clip === 'paste' && S.clip) { const u = S.clip.url; hideClip(); if (S.view === 'all') openAdd(u); else quickSave(u, currentDest()); }
  else { clipDismissed = S.clip && S.clip.key; hideClip(); }
});
window.addEventListener('focus', checkClipboard);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkClipboard(); });
function currentDest() {
  if (S.view === 'all') return S.dest || '';
  if (S.view === 'none' || S.view === 'archived' || S.view === 'settings') return '';
  return folderById(S.view) ? S.view : '';
}
function saveLinks(raw, dest) {
  const found = raw.match(/https?:\/\/[^\s]+/gi);
  const items = found && found.length ? found : [raw.trim()];
  const r = { saved: [], dup: null, bad: null, total: items.length, dest: dest || null };
  items.forEach(it => {
    const p = parseLink(it);
    if (p.error) { r.bad = r.bad || p.error; return; }
    const exist = S.links.find(l => l.chave === p.key);
    if (exist) { r.dup = r.dup || exist; return; }
    if (r.saved.some(x => x.chave === p.key)) return;
    const rec = { id: uid(), url: p.url, chave: p.key, plataforma: p.plataforma, tipo: p.tipo, autor: p.autor, titulo: '', nota: '', pastaId: dest || null, criadoEm: Date.now() + r.saved.length, enriquecido: false };
    if (PV && PV.key === p.key && PV.data) { if (PV.data.title) rec.tituloAuto = PV.data.title; if (PV.data.image) rec.thumb = PV.data.image; rec.enriquecido = true; }
    S.links.push(rec); save('links', rec).then(() => enrich(rec)); r.saved.push(rec);
  });
  return r;
}
function reportSaved(r) {
  const n = r.saved.length, last = r.saved[n - 1], fo = folderById(r.dest);
  S.flash = last.id; setTimeout(() => { S.flash = null; }, 1800);
  if (S.view !== 'all' && S.view !== (r.dest || 'none')) S.view = r.dest || 'none';
  resetFilters(); hideClip();
  render();
  const row = document.querySelector('.link[data-id="' + last.id + '"]'); if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  const skipped = r.total - n - (r.bad ? 1 : 0);
  toast((n === 1 ? 'Salvo em ' : n + ' links salvos em ') + (fo ? fo.nome : 'Sem pasta') + '.' + (skipped > 0 ? ' ' + (skipped === 1 ? '1 já estava salvo.' : skipped + ' já estavam salvos.') : ''), 'Desfazer', () => r.saved.forEach(l => remove('links', l.id)));
}
function goTo(l) {
  const fo = folderById(l.pastaId);
  S.view = isArch(l) ? 'archived' : (fo ? fo.id : 'none'); resetFilters(); S.flash = l.id; setTimeout(() => { S.flash = null; }, 1800);
  render(); const r = document.querySelector('.link[data-id="' + l.id + '"]'); if (r) r.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function restoreLink(l) { const cur = S.links.find(x => x.id === l.id); if (cur) save('links', Object.assign({}, cur, { arquivadoEm: null })); }
function addLinks(raw) {
  const r = saveLinks(raw, S.dest || '');
  if (r.saved.length) { closeAdd(true); reportSaved(r); return; }
  if (r.dup && isArch(r.dup)) { say('Esse link está arquivado.', 'err', 'Restaurar', () => { restoreLink(r.dup); closeAdd(true); toast('Link restaurado.'); goTo(Object.assign({}, r.dup, { arquivadoEm: null })); }); return; }
  if (r.dup) { const fo = folderById(r.dup.pastaId); say('Esse link já está salvo em ' + (fo ? fo.nome : 'Sem pasta') + '.', 'err', 'Ver', () => { closeAdd(true); goTo(r.dup); }); return; }
  say(describeError(r.bad), 'err');
}
function quickSave(raw, dest) {
  const r = saveLinks(raw, dest);
  if (r.saved.length) { reportSaved(r); return; }
  if (r.dup && isArch(r.dup)) { toast('Esse link está arquivado.', 'Restaurar', () => { restoreLink(r.dup); goTo(Object.assign({}, r.dup, { arquivadoEm: null })); }); return; }
  if (r.dup) { const fo = folderById(r.dup.pastaId); toast('Já está salvo em ' + (fo ? fo.nome : 'Sem pasta') + '.', 'Ver', () => goTo(r.dup)); return; }
  toast(describeError(r.bad));
}

/* ===== Diálogo de salvar ===== */
let addFocus = null;
function openAdd(prefill) {
  addFocus = document.activeElement; S.adding = true; hideClip();
  S.dest = currentDest(); renderDest();
  $('url').value = prefill || ''; say(''); updateDetected();
  $('add-root').hidden = false; document.body.classList.add('locked');
  $('url').focus();
  if (!prefill && navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(txt => { const c = clipCandidate(txt); if (c && S.adding && !$('url').value.trim()) { $('url').value = c.url; updateDetected(); $('url').select(); } }).catch(() => {});
}
function closeAdd(silent) {
  if (!S.adding) return;
  S.adding = false; updatePv(null); $('add-root').hidden = true; document.body.classList.remove('locked');
  if (!silent && addFocus && addFocus.focus) addFocus.focus();
}
$('add-root').addEventListener('click', e => {
  if (e.target.dataset.add === 'overlay' || e.target.closest('[data-add="close"]')) closeAdd();
});
document.addEventListener('paste', e => {
  if (S.modal || S.adding || !S.loaded || S.view === 'archived' || S.view === 'settings') return;
  if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
  const txt = (e.clipboardData || window.clipboardData).getData('text') || '';
  if (!/https?:\/\/\S|^\s*www\./i.test(txt)) return;
  e.preventDefault();
  if (S.view === 'all' && !S.dest) { openAdd(txt.trim()); return; }
  quickSave(txt, currentDest());
});

/* ===== Modal de pasta ===== */
let lastFocus = null;
function openModal(m) { lastFocus = document.activeElement; S.modal = m; renderModal(); }
function closeModal() { S.modal = null; $('modal-root').innerHTML = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
function renderModal() {
  const m = S.modal, root = $('modal-root');
  if (!m) { root.innerHTML = ''; return; }
  let body;
  if (m.kind === 'link') {
    const l = S.links.find(x => x.id === m.id); if (!l) { S.modal = null; root.innerHTML = ''; return; }
    const d = S.draft && S.draft.id === l.id ? S.draft : null, p = PLAT[l.plataforma] || PLAT.web;
    const cur = d && d.pasta !== undefined ? d.pasta : (l.pastaId || '');
    const opts = ['<option value="">Sem pasta</option>'].concat(sortedFolders().map(x => '<option value="' + esc(x.id) + '"' + (x.id === cur ? ' selected' : '') + '>' + esc(x.nome) + '</option>')).concat(['<option value="__new__">+ Nova pasta…</option>']).join('');
    const left = isArch(l)
      ? '<button type="button" class="btn danger" data-m="purge-one">Excluir de vez</button><button type="button" class="btn outline" data-m="restore-one">Restaurar</button>'
      : '<button type="button" class="btn ghost" data-m="archive-one">Arquivar</button>';
    body = '<div class="lm-head">' + previewHtml(l, 'sm') + '<div class="lm-t"><h2 id="mt">Editar link</h2><a class="lm-url" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + p.label + ' · ' + esc(shortUrl(l.url)) + '</a></div></div>' +
      '<form id="link-form" class="mform" novalidate>' +
      '<label class="f">Título<span class="inw"><input type="text" name="titulo" maxlength="140" autocomplete="off" placeholder="' + esc(l.tituloAuto || autoTitle(l)) + '" value="' + esc(d ? d.titulo : (l.titulo || '')) + '"></span></label>' +
      (isArch(l) ? '' : '<label class="f">Pasta<span class="inw"><select class="sel" name="pasta">' + opts + '</select></span></label>') +
      '<label class="f">Nota<span class="inw"><textarea name="nota" rows="3" maxlength="600" placeholder="Por que você guardou este link?">' + esc(d ? d.nota : (l.nota || '')) + '</textarea></span></label>' +
      '<div class="row mfoot">' + left + '<span class="sp"></span><button type="button" class="btn outline" data-m="cancel">Cancelar</button><button type="submit" class="btn primary">Salvar</button></div></form>';
  } else if (m.kind === 'purge') {
    const n = m.ids.length;
    body = '<h2 id="mt">' + (n === 1 ? 'Excluir este link de vez?' : 'Excluir ' + n + ' links de vez?') + '</h2><p>Eles somem do disorder e não dá para desfazer. Se quiser só tirar da frente, deixe arquivado.</p>' +
      '<div class="row"><button class="btn outline" data-m="cancel">Cancelar</button><button class="btn destructive" data-m="confirm-purge">Excluir de vez</button></div>';
  } else if (m.kind === 'confirm') {
    const f = folderById(m.id); const n = S.links.filter(l => l.pastaId === m.id).length;
    body = '<h2 id="mt">Excluir a pasta ' + esc(f ? f.nome : '') + '?</h2><p>' + (n ? (n === 1 ? 'O link dela vai' : 'Os ' + n + ' links dela vão') + ' para Arquivados. Nenhum link é apagado, e você pode restaurar depois.' : 'A pasta está vazia.') + '</p>' +
      '<div class="row"><button class="btn outline" data-m="cancel">Cancelar</button><button class="btn destructive" data-m="confirm-del">Excluir pasta</button></div>';
  } else {
    const f = m.kind === 'edit' ? folderById(m.id) : null;
        body = '<h2 id="mt">' + (f ? 'Editar pasta' : 'Nova pasta') + '</h2>' +
      '<form id="folder-form" novalidate style="display:flex;flex-direction:column;gap:16px">' +
      '<label class="f">Nome<span class="inw"><input type="text" name="nome" maxlength="40" autocomplete="off" value="' + esc(f ? f.nome : (m.nome || '')) + '" placeholder="Por exemplo, Receitas"></span></label>' +
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
  if (!editId && th && th.type === 'dest') { S.dest = rec.id; render(); renderDest(); say('Pasta ' + rec.nome + ' criada.', 'ok'); $('url').focus(); }
  else if (!editId && th && th.type === 'edit-pasta') { if (S.draft && S.draft.id === th.linkId) S.draft.pasta = rec.id; render(); openModal({ kind: 'link', id: th.linkId }); }
  else if (!editId && th && th.type === 'move-many') { bulkMove(rec.id); }
  else if (!editId && th && th.type === 'stay') { render(); toast('Pasta ' + rec.nome + ' criada.'); }
  else if (!editId) { S.view = rec.id; S.dest = rec.id; clearSel(); render(); }
}
async function deleteFolder(id) {
  const f = folderById(id); if (!f) return;
  const affected = S.links.filter(l => l.pastaId === id);
  const prev = affected.map(l => ({ id: l.id, pastaId: l.pastaId, arquivadoEm: l.arquivadoEm || null }));
  const folder = Object.assign({}, f), now = Date.now();
  closeModal(); clearSel();
  const stay = S.view === 'settings';
  if (!stay) S.view = affected.some(l => !isArch(l)) ? 'archived' : 'all';
  if (S.dest === id) S.dest = '';
  for (const l of affected) await save('links', Object.assign({}, l, { pastaId: null, arquivadoEm: l.arquivadoEm || now }));
  await remove('folders', id);
  const n = affected.length;
  toast('Pasta ' + f.nome + ' excluída.' + (n ? ' ' + (n === 1 ? 'O link foi para Arquivados.' : 'Os ' + n + ' links foram para Arquivados.') : ''), 'Desfazer', async () => {
    await save('folders', folder); undoPatch(prev); if (!stay) S.view = folder.id; render();
  });
}


/* ===== Seleção ===== */
const ICO = {
  x: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>',
  move: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4.5c0-.8.7-1.5 1.5-1.5h3l1.5 1.5h4.5c.8 0 1.5.7 1.5 1.5v5.5c0 .8-.7 1.5-1.5 1.5h-9c-.8 0-1.5-.7-1.5-1.5z"/><path d="M6.5 8.5h4M9 6.5l2 2-2 2"/></svg>',
  arch: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="12" height="3.5" rx="1"/><path d="M3 6v6.5c0 .6.4 1 1 1h8c.6 0 1-.4 1-1V6M6.5 9h3"/></svg>',
  back: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6.5h7a3.5 3.5 0 0 1 0 7H7"/><path d="M5.5 4 3 6.5 5.5 9"/></svg>',
  trash: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 8.6c0 .5.5.9 1 .9h4.6c.5 0 1-.4 1-.9l.7-8.6"/></svg>',
  down: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6.5 3.5 3.5 3.5-3.5"/></svg>'
};
function pruneSel() { const vis = visibleLinks().map(l => l.id); S.sel = S.sel.filter(id => vis.indexOf(id) >= 0); }
function clearSel() { S.sel = []; S.anchor = null; S.menu = false; }
function selItems() { return S.links.filter(l => S.sel.indexOf(l.id) >= 0); }
function renderBar() {
  const b = $('bar');
  pruneSel();
  const n = S.sel.length;
  document.body.classList.toggle('has-bar', !!n);
  $('list').classList.toggle('has-sel', !!n);
  if (!n) { b.hidden = true; b.innerHTML = ''; S.menu = false; return; }
  const all = visibleLinks().length, arch = S.view === 'archived';
  const focusAct = document.activeElement && document.activeElement.closest && document.activeElement.closest('#bar') ? (document.activeElement.dataset.act || null) : null;
  let h = '<button type="button" class="x" data-act="sel-clear" aria-label="Limpar seleção" title="Limpar seleção (Esc)">' + ICO.x + '</button>' +
    '<span class="n" aria-live="polite">' + n + '<span class="long">' + (n === 1 ? ' selecionado' : ' selecionados') + '</span></span>';
  if (n < all) h += '<button type="button" data-act="sel-all"><span class="long">Selecionar todos (' + all + ')</span><span class="short">Todos</span></button>';
  h += '<span class="sep" aria-hidden="true"></span>';
  if (arch) {
    h += '<button type="button" data-act="bulk-restore">' + ICO.back + 'Restaurar</button>' +
         '<button type="button" class="warn" data-act="bulk-purge">' + ICO.trash + '<span class="long">Excluir de vez</span><span class="short">Excluir</span></button>';
  } else {
    h += '<button type="button" data-act="move-menu" aria-haspopup="menu" aria-expanded="' + S.menu + '">' + ICO.move + 'Mover' + ICO.down + '</button>' +
         '<button type="button" class="strong" data-act="bulk-archive">' + ICO.arch + 'Arquivar</button>';
    if (S.menu) {
      const items = selItems(), same = id => items.every(l => (l.pastaId || null) === id);
      const mi = (id, label) => '<button type="button" class="mi" role="menuitem" data-act="move-to" data-dest="' + esc(id || '') + '"' + (same(id) ? ' aria-disabled="true"' : '') + '>' + label + (same(id) ? '<span class="cur">já está aqui</span>' : '') + '</button>';
      h += '<div class="menu" role="menu" aria-label="Mover para"><div class="mh">Mover para</div>' + mi(null, 'Sem pasta') +
        sortedFolders().map(f => mi(f.id, '<span class="tag" data-c="' + colorOf(f) + '">' + esc(f.nome) + '</span>')).join('') +
        '<button type="button" class="mi" role="menuitem" data-act="move-new">+ Nova pasta…</button></div>';
    }
  }
  b.innerHTML = h; b.hidden = false;
  if (S.menu) { const first = b.querySelector('.mi:not([aria-disabled="true"])'); if (first) first.focus(); }
  else if (focusAct) { const x = b.querySelector('[data-act="' + focusAct + '"]') || b.querySelector('[data-act="sel-clear"]'); if (x) x.focus(); }
}
function syncSel() {
  document.querySelectorAll('#list .link').forEach(el => {
    const on = S.sel.indexOf(el.dataset.id) >= 0;
    el.setAttribute('aria-selected', on);
    const p = el.querySelector('.pick'); if (p) p.setAttribute('aria-checked', on);
  });
  renderBar();
}
function toggleSel(id, range) {
  const vis = visibleLinks().map(l => l.id);
  if (range && S.anchor && vis.indexOf(S.anchor) >= 0) {
    const a = vis.indexOf(S.anchor), b = vis.indexOf(id), on = S.sel.indexOf(S.anchor) >= 0;
    vis.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => { const i = S.sel.indexOf(x); if (on && i < 0) S.sel.push(x); if (!on && i >= 0) S.sel.splice(i, 1); });
  } else {
    const i = S.sel.indexOf(id); if (i < 0) S.sel.push(id); else S.sel.splice(i, 1);
  }
  S.anchor = id; S.menu = false;
  if (S.editing) { S.editing = null; S.draft = null; renderList(); }
  syncSel();
}
function undoPatch(prev) { prev.forEach(p => { const cur = S.links.find(x => x.id === p.id); if (cur) save('links', Object.assign({}, cur, p)); }); }
const plural = (n, one, many) => n === 1 ? one : n + ' ' + many;
function bulkMove(dest) {
  const items = selItems().filter(l => (l.pastaId || null) !== dest);
  const prev = items.map(l => ({ id: l.id, pastaId: l.pastaId || null }));
  items.forEach(l => save('links', Object.assign({}, l, { pastaId: dest })));
  const fo = folderById(dest), n = items.length;
  clearSel(); render();
  if (!n) { toast('Esses links já estão nessa pasta.'); return; }
  toast(plural(n, '1 link movido', 'links movidos') + ' para ' + (fo ? fo.nome : 'Sem pasta') + '.', 'Desfazer', () => undoPatch(prev));
}
function setArchived(items, on) {
  const prev = items.map(l => ({ id: l.id, arquivadoEm: l.arquivadoEm || null }));
  const now = Date.now();
  items.forEach(l => save('links', Object.assign({}, l, { arquivadoEm: on ? now : null })));
  clearSel(); if (S.editing && items.some(l => l.id === S.editing)) { S.editing = null; S.draft = null; } render();
  const n = items.length;
  toast(on ? plural(n, 'Link arquivado.', 'links arquivados.') : plural(n, 'Link restaurado.', 'links restaurados.'), 'Desfazer', () => undoPatch(prev));
}
function purge(ids) {
  closeModal();
  const items = S.links.filter(l => ids.indexOf(l.id) >= 0);
  items.forEach(l => remove('links', l.id));
  clearSel(); S.editing = null; S.draft = null; render();
  toast(plural(items.length, 'Link excluído de vez.', 'links excluídos de vez.'));
}

/* ===== Eventos ===== */
document.addEventListener('click', e => {
  if (S.menu && !e.target.closest('.menu,[data-act="move-menu"]')) { S.menu = false; renderBar(); }
  if (S.sel.length || touchMq.matches) {
    const card = e.target.closest('#list .link');
    if (card && !e.target.closest('a,button,select,input,textarea,label,.edit')) { toggleSel(card.dataset.id, e.shiftKey); return; }
  }
  const t = e.target.closest('[data-view],[data-plat],[data-act],[data-m]');
  if (!t) return;
  const a0 = t.dataset.act;
  if (a0 === 'pick') { e.preventDefault(); toggleSel(t.closest('.link').dataset.id, e.shiftKey); return; }
  if (a0 === 'sel-clear') { clearSel(); syncSel(); return; }
  if (a0 === 'sel-all') { S.sel = visibleLinks().map(l => l.id); syncSel(); return; }
  if (a0 === 'move-menu') { S.menu = !S.menu; renderBar(); if (!S.menu) { const x = $('bar').querySelector('[data-act="move-menu"]'); if (x) x.focus(); } return; }
  if (a0 === 'move-to') { if (t.getAttribute('aria-disabled') === 'true') return; bulkMove(t.dataset.dest || null); return; }
  if (a0 === 'move-new') { S.menu = false; renderBar(); openModal({ kind: 'new', then: { type: 'move-many' } }); return; }
  if (a0 === 'bulk-archive') { setArchived(selItems(), true); return; }
  if (a0 === 'bulk-restore') { setArchived(selItems(), false); return; }
  if (a0 === 'bulk-purge') { openModal({ kind: 'purge', ids: S.sel.slice() }); return; }
  if (t.dataset.m) {
    const k = t.dataset.m;
    if (k === 'overlay') { if (e.target === t) closeModal(); return; }
    if (k === 'cancel') { const th = S.modal && S.modal.then; if (th && th.type === 'edit-pasta') { openModal({ kind: 'link', id: th.linkId }); return; } S.draft = null; closeModal(); }
    else if (k === 'archive-one' || k === 'restore-one' || k === 'purge-one') {
      const l = S.links.find(x => x.id === S.modal.id); if (!l) return;
      S.draft = null;
      if (k === 'purge-one') { S.modal = { kind: 'purge', ids: [l.id] }; renderModal(); return; }
      closeModal(); setArchived([l], k === 'archive-one');
    }
    else if (k === 'ask-del') { const id = S.modal.id; S.modal = { kind: 'confirm', id }; renderModal(); }
    else if (k === 'confirm-del') deleteFolder(S.modal.id);
    else if (k === 'confirm-purge') purge(S.modal.ids);
    return;
  }
  if (t.dataset.view) { if (t.dataset.view === 'settings' && S.view !== 'settings') S.prevView = S.view; S.view = t.dataset.view; S.pal = null; resetFilters(); S.editing = null; S.draft = null; clearSel(); hideClip(); if (S.view !== 'all' && S.view !== 'none' && S.view !== 'archived' && S.view !== 'settings') S.dest = S.view; render(); checkClipboard(); return; }
  const act = t.dataset.act;
  if (settingsAct(act, t)) return;
  if (act === 'new-folder') { openModal({ kind: 'new' }); return; }
  if (act === 'open-add') { openAdd(); return; }
  if (act === 'starter') { const rec = newFolder(t.dataset.name); S.view = rec.id; S.dest = rec.id; save('folders', rec); return; }
  if (act === 'edit-folder') { openModal({ kind: 'edit', id: S.view }); return; }
  const row = t.closest('.link'); const id = row && row.dataset.id; const l = id && S.links.find(x => x.id === id);
  if (!l) return;
  if (act === 'edit') { S.draft = null; openModal({ kind: 'link', id }); }
  else if (act === 'copy') { (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(l.url) : Promise.reject()).then(() => toast('Link copiado.')).catch(() => toast('Não consegui copiar. Abra o link e copie pelo endereço.')); }
  else if (act === 'archive') setArchived([l], true);
  else if (act === 'restore') setArchived([l], false);
  else if (act === 'purge') openModal({ kind: 'purge', ids: [id] });
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.fname) { renameFolder(t.dataset.fname, t.value); return; }
  if (t.id === 'pf-nome') { const n = t.value.trim(); PROFILE.nome = n; persistName(n).then(() => toast('Nome salvo.')).catch(() => toast('Não consegui salvar o nome agora. Tente de novo.')); return; }
  if (t.id === 'imp-file') { importData(t.files && t.files[0]); return; }
  if (t.id === 'dest') {
    if (t.value === '__new__') { t.value = S.dest || ''; openModal({ kind: 'new', then: { type: 'dest' } }); return; }
    S.dest = t.value; return;
  }
  if (t.matches('#link-form select[name="pasta"]')) {
    if (t.value === '__new__') {
      const f = t.form, lid = S.modal.id, l = S.links.find(x => x.id === lid);
      t.value = (S.draft && S.draft.id === lid && S.draft.pasta !== undefined ? S.draft.pasta : (l && l.pastaId)) || '';
      S.draft = { id: lid, titulo: f.elements.titulo.value, nota: f.elements.nota.value, pasta: t.value };
      openModal({ kind: 'new', then: { type: 'edit-pasta', linkId: lid } });
    }
    return;
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'url') { updateDetected(); if (!e.target.value) say(''); }
  else if (e.target.id === 'q') { S.q = e.target.value; syncFilterUi(); renderHead(); renderList(); }
  else if (e.target.id === 'fd-from' || e.target.id === 'fd-to') { if (e.target.id === 'fd-from') S.from = e.target.value; else S.to = e.target.value; syncFilterUi(); renderList(); }
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.id === 'capture') { e.preventDefault(); const v = $('url').value; if (!v.trim()) { say('Cole um link para salvar.', 'err'); $('url').focus(); return; } addLinks(v); }
  else if (f.id === 'folder-form') submitFolder(e);
  else if (f.id === 'link-form') {
    e.preventDefault();
    const l = S.links.find(x => x.id === S.modal.id); if (!l) return;
    const novaPasta = f.elements.pasta ? (f.elements.pasta.value || null) : (l.pastaId || null), antes = l.pastaId || null;
    const rec = Object.assign({}, l, { titulo: f.elements.titulo.value.trim(), nota: f.elements.nota.value.trim(), pastaId: novaPasta });
    S.draft = null; closeModal(); save('links', rec);
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
    if (S.modal) { const th = S.modal.then; if (th && th.type === 'edit-pasta') { openModal({ kind: 'link', id: th.linkId }); return; } S.draft = null; closeModal(); return; }
    if (S.adding) { closeAdd(); return; }
    if (S.menu) { S.menu = false; renderBar(); const x = $('bar').querySelector('[data-act="move-menu"]'); if (x) x.focus(); return; }
    if (S.editing) { S.editing = null; S.draft = null; render(); }
    else if (S.sel.length) { clearSel(); syncSel(); }
  }
  if (S.menu && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    const its = Array.from($('bar').querySelectorAll('.mi:not([aria-disabled="true"])')); if (!its.length) return;
    e.preventDefault(); const i = its.indexOf(document.activeElement);
    its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length].focus();
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && S.sel.length && !e.target.closest('input,textarea,select')) { e.preventDefault(); S.sel = visibleLinks().map(l => l.id); syncSel(); }
  if (e.key === 'Tab' && (S.modal || S.adding)) {
    const els = Array.from((S.modal ? $('modal-root') : $('add-root')).querySelectorAll('button, input, select, textarea, a[href]')).filter(x => !x.disabled && x.offsetParent !== null);
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
    PROFILE.email = (session.user && session.user.email) || '';
    const mdNome = session.user && session.user.user_metadata && session.user.user_metadata.nome;
    if (typeof mdNome === 'string') PROFILE.nome = mdNome;
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
    if (!firstLoad) { firstLoad = true; if (!applyShare()) checkClipboard(); enrichPending(); }
  };
  try { await backend.start(onData, () => { S.loadError = true; render(); }); } catch (e) { S.loadError = true; render(); }
}
boot();
