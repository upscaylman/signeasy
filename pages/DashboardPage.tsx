import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  CheckSquare,
  ChevronDown,
  Edit3,
  FileSignature,
  Inbox,
  LayoutDashboard,
  Mail,
  PlusCircle,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import AdminPanel from "../components/AdminPanel";
import Button from "../components/Button";
import DocumentCard from "../components/DocumentCard";
import { useToast } from "../components/Toast";
import { useUser } from "../components/UserContext";
import { useDraftDocument } from "../hooks/useDraftDocument";
import {
  archiveDocuments,
  deleteDocuments,
  deleteEmails,
  downloadDocument,
  getDocumentIdFromToken,
  getDocuments,
  getEmails,
  getEnvelopeByDocumentId,
  getTokenForDocumentSigner,
  subscribeToDocuments,
  subscribeToEmails,
} from "../services/firebaseApi";
import type { Document, MockEmail, Recipient } from "../types";
import { DocumentStatus } from "../types";
import { convertWordToPdf, isWordFile } from "../utils/wordToPdf";

// Type unifié pour combiner documents envoyés et emails reçus
interface UnifiedDocument extends Document {
  source: "sent" | "received"; // Pour distinguer expéditeur vs destinataire
  emailId?: string; // Pour les documents issus d'emails
  originalEmail?: MockEmail; // Données email originales si applicable
  recipients?: Recipient[]; // Destinataires avec nom + email
}

