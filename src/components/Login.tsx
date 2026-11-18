import { useEffect, useRef, useState } from 'react';
import { resendConfirm, sendReset, signIn, signUp } from '../data/supabase';
import { Brand } from './Bits';

type Mode = 'entrar' | 'criar' | 'esqueci';
type Sent = { kind: 'confirm' | 'reset'; email: string } | null;
const MIN = 8;

/** Atalho para a caixa de entrada, pelo domínio do e-mail. Só os provedores com endereço web conhecido. */
function inboxOf(email: string): { label: string; href: string } | null {
  const d = email.split('@')[1]?.toLowerCase() || '';
  if (/^(gmail|googlemail)\.com$/.test(d)) return { label: 'Abrir o Gmail', href: 'https://mail.google.com/mail/u/0/#search/disorder' };
  if (/^(outlook|hotmail|live|msn)\.(com|com\.br)$/.test(d)) return { label: 'Abrir o Outlook', href: 'https://outlook.live.com/mail/0/' };
  if (/^(icloud|me|mac)\.com$/.test(d)) return { label: 'Abrir o iCloud Mail', href: 'https://www.icloud.com/mail' };
  if (/^yahoo\.(com|com\.br)$/.test(d)) return { label: 'Abrir o Yahoo Mail', href: 'https://mail.yahoo.com' };
  return null;
}
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** Campo de senha com Mostrar e Esconder. */
export function PasswordField({ id, label, value, onChange, autoComplete, err, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; err?: boolean; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="f" htmlFor={id}>{label}
      <span className="inw pw">
        <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} required minLength={autoComplete === 'new-password' ? MIN : undefined} value={value}
          aria-invalid={err || undefined} aria-describedby={hint ? id + '-h' : undefined} onChange={e => onChange(e.target.value)} />
        <button type="button" className="pw-t" aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'Esconder' : 'Mostrar'}</button>
      </span>
      {hint && <span className="f-h" id={id + '-h'}>{hint}</span>}
    </label>
  );
}

