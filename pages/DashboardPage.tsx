
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Document } from '../types';
import { DocumentStatus } from '../types';
import DocumentCard from '../components/DocumentCard';
import AdminPanel from '../components/AdminPanel';
import { getDocuments, deleteDocuments, getTokenForDocumentSigner } from '../services/firebaseApi';
import { useUser } from '../components/UserContext';
import { PlusCircle, Inbox, Search, Trash2, X, AlertTriangle, Upload, CheckSquare, Square, LayoutDashboard } from 'lucide-react';
import Button from '../components/Button';
import { useToast } from '../components/Toast';
import Tooltip from '../components/Tooltip';
import { convertWordToPdf, isWordFile } from '../utils/wordToPdf';

const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-50 p-4 modal-backdrop" onClick={onClose}>
      <div className="bg-surface rounded-3xl shadow-xl w-full max-w-md p-6 modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex">
            <div className="bg-errorContainer p-3 rounded-full mr-4 h-fit">
              <AlertTriangle className="h-6 w-6 text-onErrorContainer" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-onSurface">{title}</h2>
              <p className="text-sm text-onSurfaceVariant mt-2">{message}</p>
            </div>
        </div>
        <div className="flex justify-end space-x-3 mt-8">
          <Button variant="text" onClick={onClose}>Annuler</Button>
          <button 
            onClick={onConfirm}
            className="btn-premium-shine btn-premium-extended h-11 text-sm focus:outline-none focus:ring-4 focus:ring-primary/30 inline-flex items-center justify-center"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentUser } = useUser();

  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);
      try {
        const docs = await getDocuments(currentUser?.email);
        setDocuments(docs);
      } catch (error) {
        console.error("Failed to fetch documents", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDocuments();
  }, [currentUser?.email]);

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => 
      doc.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [documents, searchTerm]);

  const statusOrder: DocumentStatus[] = [
    DocumentStatus.SENT,
    DocumentStatus.DRAFT,
    DocumentStatus.SIGNED,
    DocumentStatus.REJECTED,
  ];

  const groupedDocuments = useMemo(() => {
    return filteredDocuments.reduce((acc, doc) => {
      (acc[doc.status] = acc[doc.status] || []).push(doc);
      return acc;
    }, {} as Record<DocumentStatus, Document[]>);
  }, [filteredDocuments]);

  const handleSign = async (id: string) => {
    const token = await getTokenForDocumentSigner(id);
    if (token) {
        navigate(`/sign/${token}`);
    } else {
        addToast("Impossible de trouver le lien de signature pour ce document.", "error");
    }
  };

  const handleView = async (id: string) => {
    const token = await getTokenForDocumentSigner(id);
     if (token) {
        navigate(`/sign/${token}`, { state: { readOnly: true } });
    } else {
        addToast("Impossible de trouver les informations de ce document.", "error");
    }
  };

  const handleDocumentSelect = (docId: string) => {
    setSelectedDocuments(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleSelectAllClick = () => {
    if (selectedDocuments.length === filteredDocuments.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(filteredDocuments.map(doc => doc.id));
    }
  };
  
  const handleExitSelectionMode = () => {
      setIsSelectionMode(false);
      setSelectedDocuments([]);
  };

  const handleDelete = async () => {
    setIsConfirmDeleteOpen(false);
    try {
        await deleteDocuments(selectedDocuments);
        setDocuments(prev => prev.filter(doc => !selectedDocuments.includes(doc.id)));
        addToast(`${selectedDocuments.length} document(s) supprimé(s) avec succès.`, 'success');
        handleExitSelectionMode();
    } catch(error) {
        addToast('Échec de la suppression des documents.', 'error');
    }
  };

  // Gestion du drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileSelected(files[0]);
    }
  };

  const handleFileSelected = async (file: File) => {
    try {
      let processedFile = file;

      // Vérifier si c'est un fichier Word
      if (isWordFile(file)) {
        addToast('Conversion du fichier Word en PDF...', 'info');
        processedFile = await convertWordToPdf(file);
        addToast('Conversion réussie !', 'success');
      } else if (file.type !== 'application/pdf') {
        addToast('Veuillez sélectionner un fichier PDF ou Word (.doc, .docx).', 'error');
        return;
      }

      // Convertir en data URL pour la navigation
      const reader = new FileReader();
      reader.onloadend = () => {
        navigate('/prepare', { state: { pdfData: reader.result as string, fileName: processedFile.name } });
      };
      reader.readAsDataURL(processedFile);
    } catch (error) {
      console.error('Erreur lors du traitement du fichier:', error);
      addToast('Erreur lors du traitement du fichier.', 'error');
    }
  };

  const handleEmptyStateClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Input file global caché, utilisé par tous les boutons */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected(file);
        }}
        className="hidden"
      />
      
      <ConfirmationModal 
            isOpen={isConfirmDeleteOpen}
            onClose={() => setIsConfirmDeleteOpen(false)}
            onConfirm={handleDelete}
            title={`Supprimer ${selectedDocuments.length} document(s) ?`}
            message="Cette action est irréversible. Les documents sélectionnés seront définitivement supprimés."
        />
      
      {/* En-tête de la page */}
      <div className="container mx-auto mb-8">
        {isSelectionMode ? (
          <div className="bg-primaryContainer/30 backdrop-blur-sm rounded-2xl p-4 elevation-1 border border-primary/20 animate-slide-down">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="bg-primary text-onPrimary px-4 py-2 rounded-full font-bold text-sm elevation-2">
                  {selectedDocuments.length} / {filteredDocuments.length}
                </div>
                <h2 className="text-lg font-bold text-onSurface">
                  {selectedDocuments.length === 0 ? 'Aucune sélection' : 
                   selectedDocuments.length === 1 ? '1 document sélectionné' : 
                   `${selectedDocuments.length} documents sélectionnés`}
                </h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
                <Button 
                  variant="filled" 
                  icon={CheckSquare}
                  onClick={handleSelectAllClick} 
                  disabled={filteredDocuments.length === 0}
                  size="small"
                  className="flex-1 sm:flex-initial min-w-[140px] max-w-[160px]"
                >
                  <span className="truncate">
                    {filteredDocuments.length > 0 && selectedDocuments.length === filteredDocuments.length
                      ? 'Tout désélectionner'
                      : 'Tout sélectionner'}
                  </span>
                </Button>
                <Button 
                  variant="outlined"
                  icon={Trash2} 
                  disabled={selectedDocuments.length === 0} 
                  onClick={() => setIsConfirmDeleteOpen(true)}
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-primaryContainer inline-block p-4 rounded-full progressive-glow">
                  <LayoutDashboard className="h-12 w-12 text-onPrimaryContainer" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-onSurface">Tableau de bord</h1>
                  <p className="mt-1 text-md text-onSurfaceVariant">Gérez vos documents et vos demandes de signature.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                    {/* Bouton Ajouter un fichier - Desktop uniquement, dans le header, avant la recherche */}
                  {filteredDocuments.length > 0 && (
                    <button
                      onClick={handleEmptyStateClick}
                      className="hidden lg:flex items-center justify-center h-14 btn-premium-shine btn-premium-extended focus:outline-none focus:ring-4 focus:ring-primary/30 whitespace-nowrap"
                      aria-label="Ajouter un fichier"
                    >
                      <PlusCircle className="h-6 w-6 flex-shrink-0" />
                      <span className="tracking-wide text-base">Ajouter un fichier</span>
                    </button>
                  )}
                  <div className="relative w-full sm:w-64">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-onSurfaceVariant" />
                      <input 
                          type="text"
                          placeholder="Rechercher un document..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full p-2.5 pl-11 border border-outline bg-surface rounded-full focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                      />
                  </div>
                  <Button variant="outlined" onClick={() => setIsSelectionMode(true)}>Sélectionner</Button>
              </div>
          </div>
        )}
      </div>

      {/* Container blanc pour bouton + cartes */}
      <div className="container mx-auto">
        <div className="bg-white rounded-3xl shadow-sm p-4 sm:p-6 lg:p-8 relative">
          {/* Bouton Ajouter un fichier - Full width en mobile/tablette, dans container - Masqué si aucun document */}
          {!isSelectionMode && filteredDocuments.length > 0 && (
            <div className="mb-6 lg:hidden">
                  <button
                      onClick={handleEmptyStateClick}
                      className="w-full flex items-center justify-center h-12 sm:h-14 btn-premium-shine btn-premium-extended focus:outline-none focus:ring-4 focus:ring-primary/30"
                      aria-label="Ajouter un fichier"
                  >
                      <PlusCircle className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
                      <span className="tracking-wide text-sm sm:text-base whitespace-nowrap">Ajouter un fichier</span>
                  </button>
            </div>
          )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-surfaceVariant/30 rounded-2xl elevation-0 border border-outlineVariant/30 h-44 cascade-item loading-shimmer">
                <div className="p-5 h-full space-y-3">
                    <div className="h-8 skeleton-enhanced w-3/4"></div>
                    <div className="h-5 skeleton-enhanced w-1/2"></div>
                    <div className="h-4 skeleton-enhanced w-2/3"></div>
                </div>
            </div>
          ))}
        </div>
      ) : filteredDocuments.length > 0 ? (
        <div className="space-y-12">
          {statusOrder.map((status) =>
            groupedDocuments[status] && groupedDocuments[status].length > 0 ? (
              <section key={status}>
                <h2 className="text-xl font-semibold text-onSurface mb-4">{status}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {groupedDocuments[status].map((doc) => (
                    <DocumentCard 
                        key={doc.id} 
                        document={doc} 
                        onSign={handleSign} 
                        onView={handleView}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedDocuments.includes(doc.id)}
                        onSelect={handleDocumentSelect}
                    />
                  ))}
                </div>
              </section>
            ) : null
          )}
        </div>
      ) : searchTerm ? (
        <div className="text-center py-20 bg-surfaceVariant/40 rounded-3xl border-2 border-dashed border-outlineVariant">
          <Inbox className="mx-auto h-16 w-16 text-onSurfaceVariant" />
          <h3 className="mt-6 text-xl font-semibold text-onSurface">Aucun document ne correspond</h3>
          <p className="mt-2 text-sm text-onSurfaceVariant max-w-md mx-auto">Essayez de modifier votre recherche.</p>
        </div>
      ) : (
        <div 
          className={`text-center py-12 sm:py-16 md:py-20 lg:py-24 px-4 sm:px-6 md:px-8 border-4 border-dashed rounded-2xl sm:rounded-3xl transition-all duration-300 cursor-pointer ${
            isDragging 
              ? 'border-primary bg-primary/10 scale-[1.02]' 
              : 'border-outlineVariant bg-surfaceVariant/20 hover:bg-surfaceVariant/40 hover:border-primary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleEmptyStateClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleEmptyStateClick();
            }
          }}
        >
          <Upload className="mx-auto h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 text-onSurfaceVariant mb-4 sm:mb-6 md:mb-8 pointer-events-none" />
          <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-onSurface mb-2 sm:mb-3 md:mb-4 pointer-events-none">Aucun document pour l'instant</h3>
          <p className="text-xs sm:text-sm md:text-base text-onSurfaceVariant max-w-md mx-auto mb-4 sm:mb-6 md:mb-8 pointer-events-none">
            Cliquez ici ou glissez-déposez un fichier PDF ou Word
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Empêcher le double déclenchement
              handleEmptyStateClick();
            }}
            className="flex items-center justify-center h-12 sm:h-14 w-full sm:w-4/5 md:w-3/4 lg:w-1/2 btn-premium-shine btn-premium-extended focus:outline-none focus:ring-4 focus:ring-primary/30 text-sm sm:text-base mx-auto"
            aria-label="Ajouter un fichier"
          >
            <PlusCircle className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
            <span className="tracking-wide whitespace-nowrap">Ajouter un fichier</span>
          </button>
        </div>
      )}
        </div>
      </div>

      {/* Section Admin - visible seulement pour l'admin */}
      {currentUser?.isAdmin && (
        <div className="container mx-auto mt-8 mb-8">
          <AdminPanel />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
