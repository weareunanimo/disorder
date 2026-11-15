import { memo, useEffect, useRef, useState, type MouseEvent } from 'react';
import { get, useStore } from '../store';
import { openAdd, openModal, toast, toggleSel } from '../actions';
import type { Folder, Link } from '../types';
import { filterCount, viewTitle } from '../lib/filters';
import { colorOf } from '../lib/folders';
import { PLAT, ago, autoTitle, clipTitle, fmtDuration, kindOf, originOf, shortUrl, summaryOf, thumbOf } from '../lib/platforms';
import { useBase, useVisible } from '../hooks/useVisible';
import { isTouch, useTitleMax, useWide } from '../hooks/useMedia';
import { IcoCheck, IcoCopy, IcoEdit, IcoPlus, IcoWhats } from './icons';

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

function copy(url: string) {
  (navigator.clipboard?.writeText ? navigator.clipboard.writeText(url) : Promise.reject())
    .then(() => toast('Link copiado.'))
    .catch(() => toast('Não consegui copiar. Abra o link e copie pelo endereço.'));
}

interface CardProps { link: Link; folder: Folder | null; selected: boolean; flash: boolean; max: number; loading: boolean }

const LinkCard = memo(function LinkCard({ link: l, folder, selected, flash, max, loading }: CardProps) {
  const titulo = l.titulo || l.tituloAuto || autoTitle(l);
  const shown = clipTitle(titulo, max), kind = kindOf(l), summary = summaryOf(l);
  return (
    <article className={'link k-' + kind + (flash ? ' flash' : '') + (loading ? ' loading' : '')} data-id={l.id} aria-selected={selected} aria-busy={loading || undefined}>
      <button type="button" className="pick" role="checkbox" aria-checked={selected} aria-label={'Selecionar ' + titulo}
        onClick={e => { e.preventDefault(); toggleSel(l.id, e.shiftKey); }}>
        <span className="box"><IcoCheck /></span>
      </button>
      <Preview link={l} loading={loading} />
      <div className="ltext">
        <h3 className="ttl" title={shown !== titulo ? titulo : undefined}>{shown}</h3>
        <p className="meta"><span>{originOf(l)}</span><span>{ago(l.criadoEm || Date.now())}</span></p>
        {summary && !l.nota && <p className="sum">{summary}</p>}
        <p className="url" title={l.url}>{loading && <span className="rd">Lendo a página</span>}<span className="ul">{shortUrl(l.url)}</span></p>
        {l.nota && <p className="note">{l.nota}</p>}
      </div>
      <div className="acts">
        {folder && <span className="tag" data-c={colorOf(folder)} title={folder.nome}>{folder.nome}</span>}
        <button className="btn outline sm icon" aria-label="Copiar link" title="Copiar link" onClick={() => copy(l.url)}><IcoCopy /></button>
        <a className="btn outline sm icon" href={'https://wa.me/?text=' + encodeURIComponent(titulo + '\n' + l.url)} target="_blank" rel="noopener noreferrer" aria-label="Enviar no WhatsApp" title="Enviar no WhatsApp"><IcoWhats /></a>
        <button className="btn outline sm icon" aria-label="Editar" title="Editar" onClick={() => openModal({ kind: 'link', id: l.id })}><IcoEdit /></button>
        <a className="btn outline sm" href={l.url} target="_blank" rel="noopener noreferrer">Abrir</a>
      </div>
    </article>
  );
});

function Empty({ base }: { base: number }) {
  const total = useStore(s => s.links.length), view = useStore(s => s.view), folders = useStore(s => s.folders);
  const filtered = useStore(s => filterCount(s, s.view)) > 0 && base > 0;
  let t: string, p: string;
  if (!total) { t = 'Nada salvo ainda'; p = 'Guarde aqui o que você encontra no X, Threads, Instagram, TikTok e YouTube.'; }
  else if (filtered) { t = 'Nenhum link bate com o filtro'; p = 'Limpe os filtros ou tente outra combinação.'; }
  else if (view === 'archived') { t = 'Nada arquivado'; p = 'Links arquivados saem das pastas e ficam guardados aqui. Você pode restaurar quando quiser.'; }
  else if (view === 'none') { t = 'Tudo o que você salvou está em alguma pasta'; p = 'Links sem pasta aparecem aqui.'; }
  else { t = 'Esta pasta está vazia'; p = 'O que você salvar aqui entra em ' + viewTitle(view, folders) + '.'; }
  return (
    <div className="empty">
      <b>{t}</b><p>{p}</p>
      {view !== 'archived' && !filtered && (
        <>
          <button className="btn primary" onClick={() => openAdd()}><IcoPlus />Salvar link</button>
          <p className="hint">ou cole um link em qualquer lugar desta página</p>
        </>
      )}
    </div>
  );
}

export function LinkList() {
  const loaded = useStore(s => s.loaded), loadError = useStore(s => s.loadError);
  const layout = useStore(s => s.layout), sel = useStore(s => s.sel), flash = useStore(s => s.flash);
  const folders = useStore(s => s.folders), view = useStore(s => s.view), loadingIds = useStore(s => s.loading);
  const wide = useWide(), max = useTitleMax();
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
  const more = visible.length > limit;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more) return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) setLimit(n => n + PAGE); }, { rootMargin: '900px' });
    io.observe(el);
    return () => io.disconnect();
  }, [more, limit]);

  const cls = 'list ' + (layout === 'list' && wide ? 'compact' : 'grid') + (sel.length ? ' has-sel' : '');
  const style = { marginTop: 14 };
  if (!loaded && !loadError) return <div className={cls} id="list" style={style}><div className="empty"><b>Carregando seus links</b></div></div>;
  if (loadError) return <div className={cls} id="list" style={style} />;
  if (!visible.length) return <div className={cls} id="list" style={style}><Empty base={base.length} /></div>;

  // Com seleção ativa (ou em tela de toque), tocar no cartão seleciona.
  const onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement, card = t.closest<HTMLElement>('.link');
    if (!card || t.closest('a,button,select,input,textarea,label')) return;
    if (get().sel.length || isTouch()) toggleSel(card.dataset.id!, e.shiftKey);
  };
  const byId = new Map(folders.map(f => [f.id, f]));
  const picked = new Set(sel), busy = new Set(loadingIds);
  return (
    <div className={cls} id="list" style={style} onClick={onClick}>
      {visible.slice(0, limit).map(l => (
        <LinkCard key={l.id} link={l} folder={(l.pastaId && byId.get(l.pastaId)) || null} selected={picked.has(l.id)} flash={flash === l.id} max={max} loading={busy.has(l.id)} />
      ))}
      {more && <div ref={sentinel} className="more" aria-hidden="true" />}
    </div>
  );
}
