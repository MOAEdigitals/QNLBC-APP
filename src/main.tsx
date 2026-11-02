import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppDialogHost } from './components/AppDialogHost';
import './index.css';
import { installInputAssistance } from './utils/inputAssistance';

const removeInputAssistance = installInputAssistance();
if (import.meta.hot) import.meta.hot.dispose(removeInputAssistance);

// Keep navigation stationary, but size modal forms to the unobscured viewport.
const keyboard = (navigator as Navigator & { virtualKeyboard?: EventTarget & { overlaysContent: boolean; boundingRect: DOMRect } }).virtualKeyboard;
if (keyboard) keyboard.overlaysContent = true;
let formViewportBaseline = window.innerHeight;
let formViewportWidth = window.innerWidth;
const updateFormViewport = () => {
  if (formViewportWidth !== window.innerWidth) {
    formViewportWidth = window.innerWidth;
    formViewportBaseline = window.innerHeight;
  }
  formViewportBaseline = Math.max(formViewportBaseline, window.innerHeight);
  const viewport = window.visualViewport;
  const keyboardTop = keyboard?.boundingRect.height ? keyboard.boundingRect.y : window.innerHeight;
  const viewportTop = viewport?.offsetTop ?? 0;
  const height = Math.min(viewport?.height ?? window.innerHeight, Math.max(0, keyboardTop - viewportTop));
  document.documentElement.classList.toggle('keyboard-open', formViewportBaseline - height > 120);
  document.documentElement.style.setProperty('--form-viewport-height', `${height}px`);
  document.documentElement.style.setProperty('--form-viewport-top', `${viewportTop}px`);
};
keyboard?.addEventListener('geometrychange', updateFormViewport);
window.visualViewport?.addEventListener('resize', updateFormViewport);
window.visualViewport?.addEventListener('scroll', updateFormViewport);
window.addEventListener('resize', updateFormViewport);
updateFormViewport();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <AppDialogHost />
  </StrictMode>,
);
