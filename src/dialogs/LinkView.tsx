import { useEffect, useRef, useState } from 'react';
import { set, useStore } from '../store';
import { useVisible } from '../hooks/useVisible';
import { addLinkToNote, closeModal, deleteLink, dropIfEmpty, flushItems, openModal, patchItem, setArchived, startList, tagItemNew, toast } from '../actions';
import { Checklist } from '../components/Checklist';
import { isNote, ordered } from '../lib/notes';
import { tagsOf, withTag, withoutTag } from '../lib/tags';
import { IcoWhats } from '../components/icons';
import type { Link } from '../types';
import { PLAT, ago, autoTitle, originOf, summaryOf, thumbOf } from '../lib/platforms';
import { kindLabel } from '../lib/kinds';
import { colorOf, shapeOf } from '../lib/folders';
import { liveTags } from '../lib/tags';
import { isArch } from '../lib/filters';
import { IcoArchive, IcoBack, IcoCopy, IcoEdit, IcoOpen, IcoRestore, IcoTrash, IcoX } from '../components/icons';

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
/** Texto da nota para mandar a alguém: título, texto e a lista com caixinhas. */
export function noteText(l: Link): string {
  const items = ordered((l.lista || []).filter(i => i.t.trim())).map(i => (i.ok ? '☑ ' : '☐ ') + i.t.trim());
  return [l.titulo.trim() || l.tituloAuto || '', l.nota.trim(), items.join('\n'), l.url].filter(Boolean).join('\n\n');
}

/** Tags da nota escolhidas ali mesmo: tocar liga e desliga, e dá para criar uma nova sem sair. */
function TagPick({ l }: { l: Link }) {
  const folders = useStore(s => s.folders);
  const [nova, setNova] = useState(''), [err, setErr] = useState('');
  const mine = tagsOf(l);
  const live = folders.filter(f => !f.arquivadaEm);
  return (
    <div className="lv-pick">
      <div className="bd-pick">
        {live.map(f => {
          const on = mine.includes(f.id);
          return <button key={f.id} type="button" className="chip tp" data-c={colorOf(f)} data-s={shapeOf(f)} aria-pressed={on}
            onClick={() => patchItem(l.id, { pastaIds: on ? withoutTag(mine, f.id) : withTag(mine, f.id), pastaManual: true })}>{on && <span className="ck" aria-hidden="true">✓</span>}{f.nome}</button>;
        })}
      </div>
      <form className="bd-add" onSubmit={e => { e.preventDefault(); const r = tagItemNew(l.id, nova); setErr(r || ''); if (!r) setNova(''); }}>
        <span className="inw"><input type="text" value={nova} onChange={e => { setNova(e.target.value); setErr(''); }} placeholder="Nova tag" aria-label="Nova tag" maxLength={40} /></span>
        <button type="submit" className="btn outline sm" disabled={!nova.trim()}>Adicionar</button>
      </form>
      {err && <p className="msg err" role="alert">{err}</p>}
    </div>
  );
}

