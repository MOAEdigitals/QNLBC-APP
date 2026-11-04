import { CopyFeedbackToast } from './components/CopyFeedbackToast';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppDialogHost } from './components/AppDialogHost';
import './index.css';
import { installInputAssistance } from './utils/inputAssistance';
import { installFormViewport } from './utils/formViewport';

const removeInputAssistance = installInputAssistance();
if (import.meta.hot) import.meta.hot.dispose(removeInputAssistance);

const removeFormViewport = installFormViewport();
if (import.meta.hot) import.meta.hot.dispose(removeFormViewport);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <AppDialogHost />
    <CopyFeedbackToast />
  </StrictMode>,
);
