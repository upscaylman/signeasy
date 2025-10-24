
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEmails, getDocuments, markEmailAsRead, deleteEmails, getPdfData, getDocumentIdFromToken } from '../services/firebaseApi';
import { useUser } from '../components/UserContext';
import type { MockEmail, Document } from '../types';
import { Loader2, Inbox as InboxIcon, FileText, Trash2, CheckSquare, Square, X, ArrowLeft, Mail, Send, Clock, AlertCircle, CheckCircle, FolderOpen, ZoomIn, ZoomOut } from 'lucide-react';
import Button from '../components/Button';
import { useToast } from '../components/Toast';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

// Helper pour convertir data URL en Uint8Array
const base64ToUint8Array = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error("Invalid data URL");
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Composant pour afficher une page PDF
interface PdfPageRendererProps {
  pageNum: number;
  pdf: pdfjsLib.PDFDocumentProxy;
  zoom: number;
}

const PdfPageRenderer: React.FC<PdfPageRendererProps> = ({ pageNum, pdf, zoom }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: canvas.getContext('2d')!,
          viewport,
        };

        await page.render(renderContext).promise;
      } catch (error) {
        console.error(`Erreur lors du rendu page ${pageNum}:`, error);
      }
    };

    renderPage();
  }, [pageNum, pdf, zoom]);

  return <canvas ref={canvasRef} className="w-full" />;
};

// Type unifié pour afficher emails ET documents
interface UnifiedItem {
  id: string;
  type: 'email' | 'document';
  title: string;
  documentName: string;
  timestamp: string;
  read: boolean;
  status?: string;
  source?: string; // "À signer" ou "Envoyé"
  signatureLink?: string;
  from?: string;
  body?: string;
  rawData: MockEmail | Document;
  folder: string; // Dossier auquel appartient l'item
}

// Type pour un dossier
interface Folder {
  id: string;
  name: string;
  icon: any;
  count: number;
  unread?: number;
}

