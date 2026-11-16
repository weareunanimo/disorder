import { useEffect } from 'react';
import { get, set } from '../store';
import { capture, cancelModal, checkClipboard, clearSel, selectAll, setCardMenu, setSwipe } from '../actions';

const FIELD = 'input,textarea,select,[contenteditable]';

/** Atalhos e eventos da página inteira: colar um link, Esc, Ctrl+A e a checagem do link copiado. */
export function useGlobalEvents() {
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const s = get();
      if (s.modal || !s.loaded) return;
      if ((e.target as HTMLElement).closest?.(FIELD)) return;
      const txt = e.clipboardData?.getData('text') || '';
      if (!/https?:\/\/\S|^\s*www\./i.test(txt)) return;
      e.preventDefault();
      capture(txt);
    };
    const onKey = (e: KeyboardEvent) => {
      const s = get();
      if (e.key === 'Escape') {
        if (s.modal) cancelModal();
        else if (s.profileOpen) set({ profileOpen: false });
        else if (s.menu) { set({ menu: false }); document.querySelector<HTMLElement>('#bar [data-move]')?.focus(); }
        else if (s.cardMenu) setCardMenu(null);
        else if (s.swipeId) setSwipe(null);
        else if (s.sel.length) clearSel();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && s.sel.length && !(e.target as HTMLElement).closest?.('input,textarea,select')) {
        e.preventDefault(); selectAll();
      }
    };
    const onFocus = () => void checkClipboard();
    const onVisible = () => { if (!document.hidden) void checkClipboard(); };
    document.addEventListener('paste', onPaste);
    document.addEventListener('keydown', onKey);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}
