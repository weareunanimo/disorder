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

export type Resumo = { resumo: string; tema: string };

/** Como foi a última chamada de resumo: 200, o código HTTP da falha, ou 0 quando nem chegou ao servidor. Serve para explicar por que não funcionou. */
export let lastSummarizeStatus = 200;

/** Pede à função /api/summarize uma frase e um tema. Devolve null se a IA estiver desligada, falhar ou não souber. */
export async function summarize(l: Pick<Link, 'titulo' | 'tituloAuto' | 'descricao' | 'plataforma'>): Promise<Resumo | null> {
  if (!CFG.summarizeApi) return null;
  const titulo = l.titulo || l.tituloAuto || '';
  if (!titulo && !l.descricao) return null;
  try {
    const r = await fetch(CFG.summarizeApi, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ titulo, descricao: l.descricao || '', site: l.plataforma || '' }),
    });
    lastSummarizeStatus = r.status;
    if (!r.ok) return null;
    const d = (await r.json()) as Partial<Resumo>;
    const resumo = (d.resumo || '').trim(), tema = (d.tema || '').trim();
    return resumo || tema ? { resumo, tema } : null;
  } catch { lastSummarizeStatus = 0; return null; }
}

/** Frase para a pessoa entender por que o resumo não rodou. */
export function whySummaryFailed(status: number): string {
  if (status === 401) return 'sua sessão expirou. Saia e entre de novo.';
  if (status === 503) return 'o servidor ainda não tem a chave de IA. Confira AI_GATEWAY_API_KEY na Vercel e faça um redeploy.';
  if (status === 429) return 'o limite diário de IA acabou. Tente amanhã.';
  if (status === 502) return 'o serviço de IA recusou o pedido. Confira a chave e o modelo na Vercel.';
  if (status === 0) return 'não consegui falar com o servidor.';
  return 'o servidor respondeu com erro ' + status + '.';
}
