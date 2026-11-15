import { useEffect } from 'react';
import { useStore } from './store';
import { useGlobalEvents } from './hooks/useGlobalEvents';
import { Brand, ClipBanner, Fab, LoadError, Toast } from './components/Bits';
import { Nav } from './components/Nav';
import { Head } from './components/Head';
import { Toolbar } from './components/Toolbar';
import { LinkList } from './components/LinkList';
import { Settings } from './components/Settings';
import { SelectionBar } from './components/SelectionBar';
import { Login } from './components/Login';
import { AddDialog } from './dialogs/AddDialog';
import { ModalHost } from './dialogs/Dialogs';

/** O CSS usa classes no <body> para esconder o botão flutuante, abrir espaço para a barra de seleção e travar a rolagem. */
function useBodyClasses() {
  const view = useStore(s => s.view), hasSel = useStore(s => s.sel.length > 0), adding = useStore(s => s.adding);
  useEffect(() => {
    const c = document.body.classList;
    c.toggle('v-arch', view === 'archived');
    c.toggle('v-set', view === 'settings');
    c.toggle('has-bar', hasSel);
    c.toggle('locked', adding);
  }, [view, hasSel, adding]);
}

export function App() {
  const phase = useStore(s => s.phase), adding = useStore(s => s.adding);
  const settings = useStore(s => s.view === 'settings' && s.loaded);
  useGlobalEvents();
  useBodyClasses();
  if (phase === 'login') return <Login />;
  return (
    <>
      <Brand />
      <div className="app">
        <Nav />
        <main className="main">
          <LoadError />
          <section aria-labelledby="view-title">
            <Head />
            <ClipBanner />
            <Toolbar />
            {settings ? <Settings /> : <LinkList />}
          </section>
        </main>
      </div>
      {adding && <AddDialog />}
      <ModalHost />
      <Fab />
      <SelectionBar />
      <Toast />
    </>
  );
}
