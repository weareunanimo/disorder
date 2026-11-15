import type { Folder } from '../types';
import { colorOf } from '../lib/folders';
import { withTag, withoutTag } from '../lib/tags';

interface Props { folders: Folder[]; value: string[]; onChange: (ids: string[]) => void; onNew: () => void; label: string; id?: string }

/** Escolha de tags: cada tag é um botão que liga e desliga, e o link pode ter várias. */
export function TagPicker({ folders, value, onChange, onNew, label, id }: Props) {
  return (
    <div className="f tagpick" role="group" aria-labelledby={id}>
      <span className="fl" id={id}>{label}</span>
      <div className="chips">
        {folders.map(f => {
          const on = value.includes(f.id);
          return (
            <button key={f.id} type="button" className="chip tp" data-c={colorOf(f)} aria-pressed={on} onClick={() => onChange(on ? withoutTag(value, f.id) : withTag(value, f.id))}>{on && <span className="ck" aria-hidden="true">✓</span>}{f.nome}</button>
          );
        })}
        <button type="button" className="chip tp-new" onClick={onNew}>+ Nova tag</button>
      </div>
    </div>
  );
}
