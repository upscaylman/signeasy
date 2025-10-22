
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEmails, markEmailAsRead, deleteEmails } from '../services/firebaseApi';
import { useUser } from '../components/UserContext';
import type { MockEmail } from '../types';
import { Loader2, Inbox as InboxIcon, FileText, Trash2, CheckSquare, Square, X } from 'lucide-react';
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
  const { currentUser } = useUser();

  const fetchEmails = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedEmails = await getEmails(currentUser?.email);
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
  }, [selectedEmail, currentUser?.email]);

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
    if (emails.length > 0 && selectedEmails.length === emails.length) {
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
        <div className="bg-primaryContainer/30 backdrop-blur-sm rounded-2xl p-4 elevation-1 border border-primary/20 animate-slide-down mb-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-primary text-onPrimary px-4 py-2 rounded-full font-bold text-sm elevation-2">
                {selectedEmails.length} / {emails.length}
              </div>
              <h2 className="text-lg font-bold text-onSurface">
                {selectedEmails.length === 0 ? 'Aucune sélection' : 
                 selectedEmails.length === 1 ? '1 email sélectionné' : 
                 `${selectedEmails.length} emails sélectionnés`}
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
              <Button 
                variant="filled" 
                icon={CheckSquare}
                onClick={handleSelectAllClick} 
                disabled={emails.length === 0}
                size="small"
                className="flex-1 sm:flex-initial min-w-[140px] max-w-[160px]"
              >
                <span className="truncate">
                  {emails.length > 0 && selectedEmails.length === emails.length
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'}
                </span>
              </Button>
              <Button 
                variant="outlined"
                icon={Trash2} 
                disabled={selectedEmails.length === 0} 
                onClick={handleDeleteEmails}
                size="small"
                className="flex-1 sm:flex-initial min-w-[110px] !text-error !border-error state-layer-error [&:hover]:!bg-transparent"
              >
                Supprimer
              </Button>
              <Button 
                variant="text" 
                icon={X}
                onClick={handleExitSelectionMode}
                size="small"
                className="flex-1 sm:flex-initial"
              >
                Annuler
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-secondaryContainer inline-block p-4 rounded-full progressive-glow">
                <InboxIcon className="h-12 w-12 text-onSecondaryContainer" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-onSurface">Boîte de réception</h1>
                <p className="mt-1 text-md text-onSurfaceVariant">Consultez ici toutes vos demandes de signature reçues.</p>
              </div>
            </div>
            <Button variant="outlined" onClick={() => setIsSelectionMode(true)}>Sélectionner</Button>
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
                    <div className="flex-1 min-w-0">
                      <div className={`flex justify-between items-start gap-2 ${!email.read ? 'font-bold' : ''}`}>
                        <p className="text-onSurface truncate flex-1">{email.toName}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-onSurfaceVariant whitespace-nowrap">{new Date(email.sentAt).toLocaleDateString()}</span>
                          {isSelectionMode && (
                            <label className="cursor-pointer group animate-fade-in-scale" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedEmails.includes(email.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleEmailSelect(email.id);
                                }}
                                className="sr-only peer"
                                aria-label={`Sélectionner l'email de ${email.toName}`}
                              />
                              <div className="
                                w-5 h-5 sm:w-6 sm:h-6
                                rounded-full border-2
                                bg-surface elevation-1
                                flex items-center justify-center
                                transition-all duration-200
                                peer-checked:bg-primary peer-checked:border-primary peer-checked:elevation-2
                                peer-focus:ring-2 peer-focus:ring-primary
                                group-hover:elevation-2 group-hover:scale-105
                                border-outlineVariant
                              ">
                                {selectedEmails.includes(email.id) && (
                                  <svg className="w-3 h-3 text-onPrimary animate-expand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </label>
                          )}
                        </div>
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
        <div className={`w-full sm:w-2/3 p-4 sm:p-6 overflow-y-auto overflow-x-hidden ${showEmailContent ? 'block' : 'hidden sm:block'}`}>
          {selectedEmail ? (
            <div className="max-w-full">
              {/* Bouton retour pour mobile */}
              <button 
                onClick={() => setShowEmailContent(false)}
                className="sm:hidden mb-4 flex items-center text-primary font-semibold press-effect transition-all hover:scale-105"
              >
                ← Retour à la liste
              </button>
              <h2 className="text-xl sm:text-2xl font-bold text-onSurface break-words">{selectedEmail.subject}</h2>
              <div className="mt-4 pb-4" style={{ borderBottom: '1px solid rgb(216, 194, 191)' }}>
                <p className="break-words"><strong>De :</strong> SignEase (no-reply@signease.com)</p>
                <p className="break-words"><strong>À :</strong> {selectedEmail.toName} &lt;{selectedEmail.toEmail}&gt;</p>
                <p className="break-words"><strong>Date :</strong> {new Date(selectedEmail.sentAt).toLocaleString('fr-FR')}</p>
              </div>
              <div className="mt-6 prose max-w-none text-onSurface break-words">
                <p className="break-words">{selectedEmail.body.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}</p>
              </div>
               <div className="mt-8 pt-6 text-center px-4" style={{ borderTop: '1px solid rgb(216, 194, 191)' }}>
                   <p className="text-sm text-onSurfaceVariant mb-4">Cliquez sur le bouton ci-dessous pour examiner et signer le document.</p>
                  <button
                      onClick={handleSignClick}
                      className="w-full sm:w-auto max-w-full inline-flex items-center justify-center gap-2 min-h-[44px] btn-premium-shine btn-premium-extended text-sm focus:outline-none focus:ring-4 focus:ring-primary/30"
                      title={`Examiner & Signer ${selectedEmail.documentName}`}
                  >
                      <FileText className="h-5 w-5 flex-shrink-0" />
                      <span className="truncate min-w-0">Examiner &amp; Signer {selectedEmail.documentName}</span>
                  </button>
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
