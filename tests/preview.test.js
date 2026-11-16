const http = require('node:http');
const assert = require('node:assert');
process.env.BB_ALLOW_PRIVATE = '1';
const handler = require('../api/preview.js');
const page = `<html><head><title>Fallback</title><meta property="og:title" content="Bolo &amp; cenoura"><meta property='og:image' content="/img/a.jpg"><meta property="og:site_name" content="Receitas"></head></html>`;
const srv = http.createServer((q, r) => {
  if (q.url === '/redir') { r.writeHead(302, { location: '/p' }); return r.end(); }
  if (q.url === '/p') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(page); }
  r.writeHead(404); r.end();
});
function call(url) {
  return new Promise(res => {
    const out = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { res({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler({ headers: {}, url: '/api/preview?url=' + encodeURIComponent(url) }, out);
  });
}
srv.listen(0, async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  let r = await call(base + '/redir');
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.title, 'Bolo & cenoura');
  assert.strictEqual(r.body.image, base + '/img/a.jpg'); assert.strictEqual(r.body.site, 'Receitas');
  r = await call('nao-e-url'); assert.strictEqual(r.status, 400);
  process.env.BB_ALLOW_PRIVATE = '0';
  r = await call(base + '/p'); assert.strictEqual(r.status, 422); // bloqueia endereço privado
  console.log('ok'); srv.close();
});

// Metadados extras: duração, leitura, data, resumo e ícone.
{
  const { parseMeta, parseDuration } = handler;
  assert.strictEqual(parseDuration('PT4M13S'), 253);
  assert.strictEqual(parseDuration('PT1H2M3S'), 3723);
  assert.strictEqual(parseDuration('P0DT0H0M45S'), 45);
  assert.strictEqual(parseDuration('187'), 187);
  assert.strictEqual(parseDuration('lixo'), 0);
  const video = parseMeta('<head><meta property="og:title" content="V"><meta itemprop="duration" content="PT4M13S"><meta itemprop="uploadDate" content="2024-03-01"><meta property="og:description" content="Resumo do vídeo"></head>', 'https://y.com/watch');
  assert.strictEqual(video.duracao, 253); assert.strictEqual(video.leitura, 0);
  assert.strictEqual(video.descricao, 'Resumo do vídeo'); assert.ok(video.publicadoEm > 0);
  const words = Array.from({ length: 900 }, (_, i) => 'palavra' + i).join(' ');
  const art = parseMeta('<head><meta property="og:type" content="article"><link rel="icon" href="/f.png"><meta property="article:published_time" content="2025-05-02T10:00:00Z"></head><body><article><p>' + words + '</p></article></body>', 'https://blog.com/a/b');
  assert.strictEqual(art.leitura, 5); assert.strictEqual(art.icone, 'https://blog.com/f.png'); assert.ok(art.publicadoEm > 0);
  const short = parseMeta('<head><meta property="og:type" content="article"></head><body><article>curto demais</article></body>', 'https://a.com');
  assert.strictEqual(short.leitura, 0);
  console.log('ok extras');
}

// Pista do tipo de página, para a IA.
{
  const { parseMeta: pm } = require('../api/preview.js');
  const assert = require('node:assert');
  const P = h => pm('<html><head>' + h + '</head></html>', 'https://x.com/a').pista;
  assert.strictEqual(P('<meta property="og:type" content="product">'), 'produto');
  assert.strictEqual(P('<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Tênis"}</script>'), 'produto');
  assert.strictEqual(P('<script type="application/ld+json">{"@type":"Recipe"}</script>'), 'receita');
  assert.strictEqual(P('<meta property="og:type" content="article">'), 'artigo');
  assert.strictEqual(P('<title>Oi</title>'), '');
  console.log('ok pista');
}
