import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import type { Folder, Link } from '../types';
import { colorOf, shapeOf } from '../lib/folders';
import { liveTags } from '../lib/tags';
import { get } from '../store';
import { openLink, setCardMenu, toggleSel } from '../actions';
import { PLAT, ago, titleOf, fmtDuration, originOf, thumbOf } from '../lib/platforms';
import { kindLabel } from '../lib/kinds';
import { isArch } from '../lib/filters';
import { isTouch } from '../hooks/useMedia';
import { CardMenu } from './CardMenu';
import { ListPeek } from './Checklist';
import { listStats } from '../lib/notes';
import { IcoCheck, IcoOpen, IcoTag } from './icons';

/** Quanto tempo segurar para abrir o menu no toque. Abaixo de 400ms disputa com a rolagem, acima de 550ms parece travado. */
const LONG_PRESS = 450;

/** Nome do cartão para a transição entre visualizações: o mesmo link é o mesmo elemento nas três. */
export const vtName = (id: string) => ({ viewTransitionName: 'c-' + id.replace(/[^a-zA-Z0-9_-]/g, '') } as CSSProperties);

type Fallback = 'quote' | 'icon' | 'type';

/** Cor estável por site, tirada da paleta das tags. Mesmo site, mesma cor, em qualquer aparelho. */
function hue(host: string): number {
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  return h % 8;
}

/** Texto que vale como citação: o próprio post nas redes de texto, o resumo nos artigos. */
function quoteOf(l: Link): string {
  const social = l.plataforma === 'x' || l.plataforma === 'threads';
  const text = social ? (l.descricao || l.tituloAuto || '') : (l.resumoIA || l.descricao || '');
  const isTexty = social || ['artigo', 'noticia', 'post', 'referencia'].includes(l.categoria || '');
  return isTexty && text.trim().length >= 40 ? text.trim() : '';
}