const InboxPage: React.FC = () => {
  const [unifiedItems, setUnifiedItems] = useState<UnifiedItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showContent, setShowContent] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentUser } = useUser();

  // État pour le PDF
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(1);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Déterminer le rôle de l'utilisateur
  const [userRole, setUserRole] = useState<'destinataire' | 'expéditeur' | 'both'>('destinataire');

  // Déterminer les dossiers selon le rôle
  const getFolders = (role: 'destinataire' | 'expéditeur' | 'both'): Folder[] => {
    const allFolders: { [key: string]: Folder } = {
      all: { id: 'all', name: 'Tous', icon: InboxIcon, count: 0 },
      // Dossiers destinataire
      to_sign: { id: 'to_sign', name: 'À signer', icon: Clock, count: 0, unread: 0 },
      signed: { id: 'signed', name: 'Signés', icon: CheckCircle, count: 0 },
      rejected: { id: 'rejected', name: 'Refusés', icon: AlertCircle, count: 0 },
      // Dossiers expéditeur
      sent: { id: 'sent', name: 'Envoyés', icon: Send, count: 0 },
      signed_by_recipient: { id: 'signed_by_recipient', name: 'Signés par destinataire', icon: CheckCircle, count: 0 },
      rejected_by_recipient: { id: 'rejected_by_recipient', name: 'Rejetés', icon: AlertCircle, count: 0 }
    };

    let folders: Folder[] = [allFolders.all];

    if (role === 'destinataire' || role === 'both') {
      folders.push(allFolders.to_sign, allFolders.signed, allFolders.rejected);
    }

    if (role === 'expéditeur' || role === 'both') {
      folders.push(allFolders.sent, allFolders.signed_by_recipient, allFolders.rejected_by_recipient);
    }

    return folders;
  };

  // Assign folder to item
  const assignFolder = (item: UnifiedItem, role: string): string => {
    if (item.type === 'email') {
      // Pour les emails reçus (destinataire)
      if (item.source === 'À signer') return 'to_sign';
      if (item.title.includes('✅')) return 'signed';
      if (item.title.includes('❌')) return 'rejected';
    } else {
      // Pour les documents (expéditeur)
      if (item.status === 'Envoyé') return 'sent';
      if (item.status === 'Signé') return 'signed_by_recipient';
      if (item.status === 'Rejeté') return 'rejected_by_recipient';
    }
    return 'all';
  };

  // 📊 Charger et fusionner emails + documents
  const fetchUnifiedData = useCallback(async () => {
    setIsLoading(true);
    try {
      const emails = await getEmails(currentUser?.email);
      const documents = await getDocuments(currentUser?.email);

      // Déterminer le rôle
      let role: 'destinataire' | 'expéditeur' | 'both' = 'destinataire';
      if (documents.length > 0 && emails.length > 0) role = 'both';
      else if (documents.length > 0) role = 'expéditeur';
      setUserRole(role);

      // Convertir emails en UnifiedItem
      const emailItems: UnifiedItem[] = emails.map(email => ({
        id: email.id,
        type: 'email',
        title: email.subject,
        documentName: email.documentName,
        timestamp: email.sentAt,
        read: email.read,
        source: 'À signer',
        signatureLink: email.signatureLink,
        from: email.from,
        body: email.body,
        rawData: email,
        folder: 'to_sign'
      }));

      // Convertir documents en UnifiedItem
      const documentItems: UnifiedItem[] = documents.map(doc => ({
        id: doc.id,
        type: 'document',
        title: `${doc.name} (${doc.status})`,
        documentName: doc.name,
        timestamp: doc.updatedAt,
        read: true,
        status: doc.status,
        source: 'Envoyé',
        rawData: doc,
        folder: 'sent'
      }));

      // Assign folders
      const merged = [...emailItems, ...documentItems].map(item => ({
        ...item,
        folder: assignFolder(item, role)
      }));

      // Trier par date décroissante
      merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setUnifiedItems(merged);
      setSelectedFolder('all');

      if (merged.length > 0) {
        setSelectedItem(null);
        setShowContent(false);
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      addToast('Erreur lors du chargement', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.email, addToast]);

  useEffect(() => {
    fetchUnifiedData();
  }, [fetchUnifiedData]);

  // Filter items by selected folder
  const filteredItems = useMemo(() => {
    if (selectedFolder === 'all') return unifiedItems;
    return unifiedItems.filter(item => item.folder === selectedFolder);
  }, [unifiedItems, selectedFolder]);

  // Calculate folder counts
  const folders = useMemo(() => {
    const folderList = getFolders(userRole);
    return folderList.map(folder => {
      const count = unifiedItems.filter(item => item.folder === folder.id || folder.id === 'all').length;
      const unread = unifiedItems.filter(item => 
        (item.folder === folder.id || folder.id === 'all') && !item.read && item.type === 'email'
      ).length;
      return { ...folder, count: folder.id === 'all' ? unifiedItems.length : count, unread };
    });
  }, [unifiedItems, userRole]);

  const handleSelectItem = (item: UnifiedItem) => {
    setSelectedItem(item);
    setShowContent(true);

    if (!item.read && item.type === 'email') {
      markEmailAsRead(item.id).then(() => {
        setUnifiedItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, read: true } : i
        ));
      });
    }

    // Charger le PDF
    loadPdfDocument(item);
  };

  // Charger le document PDF
  const loadPdfDocument = async (item: UnifiedItem) => {
    setPdfLoading(true);
    setPdfDocument(null);
    try {
      let pdfData: string | null = null;
      
      if (item.type === 'email' && item.rawData) {
        // Pour les emails, extraire le token depuis le signatureLink
        const email = item.rawData as MockEmail;
        const token = email.signatureLink.split('/').pop(); // Extrait le token de la fin de l'URL
        
        if (token) {
          const docId = await getDocumentIdFromToken(token);
          if (docId) {
            pdfData = await getPdfData(docId);
          }
        }
      } else if (item.type === 'document' && item.rawData) {
        // Pour les documents, récupérer le PDF via le document id
        const doc = item.rawData as Document;
        pdfData = await getPdfData(doc.id);
      }

      if (pdfData) {
        const uint8Array = base64ToUint8Array(pdfData);
        const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
        setPdfDocument(pdf);
        setPdfZoom(window.innerWidth < 768 ? 0.5 : 0.8);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du PDF:', error);
      addToast('Erreur lors du chargement du PDF', 'error');
    } finally {
      setPdfLoading(false);
    }
  };
  
  const handleSignClick = () => {
    if (selectedItem?.type === 'email' && selectedItem?.signatureLink) {
      const token = selectedItem.signatureLink.split('/').pop();
          navigate(`/sign/${token}`);
      }
  };

  const handleItemSelect = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAllClick = () => {
    if (filteredItems.length > 0 && selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(i => i.id));
    }
  };

  const handleDeleteItems = async () => {
    if (selectedItems.length === 0) return;
    
    try {
      await deleteEmails(selectedItems);
      setUnifiedItems(prev => prev.filter(item => !selectedItems.includes(item.id)));
      setSelectedItems([]);
      addToast(`${selectedItems.length} élément(s) supprimé(s)`, 'success');
    } catch (error) {
      addToast('Erreur lors de la suppression', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-background">
      {/* Sidebar avec dossiers */}
      <div className={`${showContent && 'hidden lg:flex'} w-full lg:w-1/4 h-auto lg:min-h-screen flex flex-col lg:flex-col flex-shrink-0 lg:flex-shrink bg-surface border-b lg:border-b-0 lg:border-r border-outlineVariant overflow-y-auto`}>
        <div className="p-4 lg:p-4 border-b lg:border-b border-outlineVariant sticky top-0 bg-surface min-w-max lg:min-w-0">
          <div className="flex lg:flex items-center gap-3 whitespace-nowrap">
            <div className="bg-secondaryContainer inline-block p-3 lg:p-2.5 rounded-full progressive-glow flex-shrink-0">
              <InboxIcon className="h-7 lg:h-6 w-7 lg:w-6 text-onSecondaryContainer" />
            </div>
            <h1 className="text-lg lg:text-2xl font-bold text-onSurface">Boîte de réception</h1>
          </div>
        </div>

        <nav className="flex flex-row lg:flex-col flex-1 lg:flex-1 p-2 gap-1 sticky top-16 bg-surface z-10">
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => {
                setSelectedFolder(folder.id);
                // Sur desktop (lg), on réinitialise la sélection
                // Sur mobile, on garde l'affichage actuel
                if (window.innerWidth >= 1024) {
                  setSelectedItem(null);
                  setShowContent(false);
                }
              }}
              className={`px-4 py-3 md:px-5 md:py-3 lg:px-4 lg:py-3 rounded-full md:rounded-lg flex items-center justify-center md:justify-between transition-colors mb-0 md:mb-1 flex-shrink-0 md:flex-shrink whitespace-nowrap md:whitespace-normal min-w-max md:min-w-0 w-auto md:w-full ${
                selectedFolder === folder.id
                  ? 'bg-primaryContainer text-onPrimaryContainer'
                  : 'text-onSurface hover:bg-surfaceVariant/50 md:hover:bg-surfaceVariant'
              }`}
            >
              <div className="flex md:flex-row flex-col md:items-center gap-1 md:gap-3 min-w-0 items-center">
                <folder.icon className="h-6 md:h-5 w-6 md:w-5 flex-shrink-0" />
                <span className="truncate font-medium hidden md:inline text-xs md:text-sm">{folder.name}</span>
              </div>
              <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                {folder.unread !== undefined && folder.unread > 0 && (
                  <span className="bg-error text-onError text-xs font-bold px-2 py-0.5 rounded-full">
                    {folder.unread}
                  </span>
                )}
                <span className="text-xs text-onSurfaceVariant font-semibold">{folder.count}</span>
            </div>
            </button>
          ))}
        </nav>

        {/* Barre de sélection globale */}
        {isSelectionMode && (
          <div className="p-3 border-b border-outlineVariant flex items-center gap-3 bg-surfaceVariant/30 sticky top-28">
            <input
              type="checkbox"
              checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
              onChange={handleSelectAllClick}
              className="w-4 h-4 rounded cursor-pointer"
              title="Sélectionner tous"
            />
            <span className="text-sm font-medium text-onSurface flex-1">
              {selectedItems.length === 0 ? 'Sélectionner tous' : `${selectedItems.length} sélectionné(s)`}
            </span>
            {selectedItems.length > 0 && (
              <Button 
                variant="outlined"
                icon={Trash2}
                onClick={handleDeleteItems}
                size="small"
                className="!text-error !border-error"
              >
                Supprimer
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Liste des items */}
      <div className={`${showContent && 'hidden lg:flex'} lg:flex w-full lg:w-1/4 flex-col border-r border-outlineVariant bg-surface flex-1 min-h-0`}>
        <div className="p-4 border-b border-outlineVariant sticky top-0 bg-surface flex items-center justify-between">
          <h2 className="font-semibold text-onSurface truncate mr-2">
            {folders.find(f => f.id === selectedFolder)?.name}
          </h2>
          {!isSelectionMode && (
            <Button 
              variant="text" 
              size="small"
              onClick={() => setIsSelectionMode(true)}
            >
              Sélectionner
            </Button>
          )}
          {isSelectionMode && (
            <Button 
              variant="text" 
              size="small"
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedItems([]);
              }}
              >
              Annuler
              </Button>
          )}
        </div>

        {/* Barre de sélection globale */}
        {isSelectionMode && (
          <div className="p-3 border-b border-outlineVariant flex items-center gap-3 bg-surfaceVariant/30">
            <input
              type="checkbox"
              checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
              onChange={handleSelectAllClick}
              className="w-4 h-4 rounded cursor-pointer"
              title="Sélectionner tous"
            />
            <span className="text-sm font-medium text-onSurface flex-1">
              {selectedItems.length === 0 ? 'Sélectionner tous' : `${selectedItems.length} sélectionné(s)`}
            </span>
            {selectedItems.length > 0 && (
              <Button 
                variant="outlined"
                icon={Trash2}
                onClick={handleDeleteItems}
                size="small"
                className="!text-error !border-error"
              >
                Supprimer
              </Button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-onSurfaceVariant">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun élément</p>
             </div>
          ) : (
            filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className={`w-full p-4 border-b border-outlineVariant/50 text-left hover:bg-surfaceVariant/50 transition-colors group ${
                  selectedItem?.id === item.id ? 'bg-primaryContainer/20' : ''
                } ${!item.read ? 'bg-surfaceVariant/20' : ''}`}
                >
                  <div className="flex items-start gap-3">
                          {isSelectionMode && (
                              <input
                                type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleItemSelect(item.id)}
                      className="mt-1"
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      {item.type === 'email' ? (
                        <Mail className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Send className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate max-w-xs sm:max-w-sm md:max-w-md lg:max-w-md xl:max-w-lg 2xl:max-w-xl ${!item.read ? 'font-semibold' : 'font-medium'}`}>
                          {item.documentName}
                        </p>
                        <p className="text-xs text-onSurfaceVariant">
                          {new Date(item.timestamp).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                  {!item.read && item.type === 'email' && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1"></div>
                  )}
                  {/* Bouton Supprimer qui apparaît au survol */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItems([item.id]);
                      handleDeleteItems();
                    }}
                    className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-error/10 text-error flex-shrink-0"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Détail view */}
      <div className={`${!showContent && 'hidden lg:flex'} lg:flex w-full lg:flex-1 flex-col bg-surface`}>
        {selectedItem ? (
          <>
            <div className="p-4 border-b border-outlineVariant flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
              <button 
                  onClick={() => setShowContent(false)}
                  className="lg:hidden p-2 rounded-full hover:bg-surfaceVariant flex-shrink-0"
              >
                  <ArrowLeft className="h-5 w-5" />
              </button>
                <h2 className="text-xl font-bold text-onSurface truncate max-w-[150px] sm:max-w-[250px] md:max-w-[300px] lg:max-w-1/4 xl:max-w-3/5 2xl:max-w-2/3">
                  {selectedItem.documentName}
                </h2>
              </div>
              {pdfDocument && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPdfZoom(z => Math.max(0.5, z - 0.1))}
                    className="p-2 rounded-lg hover:bg-surfaceVariant transition-colors"
                  >
                    <ZoomOut className="h-5 w-5" />
                  </button>
                  <span className="text-sm font-medium min-w-[50px] text-center">{Math.round(pdfZoom * 100)}%</span>
                  <button
                    onClick={() => setPdfZoom(z => Math.min(1, z + 0.1))}
                    className="p-2 rounded-lg hover:bg-surfaceVariant transition-colors"
                  >
                    <ZoomIn className="h-5 w-5" />
                  </button>
               </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto bg-surfaceVariant/30" ref={viewerRef}>
              {pdfLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              ) : pdfDocument ? (
                <div className="flex flex-col items-center py-2 px-2">
                  {Array.from(new Array(pdfDocument.numPages), (_, index) => (
                    <div key={`page-${index + 1}`} className="bg-white rounded-lg shadow-lg overflow-hidden mb-3">
                      <PdfPageRenderer 
                        pageNum={index + 1} 
                        pdf={pdfDocument} 
                        zoom={pdfZoom} 
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-onSurfaceVariant">
                  <FileText className="h-12 w-12 mb-4 opacity-30" />
                  <p className="text-sm">Aucun PDF à afficher</p>
                </div>
              )}
            </div>

            {/* Boutons d'action */}
            {selectedItem.type === 'email' && (
              <div className="p-4 border-t border-outlineVariant flex justify-end">
                <button
                  onClick={handleSignClick}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] btn-premium-shine btn-premium-extended text-sm"
                >
                  <FileText className="h-5 w-5" />
                  Examiner & Signer
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-center text-onSurfaceVariant">
            <div>
              <InboxIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-semibold">Sélectionnez un élément</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InboxPage;
