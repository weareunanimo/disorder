import { backend, get, set, setBackend } from './store';
import { applyTheme, busy, checkClipboard, enrichPending, fixView, capture, holdInstall, markSetup } from './actions';
import { SHARE_HASH, linkIn } from './lib/setup';
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
    const h = location.hash.startsWith(SHARE_HASH) ? safeDecode(location.hash.slice(SHARE_HASH.length)) : '';
    if (!h && !q.has('url') && !q.has('text') && !q.has('title')) return;
    const url = linkIn(h, q.get('url'), q.get('text'), q.get('title'));
    if (url) { localStorage.setItem(SHARE, JSON.stringify({ url, at: Date.now() })); markSetup('share'); }
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
  window.addEventListener('hashchange', () => { takeShare(); if (get().loaded) applyShare(); });
  window.addEventListener('beforeinstallprompt', holdInstall);
  window.addEventListener('appinstalled', () => markSetup('app'));
  if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => { /* instalação é opcional */ });

  let first = true;
  const onData = (d: Snapshot) => {
    set({ folders: d.folders.filter(f => !f.arquivadaEm), foldersArq: d.folders.filter(f => f.arquivadaEm), links: d.links.map(normLink), loaded: true, loadError: false });
    fixView();
    if (first) { first = false; if (!applyShare()) void checkClipboard(); enrichPending(); }
  };
  const onError = () => set({ loadError: true });

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
