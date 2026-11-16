import { backend, get, set, type ModalState, type Then, type Theme } from './store';
import type { Col, Folder, Link, PreviewData, View } from './types';
import { FIXED_VIEWS, EMPTY_FILTERS, isArch, visibleLinks, folderExists } from './lib/filters';
import { isParsed, parseLink } from './lib/platforms';
import { planAutoFolders } from './lib/auto';
import type { Sort } from './lib/sort';
import { hasTag, liveTags, sameTags, tagsOf, withTag, withoutTag } from './lib/tags';
import { makeFolder, sameName, sortFolders } from './lib/folders';
import { buildExport, IMPORT_MAX_BYTES, planImport } from './lib/dataio';
import { plural, uid } from './lib/text';
import { enrichLink, extrasOf, summarize, whySummaryFailed } from './data/previews'
import * as pv from './data/previews';
import { saveProfileName, signOut as sbSignOut, getClient } from './data/supabase';
import { CFG } from './config';

/* ===== Avisos ===== */
let toastSeq = 0;
export function toast(text: string, label?: string, fn?: () => void) {
  set({ toast: { id: ++toastSeq, text, label, fn } });
}
export const dismissToast = () => set({ toast: null });

/* ===== Gravação (otimista: a tela muda na hora e o servidor confirma depois) ===== */
const upsertAll = <T extends { id: string }>(arr: T[], recs: T[]): T[] => {
  const map = new Map(recs.map(r => [r.id, r]));
  const out = arr.map(x => map.get(x.id) ?? x);
  recs.forEach(r => { if (!arr.some(x => x.id === r.id)) out.push(r); });
  return out;
};

/** Verdadeiro enquanto a IA mexe nos links. Uma troca de tag feita por ela não conta como escolha da pessoa. */
let autoWriting = false;

export async function saveMany(col: Col, recs: (Folder | Link)[], failMsg = 'Não consegui salvar agora. Tente de novo.') {
  if (!recs.length) return;
  if (col === 'links' && !autoWriting) {
    // Quando a pessoa troca as tags de um link, a escolha é dela e a IA não mexe mais nesse link.
    const cur = new Map(get().links.map(l => [l.id, l]));
    recs = (recs as Link[]).map(r => { const old = cur.get(r.id); return old && !sameTags(old, r) ? { ...r, pastaManual: true } : r; });
  }
  set(col === 'links'
    ? { links: upsertAll(get().links, recs as Link[]) }
    : { folders: upsertAll(get().folders, recs as Folder[]) });
  const r = await Promise.allSettled(recs.map(x => backend().set(col, x.id, x)));
  if (r.some(x => x.status === 'rejected')) toast(failMsg);
}
export const save = (col: Col, rec: Folder | Link, failMsg?: string) => saveMany(col, [rec], failMsg);

export async function removeMany(col: Col, ids: string[]) {
  const gone = new Set(ids);
  set(col === 'links' ? { links: get().links.filter(x => !gone.has(x.id)) } : { folders: get().folders.filter(x => !gone.has(x.id)) });
  const r = await Promise.allSettled(ids.map(id => backend().remove(col, id)));
  if (r.some(x => x.status === 'rejected')) toast('Não consegui excluir agora. Tente de novo.');
}

/* ===== Consultas ===== */
export const folderById = (id: string | null | undefined) => get().folders.find(f => f.id === id) ?? null;
export const currentVisible = () => { const s = get(); return visibleLinks(s.links, s.folders, s.view, s, s.sort); };

export function currentDest(): string[] {
  const { view, dest, folders } = get();
  if (view === 'all') return dest.filter(id => folderExists(folders, id));
  if (view === 'none' || view === 'archived' || view === 'settings') return [];
  return folderExists(folders, view) ? [view] : [];
}

const tagNames = (ids: string[]) => ids.map(id => folderById(id)?.nome).filter(Boolean).join(', ');

/* ===== Navegação e filtros ===== */
export function resetFilters() { set({ ...EMPTY_FILTERS }); }

export function go(view: View) {
  const s = get();
  const isFolder = !FIXED_VIEWS.includes(view);
  set({
    prevView: view === 'settings' && s.view !== 'settings' ? s.view : s.prevView,
    view, pal: null, ...EMPTY_FILTERS, sel: [], anchor: null, menu: false, clip: null,
    ...(isFolder ? { dest: [view] } : {}),
  });
  void checkClipboard();
}

