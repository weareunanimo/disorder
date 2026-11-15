import { useStore } from '../store';
import { go, openModal } from '../actions';
import { FIXED_VIEWS, folderExists, viewTitle } from '../lib/filters';
import { IcoBack, IcoEdit, IcoGear } from './icons';

export function Head() {
  const view = useStore(s => s.view), prev = useStore(s => s.prevView), folders = useStore(s => s.folders);
  const folder = FIXED_VIEWS.includes(view) ? null : folders.find(f => f.id === view) ?? null;
  const back = prev && (['all', 'none', 'archived'].includes(prev) || folderExists(folders, prev)) ? prev : 'all';
  return (
    <div className="head" id="head">
      <div className="ht">
        <div className="tl">
          <h1 id="view-title">{viewTitle(view, folders)}</h1>
          {folder && (
            <button className="btn icon ghost" aria-label={'Editar tag ' + folder.nome} title="Editar tag" onClick={() => openModal({ kind: 'edit', id: folder.id })}><IcoEdit /></button>
          )}
        </div>
      </div>
      <div className="hr">
        {view !== 'settings'
          ? <button className="btn icon ghost set-btn" aria-label="Ajustes" title="Ajustes" onClick={() => go('settings')}><IcoGear /></button>
          : <button className="btn icon ghost set-btn back-btn" aria-label={'Voltar para ' + viewTitle(back, folders)} title="Voltar" onClick={() => go(back)}><IcoBack /></button>}
      </div>
    </div>
  );
}
