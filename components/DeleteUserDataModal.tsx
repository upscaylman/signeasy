import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { deleteAllUserData } from '../services/firebaseApi';
import { useToast } from './Toast';
import Button from './Button';
import { Trash2, Loader2, Shield, X } from 'lucide-react';

interface DeleteUserDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DeleteUserDataModal: React.FC<DeleteUserDataModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [email, setEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [result, setResult] = useState<{ 
    success: boolean; 
    deletedCounts: { [key: string]: number }; 
    message?: string 
  } | null>(null);
  const { addToast } = useToast();

  const handleDelete = async () => {
    if (!email.trim()) {
      addToast('Veuillez entrer une adresse email', 'error');
      return;
    }

    if (!window.confirm(`⚠️ ATTENTION: Vous êtes sur le point de supprimer TOUTES les données de ${email}.\n\nCela inclut:\n- Tous les documents créés\n- Toutes les enveloppes\n- Tous les tokens\n- Tous les emails\n- Tous les audit trails\n- Tous les PDFs\n- Les entrées dans authorizedUsers\n\nCette action est IRRÉVERSIBLE!\n\nÊtes-vous absolument sûr?`)) {
      return;
    }

    setIsDeleting(true);
    setResult(null);

    try {
      const deleteResult = await deleteAllUserData(email.trim());
      setResult(deleteResult);
      
      if (deleteResult.success) {
        addToast(`Suppression terminée avec succès!`, 'success');
      } else {
        addToast(deleteResult.message || 'Erreur lors de la suppression', 'error');
      }
    } catch (error) {
      console.error('Erreur:', error);
      addToast('Erreur lors de la suppression', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setEmail('');
      setResult(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-[100] p-4 modal-backdrop"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-surface rounded-3xl shadow-xl border border-outlineVariant max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outlineVariant">
          <div className="flex items-center gap-3">
            <div className="bg-primaryContainer p-3 rounded-full">
              <Shield className="h-6 w-6 text-onPrimaryContainer" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-onSurface">
                Suppression des données utilisateur
              </h2>
              <p className="text-sm text-onSurfaceVariant mt-1">
                Suppression définitive des données
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="p-2 rounded-full hover:bg-surfaceVariant transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Fermer"
          >
            <X className="h-5 w-5 text-onSurface" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-onSurfaceVariant mb-2">
              Adresse email à supprimer
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-surfaceVariant/60 border border-outlineVariant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary focus:bg-surface transition-colors"
              placeholder="exemple@email.com"
              disabled={isDeleting}
            />
          </div>

          <Button
            variant="filled"
            icon={isDeleting ? Loader2 : Trash2}
            onClick={handleDelete}
            disabled={isDeleting || !email.trim()}
            className="w-full"
          >
            {isDeleting ? 'Suppression en cours...' : 'Supprimer toutes les données'}
          </Button>

          {result && (
            <div className={`p-4 rounded-lg border ${
              result.success 
                ? 'bg-tertiaryContainer/30 border-tertiaryContainer' 
                : 'bg-errorContainer/30 border-errorContainer'
            }`}>
              <h3 className={`font-semibold mb-3 ${
                result.success ? 'text-onTertiaryContainer' : 'text-onErrorContainer'
              }`}>
                {result.success ? '✅ Suppression terminée' : '❌ Erreur lors de la suppression'}
              </h3>
              {result.message && (
                <p className={`text-sm mb-3 ${
                  result.success ? 'text-onTertiaryContainer' : 'text-onErrorContainer'
                }`}>
                  {result.message}
                </p>
              )}
              {result.success && result.deletedCounts && (
                <div className="space-y-1 text-sm">
                  <p><strong>Documents:</strong> {result.deletedCounts.documents || 0}</p>
                  <p><strong>Enveloppes:</strong> {result.deletedCounts.envelopes || 0}</p>
                  <p><strong>Tokens:</strong> {result.deletedCounts.tokens || 0}</p>
                  <p><strong>Emails:</strong> {result.deletedCounts.emails || 0}</p>
                  <p><strong>Audit Trails:</strong> {result.deletedCounts.auditTrails || 0}</p>
                  <p><strong>PDFs:</strong> {result.deletedCounts.pdfs || 0}</p>
                  <p><strong>Authorized Users:</strong> {result.deletedCounts.authorizedUsers || 0}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DeleteUserDataModal;

