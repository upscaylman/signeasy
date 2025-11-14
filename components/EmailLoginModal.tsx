import React, { useState } from 'react';
import { Mail, AlertCircle, Loader2 } from 'lucide-react';
import { checkEmailAccess } from '../services/firebaseApi';

interface EmailLoginModalProps {
  onSubmit: (email: string) => void;
  isOpen: boolean;
}

const EmailLoginModal: React.FC<EmailLoginModalProps> = ({ onSubmit, isOpen }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email.trim()) {
      setError('Veuillez entrer votre adresse e-mail.');
      return;
    }

    if (!emailRegex.test(email)) {
      setError('Veuillez entrer une adresse e-mail valide.');
      return;
    }

    setIsLoading(true);
    try {
      const hasAccess = await checkEmailAccess(email.trim());
      if (hasAccess) {
        onSubmit(email.trim());
      } else {
        setError('Vous n\'êtes pas autorisé à accéder à cette plateforme. Vous devez être destinataire d\'un document ou figurez sur la liste d\'accès.');
      }
    } catch (err) {
      console.error('Erreur lors de la vérification:', err);
      setError('Une erreur est survenue lors de la vérification. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-hidden">
      {/* Ultra Modern Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primaryContainer/10 to-tertiaryContainer/20">
        {/* Background image with advanced parallax */}
        <div 
          className="absolute inset-0 opacity-20 bg-cover bg-center bg-no-repeat animate-slow-zoom"
          style={{
            backgroundImage: 'url(/bg_fometaux.png)',
            filter: 'blur(2px) brightness(1.1)'
          }}
        />
        
        {/* Multi-layered gradient overlay with flow animation */}
        <div className="absolute inset-0 animate-gradient-shift" />
        
        {/* Animated light rays */}
        <div className="absolute inset-0 overflow-hidden opacity-30">
          <div className="absolute top-0 left-1/4 w-1 h-full bg-gradient-to-b from-transparent via-primary/40 to-transparent transform -skew-x-12 animate-light-ray-1" />
          <div className="absolute top-0 right-1/3 w-1 h-full bg-gradient-to-b from-transparent via-tertiary/30 to-transparent transform skew-x-12 animate-light-ray-2" />
        </div>
        
        {/* Ultra-modern floating particles with glow */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="particle particle-1" />
          <div className="particle particle-2" />
          <div className="particle particle-3" />
          <div className="particle particle-4" />
          <div className="particle particle-5" />
        </div>
        
        {/* Subtle noise texture overlay */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E")',
          backgroundRepeat: 'repeat'
        }} />
      </div>

      {/* Glass morphism card with enhanced animations */}
      <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md border border-white/40 animate-slide-up-fade-in overflow-hidden">
        <div className="p-8">
        <div className="relative flex items-center gap-3 mb-6 animate-fade-in-delay-1">
          <div className="bg-gradient-to-br from-primary to-primary/80 p-3 rounded-full shadow-lg animate-pulse-slow relative">
            <Mail className="h-6 w-6 text-white" />
            {/* Glow effect */}
            <div className="absolute inset-0 bg-primary/40 rounded-full blur-xl animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-onSurface bg-gradient-to-r from-primary to-tertiary bg-clip-text text-transparent">
              Bienvenue dans SignEase
            </h2>
            <p className="text-xs text-onSurfaceVariant mt-0.5">by FO Metaux</p>
          </div>
        </div>

        <p className="relative text-sm text-onSurfaceVariant mb-6 animate-fade-in-delay-2">
          Gérez vos signatures électroniques en toute simplicité.
        </p>

        <form onSubmit={handleSubmit} className="relative space-y-4 animate-fade-in-delay-3">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-onSurface mb-2">
              Adresse e-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="exemple@votreentreprise.fr"
              className="w-full p-3 bg-white/80 border-2 border-outlineVariant/50 rounded-full focus:ring-2 focus:ring-primary focus:border-primary focus:bg-white transition-all duration-300 hover:border-primary/50 shadow-sm focus:shadow-lg"
              autoFocus
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-errorContainer/30 border border-error/30 rounded-xl animate-shake backdrop-blur-sm">
              <AlertCircle className="h-5 w-5 text-error flex-shrink-0 mt-0.5 animate-pulse" />
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 btn-premium-shine btn-premium-extended focus:outline-none focus:ring-4 focus:ring-primary/30 inline-flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                Vérification...
              </>
            ) : (
              'Continuer'
            )}
          </button>
        </form>

        <p className="relative text-xs text-onSurfaceVariant text-center mt-6 animate-fade-in-delay-4">
          Vous devez être destinataire d'un document ou autorisé pour accéder.
        </p>
        </div>
        
        {/* Footer with gradient */}
        <div className="w-full h-16 bg-gradient-to-r from-tertiary/20 to-transparent rounded-b-3xl flex items-center justify-center">
          <p className="text-xs text-onSurfaceVariant/70">
            SignEase <span className="font-semibold">by FO Metaux</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailLoginModal;
