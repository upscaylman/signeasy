import { RefreshCw, X } from 'lucide-react';
import React from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';

const VersionUpdateBanner: React.FC = () => {
  const { hasNewVersion, currentVersion, newVersion, dismissUpdate, reloadApp } = useVersionCheck();

  if (!hasNewVersion) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-slide-up">
      <div className="bg-gradient-to-r from-primary to-tertiary text-white rounded-2xl shadow-2xl p-4 elevation-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 bg-white/20 rounded-full p-2">
            <RefreshCw className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white">Nouvelle version disponible !</h3>
            <p className="text-sm text-white/90 mt-1">
              Version {newVersion} est disponible.
              <span className="opacity-70 ml-1">(Actuelle: {currentVersion})</span>
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={reloadApp}
                className="flex items-center gap-1.5 bg-white text-primary font-semibold text-sm px-4 py-2 rounded-full hover:bg-white/90 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Mettre à jour
              </button>
              <button
                onClick={dismissUpdate}
                className="text-sm text-white/80 hover:text-white px-3 py-2 rounded-full hover:bg-white/10 transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
          <button
            onClick={dismissUpdate}
            className="flex-shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4 text-white/80" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VersionUpdateBanner;
