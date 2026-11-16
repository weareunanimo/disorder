const http = require('node:http');
const assert = require('node:assert');
const handler = require('../api/summarize.js');

const fake = http.createServer((q, r) => {
  let body = ''; q.on('data', d => body += d); q.on('end', () => {
    const p = JSON.parse(body);
    assert.ok(/Bearer teste/.test(q.headers.authorization));
    if (p.messages[1].content.includes('Limite')) { r.writeHead(429, { 'content-type': 'application/json' }); return r.end(JSON.stringify({ error: { message: 'Rate limit exceeded: limit of 5 requests per minute. Retry after 12s.' } })); }
    assert.ok(p.messages[1].content.includes('Bolo'));
    r.writeHead(200, { 'content-type': 'application/json' });
    r.end(JSON.stringify({ choices: [{ message: { content: '```json\n{"resumo":"Receita de bolo fofinho de cenoura — com cobertura","tema":"Receitas!","tipo":"Receita"}\n```' } }] }));
  });
});

function call(body, method = 'POST') {
  return new Promise(res => {
    const out = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { res({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler({ method, headers: {}, body }, out);
  });
}

fake.listen(0, async () => {
  process.env.AI_GATEWAY_URL = 'http://127.0.0.1:' + fake.address().port;
  delete process.env.AI_GATEWAY_API_KEY;
  let r = await call({ titulo: 'Bolo' });
  assert.strictEqual(r.status, 503); // sem chave, a IA fica desligada
  process.env.AI_GATEWAY_API_KEY = 'teste';
  assert.strictEqual((await call({}, 'GET')).status, 405);
  r = await call({ titulo: '', descricao: '' });
  assert.deepStrictEqual(r.body, { resumo: '', tema: '', tipo: '' }); // sem texto, nem chama a IA
  r = await call({ titulo: 'Bolo de cenoura', site: 'Receitas' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.resumo, 'Receita de bolo fofinho de cenoura, com cobertura'); // sem travessão
  assert.strictEqual(r.body.tema, 'receitas');
  assert.strictEqual(r.body.tipo, 'receita'); // normaliza caixa e só aceita a lista fechada
  r = await call({ titulo: 'Limite' });
  assert.strictEqual(r.status, 429); assert.strictEqual(r.body.porMinuto, true); assert.strictEqual(r.body.retry, 12); // o app espera e tenta de novo
  process.env.AI_DAILY_LIMIT = '2';
  r = await call({ titulo: 'Bolo' }); r = await call({ titulo: 'Bolo' });
  assert.strictEqual(r.status, 429);
  assert.strictEqual(handler.parseAnswer('sem json'), null);
  console.log('ok'); fake.close();
});
