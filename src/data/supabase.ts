import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { CFG } from '../config';
import type { Backend } from './backend';
import type { Col, Folder, Link } from '../types';

let client: SupabaseClient | null = null;
export const getClient = () => client;

/** O Supabase só é baixado quando existe configuração, para a tela inicial abrir mais rápido. */
export async function connect(): Promise<Session | null | 'off'> {
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) return 'off';
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  const r = await client.auth.getSession();
  return r.data.session;
}

export async function sendLoginLink(email: string): Promise<boolean> {
  if (!client) return false;
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
  return !error;
}

/** Entrar com o código de 6 dígitos do e-mail (útil no app instalado no iPhone, que não recebe o clique do link). */
export async function verifyLoginCode(email: string, token: string): Promise<boolean> {
  if (!client) return false;
  const { error } = await client.auth.verifyOtp({ email, token, type: 'email' });
  return !error;
}

export function onSignedIn(fn: () => void) {
  client?.auth.onAuthStateChange((_ev, s) => { if (s) fn(); });
}

export async function signOut() {
  await client?.auth.signOut();
  location.reload();
}

export async function saveProfileName(nome: string) {
  if (!client) return;
  const r = await client.auth.updateUser({ data: { nome } });
  if (r.error) throw r.error;
}

export async function authHeaders(): Promise<Record<string, string>> {
  if (!client) return {};
  const r = await client.auth.getSession();
  const t = r.data.session?.access_token;
  return t ? { Authorization: 'Bearer ' + t } : {};
}

type Row = { id: string; data: Record<string, unknown> };
const toRec = <T,>(r: Row) => ({ ...r.data, id: r.id }) as T;

export function supabaseBackend(c: SupabaseClient, busy: () => boolean): Backend {
  const load = async () => {
    const [f, l] = await Promise.all([c.from('folders').select('id,data'), c.from('links').select('id,data')]);
    if (f.error) throw f.error;
    if (l.error) throw l.error;
    return { folders: (f.data as Row[]).map(r => toRec<Folder>(r)), links: (l.data as Row[]).map(r => toRec<Link>(r)) };
  };
  return {
    mode: 'cloud',
    async start(onData, onError) {
      const refresh = async () => { try { onData(await load()); } catch (e) { onError(e); } };
      await refresh();
      // Mudanças vindas de outro aparelho. Não atualiza no meio de uma edição aberta.
      c.channel('bb-sync').on('postgres_changes', { event: '*', schema: 'public' }, () => { if (!busy()) void refresh(); }).subscribe();
    },
    async set(col: Col, id, rec) {
      const data: Record<string, unknown> = { ...rec };
      delete data.id;
      const { error } = await c.from(col).upsert({ id, data });
      if (error) throw error;
    },
    async remove(col: Col, id) {
      const { error } = await c.from(col).delete().eq('id', id);
      if (error) throw error;
    },
  };
}
