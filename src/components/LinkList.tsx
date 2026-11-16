import { memo, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { get, useStore } from '../store';
import { deleteLink, pasteFromClipboard, setArchived, setSwipe, toggleSel } from '../actions';
import { PASTE_KEY } from './Header';
import type { Folder, Link } from '../types';
import { filterCount, isArch, viewTitle } from '../lib/filters';
import { colorOf } from '../lib/folders';
import { liveTags } from '../lib/tags';
import { kindLabel } from '../lib/kinds';
import { PLAT, ago, autoTitle, fmtDuration, kindOf, originOf, shortUrl, summaryOf, thumbOf } from '../lib/platforms';
import { useBase, useVisible } from '../hooks/useVisible';
import { isTouch, useWide } from '../hooks/useMedia';
import { TRAY_W, useSwipe } from '../hooks/useSwipe';
import { CardMenu } from './CardMenu';
import { GalleryCard, vtName } from './GalleryCard';
import { IcoArchive, IcoCheck, IcoPaste, IcoRestore, IcoTrash } from './icons';

const PAGE = 60;


type PreviewLink = Pick<Link, 'plataforma'> & Partial<Pick<Link, 'thumb' | 'duracao' | 'icone'>>;

/** Quadrado do cartão. Sem imagem, mostra as iniciais da rede (ou o ícone do site, nos links comuns). Vídeo leva o selo de duração. */
export function Preview({ link, cls, src, loading }: { link: PreviewLink; cls?: string; src?: string; loading?: boolean }) {
  const url = src ?? thumbOf({ thumb: link.thumb });
  const icon = link.plataforma === 'web' && link.icone && /^https:\/\//i.test(link.icone) ? link.icone : '';
  const [broken, setBroken] = useState<string | null>(null), [iconBroken, setIconBroken] = useState(false);
  const showImg = !!url && broken !== url;
  return (
    <div className={'preview' + (cls ? ' ' + cls : '') + (loading ? ' sk' : '')} aria-hidden="true">
      {icon && !showImg && !iconBroken
        ? <img className="ico" src={icon} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setIconBroken(true)} />
        : (PLAT[link.plataforma] || PLAT.web).short}
      {showImg && <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(url)} />}
      {link.duracao ? <span className="dur">{fmtDuration(link.duracao)}</span> : null}
    </div>
  );
}

/** Resumo do cartão: uma linha. Tocar abre o texto inteiro, tocar fora (ou Esc) fecha. */
function Summary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', out, true);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', out, true); document.removeEventListener('keydown', esc); };
  }, [open]);
  return <button ref={ref} type="button" className="sum" aria-expanded={open} title={open ? undefined : 'Ver o resumo inteiro'} onClick={() => setOpen(o => !o)}>{text}</button>;
}

interface CardProps { link: Link; folders: Folder[]; selected: boolean; flash: boolean; loading: boolean; open: boolean; swipeOn: boolean }

