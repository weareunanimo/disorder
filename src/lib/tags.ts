import type { Folder, Link } from '../types';

/** Tags do link. Aceita o formato antigo, com uma tag só (pastaId), e devolve sempre uma lista sem repetição. */
export function tagsOf(l: { pastaIds?: unknown; pastaId?: unknown }): string[] {
  // Se o campo antigo existe, um app desatualizado escreveu por último, então ele vale.
  const old = 'pastaId' in l;
  const raw = old ? (typeof l.pastaId === 'string' && l.pastaId ? [l.pastaId] : []) : Array.isArray(l.pastaIds) ? l.pastaIds : [];
  return Array.from(new Set(raw.filter((x): x is string => typeof x === 'string' && !!x)));
}

/** Converte o que veio do armazenamento para o formato atual (pastaIds) e descarta o campo antigo. */
export function normLink(l: Link): Link {
  const { pastaId: _old, ...rest } = l as Link & { pastaId?: unknown };
  void _old;
  return { ...rest, pastaIds: tagsOf(l) };
}

export const hasTag = (l: Link, id: string) => tagsOf(l).includes(id);
export const sameTags = (a: Link, b: Link) => {
  const x = tagsOf(a), y = tagsOf(b);
  return x.length === y.length && x.every(t => y.includes(t));
};
/** Tags que ainda existem, na ordem das tags. */
export const liveTags = (l: Link, folders: Folder[]): Folder[] => {
  const ids = tagsOf(l);
  return folders.filter(f => ids.includes(f.id));
};
export const withTag = (ids: string[], id: string) => (ids.includes(id) ? ids : [...ids, id]);
export const withoutTag = (ids: string[], id: string) => ids.filter(x => x !== id);
