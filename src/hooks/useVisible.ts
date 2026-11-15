import { useDeferredValue, useMemo } from 'react';
import { useStore } from '../store';
import { inView, isArch, visibleLinks } from '../lib/filters';
import { sortFolders } from '../lib/folders';

/** Links da tela atual, já filtrados. A busca usa valor adiado para a digitação não travar com muitos links. */
export function useVisible() {
  const links = useStore(s => s.links), folders = useStore(s => s.folders), view = useStore(s => s.view);
  const q = useDeferredValue(useStore(s => s.q));
  const plats = useStore(s => s.plats), fp = useStore(s => s.fp), from = useStore(s => s.from), to = useStore(s => s.to);
  return useMemo(() => visibleLinks(links, folders, view, { q, plats, fp, from, to }), [links, folders, view, q, plats, fp, from, to]);
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

/** Contagem de links ativos por pasta, calculada uma vez por mudança de dados. */
export function useCounts() {
  const links = useStore(s => s.links), folders = useStore(s => s.folders);
  return useMemo(() => {
    const ids = new Set(folders.map(f => f.id));
    const by = new Map<string, number>();
    let total = 0, none = 0;
    for (const l of links) {
      if (isArch(l)) continue;
      total++;
      if (l.pastaId && ids.has(l.pastaId)) by.set(l.pastaId, (by.get(l.pastaId) || 0) + 1); else none++;
    }
    return { total, none, arch: links.length - total, by };
  }, [links, folders]);
}