/** Entrar, criar conta e esqueci a senha, com e-mail e senha. */
export function Login() {
  const [mode, setMode] = useState<Mode>('entrar');
  const [email, setEmail] = useState(''), [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [unconfirmed, setUnconfirmed] = useState(false);
  const [sent, setSent] = useState<Sent>(null), [note, setNote] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  // Ao trocar de tela, o foco vai para o título (leitor de tela anuncia). Não na primeira abertura.
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } title.current?.focus(); }, [mode, sent]);

  const go = (m: Mode) => { setMode(m); setErr(''); setUnconfirmed(false); setNote(''); };
  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!validEmail(e)) { setErr('Confira o e-mail.'); return; }
    if (mode !== 'esqueci' && !pw) { setErr('Digite a senha.'); return; }
    if (mode === 'criar' && pw.length < MIN) { setErr('A senha precisa de pelo menos ' + MIN + ' caracteres.'); return; }
    setBusy(true); setErr(''); setUnconfirmed(false);
    const r = mode === 'entrar' ? await signIn(e, pw) : mode === 'criar' ? await signUp(e, pw) : await sendReset(e);
    setBusy(false);
    if (!r.ok) { setErr(r.msg); setUnconfirmed(!!r.unconfirmed); return; }
    if (mode === 'esqueci') setSent({ kind: 'reset', email: e });
    else if (mode === 'criar' && r.confirm) setSent({ kind: 'confirm', email: e });
    // Entrou: a página recarrega sozinha ao receber a sessão.
  };
  const resend = async (to: string) => {
    setBusy(true); setNote('');
    const r = await resendConfirm(to);
    setBusy(false);
    setNote(r.ok ? 'Mandamos de novo. Pode levar até 1 minuto.' : r.msg);
  };

  if (sent) {
    const inbox = inboxOf(sent.email);
    return (
      <>
        <Brand />
        <main className="login">
          <section className="sent" aria-labelledby="sent-t">
            <span className="sent-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></svg></span>
            <h1 id="sent-t" ref={title} tabIndex={-1}>Confira seu e-mail</h1>
            <p className="lead">
              {sent.kind === 'confirm'
                ? <>Mandamos um link para <b>{sent.email}</b>. Toque nele para confirmar a conta e depois entre com a sua senha.</>
                : <>Mandamos um link para <b>{sent.email}</b>. Toque nele para criar a senha nova.</>}
            </p>
            {inbox && <a className="btn primary" href={inbox.href} target="_blank" rel="noopener noreferrer">{inbox.label}</a>}
            <ul className="sent-tips">
              <li>Pode levar até 1 minuto para chegar.</li>
              <li>Não achou? Procure em Spam ou Promoções, pelo remetente do disorder.</li>
            </ul>
            <div className="sent-acts">
              {sent.kind === 'confirm' && <button type="button" className="btn outline sm" disabled={busy} onClick={() => void resend(sent.email)}>Mandar de novo</button>}
              <button type="button" className="lnk" onClick={() => { setSent(null); go('entrar'); }}>Voltar para entrar</button>
            </div>
            {note && <p className="msg" role="status">{note}</p>}
          </section>
        </main>
      </>
    );
  }

  const T = { entrar: ['Entrar', 'Entre com seu e-mail e senha.', 'Entrar'], criar: ['Criar conta', 'Seus links ficam salvos na sua conta e aparecem em todos os seus aparelhos.', 'Criar conta'], esqueci: ['Esqueci a senha', 'Mandamos um link para você criar uma senha nova. Serve também para quem entrava só com link por e-mail.', 'Mandar link'] }[mode];
  return (
    <>
      <Brand />
      <main className="login">
        {mode !== 'esqueci' && (
          <div className="seg txt login-tabs" role="group" aria-label="Entrar ou criar conta">
            <button type="button" aria-pressed={mode === 'entrar'} onClick={() => go('entrar')}>Entrar</button>
            <button type="button" aria-pressed={mode === 'criar'} onClick={() => go('criar')}>Criar conta</button>
          </div>
        )}
        <h1 ref={title} tabIndex={-1} className={mode === 'esqueci' ? '' : 'sr'}>{T[0]}</h1>
        <p className="lead">{T[1]}</p>
        <form onSubmit={e => { e.preventDefault(); void submit(); }} noValidate>
          <label className="f">E-mail
            <span className="inw"><input type="email" id="login-email" autoComplete={mode === 'criar' ? 'email' : 'username'} inputMode="email" autoCapitalize="off" spellCheck={false} required placeholder="voce@email.com" value={email}
              aria-invalid={!!err || undefined} aria-describedby={err ? 'login-err' : undefined} onChange={e => { setEmail(e.target.value); setErr(''); }} /></span>
          </label>
          {mode !== 'esqueci' && (
            <PasswordField id="login-pw" label="Senha" value={pw} onChange={v => { setPw(v); setErr(''); }} autoComplete={mode === 'criar' ? 'new-password' : 'current-password'} err={!!err}
              hint={mode === 'criar' ? 'Pelo menos ' + MIN + ' caracteres.' : undefined} />
          )}
          {err && <p className="msg err" id="login-err" role="alert">{err}</p>}
          {unconfirmed && <button type="button" className="lnk" disabled={busy} onClick={() => void resend(email.trim().toLowerCase())}>Mandar o link de confirmação de novo</button>}
          {note && <p className="msg" role="status">{note}</p>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Aguarde' : T[2]}</button>
        </form>
        {mode === 'entrar' && <button type="button" className="lnk" onClick={() => go('esqueci')}>Esqueci a senha</button>}
        {mode === 'esqueci' && <button type="button" className="lnk" onClick={() => go('entrar')}>Voltar para entrar</button>}
      </main>
    </>
  );
}
