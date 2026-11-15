import { useState } from 'react';
import { get, set, useStore, type ModalState } from '../store';
import { archiveFolder, cancelModal, closeModal, deleteFolder, folderById, openModal, purge, save, setArchived, submitFolder, toast } from '../actions';
import type { Link } from '../types';
import { isArch } from '../lib/filters';
import { PLAT, autoTitle, fmtDate, fmtDuration, readLabel, shortUrl } from '../lib/platforms';
import { CFG } from '../config';
import { useSortedFolders } from '../hooks/useVisible';
import { Preview } from '../components/LinkList';
import { Modal } from './Modal';

function LinkDialog({ link: l }: { link: Link }) {
  const folders = useSortedFolders();
  const d = get().draft?.id === l.id ? get().draft : null;
  const [titulo, setTitulo] = useState(d ? d.titulo : l.titulo || ''), [nota, setNota] = useState(d ? d.nota : l.nota || '');
  const [pasta, setPasta] = useState(d ? d.pasta : l.pastaId || '');
  const p = PLAT[l.plataforma] || PLAT.web, arch = isArch(l);
  const facts = [l.publicadoEm ? 'Publicado em ' + fmtDate(l.publicadoEm) : '', l.duracao ? fmtDuration(l.duracao) : '', l.leitura ? readLabel(l.leitura) : ''].filter(Boolean);
  const unreadable = !!CFG.previewApi && l.enriquecido && !l.tituloAuto && !l.thumb;

  const submit = () => {
    const novaPasta = arch ? l.pastaId || null : pasta || null, antes = l.pastaId || null;
    set({ draft: null }); closeModal();
    void save('links', { ...l, titulo: titulo.trim(), nota: nota.trim(), pastaId: novaPasta });
    if (novaPasta === antes) { toast('Alterações salvas.'); return; }
    const fo = folderById(novaPasta);
    toast('Movido para ' + (fo ? fo.nome : 'Sem pasta') + '.', 'Desfazer', () => {
      const cur = get().links.find(x => x.id === l.id);
      if (cur) void save('links', { ...cur, pastaId: antes });
    });
  };
  const archive = (on: boolean) => { set({ draft: null }); closeModal(); setArchived([l], on); };

  return (
    <Modal labelledBy="mt" onClose={cancelModal}>
      <div className="lm-head">
        <Preview link={l} cls="sm" />
        <div className="lm-t">
          <h2 id="mt">Editar link</h2>
          <a className="lm-url" href={l.url} target="_blank" rel="noopener noreferrer">{p.label} · {shortUrl(l.url)}</a>
          {facts.length > 0 && <span className="lm-meta">{facts.join(' · ')}</span>}
        </div>
      </div>
      {unreadable && <p className="hint">Este {l.plataforma === 'web' ? 'site' : 'link'} não deixou ler o título e a imagem. O link foi salvo assim mesmo, e você pode escrever o título abaixo.</p>}
      <form className="mform" noValidate onSubmit={e => { e.preventDefault(); submit(); }}>
        <label className="f">Título<span className="inw"><input type="text" name="titulo" maxLength={140} autoComplete="off" placeholder={l.tituloAuto || autoTitle(l)} value={titulo} onChange={e => setTitulo(e.target.value)} /></span></label>
        {!arch && (
          <label className="f">Pasta
            <span className="inw">
              <select className="sel" name="pasta" value={pasta} onChange={e => {
                if (e.target.value !== '__new__') { setPasta(e.target.value); return; }
                set({ draft: { id: l.id, titulo, nota, pasta } });
                openModal({ kind: 'new', then: { type: 'edit-pasta', linkId: l.id } });
              }}>
                <option value="">Sem pasta</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                <option value="__new__">+ Nova pasta…</option>
              </select>
            </span>
          </label>
        )}
        <label className="f">Nota<span className="inw"><textarea name="nota" rows={3} maxLength={600} placeholder="Por que você guardou este link?" value={nota} onChange={e => setNota(e.target.value)} /></span></label>
        <div className="row mfoot">
          {arch
            ? <><button type="button" className="btn danger" onClick={() => { set({ draft: null, modal: { kind: 'purge', ids: [l.id] } }); }}>Excluir de vez</button><button type="button" className="btn outline" onClick={() => archive(false)}>Restaurar</button></>
            : <button type="button" className="btn ghost" onClick={() => archive(true)}>Arquivar</button>}
          <span className="sp" />
          <button type="button" className="btn outline" onClick={cancelModal}>Cancelar</button>
          <button type="submit" className="btn primary">Salvar</button>
        </div>
      </form>
    </Modal>
  );
}