export const setLayout = (layout: 'cards' | 'list') => {
  set({ layout });
  try { localStorage.setItem('brica.layout', layout); } catch { /* sem armazenamento */ }
};

export function togglePlat(k: string) { const p = get().plats; set({ plats: p.includes(k) ? p.filter(x => x !== k) : [...p, k] }); }
export function toggleFolderFilter(id: string) { const p = get().fp; set({ fp: p.includes(id) ? p.filter(x => x !== id) : [...p, id] }); }

/* ===== Seleção ===== */
export function clearSel() { set({ sel: [], anchor: null, menu: false }); }

export function pruneSel() {
  const { sel } = get();
  if (!sel.length) return;
  const vis = new Set(currentVisible().map(l => l.id));
  const next = sel.filter(id => vis.has(id));
  if (next.length !== sel.length) set({ sel: next, ...(next.length ? {} : { menu: false }) });
}

export function toggleSel(id: string, range: boolean) {
  const { sel, anchor } = get();
  const vis = currentVisible().map(l => l.id);
  let next = sel.slice();
  if (range && anchor && vis.includes(anchor)) {
    const a = vis.indexOf(anchor), b = vis.indexOf(id), on = sel.includes(anchor);
    vis.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => {
      const i = next.indexOf(x);
      if (on && i < 0) next.push(x);
      if (!on && i >= 0) next.splice(i, 1);
    });
  } else {
    next = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
  }
  set({ sel: next, anchor: id, menu: false });
}
export const selectAll = () => set({ sel: currentVisible().map(l => l.id) });
const selItems = () => { const s = new Set(get().sel); return get().links.filter(l => s.has(l.id)); };

/* ===== Desfazer ===== */
type Patch = { id: string } & Partial<Link>;
function undoPatch(prev: Patch[]) {
  const map = new Map(get().links.map(l => [l.id, l]));
  const recs = prev.flatMap(p => { const cur = map.get(p.id); return cur ? [{ ...cur, ...p }] : []; });
  void saveMany('links', recs);
}

/** Marca ou desmarca uma tag nos links selecionados. Se todos já têm a tag, ela sai de todos. Senão, entra em quem não tem. */
export function bulkTag(id: string) {
  const items = selItems();
  if (!items.length) return;
  const all = items.every(l => hasTag(l, id)), fo = folderById(id);
  const changed = items.filter(l => hasTag(l, id) === all);
  const prev = changed.map(l => ({ id: l.id, pastaIds: tagsOf(l) }));
  void saveMany('links', changed.map(l => ({ ...l, pastaIds: all ? withoutTag(tagsOf(l), id) : withTag(tagsOf(l), id) })));
  const n = changed.length;
  toast(plural(n, '1 link', 'links') + (all ? ' sem a tag ' : ' com a tag ') + (fo ? fo.nome : '') + '.', 'Desfazer', () => undoPatch(prev));
}

/** Tira todas as tags dos links selecionados. */
export function bulkClearTags() {
  const items = selItems().filter(l => tagsOf(l).length);
  if (!items.length) { toast('Esses links já estão sem tag.'); return; }
  const prev = items.map(l => ({ id: l.id, pastaIds: tagsOf(l) }));
  void saveMany('links', items.map(l => ({ ...l, pastaIds: [] })));
  toast(plural(items.length, '1 link ficou', 'links ficaram') + ' sem tag.', 'Desfazer', () => undoPatch(prev));
}

export function setArchived(items: Link[], on: boolean) {
  set({ swipeId: null });
  const prev = items.map(l => ({ id: l.id, arquivadoEm: l.arquivadoEm || null }));
  const now = Date.now();
  void saveMany('links', items.map(l => ({ ...l, arquivadoEm: on ? now : null })));
  clearSel();
  const n = items.length;
  toast(on ? plural(n, 'Link arquivado.', 'links arquivados.') : plural(n, 'Link restaurado.', 'links restaurados.'), 'Desfazer', () => undoPatch(prev));
}
export const archiveSelected = (on: boolean) => setArchived(selItems(), on);

/** Abre a gaveta de ações de um cartão, ou fecha todas com null. Só uma fica aberta por vez. */
export const setCardMenu = (id: string | null) => { if (get().cardMenu !== id) set({ cardMenu: id }); };
export const setSwipe = (id: string | null) => { if (get().swipeId !== id) set({ swipeId: id }); };

