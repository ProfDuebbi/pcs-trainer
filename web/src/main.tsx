import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './haut/nexus.css';
import './haut/trainer.css';
import App from './App';

createRoot(document.getElementById('wurzel')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
