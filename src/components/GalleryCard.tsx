import { memo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import type { Link } from '../types';
import { get } from '../store';
import { setCardMenu, toggleSel } from '../actions';
import { PLAT, ago, autoTitle, fmtDuration, originOf, thumbOf } from '../lib/platforms';
import { kindLabel } from '../lib/kinds';
import { isArch } from '../lib/filters';
import { isTouch } from '../hooks/useMedia';
import { CardMenu } from './CardMenu';
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

interface Props { link: Link; selected: boolean; flash: boolean; loading: boolean; selecting: boolean }

/**
 * Cartão da Galeria: imagem de ponta a ponta, só dois elementos à vista (origem no topo, título na base).
 * Clique abre o link. No mouse, passar por cima revela data e ações. No toque, segurar abre o menu.
 */
export const GalleryCard = memo(function GalleryCard({ link: l, selected, flash, loading, selecting }: Props) {
  const titulo = l.titulo || l.tituloAuto || autoTitle(l);
  const img = thumbOf({ thumb: l.thumb });
  const [broken, setBroken] = useState(false), [iconBroken, setIconBroken] = useState(false);
  const hasImg = !!img && !broken;
  const fb = hasImg ? null : fallbackOf(l);
  const origin = originOf(l), arq = isArch(l), kind = kindLabel(l.categoria);
  const icon = l.plataforma === 'web' && l.icone && !iconBroken ? l.icone : '';
  const menuAnchor = useRef<HTMLDivElement>(null);

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
    if (selecting || get().sel.length || e.shiftKey) { e.preventDefault(); toggleSel(l.id, e.shiftKey); }
  };

  const quote = fb === 'quote' ? quoteOf(l) : '';
  return (
    <article className={'gcard' + (fb ? ' fb fb-' + fb : '') + (flash ? ' flash' : '') + (loading ? ' loading' : '')} data-id={l.id}
      data-c={fb && fb !== 'quote' ? hue(origin) : undefined} style={vtName(l.id)} aria-selected={selected} aria-busy={loading || undefined}>
      <a className="g-hit" href={l.url} target="_blank" rel="noopener noreferrer" aria-label={titulo + ', ' + origin + (kind ? ', ' + kind : '')}
        onClick={onClick} onPointerDown={onPointerDown} onPointerUp={cancel} onPointerCancel={cancel} onPointerMove={onPointerMove}
        onContextMenu={e => { if (isTouch()) e.preventDefault(); }} draggable={false}>
        {hasImg && <img className="g-img" src={img} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />}
        {fb === 'icon' && <span className="g-icon">{icon ? <img src={icon} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setIconBroken(true)} /> : (PLAT[l.plataforma] || PLAT.web).short}</span>}
        {fb === 'quote' && <blockquote className="g-quote"><span className="g-qm" aria-hidden="true">“</span><span className="g-qt">{quote}</span></blockquote>}
        <span className="g-badge">
          {icon && fb !== 'icon' ? <img src={icon} alt="" referrerPolicy="no-referrer" onError={() => setIconBroken(true)} /> : null}
          <span>{l.plataforma === 'web' ? origin : PLAT[l.plataforma].label}</span>
        </span>
        {l.duracao ? <span className="g-dur">{fmtDuration(l.duracao)}</span> : null}
        {fb !== 'quote' && <span className="g-ttl">{titulo}</span>}
      </a>
      {/* Revelado no mouse e no foco do teclado. No toque fica escondido: lá o caminho é segurar. */}
      <div className="g-over" ref={menuAnchor}>
        <span className="g-date" title={kind || undefined}>{ago(l.criadoEm || Date.now())}</span>
        <span className="g-acts">
          <a className="g-btn" href={l.url} target="_blank" rel="noopener noreferrer" aria-label={'Abrir ' + titulo} title="Abrir o link original"><IcoOpen /></a>
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