/** Corpo de uma nota: título, texto, lista, tags e, se quiser, um link. Grava sozinho. */
function NoteBody({ l, fresh }: { l: Link; fresh?: 'note' | 'list' }) {
  const [linkOpen, setLinkOpen] = useState(false), [raw, setRaw] = useState(''), [err, setErr] = useState('');
  const [pick, setPick] = useState(!tagsOf(l).length && !!fresh);
  const text = useRef<HTMLTextAreaElement>(null), title = useRef<HTMLInputElement>(null);
  const tags = liveTags(l, useStore(s => s.folders));
  useEffect(() => { if (fresh === 'note') title.current?.focus(); }, [fresh]);
  useEffect(() => { const t = text.current; if (t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; } }, [l.nota]);
  return (
    <>
      <input ref={title} id="lv-t" className="nt-title" value={l.titulo} placeholder="Título" aria-label="Título da nota" maxLength={140}
        onChange={e => patchItem(l.id, { titulo: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); text.current?.focus(); } }} />
      <textarea ref={text} className="nt-text" value={l.nota} placeholder="Escreva aqui" aria-label="Texto da nota" rows={2} maxLength={5000}
        onChange={e => patchItem(l.id, { nota: e.target.value })} />
      {l.lista?.length ? <Checklist link={l} autoFocus={fresh === 'list'} /> : null}
      <div className="nt-add">
        {!l.lista?.length && <button type="button" className="lv-tagbtn" onClick={() => startList(l.id)}>+ Lista</button>}
        {!linkOpen && <button type="button" className="lv-tagbtn" onClick={() => setLinkOpen(true)}>+ Link</button>}
      </div>
      {linkOpen && (
        <form className="bd-add" onSubmit={e => { e.preventDefault(); const r = addLinkToNote(l.id, raw); setErr(r || ''); if (!r) { setRaw(''); setLinkOpen(false); } }}>
          <span className="inw"><input autoFocus type="url" inputMode="url" value={raw} onChange={e => { setRaw(e.target.value); setErr(''); }} placeholder="Cole o link" aria-label="Link da nota" /></span>
          <button type="submit" className="btn outline sm" disabled={!raw.trim()}>Adicionar</button>
        </form>
      )}
      {err && <p className="msg err" role="alert">{err}</p>}
      <div className="lv-tags" aria-label="Tags">
        {tags.map(t => <span key={t.id} className="tag" data-c={colorOf(t)} data-s={shapeOf(t)}>{t.nome}</span>)}
        <button type="button" className="lv-tagbtn" aria-expanded={pick} onClick={() => setPick(!pick)}>{pick ? 'Pronto' : tags.length ? 'Mudar tags' : '+ Tag'}</button>
      </div>
      {pick && <TagPick l={l} />}
    </>
  );
}

