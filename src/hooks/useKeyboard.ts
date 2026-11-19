import { useEffect, type RefObject } from 'react';

/**
 * Teclado do celular: escreve em --kb a altura que ele tampa e em --vvh a altura visível de verdade.
 * Folhas e janelas usam isso para ficar acima do teclado (100dvh não desconta o teclado no iPhone).
 */
export function useKeyboardInset(ref: RefObject<HTMLElement | null>, on = true) {
  useEffect(() => {
    const vv = window.visualViewport, el = ref.current;
    if (!on || !vv || !el) return;
    const fit = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.setProperty('--kb', kb + 'px');
      el.style.setProperty('--vvh', vv.height + 'px');
    };
    fit();
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); };
  }, [ref, on]);
}
