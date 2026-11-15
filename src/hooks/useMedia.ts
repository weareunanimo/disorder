import { useSyncExternalStore } from 'react';

const cache = new Map<string, MediaQueryList>();
const mq = (q: string) => {
  let m = cache.get(q);
  if (!m) { m = window.matchMedia(q); cache.set(q, m); }
  return m;
};

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    cb => { const m = mq(query); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => mq(query).matches,
  );
}

export const useWide = () => useMedia('(min-width: 901px)');
export const isTouch = () => mq('(hover: none)').matches;
export const canHover = () => mq('(hover: hover)').matches;

/** Limite do título do cartão: 138 caracteres em notebook e desktop, menos em telas menores. */
export function useTitleMax(): number {
  const wide = useWide(), mid = useMedia('(min-width: 641px)'), sm = useMedia('(min-width: 401px)');
  return wide ? 138 : mid ? 105 : sm ? 80 : 60;
}
