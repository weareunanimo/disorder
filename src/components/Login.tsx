import { useEffect, useRef, useState } from 'react';
import { sendLoginLink, verifyLoginCode } from '../data/supabase';
import { Brand } from './Bits';

const KEY = 'disorder.login.sent';
const WAIT = 60;

/** Atalho para a caixa de entrada, pelo domínio do e-mail. Só os provedores com endereço web conhecido. */
function inboxOf(email: string): { label: string; href: string } | null {
  const d = email.split('@')[1]?.toLowerCase() || '';
  if (/^(gmail|googlemail)\.com$/.test(d)) return { label: 'Abrir o Gmail', href: 'https://mail.google.com/mail/u/0/#search/disorder' };
  if (/^(outlook|hotmail|live|msn)\.(com|com\.br)$/.test(d)) return { label: 'Abrir o Outlook', href: 'https://outlook.live.com/mail/0/' };
  if (/^(icloud|me|mac)\.com$/.test(d)) return { label: 'Abrir o iCloud Mail', href: 'https://www.icloud.com/mail' };
  if (/^yahoo\.(com|com\.br)$/.test(d)) return { label: 'Abrir o Yahoo Mail', href: 'https://mail.yahoo.com' };
  return null;
}

function readSent(): { email: string; at: number } | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && Date.now() - v.at < 15 * 60e3 ? v : null; } catch { return null; }
}

export function Login() {
  const saved = readSent();
  const [email, setEmail] = useState(saved?.email || ''), [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ email: string; at: number } | null>(saved);
  const [err, setErr] = useState(''), [code, setCode] = useState(''), [codeErr, setCodeErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sent) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sent]);

  const send = async (to: string) => {
    if (!to || busy) return;
    setBusy(true); setErr('');
    const ok = await sendLoginLink(to);
    setBusy(false);
    if (!ok) { setErr('Não consegui enviar. Confira se o e-mail está certo e tente de novo em alguns segundos.'); return; }
    const s = { email: to, at: Date.now() };
    setSent(s); setNow(Date.now());
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sem armazenamento */ }
  };
  const verify = async () => {
    const t = code.replace(/\D/g, '');
    if (t.length !== 6 || !sent || busy) { setCodeErr('O código tem 6 números.'); return; }
    setBusy(true); setCodeErr('');
    const ok = await verifyLoginCode(sent.email, t);
    setBusy(false);
    if (!ok) { setCodeErr('Código errado ou vencido. Peça um novo e use o mais recente.'); codeRef.current?.select(); return; }
    try { localStorage.removeItem(KEY); } catch { /* sem armazenamento */ }
  };
  const left = sent ? Math.max(0, WAIT - Math.floor((now - sent.at) / 1000)) : 0;
  const inbox = sent ? inboxOf(sent.email) : null;

  return (
    <>
      <Brand />
      <main className="login">
        {!sent ? (
          <>
            <h1>Entrar</h1>
            <p className="lead">Digite seu e-mail. Mandamos um link de acesso, sem senha.</p>
            <form onSubmit={e => { e.preventDefault(); void send(email.trim()); }} noValidate>
              <label className="f">E-mail
                <span className="inw"><input type="email" id="login-email" autoComplete="email" inputMode="email" required placeholder="voce@email.com" value={email}
                  aria-invalid={!!err || undefined} aria-describedby={err ? 'login-err' : undefined} onChange={e => { setEmail(e.target.value); setErr(''); }} /></span>
              </label>
              {err && <p className="msg err" id="login-err" role="alert">{err}</p>}
              <button className="btn primary" type="submit" disabled={busy || !email.trim()}>{busy ? 'Enviando' : 'Enviar link de acesso'}</button>
            </form>
          </>
        ) : (
          <section className="sent" aria-labelledby="sent-t">
            <span className="sent-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></svg></span>
            <h1 id="sent-t" tabIndex={-1}>Confira seu e-mail</h1>
            <p className="lead">Mandamos um link de acesso para <b>{sent.email}</b>. Toque nele para entrar.</p>
            {inbox && <a className="btn primary" href={inbox.href} target="_blank" rel="noopener noreferrer">{inbox.label}</a>}
            <form className="code" onSubmit={e => { e.preventDefault(); void verify(); }} noValidate>
              <label className="f" htmlFor="login-code">Está no app instalado? Digite o código de 6 números do e-mail</label>
              <span className="code-row">
                <span className="inw"><input ref={codeRef} id="login-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code}
                  aria-invalid={!!codeErr || undefined} aria-describedby={codeErr ? 'code-err' : undefined} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setCodeErr(''); }} /></span>
                <button className="btn outline" type="submit" disabled={busy || code.length !== 6}>Entrar</button>
              </span>
              {codeErr && <p className="msg err" id="code-err" role="alert">{codeErr}</p>}
            </form>
            <ul className="sent-tips">
              <li>Pode levar até 1 minuto para chegar.</li>
              <li>Não achou? Procure em Spam ou Promoções, pelo remetente do disorder.</li>
              <li>Abra o link no mesmo aparelho e navegador em que pediu.</li>
            </ul>
            <div className="sent-acts">
              <button type="button" className="btn outline sm" disabled={left > 0 || busy} onClick={() => void send(sent.email)}>{left > 0 ? 'Reenviar em ' + left + 's' : busy ? 'Enviando…' : 'Reenviar link'}</button>
              <button type="button" className="lnk" onClick={() => { setSent(null); setCode(''); setCodeErr(''); try { localStorage.removeItem(KEY); } catch { /* */ } }}>Usar outro e-mail</button>
            </div>
            <p className="sr" role="status" aria-live="polite">{left === 0 ? 'Você já pode reenviar o link.' : ''}</p>
          </section>
        )}
      </main>
    </>
  );
}