/** Exclui um link na hora, sem passar para Arquivados. O aviso permite desfazer. */
export function deleteLink(id: string) {
  const l = get().links.find(x => x.id === id);
  if (!l) return;
  const copy = { ...l };
  set({ swipeId: null, sel: get().sel.filter(x => x !== id) });
  void removeMany('links', [id]);
  toast('Link excluído.', 'Desfazer', () => { void save('links', copy); });
}

export function purge(ids: string[]) {
  closeModal();
  const n = get().links.filter(l => ids.includes(l.id)).length;
  void removeMany('links', ids);
  clearSel();
  set({ draft: null });
  toast(plural(n, 'Link excluído de vez.', 'links excluídos de vez.'));
}

/* ===== Diálogos ===== */
export function openModal(m: ModalState) { set({ modal: m }); }
export function closeModal() { set({ modal: null }); }
/** Esc ou Cancelar: se o diálogo de tag veio da edição de um link, volta para a edição. */
export function cancelModal() {
  const m = get().modal;
  if (m && m.kind === 'new' && m.then?.type === 'edit-pasta') { set({ modal: { kind: 'link', id: m.then.linkId } }); return; }
  set({ modal: null, draft: null });
}

export function openAdd(prefill = '') {
  set({ adding: true, addPrefill: prefill, addNote: '', clip: null, dest: currentDest() });
}
export function closeAdd() { set({ adding: false, addPrefill: '', addNote: '' }); }

/* ===== Salvar links ===== */
export type AddResult =
  | { kind: 'saved' }
  | { kind: 'archived'; link: Link }
  | { kind: 'dup'; link: Link }
  | { kind: 'bad'; code: string };

interface SaveOutcome { saved: Link[]; dup: Link | null; bad: string | null; total: number; dest: string[] }
export interface PvSnap { key: string; data: PreviewData | null; ai?: { resumo: string; tema: string } | null }

function saveLinks(raw: string, dest: string[], pv?: PvSnap | null): SaveOutcome {
  const found = raw.match(/https?:\/\/[^\s]+/gi);
  const items = found && found.length ? found : [raw.trim()];
  const r: SaveOutcome = { saved: [], dup: null, bad: null, total: items.length, dest };
  const known = new Map(get().links.map(l => [l.chave, l]));
  const base = Date.now();
  // Texto colado junto com um único link vira a nota dele.
  const rest = found && found.length === 1 ? raw.replace(found[0], ' ').replace(/\s+/g, ' ').trim().slice(0, 600) : '';
  items.forEach(it => {
    const p = parseLink(it);
    if (!isParsed(p)) { r.bad = r.bad || p.error; return; }
    const exist = known.get(p.key);
    if (exist) { r.dup = r.dup || exist; return; }
    if (r.saved.some(x => x.chave === p.key)) return;
    const rec: Link = {
      id: uid(), url: p.url, chave: p.key, plataforma: p.plataforma, tipo: p.tipo, autor: p.autor,
      titulo: '', nota: rest, pastaIds: dest.slice(), criadoEm: base + r.saved.length, enriquecido: false,
    };
    if (pv && pv.key === p.key && pv.data) { Object.assign(rec, extrasOf(pv.data)); rec.enriquecido = true; }
    // O diálogo de salvar já pediu o resumo: aproveita, para não gastar outro pedido.
    if (pv && pv.key === p.key && pv.ai && get().ai) { if (pv.ai.resumo) rec.resumoIA = pv.ai.resumo; if (pv.ai.tema) rec.tema = pv.ai.tema; }
    r.saved.push(rec);
  });
  if (r.saved.length) {
    void saveMany('links', r.saved).then(() => { r.saved.forEach(l => { if (!l.enriquecido) void enrich(l.id); else if (l.resumoIA) { if (l.tema) void organize(); } else void addSummary(l.id); }); });
  }
  return r;
}

function reportSaved(r: SaveOutcome) {
  const n = r.saved.length, last = r.saved[n - 1], names = tagNames(r.dest);
  const { view } = get();
  set({ flash: last.id, ...(view !== 'all' && !(r.dest.length ? r.dest.includes(view) : view === 'none') ? { view: r.dest[0] || 'none' } : {}), ...EMPTY_FILTERS, clip: null });
  setTimeout(() => { if (get().flash === last.id) set({ flash: null }); }, 1800);
  scrollToLink(last.id, 'nearest');
  const skipped = r.total - n - (r.bad ? 1 : 0);
  toast(
    (n === 1 ? 'Salvo' : n + ' links salvos') + (names ? ' com ' + (r.dest.length === 1 ? 'a tag ' : 'as tags ') + names : ' sem tag') + '.' + (skipped > 0 ? ' ' + (skipped === 1 ? '1 já estava salvo.' : skipped + ' já estavam salvos.') : ''),
    'Desfazer', () => void removeMany('links', r.saved.map(l => l.id)),
  );
}

