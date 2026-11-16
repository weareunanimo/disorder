import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { set, useStore, type Theme } from '../store';
import { exportData, importData, moveFolder, openModal, refreshPreviews, renameFolder, restoreFolder, setFolderColor, setAi, setProfileName, setTheme, signOut, summarizeExisting } from '../actions';
import { CFG } from '../config';
import { hasTag } from '../lib/tags';
import type { Folder } from '../types';
import { SW_NAMES, colorOf } from '../lib/folders';
import { plural } from '../lib/text';
import { useCounts, useSortedFolders } from '../hooks/useVisible';
import { IcoArchive, IcoDown, IcoTrashSm, IcoUp } from './icons';

const THEMES: [Theme, string][] = [['light', 'Claro'], ['dark', 'Escuro'], ['system', 'Sistema']];
const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); };

/** Campo de texto que só grava ao sair dele (ou Enter). Se a gravação for recusada, volta ao valor salvo. */
function CommitInput({ value, onCommit, ...rest }: { value: string; onCommit: (v: string) => boolean | void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <input type="text" {...rest} value={v} onChange={e => setV(e.target.value)} onKeyDown={blurOnEnter}
      onBlur={() => { if (v.trim() === value) { setV(value); return; } if (onCommit(v) === false) setV(value); }} />
  );
}

function FolderRow({ f, i, last, count, drag }: { f: Folder; i: number; last: boolean; count: number; drag: { id: string | null; over: string | null; start: (id: string, e: DragEvent) => void; over_: (id: string, e: DragEvent) => void; drop: (id: string, e: DragEvent) => void; end: () => void } }) {
  const palOpen = useStore(s => s.pal === f.id);
  const c = colorOf(f), swatch = useRef<HTMLButtonElement>(null);
  return (
    <li className={'frow' + (drag.id === f.id ? ' drag' : '') + (drag.over === f.id ? ' over' : '')} draggable data-id={f.id}
      onDragStart={e => { if ((e.target as HTMLElement).closest('input')) { e.preventDefault(); return; } drag.start(f.id, e); }}
      onDragOver={e => drag.over_(f.id, e)} onDrop={e => drag.drop(f.id, e)} onDragEnd={drag.end}>
      <button type="button" ref={swatch} className="sw-btn" style={{ background: `var(--tag${c}-bg)` }} aria-expanded={palOpen}
        aria-label={'Cor da tag ' + f.nome + ', ' + SW_NAMES[c] + '. Trocar cor'} title="Trocar cor" onClick={() => set({ pal: palOpen ? null : f.id })} />
      <span className="inw"><CommitInput className="fname" maxLength={40} autoComplete="off" aria-label="Nome da tag" value={f.nome} onCommit={v => renameFolder(f.id, v)} /></span>
      <span className="fct">{f.auto && <span className="fauto" title="Criada pela IA. Ao renomear, ela passa a ser sua.">IA</span>}{plural(count, '1 link', 'links')}</span>
      <span className="fa">
        <button type="button" className="btn sm icon" disabled={i === 0} aria-label={'Subir ' + f.nome} title="Subir" onClick={() => moveFolder(f.id, i - 1)}><IcoUp /></button>
        <button type="button" className="btn sm icon" disabled={last} aria-label={'Descer ' + f.nome} title="Descer" onClick={() => moveFolder(f.id, i + 1)}><IcoDown /></button>
        <button type="button" className="btn sm icon" aria-label={'Arquivar tag ' + f.nome} title="Arquivar tag" onClick={() => openModal({ kind: 'archive-folder', id: f.id })}><IcoArchive /></button>
        <button type="button" className="btn sm icon danger" aria-label={'Excluir tag ' + f.nome} title="Excluir tag" onClick={() => openModal({ kind: 'confirm', id: f.id })}><IcoTrashSm /></button>
      </span>
      {palOpen && (
        <div className="pal" role="radiogroup" aria-label={'Cor da tag ' + f.nome}>
          {SW_NAMES.map((name, k) => (
            <button key={k} type="button" className="sw-btn" role="radio" aria-checked={k === c} style={{ background: `var(--tag${k}-bg)` }} aria-label={name} title={name}
              onClick={() => { setFolderColor(f.id, k); swatch.current?.focus(); }} />
          ))}
        </div>
      )}
    </li>
  );
}

