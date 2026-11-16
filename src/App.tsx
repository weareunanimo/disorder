import { useEffect } from 'react';
import { useStore } from './store';
import { useGlobalEvents } from './hooks/useGlobalEvents';
import { LoadError, Toast } from './components/Bits';
import { Header } from './components/Header';
import { SubBar } from './components/Toolbar';
import { TagsGrid } from './components/TagsGrid';
import { useVisible } from './hooks/useVisible';
import { LinkList } from './components/LinkList';
import { Settings } from './components/Settings';
import { SelectionBar } from './components/SelectionBar';
import { Login } from './components/Login';
import { ModalHost } from './dialogs/Dialogs';

/** O CSS usa classes no <body> para abrir espaço para a barra de seleção e travar a rolagem. */
function useBodyClasses() {
  const view = useStore(s => s.view), hasSel = useStore(s => s.sel.length > 0), sheet = useStore(s => s.profileOpen);
  useEffect(() => {
    const c = document.body.classList;
    c.toggle('v-arch', view === 'archived');
    c.toggle('v-set', view === 'settings');
    c.toggle('has-bar', hasSel);
    c.toggle('locked', sheet && window.matchMedia('(hover: none)').matches);
    c.toggle('v-tags', view === 'tags');
  }, [view, hasSel, sheet]);
}

function Content({ settings }: { settings: boolean }) {
  const view = useStore(s => s.view), n = useVisible().length;
  return (
    <section aria-labelledby="view-title">
      <SubBar count={n} />
      {settings ? <Settings /> : view === 'tags' ? <TagsGrid /> : <LinkList />}
    </section>
  );
}

export function App() {
  const phase = useStore(s => s.phase);
  const settings = useStore(s => s.view === 'settings' && s.loaded);
  useGlobalEvents();
  useBodyClasses();
  if (phase === 'login') return <Login />;
  return (
    <>
      <Header />
      <main className="main">
        <LoadError />
        <Content settings={settings} />
      </main>
      <ModalHost />
      <SelectionBar />
      <Toast />
    </>
  );
}
