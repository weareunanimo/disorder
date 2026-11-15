import { useEffect } from 'react';
import { get, set } from '../store';
import { cancelModal, checkClipboard, clearSel, closeAdd, currentDest, openAdd, quickSave, selectAll, setSwipe } from '../actions';

const FIELD = 'input,textarea,select,[contenteditable]';

/** Atalhos e eventos da página inteira: colar um link, Esc, Ctrl+A e a checagem do link copiado. */
export function useGlobalEvents() {
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const s = get();
      if (s.modal || s.adding || !s.loaded || s.view === 'archived' || s.view === 'settings') return;
      if ((e.target as HTMLElement).closest?.(FIELD)) return;
      const txt = e.clipboardData?.getData('text') || '';
      if (!/https?:\/\/\S|^\s*www\./i.test(txt)) return;
      e.preventDefault();
      if (s.view === 'all' && !s.dest) openAdd(txt.trim()); else quickSave(txt, currentDest());
    };
    const onKey = (e: KeyboardEvent) => {
      const s = get();
      if (e.key === 'Escape') {
        if (s.modal) cancelModal();
        else if (s.adding) closeAdd();
        else if (s.menu) { set({ menu: false }); document.querySelector<HTMLElement>('#bar [data-move]')?.focus(); }
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
