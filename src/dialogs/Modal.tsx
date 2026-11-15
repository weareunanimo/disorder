import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

interface Props {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  /** Renderiza o conteúdo como <form>, usado pelo diálogo de salvar. */
  form?: { className: string; onSubmit: () => void };
}

const FOCUSABLE = 'button, input, select, textarea, a[href]';

/** Camada de diálogo: prende o Tab dentro, foca o primeiro campo ao abrir e devolve o foco ao fechar. */
export function Modal({ labelledBy, onClose, children, form }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const el = root.current;
    const first = el?.querySelector<HTMLElement>('input[type=text], input[type=email]') || el?.querySelector<HTMLElement>('button.destructive') || el?.querySelector<HTMLElement>('button');
    first?.focus();
    return () => { if (before && document.contains(before)) before.focus(); };
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !root.current) return;
    const els = Array.from(root.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(x => !(x as HTMLButtonElement).disabled && x.offsetParent !== null);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const attrs = { role: 'dialog', 'aria-modal': true, 'aria-labelledby': labelledBy } as const;
  return (
    <div className="overlay" ref={root} onKeyDown={onKeyDown} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      {form
        ? <form className={form.className} {...attrs} noValidate onSubmit={e => { e.preventDefault(); form.onSubmit(); }}>{children}</form>
        : <div className="modal" {...attrs}>{children}</div>}
    </div>
  );
}
