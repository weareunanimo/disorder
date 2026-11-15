// A chave anon do Supabase é pública por design: quem protege os dados é o RLS por usuário (supabase/schema.sql).
const env = import.meta.env;

/** VITE_LOCAL=1 desliga a conta: os dados ficam só no navegador. Serve para desenvolver e testar sem login. */
const local = env.VITE_LOCAL === '1';

export const CFG = {
  supabaseUrl: local ? '' : (env.VITE_SUPABASE_URL as string | undefined) || 'https://boiysiavamhmfwhobwww.supabase.co',
  supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY as string | undefined) || 'sb_publishable_t1__9B98tkqFesc9sQmcrw_2FkC-WKA',
  previewApi: (env.VITE_PREVIEW_API as string | undefined) ?? '/api/preview',
  summarizeApi: (env.VITE_SUMMARIZE_API as string | undefined) ?? (local ? '' : '/api/summarize'),
};