export function scrollToLink(id: string, block: ScrollLogicalPosition) {
  // espera o React desenhar a lista antes de rolar
  setTimeout(() => {
    const el = document.querySelector('.link[data-id="' + id + '"]');
    if (el) el.scrollIntoView({ block, behavior: 'smooth' });
  }, 60);
}

export function goTo(l: Link) {
  const tags = liveTags(l, get().folders), cur = get().view;
  set({ view: isArch(l) ? 'archived' : tags.some(t => t.id === cur) ? cur : tags[0] ? tags[0].id : 'none', ...EMPTY_FILTERS, flash: l.id, sel: [], anchor: null });
  setTimeout(() => { if (get().flash === l.id) set({ flash: null }); }, 1800);
  scrollToLink(l.id, 'center');
}

export function restoreLink(l: Link) {
  const cur = get().links.find(x => x.id === l.id);
  if (cur) void save('links', { ...cur, arquivadoEm: null });
}

/** Salvar pelo diálogo. Devolve o resultado para o diálogo mostrar a mensagem certa. */
export function submitAdd(raw: string, pv: PvSnap | null): AddResult {
  const r = saveLinks(raw, get().dest, pv);
  if (r.saved.length) { closeAdd(); reportSaved(r); return { kind: 'saved' }; }
  if (r.dup && isArch(r.dup)) return { kind: 'archived', link: r.dup };
  if (r.dup) return { kind: 'dup', link: r.dup };
  return { kind: 'bad', code: r.bad || 'invalido' };
}

export function describeError(code: string) {
  if (code === 'espaco') return 'Cole um link por vez, sem espaços no meio. Para vários, cole um por linha.';
  return 'Isso não parece um link. Cole o endereço completo, começando com http ou www.';
}

/** Salvar sem abrir o diálogo (link colado na página ou vindo da faixa "link copiado"). */
export function quickSave(raw: string, dest: string[]) {
  const r = saveLinks(raw, dest);
  if (r.saved.length) { reportSaved(r); return; }
  if (r.dup && isArch(r.dup)) {
    const l = r.dup;
    toast('Esse link está arquivado.', 'Restaurar', () => { restoreLink(l); goTo({ ...l, arquivadoEm: null }); });
    return;
  }
  if (r.dup) { const l = r.dup, nm = tagNames(tagsOf(l)); toast('Já está salvo' + (nm ? ' com ' + nm : ' sem tag') + '.', 'Ver', () => goTo(l)); return; }
  toast(describeError(r.bad || 'invalido'));
}

/* ===== Link copiado ===== */
let clipDismissed: string | null = null, clipBusy = false;
export function clipCandidate(txt: string) {
  const m = (txt || '').match(/https?:\/\/[^\s]+/i);
  if (!m) return null;
  const p = parseLink(m[0]);
  // Qualquer site serve, menos o próprio app (copiar o endereço daqui não é um link para guardar).
  if (!isParsed(p) || p.host === location.hostname.replace(/^www\./, '')) return null;
  if (get().links.some(l => l.chave === p.key)) return null;
  return { url: m[0], key: p.key };
}
export function dismissClip() { clipDismissed = get().clip?.key ?? null; set({ clip: null }); }
export function acceptClip() {
  const c = get().clip;
  if (!c) return;
  set({ clip: null });
  if (get().view === 'all') openAdd(c.url); else quickSave(c.url, currentDest());
}
export async function checkClipboard() {
  const s = get();
  if (clipBusy || !s.loaded || s.modal || s.adding || s.view === 'archived' || s.view === 'settings') return;
  if (!navigator.clipboard || !navigator.clipboard.readText) return;
  clipBusy = true;
  try {
    const c = clipCandidate(await navigator.clipboard.readText());
    if (c && c.key !== clipDismissed) set({ clip: c }); else if (!c) set({ clip: null });
  } catch { /* sem permissão: o botão Colar continua disponível */ }
  clipBusy = false;
}

