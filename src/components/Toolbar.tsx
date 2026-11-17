import { useWide } from '../hooks/useMedia';
import { useEffect, useMemo, useState } from 'react';
import { set, useStore } from '../store';
import { go, openModal, resetFilters, setLayout, setSort, toggleFolderFilter, toggleKind, togglePlat } from '../actions';
import { SORTS, isSort } from '../lib/sort';
import { KINDS } from '../lib/kinds';
import { datePreset, filterCount, viewTitle } from '../lib/filters';
import { tagsOf } from '../lib/tags';
import { PLAT, PLAT_KEYS } from '../lib/platforms';
import { useBase, useSortedFolders, useTagHits, useVisible } from '../hooks/useVisible';
import { useSearching } from '../hooks/useSearching';
import { plural } from '../lib/text';
import { kindLabel } from '../lib/kinds';
import { IcoBack, IcoCards, IcoEdit, IcoGallery, IcoList, IcoX } from './icons';

function Chip({ label, count, on, onClick }: { label: string; count?: number; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className="chip" aria-pressed={on} onClick={onClick}>
      {label}{count != null && <span className="n">{count}</span>}
    </button>
  );
}

const DATE_OPTS: { k: string; label: string; days?: number }[] = [
  { k: 'any', label: 'Qualquer data' }, { k: 'd1', label: 'Hoje', days: 1 }, { k: 'd7', label: 'Últimos 7 dias', days: 7 },
  { k: 'd30', label: 'Últimos 30 dias', days: 30 }, { k: 'd90', label: 'Últimos 90 dias', days: 90 }, { k: 'year', label: 'Este ano' },
];