export function LinkView({ id, fresh }: { id: string; fresh?: 'note' | 'list' }) {
  const l = useStore(s => s.links.find(x => x.id === id));
  const folders = useStore(s => s.folders);
  const root = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
  const [play, setPlay] = useState(false);
  // Anterior e próximo seguem a lista da tela, com a ordem e os filtros aplicados.
  const list = useVisible();
  const idx = list.findIndex(x => x.id === id);
  const prev = idx > 0 ? list[idx - 1].id : null, next = idx >= 0 && idx < list.length - 1 ? list[idx + 1].id : null;
  const goTo = (to: string | null) => { if (to) set({ modal: { kind: 'view', id: to } }); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.('input,textarea,select')) return;
      if (e.key === 'ArrowLeft' && prev) { e.preventDefault(); goTo(prev); }
      else if (e.key === 'ArrowRight' && next) { e.preventDefault(); goTo(next); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [prev, next]);
  // Ao sair deste item (fechar ou ir para outro): grava o que faltava e some com nota vazia.
  useEffect(() => () => { flushItems(); dropIfEmpty(id); }, [id]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    // Nota nova já abre com o cursor no campo certo; o resto começa pelo Fechar.
    if (!fresh) close.current?.focus({ preventScroll: true });
    document.body.classList.add('locked');
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeModal(); } };
    document.addEventListener('keydown', esc, true);
    return () => { document.body.classList.remove('locked'); document.removeEventListener('keydown', esc, true); if (before && document.contains(before)) before.focus(); };
  }, []);
  if (!l) return null;
  const note = isNote(l);
  const titulo = l.titulo || l.tituloAuto || autoTitle(l);
  const media = mediaOf(l), tags = liveTags(l, folders), arq = isArch(l);
  const resumo = summaryOf(l), kind = kindLabel(l.categoria), origem = originOf(l);
  const where = l.plataforma === 'web' ? 'no site' : 'no ' + PLAT[l.plataforma].label;
  // Rótulo curto: o nome da rede, ou o domínio do site.
  const label = l.plataforma === 'web' ? origem : PLAT[l.plataforma].label;
  const copy = () => navigator.clipboard?.writeText(l.url).then(() => toast('Link copiado.'), () => toast('Não consegui copiar.'));
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !root.current) return;
    const els = Array.from(root.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], iframe, input, textarea')).filter(x => x.offsetParent !== null);
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <div className="overlay lv-ov" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}>
      <div ref={root} className={note ? 'lv note' : 'lv r' + media.ratio.replace(':', 'x')} role="dialog" aria-modal="true" aria-labelledby="lv-t" onKeyDown={trap}>
        <div className="lv-top">
          <button ref={close} type="button" className="lv-x" aria-label="Fechar" onClick={closeModal}><IcoX /></button>
          {list.length > 1 && idx >= 0 && (
            <span className="lv-nav" role="group" aria-label="Navegar entre os itens">
              <button type="button" aria-label="Item anterior" title="Anterior (←)" disabled={!prev} onClick={() => goTo(prev)}><IcoBack /></button>
              <span className="lv-pos" aria-live="polite">{idx + 1} de {list.length}</span>
              <button type="button" aria-label="Próximo item" title="Próximo (→)" disabled={!next} onClick={() => goTo(next)}><IcoBack /></button>
            </span>
          )}
        </div>
        {!note && <div className="lv-media">
          {media.embed && (play || !media.image)
            ? <iframe src={media.embed} title={'Mídia de ' + titulo} allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
            : media.image
              ? <button type="button" className="lv-poster" onClick={() => media.embed ? setPlay(true) : window.open(l.url, '_blank', 'noopener')} aria-label={media.embed ? 'Tocar aqui' : 'Abrir ' + where}>
                  <img src={media.image} alt="" referrerPolicy="no-referrer" />
                  {media.embed && <span className="lv-play" aria-hidden="true" />}
                </button>
              : <div className="lv-empty" data-c={l.categoria ? undefined : 0}><b>{titulo}</b><span>{origem}</span></div>}
        </div>}
        <div className="lv-info">
          <p className="lv-meta"><span>{origem}</span>{kind && !note && <span className="kd">{kind}</span>}<span>{ago(l.criadoEm || Date.now())}</span></p>
          {note ? <NoteBody l={l} fresh={fresh} /> : <>
          <h2 id="lv-t">{titulo}</h2>
          {resumo && <p className="lv-sum">{resumo}</p>}
          {l.nota && <p className="lv-note">{l.nota}</p>}
          {l.lista?.length ? <Checklist link={l} /> : null}
          <div className="lv-tags" aria-label="Tags">
            {tags.map(t => <span key={t.id} className="tag" data-c={colorOf(t)} data-s={shapeOf(t)}>{t.nome}</span>)}
            <button type="button" className="lv-tagbtn" onClick={() => openModal({ kind: 'link', id: l.id })}>{tags.length ? 'Mudar tags' : '+ Tag'}</button>
            {!l.lista?.length && <button type="button" className="lv-tagbtn" onClick={() => startList(l.id)}>+ Lista</button>}
          </div>
          </>}
          <div className="lv-acts">
            {note
              ? <a className="btn outline sm lv-open" href={'https://wa.me/?text=' + encodeURIComponent(noteText(l))} target="_blank" rel="noopener noreferrer" aria-label="Mandar no WhatsApp" title="Mandar no WhatsApp"><IcoWhats />WhatsApp</a>
              : <a className="btn primary sm lv-open" href={l.url} target="_blank" rel="noopener noreferrer" aria-label={'Abrir ' + where + ' em nova aba'} title={'Abrir ' + where}>{label}<IcoOpen /></a>}
            <button type="button" className="btn outline sm icon" aria-label={note ? 'Copiar texto' : 'Copiar link'} title={note ? 'Copiar texto' : 'Copiar link'} onClick={note ? () => navigator.clipboard?.writeText(noteText(l)).then(() => toast('Texto copiado.'), () => toast('Não consegui copiar.')) : copy}><IcoCopy /></button>
            {!note && <button type="button" className="btn outline sm icon" aria-label="Editar" title="Editar" onClick={() => openModal({ kind: 'link', id: l.id })}><IcoEdit /></button>}
            <button type="button" className="btn outline sm icon" aria-label={arq ? 'Restaurar' : 'Arquivar'} title={arq ? 'Restaurar' : 'Arquivar'} onClick={() => { const to = next || prev; setArchived([l], arq); if (to) goTo(to); else closeModal(); }}>{arq ? <IcoRestore /> : <IcoArchive />}</button>
            <button type="button" className="btn outline sm icon danger" aria-label="Excluir" title="Excluir" onClick={() => { const to = next || prev; deleteLink(l.id); if (to) goTo(to); else closeModal(); }}><IcoTrash /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