/* ===== Tags ===== */
export const newFolderRec = (nome: string) => makeFolder(nome, get().folders);

export type FolderResult = { ok: true } | { ok: false; error: string };

export function submitFolder(nome: string, editId: string | null, then?: Then): FolderResult {
  nome = nome.trim();
  if (!nome) return { ok: false, error: 'Dê um nome para a tag.' };
  if (get().folders.some(f => f.id !== editId && sameName(f.nome, nome))) return { ok: false, error: 'Você já tem uma tag com esse nome.' };
  const cur = editId ? folderById(editId) : null;
  const rec = cur ? { ...cur, nome } : newFolderRec(nome);
  set({ modal: null });
  void save('folders', rec);
  if (editId) return { ok: true };
  if (then?.type === 'dest') set({ dest: withTag(get().dest, rec.id), addNote: 'Tag ' + rec.nome + ' criada.' });
  else if (then?.type === 'edit-pasta') {
    const d = get().draft;
    set({ draft: d && d.id === then.linkId ? { ...d, tags: withTag(d.tags, rec.id) } : d, modal: { kind: 'link', id: then.linkId } });
  }
  else if (then?.type === 'move-many') bulkTag(rec.id);
  else if (then?.type === 'stay') toast('Tag ' + rec.nome + ' criada.');
  else set({ view: rec.id, dest: [rec.id], sel: [], anchor: null, menu: false });
  return { ok: true };
}

export async function deleteFolder(id: string) {
  const f = folderById(id);
  if (!f) return;
  const affected = get().links.filter(l => hasTag(l, id));
  const prev = affected.map(l => ({ id: l.id, pastaIds: tagsOf(l) }));
  const folder = { ...f };
  const stay = get().view === 'settings';
  set({ modal: null, sel: [], anchor: null, menu: false, ...(stay || get().view !== id ? {} : { view: 'all' as View }), dest: withoutTag(get().dest, id) });
  await saveMany('links', affected.map(l => ({ ...l, pastaIds: withoutTag(tagsOf(l), id) })));
  await removeMany('folders', [id]);
  const n = affected.length;
  toast('Tag ' + f.nome + ' excluída.' + (n ? ' ' + (n === 1 ? 'O link continua salvo, sem ela.' : 'Os ' + n + ' links continuam salvos, sem ela.') : ''), 'Desfazer', async () => {
    await save('folders', folder);
    undoPatch(prev);
    if (!stay) set({ view: folder.id });
  });
}

/** Arquiva a tag. Com links: eles vão junto e voltam juntos. Sem links: eles continuam visíveis, só perdem a tag. */
export async function archiveFolder(id: string, withLinks: boolean) {
  const f = folderById(id);
  if (!f) return;
  const affected = get().links.filter(l => hasTag(l, id));
  const prev = affected.map(l => ({ id: l.id, pastaIds: tagsOf(l), arquivadoEm: l.arquivadoEm || null, arquivadoComPasta: !!l.arquivadoComPasta }));
  const now = Date.now(), rec: Folder = { ...f, arquivadaEm: now };
  const stay = get().view === 'settings';
  if (f.auto) ignoreTheme(f.nome);
  set({
    modal: null, sel: [], anchor: null, menu: false,
    folders: get().folders.filter(x => x.id !== id), foldersArq: [...get().foldersArq, rec],
    dest: withoutTag(get().dest, id), ...(get().view === id ? { view: 'all' } : {}),
  });
  try { await backend().set('folders', id, rec); } catch { toast('Não consegui arquivar agora. Tente de novo.'); }
  await saveMany('links', affected.map(l => withLinks
    ? { ...l, arquivadoEm: l.arquivadoEm || now, arquivadoComPasta: !l.arquivadoEm }
    : { ...l, pastaIds: withoutTag(tagsOf(l), id) }));
  const n = affected.filter(l => !l.arquivadoEm).length;
  const what = !n ? '' : withLinks ? ' ' + (n === 1 ? 'O link foi junto.' : 'Os ' + n + ' links foram juntos.') : ' ' + (n === 1 ? 'O link continua salvo, sem ela.' : 'Os ' + n + ' links continuam salvos, sem ela.');
  toast('Tag ' + f.nome + ' arquivada.' + what, 'Desfazer', async () => {
    await restoreFolder(id, false);
    undoPatch(prev);
    if (!stay) set({ view: id });
  });
}