/** Grupos de filtro rápido (tags, tipo, origem, data). Ficam no popover da omni-bar. Só aparecem os que existem nos links. */
export function FilterGroups() {
  const view = useStore(s => s.view), plats = useStore(s => s.plats), kinds = useStore(s => s.kinds), fp = useStore(s => s.fp);
  const from = useStore(s => s.from), to = useStore(s => s.to);
  const folders = useSortedFolders(), base = useBase();

  const stats = useMemo(() => {
    const kind = new Map<string, number>(), plat = new Map<string, number>(), folder = new Map<string, number>(), known = new Set(folders.map(f => f.id));
    let none = 0;
    for (const l of base) {
      plat.set(l.plataforma, (plat.get(l.plataforma) || 0) + 1);
      const k = l.categoria || 'none'; kind.set(k, (kind.get(k) || 0) + 1);
      const live = tagsOf(l).filter(id => known.has(id));
      live.forEach(id => folder.set(id, (folder.get(id) || 0) + 1));
      if (!live.length) none++;
    }
    return { kind, plat, folder, none };
  }, [base, folders]);
  const present = PLAT_KEYS.filter(k => stats.plat.get(k));
  const presentKinds = KINDS.filter(k => stats.kind.get(k.key));

  // Filtro que deixou de existir (plataforma sem links, tag excluída) sai da seleção.
  useEffect(() => {
    const okP = plats.filter(k => stats.plat.get(k)), okK = kinds.filter(k => stats.kind.get(k));
    if (okK.length !== kinds.length) set({ kinds: okK });
    const okF = fp.filter(id => id === 'none' || folders.some(f => f.id === id));
    if (okP.length !== plats.length || okF.length !== fp.length) set({ plats: okP, fp: okF });
  }, [plats, kinds, fp, stats, folders]);

  // Data de salvamento num select: atalhos comuns e "Escolher datas…" para um intervalo livre.
  const presetKey = !from && !to ? 'any' : DATE_OPTS.find(o => o.days && datePreset(o.days).from === from && datePreset(o.days).to === to)?.k
    || (from === new Date().getFullYear() + '-01-01' && !to ? 'year' : '');
  const [wantCustom, setWantCustom] = useState(false);
  const custom = wantCustom || !presetKey;
  const pickDate = (k: string) => {
    if (k === 'custom') { setWantCustom(true); return; }
    setWantCustom(false);
    if (k === 'any') set({ from: '', to: '' });
    else if (k === 'year') set({ from: new Date().getFullYear() + '-01-01', to: '' });
    else { const o = DATE_OPTS.find(x => x.k === k); if (o?.days) set(datePreset(o.days)); }
  };

  return (
    <div className="fp-body">
        {view === 'all' && folders.length > 0 && (
          <div className="fgrp" role="group" aria-label="Filtrar por tag">
            <span className="fl">Tags</span>
            <div className="chips">
              {stats.none > 0 && <Chip label="Sem tag" count={stats.none} on={fp.includes('none')} onClick={() => toggleFolderFilter('none')} />}
              {folders.map(f => <Chip key={f.id} label={f.nome} count={stats.folder.get(f.id) || 0} on={fp.includes(f.id)} onClick={() => toggleFolderFilter(f.id)} />)}
            </div>
          </div>
        )}
        {presentKinds.length > 0 && (
          <div className="fgrp" role="group" aria-label="Filtrar por tipo">
            <span className="fl">Tipo</span>
            <div className="chips">
              {presentKinds.map(k => <Chip key={k.key} label={k.label} count={stats.kind.get(k.key)} on={kinds.includes(k.key)} onClick={() => toggleKind(k.key)} />)}
              {stats.kind.get('none') ? <Chip label="Não identificado" count={stats.kind.get('none')} on={kinds.includes('none')} onClick={() => toggleKind('none')} /> : null}
            </div>
          </div>
        )}
        {present.length > 1 && (
          <div className="fgrp" role="group" aria-label="Filtrar por origem">
            <span className="fl">Origem</span>
            <div className="chips">
              {present.map(k => <Chip key={k} label={PLAT[k].label} count={stats.plat.get(k)} on={plats.includes(k)} onClick={() => togglePlat(k)} />)}
            </div>
          </div>
        )}
        <div className="fgrp fg-date" role="group" aria-label="Filtrar por data">
          <label className="fl" htmlFor="fd-sel">Data de salvamento</label>
          <span className="inw sel-w">
            <select id="fd-sel" className="sel" value={custom ? 'custom' : presetKey} onChange={e => pickDate(e.target.value)}>
              {DATE_OPTS.map(o => <option key={o.k} value={o.k}>{o.label}</option>)}
              <option value="custom">Escolher datas</option>
            </select>
          </span>
          {custom && (
            <div className="fdates">
              <label className="f" htmlFor="fd-from">De<span className="inw"><input type="date" id="fd-from" value={from} onChange={e => set({ from: e.target.value })} /></span></label>
              <label className="f" htmlFor="fd-to">Até<span className="inw"><input type="date" id="fd-to" value={to} onChange={e => set({ to: e.target.value })} /></span></label>
            </div>
          )}
        </div>
      </div>
  );
}


/** Grade, Lista (só em tela larga) e Galeria. Discreto, só ícones, na linha de contexto. */
export function ViewSwitch() {
  const layout = useStore(s => s.layout), wide = useWide();
  return (
    <div className="seg view" role="group" aria-label="Visualização">
      <button type="button" aria-pressed={layout === 'cards' || (layout === 'list' && !wide)} aria-label="Grade" title="Grade: cartões com resumo" onClick={() => setLayout('cards')}><IcoCards /></button>
      {wide && <button type="button" aria-pressed={layout === 'list'} aria-label="Lista" title="Lista: uma linha por link" onClick={() => setLayout('list')}><IcoList /></button>}
      <button type="button" aria-pressed={layout === 'gallery'} aria-label="Galeria" title="Galeria: só as imagens, mais links por tela" onClick={() => setLayout('gallery')}><IcoGallery /></button>
    </div>
  );
}

