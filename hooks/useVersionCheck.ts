import { useEffect, useState, useCallback } from 'react';
import packageJson from '../package.json';

interface VersionInfo {
  version: string;
  buildDate: string;
}

interface UseVersionCheckReturn {
  hasNewVersion: boolean;
  currentVersion: string;
  newVersion: string | null;
  checkNow: () => Promise<void>;
  dismissUpdate: () => void;
  reloadApp: () => void;
}

const VERSION_CHECK_INTERVAL = 60000; // Vérifier toutes les 60 secondes
const DISMISSED_VERSION_KEY = 'signease_dismissed_version';

export const useVersionCheck = (): UseVersionCheckReturn => {
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const currentVersion = packageJson.version;

  const checkVersion = useCallback(async () => {
    try {
      // Ajouter un timestamp pour éviter le cache
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        console.warn('⚠️ Impossible de vérifier la version');
        return;
      }

      const data: VersionInfo = await response.json();
      const serverVersion = data.version;

      // Comparer les versions
      if (serverVersion !== currentVersion) {
        // Vérifier si l'utilisateur a déjà ignoré cette version
        const dismissedVersion = localStorage.getItem(DISMISSED_VERSION_KEY);
        
        if (dismissedVersion !== serverVersion) {
          console.log(`🆕 Nouvelle version disponible: ${serverVersion} (actuelle: ${currentVersion})`);
          setNewVersion(serverVersion);
          setHasNewVersion(true);
        }
      } else {
        setHasNewVersion(false);
        setNewVersion(null);
      }
    } catch (error) {
      console.warn('⚠️ Erreur lors de la vérification de version:', error);
    }
  }, [currentVersion]);

  const dismissUpdate = useCallback(() => {
    if (newVersion) {
      localStorage.setItem(DISMISSED_VERSION_KEY, newVersion);
    }
    setHasNewVersion(false);
  }, [newVersion]);

  const reloadApp = useCallback(() => {
    // Forcer le rechargement complet sans cache
    window.location.reload();
  }, []);

  useEffect(() => {
    // Vérifier au chargement initial (après un court délai)
    const initialCheck = setTimeout(() => {
      checkVersion();
    }, 5000);

    // Vérifier périodiquement
    const interval = setInterval(checkVersion, VERSION_CHECK_INTERVAL);

    // Vérifier quand l'onglet redevient visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkVersion]);

  return {
    hasNewVersion,
    currentVersion,
    newVersion,
    checkNow: checkVersion,
    dismissUpdate,
    reloadApp
  };
};

export default useVersionCheck;