function FolderDialog({ m }: { m: Extract<ModalState, { kind: 'new' | 'edit' }> }) {
  const f = m.kind === 'edit' ? folderById(m.id) : null;
  const [nome, setNome] = useState(f ? f.nome : ''), [err, setErr] = useState('');
  const submit = () => {
    const r = submitFolder(nome, f ? f.id : null, m.kind === 'new' ? m.then : undefined);
    if (!r.ok) { setErr(r.error); document.getElementById('folder-nome')?.focus(); }
  };
  return (
    <Modal labelledBy="mt" onClose={cancelModal}>
      <h2 id="mt">{f ? 'Editar pasta' : 'Nova pasta'}</h2>
      <form noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={e => { e.preventDefault(); submit(); }}>
        <label className="f">Nome<span className="inw"><input type="text" id="folder-nome" name="nome" maxLength={40} autoComplete="off" placeholder="Por exemplo, Receitas" value={nome} onChange={e => setNome(e.target.value)} /></span></label>
        <p className="ferr" role="alert">{err}</p>
        <div className="row">
          {f && <button type="button" className="btn danger" style={{ marginRight: 'auto' }} onClick={() => openModal({ kind: 'confirm', id: f.id })}>Excluir pasta</button>}
          <button type="button" className="btn outline" onClick={cancelModal}>Cancelar</button>
          <button type="submit" className="btn primary">{f ? 'Salvar' : 'Criar pasta'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ArchiveFolder({ id }: { id: string }) {
  const f = folderById(id), n = useStore(s => s.links.filter(l => l.pastaId === id && !l.arquivadoEm).length);
  return (
    <Modal labelledBy="mt" onClose={cancelModal}>
      <h2 id="mt">Arquivar a pasta {f ? f.nome : ''}?</h2>
      <p>{n ? 'Ela tem ' + (n === 1 ? '1 link' : n + ' links') + '. O que fazer com ' + (n === 1 ? 'ele' : 'eles') + '?' : 'A pasta está vazia. Você pode restaurar em Ajustes.'}</p>
      <div className="choices">
        <button type="button" className="btn primary" onClick={() => void archiveFolder(id, true)}>Arquivar pasta e links<span>{n ? (n === 1 ? 'O link vai para Arquivados.' : 'Os links vão para Arquivados.') + ' Voltam juntos se você restaurar a pasta.' : 'Guarda a pasta fora do menu.'}</span></button>
        {n > 0 && <button type="button" className="btn" onClick={() => void archiveFolder(id, false)}>Arquivar só a pasta<span>{n === 1 ? 'O link continua visível, em Sem pasta.' : 'Os links continuam visíveis, em Sem pasta.'}</span></button>}
        <button type="button" className="btn outline" onClick={cancelModal}>Cancelar</button>
      </div>
    </Modal>
  );
}

function ConfirmFolder({ id }: { id: string }) {
  const f = folderById(id), n = useStore(s => s.links.filter(l => l.pastaId === id).length);
  return (
    <Modal labelledBy="mt" onClose={cancelModal}>
      <h2 id="mt">Excluir a pasta {f ? f.nome : ''}?</h2>
      <p>{n ? (n === 1 ? 'O link dela vai' : 'Os ' + n + ' links dela vão') + ' para Arquivados. Nenhum link é apagado, e você pode restaurar depois.' : 'A pasta está vazia.'}</p>
      <div className="row"><button className="btn outline" onClick={cancelModal}>Cancelar</button><button className="btn destructive" onClick={() => void deleteFolder(id)}>Excluir pasta</button></div>
    </Modal>
  );
}

function Purge({ ids }: { ids: string[] }) {
  const n = ids.length;
  return (
    <Modal labelledBy="mt" onClose={cancelModal}>
      <h2 id="mt">{n === 1 ? 'Excluir este link de vez?' : 'Excluir ' + n + ' links de vez?'}</h2>
      <p>Eles somem do disorder e não dá para desfazer. Se quiser só tirar da frente, deixe arquivado.</p>
      <div className="row"><button className="btn outline" onClick={cancelModal}>Cancelar</button><button className="btn destructive" onClick={() => purge(ids)}>Excluir de vez</button></div>
    </Modal>
  );
}

export function ModalHost() {
  const m = useStore(s => s.modal);
  const link = useStore(s => (m?.kind === 'link' ? s.links.find(x => x.id === m.id) : undefined));
  if (!m) return null;
  if (m.kind === 'link') return link ? <LinkDialog key={m.id} link={link} /> : null;
  if (m.kind === 'purge') return <Purge ids={m.ids} />;
  if (m.kind === 'confirm') return <ConfirmFolder id={m.id} />;
  if (m.kind === 'archive-folder') return <ArchiveFolder id={m.id} />;
  return <FolderDialog key={m.kind} m={m} />;
}