/** Filtros ativos como fichas removíveis, para a pessoa ver o que está escondendo links. */
function ActiveFilters() {
  const q = useStore(s => s.q), plats = useStore(s => s.plats), kinds = useStore(s => s.kinds), fp = useStore(s => s.fp), from = useStore(s => s.from), to = useStore(s => s.to);
  const folders = useStore(s => s.folders);
  const items: { k: string; label: string; off: () => void }[] = [];
  if (q.trim()) items.push({ k: 'q', label: '"' + q.trim() + '"', off: () => set({ q: '' }) });
  fp.forEach(id => items.push({ k: 'f' + id, label: id === 'none' ? 'Sem tag' : folders.find(f => f.id === id)?.nome || '', off: () => toggleFolderFilter(id) }));
  kinds.forEach(k => items.push({ k: 'k' + k, label: k === 'none' ? 'Tipo não identificado' : kindLabel(k), off: () => toggleKind(k) }));
  plats.forEach(k => items.push({ k: 'p' + k, label: PLAT[k as keyof typeof PLAT]?.label || k, off: () => togglePlat(k) }));
  if (from || to) items.push({ k: 'd', label: from && to ? from.split('-').reverse().slice(0, 2).join('/') + ' a ' + to.split('-').reverse().slice(0, 2).join('/') : from ? 'Desde ' + from.split('-').reverse().slice(0, 2).join('/') : 'Até ' + to.split('-').reverse().slice(0, 2).join('/'), off: () => set({ from: '', to: '' }) });
  if (!items.length) return null;
  return (
    <div className="afil" role="group" aria-label="Filtros ativos">
      {items.map(i => <button key={i.k} type="button" className="chip on" onClick={i.off} aria-label={'Tirar filtro ' + i.label}>{i.label}<IcoX /></button>)}
      {items.length > 1 && <button type="button" className="afil-clear" onClick={resetFilters}>Limpar tudo</button>}
    </div>
  );
}

/**
 * Linha de contexto, logo abaixo do cabeçalho: onde estou (com Voltar dentro de uma tag),
 * quantos links, ordem e visualização. Não conta como elemento do cabeçalho.
 */
export function SubBar({ count }: { count: number }) {
  const view = useStore(s => s.view), folders = useStore(s => s.folders), sort = useStore(s => s.sort);
  const hasLinks = useStore(s => s.links.length > 0);
  const n = useStore(s => filterCount(s, s.view));
  const notes = useVisible().filter(l => !l.url).length, nLinks = count - notes;
  const items = [nLinks || !notes ? plural(nLinks, '1 link', 'links') : '', notes ? plural(notes, '1 nota', 'notas') : ''].filter(Boolean).join(', ');
  const searching = useSearching(), hits = useTagHits().length;
  const grid = view === 'tags' && !searching;
  const folder = folders.find(f => f.id === view) || null;
  const inside = !!folder || view === 'none';
  const back = inside ? 'tags' : 'all';
  const showBack = inside || view === 'archived' || view === 'settings';
  if (!hasLinks && view !== 'settings') return <h1 className="sr" id="view-title">{viewTitle(view, folders)}</h1>;
  return (
    <div className="subbar">
      <div className="sb-l">
        {showBack && <button type="button" className="sb-back" onClick={() => go(back)}><IcoBack />{back === 'tags' ? 'Tags' : 'Tudo'}</button>}
        <h1 id="view-title" className={showBack || grid ? '' : 'sr'}>{searching ? 'Busca' : viewTitle(view, folders)}</h1>
        {folder && <button type="button" className="sb-edit" aria-label={'Editar tag ' + folder.nome} title="Editar tag" onClick={() => openModal({ kind: 'edit', id: folder.id })}><IcoEdit /></button>}
        {view !== 'settings' && <span className="sb-n">{grid ? plural(folders.length, '1 tag', 'tags') : (hits && searching ? plural(hits, '1 tag', 'tags') + ', ' : '') + items + (n ? ' com filtro' : '')}</span>}
      </div>
      {view !== 'settings' && !grid && (
        <div className="sb-r">
          <label className="sortq">
            <span className="sr">Ordenar por</span>
            <select aria-label="Ordenar por" value={sort} onChange={e => { if (isSort(e.target.value)) setSort(e.target.value); }}>
              {SORTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
          <ViewSwitch />
        </div>
      )}
      {view !== 'settings' && !grid && <ActiveFilters />}
    </div>
  );
}
