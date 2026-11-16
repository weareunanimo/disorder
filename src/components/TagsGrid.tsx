import { useMemo } from 'react';
import { useStore } from '../store';
import { go, openModal } from '../actions';
import { useCounts, useSortedFolders } from '../hooks/useVisible';
import { isArch } from '../lib/filters';
import { colorOf } from '../lib/folders';
import { tagsOf } from '../lib/tags';
import { thumbOf, PLAT } from '../lib/platforms';
import { plural } from '../lib/text';
import type { Link } from '../types';

/** Capa em mosaico: até 4 imagens dos links mais novos da tag. Falta imagem, entra a cor da tag. */
function Mosaic({ links, c }: { links: Link[]; c: number }) {
  const pics = links.map(l => thumbOf(l)).filter(Boolean).slice(0, 4);
  const n = pics.length;
  return (
    <span className={'mosaic m' + n} data-c={c} aria-hidden="true">
      {pics.map((src, i) => <img key={i} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />)}
      {n === 0 && <span className="mz-lt">{links[0] ? (PLAT[links[0].plataforma] || PLAT.web).short : ''}</span>}
    </span>
  );
}

/** Aba Tags: uma grade com as tags (da IA e suas), cada uma com capa em mosaico e contagem. */
export function TagsGrid() {
  const folders = useSortedFolders(), c = useCounts();
  const links = useStore(s => s.links);
  const by = useMemo(() => {
    const m = new Map<string, Link[]>(), none: Link[] = [];
    const ids = new Set(folders.map(f => f.id));
    for (const l of [...links].sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0))) {
      if (isArch(l)) continue;
      const live = tagsOf(l).filter(id => ids.has(id));
      live.forEach(id => { const a = m.get(id) || []; if (a.length < 8) a.push(l); m.set(id, a); });
      if (!live.length && none.length < 8) none.push(l);
    }
    return { m, none };
  }, [links, folders]);
  return (
    <div className="tgrid" id="list">
      {folders.map(f => (
        <button key={f.id} type="button" className="tcard" onClick={() => go(f.id)}>
          <Mosaic links={by.m.get(f.id) || []} c={colorOf(f)} />
          <span className="tc-t"><b>{f.nome}</b>{f.auto && <span className="fauto" title="Criada pela IA">IA</span>}</span>
          <span className="tc-n">{plural(c.by.get(f.id) || 0, '1 link', 'links')}</span>
        </button>
      ))}
      {c.none > 0 && (
        <button type="button" className="tcard" onClick={() => go('none')}>
          <Mosaic links={by.none} c={-1} />
          <span className="tc-t"><b>Sem tag</b></span>
          <span className="tc-n">{plural(c.none, '1 link', 'links')}</span>
        </button>
      )}
      <button type="button" className="tcard new" onClick={() => openModal({ kind: 'new', then: { type: 'stay' } })}>
        <span className="mosaic" aria-hidden="true"><span className="mz-plus">+</span></span>
        <span className="tc-t"><b>Criar tag</b></span>
        <span className="tc-n">ou deixe a IA criar</span>
      </button>
    </div>
  );
}
