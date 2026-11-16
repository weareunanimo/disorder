import type { Link, Plat } from '../types';

export const PLAT: Record<Plat, { label: string; short: string }> = {
  x: { label: 'X', short: 'X' },
  threads: { label: 'Threads', short: 'Th' },
  instagram: { label: 'Instagram', short: 'IG' },
  tiktok: { label: 'TikTok', short: 'TT' },
  youtube: { label: 'YouTube', short: 'YT' },
  web: { label: 'Sites', short: 'Web' },
};
export const PLAT_KEYS = Object.keys(PLAT) as Plat[];
export const SOCIAL: Plat[] = ['x', 'threads', 'instagram', 'tiktok', 'youtube'];

const TRACK = /^(utm_|fbclid|gclid|igsh|igshid|si$|feature$|ref$|ref_src|ref_url|s$|t$|share|is_from_webapp|sender_device|_t$|_r$|mibextid|xmt|slof|pp$)/i;

export interface Parsed {
  plataforma: Plat;
  tipo: string;
  autor: string | null;
  key: string;
  url: string;
  host: string;
}
export type ParseResult = Parsed | { error: 'vazio' | 'espaco' | 'invalido' };

export function isParsed(r: ParseResult): r is Parsed {
  return !('error' in r);
}

/** Lê um endereço: descobre a rede, o tipo, o autor, uma chave única e o endereço limpo (sem rastreadores). */
export function parseLink(raw: string): ParseResult {
  let s = String(raw || '').trim();
  if (!s) return { error: 'vazio' };
  if (/\s/.test(s)) return { error: 'espaco' };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    if (/^[^\s/?#]+\.[a-z]{2,}([/?#]|$)/i.test(s)) s = 'https://' + s;
    else return { error: 'invalido' };
  }
  let u: URL;
  try { u = new URL(s); } catch { return { error: 'invalido' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'invalido' };
  if (!u.hostname.includes('.')) return { error: 'invalido' };

  const host = u.hostname.toLowerCase();
  const bare = host.replace(/^(www|m|mobile|web)\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  let plataforma: Plat = 'web', tipo = 'Link', autor: string | null = null, key: string | null = null, keepQuery: string[] = [];

  if (bare === 'x.com' || bare === 'twitter.com') {
    plataforma = 'x';
    if (parts[1] === 'status' && parts[2]) { tipo = 'Post'; autor = parts[0] === 'i' ? null : '@' + parts[0]; key = 'x:' + parts[2]; }
    else if (parts[0] && !['i', 'home', 'explore', 'search', 'hashtag'].includes(parts[0])) { tipo = 'Perfil'; autor = '@' + parts[0]; key = 'x:perfil:' + parts[0].toLowerCase(); }
  } else if (bare === 'threads.net' || bare === 'threads.com') {
    plataforma = 'threads';
    if (parts[0] && parts[0][0] === '@') {
      autor = parts[0];
      if (parts[1] === 'post' && parts[2]) { tipo = 'Post'; key = 'threads:' + parts[2]; }
      else { tipo = 'Perfil'; key = 'threads:perfil:' + parts[0].toLowerCase(); }
    } else if (parts[0] === 't' && parts[1]) { tipo = 'Post'; key = 'threads:' + parts[1]; }
  } else if (bare === 'instagram.com' || bare === 'instagr.am') {
    plataforma = 'instagram';
    let i = 0;
    if (parts[0] && !['p', 'reel', 'reels', 'tv', 'stories', 'explore'].includes(parts[0]) && parts[1] && ['p', 'reel', 'reels', 'tv'].includes(parts[1])) { autor = '@' + parts[0]; i = 1; }
    const k = parts[i];
    if (['reel', 'reels'].includes(k) && parts[i + 1]) { tipo = 'Reel'; key = 'ig:' + parts[i + 1]; }
    else if (k === 'p' && parts[i + 1]) { tipo = 'Post'; key = 'ig:' + parts[i + 1]; }
    else if (k === 'tv' && parts[i + 1]) { tipo = 'Vídeo'; key = 'ig:' + parts[i + 1]; }
    else if (k === 'stories' && parts[1]) { tipo = 'Story'; autor = '@' + parts[1]; key = 'ig:story:' + parts.slice(1).join('/'); }
    else if (k && k !== 'explore') { tipo = 'Perfil'; autor = '@' + k; key = 'ig:perfil:' + k.toLowerCase(); }
  } else if (bare.endsWith('tiktok.com')) {
    plataforma = 'tiktok';
    if (parts[0] && parts[0][0] === '@') {
      autor = parts[0];
      if (parts[1] === 'video' && parts[2]) { tipo = 'Vídeo'; key = 'tt:' + parts[2]; }
      else if (parts[1] === 'photo' && parts[2]) { tipo = 'Post'; key = 'tt:' + parts[2]; }
      else { tipo = 'Perfil'; key = 'tt:perfil:' + parts[0].toLowerCase(); }
    } else { tipo = 'Vídeo'; key = 'tt:' + bare + u.pathname.replace(/\/$/, ''); }
  } else if (bare === 'youtube.com' || bare === 'music.youtube.com' || bare === 'youtu.be' || bare === 'youtube-nocookie.com') {
    plataforma = 'youtube';
    if (bare === 'youtu.be' && parts[0]) { tipo = 'Vídeo'; key = 'yt:' + parts[0]; }
    else if (parts[0] === 'shorts' && parts[1]) { tipo = 'Short'; key = 'yt:' + parts[1]; }
    else if (parts[0] === 'live' && parts[1]) { tipo = 'Live'; key = 'yt:' + parts[1]; }
    else if (parts[0] === 'watch' && u.searchParams.get('v')) { tipo = 'Vídeo'; key = 'yt:' + u.searchParams.get('v'); keepQuery = ['v', 'list']; }
    else if (parts[0] === 'playlist' && u.searchParams.get('list')) { tipo = 'Playlist'; key = 'yt:pl:' + u.searchParams.get('list'); keepQuery = ['list']; }
    else if (parts[0] && parts[0][0] === '@') { tipo = 'Canal'; autor = parts[0]; key = 'yt:canal:' + parts[0].toLowerCase(); }
    else if (['channel', 'c', 'user'].includes(parts[0]) && parts[1]) { tipo = 'Canal'; key = 'yt:canal:' + parts[1].toLowerCase(); }
  }

  // endereço limpo: sem rastreadores e sem âncora
  const clean = new URL(u.origin + u.pathname);
  if (plataforma === 'web') {
    u.searchParams.forEach((v, k) => { if (!TRACK.test(k)) clean.searchParams.append(k, v); });
  } else {
    keepQuery.forEach(k => { const v = u.searchParams.get(k); if (v) clean.searchParams.set(k, v); });
  }
  let url = clean.toString();
  if (clean.pathname.length > 1 && url.endsWith('/') && !clean.search) url = url.slice(0, -1);
  if (!key) key = 'url:' + bare + clean.pathname.replace(/\/$/, '') + clean.search;
  return { plataforma, tipo, autor, key, url, host: bare };
}

export const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '');

type TitleSrc = Pick<Link, 'plataforma' | 'tipo' | 'autor'> & { host?: string; url?: string };

/** Título provisório, usado até o preview trazer o título de verdade. */
export function autoTitle(l: TitleSrc): string {
  const a = l.autor;
  switch (l.plataforma) {
    case 'x': return l.tipo === 'Perfil' ? 'Perfil ' + a : (a ? 'Post de ' + a : 'Post no X');
    case 'threads': return l.tipo === 'Perfil' ? 'Perfil ' + a : (a ? 'Post de ' + a : 'Post no Threads');
    case 'instagram':
      if (l.tipo === 'Perfil') return 'Perfil ' + a;
      if (l.tipo === 'Story') return 'Story de ' + a;
      return (l.tipo === 'Reel' ? 'Reel' : l.tipo === 'Vídeo' ? 'Vídeo' : 'Post') + (a ? ' de ' + a : ' no Instagram');
    case 'tiktok': return l.tipo === 'Perfil' ? 'Perfil ' + a : (a ? (l.tipo === 'Post' ? 'Post de ' : 'Vídeo de ') + a : 'Vídeo no TikTok');
    case 'youtube':
      if (l.tipo === 'Canal') return a ? 'Canal ' + a : 'Canal do YouTube';
      return (l.tipo === 'Short' ? 'Short' : l.tipo === 'Playlist' ? 'Playlist' : l.tipo === 'Live' ? 'Live' : 'Vídeo') + ' do YouTube';
    default: return l.host || (l.url ? shortUrl(l.url).split('/')[0].replace(/^(m|mobile)\./, '') : 'Link');
  }
}

export function ago(ms: number): string {
  const d = Math.floor((Date.now() - ms) / 864e5);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 7) return 'há ' + d + ' dias';
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

/** Corta o título do cartão sem quebrar palavra. O limite muda com a largura da tela. */
export function clipTitle(t: string, max: number): string {
  t = String(t || '');
  if (t.length <= max) return t;
  let cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  if (sp > max - 25) cut = cut.slice(0, sp);
  return cut.replace(/[\s.,;:!?-]+$/, '') + '…';
}

export const thumbOf = (l: Pick<Link, 'thumb'>) => (l.thumb && /^https:\/\//i.test(l.thumb) ? l.thumb : '');

/* ===== Tipo de conteúdo (decide como o cartão se apresenta) ===== */
export type Kind = 'video' | 'post' | 'profile' | 'article' | 'site';

export function kindOf(l: Pick<Link, 'plataforma' | 'tipo' | 'leitura' | 'duracao'>): Kind {
  if (l.tipo === 'Perfil' || l.tipo === 'Canal') return 'profile';
  if (['Vídeo', 'Short', 'Live', 'Reel'].includes(l.tipo) || l.duracao) return 'video';
  if (l.plataforma !== 'web') return l.tipo === 'Playlist' ? 'video' : 'post';
  return l.leitura ? 'article' : 'site';
}

/** 253 vira 4:13, 3723 vira 1:02:03. */
export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const z = (n: number) => String(n).padStart(2, '0');
  return h ? h + ':' + z(m) + ':' + z(r) : m + ':' + z(r);
}

export const readLabel = (min: number) => min + ' min de leitura';

/** Linha de origem do cartão: o nome da rede ou o domínio do site. Sem o tipo (Reel, Post, Story) e sem "Artigo". */
export function originOf(l: Pick<Link, 'plataforma' | 'host' | 'url'>): string {
  if (l.plataforma !== 'web') return PLAT[l.plataforma].label;
  return l.host || shortUrl(l.url).split('/')[0].replace(/^(m|mobile)\./, '');
}

/** Resumo só entra no cartão se acrescenta algo ao título. */
export function summaryOf(l: Pick<Link, 'resumoIA' | 'descricao' | 'titulo' | 'tituloAuto' | 'plataforma' | 'tipo' | 'leitura' | 'duracao'>): string {
  const ia = (l.resumoIA || '').trim();
  if (ia && kindOf(l) !== 'post' && kindOf(l) !== 'profile') return ia;
  const d = (l.descricao || '').trim();
  if (!d || kindOf(l) === 'post' || kindOf(l) === 'profile') return '';
  const t = (l.titulo || l.tituloAuto || '').toLowerCase();
  if (t && (d.toLowerCase().startsWith(t.slice(0, 40)) || t.startsWith(d.toLowerCase().slice(0, 40)))) return '';
  return d;
}

export function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
}
