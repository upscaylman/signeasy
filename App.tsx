import React from "react";
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import CookieBanner from "./components/CookieBanner";
import EmailLoginModal from "./components/EmailLoginModal";
import Footer from "./components/Footer";
import Header from "./components/Header";
import { ToastProvider } from "./components/Toast";
import { UserProvider, useUser } from "./components/UserContext";
import DashboardPage from "./pages/DashboardPage";
import InboxPage from "./pages/InboxPage";
import PrepareDocumentPage from "./pages/PrepareDocumentPage";
import QuickSignPage from "./pages/QuickSignPage";
import SignDocumentPage from "./pages/SignDocumentPage";
import VerifyPage from "./pages/VerifyPage";
// Vérification automatique de la configuration Firebase
import "./utils/firebaseCheck";

const AppContent: React.FC = () => {
  const { currentUser, setCurrentUser, isLoading } = useUser();
  const location = useLocation();

  // Vérifier si on est sur une route /sign/:token
  const isSigningRoute = location.pathname.startsWith("/sign/");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
          <p className="mt-4 text-onSurfaceVariant">Chargement...</p>
        </div>
      </div>
    );
  }

  // Afficher le modal SEULEMENT si pas d'utilisateur ET pas sur une route /sign/:token
  if (!currentUser && !isSigningRoute) {
    return (
      <EmailLoginModal
        isOpen={true}
        onSubmit={(email) => setCurrentUser({ email })}
      />
    );
  }

  // Si utilisateur, afficher l'app
  return (
    <>
      {currentUser && <Header />}
      <main className="flex-grow animate-fade-in page-transition">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/prepare" element={<PrepareDocumentPage />} />
          <Route path="/quick-sign" element={<QuickSignPage />} />
          {/* Route /sign/:token accessible SANS authentification - SignDocumentPage fera l'auto-login */}
          <Route path="/sign/:token" element={<SignDocumentPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
      {currentUser && <Footer />}
      {currentUser && <CookieBanner />}
    </>
  );
};

const App: React.FC = () => {
  return (
    <UserProvider>
      <ToastProvider>
        <HashRouter>
          <div className="min-h-screen bg-background text-onBackground flex flex-col">
            <AppContent />
          </div>
        </HashRouter>
      </ToastProvider>
    </UserProvider>
  );
};

export default App;
