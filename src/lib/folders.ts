import type { Folder } from '../types';
import { hashN, uid } from './text';

export const SW_NAMES = ['Rosa', 'Laranja', 'Amarelo', 'Verde', 'Ciano', 'Azul', 'Lilás', 'Lima'];
export const STARTERS = ['Receitas', 'Decoração', 'Pet'];

export const colorOf = (f?: Pick<Folder, 'id' | 'cor'> | null): number =>
  f && Number.isInteger(f.cor) ? (f.cor as number) % 8 : hashN((f && f.id) || '') % 8;

/**
 * Forma da tag: 0 reta, 1 cantos arredondados, 2 pílula. Fixa por tag (vem do id), independente da cor,
 * para que 8 cores vezes 3 formas repitam menos lado a lado.
 */
export const shapeOf = (f?: Pick<Folder, 'id'> | null): number => hashN(((f && f.id) || '') + ':forma') % 3;

const ordOf = (f: Folder) => (Number.isFinite(f.ordem) ? (f.ordem as number) : 1e9);

export const sortFolders = (fs: Folder[]): Folder[] =>
  fs.slice().sort((a, b) => ordOf(a) - ordOf(b) || (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));

export function makeFolder(nome: string, existing: Folder[]): Folder {
  const f: Folder = { id: uid(), nome, cor: existing.length % 8, criadaEm: Date.now() };
  const o = existing.filter(x => Number.isFinite(x.ordem)).map(x => x.ordem as number);
  if (o.length) f.ordem = Math.max(...o) + 1;
  return f;
}

export const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
