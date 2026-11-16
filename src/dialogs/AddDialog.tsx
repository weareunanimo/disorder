import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { set, useStore } from '../store';
import { clipCandidate, closeAdd, describeError, folderById, goTo, openModal, restoreLink, submitAdd, toast, type PvSnap } from '../actions';
import { fetchPreview, summarize, type Resumo } from '../data/previews';
import { temaKey } from '../lib/auto';
import { kindLabel } from '../lib/kinds';
import { CFG } from '../config';
import { PLAT, autoTitle, fmtDuration, isParsed, parseLink, type Parsed } from '../lib/platforms';
import type { PreviewData } from '../types';
import { useSortedFolders } from '../hooks/useVisible';
import { Preview } from '../components/LinkList';
import { IcoX } from '../components/icons';
import { Modal } from './Modal';
import { TagPicker } from '../components/TagPicker';
import { tagsOf, withTag, withoutTag } from '../lib/tags';

const MANY = /https?:\/\/\S+[\s\S]*https?:\/\/\S+/i;
interface Msg { text: string; kind: 'ok' | 'err'; label?: string; fn?: () => void }

type StepState = 'wait' | 'run' | 'done' | 'skip';
/** Um passo da montagem do cartão: o que a IA está fazendo e o que já entregou. */
function Step({ state, wait, run, done, skip }: { state: StepState; wait?: string; run?: string; done: string; skip?: string }) {
  const text = state === 'done' ? done : state === 'run' ? run || done : state === 'skip' ? skip || done : wait || done;
  return <li data-s={state}><span className="sb" aria-hidden="true" /><span>{text}</span></li>;
}