/** Traz a tag de volta. Os links que foram arquivados junto com ela voltam também. */
export async function restoreFolder(id: string, withLinks = true) {
  const f = get().foldersArq.find(x => x.id === id);
  if (!f) return;
  if (get().folders.some(x => sameName(x.nome, f.nome))) { toast('Você já tem uma tag chamada ' + f.nome + '. Renomeie uma delas antes de restaurar.'); return; }
  const rec: Folder = { ...f, arquivadaEm: null };
  set({ foldersArq: get().foldersArq.filter(x => x.id !== id), folders: [...get().folders, rec] });
  try { await backend().set('folders', id, rec); } catch { toast('Não consegui restaurar agora. Tente de novo.'); }
  if (!withLinks) return;
  const back = get().links.filter(l => hasTag(l, id) && l.arquivadoComPasta);
  await saveMany('links', back.map(l => ({ ...l, arquivadoEm: null, arquivadoComPasta: false })));
  toast('Tag ' + f.nome + ' restaurada.' + (back.length ? ' ' + plural(back.length, '1 link voltou junto.', 'links voltaram juntos.') : ''));
}

export function renameFolder(id: string, value: string): boolean {
  const f = folderById(id), nome = String(value || '').trim();
  if (!f || nome === f.nome) return false;
  if (!nome) { toast('A tag precisa de um nome.'); return false; }
  if (get().folders.some(x => x.id !== id && sameName(x.nome, nome))) { toast('Você já tem uma tag com esse nome.'); return false; }
  void save('folders', { ...f, nome, ...(f.auto ? { auto: false } : {}) });
  return true;
}

export function setFolderColor(id: string, cor: number) {
  const f = folderById(id);
  set({ pal: null });
  if (f) void save('folders', { ...f, cor });
}

export function moveFolder(id: string, to: number) {
  const arr = sortFolders(get().folders), i = arr.findIndex(f => f.id === id);
  if (i < 0 || to < 0 || to >= arr.length || to === i) return;
  const [f] = arr.splice(i, 1);
  arr.splice(to, 0, f);
  const changed = arr.flatMap((x, k) => (x.ordem === k ? [] : [{ ...x, ordem: k }]));
  void saveMany('folders', changed, 'Não consegui salvar a ordem agora. Tente de novo.');
}

export function createStarter(nome: string) {
  const rec = newFolderRec(nome);
  set({ view: rec.id, dest: [rec.id] });
  void save('folders', rec);
}

/* ===== Ajustes ===== */
export function applyTheme(t: Theme) {
  const r = document.documentElement;
  if (t === 'light' || t === 'dark') r.dataset.theme = t; else delete r.dataset.theme;
}
/** Ordem da lista. Vale para todas as telas e fica guardada neste aparelho. */
export function setSort(s: Sort) {
  set({ sort: s });
  try { localStorage.setItem('disorder.sort', s); } catch { /* sem armazenamento */ }
}

export function setTheme(t: Theme) {
  set({ theme: t });
  try { localStorage.setItem('disorder.theme', t); } catch { /* sem armazenamento */ }
  applyTheme(t);
}

export function setAi(on: boolean) {
  set({ ai: on });
  try { localStorage.setItem('disorder.ai', on ? '1' : '0'); } catch { /* sem armazenamento */ }
}

export async function setProfileName(nome: string) {
  nome = nome.trim();
  set({ profile: { ...get().profile, nome } });
  try { localStorage.setItem('disorder.nome', nome); } catch { /* sem armazenamento */ }
  try { if (getClient()) await saveProfileName(nome); toast('Nome salvo.'); }
  catch { toast('Não consegui salvar o nome agora. Tente de novo.'); }
}
export const signOut = () => { void sbSignOut(); };

export function exportData() {
  const { folders, foldersArq, links } = get();
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(buildExport([...folders, ...foldersArq], links), null, 2)], { type: 'application/json' }));
    a.download = 'disorder-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Arquivo exportado.');
  } catch { toast('Não consegui gerar o arquivo neste navegador.'); }
}

