import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { get, set, useStore, type Theme } from '../store';
import { capture, go, looksLikeLink, pasteFromClipboard, setAi, setProfileOpen, setTheme, signOut } from '../actions';
import { useCounts } from '../hooks/useVisible';
import { isTouch } from '../hooks/useMedia';
import { CFG } from '../config';
import { kindLabel } from '../lib/kinds';
import { autoTitle } from '../lib/platforms';
import { liveTags } from '../lib/tags';
import { FilterGroups } from './Toolbar';
import { IcoArchive, IcoGear, IcoPaste, IcoSearch, IcoUser, IcoX } from './icons';

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
export const PASTE_KEY = MAC ? '⌘V' : 'Ctrl+V';

type StepState = 'wait' | 'run' | 'done' | 'skip';
function Step({ state, text }: { state: StepState; text: string }) {
  return <li data-s={state}><span className="sb" aria-hidden="true" /><span>{text}</span></li>;
}

/** Passos da montagem do último link colado. Some sozinho alguns segundos depois de pronto. */
function Building() {
  const id = useStore(s => s.building);
  const l = useStore(s => s.links.find(x => x.id === s.building));
  const reading = useStore(s => !!s.building && s.loading.includes(s.building));
  const aiRun = useStore(s => !!s.building && s.aiBusy.includes(s.building));
  const aiOn = useStore(s => s.ai) && !!CFG.summarizeApi;
  const folders = useStore(s => s.folders);
  const tags = l ? liveTags(l, folders) : [];
  const read = !!l && (!!l.tituloAuto || !!l.thumb || !!l.descricao);
  const aiDone = !!l && (!!l.iaEm || !!l.resumoIA);
  const done = !!l && !reading && (!aiOn || !read || (!aiRun && aiDone) || (!aiRun && !!l.enriquecido && !read));
  useEffect(() => {
    if (!id) return;
    if (!l) { set({ building: null }); return; }
    if (!done) return;
    const t = setTimeout(() => { if (get().building === id) set({ building: null }); }, 4500);
    return () => clearTimeout(t);
  }, [id, l, done]);
  if (!l) return null;
  const ai: StepState = !aiOn ? 'skip' : reading ? 'wait' : !read ? 'skip' : aiRun || !aiDone ? 'run' : 'done';
  const kt = [kindLabel(l.categoria), l.tema ? 'tema ' + l.tema : ''].filter(Boolean).join(', ');
  return (
    <div className="building" role="status" aria-live="polite">
      <div className="bd-h"><b title={l.titulo || l.tituloAuto || autoTitle(l)}>{l.titulo || l.tituloAuto || autoTitle(l)}</b>
        <button type="button" className="bd-x" aria-label="Fechar" onClick={() => set({ building: null })}><IcoX /></button></div>
      <ol className="steps">
        <Step state={reading ? 'run' : read ? 'done' : 'skip'} text={reading ? 'Lendo a página' : read ? 'Título e imagem lidos' : 'A página não deixou ler'} />
        {aiOn && <Step state={ai === 'done' && !l.resumoIA ? 'skip' : ai} text={ai === 'run' ? 'Resumindo o conteúdo' : ai === 'done' ? (l.resumoIA ? 'Resumo pronto' : 'Sem resumo desta vez') : ai === 'skip' ? 'Sem resumo' : 'Resumir o conteúdo'} />}
        {aiOn && <Step state={ai === 'done' && !kt ? 'skip' : ai} text={ai === 'run' ? 'Identificando o que é e o tema' : ai === 'done' ? (kt || 'Tipo não identificado') : ai === 'skip' ? 'Sem tipo' : 'Identificar o que é'} />}
        <Step state={done ? 'done' : 'wait'} text={tags.length ? 'Tags: ' + tags.map(t => t.nome).join(', ') : done ? 'Cartão pronto' : 'Organizar em tags'} />
      </ol>
    </div>
  );
}

