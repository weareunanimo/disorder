import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import { App } from './App';
import { boot } from './boot';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
void boot();