export function Settings() {
  const profile = useStore(s => s.profile), theme = useStore(s => s.theme), ai = useStore(s => s.ai), mode = useStore(s => s.mode);
  const nLinks = useStore(s => s.links.length), nFolders = useStore(s => s.folders.length), refreshing = useStore(s => s.refreshing), summarizingAll = useStore(s => s.summarizingAll), aiProgress = useStore(s => s.aiProgress);
  const folders = useSortedFolders(), counts = useCounts();
  const arq = useStore(s => s.foldersArq), allLinks = useStore(s => s.links);
  const arqCount = (id: string) => allLinks.filter(l => hasTag(l, id) && l.arquivadoEm).length;
  const file = useRef<HTMLInputElement>(null);
  const [dragId, setDragId] = useState<string | null>(null), [overId, setOverId] = useState<string | null>(null);

  const drag = {
    id: dragId, over: overId,
    start: (id: string, e: DragEvent) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', id); } catch { /* alguns navegadores recusam */ } },
    over_: (id: string, e: DragEvent) => { if (!dragId) return; e.preventDefault(); setOverId(id === dragId ? null : id); },
    drop: (id: string, e: DragEvent) => {
      if (!dragId) return;
      e.preventDefault();
      const to = folders.findIndex(f => f.id === id);
      if (to >= 0 && id !== dragId) moveFolder(dragId, to);
      setDragId(null); setOverId(null);
    },
    end: () => { setDragId(null); setOverId(null); },
  };

  return (
    <div className="settings" id="list" style={{ marginTop: 14 }}>
      <section className="sblock" aria-labelledby="s-perfil">
        <h2 id="s-perfil">Perfil</h2>
        <label className="f">Nome<span className="inw"><CommitInput id="pf-nome" maxLength={60} autoComplete="name" placeholder="Como você quer ser chamado" value={profile.nome} onCommit={v => { void setProfileName(v); }} /></span></label>
        {profile.email && <div className="f">E-mail<p className="sval">{profile.email}</p></div>}
        <div className="f" role="group" aria-labelledby="s-tema">
          <span id="s-tema">Tema</span>
          <div className="seg txt">{THEMES.map(([k, label]) => <button key={k} type="button" aria-pressed={theme === k} onClick={() => setTheme(k)}>{label}</button>)}</div>
        </div>
        <div className="srow">
          <div className="st"><b>Ordem automática</b><span>{ai ? 'Ligada. A IA lê o título e a descrição de cada link novo, resume o conteúdo quando dá, identifica o que ele é (loja, artigo, receita...) e o tema, e organiza em tags sozinha. O endereço do link e suas notas não são enviados.' : 'Desligada. Você organiza tudo à mão, e nada sai do app além do endereço, que já é lido para montar o preview.'}</span></div>
          <div className="seg txt" role="group" aria-label="Ordem automática">{([[true, 'Ligada'], [false, 'Desligada']] as const).map(([v, label]) => <button key={label} type="button" aria-pressed={ai === v} onClick={() => setAi(v)}>{label}</button>)}</div>
        </div>
        {ai && CFG.summarizeApi && (
          <div className="srow">
            <div className="st"><b>Organizar links que já existem</b><span>Resume, identifica o tipo e o tema e organiza em tags os links não arquivados que ainda não passaram pela IA. Até 60 por vez, num ritmo de 5 por minuto por causa do plano grátis da IA. Deixe esta aba aberta.</span></div>
            <button type="button" className="btn" disabled={summarizingAll} onClick={() => void summarizeExisting()}>{summarizingAll ? 'Organizando ' + aiProgress.done + ' de ' + aiProgress.total : 'Organizar agora'}</button>
          </div>
        )}
        {mode === 'cloud' && (
          <div className="srow">
            <div className="st"><b>Sair</b><span>Encerra a sessão neste aparelho. Seus links continuam na conta.</span></div>
            <button type="button" className="btn" onClick={signOut}>Sair da conta</button>
          </div>
        )}
      </section>

      <section className="sblock" aria-labelledby="s-pastas">
        <div className="shead"><h2 id="s-pastas">Tags</h2><button type="button" className="btn sm" onClick={() => openModal({ kind: 'new', then: { type: 'stay' } })}>Nova tag</button></div>
        {!folders.length
          ? <p className="snote">Nenhuma tag ainda. Crie a primeira para organizar seus links.</p>
          : (
            <>
              <p className="snote">Use as setas para mudar a ordem. Com mouse, também dá para arrastar. A ordem vale para o menu e para a lista de tags ao salvar.</p>
              <ul className="flist" id="flist">
                {folders.map((f, i) => <FolderRow key={f.id} f={f} i={i} last={i === folders.length - 1} count={counts.by.get(f.id) || 0} drag={drag} />)}
              </ul>
            </>
          )}
      </section>

      {!!arq.length && (
        <section className="sblock" aria-labelledby="s-arq">
          <h2 id="s-arq">Tags arquivadas</h2>
          <p className="snote">Ficam fora do menu. Ao restaurar, voltam os links que foram arquivados junto com a tag.</p>
          <ul className="flist">
            {arq.map(f => (
              <li key={f.id} className="frow arq">
                <span className="sw-btn" style={{ background: `var(--tag${colorOf(f)}-bg)` }} aria-hidden="true" />
                <span className="fname-ro">{f.nome}</span>
                <span className="fct">{plural(arqCount(f.id), '1 link arquivado', 'links arquivados')}</span>
                <span className="fa"><button type="button" className="btn sm" onClick={() => void restoreFolder(f.id)}>Restaurar</button></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sblock" aria-labelledby="s-dados">
        <h2 id="s-dados">Dados</h2>
        <p className="snote">{mode === 'cloud' ? 'Seus links ficam salvos na sua conta e sincronizam entre os seus aparelhos.' : 'Modo local: seus links ficam só neste navegador.'}</p>
        <div className="srow">
          <div className="st"><b>Exportar</b><span>Baixa um arquivo com {plural(nLinks, '1 link', 'links')} e {plural(nFolders, '1 tag', 'tags')}, incluindo os arquivados.</span></div>
          <button type="button" className="btn" disabled={!nLinks && !nFolders} onClick={exportData}>Exportar arquivo</button>
        </div>
        <div className="srow">
          <div className="st"><b>Importar</b><span>Lê um arquivo exportado pelo disorder. Soma ao que já existe, sem duplicar links e sem apagar nada.</span></div>
          <button type="button" className="btn" onClick={() => { if (file.current) { file.current.value = ''; file.current.click(); } }}>Importar arquivo</button>
          <input type="file" ref={file} accept="application/json,.json" hidden onChange={e => void importData(e.target.files?.[0])} />
        </div>
        {CFG.previewApi && (
          <div className="srow">
            <div className="st"><b>Atualizar previews</b><span>Busca de novo o título e a imagem de todos os links não arquivados.</span></div>
            <button type="button" className="btn" disabled={refreshing} onClick={() => void refreshPreviews(false)}>{refreshing ? 'Atualizando' : 'Atualizar previews'}</button>
          </div>
        )}
      </section>
    </div>
  );
}
