import React, { useState, useEffect } from 'react';
import Button from './Button';
import { Cookie } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'signease_cookie_consent';

const CookieBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check for consent after a short delay to avoid layout shifts on load
    const timer = setTimeout(() => {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) {
        setIsVisible(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
      setIsVisible(false);
    } catch (error) {
      console.error("Could not save cookie consent to local storage:", error);
      // Still hide the banner for the current session
      setIsVisible(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl z-50">
        <div className="glass-effect-strong rounded-2xl elevation-5 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border border-outline/20 animate-slide-up modal-content">
            <div className="text-sm text-center sm:text-left flex-grow text-onSurface flex items-start gap-2">
              <Cookie className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p>
                Nous utilisons des cookies pour améliorer votre expérience. En continuant, vous acceptez notre{' '}
                <a href="#" className="font-semibold text-primary hover:underline transition-colors link-enhanced">
                    Politique de confidentialité
                </a>.
              </p>
            </div>
            <Button 
                onClick={handleAccept} 
                variant="elevated" 
                size="small"
                className="flex-shrink-0 w-full sm:w-auto"
            >
            Accepter
            </Button>
        </div>
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default CookieBanner;