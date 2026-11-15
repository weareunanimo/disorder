import { backend, get, set, setBackend } from './store';
import { applyTheme, busy, checkClipboard, enrichPending, fixView, openAdd } from './actions';
import { localBackend, type Snapshot } from './data/backend';
import { connect, getClient, onSignedIn, supabaseBackend } from './data/supabase';

const SHARE = 'disorder.share';

/** Link recebido pelo "compartilhar" do sistema: guarda e limpa o endereço (pode ser preciso entrar antes). */
function takeShare() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.has('url') && !q.has('text') && !q.has('title')) return;
    const m = [q.get('url'), q.get('text'), q.get('title')].filter(Boolean).join(' ').match(/https?:\/\/[^\s]+/i);
    if (m) localStorage.setItem(SHARE, JSON.stringify({ url: m[0], at: Date.now() }));
    history.replaceState(null, '', location.pathname);
  } catch { /* sem armazenamento */ }
}
function applyShare(): boolean {
  try {
    const raw = localStorage.getItem(SHARE);
    if (!raw) return false;
    localStorage.removeItem(SHARE);
    const s = JSON.parse(raw) as { url?: string; at?: number } | null;
    if (!s?.url || Date.now() - (s.at || 0) > 30 * 60 * 1000) return false;
    set({ view: 'all' });
    openAdd(s.url);
    return true;
  } catch { return false; }
}

export async function boot() {
  applyTheme(get().theme);
  takeShare();
  if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => { /* instalação é opcional */ });

  let first = true;
  const onData = (d: Snapshot) => {
    set({ folders: d.folders, links: d.links, loaded: true, loadError: false });
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
  } catch { onError(); }
}