export async function importData(file: File | undefined) {
  if (!file) return;
  if (file.size > IMPORT_MAX_BYTES) { toast('Arquivo grande demais. O limite é 5 MB.'); return; }
  let d: unknown;
  try { d = JSON.parse(await file.text()); } catch { toast('Não consegui ler esse arquivo. Use um arquivo exportado pelo disorder.'); return; }
  const plan = planImport(d, get().folders, get().links);
  if (!plan) { toast('Esse arquivo não tem links nem tags do disorder.'); return; }
  const { folders: nf, links: nl, dup, bad } = plan;
  if (!nf.length && !nl.length) { toast('Nada novo para importar.' + (dup ? ' ' + plural(dup, '1 link já existia', 'links já existiam') + '.' : '')); return; }
  toast('Importando ' + plural(nl.length, '1 link', 'links') + '.');
  // tudo em um único passo: uma atualização de tela e gravações em paralelo
  const before = { f: get().folders.length, l: get().links.length };
  await saveMany('folders', nf);
  await saveMany('links', nl);
  const lost = Math.max(0, nf.length + nl.length - (get().folders.length - before.f) - (get().links.length - before.l));
  toast(plural(nl.length, '1 link importado', 'links importados') + ' e ' + plural(nf.length, '1 tag criada', 'tags criadas') + '.' + (dup ? ' ' + plural(dup, '1 já existia', 'já existiam') + '.' : '') + (bad ? ' ' + plural(bad, '1 endereço inválido ficou de fora', 'endereços inválidos ficaram de fora') + '.' : '') + (lost ? ' ' + plural(lost, '1 item não foi salvo', 'itens não foram salvos') + ', tente importar de novo.' : ''));
}

/* ===== Tag automática ===== */
const IGNORE_KEY = 'disorder.auto.ignore';
const ignoredThemes = (): string[] => { try { return JSON.parse(localStorage.getItem(IGNORE_KEY) || '[]'); } catch { return []; } };
/** Lembra que a pessoa não quis esse tema como tag, para a IA não criar de novo. */
function ignoreTheme(nome: string) {
  try { localStorage.setItem(IGNORE_KEY, JSON.stringify([...new Set([...ignoredThemes(), nome])].slice(-100))); } catch { /* sem armazenamento */ }
}

let orgBusy = false, orgAgain = false;
/** Agrupa links soltos por tema. Só adiciona: cria tag com 3 links do mesmo tema ou põe o link numa tag que já tem o nome do tema. */
export async function organize(prefix = '') {
  if (!get().ai) return;
  if (orgBusy) { orgAgain = true; return; }
  orgBusy = true;
  try {
    do {
      orgAgain = false;
      const plan = planAutoFolders(get().links, get().folders, ignoredThemes());
      if (!plan.length) { if (prefix) toast(prefix.trim()); continue; }
      const made: Folder[] = [];
      const patch = new Map<string, string>();
      for (const g of plan) {
        let id = g.folderId;
        if (!id) { const f: Folder = { ...makeFolder(g.nome, [...get().folders, ...made]), auto: true }; made.push(f); id = f.id; }
        g.linkIds.forEach(l => patch.set(l, id as string));
      }
      const links = get().links.filter(l => patch.has(l.id)).map(l => ({ ...l, pastaIds: [patch.get(l.id) as string] }));
      autoWriting = true;
      try { await saveMany('folders', made); await saveMany('links', links); } finally { autoWriting = false; }
      const n = links.length;
      const text = plan.length === 1
        ? (made.length ? 'Criei a tag ' + plan[0].nome + ' com ' + plural(n, '1 link', 'links') + '.' : plural(n, '1 link foi', 'links foram') + ' para ' + plan[0].nome + '.')
        : 'Organizei ' + plural(n, '1 link', 'links') + ' em ' + plural(plan.length, '1 tag', 'tags') + '.';
      toast(prefix + text, 'Desfazer', async () => {
        made.forEach(f => ignoreTheme(f.nome));
        autoWriting = true;
        try {
          const now = new Map(get().links.map(l => [l.id, l]));
          await saveMany('links', links.flatMap(l => { const c = now.get(l.id); return c ? [{ ...c, pastaIds: [], pastaManual: true }] : []; }));
        } finally { autoWriting = false; }
        if (made.length) await removeMany('folders', made.map(f => f.id));
      });
    } while (orgAgain);
  } finally { orgBusy = false; }
}

/* ===== Resumo por IA ===== */
const summarizing = new Set<string>();
let bulkAi = false;
/** Pede a frase de resumo e o tema de um link, se a IA estiver ligada e o link ainda não tiver. Falha em silêncio: o cartão segue com o resumo da página. */
async function addSummary(id: string) {
  const l = get().links.find(x => x.id === id);
  if (!get().ai || !l || l.resumoIA || summarizing.has(id)) return;
  summarizing.add(id);
  try {
    const s = await summarize(l);
    const now = get().links.find(x => x.id === id);
    if (s && now) await save('links', { ...now, ...(s.resumo ? { resumoIA: s.resumo } : {}), ...(s.tema ? { tema: s.tema } : {}) });
    if (s && s.tema && !bulkAi) void organize();
  } finally { summarizing.delete(id); }
}

