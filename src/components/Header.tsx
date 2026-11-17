import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { get, set, useStore, type Theme } from '../store';
import { acceptClip, createNote, openModal, openGuide, cancelBuild, containsLink, capture, confirmCapture, go, skipBuild, looksLikeLink, pasteFromClipboard, setAi, setProfileOpen, setTheme, signOut } from '../actions';
import { useCounts } from '../hooks/useVisible';
import { isTouch } from '../hooks/useMedia';
import { CFG } from '../config';
import { kindLabel } from '../lib/kinds';
import { tagsOf } from '../lib/tags';
import { platform, setupDone, type Setup } from '../lib/setup';
import { storeOf } from '../lib/stores';
import { shortUrl, thumbOf } from '../lib/platforms';
import { flyToCard } from '../lib/fly';
import { temaKey } from '../lib/auto';
import { sameName } from '../lib/folders';
import { colorOf, shapeOf } from '../lib/folders';
import { FilterGroups } from './Toolbar';
import { IcoApp, IcoArchive, IcoCheck, IcoGear, IcoChecklist, IcoNote, IcoPaste, IcoPlus, IcoSearch, IcoTag, IcoUser, IcoX } from './icons';

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
export const PASTE_KEY = MAC ? '⌘V' : 'Ctrl+V';

type StepState = 'wait' | 'run' | 'done' | 'skip';
function Step({ state, text }: { state: StepState; text: string }) {
  return <li data-s={state}><span className="sb" aria-hidden="true" /><span>{text}</span></li>;
}

/**
 * Passos da montagem do último link colado e, no fim, a confirmação.
 * A IA lê a página, resume, identifica o tipo e o tema e sugere título e tag. A pessoa sempre confirma:
 * o título vem preenchido (ou em branco, se a página não deixou ler) e a tag sugerida vem marcada
 * (ou nenhuma, se a IA não achou tema). Só fecha com título e pelo menos uma tag.
 */
