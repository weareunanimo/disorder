export type Plat = 'x' | 'threads' | 'instagram' | 'tiktok' | 'youtube' | 'web';

/** Item de uma lista dentro de um link ou nota. */
export interface ListItem { id: string; t: string; ok: boolean }

export interface Link {
  id: string;
  /** Vazio numa nota: item sem link, só com texto e lista. */
  url: string;
  chave: string;
  plataforma: Plat;
  tipo: string;
  autor: string | null;
  titulo: string;
  nota: string;
  /** Tags do link (as antigas tags). Um link pode ter várias. */
  pastaIds: string[];
  criadoEm: number;
  enriquecido: boolean;
  tituloAuto?: string;
  thumb?: string;
  /** Metadados lidos da página (todos opcionais): resumo da própria página, duração em segundos, minutos de leitura, data de publicação e ícone do site. */
  descricao?: string;
  duracao?: number;
  leitura?: number;
  publicadoEm?: number;
  icone?: string;
  /** Gerados pela IA (opcionais): uma frase sobre o link e um tema curto. Só existem se o resumo por IA estiver ligado. */
  /** A pessoa mexeu nas tags deste link. A IA nunca mais mexe nele. */
  pastaManual?: boolean;
  /** A nota veio do texto colado junto com o link (compartilhar de um app), não foi escrita pela pessoa. */
  notaColada?: boolean;
  /** Foi arquivado junto com a tag, então volta junto quando a tag for restaurada. */
  arquivadoComPasta?: boolean;
  resumoIA?: string;
  /** O que o link é (loja, artigo, receita...), identificado pela IA. Ver lib/kinds. */
  categoria?: string;
  /** Quando a IA já leu este link e respondeu. Evita pedir de novo o que ela não soube dizer. */
  iaEm?: number;
  /** Pista do tipo lida da página, usada pela IA. */
  pista?: string;
  tema?: string;
  arquivadoEm?: number | null;
  host?: string;
  /** Lista com checkbox (compras, a fazer). Opcional em qualquer item. */
  lista?: ListItem[];
}

export interface Folder {
  id: string;
  nome: string;
  cor?: number;
  ordem?: number;
  criadaEm?: number;
  /** Criada pela IA. Deixa de ser quando a pessoa renomeia. */
  auto?: boolean;
  /** Quando foi arquivada. Tag arquivada some do menu, mas guarda o nome e a cor. */
  arquivadaEm?: number | null;
}

export type Col = 'folders' | 'links';
export type Rec<C extends Col> = C extends 'links' ? Link : Folder;

/** Telas: 'all', 'none', 'archived', 'settings' ou o id de uma tag. */
export type View = string;

export interface PreviewData {
  title?: string; image?: string; site?: string;
  descricao?: string; duracao?: number; leitura?: number; publicadoEm?: number; icone?: string;
  /** Tipo que a própria página declara (produto, receita...). Só uma pista para a IA. */
  pista?: string;
}

/** Campos do link que vêm do preview. */
export type Extras = Pick<Link, 'tituloAuto' | 'thumb' | 'descricao' | 'duracao' | 'leitura' | 'publicadoEm' | 'icone' | 'pista'>;