/** Roda o resumo e a organização nos links que já existem. No máximo 150 por vez, para respeitar o limite diário. */
export async function summarizeExisting() {
  if (!get().ai || !CFG.summarizeApi || get().summarizingAll) return;
  const todo = get().links.filter(l => !isArch(l) && !l.resumoIA).slice(0, 60).map(l => l.id);
  if (!todo.length) { toast('Todos os links já estão organizados.'); return; }
  set({ summarizingAll: true, aiProgress: { done: 0, total: todo.length } });
  bulkAi = true;
  try {
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const id = todo[i++], l = get().links.find(x => x.id === id);
        if (!l) continue;
        if (pv.lastSummarizeStatus === 401 || pv.lastSummarizeStatus === 503) return; // falha que se repetiria em todos: para
        if (l.enriquecido) await addSummary(id); else await enrich(id);
        set({ aiProgress: { done: get().aiProgress.done + 1, total: todo.length } });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  } finally { bulkAi = false; }
  const done = todo.filter(id => get().links.find(l => l.id === id)?.resumoIA).length;
  set({ summarizingAll: false });
  const why = done < todo.length && pv.lastSummarizeStatus !== 200 ? ' Motivo: ' + whySummaryFailed(pv.lastSummarizeStatus) + (pv.lastSummarizeDetail ? ' Resposta da IA: ' + pv.lastSummarizeDetail : '') : '';
  await organize(done + ' de ' + todo.length + ' links organizados.' + why + ' ');
}

/* ===== Preview automático ===== */
const enriching = new Set<string>();
/** Busca título e imagem de um link já salvo. force refaz mesmo que já tenha sido feito. */
export async function enrich(id: string, force = false): Promise<boolean> {
  const l = get().links.find(x => x.id === id);
  if (!CFG.previewApi || !l || (l.enriquecido && !force) || enriching.has(id)) return false;
  enriching.add(id);
  const showLoading = !l.enriquecido;
  if (showLoading) set({ loading: [...get().loading, id] });
  try {
    const r = await enrichLink(l);
    const cur = get().links.find(x => x.id === id);
    if (!r || !cur) return false;
    await save('links', { ...cur, ...r.extras, enriquecido: true });
    await addSummary(id);
    return r.got;
  } finally {
    enriching.delete(id);
    if (showLoading) set({ loading: get().loading.filter(x => x !== id) });
  }
}

async function pool(ids: string[], force: boolean, n = 3) {
  let i = 0, ok = 0;
  const worker = async () => { while (i < ids.length) { if (await enrich(ids[i++], force)) ok++; } };
  await Promise.all(Array.from({ length: n }, worker));
  return ok;
}

export async function refreshPreviews(auto = false) {
  if (!CFG.previewApi || get().refreshing) return;
  const ids = get().links.filter(l => !isArch(l)).slice(0, 300).map(l => l.id);
  if (!ids.length) { if (!auto) toast('Nenhum link para atualizar.'); return; }
  set({ refreshing: true });
  const ok = await pool(ids, true);
  set({ refreshing: false });
  toast(ok + ' de ' + ids.length + ' links com título e imagem atualizados.');
}

export function enrichPending() {
  let done = false;
  try { done = localStorage.getItem('disorder.refresh.v1') === '1'; } catch { /* sem armazenamento */ }
  const { links } = get();
  if (!done && links.length) {
    try { localStorage.setItem('disorder.refresh.v1', '1'); } catch { /* sem armazenamento */ }
    void refreshPreviews(true);
    return;
  }
  void pool(links.filter(l => !l.enriquecido).slice(0, 40).map(l => l.id), false);
}

/** Se a tela atual é uma tag que não existe mais, volta para Todos. */
export function fixView() {
  const { view, folders, dest } = get();
  if (!FIXED_VIEWS.includes(view) && !folderExists(folders, view)) set({ view: 'all' });
  if (dest.some(id => !folderExists(folders, id))) set({ dest: dest.filter(id => folderExists(folders, id)) });
}

export const busy = () => { const s = get(); return !!s.modal || s.adding; };
