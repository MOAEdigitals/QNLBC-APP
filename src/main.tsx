import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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
  const height = Math.min(viewport?.height ?? window.innerHeight, keyboardTop);
  document.documentElement.classList.toggle('keyboard-open', formViewportBaseline - height > 120);
  document.documentElement.style.setProperty('--form-viewport-height', `${height}px`);
  document.documentElement.style.setProperty('--form-viewport-top', `${viewport?.offsetTop ?? 0}px`);
};
keyboard?.addEventListener('geometrychange', updateFormViewport);
window.visualViewport?.addEventListener('resize', updateFormViewport);
window.visualViewport?.addEventListener('scroll', updateFormViewport);
window.addEventListener('resize', updateFormViewport);
updateFormViewport();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
