import { useEffect, useRef } from 'react';
import { usePullReveal } from '../hooks/usePullReveal';
import { useStore } from '../store';
import { dismissToast } from '../actions';

export function Brand() {
  const ref = useRef<HTMLDivElement>(null);
  usePullReveal(ref);
  return <div className="brand" ref={ref} role="img" aria-label="disorder"><b aria-hidden="true">disorder</b></div>;
}

export function Toast() {
  const t = useStore(s => s.toast);
  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(dismissToast, 6500);
    return () => clearTimeout(timer);
  }, [t]);
  return (
    <div className="toast" id="toast" role="status" aria-live="polite" hidden={!t}>
      {t && <span>{t.text}</span>}
      {t?.label && <button type="button" onClick={() => { dismissToast(); t.fn?.(); }}>{t.label}</button>}
    </div>
  );
}

export function LoadError() {
  const err = useStore(s => s.loadError);
  return <div id="banner">{err && <div className="banner" role="alert">Não consegui carregar seus links agora. Feche e abra o disorder de novo em alguns instantes.</div>}</div>;
}
