import { CFG } from '../config';
import { authHeaders } from './supabase';
import type { Extras, Link, PreviewData } from '../types';

/** Transforma a resposta da função de preview nos campos do link. Só entra o que veio preenchido. */
export function extrasOf(d: PreviewData | null): Extras {
  const o: Extras = {};
  if (!d) return o;
  if (d.title) o.tituloAuto = d.title;
  if (d.image && /^https:\/\//i.test(d.image)) o.thumb = d.image;
  if (d.descricao) o.descricao = d.descricao.slice(0, 240);
  if (d.duracao && d.duracao > 0) o.duracao = Math.round(d.duracao);
  if (d.leitura && d.leitura > 0) o.leitura = Math.round(d.leitura);
  if (d.publicadoEm && d.publicadoEm > 0) o.publicadoEm = d.publicadoEm;
  if (d.icone && /^https:\/\//i.test(d.icone)) o.icone = d.icone;
  return o;
}

const hasAny = (d: PreviewData | null): d is PreviewData => !!d && Object.keys(extrasOf(d)).length > 0;

/** Busca os dados de um link na função /api/preview. Devolve null se não achar nada útil. */
export async function fetchPreview(url: string): Promise<PreviewData | null> {
  if (!CFG.previewApi) return null;
  try {
    const r = await fetch(CFG.previewApi + '?url=' + encodeURIComponent(url), { headers: await authHeaders() });
    if (!r.ok) return null;
    const d = (await r.json()) as PreviewData | null;
    return hasAny(d) ? d : null;
  } catch { return null; }
}

export type EnrichResult = { extras: Extras; got: boolean } | null;

/** Completa um link já salvo. Devolve null se a API falhou (tenta de novo na próxima visita). */
export async function enrichLink(l: Link): Promise<EnrichResult> {
  if (!CFG.previewApi) return null;
  try {
    const r = await fetch(CFG.previewApi + '?url=' + encodeURIComponent(l.url), { headers: await authHeaders() });
    if (!r.ok) return null;
    const extras = extrasOf((await r.json()) as PreviewData | null);
    return { extras, got: Object.keys(extras).length > 0 };
  } catch { return null; }
}
