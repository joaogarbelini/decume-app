import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { seedIfNeeded } from './db/seed';
import './styles/app.css';

// Instala o service worker: o app abre offline e se atualiza sozinho.
registerSW({ immediate: true });

// Semeia o catálogo na primeira abertura; a tela não espera por isso.
seedIfNeeded().catch((err) => console.error('Falha ao preparar o catálogo', err));

// Pede ao navegador para não apagar os dados locais quando faltar espaço.
navigator.storage?.persist?.().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