export function AddDialog() {
  const prefill = useStore(s => s.addPrefill), dest = useStore(s => s.dest), note = useStore(s => s.addNote);
  const folders = useSortedFolders();
  const [url, setUrl] = useState(prefill), [msg, setMsg] = useState<Msg | null>(null);
  const [pv, setPv] = useState<{ key: string; data: PreviewData | null; loading: boolean } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const aiOn = useStore(s => s.ai) && !!CFG.summarizeApi;
  const [ai, setAi] = useState<{ key: string; state: 'run' | 'done' | 'fail'; r: Resumo | null } | null>(null);
  // Tag que a IA marcou sozinha. Se a pessoa mexer nas tags, a escolha passa a ser dela.
  const sug = useRef<string | null>(null), touched = useRef(false);

  // O que foi digitado: um link válido, vários, ou nada aproveitável.
  const det = useMemo((): { label: string; one: Parsed | null } | null => {
    const v = url.trim();
    if (!v) return null;
    const urls = v.match(/https?:\/\/[^\s]+/gi);
    if (urls && urls.length > 1) {
      const n = urls.filter(u => isParsed(parseLink(u))).length;
      return n ? { label: n + ' links', one: null } : null;
    }
    // Um link com texto junto: o link é salvo e o texto vira a nota.
    const withText = !!urls && v.replace(urls[0], '').trim().length > 0;
    const p = parseLink(urls ? urls[0] : v);
    return isParsed(p) ? { label: (p.plataforma === 'web' ? p.host : PLAT[p.plataforma].label) + (withText ? ' + nota' : ''), one: p } : null;
  }, [url]);
  const one = det?.one ?? null, key = one?.key ?? null;

  // Preview do link digitado, com uma pausa curta para não buscar a cada tecla.
  useEffect(() => {
    if (!one) { setPv(null); return; }
    let live = true;
    setPv({ key: one.key, data: null, loading: true });
    const t = setTimeout(() => {
      void fetchPreview(one.url).then(d => { if (live) setPv({ key: one.key, data: d, loading: false }); });
    }, 350);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Com o preview em mãos, a IA resume e identifica o tema. O resultado vai junto quando o link é salvo.
  const readable = !!pv && !pv.loading && !!pv.data && !!(pv.data.title || pv.data.descricao);
  useEffect(() => {
    if (sug.current && !touched.current) set({ dest: withoutTag(useStore.getState().dest, sug.current) });
    sug.current = null; touched.current = false;
    if (!aiOn || !readable || !pv || !one) { setAi(null); return; }
    let live = true;
    const k = pv.key;
    setAi({ key: k, state: 'run', r: null });
    void summarize({ titulo: '', tituloAuto: pv.data?.title, descricao: pv.data?.descricao, plataforma: one.plataforma, pista: pv.data?.pista, host: one.host }).then(r => {
      if (!live) return;
      const good = !!r && !!(r.resumo || r.tema || r.categoria);
      setAi({ key: k, state: good ? 'done' : 'fail', r: good ? r : null });
      const tk = r?.tema ? temaKey(r.tema) : '';
      const match = tk ? folders.find(f => temaKey(f.nome) === tk) : undefined;
      const cur = useStore.getState().dest;
      if (match && !touched.current && !cur.includes(match.id)) { sug.current = match.id; set({ dest: withTag(cur, match.id) }); }
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, readable, aiOn]);
  const aiMine = ai && pv && ai.key === pv.key ? ai : null;
  const aiPending = aiOn && readable && (!aiMine || aiMine.state === 'run');
  const reading = !!one && (!pv || pv.loading);
  const ready = !!one && !reading && !aiPending;

  // Ao abrir vazio, aproveita um link de rede que esteja copiado.
  useEffect(() => {
    if (prefill || !navigator.clipboard?.readText) return;
    let live = true;
    navigator.clipboard.readText().then(txt => {
      const c = clipCandidate(txt);
      if (c && live && !input.current?.value.trim()) { setUrl(c.url); requestAnimationFrame(() => input.current?.select()); }
    }).catch(() => { /* sem permissão */ });
    return () => { live = false; };
  }, [prefill]);

  useEffect(() => { if (note) { setMsg({ text: note, kind: 'ok' }); input.current?.focus(); } }, [note]);

  const add = (raw: string) => {
    const snap: PvSnap | null = pv ? { key: pv.key, data: pv.data, ai: aiMine?.r ?? null } : null;
    const r = submitAdd(raw, snap);
    if (r.kind === 'saved') return;
    if (r.kind === 'archived') {
      const l = r.link;
      setMsg({ text: 'Esse link está arquivado.', kind: 'err', label: 'Restaurar', fn: () => { restoreLink(l); closeAdd(); toast('Link restaurado.'); goTo({ ...l, arquivadoEm: null }); } });
    } else if (r.kind === 'dup') {
      const l = r.link, nm = tagsOf(l).map(id => folderById(id)?.nome).filter(Boolean).join(', ');
      setMsg({ text: 'Esse link já está salvo' + (nm ? ' com ' + nm : ' sem tag') + '.', kind: 'err', label: 'Ver', fn: () => { closeAdd(); goTo(l); } });
    } else setMsg({ text: describeError(r.code), kind: 'err' });
  };
  const submit = () => {
    if (!url.trim()) { setMsg({ text: 'Cole um link para salvar.', kind: 'err' }); input.current?.focus(); return; }
    add(url);
  };
  const paste = async () => {
    let txt = '';
    try { txt = await navigator.clipboard.readText(); }
    catch { setMsg({ text: 'Não consegui ler o que você copiou. Toque no campo e cole com o atalho do teclado.', kind: 'err' }); input.current?.focus(); return; }
    if (!txt.trim()) { setMsg({ text: 'Não há nada copiado.', kind: 'err' }); return; }
    if (MANY.test(txt)) { add(txt); return; }
    setUrl(txt.trim()); setMsg(null); input.current?.focus();
  };
  const onPaste = (e: ClipboardEvent) => {
    const txt = e.clipboardData.getData('text');
    if (txt && MANY.test(txt)) { e.preventDefault(); add(txt); }
  };

  const title = pv?.data?.title || (one ? autoTitle({ ...one, host: one.host }) : '');
  const resumo = aiMine?.r?.resumo || pv?.data?.descricao || '';
  const sugName = sug.current && dest.includes(sug.current) ? folders.find(f => f.id === sug.current)?.nome : '';
  const img = pv?.data?.image && /^https:\/\//i.test(pv.data.image) ? pv.data.image : '';
  return (
    <Modal labelledBy="add-title" onClose={closeAdd} form={{ className: 'modal add', onSubmit: submit }}>
      <div className="mhead"><h2 id="add-title">Salvar link</h2><button type="button" className="btn icon ghost" aria-label="Fechar" onClick={closeAdd}><IcoX /></button></div>
      <div className="field">
        {det && <span className="detected">{det.label}</span>}
        <label className="sr" htmlFor="url">Link para salvar</label>
        <input ref={input} id="url" type="text" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Cole o link aqui"
          value={url} onChange={e => { setUrl(e.target.value); if (!e.target.value) setMsg(null); }} onPaste={onPaste} />
        {!det && <button className="btn outline sm" type="button" onClick={() => void paste()}>Colar</button>}
      </div>
      {!one && <p className="hint" id="add-hint">Qualquer site: redes, artigos, vídeos, lojas, receitas. Pode colar vários de uma vez.</p>}
      {one && (
        <div className="pv" role="status" aria-live="polite">
          <Preview link={{ plataforma: one.plataforma, duracao: pv?.data?.duracao, icone: pv?.data?.icone }} src={img} />
          <div className="pt">
            <b className="t">{title}</b>
            <span className="m">{one.plataforma === 'web' ? (pv?.data?.site || one.host) : PLAT[one.plataforma].label}{pv?.data?.duracao ? ', ' + fmtDuration(pv.data.duracao) : ''}</span>
            {resumo && <p className="ps">{resumo}</p>}
            {(aiMine?.r?.categoria || aiMine?.r?.tema) && <span className="pks">{kindLabel(aiMine?.r?.categoria) && <span className="pk">{kindLabel(aiMine?.r?.categoria)}</span>}{aiMine?.r?.tema && <span className="pk">Tema: {aiMine.r.tema}</span>}</span>}
          </div>
        </div>
      )}
      {one && (
        <ol className="steps" aria-label="Montando o cartão">
          <Step state={reading ? 'run' : pv?.data ? 'done' : 'skip'} run="Lendo a página" done="Título e imagem lidos" skip="A página não deixou ler título e imagem" />
          {aiOn && <Step state={reading ? 'wait' : !readable ? 'skip' : aiPending ? 'run' : aiMine?.r?.resumo ? 'done' : 'skip'} wait="Resumir o conteúdo" run="Resumindo o conteúdo" done="Resumo pronto" skip="Sem resumo desta vez" />}
          {aiOn && <Step state={reading ? 'wait' : !readable ? 'skip' : aiPending ? 'run' : aiMine?.r?.tema || aiMine?.r?.categoria ? 'done' : 'skip'} wait="Identificar o que é e o tema" run="Identificando o que é e o tema" done={[kindLabel(aiMine?.r?.categoria), aiMine?.r?.tema ? 'tema ' + aiMine.r.tema : ''].filter(Boolean).join(', ')} skip="Tipo e tema não identificados" />}
          <Step state={ready ? 'done' : 'wait'} wait="Escolher as tags" done={sugName ? 'Tag sugerida: ' + sugName : 'Cartão montado. Escolha as tags, se quiser'} />
        </ol>
      )}
      {(ready || (!one && !!det)) && (
        <TagPicker id="add-tags" label="Tags" folders={folders} value={dest} onChange={ids => { touched.current = true; set({ dest: ids }); }} onNew={() => { touched.current = true; openModal({ kind: 'new', then: { type: 'dest' } }); }} />
      )}
      <p className={'msg' + (msg ? ' ' + msg.kind : '')} role="status" aria-live="polite">
        {msg?.text}{msg?.label && <> <button type="button" onClick={msg.fn}>{msg.label}</button></>}
      </p>
      <div className="row">
        <span className="kbd-hint">Dica: cole um link em qualquer lugar da página para salvar direto.</span>
        <button type="button" className="btn outline" onClick={closeAdd}>Cancelar</button>
        <button className="btn primary" type="submit" disabled={!det}>Salvar</button>
      </div>
    </Modal>
  );
}
