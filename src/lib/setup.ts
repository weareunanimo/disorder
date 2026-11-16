/** Deixar o disorder 100%: app instalado e salvar pelo Compartilhar do celular. */
export type Plat = 'ios' | 'android' | 'desktop';
export interface Setup { app: boolean; share: boolean }

const KEY = 'disorder.setup';
/** O atalho do iPhone abre este endereço com o link colado depois do "=". Fragmento não exige codificar o link. */
export const SHARE_HASH = '#salvar=';

export function platform(): Plat {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function standalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function loadSetup(): Setup {
  let s: Partial<Setup> = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Setup>; } catch { /* sem armazenamento */ }
  return { app: !!s.app || standalone(), share: !!s.share };
}
export function saveSetup(s: Setup) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sem armazenamento */ }
}
export const setupDone = (s: Setup) => (s.app ? 1 : 0) + (s.share ? 1 : 0);

/** Pega o primeiro link de um texto recebido (compartilhar do Android, atalho do iPhone). */
export function linkIn(...parts: (string | null | undefined)[]): string | null {
  return parts.filter(Boolean).join(' ').match(/https?:\/\/[^\s]+/i)?.[0] ?? null;
}
