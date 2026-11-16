import { useLayoutEffect, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { go, openModal } from '../actions';
import { useCounts, useSortedFolders } from '../hooks/useVisible';
import { isArch } from '../lib/filters';
import { colorOf } from '../lib/folders';
import { tagsOf } from '../lib/tags';
import { thumbOf } from '../lib/platforms';
import { plural } from '../lib/text';
import type { Link } from '../types';

/**
 * Nome da tag dentro da capa: a primeira palavra ocupa a largura toda (o tamanho da letra se ajusta ao cartão),
 * as outras seguem num tamanho normal embaixo. Mede de verdade, porque cada palavra tem largura diferente.
 */
function TagName({ nome, count }: { nome: string; count: string }) {
  const [first, ...rest] = nome.trim().split(/\s+/);
  const box = useRef<HTMLSpanElement>(null), word = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const b = box.current, w = word.current;
    if (!b || !w) return;
    const fit = () => {
      w.style.fontSize = '100px';
      const avail = b.clientWidth, h = b.parentElement?.clientHeight || 300;
      const size = Math.min((avail / Math.max(1, w.scrollWidth)) * 100, h * 0.42);
      w.style.fontSize = Math.max(14, Math.floor(size * 10) / 10) + 'px';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [first]);
  return (
    <span className="tc-over" ref={box}>
      <span className="tc-w1" ref={word}>{first}</span>
      {rest.length > 0 && <span className="tc-rest">{rest.join(' ')}</span>}
      <span className="tc-cnt">{count}</span>
    </span>
  );
}

/** Capa em mosaico: até 4 imagens dos links mais novos da tag. Falta imagem, entra a cor da tag. */
function Mosaic({ links, c, children }: { links: Link[]; c: number; children?: React.ReactNode }) {
  const pics = links.map(l => thumbOf(l)).filter(Boolean).slice(0, 4);
  const n = pics.length;
  return (
    <span className={'mosaic m' + n} data-c={c} aria-hidden="true">
      {pics.map((src, i) => <img key={i} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />)}
      {children}
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
        <button key={f.id} type="button" className="tcard" onClick={() => go(f.id)} aria-label={f.nome + ', ' + plural(c.by.get(f.id) || 0, '1 link', 'links') + (f.auto ? ', criada pela IA' : '')}>
          <Mosaic links={by.m.get(f.id) || []} c={colorOf(f)}>
            <TagName nome={f.nome} count={plural(c.by.get(f.id) || 0, '1 link', 'links')} />
            {f.auto && <span className="fauto tc-ia" aria-hidden="true">IA</span>}
          </Mosaic>
        </button>
      ))}
      {c.none > 0 && (
        <button type="button" className="tcard" onClick={() => go('none')} aria-label={'Sem tag, ' + plural(c.none, '1 link', 'links')}>
          <Mosaic links={by.none} c={-1}><TagName nome="Sem tag" count={plural(c.none, '1 link', 'links')} /></Mosaic>
        </button>
      )}
      <button type="button" className="tcard new" onClick={() => openModal({ kind: 'new', then: { type: 'stay' } })}>
        <span className="mosaic" aria-hidden="true"><span className="mz-plus">+</span><span className="tc-new">Criar tag</span></span>
      </button>
    </div>
  );
}
