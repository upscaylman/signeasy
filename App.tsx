
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import PrepareDocumentPage from './pages/PrepareDocumentPage';
import SignDocumentPage from './pages/SignDocumentPage';
import VerifyPage from './pages/VerifyPage';
import InboxPage from './pages/InboxPage';
import Header from './components/Header';
import Footer from './components/Footer';
import CookieBanner from './components/CookieBanner';
import { ToastProvider } from './components/Toast';
// Vérification automatique de la configuration Firebase
import './utils/firebaseCheck';

const App: React.FC = () => {
  // In a real app, this would be determined by an auth context
  const isAuthenticated = true; 

  return (
    <HashRouter>
      <ToastProvider>
        <div className="min-h-screen bg-background text-onBackground flex flex-col">
          <a href="#main-content" className="skip-to-main">
            Aller au contenu principal
          </a>
          <Header />
          <main id="main-content" className="flex-grow animate-fade-in page-transition">
            <Routes>
              <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
              {/* A real app would have a login page */}
              {/* <Route path="/login" element={<LoginPage />} /> */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/prepare" element={<PrepareDocumentPage />} />
              <Route path="/sign/:token" element={<SignDocumentPage />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/verify" element={<VerifyPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
        <CookieBanner />
      </ToastProvider>
    </HashRouter>
  );
};

export default App;