function Building() {
  const id = useStore(s => s.building);
  const l = useStore(s => s.links.find(x => x.id === s.building));
  const reading = useStore(s => !!s.building && s.loading.includes(s.building));
  const aiRun = useStore(s => !!s.building && s.aiBusy.includes(s.building));
  const aiOn = useStore(s => s.ai) && !!CFG.summarizeApi;
  const folders = useStore(s => s.folders);
  const live = folders.filter(f => !f.arquivadaEm);
  const read = !!l && (!!l.tituloAuto || !!l.thumb || !!l.descricao);
  const aiDone = !!l && (!!l.iaEm || !!l.resumoIA);
  // Só conta como pronto depois que a leitura da página começou e terminou (ou não há leitura configurada).
  const sawRead = useRef<string | null>(null);
  if (reading && id) sawRead.current = id;
  const attempted = !!l && (!!l.enriquecido || sawRead.current === l.id || !CFG.previewApi);
  const sawAi = useRef<string | null>(null);
  if (aiRun && id) sawAi.current = id;
  const done = !!l && attempted && !reading && (!aiOn || !read || (!aiRun && (aiDone || sawAi.current === l.id)));

  // Formulário de confirmação: preenchido uma vez, quando a IA termina.
  const [titulo, setTitulo] = useState(''), [sel, setSel] = useState<string[]>([]), [novas, setNovas] = useState<string[]>([]);
  const [nova, setNova] = useState(''), [filled, setFilled] = useState(''), [tried, setTried] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null), panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!l || !done || filled === l.id) return;
    setFilled(l.id); setTried(false); setNova('');
    const loja = storeOf(l.url);
    setTitulo((l.titulo || l.tituloAuto || loja?.title || '').trim());
    // Loja que não deixa ler a página: sem tema da IA, sugere a tag de compras.
    const tema = (l.tema || '').trim() || (loja ? 'Compras' : '');
    const mine = tagsOf(l).filter(t => live.some(f => f.id === t));
    const match = tema ? live.find(f => temaKey(f.nome) === temaKey(tema)) || (loja ? live.find(f => /^(compras?|lojas?|comprinhas)$/i.test(f.nome.trim())) : undefined) : undefined;
    setSel(mine.length ? mine : match ? [match.id] : []);
    setNovas(!mine.length && !match && tema ? [tema.charAt(0).toUpperCase() + tema.slice(1)] : []);
    setTimeout(() => { if (!(l.titulo || l.tituloAuto)) titleRef.current?.focus(); }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l, done, filled]);
  useEffect(() => { if (id && !l) skipBuild(); }, [id, l]);
  const queued = useStore(s => s.buildQueue.length);
  if (!l) return null;

  const loja = storeOf(l.url);
  const ai: StepState = !aiOn ? 'skip' : reading ? 'wait' : !read ? 'skip' : aiRun || (!aiDone && !done) ? 'run' : 'done';
  const kt = [kindLabel(l.categoria), l.tema ? 'tema ' + l.tema : ''].filter(Boolean).join(', ');
  const nTags = sel.length + novas.length;
  const addNova = () => {
    const n = nova.trim();
    if (!n) return;
    const ex = live.find(f => sameName(f.nome, n));
    if (ex) setSel(v => v.includes(ex.id) ? v : [...v, ex.id]);
    else if (!novas.some(x => sameName(x, n))) setNovas(v => [...v, n]);
    setNova('');
  };
  const confirm = () => {
    setTried(true);
    if (!titulo.trim() || !nTags) { (!titulo.trim() ? titleRef.current : document.getElementById('bd-nova'))?.focus(); return; }
    const from = panel.current?.getBoundingClientRect() || null;
    const names = [...novas, ...sel.map(t => live.find(f => f.id === t)?.nome || '')].filter(Boolean);
    void confirmCapture(l.id, titulo.trim(), sel, novas, loja && !l.categoria ? { categoria: 'loja' } : undefined).then(() => flyToCard(l.id, from, titulo.trim(), names, thumbOf(l)));
  };
  return (
    <div className="building" ref={panel} role="region" aria-label="Novo link">
      <div className="bd-h"><b>{done ? 'Confira e salve' : 'Montando o cartão'}{queued > 1 ? ' (1 de ' + queued + ')' : ''}</b>
        <button type="button" className="bd-x" aria-label="Cancelar e descartar o link" title="Cancelar" onClick={cancelBuild}><IcoX /></button></div>
      <ol className="steps" aria-live="polite">
        <Step state={reading ? 'run' : read ? 'done' : 'skip'} text={reading ? 'Lendo a página' : read ? (l.notaColada && !l.thumb ? 'Título tirado do texto que veio com o link' : 'Título e imagem lidos') : loja ? loja.name + ' não deixa ler a página' + (loja.title ? ', o nome veio do endereço' : '. Escreva o nome do produto') : 'A página não deixou ler, preencha você'} />
        {aiOn && <Step state={ai === 'done' && !l.resumoIA ? 'skip' : ai} text={ai === 'run' ? 'Resumindo o conteúdo' : ai === 'done' ? (l.resumoIA ? 'Resumo pronto' : 'Sem resumo desta vez') : ai === 'skip' ? 'Sem resumo' : 'Resumir o conteúdo'} />}
        {loja && !read ? <Step state="done" text="Loja, reconhecida pelo endereço" /> : aiOn && <Step state={ai === 'done' && !kt ? 'skip' : ai} text={ai === 'run' ? 'Identificando o que é e o tema' : ai === 'done' ? (kt || 'Tipo e tema não identificados') : ai === 'skip' ? 'Sem tipo' : 'Identificar o que é'} />}
        <Step state={done ? 'run' : 'wait'} text={done ? 'Confirme o título e as tags' : 'Sugerir título e tags'} />
      </ol>
      {done && (
        <form className="bd-form" onSubmit={e => { e.preventDefault(); confirm(); }} noValidate>
          {l.resumoIA && <p className="bd-sum">{l.resumoIA}</p>}
          <label className="f" htmlFor="bd-t">Título{!titulo.trim() && <span className="bd-req"> obrigatório</span>}
            <span className="inw"><input ref={titleRef} id="bd-t" type="text" value={titulo} placeholder="Escreva um título" aria-invalid={tried && !titulo.trim() || undefined} onChange={e => setTitulo(e.target.value)} /></span>
          </label>
          <div className="f" role="group" aria-labelledby="bd-tl">
            <span id="bd-tl">Tags{!nTags && <span className="bd-req"> escolha ao menos uma</span>}</span>
            <div className="bd-pick">
              {novas.map(n => <button key={'n' + n} type="button" className="chip tp" aria-pressed="true" data-c="0" onClick={() => setNovas(v => v.filter(x => x !== n))}><span className="ck" aria-hidden="true">✓</span>{n}<span className="bd-new"> nova</span></button>)}
              {live.map(f => {
                const on = sel.includes(f.id);
                return <button key={f.id} type="button" className="chip tp" aria-pressed={on} data-c={colorOf(f)} data-s={shapeOf(f)} onClick={() => setSel(v => on ? v.filter(x => x !== f.id) : [...v, f.id])}>{on && <span className="ck" aria-hidden="true">✓</span>}{f.nome}</button>;
              })}
            </div>
            <span className="bd-add">
              <span className="inw"><input id="bd-nova" type="text" value={nova} placeholder="Nova tag" aria-label="Nova tag" onChange={e => setNova(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNova(); } }} /></span>
              <button type="button" className="btn outline sm" onClick={addNova} disabled={!nova.trim()}>Adicionar</button>
            </span>
          </div>
          {tried && (!titulo.trim() || !nTags) && <p className="msg err" role="alert">{!titulo.trim() ? 'Escreva um título.' : 'Escolha ou crie uma tag.'}</p>}
          <div className="bd-btns">
            <button type="button" className="btn outline" onClick={cancelBuild}>Cancelar</button>
            <button type="submit" className="btn primary">Salvar</button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Omni-bar: cola ou busca.
 * Só busca: filtra links, notas e tags enquanto digita. Se o texto for um link, oferece Salvar, mas colar aqui não salva sozinho.
 * Focar sem texto abre os filtros rápidos.
 */
function OmniBar() {
  const q = useStore(s => s.q), view = useStore(s => s.view);
  const input = useRef<HTMLInputElement>(null), wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // O painel de filtros usa quase toda a largura da tela, preso logo abaixo da barra.
  const [popTop, setPopTop] = useState(0);
  useEffect(() => {
    if (!open) return;
    const place = () => { const r = wrap.current?.getBoundingClientRect(); if (r) setPopTop(Math.round(r.bottom + 8)); };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place); };
  }, [open]);
  const canSearch = view !== 'settings';
  // Filtros rápidos só valem para links. Na grade de tags eles não teriam efeito.
  const canFilter = canSearch && view !== 'tags';

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

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && looksLikeLink(q)) { e.preventDefault(); if (capture(q)) { set({ q: '' }); setOpen(false); input.current?.blur(); } }
    else if (e.key === 'Escape') { if (q) set({ q: '' }); else { setOpen(false); input.current?.blur(); } }
  };
  const isLink = looksLikeLink(q);
  // Começou a montar um link (colar aqui, botão Colar ou Ctrl+V em qualquer lugar): o painel de filtros sai da frente.
  const building = useStore(s => s.building);
  useEffect(() => { if (building) { setOpen(false); input.current?.blur(); } }, [building]);
  const modal = useStore(s => !!s.modal);
  useEffect(() => { if (modal) setOpen(false); }, [modal]);

  return (
    <div className={'omni' + (open ? ' open' : '')} ref={wrap}>
      <label className="omni-f">
        <IcoSearch />
        <span className="sr">Buscar</span>
        <input ref={input} id="q" type="search" enterKeyHint={isLink ? 'done' : 'search'} autoComplete="off" autoCapitalize="off" spellCheck={false}
          placeholder="Buscar links, notas e tags" value={q}
          onChange={e => { const v = e.target.value; if (!canSearch && v && !looksLikeLink(v)) go('all'); set({ q: v }); }}
          onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
          aria-describedby="omni-hint" />
        {q && (isLink
          ? <button type="button" className="omni-btn pri" onClick={() => { if (capture(q)) set({ q: '' }); }}>Salvar</button>
          : <button type="button" className="omni-btn" aria-label="Limpar busca" onClick={() => { set({ q: '' }); input.current?.focus(); }}><IcoX /></button>)}
      </label>
      <span id="omni-hint" className="sr">Busca nos seus links, notas e tags. Para salvar, use o botão Novo. Atalho: barra.</span>
      {open && !q && canFilter && (
        <div className="omni-pop" role="group" aria-label="Filtros rápidos" style={{ top: popTop }}>
          <FilterGroups />
        </div>
      )}
    </div>
  );
}

