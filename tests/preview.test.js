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
