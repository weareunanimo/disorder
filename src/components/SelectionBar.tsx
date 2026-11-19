import { byName } from '../lib/folders';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { set, useStore } from '../store';
import { archiveSelected, bulkClearTags, bulkTag, clearSel, openModal, pruneSel, selectAll } from '../actions';
import { colorOf, shapeOf } from '../lib/folders';
import { hasTag, tagsOf } from '../lib/tags';
import { useSortedFolders, useVisible } from '../hooks/useVisible';
import { IcoArchive, IcoChevron, IcoMove, IcoRestore, IcoTrash, IcoX } from './icons';

export function SelectionBar() {
  const sel = useStore(s => s.sel), menu = useStore(s => s.menu), arch = useStore(s => s.view === 'archived');
  const links = useStore(s => s.links);
  const visible = useVisible(), folders = byName(useSortedFolders());
  const bar = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);

  // Link que saiu da tela (filtro, outra tag, arquivado) sai da seleção.
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
  const state = (id: string): 'true' | 'false' | 'mixed' => {
    const n = items.filter(l => hasTag(l, id)).length;
    return n === 0 ? 'false' : n === items.length ? 'true' : 'mixed';
  };
  const noTags = items.every(l => !tagsOf(l).length);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!menu || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    const its = Array.from(bar.current!.querySelectorAll<HTMLElement>('.mi:not([aria-disabled="true"])'));
    if (!its.length) return;
    e.preventDefault();
    const i = its.indexOf(document.activeElement as HTMLElement);
    its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length].focus();
  };
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
          <button type="button" data-move ref={trigger} aria-haspopup="menu" aria-expanded={menu} aria-label="Tags" onClick={() => set({ menu: !menu })}><IcoMove /><span className="lbl">Tags</span><IcoChevron /></button>
          <button type="button" className="warn" aria-label="Excluir" title="Excluir" onClick={() => openModal({ kind: 'delete', ids: sel.slice() })}><IcoTrash /><span className="lbl">Excluir</span></button>
          <button type="button" className="strong" onClick={() => archiveSelected(true)}><IcoArchive />Arquivar</button>
          {menu && (
            <div className="menu" role="menu" aria-label="Tags dos links selecionados">
              <div className="mh">Tags</div>
              {folders.map(f => {
                const st = state(f.id);
                return (
                  <button key={f.id} type="button" className="mi" role="menuitemcheckbox" aria-checked={st} onClick={() => bulkTag(f.id)}>
                    <span className="ck" aria-hidden="true" />
                    <span className="tag" data-c={colorOf(f)} data-s={shapeOf(f)}>{f.nome}</span>
                  </button>
                );
              })}
              <button type="button" className="mi" role="menuitem" aria-disabled={noTags || undefined} onClick={() => { if (!noTags) bulkClearTags(); }}>Tirar todas as tags{noTags && <span className="cur">nenhuma</span>}</button>
              <button type="button" className="mi" role="menuitem" onClick={() => { set({ menu: false }); openModal({ kind: 'new', then: { type: 'move-many' } }); }}>+ Nova tag</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
