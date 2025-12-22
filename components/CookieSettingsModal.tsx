import React, { useState, useEffect } from 'react';
import { X, Cookie, Shield, BarChart3, Settings2, Megaphone, ChevronDown, ChevronUp } from 'lucide-react';
import Button from './Button';
import { CookiePreferences } from '../hooks/useCookieConsent';

interface CookieSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPreferences: CookiePreferences;
  onSavePreferences: (preferences: CookiePreferences) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

interface CookieCategory {
  id: keyof CookiePreferences;
  name: string;
  description: string;
  icon: React.ElementType;
  required: boolean;
  cookies: { name: string; purpose: string; duration: string }[];
}

const cookieCategories: CookieCategory[] = [
  {
    id: 'essential',
    name: 'Cookies essentiels',
    description: 'Ces cookies sont nécessaires au fonctionnement du site. Ils permettent la navigation et l\'accès aux zones sécurisées.',
    icon: Shield,
    required: true,
    cookies: [
      { name: 'signease_session', purpose: 'Maintenir votre session utilisateur', duration: 'Session' },
      { name: 'signease_cookie_consent', purpose: 'Mémoriser vos choix de cookies', duration: '1 an' },
      { name: 'signease_cookie_preferences', purpose: 'Stocker vos préférences de cookies', duration: '1 an' },
    ],
  },
  {
    id: 'functional',
    name: 'Cookies fonctionnels',
    description: 'Ces cookies permettent d\'améliorer les fonctionnalités et la personnalisation, comme mémoriser vos préférences.',
    icon: Settings2,
    required: false,
    cookies: [
      { name: 'signease_theme', purpose: 'Mémoriser votre thème préféré', duration: '1 an' },
      { name: 'signease_language', purpose: 'Mémoriser votre langue préférée', duration: '1 an' },
      { name: 'signease_recent_docs', purpose: 'Accès rapide aux documents récents', duration: '30 jours' },
    ],
  },
  {
    id: 'analytics',
    name: 'Cookies analytiques',
    description: 'Ces cookies nous aident à comprendre comment les visiteurs utilisent le site pour l\'améliorer.',
    icon: BarChart3,
    required: false,
    cookies: [
      { name: '_ga', purpose: 'Google Analytics - Distinguer les utilisateurs', duration: '2 ans' },
      { name: '_gid', purpose: 'Google Analytics - Distinguer les utilisateurs', duration: '24 heures' },
    ],
  },
  {
    id: 'marketing',
    name: 'Cookies marketing',
    description: 'Ces cookies sont utilisés pour afficher des publicités pertinentes et mesurer leur efficacité.',
    icon: Megaphone,
    required: false,
    cookies: [
      { name: '_fbp', purpose: 'Facebook - Suivi des conversions', duration: '3 mois' },
    ],
  },
];

const CookieSettingsModal: React.FC<CookieSettingsModalProps> = ({
  isOpen,
  onClose,
  currentPreferences,
  onSavePreferences,
  onAcceptAll,
  onRejectAll,
}) => {
  const [preferences, setPreferences] = useState<CookiePreferences>(currentPreferences);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    setPreferences(currentPreferences);
  }, [currentPreferences]);

  const handleToggle = (categoryId: keyof CookiePreferences) => {
    if (categoryId === 'essential') return; // Essential ne peut pas être désactivé
    setPreferences((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const handleSave = () => {
    onSavePreferences(preferences);
    onClose();
  };

  const handleAcceptAll = () => {
    onAcceptAll();
    onClose();
  };

  const handleRejectAll = () => {
    onRejectAll();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-surface rounded-3xl elevation-5 overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Cookie className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-onSurface">Paramètres des cookies</h2>
              <p className="text-sm text-onSurfaceVariant">Gérez vos préférences de confidentialité</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surfaceVariant/50 transition-colors"
          >
            <X className="h-5 w-5 text-onSurfaceVariant" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="text-sm text-onSurfaceVariant">
            Nous utilisons des cookies pour améliorer votre expérience sur SignEase. Vous pouvez choisir les types de cookies que vous acceptez.
            Les cookies essentiels sont nécessaires au fonctionnement du site et ne peuvent pas être désactivés.
          </p>

          {cookieCategories.map((category) => {
            const Icon = category.icon;
            const isExpanded = expandedCategory === category.id;
            const isEnabled = preferences[category.id];

            return (
              <div
                key={category.id}
                className="border border-outline/20 rounded-2xl overflow-hidden"
              >
                {/* Category Header */}
                <div className="flex items-center justify-between p-4 bg-surfaceVariant/30">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2 rounded-xl ${isEnabled ? 'bg-primary/10' : 'bg-surfaceVariant'}`}>
                      <Icon className={`h-5 w-5 ${isEnabled ? 'text-primary' : 'text-onSurfaceVariant'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-onSurface">{category.name}</h3>
                        {category.required && (
                          <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                            Requis
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-onSurfaceVariant line-clamp-1">{category.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Toggle Switch */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleToggle(category.id)}
                        disabled={category.required}
                        className="sr-only peer"
                      />
                      <div className={`w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary ${category.required ? 'opacity-60 cursor-not-allowed' : ''}`}></div>
                    </label>

                    {/* Expand Button */}
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                      className="p-1.5 rounded-full hover:bg-surfaceVariant/50 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-onSurfaceVariant" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-onSurfaceVariant" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 border-t border-outline/20 space-y-3">
                    <p className="text-sm text-onSurfaceVariant">{category.description}</p>
                    
                    {category.cookies.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-onSurface">Cookies utilisés :</h4>
                        <div className="bg-surfaceVariant/20 rounded-xl overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-outline/10">
                                <th className="text-left p-3 font-medium text-onSurfaceVariant">Nom</th>
                                <th className="text-left p-3 font-medium text-onSurfaceVariant">Objectif</th>
                                <th className="text-left p-3 font-medium text-onSurfaceVariant">Durée</th>
                              </tr>
                            </thead>
                            <tbody>
                              {category.cookies.map((cookie, idx) => (
                                <tr key={idx} className="border-b border-outline/5 last:border-0">
                                  <td className="p-3 font-mono text-xs text-onSurface">{cookie.name}</td>
                                  <td className="p-3 text-onSurfaceVariant">{cookie.purpose}</td>
                                  <td className="p-3 text-onSurfaceVariant">{cookie.duration}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-outline/20 bg-surfaceVariant/20">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outlined"
              onClick={handleRejectAll}
              className="flex-1"
            >
              Refuser tout
            </Button>
            <Button
              variant="tonal"
              onClick={handleSave}
              className="flex-1"
            >
              Sauvegarder mes choix
            </Button>
            <Button
              variant="filled"
              onClick={handleAcceptAll}
              className="flex-1"
            >
              Tout accepter
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default CookieSettingsModal;
