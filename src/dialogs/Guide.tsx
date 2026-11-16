import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import { closeModal, installApp, markSetup } from '../actions';
import { Modal } from './Modal';
import { IcoCheck, IcoCopy, IcoX } from '../components/icons';
import { platform, SHARE_HASH, type Plat } from '../lib/setup';

/** Ícone do disorder dentro das ilustrações. */
const AppIcon = ({ big }: { big?: boolean }) => <img className={'il-app' + (big ? ' big' : '')} src="/icon-192.png" alt="" />;

/** Mini celular desenhado: a moldura e o que está em destaque no passo. */
function Phone({ children, label }: { children: ReactNode; label: string }) {
  return <figure className="il" role="img" aria-label={label}><div className="il-scr">{children}</div></figure>;
}

const IllChromeMenu = () => (
  <Phone label="Menu do Chrome com Instalar app em destaque">
    <div className="il-bar"><span className="il-url" /><span className="il-dots hl">⋮</span></div>
    <div className="il-menu">
      <span>Nova guia</span><span>Histórico</span><span className="hl">Instalar app</span><span className="il-off">Adicionar à tela inicial</span>
    </div>
  </Phone>
);
const IllSafariAdd = () => (
  <Phone label="Menu de compartilhar do Safari com Adicionar à Tela de Início em destaque">
    <div className="il-sheet">
      <span>Copiar</span><span>Adicionar aos Favoritos</span><span className="hl">Adicionar à Tela de Início</span>
    </div>
    <div className="il-bottom"><span className="il-share hl" aria-hidden="true">⬆</span></div>
  </Phone>
);
const IllShareSheet = ({ name }: { name: string }) => (
  <Phone label={'Folha de compartilhar com ' + name + ' em destaque'}>
    <div className="il-post" />
    <div className="il-apps">
      <span className="il-dot" data-c="1" /><span className="il-dot" data-c="4" />
      <span className="il-pick hl"><AppIcon /><b>{name}</b></span>
      <span className="il-dot" data-c="6" />
    </div>
  </Phone>
);
const IllShortcut = () => (
  <Phone label="Editor do Atalhos com a ação Abrir URLs">
    <div className="il-blk"><span>Receber <i>URLs</i> do Compartilhar</span></div>
    <div className="il-blk hl">Abrir URLs<span className="il-code">{SHARE_HASH}<i>Entrada do Atalho</i></span></div>
  </Phone>
);

function Steps({ items }: { items: ReactNode[] }) {
  return <ol className="gd-steps">{items.map((t, i) => <li key={i}><span className="gd-n" aria-hidden="true">{i + 1}</span><span>{t}</span></li>)}</ol>;
}

function Part({ id, title, done, onDone, ill, children }: { id: string; title: string; done: boolean; onDone: (v: boolean) => void; ill: ReactNode; children: ReactNode }) {
  return (
    <section className="gd-part" id={id} aria-labelledby={id + '-t'}>
      <div className="gd-ill">{ill}</div>
      <div className="gd-body">
        <h3 id={id + '-t'}>{title}</h3>
        {children}
        <button type="button" className={'btn gd-done' + (done ? ' on' : '')} aria-pressed={done} onClick={() => onDone(!done)}>
          {done ? <><IcoCheck />Feito</> : 'Marcar como feito'}
        </button>
      </div>
    </section>
  );
}

