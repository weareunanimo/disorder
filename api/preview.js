// GET /api/preview?url=...  ->  { title, image, site, descricao, duracao, leitura, publicadoEm, icone }
// Lê o título e a imagem de um link, como o WhatsApp faz. Roda como função serverless da Vercel.
const dns = require('node:dns').promises;
const net = require('node:net');
const crypto = require('node:crypto');

const UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const MAX_HTML = 600 * 1024;
const MAX_IMG = 4 * 1024 * 1024;

function isPrivateIp(ip) {
  if (process.env.BB_ALLOW_PRIVATE === '1') return false;
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:');
}

async function assertPublic(u) {
  if (!/^https?:$/.test(u.protocol)) throw new Error('protocolo inválido');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) { if (isPrivateIp(host)) throw new Error('endereço privado'); return; }
  const addrs = await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('endereço privado');
}

async function safeFetch(url, opts = {}, hops = 4) {
  let cur = new URL(url);
  for (let i = 0; i <= hops; i++) {
    await assertPublic(cur);
    const r = await fetch(cur, { redirect: 'manual', signal: AbortSignal.timeout(8000), ...opts, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,image/*,*/*;q=0.8', 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8', ...(opts.headers || {}) } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { cur = new URL(r.headers.get('location'), cur); continue; }
    return { res: r, url: cur };
  }
  throw new Error('redirecionamentos demais');
}

async function readLimited(res, max) {
  const reader = res.body.getReader(); const chunks = []; let n = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); n += value.length;
    if (n > max) { try { await reader.cancel(); } catch (e) {} break; }
  }
  return Buffer.concat(chunks.map(c => Buffer.from(c)));
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return String(s || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, g) => {
    if (g[0] === '#') { const c = g[1].toLowerCase() === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10); return Number.isFinite(c) ? String.fromCodePoint(c) : m; }
    return ENT[g.toLowerCase()] ?? m;
  }).replace(/\s+/g, ' ').trim();
}

// "PT1H2M3S", "P0DT4M13S" ou segundos puros viram segundos. Devolve 0 se não entender.
function parseDuration(v) {
  v = String(v || '').trim();
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(Number(v));
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(v);
  if (!m) return 0;
  return Math.round((+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0));
}

function toMs(v) {
  const t = Date.parse(String(v || ''));
  return Number.isFinite(t) && t > 0 && t < Date.now() + 864e5 ? t : 0;
}

