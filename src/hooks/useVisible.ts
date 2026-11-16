import { useDeferredValue, useMemo } from 'react';
import { useStore } from '../store';
import { inView, isArch, matchingTags, visibleLinks } from '../lib/filters';
import { sortFolders } from '../lib/folders';
import { tagsOf } from '../lib/tags';

/** Links da tela atual, já filtrados. A busca usa valor adiado para a digitação não travar com muitos links. */
export function useVisible() {
  const links = useStore(s => s.links), folders = useStore(s => s.folders), view = useStore(s => s.view);
  const q = useDeferredValue(useStore(s => s.q));
  const plats = useStore(s => s.plats), kinds = useStore(s => s.kinds), fp = useStore(s => s.fp), from = useStore(s => s.from), to = useStore(s => s.to);
  const sort = useStore(s => s.sort);
  return useMemo(() => visibleLinks(links, folders, view, { q, plats, kinds, fp, from, to }, sort), [links, folders, view, q, plats, kinds, fp, from, to, sort]);
}

export function useSortedFolders() {
  const folders = useStore(s => s.folders);
  return useMemo(() => sortFolders(folders), [folders]);
}

/** Links da tela atual antes dos filtros. */
export function useBase() {
  const links = useStore(s => s.links), folders = useStore(s => s.folders), view = useStore(s => s.view);
  return useMemo(() => links.filter(l => inView(l, view, folders)), [links, folders, view]);
}

/** Contagem de links ativos por tag, calculada uma vez por mudança de dados. */
export function useCounts() {
  const links = useStore(s => s.links), folders = useStore(s => s.folders);
  return useMemo(() => {
    const ids = new Set(folders.map(f => f.id));
    const by = new Map<string, number>();
    let total = 0, none = 0;
    for (const l of links) {
      if (isArch(l)) continue;
      total++;
      const live = tagsOf(l).filter(id => ids.has(id));
      live.forEach(id => by.set(id, (by.get(id) || 0) + 1));
      if (!live.length) none++;
    }
    return { total, none, arch: links.length - total, by };
  }, [links, folders]);
}

/** Tags que batem com a busca (Tudo e Tags), na mesma ordem da grade. */
export function useTagHits() {
  const folders = useSortedFolders(), q = useDeferredValue(useStore(s => s.q));
  return useMemo(() => matchingTags(folders, q), [folders, q]);
}
