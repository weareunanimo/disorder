import type { Link, ListItem } from '../types';

/** Nota: item sem link, só com título, texto e lista. Mora na mesma coleção dos links. */
export const isNote = (l: Pick<Link, 'url'>) => !l.url;

const rid = () => Math.random().toString(36).slice(2, 10);

export function newNote(id: string, pastaIds: string[], withList: boolean, now = Date.now()): Link {
  return {
    id, url: '', chave: 'nota:' + id, plataforma: 'web', tipo: 'Nota', autor: null, titulo: '', nota: '',
    pastaIds, criadoEm: now, enriquecido: true, iaEm: now, categoria: 'nota',
    lista: withList ? [newItem()] : undefined,
  };
}
export const newItem = (t = ''): ListItem => ({ id: rid(), t, ok: false });

/** Itens a fazer primeiro, feitos no fim, cada grupo na ordem em que foi escrito. */
export const ordered = (items: ListItem[]) => [...items.filter(i => !i.ok), ...items.filter(i => i.ok)];

export function listStats(l: Pick<Link, 'lista'>) {
  const items = (l.lista || []).filter(i => i.t.trim());
  return { total: items.length, done: items.filter(i => i.ok).length };
}

/** Título que aparece: o escrito, senão a primeira linha do texto, senão o primeiro item. */
export function noteTitle(l: Pick<Link, 'titulo' | 'nota' | 'lista'>): string {
  const first = (l.nota || '').split('\n').map(x => x.trim()).find(Boolean);
  const item = (l.lista || []).find(i => i.t.trim())?.t.trim();
  return (l.titulo || '').trim() || first || item || 'Nota sem título';
}

/** Lista vinda de fora (importar arquivo, outro aparelho): só o que tem a forma certa. */
export function cleanList(v: unknown): ListItem[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter(x => x && typeof x.t === 'string').slice(0, 500)
    .map(x => ({ id: typeof x.id === 'string' && x.id ? x.id : rid(), t: String(x.t).slice(0, 500), ok: !!x.ok }));
  return out.length ? out : undefined;
}
