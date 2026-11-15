# disorder

Salve links do X, Threads, Instagram, TikTok e YouTube em pastas. O app puxa o título e a imagem de cada link, como o WhatsApp faz.

## Como funciona

- `src/` é o app, em React e TypeScript, empacotado pelo Vite.
  - `lib/` tem as regras sem interface (leitura de link, filtros, importação), cobertas por testes.
  - `data/` fala com o Supabase, com o armazenamento local e com a função de preview.
  - `store.ts` guarda o estado (zustand) e `actions.ts` concentra tudo o que muda esse estado.
  - `components/` e `dialogs/` são as telas. `styles/theme.css` é o CSS do design system.
- `api/preview.js` é uma função da Vercel que lê o título e a imagem do link. Para YouTube e TikTok usa o oEmbed, para o resto lê as tags Open Graph. Bloqueia endereços privados e, com Supabase configurado, só responde a usuários logados.
- `supabase/schema.sql` cria as tabelas, as regras de acesso por usuário e o bucket das imagens.
- `docs/design-system.html` é o design system. Toda interface nova começa por ele.
- `shape/` gera a forma do logo usada em cartões, botões e campos. Rode `python3 gen_shape.py` dentro da pasta e cole o resultado no fim de `src/styles/theme.css`, depois do comentário "Forma do logo".

A lista desenha 60 links por vez e carrega mais ao rolar, então abre rápido mesmo com milhares de links. O Supabase só é baixado depois que a tela inicial aparece.

## Configurar

1. **Supabase.** Crie um projeto, rode `supabase/schema.sql` no SQL Editor e, em Authentication, ligue o login por e-mail e adicione a URL do site em Redirect URLs.
2. **Endereço e chave.** Os padrões ficam em `src/config.ts`. Para outro projeto, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (veja `.env.example`).
3. **Vercel.** Importe este repositório (o `vercel.json` já aponta o build do Vite) e defina `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_KEY`. A service key nunca vai para o front.

## Rodar local

```
npm install
npm run dev              # http://localhost:5173, com a função de preview junto
VITE_LOCAL=1 npm run dev # sem login, dados só no navegador
npm test                 # regras (vitest) e função de preview
npm run build            # confere os tipos e gera dist/
```

A versão anterior, em HTML e JS puro, está no ramo `vanilla-final`.

## Limites conhecidos

- Instagram e Threads às vezes escondem o título e a imagem de servidores. Quando falha, o cartão mostra as iniciais e o título automático.
- Os links salvos antes do login ficam no navegador e não migram sozinhos.

## Receber links pelo compartilhar do sistema

O app aceita `/?url=<link>` (também `text` e `title`) e abre o diálogo de salvar com o link preenchido.

- **Android (Chrome):** instale o app pelo menu "Adicionar à tela inicial". Depois disso, "disorder" aparece na folha de compartilhar.
- **iOS:** o Safari não tem esse recurso para sites. Crie um Atalho com "Mostrar na Folha de Compartilhamento" que abre `https://SEU-ENDERECO/?url=` seguido da entrada do atalho codificada como URL.
