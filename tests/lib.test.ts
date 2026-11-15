import { describe, expect, it } from 'vitest';
import { autoTitle, clipTitle, fmtDuration, isParsed, kindOf, originOf, parseLink, summaryOf } from '../src/lib/platforms';
import { extrasOf } from '../src/data/previews';
import { EMPTY_FILTERS, datePreset, filterCount, visibleLinks } from '../src/lib/filters';
import { planImport } from '../src/lib/dataio';
import { planAutoFolders } from '../src/lib/auto';
import type { Folder, Link } from '../src/types';

const link = (o: Partial<Link>): Link => ({ id: 'x', url: 'https://a.com', chave: 'k', plataforma: 'web', tipo: 'Link', autor: null, titulo: '', nota: '', pastaId: null, criadoEm: 0, enriquecido: true, ...o });
const parsed = (u: string) => { const p = parseLink(u); if (!isParsed(p)) throw new Error('inválido: ' + u); return p; };

describe('parseLink', () => {
  it('reconhece o mesmo vídeo do YouTube em endereços diferentes', () => {
    const a = parsed('https://www.youtube.com/watch?v=abc123&utm_source=x&t=10'), b = parsed('youtu.be/abc123');
    expect(a.key).toBe('yt:abc123');
    expect(b.key).toBe(a.key);
    expect(a.url).toBe('https://www.youtube.com/watch?v=abc123');
  });
  it('identifica plataforma, tipo e autor', () => {
    expect(parsed('https://x.com/fulano/status/99')).toMatchObject({ plataforma: 'x', tipo: 'Post', autor: '@fulano', key: 'x:99' });
    expect(parsed('https://www.instagram.com/reel/XYZ/?igsh=1')).toMatchObject({ plataforma: 'instagram', tipo: 'Reel', key: 'ig:XYZ' });
    expect(parsed('https://www.tiktok.com/@ana/video/7')).toMatchObject({ plataforma: 'tiktok', tipo: 'Vídeo', autor: '@ana' });
    expect(parsed('https://www.threads.net/@ana/post/Q1')).toMatchObject({ plataforma: 'threads', tipo: 'Post' });
  });
  it('limpa rastreadores de sites comuns', () => {
    expect(parsed('https://site.com/a/?utm_medium=y&id=3#topo').url).toBe('https://site.com/a/?id=3');
  });
  it('recusa o que não é link', () => {
    expect(parseLink('')).toEqual({ error: 'vazio' });
    expect(parseLink('dois links aqui')).toEqual({ error: 'espaco' });
    expect(parseLink('semponto')).toEqual({ error: 'invalido' });
    expect(parseLink('ftp://a.com/x')).toEqual({ error: 'invalido' });
  });
});

describe('títulos', () => {
  it('gera um título quando não há outro', () => {
    expect(autoTitle(parsed('https://x.com/fulano/status/99'))).toBe('Post de @fulano');
    expect(autoTitle(parsed('https://site.com/a'))).toBe('site.com');
  });
  it('corta no limite sem quebrar palavra', () => {
    const t = clipTitle('palavra '.repeat(40).trim(), 60);
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.endsWith('…')).toBe(true);
    expect(clipTitle('curto', 60)).toBe('curto');
  });
});

describe('filtros', () => {
  const folders: Folder[] = [{ id: 'f1', nome: 'Receitas' }];
  const now = Date.now();
  const links = [
    link({ id: 'a', plataforma: 'youtube', pastaId: 'f1', criadoEm: now, tituloAuto: 'Bolo de fubá' }),
    link({ id: 'b', plataforma: 'x', criadoEm: now - 40 * 864e5, nota: 'ler depois' }),
    link({ id: 'c', arquivadoEm: 1, criadoEm: now }),
    link({ id: 'd', pastaId: 'sumiu', criadoEm: now - 1000 }),
  ];
  const ids = (view: string, f = {}) => visibleLinks(links, folders, view, { ...EMPTY_FILTERS, ...f }).map(l => l.id);
  it('separa as telas', () => {
    expect(ids('all')).toEqual(['a', 'd', 'b']);
    expect(ids('archived')).toEqual(['c']);
    expect(ids('f1')).toEqual(['a']);
    expect(ids('none')).toEqual(['d', 'b']);
  });
  it('busca em título automático, nota e nome da pasta', () => {
    expect(ids('all', { q: 'fubá' })).toEqual(['a']);
    expect(ids('all', { q: 'DEPOIS' })).toEqual(['b']);
    expect(ids('all', { q: 'receitas' })).toEqual(['a']);
  });
  it('filtra por origem, pasta e data', () => {
    expect(ids('all', { plats: ['x'] })).toEqual(['b']);
    expect(ids('all', { fp: ['none'] })).toEqual(['b']);
    expect(ids('all', datePreset(7, now))).toEqual(['a', 'd']);
  });
  it('conta filtros ativos', () => {
    expect(filterCount({ ...EMPTY_FILTERS, q: ' ', fp: ['f1'] }, 'f1')).toBe(0);
    expect(filterCount({ ...EMPTY_FILTERS, q: 'a', fp: ['f1'], from: '2026-01-01' }, 'all')).toBe(3);
  });
});

