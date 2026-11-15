import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { set, useStore } from '../store';
import { archiveSelected, bulkMove, clearSel, openModal, pruneSel, selectAll } from '../actions';
import { colorOf } from '../lib/folders';
import { useSortedFolders, useVisible } from '../hooks/useVisible';
import { IcoArchive, IcoChevron, IcoMove, IcoRestore, IcoTrash, IcoX } from './icons';

export function SelectionBar() {
  const sel = useStore(s => s.sel), menu = useStore(s => s.menu), arch = useStore(s => s.view === 'archived');
  const links = useStore(s => s.links);
  const visible = useVisible(), folders = useSortedFolders();
  const bar = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);

  // Link que saiu da tela (filtro, outra pasta, arquivado) sai da seleção.
  useEffect(() => { pruneSel(); }, [visible]);
  useEffect(() => {
    if (!menu) return;
    bar.current?.querySelector<HTMLElement>('.mi:not([aria-disabled="true"])')?.focus();
    const out = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.menu,[data-move]')) set({ menu: false }); };
    document.addEventListener('click', out);
    return () => document.removeEventListener('click', out);
  }, [menu]);

  const n = sel.length;
  if (!n) return null;
  const picked = new Set(sel), items = links.filter(l => picked.has(l.id));
  const same = (id: string | null) => items.every(l => (l.pastaId || null) === id);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!menu || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    const its = Array.from(bar.current!.querySelectorAll<HTMLElement>('.mi:not([aria-disabled="true"])'));
    if (!its.length) return;
    e.preventDefault();
    const i = its.indexOf(document.activeElement as HTMLElement);
    its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length].focus();
  };
  const mi = (id: string | null, label: ReactNode) => (
    <button key={id ?? 'none'} type="button" className="mi" role="menuitem" aria-disabled={same(id) || undefined} onClick={() => { if (!same(id)) bulkMove(id); }}>
      {label}{same(id) && <span className="cur">já está aqui</span>}
    </button>
  );

  return (
    <div className="bar" id="bar" role="toolbar" aria-label="Ações para os links selecionados" ref={bar} onKeyDown={onKeyDown}>
      <button type="button" className="x" aria-label="Limpar seleção" title="Limpar seleção (Esc)" onClick={clearSel}><IcoX /></button>
      <span className="n" aria-live="polite">{n}<span className="long">{n === 1 ? ' selecionado' : ' selecionados'}</span></span>
      {n < visible.length && (
        <button type="button" onClick={selectAll}><span className="long">Selecionar todos ({visible.length})</span><span className="short">Todos</span></button>
      )}
      <span className="sep" aria-hidden="true" />
      {arch ? (
        <>
          <button type="button" onClick={() => archiveSelected(false)}><IcoRestore />Restaurar</button>
          <button type="button" className="warn" onClick={() => openModal({ kind: 'purge', ids: sel.slice() })}><IcoTrash /><span className="long">Excluir de vez</span><span className="short">Excluir</span></button>
        </>
      ) : (
        <>
          <button type="button" data-move ref={trigger} aria-haspopup="menu" aria-expanded={menu} onClick={() => set({ menu: !menu })}><IcoMove />Mover<IcoChevron /></button>
          <button type="button" className="strong" onClick={() => archiveSelected(true)}><IcoArchive />Arquivar</button>
          {menu && (
            <div className="menu" role="menu" aria-label="Mover para">
              <div className="mh">Mover para</div>
              {mi(null, 'Sem pasta')}
              {folders.map(f => mi(f.id, <span className="tag" data-c={colorOf(f)}>{f.nome}</span>))}
              <button type="button" className="mi" role="menuitem" onClick={() => { set({ menu: false }); openModal({ kind: 'new', then: { type: 'move-many' } }); }}>+ Nova pasta…</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
