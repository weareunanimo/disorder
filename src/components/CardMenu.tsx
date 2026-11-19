import { byName } from '../lib/folders';
import { noteText } from '../dialogs/LinkView';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { openLink, openModal, setArchived, setCardMenu, toast, toggleLinkTag, toggleSel } from '../actions';
import type { Link } from '../types';
import { useSortedFolders } from '../hooks/useVisible';
import { colorOf, shapeOf } from '../lib/folders';
import { tagsOf } from '../lib/tags';
import { isTouch } from '../hooks/useMedia';
import { IcoArchive, IcoCheck, IcoCopy, IcoEdit, IcoMore, IcoOpen, IcoRestore, IcoTag, IcoTrash, IcoWhats } from './icons';

function copy(url: string) {
  (navigator.clipboard?.writeText ? navigator.clipboard.writeText(url) : Promise.reject())
    .then(() => toast('Link copiado.'))
    .catch(() => toast('Não consegui copiar. Abra o link e copie pelo endereço.'));
}

interface Props { link: Link; titulo: string; arq: boolean; hideTrigger?: boolean; anchor?: RefObject<HTMLElement | null> }

/**
 * Menu de ações do cartão. No mouse abre solto, junto ao botão de três pontos.
 * Em tela de toque abre como folha presa na base da tela, com alvos de 48px.
 * Tem duas telas: as ações e a lista de tags, para marcar e desmarcar com um toque.
 */
export function CardMenu({ link: l, titulo, arq, hideTrigger, anchor }: Props) {
  const open = useStore(s => s.cardMenu === l.id), startTags = useStore(s => s.cardMenuTags);
  const folders = byName(useSortedFolders());
  const btn = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null);
  const [tags, setTags] = useState(false);
  const sheet = open && isTouch();

  useEffect(() => { if (open) setTags(startTags); }, [open, startTags]);

  // Posição junto ao botão (ou à âncora): abaixo, ou acima se não couber, alinhada à direita.
  useLayoutEffect(() => {
    if (!open || sheet) { setPos(null); return; }
    const a = anchor?.current || btn.current;
    if (!a) return;
    const r = a.getBoundingClientRect(), h = menu.current?.offsetHeight || 240;
    const up = r.bottom + h + 12 > window.innerHeight && r.top > h + 12;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, right: Math.max(8, window.innerWidth - r.right), up });
  }, [open, sheet, tags, anchor]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus({ preventScroll: true });
  }, [open, tags]);

  useEffect(() => {
    if (!open) return;
    const close = () => setCardMenu(null);
    const out = (e: Event) => { const t = e.target as HTMLElement; if (!t.closest?.('.cmenu') && !t.closest?.('[data-cmenu="' + l.id + '"]')) close(); };
    document.addEventListener('pointerdown', out, true);
    window.addEventListener('resize', close);
    if (!sheet) window.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('pointerdown', out, true); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [open, l.id, sheet]);

  const run = (fn: () => void) => () => { setCardMenu(null); fn(); };
  const onKeyDown = (e: KeyboardEvent) => {
    const its = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') || []);
    const i = its.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); its[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); its[its.length - 1]?.focus(); }
    else if (e.key === 'Escape') { e.stopPropagation(); if (tags && !startTags) setTags(false); else { setCardMenu(null); btn.current?.focus(); } }
    else if (e.key === 'Tab') setCardMenu(null);
  };
  const mine = tagsOf(l);

  const body = tags ? (
    <>
      <div className="cm-h">{!startTags && <button type="button" className="cm-back" aria-label="Voltar" onClick={() => setTags(false)}>‹</button>}<span>Tags</span></div>
      {folders.length === 0 && <p className="cm-empty">Você ainda não tem tags.</p>}
      {folders.map(f => {
        const on = mine.includes(f.id);
        return (
          <button key={f.id} type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => toggleLinkTag(l.id, f.id)}>
            <span className="cm-ck" aria-hidden="true">{on && <IcoCheck />}</span><span className="tag" data-c={colorOf(f)} data-s={shapeOf(f)}>{f.nome}</span>
          </button>
        );
      })}
      <button type="button" role="menuitem" onClick={run(() => (l.url ? openModal({ kind: 'link', id: l.id }) : openLink(l.id)))}><IcoEdit />Nova tag ou editar</button>
    </>
  ) : (
    <>
      {sheet && <div className="cm-h"><span title={titulo}>{titulo}</span></div>}
      <button type="button" role="menuitem" onClick={run(() => openLink(l.id))}><IcoOpen />Abrir</button>
      <button type="button" role="menuitem" onClick={run(() => copy(l.url || noteText(l)))}><IcoCopy />{l.url ? 'Copiar link' : 'Copiar texto'}</button>
      <a role="menuitem" href={'https://wa.me/?text=' + encodeURIComponent(l.url ? titulo + '\n' + l.url : noteText(l))} target="_blank" rel="noopener noreferrer" onClick={() => setCardMenu(null)}><IcoWhats />Compartilhar no WhatsApp</a>
      <button type="button" role="menuitem" onClick={() => setTags(true)}><IcoTag />Tags{mine.length ? <span className="cm-n">{mine.length}</span> : null}</button>
      <button type="button" role="menuitem" onClick={run(() => (l.url ? openModal({ kind: 'link', id: l.id }) : openLink(l.id)))}><IcoEdit />Editar</button>
      {sheet && <button type="button" role="menuitem" onClick={run(() => toggleSel(l.id, false))}><IcoCheck />Selecionar</button>}
      <button type="button" role="menuitem" onClick={run(() => setArchived([l], arq))}>{arq ? <IcoRestore /> : <IcoArchive />}{arq ? 'Restaurar' : 'Arquivar'}</button>
      <button type="button" role="menuitem" className="danger" onClick={run(() => openModal({ kind: 'delete', ids: [l.id] }))}><IcoTrash />Excluir</button>
    </>
  );

  return (
    <>
      <button ref={btn} type="button" className={'btn outline sm icon' + (hideTrigger ? ' cm-hidden' : '')} data-cmenu={l.id} aria-haspopup="menu" aria-expanded={open}
        aria-label="Mais ações" title="Mais ações" tabIndex={hideTrigger ? -1 : undefined} onClick={() => setCardMenu(open ? null : l.id)}><IcoMore /></button>
      {open && createPortal(
        <>
          {sheet && <div className="cmenu-bd" aria-hidden="true" />}
          <div ref={menu} className={'cmenu' + (sheet ? ' sheet' : '')} role="menu" aria-label={(tags ? 'Tags de ' : 'Ações de ') + titulo} onKeyDown={onKeyDown}
            style={sheet ? undefined : { top: pos?.top ?? -999, right: pos?.right ?? 8, transform: pos?.up ? 'translateY(-100%)' : undefined, visibility: pos ? 'visible' : 'hidden' }}>
            {body}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
