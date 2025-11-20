import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteAllUserData } from '../services/firebaseApi';
import { useToast } from '../components/Toast';
import { useUser } from '../components/UserContext';
import Button from '../components/Button';
import Footer from '../components/Footer';
import { Trash2, Loader2, Shield } from 'lucide-react';

const DeleteUserDataPage: React.FC = () => {
  const { currentUser, isLoading } = useUser();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; deletedCounts: { [key: string]: number }; message?: string } | null>(null);
  const { addToast } = useToast();

  // Vérifier si l'utilisateur est admin, sinon rediriger
  useEffect(() => {
    // Attendre que le chargement soit terminé
    if (isLoading) return;
    
    if (!currentUser?.isAdmin) {
      addToast('Accès refusé : Cette page est réservée aux administrateurs', 'error');
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, isLoading, navigate, addToast]);

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

  // Afficher un loader pendant le chargement
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
          <p className="mt-4 text-onSurfaceVariant">Chargement...</p>
        </div>
      </div>
    );
  }

  // Si l'utilisateur n'est pas admin, ne rien afficher (redirection en cours)
  if (!currentUser?.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-2xl w-full">
          <div className="bg-surface rounded-3xl shadow-lg border border-outlineVariant p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-primaryContainer p-3 rounded-full">
              <Shield className="h-6 w-6 text-onPrimaryContainer" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-onSurface">
              Suppression des données utilisateur
            </h1>
          </div>
          <p className="text-sm text-onSurfaceVariant mb-6">
            Page réservée aux administrateurs - Suppression définitive des données
          </p>

          <div className="space-y-6">
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
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default DeleteUserDataPage;

