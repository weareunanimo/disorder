import { cleanList, newNote } from './notes';
import type { Folder, Link } from '../types';
import { parseLink, isParsed } from './platforms';
import { makeFolder, sameName, sortFolders } from './folders';
import { uid } from './text';
import { tagsOf } from './tags';

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export function buildExport(folders: Folder[], links: Link[], now = new Date()) {
  return { app: 'disorder', versao: 1, exportadoEm: now.toISOString(), folders: sortFolders(folders), links };
}

export interface ImportPlan {
  folders: Folder[];
  links: Link[];
  dup: number;
  bad: number;
}

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');

/** Valida um arquivo exportado e devolve só o que é novo. Soma ao que já existe, sem duplicar e sem apagar. */
export function planImport(data: unknown, folders: Folder[], links: Link[]): ImportPlan | null {
  const d = data as { folders?: unknown; links?: unknown } | null;
  const fs = Array.isArray(d?.folders) ? (d!.folders as Record<string, unknown>[]) : [];
  const ls = Array.isArray(d?.links) ? (d!.links as Record<string, unknown>[]) : [];
  if (!fs.length && !ls.length) return null;

  const map: Record<string, string> = {};
  const nf: Folder[] = [];
  let all = folders.slice();
  fs.slice(0, 500).forEach(f => {
    const nome = str(f?.nome, 40).trim();
    if (!nome) return;
    const same = all.find(x => sameName(x.nome, nome));
    if (same) { map[String(f.id)] = same.id; return; }
    const rec = makeFolder(nome, all);
    if (Number.isInteger(f.cor)) rec.cor = (((f.cor as number) % 8) + 8) % 8;
    map[String(f.id)] = rec.id; nf.push(rec); all = all.concat(rec);
  });

  const nl: Link[] = [];
  let dup = 0, bad = 0;
  const seen = new Set(links.map(l => l.chave));
  ls.slice(0, 5000).forEach(l => {
    // Nota: sem link, entra se tiver algo escrito.
    if (!str(l?.url, 2000)) {
      const lista = cleanList(l?.lista), titulo = str(l?.titulo, 140), nota = str(l?.nota, 5000);
      if (!lista && !titulo && !nota) { bad++; return; }
      const pids = Array.from(new Set(tagsOf(l as { pastaIds?: unknown; pastaId?: unknown }).map(x => map[x]).filter(Boolean)));
      const n = newNote(uid(), pids, false, Number.isFinite(l.criadoEm) ? (l.criadoEm as number) : Date.now());
      Object.assign(n, { titulo, nota, lista });
      if (Number.isFinite(l.arquivadoEm)) n.arquivadoEm = l.arquivadoEm as number;
      nl.push(n);
      return;
    }
    const p = parseLink(str(l?.url, 2000));
    if (!isParsed(p)) { bad++; return; }
    if (seen.has(p.key)) { dup++; return; }
    seen.add(p.key);
    const pids = Array.from(new Set(tagsOf(l as { pastaIds?: unknown; pastaId?: unknown }).map(x => map[x]).filter(Boolean)));
    const rec: Link = {
      id: uid(), url: p.url, chave: p.key, plataforma: p.plataforma, tipo: p.tipo, autor: p.autor,
      titulo: str(l.titulo, 140), nota: str(l.nota, 600), pastaIds: pids,
      criadoEm: Number.isFinite(l.criadoEm) ? (l.criadoEm as number) : Date.now(), enriquecido: !!l.enriquecido,
    };
    const ta = str(l.tituloAuto, 300), th = str(l.thumb, 2000);
    if (ta) rec.tituloAuto = ta;
    if (/^https:\/\//i.test(th)) rec.thumb = th;
    const lista = cleanList(l.lista);
    if (lista) rec.lista = lista;
    if (Number.isFinite(l.arquivadoEm)) rec.arquivadoEm = l.arquivadoEm as number;
    nl.push(rec);
  });
  return { folders: nf, links: nl, dup, bad };
}
