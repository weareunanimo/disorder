import type { Col, Folder, Link } from '../types';

export interface Snapshot { folders: Folder[]; links: Link[] }

export interface Backend {
  mode: 'local' | 'cloud';
  /** Entrega os dados (e depois as mudanças) por onData. */
  start(onData: (d: Snapshot) => void, onError: (e: unknown) => void): Promise<void> | void;
  set(col: Col, id: string, rec: Folder | Link): Promise<void>;
  remove(col: Col, id: string): Promise<void>;
}

const KEY = 'roni.v2';

/** Modo local: tudo fica no navegador. Usa a mesma chave de antes, então quem já tinha dados não perde nada. */
export function localBackend(): Backend {
  let data: Snapshot = { folders: [], links: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = { ...data, ...JSON.parse(raw) };
  } catch { /* dados ilegíveis: começa vazio */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* sem espaço */ } };
  return {
    mode: 'local',
    start(onData) { onData({ folders: data.folders.slice(), links: data.links.slice() }); },
    async set(col, id, rec) {
      const a = data[col] as { id: string }[];
      const i = a.findIndex(x => x.id === id);
      const r = { ...rec, id };
      if (i < 0) a.push(r); else a[i] = r;
      persist();
    },
    async remove(col, id) {
      data = { ...data, [col]: (data[col] as { id: string }[]).filter(x => x.id !== id) } as Snapshot;
      persist();
    },
  };
}
