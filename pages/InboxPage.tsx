import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  ArrowLeft,
  CheckCircle,
  CheckSquare,
  Clock,
  Eye,
  FileText,
  FolderOpen,
  Inbox as InboxIcon,
  Loader2,
  Mail,
  MailOpen,
  Send,
  Trash2,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";
import { useUser } from "../components/UserContext";
import { db } from "../config/firebase";
import {
  deleteDocuments,
  deleteEmails,
  getDocumentIdFromToken,
  getDocuments,
  getEmails,
  getPdfData,
  markEmailAsRead,
  toggleEmailReadStatus,
} from "../services/firebaseApi";
import type { Document, Envelope, Field, MockEmail } from "../types";
import { DocumentStatus, FieldType } from "../types";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

// Helper pour convertir data URL en Uint8Array
const base64ToUint8Array = (dataUrl: string) => {
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("Invalid data URL");
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Composant pour afficher une page PDF avec les champs signés en overlay
interface PdfPageRendererProps {
  pageNum: number;
  pdf: pdfjsLib.PDFDocumentProxy;
  zoom: number;
  fields?: Field[];
  pageDimensions?: { width: number; height: number };
}

const PdfPageRenderer: React.FC<PdfPageRendererProps> = ({
  pageNum,
  pdf,
  zoom,
  fields = [],
  pageDimensions,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
          canvasContext: canvas.getContext("2d")!,
          viewport,
        };

        await page.render(renderContext).promise;
      } catch (error) {
        console.error(`Erreur lors du rendu page ${pageNum}:`, error);
      }
    };

    renderPage();
  }, [pageNum, pdf, zoom]);

  // Filtrer les champs pour cette page
  const pageFields = fields.filter((f) => f.page === pageNum - 1);

  useEffect(() => {
    console.log(`📄 Page ${pageNum}:`, {
      totalFields: fields.length,
      allFieldsPages: fields.map((f) => ({
        page: f.page,
        type: f.type,
        hasValue: !!f.value,
      })),
      pageFields: pageFields.length,
      fieldsWithValues: pageFields.filter((f) => f.value).length,
      pageDimensions,
    });
  }, [pageNum, pageFields.length, fields.length, pageDimensions]);

  return (
    <div ref={containerRef} className="relative w-full">
      <canvas ref={canvasRef} className="w-full" />
      {/* Afficher les champs signés en overlay */}
      {pageDimensions &&
        pageFields.map((field) => {
          const value = field.value;
          if (!value) return null;

          // Calculer la position en pixels avec le zoom
          const baseStyle: React.CSSProperties = {
            position: "absolute",
            left: `${field.x * zoom}px`,
            top: `${field.y * zoom}px`,
            width: `${field.width * zoom}px`,
            height: `${field.height * zoom}px`,
          };

          if (
            field.type === FieldType.SIGNATURE ||
            field.type === FieldType.INITIAL
          ) {
            return (
              <div
                key={field.id}
                style={baseStyle}
                className="bg-surface rounded-md border border-outlineVariant flex items-center justify-center p-1 pointer-events-none"
              >
                <img
                  src={String(value)}
                  alt="signature"
                  className="object-contain w-full h-full"
                />
              </div>
            );
          } else if (field.type === FieldType.DATE) {
            return (
              <div
                key={field.id}
                style={baseStyle}
                className="bg-surface rounded-md border border-outlineVariant flex items-center justify-center pointer-events-none"
              >
                <span className="text-sm font-semibold text-onSurface">
                  {String(value)}
                </span>
              </div>
            );
          } else if (field.type === FieldType.TEXT) {
            return (
              <div
                key={field.id}
                style={baseStyle}
                className="bg-surface rounded-md border border-outlineVariant flex items-center justify-start p-2 pointer-events-none"
              >
                <span className="text-sm text-onSurface whitespace-pre-wrap break-words">
                  {String(value)}
                </span>
              </div>
            );
          } else if (field.type === FieldType.CHECKBOX) {
            return (
              <div
                key={field.id}
                style={baseStyle}
                className="bg-surface rounded-md border border-outlineVariant flex items-center justify-center pointer-events-none"
              >
                {value === true && (
                  <CheckSquare className="h-full w-full text-primary" />
                )}
              </div>
            );
          }
          return null;
        })}
    </div>
  );
};

