import { useEffect, type RefObject } from 'react';

const MAX = 0.36;            // quanto a faixa pode crescer, em múltiplos do corpo do logo (--fs)
const SKIP = '.overlay, .modal, .menu, .bar, .toast';

/**
 * Puxar a página para baixo, já no topo, abre a faixa da marca e mostra o resto do logo.
 * Ao soltar (ou parar de rolar), ela volta para a posição inicial. Funciona com toque e com roda ou trackpad.
 */
export function usePullReveal(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let startY: number | null = null, acc = 0, idle = 0, snapTimer = 0;

    const max = () => (el.clientWidth / 7.185) * MAX;
    const show = (raw: number) => {
      const m = max();
      const p = m * (1 - Math.exp(-raw / (m * 2.2)));   // resistência: quanto mais puxa, mais duro fica
      el.classList.remove('snap');
      el.style.setProperty('--pull', p.toFixed(1) + 'px');
    };
    const release = () => {
      acc = 0; startY = null;
      window.clearTimeout(idle);
      if (!el.style.getPropertyValue('--pull')) return;
      el.classList.add('snap');
      el.style.setProperty('--pull', '0px');
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(() => { el.classList.remove('snap'); el.style.removeProperty('--pull'); }, 460);
    };
    const blocked = (t: EventTarget | null) => document.body.classList.contains('locked') || !!(t as HTMLElement | null)?.closest?.(SKIP);

    const onTouchStart = (e: TouchEvent) => { startY = window.scrollY <= 0 && !blocked(e.target) ? e.touches[0].clientY : null; };
    const onTouchMove = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0 && window.scrollY <= 0) show(dy); else if (dy <= 0) release();
    };
    const onWheel = (e: WheelEvent) => {
      if (blocked(e.target)) return;
      if (e.deltaY < 0 && window.scrollY <= 0) {
        acc += -e.deltaY;
        show(acc);
        window.clearTimeout(idle);
        idle = window.setTimeout(release, 140);
      } else if (acc > 0) release();
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', release);
    window.addEventListener('touchcancel', release);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', release);
      window.removeEventListener('touchcancel', release);
      window.removeEventListener('wheel', onWheel);
      window.clearTimeout(idle); window.clearTimeout(snapTimer);
    };
  }, [ref]);
}