/** Botão Novo: salvar um link, escrever uma nota ou lista, criar uma tag. Popover no mouse, folha na base no toque. */
function NewButton() {
  const open = useStore(s => s.newMenu), clip = useStore(s => s.clip);
  const btn = useRef<HTMLButtonElement>(null), pop = useRef<HTMLDivElement>(null);
  const [raw, setRaw] = useState('');
  const sheet = open && isTouch();
  const close = (focus = false) => { set({ newMenu: false }); setRaw(''); if (focus) btn.current?.focus(); };
  // Atalho N abre o menu, fora de campos de texto.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey && !t.closest?.('input,textarea,select,[contenteditable]') && !get().modal) { e.preventDefault(); set({ newMenu: true }); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!open) return;
    if (!isTouch()) pop.current?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
    const out = (e: Event) => { const t = e.target as HTMLElement; if (!pop.current?.contains(t) && !btn.current?.contains(t)) close(); };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close(true); };
    document.addEventListener('pointerdown', out, true);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', out, true); document.removeEventListener('keydown', esc); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = (txt: string) => { if (capture(txt)) close(); };
  const body = (
    <div ref={pop} className={'prof newm' + (sheet ? ' sheet' : '')} role="dialog" aria-label="Novo">
      {clip && (
        <button type="button" className="pf-row nm-clip" onClick={() => { close(); acceptClip(); }}>
          <IcoPaste /><span className="pf-t"><b>Salvar o link copiado</b><span>{shortUrl(clip.url)}</span></span>
        </button>
      )}
      <form className="bd-add nm-link" onSubmit={e => { e.preventDefault(); if (raw.trim()) save(raw); }}>
        <span className="inw"><input id="nm-raw" type="text" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} value={raw} placeholder="Cole um link" aria-label="Link para salvar"
          onChange={e => setRaw(e.target.value)} onPaste={e => { const t = e.clipboardData.getData('text'); if (containsLink(t)) { e.preventDefault(); save(t); } }} /></span>
        {raw.trim()
          ? <button type="submit" className="btn primary sm">Salvar</button>
          : <button type="button" className="btn outline sm" onClick={() => { void pasteFromClipboard(PASTE_KEY).then(ok => { if (ok) close(); }); }}><IcoPaste />Colar</button>}
      </form>
      <button type="button" className="pf-row" onClick={() => createNote(false)}><IcoNote /><span className="pf-t"><b>Nota</b><span>Texto livre</span></span></button>
      <button type="button" className="pf-row" onClick={() => createNote(true)}><IcoChecklist /><span className="pf-t"><b>Lista</b><span>Coisas a comprar ou a fazer</span></span></button>
      <button type="button" className="pf-row" onClick={() => { close(); openModal({ kind: 'new', then: { type: 'stay' } }); }}><IcoTag /><span className="pf-t"><b>Tag</b><span>Para juntar links e notas de um assunto</span></span></button>
    </div>
  );
  return (
    <div className="newwrap">
      <button ref={btn} type="button" className="btn primary newbtn" aria-haspopup="dialog" aria-expanded={open} aria-label="Novo: link, nota, lista ou tag" title="Novo (N)"
        onClick={() => { setProfileOpen(false); set({ newMenu: !open }); }}><IcoPlus /><span>Novo</span></button>
      {open && (sheet ? createPortal(<><div className="cmenu-bd" aria-hidden="true" />{body}</>, document.body) : body)}
    </div>
  );
}

