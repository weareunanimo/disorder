export type Plat = 'x' | 'threads' | 'instagram' | 'tiktok' | 'youtube' | 'web';

export interface Link {
  id: string;
  url: string;
  chave: string;
  plataforma: Plat;
  tipo: string;
  autor: string | null;
  titulo: string;
  nota: string;
  pastaId: string | null;
  criadoEm: number;
  enriquecido: boolean;
  tituloAuto?: string;
  thumb?: string;
  arquivadoEm?: number | null;
  host?: string;
}

export interface Folder {
  id: string;
  nome: string;
  cor?: number;
  ordem?: number;
  criadaEm?: number;
}

export type Col = 'folders' | 'links';
export type Rec<C extends Col> = C extends 'links' ? Link : Folder;

/** Telas: 'all', 'none', 'archived', 'settings' ou o id de uma pasta. */
export type View = string;

export interface PreviewData { title?: string; image?: string }
