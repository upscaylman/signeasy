import ReactDOM from "react-dom/client";
import App from "./App";

// 🛡️ Gestionnaire d'erreur global pour ignorer les erreurs d'extension de navigateur et WebSocket HMR
window.addEventListener("error", (event) => {
  // Ignorer les erreurs d'extension de navigateur (browser-polyfill, extension context invalidated)
  if (
    event.message?.includes("Extension context invalidated") ||
    event.filename?.includes("browser-polyfill") ||
    event.filename?.includes("chrome-extension://") ||
    event.filename?.includes("extension://")
  ) {
    event.preventDefault();
    return false;
  }
  
  // Ignorer les erreurs WebSocket HMR de Vite (en production ou si le serveur n'est pas disponible)
  if (
    event.message?.includes("WebSocket connection") ||
    event.message?.includes("failed to connect to websocket") ||
    event.filename?.includes("client:") ||
    event.filename?.includes("vite")
  ) {
    event.preventDefault();
    return false;
  }
});

// Gestionnaire pour les promesses rejetées non gérées
window.addEventListener("unhandledrejection", (event) => {
  // Ignorer les erreurs d'extension de navigateur
  if (
    event.reason?.message?.includes("Extension context invalidated") ||
    event.reason?.stack?.includes("browser-polyfill") ||
    event.reason?.stack?.includes("chrome-extension://") ||
    event.reason?.stack?.includes("extension://")
  ) {
    event.preventDefault();
    return false;
  }
  
  // Ignorer les erreurs WebSocket HMR de Vite
  if (
    event.reason?.message?.includes("WebSocket connection") ||
    event.reason?.message?.includes("failed to connect to websocket") ||
    event.reason?.stack?.includes("client:") ||
    event.reason?.stack?.includes("vite")
  ) {
    event.preventDefault();
    return false;
  }
});

// 🗑️ Désenregistrer tout service worker existant (nettoyage)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
      console.log("🗑️ Service worker désenregistré:", registration.scope);
    });
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode désactivé temporairement car il cause des conflits avec le rendu PDF (double montage)
  // En production, StrictMode n'est pas actif donc pas de problème
  <App />
);
