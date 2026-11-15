import type { Folder, Link, View } from '../types';
import { autoTitle } from './platforms';
import { sortLinks, type Sort } from './sort';

export const FIXED_VIEWS = ['all', 'none', 'archived', 'settings'];
export const isArch = (l: Link) => !!l.arquivadoEm;

export interface FilterState {
  q: string;
  plats: string[];
  fp: string[];
  from: string;
  to: string;
}
export const EMPTY_FILTERS: FilterState = { q: '', plats: [], fp: [], from: '', to: '' };

export function folderExists(folders: Folder[], id: string | null | undefined) {
  return !!id && folders.some(f => f.id === id);
}

export function inView(l: Link, view: View, folders: Folder[]): boolean {
  if (view === 'settings') return false;
  if (view === 'archived') return isArch(l);
  if (isArch(l)) return false;
  if (view === 'all') return true;
  if (view === 'none') return !l.pastaId || !folderExists(folders, l.pastaId);
  return l.pastaId === view;
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
  return (f.q.trim() ? 1 : 0) + (f.plats.length ? 1 : 0) + (view === 'all' && f.fp.length ? 1 : 0) + (f.from || f.to ? 1 : 0);
}

/** Links da tela atual com os filtros aplicados, na ordem escolhida (padrão: do mais novo para o mais antigo). */
export function visibleLinks(links: Link[], folders: Folder[], view: View, f: FilterState, sort: Sort = 'new'): Link[] {
  const q = f.q.trim().toLowerCase();
  const t0 = f.from ? dayStart(f.from) : 0, t1 = f.to ? dayStart(f.to) + 864e5 : 0;
  const byFolder = view === 'all' && f.fp.length > 0;
  const names = new Map(folders.map(x => [x.id, x.nome]));
  return sortLinks(links
    .filter(l => inView(l, view, folders))
    .filter(l => !f.plats.length || f.plats.includes(l.plataforma))
    .filter(l => !byFolder || f.fp.includes(l.pastaId || 'none'))
    .filter(l => (!t0 || (l.criadoEm || 0) >= t0) && (!t1 || (l.criadoEm || 0) < t1))
    .filter(l => {
      if (!q) return true;
      const nome = l.pastaId ? names.get(l.pastaId) : undefined;
      return [l.titulo, l.tituloAuto, autoTitle(l), l.nota, l.autor, l.url, nome].filter(Boolean).join(' ').toLowerCase().includes(q);
    }), sort);
}

export function viewTitle(view: View, folders: Folder[]): string {
  if (view === 'all') return 'Todos os links';
  if (view === 'none') return 'Sem pasta';
  if (view === 'archived') return 'Arquivados';
  if (view === 'settings') return 'Ajustes';
  return folders.find(f => f.id === view)?.nome ?? 'Todos os links';
}