/** Escolhe a capa sem imagem: citação para texto, ícone do site quando há, tipográfica no resto. */
export function fallbackOf(l: Link): Fallback {
  if (quoteOf(l)) return 'quote';
  if (l.plataforma === 'web' && l.icone && /^https:\/\//i.test(l.icone)) return 'icon';
  return 'type';
}

/**
 * Tags do cartão em uma linha. Se todas cabem, aparecem todas. Se não, aparece só a primeira e um "+N" com o resto.
 * Mede de verdade (largura do cartão muda com a tela), em vez de estimar por número de letras.
 */
function GTags({ tags }: { tags: Folder[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || tags.length < 2) { setFit(true); return; }
    const check = () => {
      // Mede sempre com todas as tags: tira o modo resumido, mede e decide.
      el.dataset.measure = '1';
      const all = el.scrollWidth <= el.clientWidth + 1;
      delete el.dataset.measure;
      setFit(all);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tags]);
  const names = tags.map(t => t.nome).join(', ');
  return (
    <span ref={ref} className={'g-tags' + (fit ? '' : ' short')} title={names}>
      {tags.map((t, i) => <span key={t.id} className="tag" data-c={colorOf(t)} data-s={shapeOf(t)} data-rest={i > 0 || undefined}>{t.nome}</span>)}
      {tags.length > 1 && <span className="tag more" aria-hidden={fit || undefined}>+{tags.length - 1}</span>}
    </span>
  );
}

interface Props { link: Link; folders: Folder[]; selected: boolean; flash: boolean; loading: boolean; selecting: boolean }

/**
 * Cartão da Galeria: imagem de ponta a ponta, só dois elementos à vista (origem no topo, título na base).
 * Clique abre o link. No mouse, passar por cima revela data e ações. No toque, segurar abre o menu.
 */
export const GalleryCard = memo(function GalleryCard({ link: l, folders, selected, flash, loading, selecting }: Props) {
  const titulo = titleOf(l);
  const img = thumbOf({ thumb: l.thumb });
  const [broken, setBroken] = useState(false), [iconBroken, setIconBroken] = useState(false);
  const note = !l.url;
  const hasImg = !note && !!img && !broken;
  const fb = hasImg || note ? null : fallbackOf(l);
  const ls = listStats(l);
  const origin = originOf(l), arq = isArch(l), kind = kindLabel(l.categoria);
  const icon = l.plataforma === 'web' && l.icone && !iconBroken ? l.icone : '';
  const menuAnchor = useRef<HTMLDivElement>(null);
  const tags = useMemo(() => liveTags(l, folders), [l, folders]);
  // Com foto, as tags tomam o lugar do título. Sem foto (capas de ícone e tipográfica), o título é o conteúdo e fica, com as tags embaixo.
  const showTitle = fb !== 'quote' && !note;

  // Segurar: abre o menu e engole o clique que viria ao soltar.
  const press = useRef<{ t: number; x: number; y: number; fired: boolean } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    const t = window.setTimeout(() => {
      if (!press.current) return;
      press.current.fired = true;
      navigator.vibrate?.(8);
      setCardMenu(l.id);
    }, LONG_PRESS);
    press.current = { t, x: e.clientX, y: e.clientY, fired: false };
  };
  const cancel = () => { if (press.current) clearTimeout(press.current.t); };
  const onPointerMove = (e: PointerEvent) => {
    const p = press.current;
    if (p && !p.fired && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) { clearTimeout(p.t); press.current = null; }
  };
  const onClick = (e: MouseEvent) => {
    if (press.current?.fired) { e.preventDefault(); press.current = null; return; }
    press.current = null;
    // Selecionando: o toque marca e desmarca em vez de abrir.
    // Cmd ou Ctrl + clique abre o original em outra aba, como qualquer link.
    if ((e.metaKey || e.ctrlKey) && !selecting && !get().sel.length) return;
    e.preventDefault();
    if (selecting || get().sel.length || e.shiftKey) { toggleSel(l.id, e.shiftKey); return; }
    // Abre o link no próprio app (mídia, resumo e tags). O original fica a um toque, dentro do modal.
    openLink(l.id);
  };

  const quote = fb === 'quote' ? quoteOf(l) : '';
  return (
    <article className={'gcard' + (note ? ' fb fb-note' : fb ? ' fb fb-' + fb : '') + (flash ? ' flash' : '') + (loading ? ' loading' : '')} data-id={l.id}
      data-c={fb && fb !== 'quote' ? hue(origin) : undefined} style={vtName(l.id)} data-selected={selected || undefined} aria-busy={loading || undefined}>
      <a className="g-hit" href={l.url || '#'} target="_blank" rel="noopener noreferrer" aria-label={titulo + ', ' + origin + (kind ? ', ' + kind : '') + (tags.length ? ', tags: ' + tags.map(t => t.nome).join(', ') : '')}
        onClick={onClick} onPointerDown={onPointerDown} onPointerUp={cancel} onPointerCancel={cancel} onPointerMove={onPointerMove}
        onContextMenu={e => { if (isTouch()) e.preventDefault(); }} draggable={false}>
        {hasImg && <img className="g-img" src={img} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />}
        {fb === 'icon' && <span className="g-icon">{icon ? <img src={icon} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setIconBroken(true)} /> : (PLAT[l.plataforma] || PLAT.web).short}</span>}
        {note && (
          <span className="g-note">
            <span className="g-ttl">{titulo}</span>
            {l.nota.trim() && <span className="g-nt">{l.nota.trim()}</span>}
            <ListPeek link={l} max={l.nota.trim() ? 3 : 5} />
          </span>
        )}
        {fb === 'quote' && <blockquote className="g-quote"><span className="g-qm" aria-hidden="true">“</span><span className="g-qt">{quote}</span></blockquote>}
        <span className="g-badge">
          {icon && fb !== 'icon' ? <img src={icon} alt="" referrerPolicy="no-referrer" onError={() => setIconBroken(true)} /> : null}
          <span>{note ? 'Nota' : l.plataforma === 'web' ? origin : PLAT[l.plataforma].label}</span>
        </span>
        {l.duracao ? <span className="g-dur">{fmtDuration(l.duracao)}</span> : !note && ls.total ? <span className="g-dur g-ls">{ls.done}/{ls.total}</span> : null}
        {(showTitle || tags.length > 0) && (
          <span className="g-foot">
            {showTitle && <span className="g-ttl">{titulo}</span>}
            {tags.length > 0 && <GTags tags={tags} />}
          </span>
        )}
      </a>
      {/* Revelado no mouse e no foco do teclado. No toque fica escondido: lá o caminho é segurar. */}
      <div className="g-over" ref={menuAnchor}>
        <span className="g-date" title={kind || undefined}>{ago(l.criadoEm || Date.now())}</span>
        <span className="g-acts">
          {!note && <a className="g-btn" href={l.url} target="_blank" rel="noopener noreferrer" aria-label={'Abrir ' + titulo} title="Abrir o link original"><IcoOpen /></a>}
          <button type="button" className="g-btn" aria-label={'Tags de ' + titulo} title="Tags" data-cmenu={l.id} onClick={() => setCardMenu(l.id, true)}><IcoTag /></button>
          <CardMenu link={l} titulo={titulo} arq={arq} anchor={menuAnchor} />
        </span>
      </div>
      <button type="button" className="g-pick" role="checkbox" aria-checked={selected} aria-label={'Selecionar ' + titulo} onClick={e => toggleSel(l.id, e.shiftKey)}>
        <IcoCheck />
      </button>
    </article>
  );
});