/** "Seu disorder 100%": os passos que deixam salvar links sem copiar e colar. Cada um abre a explicação. */
function SetupList() {
  const setup = useStore(s => s.setup);
  const ios = platform() === 'ios';
  const n = setupDone(setup);
  const items: [keyof Setup, string, string][] = [
    ['app', 'Instalar o app', ios ? 'Safari, Compartilhar, Adicionar à Tela de Início' : 'Chrome, menu ⋮, Instalar app'],
    ['share', ios ? 'Criar o atalho de compartilhar' : 'Salvar pelo Compartilhar', ios ? 'Salvar no disorder direto de qualquer app' : 'O disorder aparece no Compartilhar dos apps'],
  ];
  return (
    <div className="pf-setup" role="group" aria-labelledby="pf-setup-t">
      <div className="pf-sh"><b id="pf-setup-t">Seu disorder {n === 2 ? '100%' : n === 1 ? '50%' : '0%'}</b><span className="pf-bar" aria-hidden="true"><span style={{ width: n * 50 + '%' }} /></span></div>
      {items.map(([k, t, d]) => (
        <button key={k} type="button" className={'pf-row pf-todo' + (setup[k] ? ' done' : '')} onClick={() => openGuide(k)}>
          <span className="pf-ck" aria-hidden="true">{setup[k] && <IcoCheck />}</span>
          <span className="pf-t"><b>{t}</b><span>{d}</span></span>
          <span className="sr">{setup[k] ? ', feito' : ', a fazer'}</span>
        </button>
      ))}
    </div>
  );
}

/** Ícone de app ao lado do perfil enquanto falta algum passo. Abre a explicação de instalar e compartilhar. */
function AppButton() {
  const setup = useStore(s => s.setup);
  if (setup.app && setup.share) return null;
  return (
    <button type="button" className="appbtn" aria-label="Instalar o app e salvar pelo Compartilhar" title="Instalar o app" onClick={() => openGuide(setup.app ? 'share' : 'app')}>
      <IcoApp />
    </button>
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
      <SetupList />
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
        <div className="hdr-mid"><OmniBar /><NewButton /></div>
        <div className="hdr-r"><AppButton /><Profile /></div>
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

