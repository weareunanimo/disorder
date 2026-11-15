import { useState } from 'react';
import { sendLoginLink } from '../data/supabase';
import { Brand } from './Bits';

export function Login() {
  const [email, setEmail] = useState(''), [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const submit = async () => {
    const to = email.trim();
    if (!to || busy) return;
    setBusy(true);
    const ok = await sendLoginLink(to);
    setBusy(false);
    setMsg(ok ? { kind: 'ok', text: 'Link enviado para ' + to + '. Abra o e-mail neste aparelho.' } : { kind: 'err', text: 'Não consegui enviar o link. Confira o e-mail e tente de novo.' });
  };
  return (
    <>
      <Brand />
      <main className="login">
        <p className="lead">Entre com o seu e-mail. Vamos enviar um link para você entrar, sem senha.</p>
        <form onSubmit={e => { e.preventDefault(); void submit(); }}>
          <label className="f">E-mail<span className="inw"><input type="email" id="login-email" autoComplete="email" required placeholder="voce@email.com" value={email} onChange={e => setEmail(e.target.value)} /></span></label>
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Enviando' : 'Enviar link'}</button>
        </form>
        <p className={'msg ' + (msg?.kind ?? '')} role="status" aria-live="polite">{msg?.text}</p>
      </main>
    </>
  );
}