// Type unifié pour afficher emails ET documents
interface UnifiedItem {
  id: string;
  type: "email" | "document";
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
  recipientName?: string; // Nom complet du destinataire
  recipientEmail?: string; // Email du destinataire
  archived?: boolean; // Document archivé
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
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showContent, setShowContent] = useState(false);
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);
  const [showDeleteSnackbar, setShowDeleteSnackbar] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentUser } = useUser();
  // ✅ refreshTrigger n'est plus nécessaire - InboxPage a son propre cycle de chargement

  // Nettoyer le timeout du tooltip au démontage du composant
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // État pour le PDF
  const [pdfDocument, setPdfDocument] =
    useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(1);
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [pageDimensions, setPageDimensions] = useState<
    { width: number; height: number }[]
  >([]);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Déterminer le rôle de l'utilisateur (récupérer du localStorage si disponible)
  const [userRole, setUserRole] = useState<
    "destinataire" | "expéditeur" | "both"
  >(() => {
    const savedRole = localStorage.getItem(`userRole_${currentUser?.email}`);
    return (
      (savedRole as "destinataire" | "expéditeur" | "both") || "destinataire"
    );
  });

  // Déterminer les dossiers selon le rôle
  const getFolders = (
    role: "destinataire" | "expéditeur" | "both"
  ): Folder[] => {
    const allFolders: { [key: string]: Folder } = {
      all: { id: "all", name: "Tous", icon: InboxIcon, count: 0 },
      to_sign: {
        id: "to_sign",
        name: "À signer",
        icon: Clock,
        count: 0,
        unread: 0,
      },
      sent: { id: "sent", name: "Envoyés", icon: Send, count: 0 },
      signed: { id: "signed", name: "Signés", icon: CheckCircle, count: 0 },
      rejected: {
        id: "rejected",
        name: "Rejetés",
        icon: XCircle,
        count: 0,
      },
    };

    let folders: Folder[] = [allFolders.all];

    if (role === "destinataire") {
      folders.push(allFolders.to_sign, allFolders.signed, allFolders.rejected);
    } else if (role === "expéditeur") {
      folders.push(allFolders.sent, allFolders.signed, allFolders.rejected);
    } else if (role === "both") {
      // Les 4 dossiers uniques
      folders.push(
        allFolders.to_sign,
        allFolders.sent,
        allFolders.signed,
        allFolders.rejected
      );
    }

    return folders;
  };

  // Assign folder to item - Logique simple basée sur les données de la BDD
  const assignFolder = (item: UnifiedItem, role: string): string => {
    if (item.type === "email") {
      // DESTINATAIRE : Emails reçus pour signer
      if (item.title.includes("✅")) return "signed";
      if (item.title.includes("❌")) return "rejected";
      return "to_sign"; // "Signature requise : ..."
    } else if (item.type === "document") {
      // EXPÉDITEUR : Documents envoyés (basé sur le status de la BDD)
      if (item.status === DocumentStatus.SENT) return "sent";
      if (item.status === DocumentStatus.SIGNED) return "signed";
      if (item.status === DocumentStatus.REJECTED) return "rejected";
    }
    return "all";
  };

  // 📊 Charger et fusionner emails + documents
  const fetchUnifiedData = useCallback(async () => {
    setIsLoading(true);
    try {
      const emails = await getEmails(currentUser?.email);
      const documents = await getDocuments(currentUser?.email);

      // Déterminer le rôle (ne pas réinitialiser si tout est vide)
      let role: "destinataire" | "expéditeur" | "both" = userRole; // Conserver le rôle actuel par défaut

      // Mettre à jour le rôle uniquement si on a des données
      if (documents.length > 0 && emails.length > 0) {
        role = "both";
      } else if (documents.length > 0) {
        role = "expéditeur";
      } else if (emails.length > 0) {
        role = "destinataire";
      }
      // Si tout est vide, on garde le rôle précédent pour maintenir l'affichage des onglets

      // Sauvegarder le rôle dans localStorage pour persistance
      if (currentUser?.email) {
        localStorage.setItem(`userRole_${currentUser.email}`, role);
      }
      setUserRole(role);

      // Convertir emails en UnifiedItem (DESTINATAIRE uniquement)
      // Vérifier si le document associé à chaque email est archivé
      const emailItems: UnifiedItem[] = await Promise.all(
        emails.map(async (email) => {
          console.log(`📧 Email ${email.id}:`, {
            subject: email.subject,
            read: email.read,
            readType: typeof email.read,
            sentAt: email.sentAt,
          });

          // Récupérer le statut archivé du document associé à cet email
          let isArchived = false;
          if (email.signatureLink) {
            try {
              const token = email.signatureLink.split("/").pop();
              if (token) {
                const documentId = await getDocumentIdFromToken(token);
                if (documentId) {
                  // Récupérer le document depuis Firestore pour vérifier son statut archivé
                  const documentDoc = await getDoc(doc(db, "documents", documentId));
                  if (documentDoc.exists()) {
                    const documentData = documentDoc.data() as Document;
                    isArchived = documentData.archived === true;
                    if (isArchived) {
                      console.log(`📦 Email ${email.id} associé au document archivé ${documentId}`);
                    }
                  }
                }
              }
            } catch (err) {
              console.error("Erreur lors de la récupération du statut archivé:", err);
            }
          }

          return {
            id: email.id,
            type: "email",
            title: email.subject,
            documentName: email.documentName,
            timestamp: email.sentAt,
            read: email.read ?? false, // Fallback à false si undefined
            source: "À signer",
            signatureLink: email.signatureLink,
            from: email.from,
            body: email.body,
            rawData: email,
            folder: "all", // Le folder sera assigné par assignFolder() après
            archived: isArchived, // Inclure le statut d'archivage
          };
        })
      );

      // Convertir documents en UnifiedItem (EXPÉDITEUR uniquement)
      const documentItems: UnifiedItem[] = await Promise.all(
        documents.map(async (document) => {
          // Créer un lien de consultation pour l'expéditeur
          // Récupérer le token et les infos du destinataire
          let viewLink = "";
          let recipientName = "";
          let recipientEmail = "";

          try {
            const envelopeId = `env${document.id.substring(3)}`;

            // Récupérer l'enveloppe pour obtenir les infos du destinataire
            const envelopeDocRef = doc(db, "envelopes", envelopeId);
            const envelopeDoc = await getDoc(envelopeDocRef);

            if (envelopeDoc.exists()) {
              const envelopeData = envelopeDoc.data();
              if (
                envelopeData.recipients &&
                envelopeData.recipients.length > 0
              ) {
                const recipient = envelopeData.recipients[0];
                recipientName = recipient.name || "";
                recipientEmail = recipient.email || "";
              }
            }

            // Chercher le token existant pour ce document
            const tokensQuery = query(
              collection(db, "tokens"),
              where("envelopeId", "==", envelopeId)
            );
            const tokensSnapshot = await getDocs(tokensQuery);
            if (!tokensSnapshot.empty) {
              const token = tokensSnapshot.docs[0].id;
              viewLink = `${window.location.origin}/#/sign/${token}`;
            }
          } catch (err) {
            console.error("Erreur lors de la récupération des infos:", err);
          }

          console.log(
            `📄 Document ${document.name} - Status: "${document.status}" - Folder assigné:`,
            assignFolder(
              {
                id: document.id,
                type: "document",
                title: `${document.name} (${document.status})`,
                documentName: document.name,
                timestamp: document.updatedAt,
                read: true,
                status: document.status,
                source: "Envoyé",
                signatureLink: viewLink,
                recipientName,
                recipientEmail,
                rawData: document,
                folder: "all",
              },
              role
            )
          );

          return {
            id: document.id,
            type: "document",
            title: `${document.name} (${document.status})`,
            documentName: document.name,
            timestamp: document.updatedAt,
            read: true,
            status: document.status,
            source: "Envoyé",
            signatureLink: viewLink,
            recipientName,
            recipientEmail,
            rawData: document,
            folder: "all", // Le folder sera assigné par assignFolder() après
            archived: document.archived ?? false, // Inclure le statut d'archivage
          };
        })
      );

      // Assign folders
      const merged = [...emailItems, ...documentItems].map((item) => ({
        ...item,
        folder: assignFolder(item, role),
      }));

      // Trier par date décroissante
      merged.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setUnifiedItems(merged);
      setSelectedFolder("all");

      if (merged.length > 0) {
        setSelectedItem(null);
        setShowContent(false);
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      addToast("Erreur lors du chargement", "error");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.email, addToast]);

  useEffect(() => {
    fetchUnifiedData();
  }, [fetchUnifiedData]); // ✅ Suppression de refreshTrigger

  // Filter items by selected folder (exclure les documents archivés)
  const filteredItems = useMemo(() => {
    // Exclure les documents archivés (archived === true)
    const nonArchivedItems = unifiedItems.filter(
      (item) => !(item.archived === true)
    );
    
    // Log pour déboguer
    const archivedCount = unifiedItems.filter((item) => item.archived === true).length;
    if (archivedCount > 0) {
      console.log(`📦 ${archivedCount} document(s) archivé(s) filtré(s) de l'affichage`);
    }
    
    if (selectedFolder === "all") return nonArchivedItems;
    return nonArchivedItems.filter((item) => item.folder === selectedFolder);
  }, [unifiedItems, selectedFolder]);

  // Calculate folder counts
  const folders = useMemo(() => {
    // 🎨 Toujours afficher TOUS les onglets peu importe le rôle
    // (même si certains sont vides, pour une meilleure cohérence UX)
    const effectiveRole = "both"; // Forcer "both" pour afficher tous les onglets
    const folderList = getFolders(effectiveRole);

    return folderList.map((folder) => {
      const count = unifiedItems.filter(
        (item) => item.folder === folder.id || folder.id === "all"
      ).length;
      // Calculer les badges "unread" : uniquement pour les emails non lus
      // Les documents envoyés (expéditeur) sont toujours considérés comme "lus" car en lecture seule
      const unread = unifiedItems.filter(
        (item) =>
          (item.folder === folder.id || folder.id === "all") &&
          !item.read &&
          item.type === "email" // Seuls les emails peuvent être "non lus"
      ).length;
      return {
        ...folder,
        count: folder.id === "all" ? unifiedItems.length : count,
        unread,
      };
    });
  }, [unifiedItems, userRole]);

  const handleSelectItem = (item: UnifiedItem) => {
    setSelectedItem(item);
    setShowContent(true);

    if (!item.read && item.type === "email") {
      markEmailAsRead(item.id).then(() => {
        setUnifiedItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, read: true } : i))
        );
      });
    }

    // Charger le PDF pour tous les types
    loadPdfDocument(item);
  };

  // Charger le document PDF
  const loadPdfDocument = async (item: UnifiedItem) => {
    setPdfLoading(true);
    setPdfDocument(null);
    setEnvelope(null);
    setPageDimensions([]);

    try {
      let pdfData: string | null = null;
      let documentId: string | null = null;

      if (item.type === "email" && item.rawData) {
        // Pour les emails, extraire le token depuis le signatureLink
        const email = item.rawData as MockEmail;
        const token = email.signatureLink.split("/").pop();

        if (token) {
          documentId = await getDocumentIdFromToken(token);
          if (documentId) {
            pdfData = await getPdfData(documentId);
          }
        }
      } else if (item.type === "document" && item.rawData) {
        // Pour les documents, récupérer le PDF via le document id
        const doc = item.rawData as Document;
        documentId = doc.id;
        pdfData = await getPdfData(doc.id);
      }

      if (pdfData && documentId) {
        const uint8Array = base64ToUint8Array(pdfData);
        const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
        setPdfDocument(pdf);
        setPdfZoom(window.innerWidth < 768 ? 0.5 : 0.8);

        // Charger les dimensions des pages
        const dims: { width: number; height: number }[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          dims.push({ width: viewport.width, height: viewport.height });
        }
        setPageDimensions(dims);

        // Charger l'enveloppe pour afficher les champs (signatures, dates, etc.)
        const envelopeId = `env${documentId.substring(3)}`;
        console.log("📦 Chargement enveloppe:", envelopeId);
        const envelopeDoc = await getDoc(doc(db, "envelopes", envelopeId));
        if (envelopeDoc.exists()) {
          const envelopeData = envelopeDoc.data() as Envelope;
          console.log("✅ Enveloppe chargée:", {
            totalFields: envelopeData.fields.length,
            fieldsWithValues: envelopeData.fields.filter((f) => f.value).length,
            fields: envelopeData.fields,
          });
          setEnvelope(envelopeData);
        } else {
          console.error("❌ Enveloppe introuvable:", envelopeId);
        }
      }
    } catch (error) {
      console.error("Erreur lors du chargement du PDF:", error);
      addToast("Erreur lors du chargement du PDF", "error");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSignClick = () => {
    if (selectedItem?.signatureLink) {
      const token = selectedItem.signatureLink.split("/").pop();
      if (selectedItem.type === "email") {
        // Pour les emails (destinataire)
        navigate(`/sign/${token}`);
      } else if (selectedItem.type === "document") {
        // Pour les documents (expéditeur) - lecture seule
        // Stocker le token dans sessionStorage pour le récupérer sans l'afficher dans l'URL
        sessionStorage.setItem('signToken', token);
        sessionStorage.setItem('signReadOnly', 'true');
        // Naviguer vers une route propre sans token visible
        navigate('/sign/view', { replace: true, state: { readOnly: true } });
      }
    }
  };

  const handleItemSelect = (itemId: string) => {
    setSelectedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAllClick = () => {
    if (
      filteredItems.length > 0 &&
      selectedItems.length === filteredItems.length
    ) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map((i) => i.id));
    }
  };

  const handleRequestDelete = () => {
    if (selectedItems.length === 0) return;
    setShowDeleteSnackbar(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedItems.length === 0) return;

    try {
      // 📧 SUPPRESSION CONDITIONNELLE selon le statut du document
      const itemsToDelete = selectedItems
        .map((id) => unifiedItems.find((item) => item.id === id))
        .filter((item): item is UnifiedItem => item !== undefined);

      let emailsLocallyDeleted = 0;
      let documentsGloballyDeleted = 0;
      let documentsPendingDeleted = 0;
      const documentsToDelete: string[] = [];

      for (const item of itemsToDelete) {
        if (item.type === "email") {
          // Récupérer le statut du document depuis l'item
          const docData = item.rawData as MockEmail;
          let docStatus: string | undefined;

          // Déterminer le statut selon le contenu de l'email
          if (
            docData.subject.includes("✅") ||
            docData.body?.includes("signé")
          ) {
            docStatus = DocumentStatus.SIGNED;
          } else if (
            docData.subject.includes("❌") ||
            docData.body?.includes("rejeté")
          ) {
            docStatus = DocumentStatus.REJECTED;
          } else {
            docStatus = DocumentStatus.SENT; // En attente
          }

          // LOGIQUE CONDITIONNELLE
          if (
            docStatus === DocumentStatus.SIGNED ||
            docStatus === DocumentStatus.REJECTED
          ) {
            // ✅ Document finalisé (signé/rejeté) → SUPPRESSION BILATÉRALE
            // Récupérer l'ID du document pour suppression globale
            try {
              const token = docData.signatureLink.split("/").pop();
              if (token) {
                const documentId = await getDocumentIdFromToken(token);
                if (documentId) {
                  documentsToDelete.push(documentId);
                  documentsGloballyDeleted++;
                }
              }
            } catch (err) {
              console.error("Erreur récupération documentId:", err);
              // Fallback: suppression locale uniquement
              await deleteEmails([item.id]);
              emailsLocallyDeleted++;
            }
          } else {
            // 📧 Document en attente → SUPPRESSION LOCALE uniquement
            await deleteEmails([item.id]);
            documentsPendingDeleted++;
          }
        } else if (item.type === "document") {
          // Documents envoyés visibles dans Inbox (masquage local)
          // Ne rien faire, juste retirer de la vue
        }
      }

      // Supprimer globalement les documents finalisés
      if (documentsToDelete.length > 0) {
        await deleteDocuments(documentsToDelete);
      }

      // Mettre à jour l'UI
      setUnifiedItems((prev) =>
        prev.filter((item) => !selectedItems.includes(item.id))
      );

      setSelectedItems([]);
      setShowDeleteSnackbar(false);

      // Messages clairs et différenciés
      const messages: string[] = [];

      if (documentsGloballyDeleted > 0) {
        messages.push(
          `${documentsGloballyDeleted} document(s) signé(s)/rejeté(s) supprimé(s) définitivement (vous ET l'expéditeur)`
        );
      }

      if (documentsPendingDeleted > 0) {
        messages.push(
          `${documentsPendingDeleted} email(s) en attente supprimé(s) (le document reste disponible pour l'expéditeur)`
        );
      }

      if (messages.length > 0) {
        addToast(
          messages.join(" • "),
          documentsGloballyDeleted > 0 ? "success" : "info"
        );
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      addToast("Erreur lors de la suppression", "error");
      setShowDeleteSnackbar(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteSnackbar(false);
  };

  // 📧 Fonction pour basculer le statut lu/non lu d'un item
  const handleToggleReadStatus = async (
    item: UnifiedItem,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); // Empêcher la sélection de l'item

    if (item.type !== "email") {
      // Les documents envoyés n'ont pas de statut lu/non lu
      return;
    }

    try {
      const result = await toggleEmailReadStatus(item.id, item.read);

      if (result.success) {
        // Mettre à jour l'UI localement
        setUnifiedItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, read: result.newStatus } : i
          )
        );

        // Mettre à jour selectedItem si c'est celui qui est affiché
        if (selectedItem?.id === item.id) {
          setSelectedItem({ ...selectedItem, read: result.newStatus });
        }

        addToast(
          result.newStatus ? "Marqué comme lu" : "Marqué comme non lu",
          "success"
        );

        // Déclencher un rafraîchissement du compteur dans le header
        window.dispatchEvent(new Event("storage_updated"));
      } else {
        addToast("Erreur lors de la mise à jour", "error");
      }
    } catch (error) {
      console.error("Erreur toggleReadStatus:", error);
      addToast("Erreur lors de la mise à jour", "error");
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
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row bg-background overflow-hidden">
      {/* Sidebar avec dossiers */}
      <div
        className={`${
          showContent && "hidden lg:flex"
        } w-full lg:w-1/4 flex flex-col bg-surface lg:border-r border-outlineVariant`}
      >
        <div className="p-4 border-b border-outlineVariant bg-surface z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="inline-block p-2.5 rounded-full progressive-glow-blue flex-shrink-0"
              style={{ backgroundColor: "rgba(37, 99, 235, 0.1)" }}
            >
              <InboxIcon
                className="h-6 w-6"
                style={{ color: "rgb(44, 21, 18)" }}
              />
            </div>
            <h1 className="text-2xl font-bold text-onSurface">
              Boîte de réception
            </h1>
          </div>
        </div>

        <nav className="flex-shrink-0 bg-background overflow-x-auto lg:overflow-visible">
          <style>{`
            @media (max-width: 1023px) {
              .folder-nav-mobile {
                display: flex;
                flex-direction: row;
                gap: 0.5rem;
                padding: 0.5rem;
                overflow-x: auto;
                overflow-y: hidden;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: thin;
              }
              .folder-nav-mobile::-webkit-scrollbar {
                height: 3px;
              }
              .folder-nav-mobile::-webkit-scrollbar-thumb {
                background: rgba(0,0,0,0.2);
                border-radius: 3px;
              }
            }
            `}</style>
          <div className="folder-nav-mobile lg:flex lg:flex-col lg:gap-1 lg:p-2">
            {folders.map((folder) => (
              <div key={folder.id} className="relative lg:w-full">
                <button
                  onClick={() => {
                    setSelectedFolder(folder.id);
                    setSelectedItem(null);
                    setShowContent(false);
                  }}
                  onMouseEnter={() => {
                    // Desktop uniquement
                    if (window.innerWidth >= 1024) {
                      setHoveredFolder(folder.id);
                    }
                  }}
                  onMouseLeave={() => setHoveredFolder(null)}
                  aria-label={folder.name}
                  className={`py-2.5 px-3 lg:px-4 lg:py-3 rounded-full flex items-center transition-all duration-200 lg:mb-1 lg:w-full whitespace-nowrap ${
                    selectedFolder === folder.id
                      ? "bg-primaryContainer text-onPrimaryContainer shadow-sm"
                      : "text-onSurface hover:bg-surfaceVariant/50 active:scale-[0.98]"
                  }`}
                >
                  {/* Mobile : icône + label + badge inline */}
                  <div className="flex items-center gap-2 lg:hidden">
                    <folder.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-xs font-semibold">{folder.name}</span>
                    {folder.unread !== undefined && folder.unread > 0 && (
                      <span className="bg-error text-onError text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {folder.unread}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-onSurfaceVariant bg-surfaceVariant/50 px-1.5 py-0.5 rounded-full">
                      {folder.count}
                    </span>
                  </div>

                  {/* Desktop : icône + label + compteur */}
                  <div className="hidden lg:flex items-center justify-between w-full min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <folder.icon className="h-5 w-5 flex-shrink-0" />
                      <span className="truncate font-medium text-sm">
                        {folder.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {folder.unread !== undefined && folder.unread > 0 && (
                        <span className="bg-error text-onError text-xs font-bold px-2 py-0.5 rounded-full">
                          {folder.unread}
                        </span>
                      )}
                      <span className="text-xs text-onSurfaceVariant font-semibold">
                        {folder.count}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </nav>
      </div>

      {/* Liste des items */}
      <div
        className={`${
          showContent && "hidden lg:flex"
        } w-full lg:w-1/4 flex flex-col border-r border-outlineVariant bg-surface h-full overflow-hidden`}
      >
        <div className="p-4 border-b border-outlineVariant bg-surface z-10">
          <div className="flex items-center gap-3">
            {/* Checkbox "Tout sélectionner" style Dashboard */}
            <label
              className="cursor-pointer group flex-shrink-0 p-2 -m-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={
                  selectedItems.length === filteredItems.length &&
                  filteredItems.length > 0
                }
                onChange={handleSelectAllClick}
                className="sr-only peer"
                aria-label="Tout sélectionner"
              />
              <div
                className="
                 w-5 h-5
                 rounded-full border-2
                 bg-surface elevation-1
                 flex items-center justify-center
                 transition-all duration-200
                 peer-checked:bg-primary peer-checked:border-primary peer-checked:elevation-2
                 peer-focus:ring-2 peer-focus:ring-primary
                 group-hover:elevation-2 group-hover:scale-105
                 border-outlineVariant
               "
              >
                {selectedItems.length === filteredItems.length &&
                  filteredItems.length > 0 && (
                    <svg
                      className="w-2.5 h-2.5 text-onPrimary animate-expand"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
              </div>
            </label>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <h2 className="font-semibold text-onSurface truncate">
                  {folders.find((f) => f.id === selectedFolder)?.name || "Tous"}
                </h2>
                {selectedItems.length > 0 && (
                  <span className="text-xs text-onSurfaceVariant whitespace-nowrap">
                    ({selectedItems.length} sélectionné
                    {selectedItems.length > 1 ? "s" : ""})
                  </span>
                )}
              </div>
            </div>
            {/* Boutons d'action visibles si sélection */}
            {selectedItems.length > 0 && (
              <div className="flex items-center gap-2">
                {/* Bouton Marquer comme lu/non lu (uniquement pour les emails) */}
                {selectedItems.some((id) => {
                  const item = unifiedItems.find((i) => i.id === id);
                  return item?.type === "email";
                }) && (
                  <button
                    onClick={() => {
                      // Basculer l'état de tous les emails sélectionnés
                      const emailItems = selectedItems
                        .map((id) => unifiedItems.find((i) => i.id === id))
                        .filter(
                          (item): item is UnifiedItem => item?.type === "email"
                        );

                      if (emailItems.length === 0) return;

                      // Déterminer si on marque comme lu ou non lu (selon le premier)
                      const firstItem = emailItems[0];
                      const newReadStatus = !firstItem.read;

                      // Appliquer à tous les emails sélectionnés
                      Promise.all(
                        emailItems.map((item) =>
                          toggleEmailReadStatus(item.id, item.read)
                        )
                      ).then(() => {
                        // Mettre à jour l'UI
                        setUnifiedItems((prev) =>
                          prev.map((i) => {
                            if (emailItems.some((ei) => ei.id === i.id)) {
                              return { ...i, read: newReadStatus };
                            }
                            return i;
                          })
                        );
                        addToast(
                          newReadStatus
                            ? `${emailItems.length} email(s) marqué(s) comme lu`
                            : `${emailItems.length} email(s) marqué(s) comme non lu`,
                          "success"
                        );
                        window.dispatchEvent(new Event("storage_updated"));
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/10 transition-colors flex-shrink-0"
                    title="Marquer comme lu/non lu"
                  >
                    <MailOpen className="h-4 w-4" />
                    <span className="hidden sm:inline">Lu/Non lu</span>
                  </button>
                )}

                {/* Bouton Supprimer */}
                <button
                  onClick={handleRequestDelete}
                  className="inline-flex rounded-full items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-error border border-error hover:bg-error/10 transition-colors flex-shrink-0"
                  title={`Supprimer ${selectedItems.length} élément(s)`}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Supprimer</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-onSurfaceVariant">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun élément</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className={`w-full p-4 border-b border-outlineVariant/50 text-left hover:bg-surfaceVariant/50 transition-colors group relative ${
                  selectedItem?.id === item.id ? "bg-primaryContainer/20" : ""
                } ${
                  !item.read && item.type === "email"
                    ? "bg-surfaceVariant/20 border-l-[6px] border-l-primary"
                    : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox style Dashboard */}
                  <label
                    className="cursor-pointer group/checkbox animate-fade-in-scale flex-shrink-0 mt-0.5 p-2 -m-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleItemSelect(item.id)}
                      className="sr-only peer"
                      aria-label={`Sélectionner ${item.documentName}`}
                    />
                    <div
                      className="
                       w-4 h-4
                       rounded-full border-2
                       bg-surface elevation-1
                       flex items-center justify-center
                       transition-all duration-200
                       peer-checked:bg-primary peer-checked:border-primary peer-checked:elevation-2
                       peer-focus:ring-2 peer-focus:ring-primary
                       group-hover/checkbox:elevation-2 group-hover/checkbox:scale-105
                       border-outlineVariant
                     "
                    >
                      {selectedItems.includes(item.id) && (
                        <svg
                          className="w-2 h-2 text-onPrimary animate-expand"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </label>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      {item.type === "email" ? (
                        <Mail className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Send className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        {item.type === "email" ? (
                          <>
                            {/* Display sender information for received emails */}
                            {item.from && (
                              <p
                                className={`text-xs text-onSurfaceVariant mb-0.5 ${
                                  !item.read ? "font-semibold" : ""
                                }`}
                              >
                                {item.from}
                              </p>
                            )}
                            {/* Display recipient information for context */}
                            {item.recipientName && item.recipientEmail && (
                              <p
                                className={`text-xs text-onSurfaceVariant mb-0.5 ${
                                  !item.read ? "font-semibold" : ""
                                }`}
                              >
                                {item.recipientName} ({item.recipientEmail})
                              </p>
                            )}
                          </>
                        ) : (
                          // Display recipient information for sent documents
                          <>
                            {item.recipientName && item.recipientEmail && (
                              <p
                                className={`text-xs text-onSurfaceVariant mb-0.5`}
                              >
                                {item.recipientName} ({item.recipientEmail})
                              </p>
                            )}
                          </>
                        )}
                        <p
                          className={`text-sm truncate max-w-xs sm:max-w-sm md:max-w-md lg:max-w-md xl:max-w-lg 2xl:max-w-xl ${
                            !item.read && item.type === "email"
                              ? "font-bold"
                              : "font-medium"
                          }`}
                        >
                          {item.documentName}
                        </p>
                        <p
                          className={`text-xs text-onSurfaceVariant ${
                            !item.read && item.type === "email"
                              ? "font-medium"
                              : ""
                          }`}
                        >
                          {new Date(item.timestamp).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* Quick action buttons on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {/* Read/Unread toggle - only for emails */}
                    {item.type === "email" && (
                      <button
                        onClick={(e) => handleToggleReadStatus(item, e)}
                        className="p-2 rounded-lg hover:bg-surfaceVariant transition-colors"
                        title={
                          item.read
                            ? "Marquer comme non lu"
                            : "Marquer comme lu"
                        }
                        aria-label={
                          item.read
                            ? "Marquer comme non lu"
                            : "Marquer comme lu"
                        }
                      >
                        {item.read ? (
                          <Mail className="h-4 w-4 text-onSurfaceVariant" />
                        ) : (
                          <MailOpen className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    )}
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItems([item.id]);
                        setShowDeleteSnackbar(true);
                      }}
                      className="p-2 rounded-lg hover:bg-errorContainer/20 transition-colors"
                      title="Supprimer"
                      aria-label="Supprimer cet élément"
                    >
                      <Trash2 className="h-4 w-4 text-error" />
                    </button>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Détail view */}
      <div
        className={`${
          !showContent && "hidden lg:flex"
        } w-full lg:flex-1 flex flex-col bg-surface h-full overflow-hidden`}
      >
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
                    onClick={() => setPdfZoom((z) => Math.max(0.5, z - 0.1))}
                    className="p-2 rounded-lg hover:bg-surfaceVariant transition-colors"
                  >
                    <ZoomOut className="h-5 w-5" />
                  </button>
                  <span className="text-sm font-medium min-w-[50px] text-center">
                    {Math.round(pdfZoom * 100)}%
                  </span>
                  <button
                    onClick={() => setPdfZoom((z) => Math.min(1, z + 0.1))}
                    className="p-2 rounded-lg hover:bg-surfaceVariant transition-colors"
                  >
                    <ZoomIn className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            <div
              className="flex-1 overflow-y-auto bg-surfaceVariant/30"
              ref={viewerRef}
            >
              {pdfLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              ) : pdfDocument ? (
                <div className="flex flex-col items-center py-2 px-2">
                  {Array.from(new Array(pdfDocument.numPages), (_, index) => (
                    <div
                      key={`page-${index + 1}`}
                      className="bg-white rounded-lg shadow-lg overflow-hidden mb-3"
                    >
                      <PdfPageRenderer
                        pageNum={index + 1}
                        pdf={pdfDocument}
                        zoom={pdfZoom}
                        fields={envelope?.fields || []}
                        pageDimensions={pageDimensions[index]}
                      />
                    </div>
                  ))}
                </div>
              ) : selectedItem.type === "email" && selectedItem.body ? (
                <div className="flex flex-col h-full p-6">
                  <div className="bg-surface rounded-lg shadow-sm border border-outlineVariant p-6 max-w-3xl mx-auto w-full">
                    <div className="mb-4 pb-4 border-b border-outlineVariant">
                      <h3 className="text-lg font-semibold text-onSurface mb-2">
                        {selectedItem.title}
                      </h3>
                      {selectedItem.from && (
                        <p className="text-sm text-onSurfaceVariant">
                          De : {selectedItem.from}
                        </p>
                      )}
                      <p className="text-xs text-onSurfaceVariant mt-1">
                        {new Date(selectedItem.timestamp).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-onSurface font-sans bg-surfaceVariant/30 p-4 rounded-lg border border-outlineVariant">
                        {selectedItem.body}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-onSurfaceVariant px-4">
                  <FileText className="h-12 w-12 mb-4 opacity-30" />
                  <p className="text-sm">Aucun PDF à afficher</p>
                </div>
              )}
            </div>

            {/* Boutons d'action */}
            {(() => {
              // Ne pas afficher le bouton pour les emails de rejet (sans signatureLink ou avec sujet contenant "rejeté")
              const isRejectionEmail = selectedItem.type === "email" && 
                (!selectedItem.signatureLink || 
                 selectedItem.title?.includes("rejeté") || 
                 selectedItem.title?.includes("❌") ||
                 (selectedItem.rawData as MockEmail)?.subject?.includes("rejeté") ||
                 (selectedItem.rawData as MockEmail)?.subject?.includes("❌"));
              
              if (isRejectionEmail) {
                return null; // Pas de bouton pour les emails de rejet
              }
              
              return (
                <div className="p-4 border-t border-outlineVariant flex justify-end">
                  <button
                    onClick={handleSignClick}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] btn-premium-shine btn-premium-extended text-sm"
                  >
                    {selectedItem.type === "email" ? (
                      <>
                        <FileText className="h-5 w-5" />
                        Examiner & Signer
                      </>
                    ) : (
                      <>
                        <Eye className="h-5 w-5" />
                        Consulter
                      </>
                    )}
                  </button>
                </div>
              );
            })()}
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

      {/* Snackbar Material pour confirmation de suppression */}
      {showDeleteSnackbar && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-inverseSurface text-inverseOnSurface rounded-lg shadow-xl px-4 py-3 flex flex-col gap-3 min-w-[320px] max-w-[600px]">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Supprimer {selectedItems.length} élément
                  {selectedItems.length > 1 ? "s" : ""} ?
                </p>
                <div className="text-xs opacity-90 mt-2 space-y-1">
                  <p>
                    • <span className="font-semibold">Docs signés/rejetés</span>{" "}
                    : Suppression définitive (vous ET l'expéditeur)
                  </p>
                  <p>
                    • <span className="font-semibold">Docs en attente</span> :
                    Suppression locale uniquement
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleCancelDelete}
                  className="px-3 py-1.5 text-sm font-medium text-inversePrimary hover:bg-inverseSurface/80 rounded transition-colors whitespace-nowrap"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-3 py-1.5 text-sm font-bold text-inversePrimary hover:bg-inverseSurface/80 rounded transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              </div>
            </div>
            <div className="text-[10px] opacity-70 leading-tight">
              ⚠️ Conformité RGPD : Vérifiez vos obligations légales de
              conservation.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxPage;
