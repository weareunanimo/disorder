import { create } from 'zustand';
import type { Folder, Link, View } from './types';
import type { Backend } from './data/backend';
import { EMPTY_FILTERS, type FilterState } from './lib/filters';
import { isSort, type Sort } from './lib/sort';

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
  | { kind: 'archive-folder'; id: string }
  | { kind: 'purge'; ids: string[] };

export interface Draft { id: string; titulo: string; nota: string; tags: string[] }
export interface ToastState { id: number; text: string; label?: string; fn?: () => void }
export type Theme = 'light' | 'dark' | 'system';

/** Grade (cartões com texto), Lista (só em telas largas) e Galeria (imagem de ponta a ponta, densa). */
export type Layout = 'cards' | 'list' | 'gallery';

export interface State extends FilterState {
  phase: 'boot' | 'login' | 'ready';
  mode: 'local' | 'cloud';
  loaded: boolean;
  loadError: boolean;
  folders: Folder[];
  /** Tags arquivadas. Ficam fora do menu e das listas, e voltam em Ajustes. */
  foldersArq: Folder[];
  links: Link[];

  view: View;
  prevView: View | null;
  filtersOpen: boolean;
  layout: Layout;
  /** Tags escolhidas no diálogo de salvar. */
  dest: string[];
  pal: string | null;

  sel: string[];
  anchor: string | null;
  menu: boolean;
  flash: string | null;

  adding: boolean;
  addPrefill: string;
  /** Aviso mostrado no diálogo de salvar (ex.: tag criada a partir dele). */
  addNote: string;
  modal: ModalState | null;
  draft: Draft | null;
  clip: { url: string; key: string } | null;
  toast: ToastState | null;
  refreshing: boolean;
  summarizingAll: boolean;
  /** Andamento do resumo em lote: quantos já foram e quantos são. */
  aiProgress: { done: number; total: number };
  /** Links novos cujo preview ainda está sendo lido. */
  loading: string[];

  profile: { nome: string; email: string };
  theme: Theme;
  /** Resumo por IA ligado neste aparelho. Desligado por padrão: liga em Configurações. */
  ai: boolean;
  /** Cartão com a gaveta de ações aberta (arrastado para a esquerda). */
  swipeId: string | null;
  /** Cartão com o menu de três pontos aberto. */
  cardMenu: string | null;
  /** O menu abriu direto na lista de tags. */
  cardMenuTags: boolean;
  /** Ordem da lista: data, nome ou origem. */
  sort: Sort;
}

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

export const useStore = create<State>(() => ({
  phase: 'boot',
  mode: 'local',
  loaded: false,
  loadError: false,
  folders: [],
  foldersArq: [],
  links: [],

  view: 'all',
  prevView: null,
  filtersOpen: false,
  // Galeria é a visualização principal. Quem já escolheu outra continua com a sua.
  layout: (['cards', 'list', 'gallery'] as const).find(v => v === read('brica.layout')) || 'gallery',
  dest: [],
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
  summarizingAll: false,
  aiProgress: { done: 0, total: 0 },
  loading: [],

  profile: { nome: read('disorder.nome') || '', email: '' },
  ai: read('disorder.ai') === '1',
  swipeId: null,
  cardMenu: null,
  cardMenuTags: false,
  sort: isSort(read('disorder.sort')) ? (read('disorder.sort') as Sort) : 'new',
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
