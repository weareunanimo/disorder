import type { Link } from '../types';
import { originOf, titleOf } from './platforms';

export type Sort = 'new' | 'old' | 'name' | 'name-desc' | 'origin';
export const SORTS: { key: Sort; label: string }[] = [
  { key: 'new', label: 'Mais recentes' },
  { key: 'old', label: 'Mais antigos' },
  { key: 'name', label: 'Nome, A a Z' },
  { key: 'name-desc', label: 'Nome, Z a A' },
  { key: 'origin', label: 'Origem, A a Z' },
];
export const isSort = (v: unknown): v is Sort => SORTS.some(s => s.key === v);

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const nameOf = (l: Link) => titleOf(l);
const when = (l: Link) => l.criadoEm || 0;

/** Ordena sem mexer na lista original. Empate sempre desempata pelo mais recente, para a ordem não pular. */
export function sortLinks(links: Link[], sort: Sort): Link[] {
  const newest = (a: Link, b: Link) => when(b) - when(a);
  const cmp: Record<Sort, (a: Link, b: Link) => number> = {
    new: newest,
    old: (a, b) => when(a) - when(b),
    name: (a, b) => collator.compare(nameOf(a), nameOf(b)) || newest(a, b),
    'name-desc': (a, b) => collator.compare(nameOf(b), nameOf(a)) || newest(a, b),
    origin: (a, b) => collator.compare(originOf(a), originOf(b)) || newest(a, b),
  };
  return links.slice().sort(cmp[sort]);
}
