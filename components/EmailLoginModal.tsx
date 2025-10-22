import React, { useState } from 'react';
import { Mail, AlertCircle, Loader2 } from 'lucide-react';
import Button from './Button';
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
    <div className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-50 p-4 modal-backdrop">
      <div className="bg-surface rounded-3xl shadow-xl w-full max-w-md p-6 modal-content">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-primaryContainer p-3 rounded-full">
            <Mail className="h-6 w-6 text-onPrimaryContainer" />
          </div>
          <h2 className="text-xl font-bold text-onSurface">Bienvenue dans SignEase</h2>
        </div>

        <p className="text-sm text-onSurfaceVariant mb-6">
          Entrez votre adresse e-mail pour accéder à la plateforme. Vous verrez uniquement vos documents et les documents à signer.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full p-3 bg-surfaceVariant/60 border border-outlineVariant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary focus:bg-surface transition-colors"
              autoFocus
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-errorContainer/30 border border-error/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" variant="filled" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                Vérification...
              </>
            ) : (
              'Continuer'
            )}
          </Button>
        </form>

        <p className="text-xs text-onSurfaceVariant text-center mt-4">
          Vous devez être destinataire d'un document ou autorisé pour accéder.
        </p>
      </div>
    </div>
  );
};

export default EmailLoginModal;
