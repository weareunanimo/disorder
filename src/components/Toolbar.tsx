import { useEffect, useMemo, useRef } from 'react';
import { set, useStore } from '../store';
import { openAdd, resetFilters, setLayout, setSort, toggleFolderFilter, toggleKind, togglePlat } from '../actions';
import { SORTS, isSort } from '../lib/sort';
import { KINDS } from '../lib/kinds';
import { datePreset, filterCount } from '../lib/filters';
import { tagsOf } from '../lib/tags';
import { PLAT, PLAT_KEYS } from '../lib/platforms';
import { useBase, useSortedFolders } from '../hooks/useVisible';
import { canHover } from '../hooks/useMedia';
import { IcoCards, IcoFilter, IcoList, IcoPlus, IcoSearch } from './icons';

function Chip({ label, count, on, onClick }: { label: string; count?: number; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className="chip" aria-pressed={on} onClick={onClick}>
      {label}{count != null && <span className="n">{count}</span>}
    </button>
  );
}

function FiltersPanel({ n }: { n: number }) {
  const view = useStore(s => s.view), q = useStore(s => s.q), plats = useStore(s => s.plats), kinds = useStore(s => s.kinds), fp = useStore(s => s.fp);
  const from = useStore(s => s.from), to = useStore(s => s.to);
  const folders = useSortedFolders(), base = useBase();
  const search = useRef<HTMLInputElement>(null);

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

  useEffect(() => { if (canHover()) search.current?.focus(); }, []);
  // Filtro que deixou de existir (plataforma sem links, tag excluída) sai da seleção.
  useEffect(() => {
    const okP = plats.filter(k => stats.plat.get(k)), okK = kinds.filter(k => stats.kind.get(k));
    if (okK.length !== kinds.length) set({ kinds: okK });
    const okF = fp.filter(id => id === 'none' || folders.some(f => f.id === id));
    if (okP.length !== plats.length || okF.length !== fp.length) set({ plats: okP, fp: okF });
  }, [plats, kinds, fp, stats, folders]);

  const isPreset = (d: number) => { const x = datePreset(d); return from === x.from && to === x.to; };
  const preset = (d: number) => set(isPreset(d) ? { from: '', to: '' } : datePreset(d));

  return (
    <div className="fpanel" id="fpanel" role="group" aria-label="Filtros">
      <div className="fp-head">
        <b>Filtros</b>
        <label className="inw quiet">
          <IcoSearch />
          <input ref={search} className="search" id="q" type="search" placeholder="Buscar" aria-label="Buscar nos links" autoComplete="off" value={q} onChange={e => set({ q: e.target.value })} />
        </label>
        <button type="button" className="btn sm" disabled={!n} onClick={resetFilters}>Limpar</button>
      </div>
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
        <div className="fgrp" role="group" aria-label="Filtrar por data">
          <span className="fl">Data de salvamento</span>
          <div className="chips">
            {[7, 30, 90].map(d => <Chip key={d} label={'Últimos ' + d + ' dias'} on={isPreset(d)} onClick={() => preset(d)} />)}
          </div>
          <div className="fdates">
            <label className="f" htmlFor="fd-from">De<span className="inw"><input type="date" id="fd-from" value={from} onChange={e => set({ from: e.target.value })} /></span></label>
            <label className="f" htmlFor="fd-to">Até<span className="inw"><input type="date" id="fd-to" value={to} onChange={e => set({ to: e.target.value })} /></span></label>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Toolbar() {
  const hasLinks = useStore(s => s.links.length > 0), view = useStore(s => s.view);
  const open = useStore(s => s.filtersOpen), layout = useStore(s => s.layout);
  const n = useStore(s => filterCount(s, s.view)), sort = useStore(s => s.sort);
  if (!hasLinks || view === 'settings') return <div className="tools" id="tools" style={{ marginTop: 24 }} />;
  return (
    <div className="tools" id="tools" style={{ marginTop: 24 }}>
      {view !== 'archived'
        ? <button type="button" className="btn primary add-row" onClick={() => openAdd()}><IcoPlus />Salvar link</button>
        : <span className="tools-sp" />}
      <button type="button" className="btn filt" aria-expanded={open} aria-controls="fpanel" onClick={() => set({ filtersOpen: !open })}>
        <IcoFilter />Filtros{n > 0 && <span className="cnt" aria-label={n + (n === 1 ? ' filtro ativo' : ' filtros ativos')}>{n}</span>}
      </button>
      <label className="inw sortw">
        <select className="sel" aria-label="Ordenar por" value={sort} onChange={e => { if (isSort(e.target.value)) setSort(e.target.value); }}>
          {SORTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>
      <div className="seg" role="group" aria-label="Visualização">
        <button type="button" aria-pressed={layout !== 'list'} aria-label="Ver em cartões" title="Ver em cartões" onClick={() => setLayout('cards')}><IcoCards /></button>
        <button type="button" aria-pressed={layout === 'list'} aria-label="Ver em lista" title="Ver em lista" onClick={() => setLayout('list')}><IcoList /></button>
      </div>
      {open && <FiltersPanel n={n} />}
    </div>
  );
}
