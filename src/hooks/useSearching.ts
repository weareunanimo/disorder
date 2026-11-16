import { useStore } from '../store';
import { looksLikeLink } from '../actions';
import { isHome } from '../lib/filters';

/** Tem busca de texto rolando em Tudo ou Tags. Nas duas abas o resultado é o mesmo: tags e links que batem. */
export function useSearching() {
  return useStore(s => isHome(s.view) && !!s.q.trim() && !looksLikeLink(s.q));
}