// Estimativa de leitura: só para páginas com cara de artigo, a 200 palavras por minuto.
function readingMinutes(html, isArticle) {
  if (!isArticle) return 0;
  const art = /<article[\s>][\s\S]*?<\/article>/i.exec(html);
  const body = (art ? art[0] : html).replace(/<(script|style|noscript|svg|nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  const words = decode(body).split(' ').filter(w => w.length > 1).length;
  return words >= 250 ? Math.min(90, Math.ceil(words / 200)) : 0;
}

function parseMeta(html, base) {
  const head = html.slice(0, MAX_HTML);
  const meta = {};
  const re = /<meta\s+([^>]*?)\/?>/gi; let m;
  while ((m = re.exec(head))) {
    const attrs = {}; const ar = /([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g; let a;
    while ((a = ar.exec(m[1]))) attrs[a[1].toLowerCase()] = a[3] ?? a[4];
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    if (key && attrs.content != null && !(key in meta)) meta[key] = attrs.content;
  }
  const t = /<title[^>]*>([^<]*)<\/title>/i.exec(head);
  const title = decode(meta['og:title'] || meta['twitter:title'] || (t && t[1]) || '');
  const abs = v => { try { return v ? new URL(decode(v), base).toString() : ''; } catch (e) { return ''; } };
  const image = abs(meta['og:image:secure_url'] || meta['og:image'] || meta['twitter:image'] || meta['twitter:image:src']);
  let icon = '';
  const lr = /<link\s+([^>]*?)\/?>/gi; let l;
  while ((l = lr.exec(head))) {
    const rel = /rel\s*=\s*["']([^"']*)["']/i.exec(l[1]), href = /href\s*=\s*["']([^"']*)["']/i.exec(l[1]);
    if (rel && href && /(^|\s)(shortcut\s+)?icon(\s|$)/i.test(rel[1])) { icon = abs(href[1]); break; }
  }
  const ld = k => { const x = new RegExp('"' + k + '"\\s*:\\s*"([^"]+)"').exec(head); return x ? x[1] : ''; };
  const type = (meta['og:type'] || '').toLowerCase();
  const duration = parseDuration(meta['og:video:duration'] || meta['video:duration'] || meta['duration'] || ld('duration'));
  const published = toMs(meta['article:published_time'] || meta['og:article:published_time'] || meta['datepublished'] || meta['uploaddate'] || ld('datePublished') || ld('uploadDate'));
  const isArticle = type === 'article' || /<article[\s>]/i.test(head);
  return {
    title, image, site: decode(meta['og:site_name'] || ''),
    descricao: decode(meta['og:description'] || meta['twitter:description'] || meta['description'] || '').slice(0, 240),
    duracao: duration, leitura: duration ? 0 : readingMinutes(head, isArticle), publicadoEm: published, icone: icon,
  };
}

function youtubeId(u) {
  try {
    const x = new URL(u); const h = x.hostname.replace(/^www\.|^m\./, '');
    if (h === 'youtu.be') return x.pathname.slice(1).split('/')[0] || null;
    if (h.endsWith('youtube.com')) {
      if (x.pathname === '/watch') return x.searchParams.get('v');
      const m = /^\/(shorts|embed|live)\/([\w-]{6,})/.exec(x.pathname); if (m) return m[2];
    }
  } catch (e) {}
  return null;
}

async function oembed(endpoint, url) {
  const { res } = await safeFetch(endpoint + '?format=json&url=' + encodeURIComponent(url));
  if (!res.ok) return null;
  return JSON.parse((await readLimited(res, 200 * 1024)).toString('utf8'));
}

const EMPTY = { title: '', image: '', site: '', descricao: '', duracao: 0, leitura: 0, publicadoEm: 0, icone: '' };

async function pageMeta(url) {
  const { res, url: finalUrl } = await safeFetch(url);
  if (!res.ok) return { ...EMPTY };
  const ct = res.headers.get('content-type') || '';
  if (/^image\//.test(ct)) return { ...EMPTY, image: finalUrl.toString() };
  if (!/html|xml/.test(ct)) return { ...EMPTY };
  return parseMeta((await readLimited(res, MAX_HTML)).toString('utf8'), finalUrl);
}

async function getMeta(url) {
  const host = new URL(url).hostname.replace(/^www\.|^m\./, '');
  const id = youtubeId(url);
  try {
    if (id || host.endsWith('tiktok.com')) {
      const [d, pg] = await Promise.all([
        oembed(id ? 'https://www.youtube.com/oembed' : 'https://www.tiktok.com/oembed', url).catch(() => null),
        // A página do vídeo traz duração, descrição e data de publicação. Se falhar, o oEmbed basta.
        pageMeta(id ? 'https://www.youtube.com/watch?v=' + id : url).catch(() => ({ ...EMPTY })),
      ]);
      if (d) {
        const title = decode(d.title) || (d.author_name && !id ? 'Vídeo de @' + d.author_name : '');
        const image = id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : d.thumbnail_url || '';
        return { ...pg, title, image, site: id ? 'YouTube' : 'TikTok', leitura: 0 };
      }
    }
  } catch (e) { /* cai para as tags da página */ }
  return pageMeta(url);
}

// Guarda a imagem no Supabase Storage para não depender do link original, que costuma expirar.
async function mirrorImage(imageUrl) {
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!base || !key || !imageUrl) return imageUrl;
  try {
    const { res } = await safeFetch(imageUrl);
    const ct = (res.headers.get('content-type') || '').split(';')[0];
    if (!res.ok || !/^image\/(jpeg|png|webp|gif)$/.test(ct)) return imageUrl;
    const buf = await readLimited(res, MAX_IMG);
    if (!buf.length || buf.length > MAX_IMG) return imageUrl;
    const ext = ct.split('/')[1].replace('jpeg', 'jpg');
    const name = crypto.createHash('sha1').update(imageUrl).digest('hex') + '.' + ext;
    const up = await fetch(base + '/storage/v1/object/previews/' + name, { method: 'POST', headers: { authorization: 'Bearer ' + key, apikey: key, 'content-type': ct, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' }, body: buf });
    if (!up.ok) return imageUrl;
    return base + '/storage/v1/object/public/previews/' + name;
  } catch (e) { return imageUrl; }
}

async function authorized(req) {
  const base = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!base || !anon) return true; // sem Supabase configurado, a função fica aberta (uso local e testes)
  const h = req.headers.authorization || '';
  if (!/^Bearer /.test(h)) return false;
  const r = await fetch(base + '/auth/v1/user', { headers: { authorization: h, apikey: anon } });
  return r.ok;
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  try {
    if (!(await authorized(req))) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'não autorizado' })); }
    const raw = (req.query && req.query.url) || new URL(req.url, 'http://x').searchParams.get('url');
    let u; try { u = new URL(raw); } catch (e) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'url inválida' })); }
    await assertPublic(u);
    const meta = await getMeta(u.toString());
    meta.image = await mirrorImage(meta.image);
    res.setHeader('cache-control', 's-maxage=86400, stale-while-revalidate=604800');
    res.statusCode = 200;
    res.end(JSON.stringify({
      title: (meta.title || '').slice(0, 300), image: meta.image || '', site: meta.site || '',
      descricao: meta.descricao || '', duracao: meta.duracao || 0, leitura: meta.leitura || 0, publicadoEm: meta.publicadoEm || 0,
      icone: /^https:\/\//i.test(meta.icone || '') ? meta.icone : '',
    }));
  } catch (e) {
    res.statusCode = 422; res.end(JSON.stringify({ error: 'não consegui ler esse link' }));
  }
};
module.exports.parseMeta = parseMeta; module.exports.isPrivateIp = isPrivateIp; module.exports.parseDuration = parseDuration;
