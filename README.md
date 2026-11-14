# disorder

Salve links do X, Threads, Instagram, TikTok e YouTube em pastas. O app puxa o título e a imagem de cada link, como o WhatsApp faz.

## Como funciona

- `public/` é o app, em HTML, CSS e JS puro, sem build.
- `api/preview.js` é uma função da Vercel que lê o título e a imagem do link. Para YouTube e TikTok usa o oEmbed, para o resto lê as tags Open Graph. Bloqueia endereços privados e, com Supabase configurado, só responde a usuários logados.
- `supabase/schema.sql` cria as tabelas, as regras de acesso por usuário e o bucket das imagens.
- `docs/design-system.html` é o design system. Toda interface nova começa por ele.

Sem configuração o app roda em modo local, guardando tudo no navegador. A imagem do preview aparece mesmo assim, direto da fonte.

## Configurar

1. **Supabase.** Crie um projeto, rode `supabase/schema.sql` no SQL Editor e, em Authentication, ligue o login por e-mail e adicione a URL do site em Redirect URLs.
2. **config.js.** Preencha `supabaseUrl` e `supabaseAnonKey` em `public/config.js`.
3. **Vercel.** Importe este repositório e defina as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_KEY`. A service key nunca vai para o front.

## Rodar local

```
npm run dev     # http://localhost:3000
npm test
```

## Limites conhecidos

- Instagram e Threads às vezes escondem o título e a imagem de servidores. Quando falha, o cartão mostra as iniciais e o título automático.
- Os links salvos antes do login ficam no navegador e não migram sozinhos.
