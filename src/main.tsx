import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('virtualKeyboard' in navigator) {
  (navigator as Navigator & { virtualKeyboard: { overlaysContent: boolean } }).virtualKeyboard.overlaysContent = true;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
