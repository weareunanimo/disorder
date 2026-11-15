import type { Folder, Link } from '../types';
import { isArch } from './filters';
import { sameName } from './folders';

/** Quantos links do mesmo tema bastam para a IA criar uma pasta nova. */
export const AUTO_MIN = 3;

/** Compara temas sem acento, sem maiúscula e sem o "s" do plural: "Receitas" e "receita" são o mesmo tema. */
export const temaKey = (t: string): string =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
    .replace(/ns$/, 'm').replace(/oes$/, 'ao').replace(/s$/, ''); // viagens e viagem, receitas e receita

const cap = (t: string) => t.trim().charAt(0).toUpperCase() + t.trim().slice(1);

export interface AutoGroup {
  /** Pasta que já existe com o mesmo nome do tema. Vazio quando a pasta ainda precisa ser criada. */
  folderId: string | null;
  nome: string;
  linkIds: string[];
}

/**
 * Decide o que a IA pode fazer. Regras:
 * - só mexe em link solto (sem pasta), ativo, com tema e que a pessoa nunca moveu à mão;
 * - tema igual ao nome de uma pasta que já existe: os links entram nela, mesmo que seja só um;
 * - sem pasta com esse nome: cria uma quando houver AUTO_MIN links do tema;
 * - nunca renomeia, junta nem apaga nada, e não recria um tema que a pessoa dispensou.
 */
export function planAutoFolders(links: Link[], folders: Folder[], ignored: string[] = []): AutoGroup[] {
  const skip = new Set(ignored.map(temaKey));
  const byTema = new Map<string, Link[]>();
  for (const l of links) {
    if (l.pastaId || isArch(l) || l.pastaManual || !l.tema) continue;
    const k = temaKey(l.tema);
    if (!k) continue;
    byTema.set(k, [...(byTema.get(k) || []), l]);
  }
  const out: AutoGroup[] = [];
  for (const [k, ls] of byTema) {
    const ex = folders.find(f => !f.arquivadaEm && (temaKey(f.nome) === k || sameName(f.nome, ls[0].tema || '')));
    if (ex) { out.push({ folderId: ex.id, nome: ex.nome, linkIds: ls.map(l => l.id) }); continue; }
    if (skip.has(k) || ls.length < AUTO_MIN) continue;
    out.push({ folderId: null, nome: cap(ls[0].tema || ''), linkIds: ls.map(l => l.id) });
  }
  return out;
}