describe('importação', () => {
  it('soma sem duplicar e reaproveita pasta de mesmo nome', () => {
    const folders: Folder[] = [{ id: 'f1', nome: 'Receitas' }];
    const links = [link({ chave: parsed('https://site.com/a').key })];
    const plan = planImport({ folders: [{ id: 'z', nome: 'receitas' }, { id: 'y', nome: 'Nova' }], links: [
      { url: 'https://site.com/a', pastaId: 'z' }, { url: 'https://site.com/b', pastaId: 'z', titulo: 'B' }, { url: 'nada' },
    ] }, folders, links)!;
    expect(plan.folders.map(f => f.nome)).toEqual(['Nova']);
    expect(plan.links).toHaveLength(1);
    expect(plan.links[0]).toMatchObject({ titulo: 'B', pastaId: 'f1' });
    expect(plan).toMatchObject({ dup: 1, bad: 1 });
  });
  it('recusa arquivo sem dados', () => { expect(planImport({ nada: 1 }, [], [])).toBeNull(); });
});

describe('cartão inteligente', () => {
  it('classifica o tipo de conteúdo', () => {
    expect(kindOf(link({ plataforma: 'youtube', tipo: 'Vídeo' }))).toBe('video');
    expect(kindOf(link({ plataforma: 'instagram', tipo: 'Reel' }))).toBe('video');
    expect(kindOf(link({ plataforma: 'x', tipo: 'Post' }))).toBe('post');
    expect(kindOf(link({ plataforma: 'youtube', tipo: 'Canal' }))).toBe('profile');
    expect(kindOf(link({ plataforma: 'web', leitura: 6 }))).toBe('article');
    expect(kindOf(link({ plataforma: 'web' }))).toBe('site');
    expect(kindOf(link({ plataforma: 'web', duracao: 90 }))).toBe('video');
  });
  it('formata duração', () => {
    expect(fmtDuration(45)).toBe('0:45');
    expect(fmtDuration(253)).toBe('4:13');
    expect(fmtDuration(3723)).toBe('1:02:03');
  });
  it('mostra o domínio como origem dos sites', () => {
    expect(originOf(link({ plataforma: 'web', url: 'https://www.blog.com/a', leitura: 4 }))).toBe('blog.com');
    expect(originOf(link({ plataforma: 'youtube', tipo: 'Short' }))).toBe('YouTube');
  });
  it('só mostra resumo quando acrescenta algo', () => {
    expect(summaryOf(link({ plataforma: 'web', descricao: 'Como arrumar uma sala pequena', tituloAuto: 'Sala pequena' }))).toBe('Como arrumar uma sala pequena');
    expect(summaryOf(link({ plataforma: 'web', descricao: 'Sala pequena: dez ideias', tituloAuto: 'Sala pequena: dez ideias para você' }))).toBe('');
    expect(summaryOf(link({ plataforma: 'x', tipo: 'Post', descricao: 'texto do post' }))).toBe('');
  });
  it('aproveita só o que veio do preview', () => {
    expect(extrasOf(null)).toEqual({});
    expect(extrasOf({ title: 'T', image: 'http://inseguro/a.jpg', duracao: 0, leitura: 5, icone: 'https://a.com/i.png' })).toEqual({ tituloAuto: 'T', leitura: 5, icone: 'https://a.com/i.png' });
  });
});

describe('pasta automática', () => {
  const t = (id: string, tema: string, o: Partial<Link> = {}) => link({ id, tema, ...o });
  const pasta = (id: string, nome: string, o: Partial<Folder> = {}): Folder => ({ id, nome, ...o });
  it('só cria pasta quando há 3 links do mesmo tema', () => {
    expect(planAutoFolders([t('a', 'receitas'), t('b', 'receitas')], [])).toEqual([]);
    const p = planAutoFolders([t('a', 'receitas'), t('b', 'Receita'), t('c', 'receitas')], []);
    expect(p).toEqual([{ folderId: null, nome: 'Receitas', linkIds: ['a', 'b', 'c'] }]);
  });
  it('entra em pasta que já existe com o mesmo nome, mesmo com um link só', () => {
    const p = planAutoFolders([t('a', 'decoração')], [pasta('f1', 'Decoracao')]);
    expect(p).toEqual([{ folderId: 'f1', nome: 'Decoracao', linkIds: ['a'] }]);
  });
  it('não mexe em link com pasta, arquivado, sem tema ou movido à mão', () => {
    const ls = [t('a', 'pet', { pastaId: 'f9' }), t('b', 'pet', { arquivadoEm: 5 }), t('c', ''), t('d', 'pet', { pastaManual: true }), t('e', 'pet')];
    expect(planAutoFolders(ls, [])).toEqual([]);
  });
  it('não recria tema dispensado e ignora pasta arquivada', () => {
    const ls = [t('a', 'viagem'), t('b', 'viagem'), t('c', 'viagem')];
    expect(planAutoFolders(ls, [], ['Viagens'])).toEqual([]);
    expect(planAutoFolders(ls, [pasta('f', 'Viagem', { arquivadaEm: 9 })])).toHaveLength(1);
  });
});
