import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { acceptClip, currentDest, dismissClip, dismissToast, folderById, openAdd } from '../actions';
import { usePullReveal } from '../hooks/usePullReveal';
import { IcoPlus } from './icons';

export function Brand() {
  const ref = useRef<HTMLDivElement>(null);
  usePullReveal(ref);
  return <div className="brand" ref={ref} role="banner" aria-label="disorder"><b aria-hidden="true">disorder</b></div>;
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

/** Faixa "encontrei um link copiado". */
export function ClipBanner() {
  const clip = useStore(s => s.clip), view = useStore(s => s.view);
  useStore(s => s.folders);
  if (!clip) return null;
  const fo = folderById(currentDest());
  return (
    <div className="banner inline clip" id="clip" role="status">
      <span>Encontrei um link copiado.</span>
      <span className="acts">
        <button type="button" className="btn outline sm" onClick={dismissClip}>Agora não</button>
        <button type="button" className="btn primary sm" onClick={acceptClip}>{view === 'all' ? 'Salvar' : 'Salvar em ' + (fo ? fo.nome : 'Sem pasta')}</button>
      </span>
    </div>
  );
}

export const Fab = () => <button type="button" className="fab" aria-label="Salvar link" onClick={() => openAdd()}><IcoPlus /></button>;

export function LoadError() {
  const err = useStore(s => s.loadError);
  return <div id="banner">{err && <div className="banner" role="alert">Não consegui carregar seus links agora. Feche e abra o disorder de novo em alguns instantes.</div>}</div>;
}
