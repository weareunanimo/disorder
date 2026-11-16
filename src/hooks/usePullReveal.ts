import { useEffect, type RefObject } from 'react';

const MAX = 0.36;            // quanto a faixa pode crescer, em múltiplos do corpo do logo (--fs)
const SKIP = '.overlay, .modal, .menu, .bar, .toast, .cmenu, .prof, .omni-pop';
/** "No topo" com folga: no iPhone o scroll às vezes para em 0,5px ou 1px, e aí o puxar não começava. */
const atTop = () => window.scrollY <= 2;

/**
 * Puxar a página para baixo, já no topo, abre a faixa da marca e mostra o resto do logo.
 * Ao soltar (ou parar de rolar), ela volta para a posição inicial. Funciona com toque e com roda ou trackpad.
 */
export function usePullReveal(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let startY: number | null = null, acc = 0, idle = 0;

    const max = () => (el.clientWidth / 7.185) * MAX;
    let cur = 0, raf = 0;
    const setPull = (v: number) => { cur = v; el.style.setProperty('--pull', v.toFixed(1) + 'px'); };
    const show = (raw: number) => {
      const m = max();
      cancelAnimationFrame(raf);
      setPull(m * (1 - Math.exp(-raw / (m * 2.2))));   // resistência: quanto mais puxa, mais duro fica
    };
    // Volta animada quadro a quadro, em vez de transição CSS: no iPhone (Safari e Chrome, ambos WebKit)
    // a transição de uma variável dentro de calc() às vezes não roda e a faixa voltava seca.
    const release = () => {
      acc = 0; startY = null;
      window.clearTimeout(idle);
      if (!cur) return;
      cancelAnimationFrame(raf);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { cur = 0; el.style.removeProperty('--pull'); return; }
      const from = cur, t0 = performance.now(), dur = 420;
      // Sai rápido e assenta com um leve passar do ponto, como a curva .2, .9, .25, 1.15 que já usávamos.
      const ease = (t: number) => { const c = 1.15, k = t - 1; return 1 + (c + 1) * k * k * k + c * k * k; };
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        setPull(from * (1 - ease(t)));   // passa um pouco do zero e volta, igual à curva antiga
        if (t < 1) raf = requestAnimationFrame(step); else { cur = 0; el.style.removeProperty('--pull'); }
      };
      raf = requestAnimationFrame(step);
    };
    const blocked = (t: EventTarget | null) => document.body.classList.contains('locked') || !!(t as HTMLElement | null)?.closest?.(SKIP);

    const onTouchStart = (e: TouchEvent) => { startY = atTop() && !blocked(e.target) ? e.touches[0].clientY : null; };
    const onTouchMove = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0 && atTop()) show(dy); else if (dy <= 0) release();
    };
    const onWheel = (e: WheelEvent) => {
      if (blocked(e.target)) return;
      if (e.deltaY < 0 && atTop()) {
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
      window.clearTimeout(idle); cancelAnimationFrame(raf);
    };
  }, [ref]);
}
