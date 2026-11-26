import { backend, get, set, setBackend } from './store';
import { toast, applyTheme, busy, checkClipboard, enrichPending, fixView, capture, holdInstall, markSetup, mergeFresh } from './actions';
import { linkIn } from './lib/setup';
import { localBackend, type Snapshot } from './data/backend';
import { normLink } from './lib/tags';
import { connect, getClient, onSignedIn, supabaseBackend, takeRecovery, whenRecovery } from './data/supabase';

const SHARE = 'disorder.share';

/**
 * Link recebido de fora: o "compartilhar" do Android (?url=&text=&title=) ou o atalho do iPhone (#salvar=link).
 * Guarda e limpa o endereço, porque pode ser preciso entrar antes. Receber um link conta como passo feito.
 */
function takeShare() {
  try {
    const q = new URLSearchParams(location.search);
    // Atalho do iPhone: "salvar=" seguido do link, no fragmento (#salvar=) ou na busca (?salvar=), codificado ou não.
    const raw = safeDecode(location.hash + ' ' + location.search);
    // O que vem depois de "salvar=" pode ser só o link ou um texto com o link no meio (com espaços).
    const hit = /salvar(=|%3D)/i.test(raw);
    const salvar = hit ? raw.slice(raw.search(/salvar(=|%3D)/i)).replace(/^salvar(=|%3D)/i, '') : '';
    if (!hit && !q.has('url') && !q.has('text') && !q.has('title')) return;
    const url = linkIn(safeDecode(safeDecode(salvar)), q.get('url'), q.get('text'), q.get('title'));
    if (url) { localStorage.setItem(SHARE, JSON.stringify({ url, at: Date.now() })); markSetup('share'); }
    // O atalho abriu o app, mas sem link dentro: avisa, em vez de não acontecer nada.
    else localStorage.setItem(SHARE + '.miss', String(Date.now()));
    history.replaceState(null, '', location.pathname);
  } catch { /* sem armazenamento */ }
}
const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
function applyShare(): boolean {
  try {
    const raw = localStorage.getItem(SHARE);
    if (!raw) return false;
    localStorage.removeItem(SHARE);
    const s = JSON.parse(raw) as { url?: string; at?: number } | null;
    if (!s?.url || Date.now() - (s.at || 0) > 30 * 60 * 1000) return false;
    set({ view: 'all' });
    capture(s.url);
    return true;
  } catch { return false; }
}

export async function boot() {
  applyTheme(get().theme);
  takeShare();
  // Atalho do iPhone com o disorder já aberto: só o fragmento muda, a página não recarrega.
  window.addEventListener('hashchange', () => { takeShare(); if (get().loaded && !applyShare()) missNotice(); });
  window.addEventListener('beforeinstallprompt', holdInstall);
  window.addEventListener('appinstalled', () => markSetup('app'));
  if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => { /* instalação é opcional */ });

  let first = true;
  const onData = (d: Snapshot) => {
    // Leitura do servidor que chega atrasada não apaga o que acabou de ser gravado aqui (ex.: link vindo do atalho).
    const folders = mergeFresh('folders', d.folders), links = mergeFresh('links', d.links);
    set({ folders: folders.filter(f => !f.arquivadaEm), foldersArq: folders.filter(f => f.arquivadaEm), links: links.map(normLink), loaded: true, loadError: false });
    fixView();
    if (first) { first = false; if (!applyShare()) { missNotice(); void checkClipboard(); } enrichPending(); }
  };
  const onError = () => set({ loadError: true });
  /** Depois de carregar: avisa se o atalho chegou sem link. */
  const missNotice = () => {
    try {
      const at = Number(localStorage.getItem(SHARE + '.miss') || 0);
      localStorage.removeItem(SHARE + '.miss');
      if (at && Date.now() - at < 30 * 60 * 1000) toast('O atalho abriu o disorder, mas não mandou nenhum link. Confira a ação Abrir URLs do atalho.');
    } catch { /* sem armazenamento */ }
  };

  try {
    const session = await connect();
    if (session === 'off') setBackend(localBackend());
    else if (!session) { set({ phase: 'login' }); onSignedIn(() => location.reload()); return; }
    else {
      const nome = session.user?.user_metadata?.nome;
      set({ profile: { email: session.user?.email || '', nome: typeof nome === 'string' ? nome : get().profile.nome } });
      setBackend(supabaseBackend(getClient()!, busy));
    }
    const b = backend();
    set({ mode: b.mode, phase: 'ready' });
    await b.start(onData, onError);
    // Chegou pelo link de esqueci a senha: pede a senha nova logo de cara.
    if (takeRecovery()) set({ modal: { kind: 'password', recovery: true } });
    whenRecovery(() => set({ modal: { kind: 'password', recovery: true } }));
  } catch { onError(); }
}