const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-50 p-4 modal-backdrop"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-3xl shadow-xl w-full max-w-lg p-6 modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="bg-errorContainer p-3 rounded-full flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-onErrorContainer" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-onSurface mb-2">{title}</h2>
            <p className="text-sm text-onSurfaceVariant">{message}</p>
          </div>
        </div>

        <div className="mb-6 p-3 bg-primaryContainer/30 rounded-lg border border-primary/20">
          <p className="text-xs text-onSurface leading-relaxed">
            ⚠️ <span className="font-bold">Conformité RGPD</span> : Cette
            suppression est définitive et irréversible. Assurez-vous de ne pas
            être soumis à une obligation légale de conservation pour ces
            documents (contrats, factures, documents RH, etc.).
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="text" onClick={onClose}>
            Annuler
          </Button>
          <button
            onClick={onConfirm}
            className="btn-premium-shine btn-premium-extended h-11 text-sm focus:outline-none focus:ring-4 focus:ring-primary/30 inline-flex items-center justify-center"
          >
            Confirmer la suppression
          </button>
        </div>
      </div>
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const [documents, setDocuments] = useState<UnifiedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [userRole, setUserRole] = useState<
    "destinataire" | "expéditeur" | "both"
  >("expéditeur");
  const { addToast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickSignFileInputRef = useRef<HTMLInputElement>(null);
  const { currentUser } = useUser();
  const { drafts, deleteDraft, refreshDrafts, canAddDraft } =
    useDraftDocument();
  // ✅ Suppression du refreshTrigger car on utilise maintenant un listener en temps réel

  // Fonction helper pour gérer les éléments supprimés dans localStorage
  const getDeletedItems = (): Set<string> => {
    if (!currentUser?.email) return new Set();
    const key = `deletedItems_${currentUser.email}`;
    const stored = localStorage.getItem(key);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  };

  // Fonction pour convertir un email en UnifiedDocument
  const emailToUnifiedDocument = (email: MockEmail): UnifiedDocument => {
    let status = DocumentStatus.SENT;

    // Déterminer le statut selon le contenu de l'email
    if (email.subject.includes("✅") || email.body?.includes("signé")) {
      status = DocumentStatus.SIGNED;
    } else if (email.subject.includes("❌") || email.body?.includes("rejeté")) {
      status = DocumentStatus.REJECTED;
    }

    // Calculer la date d'expiration à 1 an après la date de création du document
    // En supposant que le document a été créé à la même date que l'email
    const expirationDate = new Date(email.sentAt);
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);

    return {
      id: `email-${email.id}`,
      name: email.documentName || email.subject,
      status: status,
      createdAt: email.sentAt,
      updatedAt: email.sentAt,
      totalPages: 0, // Non applicable pour les emails
      expiresAt: expirationDate.toISOString(), // Définir la date d'expiration à 1 an après la création
      creatorEmail: email.from || "",
      source: "received",
      emailId: email.id,
      originalEmail: email,
    };
  };

  // Récupérer les documents unifiés (envoyés + reçus)
  const fetchUnifiedDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sentDocs, receivedEmails] = await Promise.all([
        getDocuments(currentUser?.email),
        getEmails(currentUser?.email),
      ]);

      // Déterminer le rôle de l'utilisateur
      let role: "destinataire" | "expéditeur" | "both" = "expéditeur";
      if (sentDocs.length > 0 && receivedEmails.length > 0) {
        role = "both";
      } else if (receivedEmails.length > 0 && sentDocs.length === 0) {
        role = "destinataire";
      }
      setUserRole(role);

      // Filtrer les éléments supprimés localement
      const deletedItems = getDeletedItems();

      // Convertir les documents envoyés en UnifiedDocument avec leurs destinataires
      const unifiedSentDocs: UnifiedDocument[] = await Promise.all(
        sentDocs
          .filter((doc) => !deletedItems.has(doc.id)) // Filtrer les documents supprimés
          .map(async (doc) => {
            const envelope = await getEnvelopeByDocumentId(doc.id);
            return {
              ...doc,
              source: "sent" as const,
              recipients: envelope?.recipients || [],
            };
          })
      );

      // Convertir les emails reçus en UnifiedDocument et filtrer ceux supprimés
      // Récupérer les IDs de documents associés aux emails de manière asynchrone
      const emailDocumentIds = await Promise.all(
        receivedEmails.map(async (email) => {
          try {
            if (email.signatureLink) {
              const token = email.signatureLink.split("/").pop();
              if (token) {
                const documentId = await getDocumentIdFromToken(token);
                return { emailId: email.id, documentId };
              }
            }
          } catch (err) {
            console.error("Erreur récupération documentId:", err);
          }
          return { emailId: email.id, documentId: null };
        })
      );

      const unifiedReceivedDocs: UnifiedDocument[] = receivedEmails
        .filter((email) => {
          // Filtrer les emails supprimés (ID format: email-{emailId})
          const emailItemId = `email-${email.id}`;
          if (deletedItems.has(emailItemId)) return false;

          // Filtrer aussi si le document associé est supprimé
          const emailDocMapping = emailDocumentIds.find(
            (m) => m.emailId === email.id
          );
          if (
            emailDocMapping?.documentId &&
            deletedItems.has(emailDocMapping.documentId)
          ) {
            return false;
          }

          return true;
        })
        .map(emailToUnifiedDocument);

      // Combiner et trier par date décroissante
      const allDocs = [...unifiedSentDocs, ...unifiedReceivedDocs].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      setDocuments(allDocs);
    } catch (error) {
      console.error("Failed to fetch unified documents", error);
      addToast("Erreur lors du chargement", "error");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.email, addToast]);

  // 🔄 Listener en temps réel pour les documents unifiés (envoyés + reçus)
  useEffect(() => {
    if (!currentUser?.email) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    let sentDocs: Document[] = [];
    let receivedEmails: MockEmail[] = [];

    // Fonction pour mettre à jour les documents unifiés
    const updateUnifiedDocuments = async () => {
      try {
        // Déterminer le rôle de l'utilisateur
        let role: "destinataire" | "expéditeur" | "both" = "expéditeur";
        if (sentDocs.length > 0 && receivedEmails.length > 0) {
          role = "both";
        } else if (receivedEmails.length > 0 && sentDocs.length === 0) {
          role = "destinataire";
        }
        setUserRole(role);

        // Filtrer les éléments supprimés localement
        const deletedItems = getDeletedItems();

        // Convertir les documents envoyés en UnifiedDocument avec leurs destinataires
        const unifiedSentDocs: UnifiedDocument[] = await Promise.all(
          sentDocs
            .filter((doc) => !deletedItems.has(doc.id)) // Filtrer les documents supprimés
            .map(async (doc) => {
              const envelope = await getEnvelopeByDocumentId(doc.id);
              return {
                ...doc,
                source: "sent" as const,
                recipients: envelope?.recipients || [],
              };
            })
        );

        // Convertir les emails reçus en UnifiedDocument et filtrer ceux supprimés
        // Récupérer les IDs de documents associés aux emails de manière asynchrone
        const emailDocumentIds = await Promise.all(
          receivedEmails.map(async (email) => {
            try {
              if (email.signatureLink) {
                const token = email.signatureLink.split("/").pop();
                if (token) {
                  const documentId = await getDocumentIdFromToken(token);
                  return { emailId: email.id, documentId };
                }
              }
            } catch (err) {
              console.error("Erreur récupération documentId:", err);
            }
            return { emailId: email.id, documentId: null };
          })
        );

        const unifiedReceivedDocs: UnifiedDocument[] = receivedEmails
          .filter((email) => {
            // Filtrer les emails supprimés (ID format: email-{emailId})
            const emailItemId = `email-${email.id}`;
            if (deletedItems.has(emailItemId)) return false;

            // Filtrer aussi si le document associé est supprimé
            const emailDocMapping = emailDocumentIds.find(
              (m) => m.emailId === email.id
            );
            if (
              emailDocMapping?.documentId &&
              deletedItems.has(emailDocMapping.documentId)
            ) {
              return false;
            }

            return true;
          })
          .map(emailToUnifiedDocument);

        // Combiner et trier par date décroissante
        const allDocs = [...unifiedSentDocs, ...unifiedReceivedDocs].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        setDocuments(allDocs);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch unified documents", error);
        addToast("Erreur lors du chargement", "error");
        setIsLoading(false);
      }
    };

    // S'abonner aux changements en temps réel des documents envoyés
    const unsubscribeSent = subscribeToDocuments(currentUser.email, (docs) => {
      sentDocs = docs;
      updateUnifiedDocuments();
    });

    // S'abonner aux changements en temps réel des emails reçus
    const unsubscribeReceived = subscribeToEmails(
      currentUser.email,
      (emails) => {
        receivedEmails = emails;
        updateUnifiedDocuments();
      }
    );

    // Écouter les événements de suppression depuis InboxPage
    const handleItemsDeleted = () => {
      // Forcer la mise à jour des documents pour filtrer les éléments supprimés
      updateUnifiedDocuments();
    };

    window.addEventListener("itemsDeleted", handleItemsDeleted);

    // Nettoyer les listeners au démontage du composant
    return () => {
      console.log("📤 Désabonnement des listeners en temps réel");
      unsubscribeSent();
      unsubscribeReceived();
      window.removeEventListener("itemsDeleted", handleItemsDeleted);
    };
  }, [currentUser?.email, addToast]);

  // Filtrer les documents actifs (non archivés)
  const filteredDocuments = useMemo(() => {
    return documents.filter(
      (doc) =>
        doc.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !doc.archived // Exclure les archivés
    );
  }, [documents, searchTerm]);

  // Filtrer les documents archivés (tous les rôles, mais uniquement les signés)
  const archivedDocuments = useMemo(() => {
    return documents.filter(
      (doc) =>
        doc.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        doc.archived === true &&
        doc.status === DocumentStatus.SIGNED // Seuls les documents signés peuvent être archivés
    );
  }, [documents, searchTerm]);

  // Organiser les archives par année
  const archivedByYear = useMemo(() => {
    const grouped = archivedDocuments.reduce((acc, doc) => {
      const year = new Date(doc.createdAt).getFullYear().toString();
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(doc);
      return acc;
    }, {} as Record<string, UnifiedDocument[]>);

    // Trier les documents de chaque année par date de création (plus récent en premier)
    Object.keys(grouped).forEach((year) => {
      grouped[year].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    // Trier les années (plus récente en premier)
    return Object.entries(grouped).sort(([yearA], [yearB]) =>
      yearB.localeCompare(yearA)
    );
  }, [archivedDocuments]);

  // État pour gérer les années ouvertes/fermées
  const [openYears, setOpenYears] = useState<Set<string>>(new Set());

  const toggleYear = (year: string) => {
    setOpenYears((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(year)) {
        newSet.delete(year);
      } else {
        newSet.add(year);
      }
      return newSet;
    });
  };

  const statusOrder: DocumentStatus[] = [
    DocumentStatus.SENT,
    DocumentStatus.DRAFT,
    DocumentStatus.SIGNED,
    DocumentStatus.REJECTED,
  ];

  // Fonction pour adapter le label du statut selon le contexte
  const getStatusLabel = (
    status: DocumentStatus,
    source?: "sent" | "received"
  ) => {
    if (status === DocumentStatus.SENT && source === "received") {
      return "Reçus";
    }
    return status;
  };

  const groupedDocuments = useMemo(() => {
    return filteredDocuments.reduce((acc, doc) => {
      (acc[doc.status] = acc[doc.status] || []).push(doc);
      return acc;
    }, {} as Record<DocumentStatus, UnifiedDocument[]>);
  }, [filteredDocuments]);

  const handleSign = async (id: string) => {
    // Trouver le document
    const doc = documents.find((d) => d.id === id);

    // 🔒 SÉCURITÉ : Si l'utilisateur est l'expéditeur (source='sent'),
    // il ne peut pas signer, seulement consulter en lecture seule
    if (doc?.source === "sent") {
      console.log(
        "🔒 Expéditeur ne peut pas signer son propre document - Redirection vers consultation"
      );
      await handleView(id);
      return;
    }

    if (doc?.source === "received" && doc.originalEmail) {
      // Pour les emails reçus (destinataire), extraire le token du signatureLink
      const token = doc.originalEmail.signatureLink.split("/").pop();
      if (token) {
        navigate(`/sign/${token}`);
      } else {
        addToast("Lien de signature invalide.", "error");
      }
    } else {
      // Fallback (ne devrait normalement pas arriver ici pour 'sent')
      const token = await getTokenForDocumentSigner(id);
      if (token) {
        navigate(`/sign/${token}`);
      } else {
        addToast(
          "Impossible de trouver le lien de signature pour ce document.",
          "error"
        );
      }
    }
  };

  const handleView = async (id: string) => {
    // Trouver le document
    const doc = documents.find((d) => d.id === id);

    // Afficher un toast informatif si le document est signé
    if (doc?.status === DocumentStatus.SIGNED) {
      addToast(
        "Pour supprimer ce document signé de la base de données, contactez : contact@fo-metaux.fr",
        "info"
      );
    }

    if (doc?.source === "received" && doc.originalEmail) {
      // Pour les emails reçus, extraire le token du signatureLink
      const token = doc.originalEmail.signatureLink.split("/").pop();
      if (token) {
        navigate(`/sign/${token}`, { state: { readOnly: true } });
      } else {
        addToast("Lien de signature invalide.", "error");
      }
    } else {
      // Pour les documents envoyés, utiliser la méthode classique
      const token = await getTokenForDocumentSigner(id);
      if (token) {
        // Stocker le token dans sessionStorage pour le récupérer sans l'afficher dans l'URL
        sessionStorage.setItem("signToken", token);
        sessionStorage.setItem("signReadOnly", "true");
        // Naviguer vers une route propre sans token visible
        navigate("/sign/view", {
          replace: true,
          state: { readOnly: true, documentId: id },
        });
      } else {
        addToast(
          "Impossible de trouver les informations de ce document.",
          "error"
        );
      }
    }
  };

  const handleDownload = async (id: string) => {
    // Trouver le document
    const doc = documents.find((d) => d.id === id);
    if (!doc) {
      addToast("Document introuvable.", "error");
      return;
    }

    // Extraire l'ID réel du document (enlever le préfixe "email-" si présent)
    const realDocId = id.startsWith("email-") ? id.substring(6) : id;

    addToast("Téléchargement en cours...", "info");
    const result = await downloadDocument(realDocId, doc.name);

    if (result.success) {
      addToast("Document téléchargé avec succès !", "success");
    } else {
      addToast(result.error || "Erreur lors du téléchargement", "error");
    }
  };

  const handleQuickSignClick = () => {
    quickSignFileInputRef.current?.click();
  };

  const handleQuickSignFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Navigate to quick-sign with the file
    navigate("/quick-sign", {
      state: {
        file,
        fileName: file.name,
      },
    });
  };

  const handleDocumentSelect = (docId: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  };

  const handleSelectAllClick = () => {
    if (selectedDocuments.length === filteredDocuments.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(filteredDocuments.map((doc) => doc.id));
    }
  };

  const handleExitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedDocuments([]);
  };

  const handleArchive = async () => {
    try {
      // Récupérer les documents sélectionnés
      const docsToArchive = selectedDocuments
        .map((id) => documents.find((d) => d.id === id))
        .filter((d): d is UnifiedDocument => d !== undefined);

      // Filtrer uniquement les documents signés (pour tous les rôles)
      const signedDocs = docsToArchive.filter(
        (d) => d.status === DocumentStatus.SIGNED
      );

      if (signedDocs.length === 0) {
        addToast("Seuls les documents signés peuvent être archivés.", "info");
        return;
      }

      // Extraire les IDs des documents signés
      // Pour les documents reçus (emails), on doit utiliser l'ID du document original
      const docIdsToArchive = signedDocs.map((doc) => {
        // Si c'est un document reçu (email), extraire l'ID réel du document
        if (doc.source === "received" && doc.id.startsWith("email-")) {
          return doc.id.substring(6); // Enlever le préfixe "email-"
        }
        return doc.id;
      });

      if (docIdsToArchive.length > 0) {
        await archiveDocuments(docIdsToArchive, true);
        setDocuments((prev) =>
          prev.map((doc) => {
            const docId =
              doc.source === "received" && doc.id.startsWith("email-")
                ? doc.id.substring(6)
                : doc.id;
            return docIdsToArchive.includes(docId)
              ? { ...doc, archived: true }
              : doc;
          })
        );
        addToast(
          `${docIdsToArchive.length} document(s) archivé(s) avec succès.`,
          "success"
        );
        handleExitSelectionMode();
      }
    } catch (error) {
      console.error("Erreur lors de l'archivage:", error);
      addToast("Échec de l'archivage des documents.", "error");
    }
  };

  const handleUnarchive = async (docIds: string[]) => {
    try {
      await archiveDocuments(docIds, false);
      setDocuments((prev) =>
        prev.map((doc) =>
          docIds.includes(doc.id) ? { ...doc, archived: false } : doc
        )
      );
      addToast(
        `${docIds.length} document(s) désarchivé(s) avec succès.`,
        "success"
      );
    } catch (error) {
      console.error("Erreur lors du désarchivage:", error);
      addToast("Échec du désarchivage des documents.", "error");
    }
  };

  const handleDelete = async () => {
    setIsConfirmDeleteOpen(false);
    try {
      // Séparer les documents envoyés et les emails reçus
      const docsToDelete = selectedDocuments
        .map((id) => documents.find((d) => d.id === id))
        .filter((d): d is UnifiedDocument => d !== undefined);

      const sentDocIds = docsToDelete
        .filter((d) => d.source === "sent")
        .map((d) => d.id);

      const receivedEmailIds = docsToDelete
        .filter((d) => d.source === "received" && d.emailId)
        .map((d) => d.emailId!);

      // Supprimer les documents envoyés (méthode classique)
      if (sentDocIds.length > 0) {
        await deleteDocuments(sentDocIds);
      }

      // Supprimer les emails reçus (via firebaseApi)
      if (receivedEmailIds.length > 0) {
        await deleteEmails(receivedEmailIds);
      }

      setDocuments((prev) =>
        prev.filter((doc) => !selectedDocuments.includes(doc.id))
      );
      addToast(
        `${selectedDocuments.length} document(s) supprimé(s) avec succès.`,
        "success"
      );
      handleExitSelectionMode();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      addToast("Échec de la suppression des documents.", "error");
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

    if (!canAddDraft()) {
      addToast(
        "⚠️ Limite de 3 brouillons atteinte. Veuillez finaliser ou supprimer un brouillon avant d'ajouter un nouveau fichier.",
        "info"
      );
      return;
    }

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
        addToast("Conversion du fichier Word en PDF...", "info");
        processedFile = await convertWordToPdf(file);
        addToast("Conversion réussie !", "success");
      } else if (file.type !== "application/pdf") {
        addToast(
          "Veuillez sélectionner un fichier PDF ou Word (.doc, .docx).",
          "error"
        );
        return;
      }

      // Convertir en data URL pour la navigation
      const reader = new FileReader();
      reader.onloadend = () => {
        navigate("/prepare", {
          state: {
            pdfData: reader.result as string,
            fileName: processedFile.name,
          },
        });
      };
      reader.readAsDataURL(processedFile);
    } catch (error) {
      console.error("Erreur lors du traitement du fichier:", error);
      addToast("Erreur lors du traitement du fichier.", "error");
    }
  };

  const handleEmptyStateClick = () => {
    if (!canAddDraft()) {
      addToast(
        "⚠️ Limite de 3 brouillons atteinte. Veuillez finaliser ou supprimer un brouillon avant d'ajouter un nouveau fichier.",
        "info"
      );
      return;
    }
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

      {/* Input file pour signature rapide */}
      <input
        ref={quickSignFileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleQuickSignFileSelected}
        className="hidden"
      />

      <ConfirmationModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`Supprimer ${selectedDocuments.length} document(s) ?`}
        message="Les documents seront définitivement supprimés de la base de données dans le respect du RGPD (droit à l'effacement)."
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
                  {selectedDocuments.length === 0
                    ? "Aucune sélection"
                    : selectedDocuments.length === 1
                    ? "1 document sélectionné"
                    : `${selectedDocuments.length} documents sélectionnés`}
                </h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
                <Button
                  variant="filled"
                  icon={CheckSquare}
                  onClick={handleSelectAllClick}
                  disabled={filteredDocuments.length === 0}
                  size="small"
                  className="flex-1 sm:flex-initial min-w-[140px] max-w-[160px] rounded-full items-center gap-1.5 px-3 py-1.5 hover:bg-error/10 transition-colors flex-shrink-0"
                >
                  <span className="truncate">
                    {filteredDocuments.length > 0 &&
                    selectedDocuments.length === filteredDocuments.length
                      ? "Tout désélectionner"
                      : "Tout sélectionner"}
                  </span>
                </Button>
                <Button
                  variant="outlined"
                  icon={Archive}
                  disabled={selectedDocuments.length === 0}
                  onClick={handleArchive}
                  size="small"
                  className={`flex-1 sm:flex-initial min-w-[110px] ${
                    selectedDocuments.length > 0
                      ? "rounded-full items-center gap-1.5 px-3 py-1.5 hover:bg-error/10 transition-colors flex-shrink-0"
                      : ""
                  }`}
                >
                  Archiver
                </Button>
                {/* Bouton Supprimer - Visible uniquement pour les administrateurs */}
                {currentUser?.isAdmin && (
                  <Button
                    variant="outlined"
                    icon={Trash2}
                    disabled={selectedDocuments.length === 0}
                    onClick={() => setIsConfirmDeleteOpen(true)}
                    size="small"
                    className={`flex-1 sm:flex-initial min-w-[110px] ${
                      selectedDocuments.length > 0
                        ? "rounded-full items-center gap-1.5 px-3 py-1.5 text-error border border-error hover:bg-error/10 transition-colors flex-shrink-0"
                        : "!text-error !border-error state-layer-error [&:hover]:!bg-transparent"
                    }`}
                  >
                    Supprimer
                  </Button>
                )}
                <Button
                  variant="filled"
                  icon={X}
                  onClick={handleExitSelectionMode}
                  size="small"
                  className="flex-1 rounded-full sm:flex-initial min-w-[110px] !bg-surfaceVariant hover:!bg-surfaceVariant/80 !text-onSurfaceVariant"
                >
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Titre - Toujours visible */}
            <div className="flex items-center gap-4">
              <div className="bg-primaryContainer inline-block p-4 rounded-full progressive-glow">
                <LayoutDashboard className="h-12 w-12 text-onPrimaryContainer" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-onSurface">
                  Tableau de bord
                </h1>
                <p className="mt-1 text-md text-onSurfaceVariant">
                  Gérez vos documents et vos demandes de signature.
                </p>
              </div>
            </div>

            {/* Barre d'actions - Style VerifyPage */}
            {filteredDocuments.length > 0 && (
              <div className="bg-surface p-4 sm:p-6 rounded-3xl shadow-sm border border-outlineVariant/30">
                {/* Desktop : tout sur une ligne */}
                <div className="hidden lg:flex items-stretch gap-3">
                  {/* Recherche */}
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-onSurfaceVariant" />
                    <input
                      type="text"
                      placeholder="Rechercher un document..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-full p-3 pl-11 border border-outline bg-surface rounded-full focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    />
                  </div>

                  {/* Bouton Ajouter un fichier */}
                  <button
                    onClick={handleEmptyStateClick}
                    className="flex items-center justify-center px-6 btn-premium-shine btn-premium-extended focus:outline-none focus:ring-4 focus:ring-primary/30 whitespace-nowrap"
                    aria-label="Ajouter un fichier"
                  >
                    <PlusCircle className="h-5 w-5 flex-shrink-0" />
                    <span className="tracking-wide text-sm ml-2">
                      Ajouter un fichier
                    </span>
                  </button>

                  {/* Bouton Signature Rapide */}
                  <button
                    onClick={handleQuickSignClick}
                    className="flex items-center justify-center px-6 bg-secondaryContainer text-onSecondaryContainer rounded-full font-semibold hover:elevation-1 transition-all focus:outline-none focus:ring-4 focus:ring-secondary/30 whitespace-nowrap"
                    aria-label="Signature rapide"
                  >
                    <FileSignature className="h-5 w-5 flex-shrink-0" />
                    <span className="tracking-wide text-sm ml-2">
                      Signature rapide
                    </span>
                  </button>

                  {/* Bouton Sélectionner */}
                  <Button
                    variant="outlined"
                    onClick={() => setIsSelectionMode(true)}
                    icon={CheckSquare}
                    size="medium"
                  >
                    Sélectionner
                  </Button>
                </div>

                {/* Mobile : Ligne 1 = Recherche, Ligne 2 = 3 boutons icônes */}
                <div className="lg:hidden space-y-3">
                  {/* Ligne 1 : Recherche pleine largeur */}
                  <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-onSurfaceVariant" />
                    <input
                      type="text"
                      placeholder="Rechercher un document..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full p-3 pl-11 border border-outline bg-surface rounded-full focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    />
                  </div>

                  {/* Ligne 2 : 3 boutons icônes uniquement */}
                  <div className="flex items-center gap-3 justify-center">
                    {/* Bouton Ajouter un fichier - Icône uniquement */}
                    <button
                      onClick={handleEmptyStateClick}
                      className="flex items-center justify-center h-14 w-14 btn-premium-shine rounded-full focus:outline-none focus:ring-4 focus:ring-primary/30"
                      aria-label="Ajouter un fichier"
                      title="Ajouter un fichier"
                    >
                      <PlusCircle className="h-6 w-6 flex-shrink-0" />
                    </button>

                    {/* Bouton Signature Rapide - Icône uniquement */}
                    <button
                      onClick={handleQuickSignClick}
                      className="flex items-center justify-center h-14 w-14 bg-secondaryContainer text-onSecondaryContainer rounded-full font-semibold hover:elevation-1 transition-all focus:outline-none focus:ring-4 focus:ring-secondary/30"
                      aria-label="Signature rapide"
                      title="Signature rapide"
                    >
                      <FileSignature className="h-6 w-6 flex-shrink-0" />
                    </button>

                    {/* Bouton Sélectionner - Icône uniquement */}
                    <button
                      onClick={() => setIsSelectionMode(true)}
                      className="flex items-center justify-center h-14 w-14 border-2 border-outline text-primary rounded-full hover:bg-surfaceVariant/50 transition-all focus:outline-none focus:ring-4 focus:ring-primary/30"
                      aria-label="Sélectionner"
                      title="Sélectionner"
                    >
                      <CheckSquare className="h-6 w-6 flex-shrink-0" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Container blanc pour cartes */}
      <div className="container mx-auto">
        <div className="bg-white rounded-3xl shadow-sm p-4 sm:p-6 lg:p-8 relative">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="bg-surfaceVariant/30 rounded-2xl elevation-0 border border-outlineVariant/30 h-44 cascade-item loading-shimmer"
                >
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
              {/* Cartes Brouillons (max 3) en colonnes horizontales */}
              {drafts.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-purple-900 mb-4">
                    Brouillons en cours ({drafts.length}/3)
                  </h2>
                  <div className="flex flex-nowrap overflow-x-auto gap-4 pb-4 -mx-4 px-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:mx-0 md:px-0 md:overflow-visible">
                    {drafts.map((draft) => (
                      <div
                        key={draft.id}
                        className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-2 border-purple-500/30 rounded-2xl p-4 shadow-lg min-w-[280px] flex-shrink-0 md:min-w-0"
                      >
                        <div className="flex flex-col h-full">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="bg-purple-500/20 p-2 rounded-xl flex-shrink-0">
                              <Edit3 className="h-5 w-5 text-purple-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-bold text-purple-900 mb-1 truncate">
                                {draft.fileName}
                              </h3>
                              <p className="text-xs text-purple-600">
                                {new Date(draft.timestamp).toLocaleString(
                                  "fr-FR",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-auto">
                            <button
                              onClick={() => {
                                navigate("/prepare", {
                                  state: { draftId: draft.id },
                                });
                              }}
                              className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-full font-semibold hover:bg-purple-700 transition-colors focus:outline-none focus:ring-4 focus:ring-purple-600/30 text-sm"
                            >
                              Finaliser
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Êtes-vous sûr de vouloir supprimer ce brouillon ?"
                                  )
                                ) {
                                  deleteDraft(draft.id);
                                  addToast("Brouillon supprimé", "success");
                                }
                              }}
                              className="p-2 text-purple-700 hover:bg-purple-500/20 rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-purple-600/30"
                              aria-label="Supprimer le brouillon"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents reçus (Destinataire) */}
              {filteredDocuments.filter((d) => d.source === "received").length >
                0 && (
                <div>
                  <div className="mb-6 pb-3 border-b-2 border-blue-500/30">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-500/10 p-2 rounded-lg">
                        <Mail className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-onSurface">
                          Documents reçus
                        </h2>
                        <p className="text-sm text-onSurfaceVariant">
                          Documents que vous avez reçus pour signature
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-8">
                    {statusOrder.map((status) => {
                      const docsInStatus =
                        groupedDocuments[status]?.filter(
                          (d) => d.source === "received"
                        ) || [];
                      return docsInStatus.length > 0 ? (
                        <section key={`received-${status}`}>
                          <h3 className="text-lg font-semibold text-onSurface mb-3 ml-2">
                            {getStatusLabel(status, "received")}
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                            {docsInStatus.map((doc) => (
                              <DocumentCard
                                key={doc.id}
                                document={doc}
                                onSign={handleSign}
                                onView={handleView}
                                onDownload={handleDownload}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedDocuments.includes(doc.id)}
                                onSelect={handleDocumentSelect}
                                documentSource="received"
                                recipients={doc.recipients}
                              />
                            ))}
                          </div>
                        </section>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Documents envoyés (Expéditeur) */}
              {filteredDocuments.filter((d) => d.source === "sent").length >
                0 && (
                <div>
                  <div className="mb-6 pb-3 border-b-2 border-orange-500/30">
                    <div className="flex items-center gap-3">
                      <div className="bg-orange-500/10 p-2 rounded-lg">
                        <Send className="h-6 w-6 text-orange-600" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-onSurface">
                          Documents envoyés
                        </h2>
                        <p className="text-sm text-onSurfaceVariant">
                          Documents que vous avez envoyés pour signature
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-8">
                    {statusOrder.map((status) => {
                      const docsInStatus =
                        groupedDocuments[status]?.filter(
                          (d) => d.source === "sent"
                        ) || [];
                      return docsInStatus.length > 0 ? (
                        <section key={`sent-${status}`}>
                          <h3 className="text-lg font-semibold text-onSurface mb-3 ml-2">
                            {status}
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                            {docsInStatus.map((doc) => (
                              <DocumentCard
                                key={doc.id}
                                document={doc}
                                onSign={handleSign}
                                onView={handleView}
                                onDownload={handleDownload}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedDocuments.includes(doc.id)}
                                onSelect={handleDocumentSelect}
                                documentSource="sent"
                                recipients={doc.recipients}
                              />
                            ))}
                          </div>
                        </section>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : searchTerm ? (
            <div className="text-center py-20 bg-surfaceVariant/40 rounded-3xl border-2 border-dashed border-outlineVariant">
              <Inbox className="mx-auto h-16 w-16 text-onSurfaceVariant" />
              <h3 className="mt-6 text-xl font-semibold text-onSurface">
                Aucun document ne correspond
              </h3>
              <p className="mt-2 text-sm text-onSurfaceVariant max-w-md mx-auto">
                Essayez de modifier votre recherche.
              </p>
            </div>
          ) : (
            <div>
              {/* Cartes Brouillons dans l'état vide (max 3) en colonnes horizontales */}
              {drafts.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-purple-900 mb-4">
                    Brouillons en cours ({drafts.length}/3)
                  </h2>
                  <div className="flex flex-nowrap overflow-x-auto gap-4 pb-4 -mx-4 px-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:mx-0 md:px-0 md:overflow-visible">
                    {drafts.map((draft) => (
                      <div
                        key={draft.id}
                        className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-2 border-purple-500/30 rounded-2xl p-4 shadow-lg min-w-[280px] flex-shrink-0 md:min-w-0"
                      >
                        <div className="flex flex-col h-full">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="bg-purple-500/20 p-2 rounded-xl flex-shrink-0">
                              <Edit3 className="h-5 w-5 text-purple-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-bold text-purple-900 mb-1 truncate">
                                {draft.fileName}
                              </h3>
                              <p className="text-xs text-purple-600">
                                {new Date(draft.timestamp).toLocaleString(
                                  "fr-FR",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-auto">
                            <button
                              onClick={() => {
                                navigate("/prepare", {
                                  state: { draftId: draft.id },
                                });
                              }}
                              className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-full font-semibold hover:bg-purple-700 transition-colors focus:outline-none focus:ring-4 focus:ring-purple-600/30 text-sm"
                            >
                              Finaliser
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Êtes-vous sûr de vouloir supprimer ce brouillon ?"
                                  )
                                ) {
                                  deleteDraft(draft.id);
                                  addToast("Brouillon supprimé", "success");
                                }
                              }}
                              className="p-2 text-purple-700 hover:bg-purple-500/20 rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-purple-600/30"
                              aria-label="Supprimer le brouillon"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                className={`text-center py-12 sm:py-16 md:py-20 lg:py-24 px-4 sm:px-6 md:px-8 border-4 border-dashed rounded-2xl sm:rounded-3xl transition-all duration-300 cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/10 scale-[1.02]"
                    : "border-outlineVariant bg-surfaceVariant/20 hover:bg-surfaceVariant/40 hover:border-primary/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleEmptyStateClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleEmptyStateClick();
                  }
                }}
              >
                <Upload className="mx-auto h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 text-onSurfaceVariant mb-4 sm:mb-6 md:mb-8 pointer-events-none" />
                <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-onSurface mb-2 sm:mb-3 md:mb-4 pointer-events-none">
                  Aucun document pour l'instant
                </h3>
                <p className="text-xs sm:text-sm md:text-base text-onSurfaceVariant max-w-md mx-auto mb-4 sm:mb-6 md:mb-8 pointer-events-none">
                  Cliquez ici ou glissez-déposez un fichier PDF ou Word
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-4/5 md:w-3/4 lg:w-2/3 mx-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Empêcher le double déclenchement
                      handleEmptyStateClick();
                    }}
                    className="flex items-center justify-center h-12 sm:h-14 px-6 btn-premium-shine btn-premium-extended focus:outline-none focus:ring-4 focus:ring-primary/30 text-sm sm:text-base flex-1"
                    aria-label="Ajouter un fichier"
                  >
                    <PlusCircle className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
                    <span className="tracking-wide whitespace-nowrap">
                      Ajouter un fichier
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Empêcher le double déclenchement
                      handleQuickSignClick();
                    }}
                    className="flex items-center justify-center h-12 sm:h-14 px-6 bg-secondaryContainer text-onSecondaryContainer rounded-full font-semibold hover:elevation-1 transition-all focus:outline-none focus:ring-4 focus:ring-secondary/30 text-sm sm:text-base flex-1"
                    aria-label="Signature rapide"
                  >
                    <FileSignature className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
                    <span className="tracking-wide whitespace-nowrap ml-2">
                      Signature rapide
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section Archives - Organisées par année avec collapse */}
      {archivedDocuments.length > 0 && (
        <div className="container mx-auto mt-12">
          <div className="bg-white rounded-3xl shadow-sm p-4 sm:p-6 lg:p-8">
            <div className="mb-6 pb-3 border-b-2 border-outlineVariant/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-outlineVariant/20 p-2 rounded-lg">
                    <Archive className="h-6 w-6 text-onSurfaceVariant" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-onSurface">
                      Archives
                    </h2>
                    <p className="text-sm text-onSurfaceVariant">
                      {archivedDocuments.length} document
                      {archivedDocuments.length > 1 ? "s" : ""} archivé
                      {archivedDocuments.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Archives organisées par année */}
            <div className="space-y-4">
              {archivedByYear.map(([year, docs]) => (
                <div
                  key={year}
                  className="border border-outlineVariant/30 rounded-2xl overflow-hidden"
                >
                  {/* En-tête de l'année - Cliquable pour collapse */}
                  <button
                    onClick={() => toggleYear(year)}
                    className="w-full flex items-center justify-between p-4 bg-surfaceVariant/30 hover:bg-surfaceVariant/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <Archive className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-onSurface">
                          {year}
                        </h3>
                        <p className="text-sm text-onSurfaceVariant">
                          {docs.length} document{docs.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-onSurfaceVariant transition-transform duration-300 ${
                        openYears.has(year) ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Contenu de l'année - Collapse */}
                  <div
                    className={`transition-all duration-300 ease-in-out ${
                      openYears.has(year)
                        ? "max-h-[10000px] opacity-100"
                        : "max-h-0 opacity-0 overflow-hidden"
                    }`}
                  >
                    <div className="p-4 bg-surface">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {docs.map((doc) => (
                          <div key={doc.id} className="relative">
                            <DocumentCard
                              document={doc}
                              onSign={handleSign}
                              onView={handleView}
                              onDownload={handleDownload}
                              isSelectionMode={false}
                              isSelected={false}
                              onSelect={() => {}}
                              documentSource="sent"
                              recipients={doc.recipients}
                            />
                            {/* Bouton désarchiver en overlay */}
                            <button
                              onClick={() => handleUnarchive([doc.id])}
                              className="absolute top-2 right-2 p-2 bg-surface rounded-lg shadow-md hover:bg-primaryContainer transition-colors group"
                              title="Désarchiver"
                            >
                              <ArchiveRestore className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
