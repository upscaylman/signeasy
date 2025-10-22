import React, { useState, useEffect } from 'react';
import Button from './Button';

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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl z-50 animate-slide-up">
        <div className="bg-inverseSurface text-inverseOnSurface rounded-xl shadow-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-center sm:text-left flex-grow">
            Nous utilisons des cookies pour améliorer votre expérience. En continuant, vous acceptez notre{' '}
            <a href="#" className="font-semibold text-inversePrimary hover:underline">
                Politique de confidentialité
            </a>.
            </p>
            <Button 
                onClick={handleAccept} 
                variant="text" 
                className="flex-shrink-0 w-full sm:w-auto !text-inversePrimary hover:!bg-inverseOnSurface/10"
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