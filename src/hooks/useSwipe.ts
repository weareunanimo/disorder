import { useRef, type PointerEvent } from 'react';
import { setSwipe } from '../actions';
import { get } from '../store';

/** Largura da gaveta de ações: dois botões de 72px. Precisa ser igual a --tray-w no CSS. */
export const TRAY_W = 144;

/**
 * Arrastar o cartão para a esquerda abre a gaveta com Arquivar e Excluir.
 * Funciona com dedo, caneta e mouse. O movimento vertical continua rolando a página (touch-action: pan-y).
 * Passou da metade, fica aberta. Menos que isso, volta.
 */
export function useSwipe(id: string, open: boolean, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef({ x: 0, y: 0, from: 0, lock: 0 as 0 | 1 | -1, dragged: false, t: 0, pid: -1 });

  const apply = (px: number, animate: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.classList.toggle('dragging', !animate);
    el.style.setProperty('--sx', px + 'px');
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    st.current.dragged = false; // em toque, o navegador não manda clique depois de arrastar: sem isso o próximo toque seria engolido
    if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if ((e.target as HTMLElement).closest('a,button,input,textarea,select,.tray')) return;
    st.current = { x: e.clientX, y: e.clientY, from: open ? -TRAY_W : 0, lock: 0, dragged: false, t: Date.now(), pid: e.pointerId };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = st.current;
    if (s.pid !== e.pointerId) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (s.lock === 0) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.5) {
        s.lock = 1;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
        window.getSelection()?.removeAllRanges();
        if (get().swipeId !== id) setSwipe(null);
      } else { s.lock = -1; return; }
    }
    if (s.lock !== 1) return;
    s.dragged = true;
    apply(Math.max(-TRAY_W, Math.min(0, s.from + dx)), false);
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    const s = st.current;
    if (s.pid !== e.pointerId) return;
    s.pid = -1;
    if (s.lock !== 1) return;
    setTimeout(() => { st.current.dragged = false; }, 350);
    const dx = e.clientX - s.x, v = dx / Math.max(1, Date.now() - s.t);
    const pos = Math.max(-TRAY_W, Math.min(0, s.from + dx));
    const keep = pos < -TRAY_W / 2 || v < -0.6;
    apply(keep ? -TRAY_W : 0, true);
    setSwipe(keep ? id : null);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* já solto */ }
  };
  /** O clique que vem logo depois de arrastar não pode selecionar nem abrir o cartão. */
  const onClickCapture = (e: { stopPropagation(): void; preventDefault(): void }) => {
    if (st.current.dragged) { st.current.dragged = false; e.stopPropagation(); e.preventDefault(); }
  };

  return { ref, bind: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onClickCapture }, apply };
}
