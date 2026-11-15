import { create } from 'zustand';
import type { Folder, Link, View } from './types';
import type { Backend } from './data/backend';
import { EMPTY_FILTERS, type FilterState } from './lib/filters';

export type Then =
  | { type: 'stay' }
  | { type: 'dest' }
  | { type: 'edit-pasta'; linkId: string }
  | { type: 'move-many' };

export type ModalState =
  | { kind: 'link'; id: string }
  | { kind: 'new'; then?: Then }
  | { kind: 'edit'; id: string }
  | { kind: 'confirm'; id: string }
  | { kind: 'purge'; ids: string[] };

export interface Draft { id: string; titulo: string; nota: string; pasta: string }
export interface ToastState { id: number; text: string; label?: string; fn?: () => void }
export type Theme = 'light' | 'dark' | 'system';

export interface State extends FilterState {
  phase: 'boot' | 'login' | 'ready';
  mode: 'local' | 'cloud';
  loaded: boolean;
  loadError: boolean;
  folders: Folder[];
  links: Link[];

  view: View;
  prevView: View | null;
  filtersOpen: boolean;
  layout: 'cards' | 'list';
  dest: string;
  pal: string | null;

  sel: string[];
  anchor: string | null;
  menu: boolean;
  flash: string | null;

  adding: boolean;
  addPrefill: string;
  /** Aviso mostrado no diálogo de salvar (ex.: pasta criada a partir dele). */
  addNote: string;
  modal: ModalState | null;
  draft: Draft | null;
  clip: { url: string; key: string } | null;
  toast: ToastState | null;
  refreshing: boolean;

  profile: { nome: string; email: string };
  theme: Theme;
}

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

export const useStore = create<State>(() => ({
  phase: 'boot',
  mode: 'local',
  loaded: false,
  loadError: false,
  folders: [],
  links: [],

  view: 'all',
  prevView: null,
  filtersOpen: false,
  layout: read('brica.layout') === 'list' ? 'list' : 'cards',
  dest: '',
  pal: null,

  sel: [],
  anchor: null,
  menu: false,
  flash: null,

  adding: false,
  addPrefill: '',
  addNote: '',
  modal: null,
  draft: null,
  clip: null,
  toast: null,
  refreshing: false,

  profile: { nome: read('disorder.nome') || '', email: '' },
  theme: (['light', 'dark', 'system'] as Theme[]).includes(read('disorder.theme') as Theme) ? (read('disorder.theme') as Theme) : 'light',

  ...EMPTY_FILTERS,
}));

export const get = useStore.getState;
export const set = useStore.setState;

let backendRef: Backend | null = null;
export const setBackend = (b: Backend) => { backendRef = b; };
export const backend = () => {
  if (!backendRef) throw new Error('backend ainda não iniciado');
  return backendRef;
};
