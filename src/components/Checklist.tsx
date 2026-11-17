import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Link, ListItem } from '../types';
import { patchItem } from '../actions';
import { listStats, newItem, ordered } from '../lib/notes';
import { IcoCheck, IcoX } from './icons';

/**
 * Lista com checkbox de um link ou nota. Enter cria o próximo item, apagar um item vazio volta para o anterior.
 * Feitos vão para o fim e ficam riscados. Tudo grava sozinho.
 */
export function Checklist({ link: l, autoFocus }: { link: Link; autoFocus?: boolean }) {
  const items = l.lista || [];
  const refs = useRef(new Map<string, HTMLInputElement>());
  const [focus, setFocus] = useState<string | null>(autoFocus ? items[0]?.id ?? null : null);
  useEffect(() => {
    if (!focus) return;
    const el = refs.current.get(focus);
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); setFocus(null); }
  }, [focus, items]);

  const put = (lista: ListItem[]) => patchItem(l.id, { lista });
  const edit = (id: string, p: Partial<ListItem>) => put(items.map(i => (i.id === id ? { ...i, ...p } : i)));
  const addAfter = (id: string | null) => {
    const n = newItem();
    const at = id ? items.findIndex(i => i.id === id) + 1 : items.length;
    put([...items.slice(0, at), n, ...items.slice(at)]);
    setFocus(n.id);
  };
  const remove = (id: string) => {
    const view = ordered(items), i = view.findIndex(x => x.id === id);
    put(items.filter(x => x.id !== id));
    setFocus(view[i - 1]?.id ?? view[i + 1]?.id ?? null);
  };
  const onKey = (it: ListItem) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); if (it.t.trim()) addAfter(it.id); }
    else if (e.key === 'Backspace' && !it.t && items.length > 1) { e.preventDefault(); remove(it.id); }
  };
  const { total, done } = listStats(l);

  return (
    <div className="ck" role="group" aria-label="Lista">
      {total > 0 && <p className="ck-n" aria-live="polite">{done} de {total} feitos</p>}
      <ul className="ck-list">
        {ordered(items).map(it => (
          <li key={it.id} className={'ck-it' + (it.ok ? ' ok' : '')}>
            <button type="button" className="ck-box" role="checkbox" aria-checked={it.ok} aria-label={(it.ok ? 'Desmarcar ' : 'Marcar ') + (it.t || 'item')}
              onClick={() => edit(it.id, { ok: !it.ok })}>{it.ok && <IcoCheck />}</button>
            <input ref={el => { if (el) refs.current.set(it.id, el); else refs.current.delete(it.id); }} className="ck-t" value={it.t} placeholder="Item"
              aria-label="Item da lista" enterKeyHint="next" maxLength={500} onChange={e => edit(it.id, { t: e.target.value })} onKeyDown={onKey(it)} />
            <button type="button" className="ck-del" aria-label={'Tirar ' + (it.t || 'item')} title="Tirar da lista" onClick={() => remove(it.id)}><IcoX /></button>
          </li>
        ))}
      </ul>
      <button type="button" className="lv-tagbtn ck-add" onClick={() => addAfter(null)}>+ Item</button>
    </div>
  );
}

/** Prévia da lista no cartão: os primeiros itens a fazer e a contagem. Só leitura, o cartão inteiro abre o item. */
export function ListPeek({ link: l, max = 4 }: { link: Link; max?: number }) {
  const items = ordered((l.lista || []).filter(i => i.t.trim()));
  if (!items.length) return null;
  const { total, done } = listStats(l);
  return (
    <span className="peek">
      {items.slice(0, max).map(i => (
        <span key={i.id} className={'peek-it' + (i.ok ? ' ok' : '')}><span className="peek-box" aria-hidden="true">{i.ok && <IcoCheck />}</span><span className="peek-t">{i.t}</span></span>
      ))}
      <span className="peek-n">{done} de {total} feitos</span>
    </span>
  );
}
