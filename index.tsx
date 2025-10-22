
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode désactivé temporairement car il cause des conflits avec le rendu PDF (double montage)
  // En production, StrictMode n'est pas actif donc pas de problème
  <App />
);
