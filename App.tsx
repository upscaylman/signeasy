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
import { PresenceTracker } from "./components/PresenceTracker";
import { ToastProvider } from "./components/Toast";
import { UserProvider, useUser } from "./components/UserContext";
import VersionUpdateBanner from "./components/VersionUpdateBanner";
import DashboardPage from "./pages/DashboardPage";
import InboxPage from "./pages/InboxPage";
import PrepareDocumentPage from "./pages/PrepareDocumentPage";
import QuickSignPage from "./pages/QuickSignPage";
import SignDocumentPage from "./pages/SignDocumentPage";
import VerifyPage from "./pages/VerifyPage";
import DeleteUserDataPage from "./pages/DeleteUserDataPage";
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

  // Vérifier si on est sur une page qui doit afficher le Footer
  const shouldShowFooter = location.pathname === "/dashboard" || location.pathname === "/verify";

  // Si utilisateur, afficher l'app
  return (
    <>
      {currentUser && <Header />}
      {currentUser && <PresenceTracker />}
      <main className="flex-grow animate-fade-in page-transition">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/prepare" element={<PrepareDocumentPage />} />
          <Route path="/quick-sign" element={<QuickSignPage />} />
          {/* Route /sign/:token accessible SANS authentification - SignDocumentPage fera l'auto-login */}
          <Route path="/sign/:token" element={<SignDocumentPage />} />
          {/* Route /sign/view pour les documents envoyés (token dans sessionStorage, pas dans l'URL) */}
          <Route path="/sign/view" element={<SignDocumentPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/admin/delete-user-data" element={<DeleteUserDataPage />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
      {currentUser && shouldShowFooter && <Footer />}
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
            <VersionUpdateBanner />
          </div>
        </HashRouter>
      </ToastProvider>
    </UserProvider>
  );
};

export default App;
