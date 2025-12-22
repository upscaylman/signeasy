import React, { useState, useEffect } from 'react';
import Button from './Button';
import CookieSettingsModal from './CookieSettingsModal';
import { useCookieConsent } from '../hooks/useCookieConsent';
import { Cookie, Settings2 } from 'lucide-react';

const CookieBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const {
    hasConsent,
    preferences,
    isLoading,
    acceptAll,
    rejectAll,
    savePreferences,
  } = useCookieConsent();

  useEffect(() => {
    // Afficher la bannière après un court délai si pas de consentement
    if (!isLoading && !hasConsent) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isLoading, hasConsent]);

  const handleAcceptAll = () => {
    acceptAll();
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    rejectAll();
    setIsVisible(false);
  };

  const handleOpenSettings = () => {
    setShowSettings(true);
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
  };

  const handleSavePreferences = (newPreferences: typeof preferences) => {
    savePreferences(newPreferences);
    setIsVisible(false);
    setShowSettings(false);
  };

  // Ne rien afficher pendant le chargement
  if (isLoading) {
    return null;
  }

  return (
    <>
      {/* Cookie Banner */}
      {isVisible && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-3xl z-50">
          <div className="glass-effect-strong rounded-2xl elevation-5 p-4 sm:p-6 border border-outline/20 animate-slide-up modal-content">
            <div className="flex flex-col gap-4">
              {/* Message */}
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-primary/10 flex-shrink-0">
                  <Cookie className="h-5 w-5 text-primary" />
                </div>
                <div className="text-sm text-onSurface">
                  <p className="font-medium mb-1">🍪 Nous utilisons des cookies</p>
                  <p className="text-onSurfaceVariant">
                    Nous utilisons des cookies pour améliorer votre expérience, analyser le trafic et personnaliser le contenu. 
                    Vous pouvez accepter tous les cookies, les refuser ou personnaliser vos préférences.
                  </p>
                </div>
              </div>

              {/* Boutons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                <Button 
                  onClick={handleOpenSettings}
                  variant="text" 
                  size="small"
                  icon={Settings2}
                  className="order-3 sm:order-1"
                >
                  Personnaliser
                </Button>
                <Button 
                  onClick={handleRejectAll}
                  variant="outlined" 
                  size="small"
                  className="order-2"
                >
                  Refuser tout
                </Button>
                <Button 
                  onClick={handleAcceptAll}
                  variant="filled" 
                  size="small"
                  className="order-1 sm:order-3"
                >
                  Accepter tout
                </Button>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes slide-up {
              from { 
                transform: translateY(100%);
                opacity: 0;
              }
              to { 
                transform: translateY(0);
                opacity: 1;
              }
            }
            .animate-slide-up {
              animation: slide-up 0.4s ease-out forwards;
            }
          `}</style>
        </div>
      )}

      {/* Modal de paramètres des cookies */}
      <CookieSettingsModal
        isOpen={showSettings}
        onClose={handleCloseSettings}
        currentPreferences={preferences}
        onSavePreferences={handleSavePreferences}
        onAcceptAll={handleAcceptAll}
        onRejectAll={handleRejectAll}
      />
    </>
  );
};

// Composant pour réouvrir les paramètres cookies depuis n'importe où
export const CookieSettingsButton: React.FC<{ className?: string }> = ({ className }) => {
  const [showSettings, setShowSettings] = useState(false);
  const { preferences, acceptAll, rejectAll, savePreferences } = useCookieConsent();

  return (
    <>
      <button
        onClick={() => setShowSettings(true)}
        className={`inline-flex items-center gap-2 text-sm text-onSurfaceVariant hover:text-primary transition-colors ${className || ''}`}
      >
        <Cookie className="h-4 w-4" />
        <span>Paramètres des cookies</span>
      </button>

      <CookieSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentPreferences={preferences}
        onSavePreferences={(prefs) => {
          savePreferences(prefs);
          setShowSettings(false);
        }}
        onAcceptAll={() => {
          acceptAll();
          setShowSettings(false);
        }}
        onRejectAll={() => {
          rejectAll();
          setShowSettings(false);
        }}
      />
    </>
  );
};

export default CookieBanner;