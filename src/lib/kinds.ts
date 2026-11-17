/** Tipos de link que a IA identifica. Lista fechada, para o filtro e o cartão não variarem. */
export const KINDS = [
  { key: 'loja', label: 'Loja' },
  { key: 'artigo', label: 'Artigo' },
  { key: 'noticia', label: 'Notícia' },
  { key: 'receita', label: 'Receita' },
  { key: 'video', label: 'Vídeo' },
  { key: 'musica', label: 'Música' },
  { key: 'ferramenta', label: 'Ferramenta' },
  { key: 'referencia', label: 'Referência' },
  { key: 'lugar', label: 'Lugar' },
  { key: 'evento', label: 'Evento' },
  { key: 'post', label: 'Post' },
  { key: 'nota', label: 'Nota' },
] as const;
export type Kind = (typeof KINDS)[number]['key'];
export const isKind = (v: unknown): v is Kind => KINDS.some(k => k.key === v);
export const kindLabel = (v?: string) => KINDS.find(k => k.key === v)?.label || '';