const LinkCard = memo(function LinkCard({ link: l, folders, selected, flash, loading, open, swipeOn }: CardProps) {
  const { ref, bind, apply } = useSwipe(l.id, open, swipeOn);
  // Fechou por fora (outro cartão abriu, toque em outro lugar, Esc): volta para a posição inicial.
  useEffect(() => { if (!ref.current?.classList.contains('dragging')) apply(open ? -TRAY_W : 0, true); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const arq = isArch(l);
  const titulo = l.titulo || l.tituloAuto || autoTitle(l);
  const tags = useMemo(() => liveTags(l, folders), [l, folders]);
  const kind = kindOf(l), summary = summaryOf(l);
  return (
    <div className="swipe" ref={ref} data-id={l.id} data-open={open || undefined} {...bind}>
    <div className="tray" role="group" aria-label={'Ações rápidas de ' + titulo}>
      <button type="button" className="t-arq" tabIndex={open ? 0 : -1} onClick={() => setArchived([l], !arq)}>{arq ? <IcoRestore /> : <IcoArchive />}<span>{arq ? 'Restaurar' : 'Arquivar'}</span></button>
      <button type="button" className="t-del" tabIndex={open ? 0 : -1} onClick={() => deleteLink(l.id)}><IcoTrash /><span>Excluir</span></button>
    </div>
    <article className={'link k-' + kind + (flash ? ' flash' : '') + (loading ? ' loading' : '')} data-id={l.id} style={vtName(l.id)} aria-selected={selected} aria-busy={loading || undefined}>
      <button type="button" className="pick" role="checkbox" aria-checked={selected} aria-label={'Selecionar ' + titulo}
        onClick={e => { e.preventDefault(); toggleSel(l.id, e.shiftKey); }}>
        <span className="box"><IcoCheck /></span>
      </button>
      <Preview link={l} loading={loading} />
      <div className="ltext">
        <h3 className="ttl" title={titulo}>{titulo}</h3>
        <p className="meta"><span>{originOf(l)}</span>{kindLabel(l.categoria) && <span className="kd">{kindLabel(l.categoria)}</span>}<span>{ago(l.criadoEm || Date.now())}</span></p>
        {summary && !l.nota && <Summary text={summary} />}
        <p className="url" title={l.url}>{loading && <span className="rd">Lendo a página</span>}<span className="ul">{shortUrl(l.url)}</span></p>
        {l.nota && <p className="note">{l.nota}</p>}
      </div>
      <div className="acts">
        {tags.length > 0 && (
          <span className="tags">
            {tags.slice(0, 2).map(t => <span key={t.id} className="tag" data-c={colorOf(t)} title={t.nome}>{t.nome}</span>)}
            {tags.length > 2 && <span className="tag more" title={tags.slice(2).map(t => t.nome).join(', ')}>+{tags.length - 2}</span>}
          </span>
        )}
        <a className="btn outline sm" href={l.url} target="_blank" rel="noopener noreferrer">Abrir</a>
        <CardMenu link={l} titulo={titulo} arq={arq} />
      </div>
    </article>
    </div>
  );
});

/** Primeira vez, nenhum link: a tela inteira é um convite a colar. */
function FirstRun() {
  return (
    <div className="first">
      <b className="first-logo" aria-hidden="true">disorder</b>
      <h2>Cole um link para começar</h2>
      <p>Qualquer site, post ou vídeo. A IA lê, resume e organiza em tags para você.</p>
      <button type="button" className="btn primary first-cta" onClick={() => void pasteFromClipboard(PASTE_KEY)}><IcoPaste />Colar link</button>
      <p className="first-k">ou aperte <kbd>{PASTE_KEY}</kbd> em qualquer lugar desta tela</p>
    </div>
  );
}

function Empty({ base }: { base: number }) {
  const total = useStore(s => s.links.length), view = useStore(s => s.view), folders = useStore(s => s.folders);
  const filtered = useStore(s => filterCount(s, s.view)) > 0 && base > 0;
  let t: string, p: string;
  if (!total) return <FirstRun />;
  if (filtered) { t = 'Nenhum link bate com o filtro'; p = 'Limpe os filtros ou tente outra combinação.'; }
  else if (view === 'archived') { t = 'Nada arquivado'; p = 'Links arquivados saem das tags e ficam guardados aqui. Você pode restaurar quando quiser.'; }
  else if (view === 'none') { t = 'Tudo o que você salvou está em alguma tag'; p = 'Links sem tag aparecem aqui.'; }
  else { t = 'Esta tag está vazia'; p = 'O que você salvar aqui entra em ' + viewTitle(view, folders) + '.'; }
  return (
    <div className="empty">
      <b>{t}</b><p>{p}</p>
      {view !== 'archived' && !filtered && (
        <>
          <button className="btn primary" onClick={() => void pasteFromClipboard(PASTE_KEY)}><IcoPaste />Colar link</button>
          <p className="hint">ou aperte <kbd>{PASTE_KEY}</kbd> em qualquer lugar desta tela</p>
        </>
      )}
    </div>
  );
}

export function LinkList() {
  const loaded = useStore(s => s.loaded), loadError = useStore(s => s.loadError);
  const layout = useStore(s => s.layout), sel = useStore(s => s.sel), flash = useStore(s => s.flash);
  const folders = useStore(s => s.folders), view = useStore(s => s.view), loadingIds = useStore(s => s.loading), swipeId = useStore(s => s.swipeId);
  const wide = useWide();
  const visible = useVisible(), base = useBase();

  // Desenha a lista em blocos: os primeiros 60 e mais a cada vez que o fim se aproxima.
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => { setLimit(PAGE); }, [view]);
  useEffect(() => {
    if (!flash) return;
    const i = visible.findIndex(l => l.id === flash);
    if (i >= limit) setLimit(i + PAGE);
  }, [flash, visible, limit]);
  // Toque fora da gaveta aberta fecha.
  useEffect(() => {
    if (!swipeId) return;
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest?.('.swipe[data-open]')) setSwipe(null); };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [swipeId]);
  const more = visible.length > limit;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more) return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) setLimit(n => n + PAGE); }, { rootMargin: '900px' });
    io.observe(el);
    return () => io.disconnect();
  }, [more, limit]);

  const gallery = layout === 'gallery';
  const cls = 'list ' + (gallery ? 'gallery' : layout === 'list' && wide ? 'compact' : 'grid') + (sel.length ? ' has-sel' : '');
  const style = { marginTop: 14 };
  if (!loaded && !loadError) return <div className={cls} id="list" style={style}><div className="empty"><b>Carregando seus links</b></div></div>;
  if (loadError) return <div className={cls} id="list" style={style} />;
  if (!visible.length) return <div className={cls} id="list" style={style}><Empty base={base.length} /></div>;

  // Com seleção ativa (ou em tela de toque), tocar no cartão seleciona.
  const onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement, card = t.closest<HTMLElement>('.link');
    if (!card || gallery || t.closest('a,button,select,input,textarea,label')) return;
    if (get().sel.length || isTouch()) toggleSel(card.dataset.id!, e.shiftKey);
  };
  const picked = new Set(sel), busy = new Set(loadingIds);
  return (
    <div className={cls} id="list" style={style} onClick={onClick}>
      {gallery ? visible.slice(0, limit).map(l => (
        <GalleryCard key={l.id} link={l} folders={folders} selected={picked.has(l.id)} flash={flash === l.id} loading={busy.has(l.id)} selecting={sel.length > 0} />
      )) : visible.slice(0, limit).map(l => (
        <LinkCard key={l.id} link={l} folders={folders} selected={picked.has(l.id)} flash={flash === l.id} loading={busy.has(l.id)} open={swipeId === l.id} swipeOn={!sel.length} />
      ))}
      {more && <div ref={sentinel} className="more" aria-hidden="true" />}
    </div>
  );
}