/**
 * Omni-bar: cola ou busca.
 * Colar um link (ou o botão Colar, ou Enter com um link) salva na hora. Texto comum filtra os cartões enquanto digita.
 * Focar sem texto abre os filtros rápidos.
 */
function OmniBar() {
  const q = useStore(s => s.q), clip = useStore(s => s.clip), view = useStore(s => s.view);
  const input = useRef<HTMLInputElement>(null), wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const canSearch = view !== 'tags' && view !== 'settings';

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !t.closest?.('input,textarea,select,[contenteditable]') && !get().modal) { e.preventDefault(); input.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!open) return;
    const out = (e: Event) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', out, true);
    return () => document.removeEventListener('pointerdown', out, true);
  }, [open]);

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const txt = e.clipboardData.getData('text');
    if (!looksLikeLink(txt) || input.current?.value.trim()) return;
    e.preventDefault();
    if (capture(txt)) { setOpen(false); input.current?.blur(); }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && looksLikeLink(q)) { e.preventDefault(); if (capture(q)) { set({ q: '' }); setOpen(false); input.current?.blur(); } }
    else if (e.key === 'Escape') { if (q) set({ q: '' }); else { setOpen(false); input.current?.blur(); } }
  };
  const isLink = looksLikeLink(q);

  return (
    <div className={'omni' + (open ? ' open' : '')} ref={wrap}>
      <label className="omni-f">
        <IcoSearch />
        <span className="sr">Colar um link ou buscar</span>
        <input ref={input} id="q" type="search" enterKeyHint={isLink ? 'done' : 'search'} autoComplete="off" autoCapitalize="off" spellCheck={false}
          placeholder={canSearch ? 'Cole um link ou busque' : 'Cole um link'} value={q}
          onChange={e => { set({ q: e.target.value }); if (canSearch && e.target.value && !looksLikeLink(e.target.value) && view !== 'all' && view !== 'none' && !get().folders.some(f => f.id === view) && view !== 'archived') go('all'); }}
          onFocus={() => setOpen(true)} onPaste={onPaste} onKeyDown={onKeyDown}
          aria-describedby="omni-hint" />
        {q
          ? (isLink
            ? <button type="button" className="omni-btn pri" onClick={() => { if (capture(q)) set({ q: '' }); }}>Salvar</button>
            : <button type="button" className="omni-btn" aria-label="Limpar busca" onClick={() => { set({ q: '' }); input.current?.focus(); }}><IcoX /></button>)
          : <button type="button" className={'omni-btn' + (clip ? ' pri' : '')} onClick={() => void pasteFromClipboard(PASTE_KEY)} title={clip ? 'Salvar o link copiado' : 'Colar o link copiado'}><IcoPaste /><span>{clip ? 'Colar link' : 'Colar'}</span></button>}
      </label>
      <span id="omni-hint" className="sr">Colar um link salva na hora. Digitar busca nos seus links. Atalho: barra.</span>
      {open && !q && canSearch && (
        <div className="omni-pop" role="group" aria-label="Filtros rápidos">
          <FilterGroups />
        </div>
      )}
    </div>
  );
}

const THEMES: [Theme, string][] = [['light', 'Claro'], ['dark', 'Escuro'], ['system', 'Sistema']];

