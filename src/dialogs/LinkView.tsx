import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { closeModal, deleteLink, openModal, setArchived, toast } from '../actions';
import type { Link } from '../types';
import { PLAT, ago, autoTitle, originOf, summaryOf, thumbOf } from '../lib/platforms';
import { kindLabel } from '../lib/kinds';
import { colorOf, shapeOf } from '../lib/folders';
import { liveTags } from '../lib/tags';
import { isArch } from '../lib/filters';
import { IcoArchive, IcoCopy, IcoEdit, IcoOpen, IcoRestore, IcoTrash, IcoX } from '../components/icons';

export type Ratio = '9:16' | '1:1' | '16:9';
interface Media { ratio: Ratio; embed?: string; image?: string }

/** Decide o que mostrar e em que proporção, pela origem. Vídeo vertical em 9:16, post quadrado em 1:1, o resto em 16:9. */
export function mediaOf(l: Link): Media {
  const u = (() => { try { return new URL(l.url); } catch { return null; } })();
  const img = thumbOf(l) || undefined;
  if (!u) return { ratio: '16:9', image: img };
  const path = u.pathname;
  if (l.plataforma === 'youtube') {
    const short = path.match(/\/shorts\/([\w-]{6,})/);
    const id = short?.[1] || u.searchParams.get('v') || (u.hostname.includes('youtu.be') ? path.slice(1).split('/')[0] : '') || path.match(/\/(?:embed|live)\/([\w-]{6,})/)?.[1];
    if (id) return { ratio: short ? '9:16' : '16:9', embed: 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&playsinline=1', image: img };
  }
  if (l.plataforma === 'tiktok') {
    const v = path.match(/\/video\/(\d+)/);
    if (v) return { ratio: '9:16', embed: 'https://www.tiktok.com/player/v1/' + v[1] + '?description=1&music_info=1', image: img };
    return { ratio: '9:16', image: img };
  }
  if (l.plataforma === 'instagram') {
    const m = path.match(/\/(p|reel|reels|tv)\/([\w-]+)/);
    if (m) {
      const reel = m[1] !== 'p';
      return { ratio: reel ? '9:16' : '1:1', embed: 'https://www.instagram.com/' + (reel ? 'reel' : 'p') + '/' + m[2] + '/embed/', image: img };
    }
  }
  if (l.plataforma === 'x' || l.plataforma === 'threads') return { ratio: '1:1', image: img };
  return { ratio: '16:9', image: img };
}

/** Link aberto no app: mídia na proporção da origem, título, resumo, tags e ações. Tela cheia até tablet, janela no desktop. */
export function LinkView({ id }: { id: string }) {
  const l = useStore(s => s.links.find(x => x.id === id));
  const folders = useStore(s => s.folders);
  const root = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    close.current?.focus({ preventScroll: true });
    document.body.classList.add('locked');
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeModal(); } };
    document.addEventListener('keydown', esc, true);
    return () => { document.body.classList.remove('locked'); document.removeEventListener('keydown', esc, true); if (before && document.contains(before)) before.focus(); };
  }, []);
  if (!l) return null;
  const titulo = l.titulo || l.tituloAuto || autoTitle(l);
  const media = mediaOf(l), tags = liveTags(l, folders), arq = isArch(l);
  const resumo = summaryOf(l), kind = kindLabel(l.categoria), origem = originOf(l);
  const where = l.plataforma === 'web' ? 'no site' : 'no ' + PLAT[l.plataforma].label;
  const copy = () => navigator.clipboard?.writeText(l.url).then(() => toast('Link copiado.'), () => toast('Não consegui copiar.'));
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !root.current) return;
    const els = Array.from(root.current.querySelectorAll<HTMLElement>('button, a[href], iframe')).filter(x => x.offsetParent !== null);
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <div className="overlay lv-ov" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}>
      <div ref={root} className={'lv r' + media.ratio.replace(':', 'x')} role="dialog" aria-modal="true" aria-labelledby="lv-t" onKeyDown={trap}>
        <div className="lv-top">
          <button ref={close} type="button" className="lv-x" aria-label="Fechar" onClick={closeModal}><IcoX /></button>
          <a className="btn primary sm lv-open" href={l.url} target="_blank" rel="noopener noreferrer"><IcoOpen />Abrir {where}</a>
        </div>
        <div className="lv-media">
          {media.embed && (play || !media.image)
            ? <iframe src={media.embed} title={'Mídia de ' + titulo} allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
            : media.image
              ? <button type="button" className="lv-poster" onClick={() => media.embed ? setPlay(true) : window.open(l.url, '_blank', 'noopener')} aria-label={media.embed ? 'Tocar aqui' : 'Abrir ' + where}>
                  <img src={media.image} alt="" referrerPolicy="no-referrer" />
                  {media.embed && <span className="lv-play" aria-hidden="true" />}
                </button>
              : <div className="lv-empty" data-c={l.categoria ? undefined : 0}><b>{titulo}</b><span>{origem}</span></div>}
        </div>
        <div className="lv-info">
          <p className="lv-meta"><span>{origem}</span>{kind && <span className="kd">{kind}</span>}<span>{ago(l.criadoEm || Date.now())}</span></p>
          <h2 id="lv-t">{titulo}</h2>
          {resumo && <p className="lv-sum">{resumo}</p>}
          {l.nota && <p className="lv-note">{l.nota}</p>}
          <div className="lv-tags" aria-label="Tags">
            {tags.map(t => <span key={t.id} className="tag" data-c={colorOf(t)} data-s={shapeOf(t)}>{t.nome}</span>)}
            <button type="button" className="lv-tagbtn" onClick={() => openModal({ kind: 'link', id: l.id })}>{tags.length ? 'Mudar tags' : '+ Tag'}</button>
          </div>
          <div className="lv-acts">
            <button type="button" className="btn outline sm" onClick={copy}><IcoCopy />Copiar link</button>
            <button type="button" className="btn outline sm" onClick={() => openModal({ kind: 'link', id: l.id })}><IcoEdit />Editar</button>
            <button type="button" className="btn outline sm" onClick={() => { closeModal(); setArchived([l], arq); }}>{arq ? <IcoRestore /> : <IcoArchive />}{arq ? 'Restaurar' : 'Arquivar'}</button>
            <button type="button" className="btn outline sm danger" onClick={() => { closeModal(); deleteLink(l.id); }}><IcoTrash />Excluir</button>
          </div>
        </div>
      </div>
    </div>
  );
}
