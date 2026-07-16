// Force clean reload and clear dev server caches for database reconnection - 2026-06-05
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register the service worker for PWA safely
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({ immediate: true });
  } catch (err) {
    console.warn('PWA Service Worker registration bypassed/failed in preview environment:', err);
  }
}

// Prevent forced user selection and context menus globally on web views (especially Android WebView),
// except inside input/textarea fields or contenteditable content where user input is required.
if (typeof window !== 'undefined') {
  const isInputField = (el: HTMLElement | null): boolean => {
    if (!el) return false;
    let curr: HTMLElement | null = el;
    while (curr) {
      const tag = curr.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || curr.isContentEditable || curr.getAttribute('contenteditable') === 'true') {
        return true;
      }
      curr = curr.parentElement;
    }
    return false;
  };

  window.addEventListener('contextmenu', (e) => {
    if (!isInputField(e.target as HTMLElement)) {
      e.preventDefault();
    }
  }, { capture: true });

  window.addEventListener('selectstart', (e) => {
    if (!isInputField(e.target as HTMLElement)) {
      e.preventDefault();
    }
  }, { capture: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
