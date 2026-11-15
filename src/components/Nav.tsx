import { useStore } from '../store';
import { createStarter, go, openModal } from '../actions';
import { STARTERS } from '../lib/folders';
import { useCounts, useSortedFolders } from '../hooks/useVisible';

function Item({ view, label, count, cls }: { view: string; label: string; count?: number; cls?: string }) {
  const current = useStore(s => s.view === view);
  return (
    <button className={'nav-btn' + (cls ? ' ' + cls : '')} aria-current={current ? 'true' : undefined} onClick={() => go(view)}>
      <span className="nm">{label}</span>
      {count != null && <span className="ct">{count}</span>}
    </button>
  );
}

export function Nav() {
  const folders = useSortedFolders(), c = useCounts();
  const loaded = useStore(s => s.loaded), inArchived = useStore(s => s.view === 'archived');
  return (
    <aside className="side" aria-label="Tags">
      <nav className="nav" id="nav">
        <Item view="all" label="Todos os links" count={c.total} />
        <Item view="none" label="Sem tag" count={c.none} />
        <div className="nav-h"><span>Tags</span></div>
        {folders.map(f => <Item key={f.id} view={f.id} label={f.nome} count={c.by.get(f.id) || 0} />)}
        <button className="add-folder" onClick={() => openModal({ kind: 'new' })}>+ Nova tag</button>
        {(c.arch > 0 || inArchived) && <Item view="archived" label="Arquivados" count={c.arch} cls="arch" />}
        {loaded && !folders.length && (
          <div className="starter">
            <p>Comece por uma destas:</p>
            {STARTERS.map(n => <button key={n} className="chip" onClick={() => createStarter(n)}>{n}</button>)}
          </div>
        )}
        <Item view="settings" label="Ajustes" cls="set" />
      </nav>
    </aside>
  );
}
