
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEmails, markEmailAsRead, deleteEmails } from '../services/firebaseApi';
import type { MockEmail } from '../types';
import { Loader2, Inbox as InboxIcon, FileText, Trash2 } from 'lucide-react';
import Button from '../components/Button';
import { useToast } from '../components/Toast';

const InboxPage: React.FC = () => {
  const [emails, setEmails] = useState<MockEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<MockEmail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [showEmailContent, setShowEmailContent] = useState(false); // 📱 Pour mobile : afficher le contenu de l'email
  const navigate = useNavigate();
  const { addToast } = useToast();

  const fetchEmails = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedEmails = await getEmails();
      setEmails(fetchedEmails);
      if (fetchedEmails.length > 0 && !selectedEmail) {
        const firstEmail = fetchedEmails[0];
        setSelectedEmail(firstEmail);
        if (!firstEmail.read) {
          await markEmailAsRead(firstEmail.id);
          // Manually update the state to reflect read status without a full refetch
          firstEmail.read = true;
        }
      } else if (fetchedEmails.length === 0) {
        setSelectedEmail(null);
      }
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEmail]);

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleSelectEmail = (email: MockEmail) => {
    setSelectedEmail(email);
    setShowEmailContent(true); // 📱 Afficher le contenu sur mobile
    if (!email.read) {
      markEmailAsRead(email.id).then(() => {
         setEmails(prev => prev.map(e => e.id === email.id ? {...e, read: true} : e));
      });
    }
  };
  
  const handleSignClick = () => {
      if(selectedEmail?.signatureLink){
          const token = selectedEmail.signatureLink.split('/').pop();
          navigate(`/sign/${token}`);
      }
  };

  const handleEmailSelect = (emailId: string) => {
    setSelectedEmails(prev => 
      prev.includes(emailId) 
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    );
  };

  const handleSelectAllClick = () => {
    if (selectedEmails.length === emails.length) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails(emails.map(e => e.id));
    }
  };

  const handleDeleteEmails = async () => {
    if (selectedEmails.length === 0) return;
    
    const result = await deleteEmails(selectedEmails);
    if (result.success) {
      addToast(`${selectedEmails.length} message(s) supprimé(s) avec succès.`, 'success');
      setEmails(prev => prev.filter(e => !selectedEmails.includes(e.id)));
      setSelectedEmails([]);
      setIsSelectionMode(false);
      if (selectedEmail && selectedEmails.includes(selectedEmail.id)) {
        setSelectedEmail(null);
      }
    } else {
      addToast('Échec de la suppression des messages.', 'error');
    }
  };

  const handleExitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedEmails([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      {isSelectionMode ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-8 gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                <h2 className="text-lg sm:text-xl font-bold text-onSurface">{selectedEmails.length} sélectionné(s)</h2>
                <Button 
                  variant="text" 
                  onClick={handleSelectAllClick} 
                  disabled={emails.length === 0}
                  size="small"
                  className="w-full sm:w-auto"
                >
                  {emails.length > 0 && selectedEmails.length === emails.length
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'}
                </Button>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button 
                  variant="danger" 
                  icon={Trash2} 
                  disabled={selectedEmails.length === 0} 
                  onClick={handleDeleteEmails}
                  size="small"
                  className="flex-1 sm:flex-initial"
                >
                    Supprimer
                </Button>
                <Button 
                  variant="text" 
                  onClick={handleExitSelectionMode}
                  size="small"
                  className="flex-1 sm:flex-initial"
                >
                    Annuler
                </Button>
            </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-4xl font-bold text-onSurface">Boîte de réception</h1>
              <p className="mt-1 text-md text-onSurfaceVariant">Consultez ici toutes vos demandes de signature reçues.</p>
            </div>
            <Button variant="text" onClick={() => setIsSelectionMode(true)}>Sélectionner</Button>
        </div>
      )}

      <div className="bg-surface rounded-3xl shadow-sm flex h-[calc(100vh-220px)] overflow-hidden" style={{ borderWidth: '1px', borderColor: 'rgb(216, 194, 191)' }}>
        {/* Email List - Caché sur mobile quand on affiche le contenu */}
        <div className={`w-full sm:w-1/3 overflow-y-auto ${showEmailContent ? 'hidden sm:block' : 'block'}`} style={{ borderRight: '1px solid rgb(216, 194, 191)' }}>
          {emails.length === 0 ? (
             <div className="text-center p-8 text-onSurfaceVariant">
                <InboxIcon className="mx-auto h-12 w-12" />
                <p className="mt-4 text-sm font-semibold">La boîte de réception est vide.</p>
             </div>
          ) : (
            <ul>
              {emails.map(email => (
                <li 
                    key={email.id} 
                    onClick={() => isSelectionMode ? handleEmailSelect(email.id) : handleSelectEmail(email)}
                    className={`p-4 cursor-pointer transition-colors ${selectedEmail?.id === email.id && !isSelectionMode ? 'bg-primaryContainer/50' : 'hover:bg-surfaceVariant'}`}
                    style={{ borderBottom: '1px solid rgb(216, 194, 191)' }}
                >
                  <div className="flex items-start gap-3">
                    {isSelectionMode && (
                      <input
                        type="checkbox"
                        checked={selectedEmails.includes(email.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleEmailSelect(email.id);
                        }}
                        className="mt-1 h-5 w-5 accent-primary"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`flex justify-between items-start ${!email.read ? 'font-bold' : ''}`}>
                        <p className="text-onSurface truncate">{email.toName}</p>
                        <span className="text-xs text-onSurfaceVariant flex-shrink-0 ml-2">{new Date(email.sentAt).toLocaleDateString()}</span>
                      </div>
                      <p className={`text-sm mt-1 truncate ${!email.read ? 'text-onSurface' : 'text-onSurfaceVariant'}`}>{email.subject}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Email Content - Visible sur mobile quand showEmailContent est true */}
        <div className={`w-full sm:w-2/3 p-4 sm:p-6 overflow-y-auto ${showEmailContent ? 'block' : 'hidden sm:block'}`}>
          {selectedEmail ? (
            <div>
              {/* Bouton retour pour mobile */}
              <button 
                onClick={() => setShowEmailContent(false)}
                className="sm:hidden mb-4 flex items-center text-primary font-semibold"
              >
                ← Retour à la liste
              </button>
              <h2 className="text-xl sm:text-2xl font-bold text-onSurface">{selectedEmail.subject}</h2>
              <div className="mt-4 pb-4" style={{ borderBottom: '1px solid rgb(216, 194, 191)' }}>
                <p><strong>De :</strong> SignEase (no-reply@signease.com)</p>
                <p><strong>À :</strong> {selectedEmail.toName} &lt;{selectedEmail.toEmail}&gt;</p>
                <p><strong>Date :</strong> {new Date(selectedEmail.sentAt).toLocaleString('fr-FR')}</p>
              </div>
              <div className="mt-6 prose max-w-none text-onSurface">
                <p>{selectedEmail.body.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}</p>
              </div>
               <div className="mt-8 pt-6 text-center" style={{ borderTop: '1px solid rgb(216, 194, 191)' }}>
                   <p className="text-sm text-onSurfaceVariant mb-4">Cliquez sur le bouton ci-dessous pour examiner et signer le document.</p>
                   <div className="flex justify-center">
                     <Button icon={FileText} onClick={handleSignClick} className="max-w-full">
                       <span className="truncate">Examiner &amp; Signer {selectedEmail.documentName}</span>
                     </Button>
                   </div>
               </div>
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-full text-center text-onSurfaceVariant">
                <InboxIcon className="mx-auto h-16 w-16" />
                <p className="mt-4 text-lg font-semibold">Sélectionnez un message à lire</p>
                <p className="text-sm">Le contenu s'affichera ici.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InboxPage;
