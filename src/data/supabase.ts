import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { CFG } from '../config';
import type { Backend } from './backend';
import type { Col, Folder, Link } from '../types';

let client: SupabaseClient | null = null;
let onRecovery: (() => void) | null = null;
export const whenRecovery = (fn: () => void) => { onRecovery = fn; };
export const getClient = () => client;

/** O Supabase só é baixado quando existe configuração, para a tela inicial abrir mais rápido. */
export async function connect(): Promise<Session | null | 'off'> {
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) return 'off';
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  // O link de esqueci a senha chega com type=recovery no endereço; o evento confirma depois de ler a sessão.
  recovery = /type=recovery/.test(location.hash);
  client.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') { recovery = true; try { sessionStorage.setItem('disorder.recovery', '1'); } catch { /* */ } onRecovery?.(); } });
  const r = await client.auth.getSession();
  return r.data.session;
}

/** Resultado de uma ação de conta: deu certo, ou a mensagem para mostrar. */
export type AuthResult = { ok: true; confirm?: boolean } | { ok: false; msg: string; unconfirmed?: boolean };

/** Traduz os erros do Supabase para frases do app. Erro desconhecido vira uma frase genérica, sem detalhe técnico. */
function why(e: { message?: string; status?: number; code?: string } | null): string {
  const m = (e?.message || '').toLowerCase(), c = e?.code || '';
  if (c === 'invalid_credentials' || m.includes('invalid login')) return 'E-mail ou senha errados. Se você entrava por link, use Esqueci a senha para criar uma.';
  if (c === 'email_not_confirmed' || m.includes('not confirmed')) return 'Falta confirmar o e-mail. Abra o link que mandamos no cadastro.';
  if (c === 'user_already_exists' || m.includes('already registered')) return 'Esse e-mail já tem conta. Entre com a sua senha.';
  if (c === 'weak_password' || m.includes('password should')) return 'Senha fraca. Use pelo menos 8 caracteres.';
  if (c === 'over_email_send_rate_limit' || c === 'over_request_rate_limit' || e?.status === 429) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  if (c === 'same_password') return 'A senha nova é igual à atual.';
  if (m.includes('fetch') || m.includes('network')) return 'Sem conexão. Confira a internet e tente de novo.';
  return 'Não deu certo. Tente de novo em alguns segundos.';
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!client) return { ok: false, msg: why(null) };
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (!error) return { ok: true };
  const unconfirmed = error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message);
  return { ok: false, msg: why(error), unconfirmed };
}

/** Cria a conta. Se o projeto pede confirmação de e-mail, não há sessão ainda: confirm = true. */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!client) return { ok: false, msg: why(null) };
  const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
  if (error) return { ok: false, msg: why(error) };
  // E-mail já cadastrado: o Supabase devolve um usuário sem identidades, sem dizer que existe.
  if (data.user && !data.user.identities?.length) return { ok: false, msg: why({ code: 'user_already_exists' }) };
  return { ok: true, confirm: !data.session };
}

export async function resendConfirm(email: string): Promise<AuthResult> {
  if (!client) return { ok: false, msg: why(null) };
  const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: location.origin } });
  return error ? { ok: false, msg: why(error) } : { ok: true };
}

/** Manda o link para criar uma senha nova. Serve também para quem tinha conta só com link por e-mail. */
export async function sendReset(email: string): Promise<AuthResult> {
  if (!client) return { ok: false, msg: why(null) };
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
  return error ? { ok: false, msg: why(error) } : { ok: true };
}

/** Define ou troca a senha de quem já está dentro (Ajustes ou link de esqueci a senha). */
export async function setPassword(password: string): Promise<AuthResult> {
  if (!client) return { ok: false, msg: why(null) };
  const { error } = await client.auth.updateUser({ password });
  return error ? { ok: false, msg: why(error) } : { ok: true };
}

/** Veio do link de esqueci a senha: o app abre direto o pedido de senha nova. */
let recovery = false;
export const takeRecovery = () => {
  let r = recovery;
  try { r = r || sessionStorage.getItem('disorder.recovery') === '1'; sessionStorage.removeItem('disorder.recovery'); } catch { /* sem armazenamento */ }
  recovery = false;
  return r;
};

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
