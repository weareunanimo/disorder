import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { set, useStore } from '../store';
import { clipCandidate, closeAdd, describeError, folderById, goTo, openModal, restoreLink, submitAdd, toast, type PvSnap } from '../actions';
import { fetchPreview } from '../data/previews';
import { PLAT, autoTitle, fmtDuration, isParsed, parseLink, type Parsed } from '../lib/platforms';
import type { PreviewData } from '../types';
import { useSortedFolders } from '../hooks/useVisible';
import { Preview } from '../components/LinkList';
import { IcoX } from '../components/icons';
import { Modal } from './Modal';
import { TagPicker } from '../components/TagPicker';
import { tagsOf } from '../lib/tags';

const MANY = /https?:\/\/\S+[\s\S]*https?:\/\/\S+/i;
interface Msg { text: string; kind: 'ok' | 'err'; label?: string; fn?: () => void }

export function AddDialog() {
  const prefill = useStore(s => s.addPrefill), dest = useStore(s => s.dest), note = useStore(s => s.addNote);
  const folders = useSortedFolders();
  const [url, setUrl] = useState(prefill), [msg, setMsg] = useState<Msg | null>(null);
  const [pv, setPv] = useState<{ key: string; data: PreviewData | null; loading: boolean } | null>(null);
  const input = useRef<HTMLInputElement>(null);

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
    return isParsed(p) ? { label: PLAT[p.plataforma].label + (withText ? ' + nota' : ''), one: p } : null;
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
    const snap: PvSnap | null = pv ? { key: pv.key, data: pv.data } : null;
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
      {!one && <p className="hint" id="add-hint">X, Threads, Instagram, TikTok e YouTube. Pode colar vários de uma vez.</p>}
      {one && (
        <div className="pv" role="status" aria-live="polite">
          <Preview link={{ plataforma: one.plataforma, duracao: pv?.data?.duracao, icone: pv?.data?.icone }} src={img} />
          <div className="pt">
            <b className="t">{title}</b>
            <span className="m">{PLAT[one.plataforma].label}</span>
            {pv?.data?.duracao ? <span className="m">{fmtDuration(pv.data.duracao)}</span> : null}
            {pv?.loading && <span className="st">Lendo a página</span>}
          </div>
        </div>
      )}
      <TagPicker id="add-tags" label="Tags" folders={folders} value={dest} onChange={ids => set({ dest: ids })} onNew={() => openModal({ kind: 'new', then: { type: 'dest' } })} />
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
