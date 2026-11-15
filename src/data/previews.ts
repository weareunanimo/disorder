import { CFG } from '../config';
import { authHeaders } from './supabase';
import type { Link, PreviewData } from '../types';

/** Busca título e imagem de um link na função /api/preview. Devolve null se não achar nada útil. */
export async function fetchPreview(url: string): Promise<PreviewData | null> {
  if (!CFG.previewApi) return null;
  try {
    const r = await fetch(CFG.previewApi + '?url=' + encodeURIComponent(url), { headers: await authHeaders() });
    if (!r.ok) return null;
    const d = (await r.json()) as PreviewData | null;
    return d && (d.title || d.image) ? d : null;
  } catch { return null; }
}

export type EnrichResult = { link: Link; got: boolean } | null;

/** Completa um link com título e imagem. Devolve o link novo, ou null se a API falhou (tenta de novo na próxima visita). */
export async function enrichLink(l: Link): Promise<EnrichResult> {
  if (!CFG.previewApi) return null;
  try {
    const r = await fetch(CFG.previewApi + '?url=' + encodeURIComponent(l.url), { headers: await authHeaders() });
    if (!r.ok) return null;
    const d = (await r.json()) as PreviewData | null;
    const next: Link = { ...l, enriquecido: true };
    let got = false;
    if (d?.title) { next.tituloAuto = d.title; got = true; }
    if (d?.image) { next.thumb = d.image; got = true; }
    return { link: next, got };
  } catch { return null; }
}
