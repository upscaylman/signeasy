import { useState, useEffect, useCallback } from 'react';

export interface CookiePreferences {
  essential: boolean; // Toujours true, nécessaires au fonctionnement
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
}

export interface CookieConsentState {
  hasConsent: boolean;
  preferences: CookiePreferences;
  consentDate: string | null;
}

const COOKIE_CONSENT_KEY = 'signease_cookie_consent';
const COOKIE_PREFERENCES_KEY = 'signease_cookie_preferences';

const DEFAULT_PREFERENCES: CookiePreferences = {
  essential: true,
  analytics: false,
  functional: false,
  marketing: false,
};

export const useCookieConsent = () => {
  const [consentState, setConsentState] = useState<CookieConsentState>({
    hasConsent: false,
    preferences: DEFAULT_PREFERENCES,
    consentDate: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Charger les préférences au démarrage
  useEffect(() => {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      const preferences = localStorage.getItem(COOKIE_PREFERENCES_KEY);

      if (consent) {
        const parsedConsent = JSON.parse(consent);
        const parsedPreferences = preferences
          ? JSON.parse(preferences)
          : DEFAULT_PREFERENCES;

        setConsentState({
          hasConsent: true,
          preferences: { ...DEFAULT_PREFERENCES, ...parsedPreferences },
          consentDate: parsedConsent.date || null,
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des préférences cookies:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Accepter tous les cookies
  const acceptAll = useCallback(() => {
    const allAccepted: CookiePreferences = {
      essential: true,
      analytics: true,
      functional: true,
      marketing: true,
    };

    try {
      const consentData = { accepted: true, date: new Date().toISOString() };
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData));
      localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(allAccepted));

      setConsentState({
        hasConsent: true,
        preferences: allAccepted,
        consentDate: consentData.date,
      });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du consentement:', error);
    }
  }, []);

  // Refuser tous les cookies (sauf essentiels)
  const rejectAll = useCallback(() => {
    const rejected: CookiePreferences = {
      essential: true,
      analytics: false,
      functional: false,
      marketing: false,
    };

    try {
      const consentData = { accepted: true, date: new Date().toISOString() };
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData));
      localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(rejected));

      setConsentState({
        hasConsent: true,
        preferences: rejected,
        consentDate: consentData.date,
      });

      // Supprimer les cookies non essentiels existants
      clearNonEssentialCookies();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du refus:', error);
    }
  }, []);

  // Sauvegarder les préférences personnalisées
  const savePreferences = useCallback((preferences: CookiePreferences) => {
    try {
      const updatedPreferences = { ...preferences, essential: true }; // Essential toujours true
      const consentData = { accepted: true, date: new Date().toISOString() };

      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData));
      localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(updatedPreferences));

      setConsentState({
        hasConsent: true,
        preferences: updatedPreferences,
        consentDate: consentData.date,
      });

      // Supprimer les cookies des catégories refusées
      if (!updatedPreferences.analytics) {
        clearAnalyticsCookies();
      }
      if (!updatedPreferences.marketing) {
        clearMarketingCookies();
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des préférences:', error);
    }
  }, []);

  // Réinitialiser le consentement
  const resetConsent = useCallback(() => {
    try {
      localStorage.removeItem(COOKIE_CONSENT_KEY);
      localStorage.removeItem(COOKIE_PREFERENCES_KEY);

      setConsentState({
        hasConsent: false,
        preferences: DEFAULT_PREFERENCES,
        consentDate: null,
      });
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
    }
  }, []);

  // Vérifier si une catégorie est acceptée
  const isCategoryAccepted = useCallback(
    (category: keyof CookiePreferences): boolean => {
      return consentState.preferences[category];
    },
    [consentState.preferences]
  );

  return {
    ...consentState,
    isLoading,
    acceptAll,
    rejectAll,
    savePreferences,
    resetConsent,
    isCategoryAccepted,
  };
};

// Fonctions utilitaires pour supprimer les cookies
function clearNonEssentialCookies() {
  clearAnalyticsCookies();
  clearMarketingCookies();
}

function clearAnalyticsCookies() {
  // Supprimer les cookies Google Analytics
  const analyticsCookies = ['_ga', '_gid', '_gat', '__utma', '__utmb', '__utmc', '__utmz'];
  analyticsCookies.forEach(deleteCookie);
}

function clearMarketingCookies() {
  // Supprimer les cookies marketing courants
  const marketingCookies = ['_fbp', '_fbc', 'fr'];
  marketingCookies.forEach(deleteCookie);
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname};`;
}

export default useCookieConsent;
