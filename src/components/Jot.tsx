import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import type { Link } from '../types';
import { patchItem } from '../actions';
import { isArch } from '../lib/filters';
import { newItem, noteTitle } from '../lib/notes';
import { tagsOf } from '../lib/tags';
import { IcoChecklist, IcoNote } from './icons';

type Mode = 'item' | 'nota';
const KEY = 'disorder.jot';
/** Último destino escolhido por tag, neste aparelho: { [tagId]: noteId } */
function remembered(): Record<string, string> { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
function remember(tag: string | undefined, dest: string) {
  if (!tag) return;
  try { const r = remembered(); if (dest) r[tag] = dest; else delete r[tag]; localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* sem armazenamento */ }
}

/**
 * Anotar enquanto vê: campo fixo na janela do link. Enter adiciona um item com caixinha (ou uma linha de nota)
 * neste link ou numa nota das mesmas tags, como a lista de compras do assunto.
 */
export function Jot({ link: l }: { link: Link }) {
  const links = useStore(s => s.links);
  const tags = tagsOf(l);
  // Notas que dividem alguma tag com este link: destinos possíveis além do próprio link.
  const dests = useMemo(() => links.filter(x => !x.url && !isArch(x) && x.id !== l.id && tagsOf(x).some(t => tags.includes(t)))
    .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0)), [links, l.id, tags.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [dest, setDest] = useState(() => { const d = remembered()[tags[0]]; return d && dests.some(x => x.id === d) ? d : ''; });
  const [mode, setMode] = useState<Mode>('item');
  const [txt, setTxt] = useState(''), [done, setDone] = useState('');
  const input = useRef<HTMLInputElement>(null);
  // Destino que sumiu (excluído ou arquivado): volta para este link.
  useEffect(() => { if (dest && !dests.some(x => x.id === dest)) setDest(''); }, [dest, dests]);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(''), 2500); return () => clearTimeout(t); }, [done]);

  const add = () => {
    const t = txt.trim();
    if (!t) return;
    const target = dest ? links.find(x => x.id === dest) : l;
    if (!target) return;
    if (mode === 'item') patchItem(target.id, { lista: [...(target.lista || []).filter(i => i.t.trim()), newItem(t)] });
    else patchItem(target.id, { nota: target.nota.trim() ? target.nota.replace(/\s+$/, '') + '\n' + t : t });
    setTxt('');
    setDone(dest ? 'Adicionado em ' + noteTitle(target) : mode === 'item' ? 'Item adicionado' : 'Nota adicionada');
    input.current?.focus();
  };

  return (
    <form className="jot" onSubmit={e => { e.preventDefault(); add(); }} aria-label="Anotar">
      <div className="jot-row">
        <div className="seg jot-mode" role="group" aria-label="Tipo de anotação">
          <button type="button" aria-pressed={mode === 'item'} aria-label="Item com caixinha" title="Item com caixinha" onClick={() => { setMode('item'); input.current?.focus(); }}><IcoChecklist /></button>
          <button type="button" aria-pressed={mode === 'nota'} aria-label="Linha de nota" title="Linha de nota" onClick={() => { setMode('nota'); input.current?.focus(); }}><IcoNote /></button>
        </div>
        <span className="inw jot-in"><input ref={input} type="text" value={txt} maxLength={500} enterKeyHint="send" autoComplete="off"
          placeholder={mode === 'item' ? 'Anotar um item' : 'Anotar'} aria-label={mode === 'item' ? 'Anotar um item com caixinha' : 'Anotar uma linha de nota'}
          onChange={e => setTxt(e.target.value)} /></span>
        <button type="submit" className="btn primary sm" disabled={!txt.trim()}>Adicionar</button>
      </div>
      <div className="jot-sub">
        <label className="jot-dest">Em
          <select value={dest} onChange={e => { setDest(e.target.value); remember(tags[0], e.target.value); }}>
            <option value="">este link</option>
            {dests.map(d => <option key={d.id} value={d.id}>{noteTitle(d)}</option>)}
          </select>
        </label>
        <span className="jot-ok" role="status" aria-live="polite">{done}</span>
      </div>
    </form>
  );
}
