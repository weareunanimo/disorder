import type { Folder, Link, View } from '../types';
import { autoTitle } from './platforms';
import { sortLinks, type Sort } from './sort';
import { tagsOf } from './tags';

/** 'tags' é a grade de tags (aba Tags). */
export const FIXED_VIEWS = ['all', 'tags', 'none', 'archived', 'settings'];
export const isArch = (l: Link) => !!l.arquivadoEm;
/** Tudo e Tags compartilham a mesma busca: nas duas abas ela procura em todos os links e no nome das tags. */
export const isHome = (view: View) => view === 'all' || view === 'tags';
/** Texto para comparar na busca: minúsculo e sem acento, então "musica" acha "Música". */
export const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export interface FilterState {
  q: string;
  plats: string[];
  /** Tipos de link (loja, artigo...). "none" é link que a IA ainda não identificou. */
  kinds: string[];
  fp: string[];
  from: string;
  to: string;
}
export const EMPTY_FILTERS: FilterState = { q: '', plats: [], kinds: [], fp: [], from: '', to: '' };

export function folderExists(folders: Folder[], id: string | null | undefined) {
  return !!id && folders.some(f => f.id === id);
}

export function inView(l: Link, view: View, folders: Folder[]): boolean {
  if (view === 'settings') return false;
  if (view === 'archived') return isArch(l);
  if (isArch(l)) return false;
  if (isHome(view)) return true;
  if (view === 'none') return !tagsOf(l).some(id => folderExists(folders, id));
  return tagsOf(l).includes(view);
}

/** Filtro por tags: vale se o link tem qualquer uma das escolhidas. "none" casa com link sem tag. */
export function matchTags(l: Link, folders: Folder[], fp: string[]): boolean {
  const live = tagsOf(l).filter(id => folderExists(folders, id));
  return fp.some(id => (id === 'none' ? !live.length : live.includes(id)));
}

export function dayStart(iso: string): number {
  const a = String(iso).split('-').map(Number);
  return new Date(a[0], (a[1] || 1) - 1, a[2] || 1).getTime();
}
export function isoDay(ms: number): string {
  const d = new Date(ms), z = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}
export function datePreset(days: number, now = Date.now()) {
  return { from: isoDay(now - (days - 1) * 864e5), to: isoDay(now) };
}

export function filterCount(f: FilterState, view: View): number {
  return (f.q.trim() ? 1 : 0) + (f.plats.length ? 1 : 0) + (f.kinds.length ? 1 : 0) + (isHome(view) && f.fp.length ? 1 : 0) + (f.from || f.to ? 1 : 0);
}

/** Links da tela atual com os filtros aplicados, na ordem escolhida (padrão: do mais novo para o mais antigo). */
export function visibleLinks(links: Link[], folders: Folder[], view: View, f: FilterState, sort: Sort = 'new'): Link[] {
  const q = fold(f.q.trim());
  const t0 = f.from ? dayStart(f.from) : 0, t1 = f.to ? dayStart(f.to) + 864e5 : 0;
  const byFolder = isHome(view) && f.fp.length > 0;
  const names = new Map(folders.map(x => [x.id, x.nome]));
  return sortLinks(links
    .filter(l => inView(l, view, folders))
    .filter(l => !f.plats.length || f.plats.includes(l.plataforma))
    .filter(l => !f.kinds.length || f.kinds.includes(l.categoria || 'none'))
    .filter(l => !byFolder || matchTags(l, folders, f.fp))
    .filter(l => (!t0 || (l.criadoEm || 0) >= t0) && (!t1 || (l.criadoEm || 0) < t1))
    .filter(l => {
      if (!q) return true;
      const nome = tagsOf(l).map(id => names.get(id)).filter(Boolean).join(' ');
      return fold([l.titulo, l.tituloAuto, autoTitle(l), l.nota, l.resumoIA, l.autor, l.url, nome].filter(Boolean).join(' ')).includes(q);
    }), sort);
}

/** Tags cujo nome contém o texto buscado. */
export function matchingTags(folders: Folder[], q: string): Folder[] {
  const t = fold(q.trim());
  return t ? folders.filter(f => !f.arquivadaEm && fold(f.nome).includes(t)) : [];
}

export function viewTitle(view: View, folders: Folder[]): string {
  if (view === 'all') return 'Tudo';
  if (view === 'tags') return 'Tags';
  if (view === 'none') return 'Sem tag';
  if (view === 'archived') return 'Arquivados';
  if (view === 'settings') return 'Ajustes';
  return folders.find(f => f.id === view)?.nome ?? 'Todos os links';
}