/** Tela "Leve o disorder para o celular": instalar o app e salvar pelo Compartilhar, no iPhone e no Android. */
export function Guide({ part }: { part?: 'app' | 'share' }) {
  const here = platform();
  const [plat, setPlat] = useState<Exclude<Plat, 'desktop'>>(here === 'ios' ? 'ios' : 'android');
  const setup = useStore(s => s.setup), canInstall = useStore(s => s.canInstall);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const addr = location.origin + '/' + SHARE_HASH;

  useEffect(() => {
    if (part !== 'share') return;
    root.current?.querySelector('#gd-' + part)?.scrollIntoView({ block: 'start' });
  }, [part, plat]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(addr); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem permissão */ }
  };

  return (
    <Modal labelledBy="gd-title" onClose={closeModal}>
      <div className="guide" ref={root}>
        <div className="gd-head">
          <h2 id="gd-title">Leve o disorder para o celular</h2>
          <button type="button" className="lv-x gd-x" aria-label="Fechar" onClick={closeModal}><IcoX /></button>
          <p>Instale o app e salve links direto do Compartilhar, sem copiar e colar.</p>
          <div className="seg txt" role="group" aria-label="Celular">
            <button type="button" aria-pressed={plat === 'ios'} onClick={() => setPlat('ios')}>iPhone</button>
            <button type="button" aria-pressed={plat === 'android'} onClick={() => setPlat('android')}>Android</button>
          </div>
        </div>

        {here === 'desktop' && canInstall && (
          <div className="gd-pc">
            <span>Também dá para instalar neste computador.</span>
            <button type="button" className="btn" onClick={() => void installApp()}>Instalar aqui</button>
          </div>
        )}

        {plat === 'android' ? (
          <>
            <Part id="gd-app" title="Instale o app" done={setup.app} onDone={v => markSetup('app', v)} ill={<IllChromeMenu />}>
              {here === 'android' && canInstall && <button type="button" className="btn primary gd-cta" onClick={() => void installApp()}>Instalar agora</button>}
              <Steps items={[
                <>Abra o disorder no <b>Chrome</b>.</>,
                <>Toque no menu <b>⋮</b>.</>,
                <>Escolha <b>Instalar app</b>. Adicionar à tela inicial cria só um atalho e não entra no Compartilhar.</>,
              ]} />
            </Part>
            <Part id="gd-share" title="Salve pelo Compartilhar" done={setup.share} onDone={v => markSetup('share', v)} ill={<IllShareSheet name="disorder" />}>
              <Steps items={[
                <>Em qualquer app, toque em <b>Compartilhar</b>.</>,
                <>Escolha <b>disorder</b>. O link entra na hora.</>,
              ]} />
              <p className="gd-note">Na primeira vez pode levar alguns minutos para o disorder aparecer na lista. Se não aparecer, reinicie o celular.</p>
            </Part>
          </>
        ) : (
          <>
            <Part id="gd-app" title="Instale o app" done={setup.app} onDone={v => markSetup('app', v)} ill={<IllSafariAdd />}>
              <Steps items={[
                <>Abra o disorder no <b>Safari</b>.</>,
                <>Toque em <b>Compartilhar</b>. Se não estiver na barra, fica no menu <b>⋯</b>.</>,
                <>Escolha <b>Adicionar à Tela de Início</b>, deixe <b>Abrir como app web</b> ligado e toque em <b>Adicionar</b>.</>,
              ]} />
            </Part>
            <Part id="gd-share" title="Crie o atalho de compartilhar" done={setup.share} onDone={v => markSetup('share', v)} ill={<IllShortcut />}>
              <p className="gd-why">O iPhone não deixa apps da web aparecerem no Compartilhar. Um atalho do app Atalhos faz esse papel.</p>
              <Steps items={[
                <>Abra o app <b>Atalhos</b> e toque em <b>+</b>. Dê o nome <b>Salvar no disorder</b>.</>,
                <>Toque em <b>ⓘ</b> e ligue <b>Mostrar ao Compartilhar</b>.</>,
                <>Adicione a ação <b>Abrir URLs</b>. No endereço, cole o texto abaixo e, logo depois dele, toque em <b>Entrada do Atalho</b>.</>,
                <>Pronto. Em qualquer app, <b>Compartilhar</b> e <b>Salvar no disorder</b>.</>,
              ]} />
              <div className="gd-copy">
                <code>{addr}</code>
                <button type="button" className="btn" onClick={() => void copy()}>{copied ? <><IcoCheck />Copiado</> : <><IcoCopy />Copiar</>}</button>
              </div>
              <p className="gd-note">O atalho abre o disorder no Safari. Na primeira vez, entre na sua conta por lá também.</p>
            </Part>
          </>
        )}
      </div>
    </Modal>
  );
}