/** Perfil: tudo o que não é conteúdo mora aqui. Popover no mouse, folha na base no toque. */
function Profile() {
  const open = useStore(s => s.profileOpen), profile = useStore(s => s.profile), mode = useStore(s => s.mode);
  const theme = useStore(s => s.theme), ai = useStore(s => s.ai);
  const c = useCounts();
  const btn = useRef<HTMLButtonElement>(null), pop = useRef<HTMLDivElement>(null);
  const sheet = open && isTouch();
  const initial = (profile.nome || profile.email || '').trim().charAt(0).toUpperCase();
  useEffect(() => {
    if (!open) return;
    pop.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    const out = (e: Event) => { const t = e.target as HTMLElement; if (!pop.current?.contains(t) && !btn.current?.contains(t)) setProfileOpen(false); };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { setProfileOpen(false); btn.current?.focus(); } };
    document.addEventListener('pointerdown', out, true);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', out, true); document.removeEventListener('keydown', esc); };
  }, [open]);
  const goTo = (v: string) => () => { setProfileOpen(false); go(v); };
  const body = (
    <div ref={pop} className={'prof' + (sheet ? ' sheet' : '')} role="dialog" aria-label="Perfil">
      <div className="pf-who">
        <span className="pf-av" aria-hidden="true">{initial || <IcoUser />}</span>
        <span className="pf-id"><b>{profile.nome || (mode === 'cloud' ? 'Sua conta' : 'Neste aparelho')}</b><span>{profile.email || (mode === 'cloud' ? '' : 'Seus links ficam só neste navegador')}</span></span>
      </div>
      <button type="button" className="pf-row" onClick={goTo('archived')}><IcoArchive /><span>Arquivados</span><span className="pf-n">{c.arch}</span></button>
      {CFG.summarizeApi && (
        <div className="pf-row pf-sw">
          <span className="pf-t"><b>Ordem automática</b><span>{ai ? 'A IA resume, identifica e organiza em tags.' : 'Pausada. Nada novo vai para a IA.'}</span></span>
          <button type="button" role="switch" aria-checked={ai} aria-label="Ordem automática" className="tgl" onClick={() => setAi(!ai)}><span /></button>
        </div>
      )}
      <div className="pf-row pf-theme">
        <span className="pf-t"><b>Aparência</b></span>
        <div className="seg txt" role="group" aria-label="Aparência">{THEMES.map(([k, label]) => <button key={k} type="button" aria-pressed={theme === k} onClick={() => setTheme(k)}>{label}</button>)}</div>
      </div>
      <button type="button" className="pf-row" onClick={goTo('settings')}><IcoGear /><span>Conta, tags e dados</span></button>
      {mode === 'cloud' && <button type="button" className="pf-row pf-out" onClick={() => { setProfileOpen(false); signOut(); }}>Sair</button>}
    </div>
  );
  return (
    <>
      <button ref={btn} type="button" className="avatar" aria-haspopup="dialog" aria-expanded={open} aria-label="Perfil e ajustes" title="Perfil e ajustes" onClick={() => setProfileOpen(!open)}>
        {initial || <IcoUser />}
      </button>
      {open && (sheet ? createPortal(<><div className="cmenu-bd" aria-hidden="true" />{body}</>, document.body) : body)}
    </>
  );
}

/** Aba Tudo | Tags. Dentro de uma tag, "Tags" segue marcada. */
function Tabs() {
  const view = useStore(s => s.view);
  const onTags = view !== 'all' && view !== 'archived' && view !== 'settings';
  return (
    <div className="tabs" role="tablist" aria-label="Seções">
      <button type="button" role="tab" aria-selected={view === 'all'} onClick={() => go('all')}>Tudo</button>
      <button type="button" role="tab" aria-selected={onTags} onClick={() => go('tags')}>Tags</button>
    </div>
  );
}

/** Esconde a segunda linha do cabeçalho ao descer (celular) e mostra ao subir. */
function useCollapse() {
  const [min, setMin] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY, d = y - last;
      if (Math.abs(d) < 6) return;
      setMin(y > 80 && d > 0);
      last = y;
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return min;
}

/** Cabeçalho: só Tudo | Tags, a omni-bar e o perfil. */
export function Header() {
  const min = useCollapse();
  const scrolled = useScrolled();
  return (
    <header className={'hdr' + (min ? ' min' : '') + (scrolled ? ' scrolled' : '')}>
      <div className="hdr-in">
        <Tabs />
        <OmniBar />
        <Profile />
      </div>
      <Building />
    </header>
  );
}

function useScrolled() {
  const [s, setS] = useState(false);
  useEffect(() => {
    const on = () => setS(window.scrollY > 4);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return s;
}

