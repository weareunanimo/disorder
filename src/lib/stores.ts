/**
 * Lojas que bloqueiam a leitura da página por robôs (Shopee e outras). Para elas o app não insiste:
 * reconhece a loja pelo endereço, já sabe que é uma loja e tenta tirar o nome do produto do próprio endereço.
 */
const STORES: { host: RegExp; name: string; slug?: (u: URL) => string }[] = [
  // shopee.com.br/Nome-do-Produto-i.123.456 (o formato /product/123/456 não traz nome)
  { host: /(^|\.)shopee\.com(\.br)?$/, name: 'Shopee', slug: u => u.pathname.match(/^\/(.+)-i\.\d+\.\d+/)?.[1] || '' },
  // mercadolivre.com.br/nome-do-produto/p/MLB123 ou produto.mercadolivre.com.br/MLB-123-nome-do-produto-_JM
  { host: /(^|\.)mercadoli(vre|bre)\.com(\.br)?$/, name: 'Mercado Livre', slug: u => u.pathname.match(/^\/([^/]+)\/p\/MLB/)?.[1] || u.pathname.match(/MLB-?\d+-(.+?)(-_JM)?$/)?.[1] || '' },
  // amazon.com.br/Nome-do-Produto/dp/B0...
  { host: /(^|\.)amazon\.com(\.br)?$/, name: 'Amazon', slug: u => u.pathname.match(/^\/([^/]+)\/dp\//)?.[1] || '' },
  { host: /(^|\.)aliexpress\.(com|us)$/, name: 'AliExpress' },
  { host: /(^|\.)shein\.com(\.br)?$/, name: 'Shein', slug: u => u.pathname.match(/^\/(.+)-p-\d+/)?.[1] || '' },
  { host: /(^|\.)magazineluiza\.com\.br$/, name: 'Magalu', slug: u => u.pathname.match(/^\/([^/]+)\/p\//)?.[1] || '' },
];

export interface Store { name: string; title: string }

export function storeOf(url: string): Store | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const h = u.hostname.replace(/^www\./, '').toLowerCase();
  const s = STORES.find(x => x.host.test(h));
  if (!s) return null;
  const raw = s.slug ? s.slug(u) : '';
  let title = '';
  try { title = decodeURIComponent(raw).replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim(); } catch { title = ''; }
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1);
  return { name: s.name, title: title.length >= 4 ? title : '' };
}

/**
 * Texto que veio junto com o link ao compartilhar de um app (ex.: "Confira Fone Bluetooth por R$ 29,90 na Shopee!").
 * Quando a página não deixa ler, ele vira o título e a descrição, e a IA consegue achar o tipo e a tag.
 */
export function fromShareText(txt: string): { tituloAuto: string; descricao: string } | null {
  const clean = txt.replace(/https?:\/\/\S+/g, ' ').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length < 6) return null;
  const title = clean
    .replace(/^(confira|olha|veja|olha s[oó]|achei|dá uma olhada( n[oa])?|check out|look at)\s*(isso|esse|essa|este|esta)?[:!,.\s-]*/i, '')
    .replace(/\s*(por|a partir de|apenas|só)\s*R\$\s*[\d.,]+.*$/i, '')
    .replace(/\s*(na|no|pela|pelo|in|on)\s+(shopee|mercado livre|amazon|aliexpress|shein|magalu)\b.*$/i, '')
    .replace(/[\s!.,:;-]+$/, '')
    .trim();
  const t = (title.length >= 4 ? title : clean).slice(0, 120);
  return { tituloAuto: t.charAt(0).toUpperCase() + t.slice(1), descricao: clean.slice(0, 400) };
}
