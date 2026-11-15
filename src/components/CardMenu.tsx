import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { deleteLink, openModal, setArchived, setCardMenu, toast } from '../actions';
import type { Link } from '../types';
import { IcoArchive, IcoCopy, IcoEdit, IcoMore, IcoRestore, IcoTrash, IcoWhats } from './icons';

function copy(url: string) {
  (navigator.clipboard?.writeText ? navigator.clipboard.writeText(url) : Promise.reject())
    .then(() => toast('Link copiado.'))
    .catch(() => toast('Não consegui copiar. Abra o link e copie pelo endereço.'));
}

/** Menu de três pontos do cartão: copiar, compartilhar, editar, arquivar e excluir. Abre solto na página, para não ser cortado pelo cartão. */
export function CardMenu({ link: l, titulo, arq }: { link: Link; titulo: string; arq: boolean }) {
  const open = useStore(s => s.cardMenu === l.id);
  const btn = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null);

  // Posição junto ao botão: abaixo, ou acima se não couber, sempre alinhada à direita dele.
  useLayoutEffect(() => {
    if (!open || !btn.current) { setPos(null); return; }
    const r = btn.current.getBoundingClientRect(), h = menu.current?.offsetHeight || 220;
    const up = r.bottom + h + 12 > window.innerHeight && r.top > h + 12;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, right: Math.max(8, window.innerWidth - r.right), up });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const close = () => setCardMenu(null);
    const out = (e: Event) => { const t = e.target as HTMLElement; if (!t.closest?.('.cmenu') && !t.closest?.('[data-cmenu="' + l.id + '"]')) close(); };
    document.addEventListener('pointerdown', out, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('pointerdown', out, true); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [open, l.id]);

  const run = (fn: () => void) => () => { setCardMenu(null); fn(); };
  const onKeyDown = (e: KeyboardEvent) => {
    const its = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || []);
    const i = its.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); its[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); its[its.length - 1]?.focus(); }
    else if (e.key === 'Escape') { e.stopPropagation(); setCardMenu(null); btn.current?.focus(); }
    else if (e.key === 'Tab') setCardMenu(null);
  };

  return (
    <>
      <button ref={btn} type="button" className="btn outline sm icon" data-cmenu={l.id} aria-haspopup="menu" aria-expanded={open}
        aria-label="Mais ações" title="Mais ações" onClick={() => setCardMenu(open ? null : l.id)}><IcoMore /></button>
      {open && createPortal(
        <div ref={menu} className="cmenu" role="menu" aria-label={'Ações de ' + titulo} onKeyDown={onKeyDown}
          style={{ top: pos?.top ?? -999, right: pos?.right ?? 8, transform: pos?.up ? 'translateY(-100%)' : undefined, visibility: pos ? 'visible' : 'hidden' }}>
          <button type="button" role="menuitem" onClick={run(() => copy(l.url))}><IcoCopy />Copiar link</button>
          <a role="menuitem" href={'https://wa.me/?text=' + encodeURIComponent(titulo + '\n' + l.url)} target="_blank" rel="noopener noreferrer" onClick={() => setCardMenu(null)}><IcoWhats />Compartilhar no WhatsApp</a>
          <button type="button" role="menuitem" onClick={run(() => openModal({ kind: 'link', id: l.id }))}><IcoEdit />Editar</button>
          <button type="button" role="menuitem" onClick={run(() => setArchived([l], arq))}>{arq ? <IcoRestore /> : <IcoArchive />}{arq ? 'Restaurar' : 'Arquivar'}</button>
          <button type="button" role="menuitem" className="danger" onClick={run(() => deleteLink(l.id))}><IcoTrash />Excluir</button>
        </div>,
        document.body,
      )}
    </>
  );
}
