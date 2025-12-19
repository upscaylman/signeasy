import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckSquare,
  Info,
  Mail,
  Signature,
  Trash2,
  Type as TypeIcon,
  UserPlus,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import SignaturePadUnified from "../components/SignaturePadUnified";
import { useToast } from "../components/Toast";
import { useUser } from "../components/UserContext";
import { useDraftDocument } from "../hooks/useDraftDocument";
import { createEnvelope, getExistingRecipients } from "../services/firebaseApi";
import { Field, FieldType, Recipient } from "../types";
import { convertWordToPdf, isWordFile } from "../utils/wordToPdf";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

// Helper for converting data URL to a format PDF.js understands without fetching
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

// Helper for temporary IDs
let tempRecipientId = 0;

// Temporary recipient type for UI state
type TempRecipient = Omit<Recipient, "id"> & { id: number };
// Temporary field type for UI state
type TempField = Omit<Field, "id" | "recipientId"> & {
  tempRecipientId: number;
  color?: string;
  parapheGroupId?: string; // ID de groupe pour synchroniser les paraphes
  value?: string | boolean | null; // Permettre de pré-signer/pré-parapher
};

const SummaryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedRecipientIds: number[]) => void;
  documentName: string;
  recipients: TempRecipient[];
  emailMessage: string;
  setEmailMessage: (s: string) => void;
  creatorEmail: string;
  setCreatorEmail: (s: string) => void;
  isSubmitting: boolean;
}> = ({
  isOpen,
  onClose,
  onConfirm,
  documentName,
  recipients,
  emailMessage,
  setEmailMessage,
  creatorEmail,
  setCreatorEmail,
  isSubmitting,
}) => {
  const [selectedRecipients, setSelectedRecipients] = React.useState<number[]>(
    []
  );

  React.useEffect(() => {
    if (isOpen) {
      // Par défaut, sélectionner uniquement les destinataires valides (nom ET email remplis)
      setSelectedRecipients(
        recipients
          .filter((r) => r.name.trim() && r.email.trim())
          .map((r) => r.id)
      );
    }
  }, [isOpen, recipients]);

  if (!isOpen) return null;

  const toggleRecipient = (id: number) => {
    setSelectedRecipients((prev) =>
      prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id]
    );
  };

  const selectedCount = selectedRecipients.length;

  return (
    <div
      className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-[100] p-4 modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-modal-title"
    >
      <div
        className="bg-surface rounded-3xl shadow-xl w-full max-w-2xl modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-outlineVariant">
          <div className="flex justify-between items-center">
            <h2
              id="summary-modal-title"
              className="text-xl font-bold text-onSurface"
            >
              Confirmer et envoyer
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-surfaceVariant"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
          {/* Left side: recipients selection */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-onSurfaceVariant mb-3">
                DESTINATAIRES ({selectedCount}/
                {
                  recipients.filter((r) => r.name.trim() && r.email.trim())
                    .length
                }{" "}
                sélectionné
                {selectedCount > 1 ? "s" : ""})
              </h3>
              <ul className="space-y-2">
                {recipients
                  .filter((r) => r.name.trim() && r.email.trim())
                  .map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-outlineVariant hover:bg-surfaceVariant/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRecipients.includes(r.id)}
                        onChange={() => toggleRecipient(r.id)}
                        className="mt-1 h-4 w-4 accent-primary cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-onSurface">{r.name}</p>
                        <p className="text-sm text-onSurfaceVariant truncate">
                          {r.email}
                        </p>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          {/* Right side: recap and sender email */}
          <div className="space-y-4">
            <div className="p-4 bg-surfaceVariant/20 rounded-lg border border-outlineVariant">
              <h3 className="text-sm font-semibold text-onSurfaceVariant mb-2">
                DOCUMENT
              </h3>
              <p
                className="font-medium text-onSurface truncate"
                title={documentName}
              >
                {documentName}
              </p>
            </div>

            <div>
              <label
                htmlFor="creatorEmail"
                className="text-sm font-semibold text-onSurfaceVariant block mb-2"
              >
                Votre e-mail <span className="text-error">*</span>
              </label>
              <input
                id="creatorEmail"
                type="email"
                value={creatorEmail}
                onChange={(e) => setCreatorEmail(e.target.value)}
                className="w-full text-sm p-3 bg-surfaceVariant/60 border border-outlineVariant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary focus:bg-surface"
                placeholder="votre.email@exemple.com"
                required
              />
              <p className="text-xs text-onSurfaceVariant mt-2 flex items-center gap-1">
                <Mail className="h-4 w-4 flex-shrink-0" /> Vous recevrez une
                notification quand le document sera signé
              </p>
            </div>

            <div className="bg-primaryContainer/20 border border-primary/30 rounded-lg p-3">
              <p className="text-xs text-onSurfaceVariant mb-1 flex items-center gap-1">
                <Info className="h-4 w-4 flex-shrink-0" /> Information
              </p>
              <p className="text-xs text-onSurface">
                Les destinataires recevront automatiquement un email avec le
                lien pour signer.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center p-6 bg-surfaceVariant/30 rounded-b-3xl">
          <p className="text-sm text-onSurfaceVariant flex items-center gap-1">
            {selectedCount === 0 && (
              <>
                <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0" />{" "}
                Aucun destinataire sélectionné
              </>
            )}
            {!creatorEmail.trim() && selectedCount > 0 && (
              <>
                <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0" />{" "}
                Veuillez entrer votre e-mail
              </>
            )}
            {creatorEmail.trim() && selectedCount > 0 && (
              <>
                <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" />{" "}
                {selectedCount} email{selectedCount > 1 ? "s" : ""} sera
                {selectedCount > 1 ? "ont" : ""} envoyé
                {selectedCount > 1 ? "s" : ""}
              </>
            )}
          </p>
          <div className="flex space-x-3">
            <Button variant="text" onClick={onClose}>
              Annuler
            </Button>
            <button
              onClick={() => onConfirm(selectedRecipients)}
              disabled={
                isSubmitting || selectedCount === 0 || !creatorEmail.trim()
              }
              className="btn-premium-shine btn-premium-extended h-11 text-sm focus:outline-none focus:ring-4 focus:ring-primary/30 inline-flex items-center justify-center gap-2"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Envoi...</span>
                </>
              ) : (
                <span>Envoyer {selectedCount > 0 && `(${selectedCount})`}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FieldPropertiesPanel: React.FC<{
  field: TempField;
  recipient: TempRecipient | undefined;
  onUpdate: (field: TempField) => void;
  onBack: () => void;
  totalPages: number;
  onPlaceOnAllPages?: (field: TempField, fieldIndex: number) => void;
  fieldIndex?: number;
  onDrawSignature?: (field: TempField) => void;
}> = ({
  field,
  recipient,
  onUpdate,
  onBack,
  totalPages,
  onPlaceOnAllPages,
  fieldIndex,
  onDrawSignature,
}) => {
  const recipientColors = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
  ];
  const colors = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#71717A",
  ];

  const handleColorChange = (color: string) => {
    onUpdate({ ...field, color });
  };

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onUpdate({ ...field, [name]: Math.max(20, parseInt(value, 10) || 0) });
  };

  const currentColor =
    field.color ||
    (recipient
      ? recipientColors[recipient.id % recipientColors.length]
      : "#71717A");

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-surfaceVariant"
        >
          <ArrowLeft size={20} />
        </button>
        <h3 className="font-bold text-lg text-onSurface">
          Propriétés du champ
        </h3>
      </div>

      <div className="space-y-4 p-2">
        <div>
          <label className="text-sm font-medium text-onSurfaceVariant">
            Type
          </label>
          <p className="font-semibold text-onSurface">
            {field.type === FieldType.SIGNATURE &&
            field.signatureSubType === "initial"
              ? "Paraphe"
              : field.type}
          </p>
        </div>

        {/* Dropdown pour sous-type Signature */}
        {field.type === FieldType.SIGNATURE && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-onSurfaceVariant mb-2 block">
                Mode de signature
              </label>
              <select
                value={field.signatureSubType || "signature"}
                onChange={(e) => {
                  const newSubType = e.target.value as "signature" | "initial";
                  // Ajuster la taille selon le sous-type
                  const newWidth = newSubType === "initial" ? 82 : 160;
                  const newHeight = newSubType === "initial" ? 60 : 88;
                  onUpdate({
                    ...field,
                    signatureSubType: newSubType,
                    width: newWidth,
                    height: newHeight,
                  });
                }}
                className="w-full text-sm p-2 bg-surfaceVariant/60 border border-outlineVariant rounded-lg focus:ring-1 focus:ring-primary focus:border-primary focus:bg-surface"
              >
                <option value="signature">Signature (dessiner)</option>
                <option value="initial">Paraphe (dessiner)</option>
              </select>
            </div>

            {/* Option pour placer le paraphe sur toutes les pages */}
            {field.signatureSubType === "initial" && (
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!field.parapheGroupId}
                    onChange={(e) => {
                      if (
                        e.target.checked &&
                        onPlaceOnAllPages &&
                        fieldIndex !== undefined
                      ) {
                        // Générer un ID de groupe unique
                        const groupId = `paraphe-${Date.now()}-${Math.random()
                          .toString(36)
                          .substr(2, 9)}`;
                        onPlaceOnAllPages(
                          {
                            ...field,
                            parapheGroupId: groupId,
                          },
                          fieldIndex
                        );
                      } else {
                        onUpdate({
                          ...field,
                          parapheGroupId: undefined,
                        });
                      }
                    }}
                    className="w-5 h-5 accent-primary"
                  />
                  <span className="text-sm font-medium text-onSurface">
                    Placer sur toutes les pages
                  </span>
                </label>
                {field.parapheGroupId && (
                  <p className="text-xs text-onSurfaceVariant mt-1 ml-8">
                    Les paraphes de ce groupe seront synchronisés (jusqu'à
                    l'avant-dernière page)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-onSurfaceVariant">
            Destinataire
          </label>
          <p className="font-semibold text-onSurface">
            {recipient?.name || "Non assigné"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="width"
              className="text-sm font-medium text-onSurfaceVariant"
            >
              Largeur (px)
            </label>
            <input
              id="width"
              name="width"
              type="number"
              value={Math.round(field.width)}
              onChange={handleSizeChange}
              className="w-full text-sm p-2 bg-surfaceVariant/60 border border-outlineVariant rounded-lg mt-1 focus:ring-1 focus:ring-primary focus:border-primary focus:bg-surface"
            />
          </div>
          <div>
            <label
              htmlFor="height"
              className="text-sm font-medium text-onSurfaceVariant"
            >
              Hauteur (px)
            </label>
            <input
              id="height"
              name="height"
              type="number"
              value={Math.round(field.height)}
              onChange={handleSizeChange}
              className="w-full text-sm p-2 bg-surfaceVariant/60 border border-outlineVariant rounded-lg mt-1 focus:ring-1 focus:ring-primary focus:border-primary focus:bg-surface"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-onSurfaceVariant mb-2 block">
            Couleur
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {colors.map((c) => (
              <button
                key={c}
                aria-label={`Couleur ${c}`}
                onClick={() => handleColorChange(c)}
                className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 ${
                  currentColor === c
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-surface"
                    : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <button
              onClick={() => onUpdate({ ...field, color: undefined })}
              className="text-xs text-onSurfaceVariant hover:underline ml-auto"
            >
              Par défaut
            </button>
          </div>
        </div>

        {/* Bouton Dessiner pour Signature et Paraphe */}
        {field.type === FieldType.SIGNATURE && (
          <div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (
                  onDrawSignature &&
                  fieldIndex !== undefined &&
                  fieldIndex !== null
                ) {
                  onDrawSignature(field);
                }
              }}
              disabled={fieldIndex === undefined || fieldIndex === null}
              className={`w-full flex items-center justify-center gap-2 h-11 border-2 border-outline text-primary rounded-full hover:bg-surfaceVariant/50 transition-all focus:outline-none focus:ring-4 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
                fieldIndex !== undefined && fieldIndex !== null
                  ? ""
                  : "cursor-not-allowed"
              }`}
            >
              <Signature className="h-5 w-5 flex-shrink-0" />
              <span>
                {field.value
                  ? field.signatureSubType === "initial"
                    ? "Modifier le paraphe"
                    : "Modifier la signature"
                  : field.signatureSubType === "initial"
                  ? "Dessiner le paraphe"
                  : "Dessiner la signature"}
              </span>
            </button>
            {field.value && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({ ...field, value: null });
                }}
                className="mt-2 text-xs text-error hover:underline w-full text-center"
              >
                {field.signatureSubType === "initial"
                  ? "Supprimer le paraphe"
                  : "Supprimer la signature"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const PrepareDocumentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const { currentUser } = useUser();
  const { drafts, getDraft, saveDraft, updateDraftData, deleteDraft } = useDraftDocument();

  // State
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageDimensions, setPageDimensions] = useState<
    { width: number; height: number }[]
  >([]);
  const [totalPages, setTotalPages] = useState(0);

  const [recipients, setRecipients] = useState<TempRecipient[]>([]);
  const [fields, setFields] = useState<TempField[]>([]);

  const [activeRecipientId, setActiveRecipientId] = useState<number | null>(
    null
  );
  const [selectedFieldType, setSelectedFieldType] = useState<FieldType | null>(
    null
  );
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(
    null
  );

  // 📱 Zoom adaptatif : 0.5 sur mobile, 0.75 sur tablette, 1 sur desktop
  const getInitialZoom = () => {
    const width = window.innerWidth;
    if (width < 640) return 0.5; // mobile
    if (width < 1024) return 0.75; // tablette
    return 1; // desktop
  };
  const [zoomLevel, setZoomLevel] = useState(getInitialZoom());
  const [currentPage, setCurrentPage] = useState(1);
  const [goToPageInput, setGoToPageInput] = useState("1");

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldToSign, setFieldToSign] = useState<TempField | null>(null);
  const [hasCheckedInitialLoad, setHasCheckedInitialLoad] = useState(false);

  const viewerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [editingField, setEditingField] = useState<{
    index: number;
    action: "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se";
  } | null>(null);
  const [initialDragPosition, setInitialDragPosition] = useState<{
    mouseX: number;
    mouseY: number;
    fieldX: number;
    fieldY: number;
    fieldW: number;
    fieldH: number;
    groupFieldsInitialPositions?: Array<{
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  } | null>(null);

  // Modal and email content state
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [creatorEmail, setCreatorEmail] = useState(""); // Email de l'expéditeur

  // 📱 Mobile drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const [existingRecipients, setExistingRecipients] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [isLoadingExisting, setIsLoadingExistingRecipients] = useState(false);

  const recipientColors = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
  ];

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedFieldType(null);
        setSelectedFieldIndex(null);
        setIsSummaryModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Désactiver le scroll de la page
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Timeout pour rediriger vers le dashboard si aucun fichier n'est chargé après 5 secondes
  useEffect(() => {
    if (!file) {
      const timeout = setTimeout(() => {
        addToast("Redirection vers le tableau de bord", "info");
        navigate("/dashboard");
      }, 5000); // 5 secondes

      return () => clearTimeout(timeout);
    }
  }, [file, navigate, addToast]);

  // --- Initialiser l'email du créateur avec l'utilisateur connecté ---
  useEffect(() => {
    if (currentUser?.email && !creatorEmail) {
      setCreatorEmail(currentUser.email);
    }
  }, [currentUser?.email]);

  // --- Charger les destinataires existants ---
  useEffect(() => {
    const loadExistingRecipients = async () => {
      if (currentUser?.email) {
        setIsLoadingExistingRecipients(true);
        try {
          const existing = await getExistingRecipients(currentUser.email);
          setExistingRecipients(existing);
        } catch (error) {
          console.error(
            "Erreur lors du chargement des destinataires existants:",
            error
          );
        } finally {
          setIsLoadingExistingRecipients(false);
        }
      }
    };
    loadExistingRecipients();
  }, [currentUser?.email]);

  const resetState = () => {
    setFile(null);
    setFileBase64("");
    setPdf(null);
    setPageDimensions([]);
    setTotalPages(0);
    setRecipients([]);
    setFields([]);
    setActiveRecipientId(null);
    setSelectedFieldType(null);
  };

  // --- File Handling ---
  // Fonction pour charger un fichier PDF ou Word
  const loadPdfFile = async (selectedFile: File) => {
    let fileToProcess = selectedFile;

    // Vérifier si c'est un fichier Word et le convertir
    if (isWordFile(selectedFile)) {
      addToast("Conversion Word → PDF en cours...", "info");
      try {
        fileToProcess = await convertWordToPdf(selectedFile);
        addToast("✅ Conversion réussie !", "success");
      } catch (error) {
        console.error("Erreur de conversion:", error);
        addToast(
          "Échec de la conversion. Veuillez exporter votre document en PDF depuis Word.",
          "error"
        );
        return;
      }
    }

    if (fileToProcess && fileToProcess.type === "application/pdf") {
      setIsProcessing(true);
      setFile(fileToProcess);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setFileBase64(base64);

        try {
          const pdfData = base64ToUint8Array(base64);
          const loadingTask = pdfjsLib.getDocument({ data: pdfData });
          const loadedPdf = await loadingTask.promise;
          setPdf(loadedPdf);
          setTotalPages(loadedPdf.numPages);

          const dimensions = [];
          for (let i = 1; i <= loadedPdf.numPages; i++) {
            const page = await loadedPdf.getPage(i);
            const viewport = page.getViewport({ scale: 1 });
            dimensions.push({ width: viewport.width, height: viewport.height });
          }
          setPageDimensions(dimensions);

          addRecipient();

          // 💾 Sauvegarder automatiquement le brouillon
          const draftId = saveDraft(base64, fileToProcess.name);
          if (draftId) {
            setCurrentDraftId(draftId);
          }
        } catch (error) {
          addToast(
            "Erreur lors du chargement du PDF. Le fichier est peut-être corrompu.",
            "error"
          );
          console.error(error);
          resetState();
        } finally {
          setIsProcessing(false);
        }
      };
      reader.onerror = () => {
        addToast("Erreur de lecture du fichier.", "error");
        setIsProcessing(false);
      };
      reader.readAsDataURL(fileToProcess);
    } else {
      addToast(
        "Veuillez sélectionner un fichier PDF ou Word (.doc, .docx).",
        "info"
      );
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      loadPdfFile(selectedFile);
    }
  };

  // Fonction helper pour charger un brouillon avec tous ses champs et destinataires
  const loadDraftWithData = useCallback(async (draft: ReturnType<typeof getDraft>) => {
    if (!draft) return;

    setCurrentDraftId(draft.id);
    
    try {
      const res = await fetch(draft.pdfData);
      const blob = await res.blob();
      const draftFile = new File([blob], draft.fileName, {
        type: "application/pdf",
      });
      await loadPdfFile(draftFile);

      // Restaurer les destinataires si présents
      if (draft.recipients && draft.recipients.length > 0) {
        setRecipients(draft.recipients);
        // Mettre à jour le compteur pour éviter les conflits d'ID
        const maxId = Math.max(...draft.recipients.map(r => r.id), 0);
        tempRecipientId = maxId + 1;
        console.log("📥 Destinataires restaurés:", draft.recipients.length);
      }

      // Restaurer les champs si présents
      if (draft.fields && draft.fields.length > 0) {
        setFields(draft.fields as TempField[]);
        console.log("📥 Champs restaurés:", draft.fields.length);
      }

      // Restaurer le destinataire actif
      if (draft.activeRecipientId !== undefined) {
        setActiveRecipientId(draft.activeRecipientId);
      }
    } catch (err) {
      console.error("Erreur lors du chargement du brouillon:", err);
      addToast("Erreur lors du chargement du brouillon.", "error");
    }
  }, [loadPdfFile, addToast]);

  // Charger automatiquement le fichier depuis le Dashboard ou depuis le brouillon
  useEffect(() => {
    const pdfData = (location.state as any)?.pdfData;
    const fileName = (location.state as any)?.fileName;
    const draftId = (location.state as any)?.draftId;

    if (pdfData && fileName) {
      // Convertir le base64 en File object depuis location.state
      fetch(pdfData)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], fileName, { type: "application/pdf" });
          loadPdfFile(file);
        })
        .catch((err) => {
          console.error("Erreur lors du chargement du fichier:", err);
          addToast("Erreur lors du chargement du fichier.", "error");
        });

      // Nettoyer le state pour éviter de recharger à chaque render
      navigate(location.pathname, { replace: true, state: {} });
    } else if (draftId && !file) {
      // Charger un brouillon spécifique via son ID avec tous ses champs
      const specificDraft = getDraft(draftId);
      if (specificDraft) {
        loadDraftWithData(specificDraft);
      }
      // Nettoyer le state
      navigate(location.pathname, { replace: true, state: {} });
    } else if (drafts.length === 1 && !file) {
      // Si un seul brouillon existe et pas de fichier chargé, le charger automatiquement
      const singleDraft = drafts[0];
      loadDraftWithData(singleDraft);
    }
  }, [drafts, file, location.state, navigate, addToast, getDraft, loadPdfFile, loadDraftWithData]);

  // Redirection vers le dashboard uniquement après le chargement initial et si vraiment vide
  useEffect(() => {
    // Attendre un peu pour laisser le temps aux autres useEffect de s'exécuter
    const timer = setTimeout(() => {
      const pdfData = (location.state as any)?.pdfData;
      const draftId = (location.state as any)?.draftId;

      // Vérifier si vraiment aucun document n'est disponible
      // Ne rediriger que si :
      // 1. Pas de pdfData dans location.state
      // 2. Pas de draftId dans location.state
      // 3. Aucun brouillon disponible
      // 4. Aucun fichier chargé
      // 5. Pas en cours de traitement
      // 6. On est toujours sur la page /prepare (pas déjà redirigé)
      if (
        !pdfData &&
        !draftId &&
        drafts.length === 0 &&
        !file &&
        !isProcessing &&
        window.location.pathname === "/prepare"
      ) {
        addToast(
          "Veuillez sélectionner un document depuis le tableau de bord",
          "info"
        );
        navigate("/dashboard", { replace: true });
      }
    }, 1000); // Délai de 1 seconde pour laisser le temps aux autres opérations

    return () => clearTimeout(timer);
  }, [drafts.length, file, isProcessing, location.state, navigate, addToast]);

  // 💾 Sauvegarde automatique des champs et destinataires dans le brouillon
  useEffect(() => {
    // Ne pas sauvegarder si pas de brouillon actif ou pas de PDF chargé
    if (!currentDraftId || !fileBase64) return;

    // Debounce pour éviter trop de sauvegardes
    const saveTimer = setTimeout(() => {
      updateDraftData(currentDraftId, {
        recipients: recipients,
        fields: fields.map(f => ({
          type: f.type,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          tempRecipientId: f.tempRecipientId,
          color: f.color,
          parapheGroupId: f.parapheGroupId,
          value: f.value,
          signatureSubType: f.signatureSubType,
          textOptions: f.textOptions,
        })),
        activeRecipientId: activeRecipientId,
      });
    }, 500); // Délai de 500ms pour éviter trop de sauvegardes

    return () => clearTimeout(saveTimer);
  }, [recipients, fields, activeRecipientId, currentDraftId, fileBase64, updateDraftData]);

  // --- Recipient Management ---
  const addRecipient = () => {
    const newId = tempRecipientId++;
    const newRecipient: TempRecipient = {
      id: newId,
      name: "", // Nom vide par défaut pour forcer l'utilisateur à le remplir
      email: "",
      signingOrder: recipients.length + 1,
    };
    setRecipients([...recipients, newRecipient]);
    if (activeRecipientId === null) {
      setActiveRecipientId(newRecipient.id);
    }
  };

  const addExistingRecipient = (existingRecipient: {
    id: string;
    name: string;
    email: string;
  }) => {
    // Vérifier qu'il n'existe pas déjà dans la liste
    const alreadyExists = recipients.some(
      (r) => r.email.toLowerCase() === existingRecipient.email.toLowerCase()
    );
    if (alreadyExists) {
      addToast(
        `${existingRecipient.name} est déjà dans la liste des destinataires.`,
        "info"
      );
      return;
    }

    // Chercher le DERNIER slot libre (pas le premier)
    let targetIndex =
      recipients.length > 0
        ? Math.max(...recipients.map((r) => r.signingOrder)) + 1
        : 1;

    const newId = tempRecipientId++;
    const newRecipient: TempRecipient = {
      id: newId,
      name: existingRecipient.name,
      email: existingRecipient.email,
      signingOrder: targetIndex,
    };
    setRecipients([...recipients, newRecipient]);
    addToast(
      `${existingRecipient.name} a été ajouté en tant que Destinataire ${targetIndex}.`,
      "success"
    );
  };

  const updateRecipient = (
    id: number,
    field: "name" | "email",
    value: string
  ) => {
    setRecipients(
      recipients.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const removeRecipient = (id: number) => {
    if (
      selectedFieldIndex !== null &&
      fields[selectedFieldIndex]?.tempRecipientId === id
    ) {
      setSelectedFieldIndex(null);
    }
    setRecipients(recipients.filter((r) => r.id !== id));
    setFields(fields.filter((f) => f.tempRecipientId !== id));
    if (activeRecipientId === id) {
      setActiveRecipientId(
        recipients.length > 1 ? recipients.find((r) => r.id !== id)!.id : null
      );
    }
  };

  // --- Field Placement ---
  const handlePageClick = (
    e: React.MouseEvent<HTMLDivElement>,
    pageNum: number
  ) => {
    if (!selectedFieldType || activeRecipientId === null) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;

    const newField: TempField = {
      type: selectedFieldType,
      page: pageNum,
      x,
      y,
      width:
        selectedFieldType === FieldType.CHECKBOX
          ? 80
          : selectedFieldType === FieldType.DATE
          ? 86
          : selectedFieldType === FieldType.SIGNATURE ||
            selectedFieldType === FieldType.INITIAL
          ? 160
          : 110,
      height:
        selectedFieldType === FieldType.CHECKBOX
          ? 50
          : selectedFieldType === FieldType.DATE
          ? 50
          : selectedFieldType === FieldType.SIGNATURE ||
            selectedFieldType === FieldType.INITIAL
          ? 88
          : 50,
      tempRecipientId: activeRecipientId,
      // Définir signatureSubType par défaut pour les champs SIGNATURE
      ...(selectedFieldType === FieldType.SIGNATURE && {
        signatureSubType: "signature" as const,
      }),
    };
    const newFields = [...fields, newField];
    setFields(newFields);
    setSelectedFieldIndex(newFields.length - 1);
    setSelectedFieldType(null); // Deselect tool after placing
  };

  const handleFieldTypeSelect = (type: FieldType) => {
    setSelectedFieldIndex(null);
    setSelectedFieldType((prev) => (prev === type ? null : type));
  };

  const removeField = (fieldIndex: number) => {
    if (selectedFieldIndex === fieldIndex) {
      setSelectedFieldIndex(null);
    }
    // Supprimer uniquement le champ sélectionné, même s'il fait partie d'un groupe
    // Permet la suppression indépendante des paraphes groupés
    setFields(fields.filter((_, i) => i !== fieldIndex));
  };

  // Fonction pour placer un paraphe sur toutes les pages (jusqu'à l'avant-dernière page)
  const handlePlaceOnAllPages = (
    field: TempField,
    originalFieldIndex: number
  ) => {
    if (!field.parapheGroupId || field.signatureSubType !== "initial") return;

    const groupId = field.parapheGroupId;

    setFields((prevFields) => {
      // Supprimer le champ original par son index ET tous les autres champs du groupe pour éviter les doublons
      const otherFields = prevFields.filter(
        (f, index) =>
          index !== originalFieldIndex &&
          !(f.parapheGroupId === groupId && f.signatureSubType === "initial")
      );

      // Créer les nouveaux champs jusqu'à l'avant-dernière page (pas la dernière)
      const newFields: TempField[] = [];
      const lastPage = totalPages - 1; // Jusqu'à l'avant-dernière page
      for (let page = 1; page <= lastPage; page++) {
        newFields.push({
          ...field,
          page,
        });
      }

      const updatedFields = [...otherFields, ...newFields];

      // Sélectionner le premier champ du groupe (page 1) après la mise à jour
      const firstFieldIndex = updatedFields.findIndex(
        (f) =>
          f.parapheGroupId === groupId &&
          f.signatureSubType === "initial" &&
          f.page === 1
      );
      if (firstFieldIndex !== -1) {
        setTimeout(() => setSelectedFieldIndex(firstFieldIndex), 0);
      }

      return updatedFields;
    });
  };

  // Fonction pour gérer le dessin de signature/paraphe
  const handleDrawSignature = (field: TempField) => {
    setFieldToSign(field);
  };

  const handleSaveSignature = (dataUrl: string) => {
    if (fieldToSign) {
      setFields((prevFields) => {
        // Utiliser selectedFieldIndex si disponible, sinon chercher le champ
        let fieldIndex = selectedFieldIndex;

        if (fieldIndex === null || fieldIndex === undefined) {
          // Trouver l'index du champ à mettre à jour
          fieldIndex = prevFields.findIndex(
            (f) =>
              f.type === fieldToSign.type &&
              f.page === fieldToSign.page &&
              f.x === fieldToSign.x &&
              f.y === fieldToSign.y &&
              f.tempRecipientId === fieldToSign.tempRecipientId
          );
        }

        if (fieldIndex !== -1 && fieldIndex < prevFields.length) {
          // Si c'est un paraphe avec un groupe, appliquer la signature à tous les paraphes du groupe
          const groupId = prevFields[fieldIndex].parapheGroupId;
          if (
            groupId &&
            prevFields[fieldIndex].signatureSubType === "initial"
          ) {
            return prevFields.map((f) =>
              f.parapheGroupId === groupId && f.signatureSubType === "initial"
                ? { ...f, value: dataUrl }
                : f
            );
          } else {
            // Sinon, mettre à jour uniquement ce champ
            return prevFields.map((f, i) =>
              i === fieldIndex ? { ...f, value: dataUrl } : f
            );
          }
        }
        return prevFields;
      });
      setFieldToSign(null);
      addToast("Signature/paraphe enregistré", "success");
    }
  };

  const handleCancelSignature = () => {
    setFieldToSign(null);
  };

  // --- Field Drag & Resize ---
  const handleFieldMouseDown = (
    e: React.MouseEvent | React.TouchEvent,
    index: number,
    action: "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFieldIndex(index);
    setEditingField({ index, action });
    const field = fields[index];

    // 🔧 FIX MOBILE : Gérer les événements touch
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    // Stocker aussi les positions et dimensions initiales de tous les paraphes du groupe pour la synchronisation
    const groupId = field.parapheGroupId;
    const groupFields =
      groupId && field.signatureSubType === "initial"
        ? fields.filter(
            (f) =>
              f.parapheGroupId === groupId && f.signatureSubType === "initial"
          )
        : [field];

    // Utiliser page comme identifiant unique au lieu de l'index (plus fiable)
    setInitialDragPosition({
      mouseX: clientX,
      mouseY: clientY,
      fieldX: field.x,
      fieldY: field.y,
      fieldW: field.width,
      fieldH: field.height,
      groupFieldsInitialPositions: groupFields.map((f) => ({
        page: f.page, // Utiliser page comme identifiant
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
      })),
    });
  };

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!editingField || !initialDragPosition) return;

    // 🔧 FIX MOBILE : Gérer les événements touch
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const dx = (clientX - initialDragPosition.mouseX) / zoomLevel;
    const dy = (clientY - initialDragPosition.mouseY) / zoomLevel;

    setFields((currentFields) => {
      // Vérifier que l'index est toujours valide
      if (editingField.index >= currentFields.length) {
        return currentFields;
      }

      const movedField = currentFields[editingField.index];
      if (!movedField) return currentFields;

      const groupId = movedField?.parapheGroupId;

      if (editingField.action === "move") {
        const newX = initialDragPosition.fieldX + dx;
        const newY = initialDragPosition.fieldY + dy;

        // Si c'est un paraphe avec un groupe, synchroniser tous les paraphes du groupe
        if (
          groupId &&
          movedField.signatureSubType === "initial" &&
          initialDragPosition.groupFieldsInitialPositions
        ) {
          // Calculer le déplacement relatif depuis la position initiale du champ déplacé
          const relativeDx = newX - initialDragPosition.fieldX;
          const relativeDy = newY - initialDragPosition.fieldY;

          // Appliquer le déplacement à tous les paraphes du même groupe en utilisant leurs positions initiales
          return currentFields.map((field, index) => {
            if (index === editingField.index) {
              return {
                ...field,
                x: newX,
                y: newY,
              };
            } else {
              // Trouver la position initiale de ce champ dans le groupe par sa page
              const initialPos =
                initialDragPosition.groupFieldsInitialPositions?.find(
                  (p) => p.page === field.page
                );
              if (
                initialPos &&
                field.parapheGroupId === groupId &&
                field.signatureSubType === "initial"
              ) {
                return {
                  ...field,
                  x: initialPos.x + relativeDx,
                  y: initialPos.y + relativeDy,
                };
              }
            }
            return field;
          });
        }

        // Déplacement normal sans synchronisation
        return currentFields.map((field, index) => {
          if (index === editingField.index) {
            return {
              ...field,
              x: newX,
              y: newY,
            };
          }
          return field;
        });
      } else if (editingField.action.startsWith("resize-")) {
        let newWidth = initialDragPosition.fieldW;
        let newHeight = initialDragPosition.fieldH;
        let newX = initialDragPosition.fieldX;
        let newY = initialDragPosition.fieldY;

        // Calculer les nouvelles dimensions selon la direction
        switch (editingField.action) {
          case "resize-se": // Bas-droite
            newWidth = Math.max(20, initialDragPosition.fieldW + dx);
            newHeight = Math.max(20, initialDragPosition.fieldH + dy);
            break;
          case "resize-sw": // Bas-gauche
            newWidth = Math.max(20, initialDragPosition.fieldW - dx);
            newHeight = Math.max(20, initialDragPosition.fieldH + dy);
            newX =
              initialDragPosition.fieldX +
              (initialDragPosition.fieldW - newWidth);
            break;
          case "resize-ne": // Haut-droite
            newWidth = Math.max(20, initialDragPosition.fieldW + dx);
            newHeight = Math.max(20, initialDragPosition.fieldH - dy);
            newY =
              initialDragPosition.fieldY +
              (initialDragPosition.fieldH - newHeight);
            break;
          case "resize-nw": // Haut-gauche
            newWidth = Math.max(20, initialDragPosition.fieldW - dx);
            newHeight = Math.max(20, initialDragPosition.fieldH - dy);
            newX =
              initialDragPosition.fieldX +
              (initialDragPosition.fieldW - newWidth);
            newY =
              initialDragPosition.fieldY +
              (initialDragPosition.fieldH - newHeight);
            break;
        }

        // Si c'est un paraphe avec un groupe, synchroniser le redimensionnement de tous les paraphes du groupe
        if (
          groupId &&
          movedField.signatureSubType === "initial" &&
          initialDragPosition.groupFieldsInitialPositions
        ) {
          // Calculer le facteur de redimensionnement
          const scaleX = newWidth / initialDragPosition.fieldW;
          const scaleY = newHeight / initialDragPosition.fieldH;
          const offsetX = newX - initialDragPosition.fieldX;
          const offsetY = newY - initialDragPosition.fieldY;

          // Appliquer le redimensionnement à tous les paraphes du même groupe
          return currentFields.map((field, index) => {
            if (index === editingField.index) {
              return {
                ...field,
                width: newWidth,
                height: newHeight,
                x: newX,
                y: newY,
              };
            } else {
              // Trouver les dimensions initiales de ce champ dans le groupe par sa page
              const initialPos =
                initialDragPosition.groupFieldsInitialPositions?.find(
                  (p) => p.page === field.page
                );
              if (
                initialPos &&
                field.parapheGroupId === groupId &&
                field.signatureSubType === "initial"
              ) {
                return {
                  ...field,
                  width: Math.max(20, initialPos.width * scaleX),
                  height: Math.max(20, initialPos.height * scaleY),
                  x: initialPos.x + offsetX,
                  y: initialPos.y + offsetY,
                };
              }
            }
            return field;
          });
        }

        // Redimensionnement normal sans synchronisation
        return currentFields.map((field, index) => {
          if (index === editingField.index) {
            return {
              ...field,
              width: newWidth,
              height: newHeight,
              x: newX,
              y: newY,
            };
          }
          return field;
        });
      }

      return currentFields;
    });
  };

  const handleMouseUp = (e?: MouseEvent | TouchEvent) => {
    setEditingField(null);
    setInitialDragPosition(null);
  };

  useEffect(() => {
    if (editingField) {
      // Ajouter les événements pour souris et tactile
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleMouseMove, { passive: false });
      window.addEventListener("touchend", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchmove", handleMouseMove);
        window.removeEventListener("touchend", handleMouseUp);
      };
    }
  }, [editingField, initialDragPosition, zoomLevel]);

  // --- Submission ---
  const sendEmailNotification = async (
    recipient: Recipient,
    token: string,
    documentName: string,
    message: string
  ) => {
    // @ts-ignore - emailjs is loaded from a script tag in index.html
    if (typeof emailjs === "undefined") {
      console.error("EmailJS SDK n'est pas chargé.");
      addToast("Le service d'envoi d'e-mails n'est pas disponible.", "error");
      return { success: false, error: new Error("EmailJS SDK not loaded") };
    }

    const SERVICES = [
      { id: "service_ltiackr", name: "Outlook" }, // ✅ Outlook en priorité
      { id: "service_tcdw2fd", name: "Gmail" }, // Fallback sur Gmail
    ];
    const TEMPLATE_ID = "template_6m6pxue"; // Template pour demande de signature
    const PUBLIC_KEY = "g2n34kxUJPlU6tsI0";

    // Générer le sujet automatiquement
    const subject = `Demande de signature : ${documentName}`;

    const templateParams = {
      recipient_name: recipient.name,
      recipient_email: recipient.email,
      document_name: documentName,
      signature_link: `${window.location.origin}${window.location.pathname}#/sign/${token}`,
      email_subject: subject,
      custom_message: message,
    };

    // Essayer d'envoyer via Gmail d'abord, fallback sur Outlook
    for (const service of SERVICES) {
      try {
        // @ts-ignore
        await emailjs.send(service.id, TEMPLATE_ID, templateParams, PUBLIC_KEY);
        console.log(`✅ Email envoyé via ${service.name} à:`, recipient.email);
        return { success: true };
      } catch (error) {
        console.warn(
          `⚠️ Tentative via ${service.name} échouée à ${recipient.email}:`,
          error
        );
        // Continuer avec le service suivant
      }
    }

    // Si tous les services ont échoué
    console.error(
      `❌ Échec d'envoi via TOUS les services à: ${recipient.email}`
    );
    return { success: false, error: new Error("All services failed") };
  };

  const handleConfirmSend = async (selectedRecipientIds: number[]) => {
    // Validation de l'email de l'expéditeur
    if (!creatorEmail.trim()) {
      addToast("Veuillez entrer votre adresse e-mail.", "error");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(creatorEmail)) {
      addToast("Veuillez entrer une adresse e-mail valide.", "error");
      return;
    }

    setIsSummaryModalOpen(false);
    setIsSubmitting(true);
    try {
      // Filtrer les destinataires sélectionnés
      const selectedRecipients = recipients.filter((r) =>
        selectedRecipientIds.includes(r.id)
      );

      // Filtrer les champs pour ne garder que ceux des destinataires sélectionnés
      const selectedFields = fields.filter((f) =>
        selectedRecipientIds.includes(f.tempRecipientId)
      );

      const { envelope, tokens } = await createEnvelope(
        { name: file!.name, base64: fileBase64, totalPages },
        selectedRecipients,
        selectedFields,
        creatorEmail // ✅ Passer l'email de l'expéditeur
      );

      const emailPromises = envelope.recipients.map((recipient) => {
        const tokenInfo = tokens.find((t) => t.recipientId === recipient.id);
        return tokenInfo
          ? sendEmailNotification(
              recipient,
              tokenInfo.token,
              envelope.document.name,
              emailMessage
            )
          : Promise.resolve({ success: false });
      });

      const emailResults = await Promise.all(emailPromises);
      const failedEmails = emailResults
        .map((r, i) => (!r.success ? envelope.recipients[i].name : null))
        .filter(Boolean);

      if (failedEmails.length > 0) {
        addToast(
          `Document envoyé, mais l'e-mail n'a pas pu être envoyé à : ${failedEmails.join(
            ", "
          )}.`,
          "error"
        );
      } else {
        addToast(
          `Document et ${selectedRecipients.length} e-mail${
            selectedRecipients.length > 1 ? "s" : ""
          } envoyé${selectedRecipients.length > 1 ? "s" : ""} avec succès !`,
          "success"
        );
      }

      // 🗑️ Supprimer le brouillon après envoi réussi
      if (currentDraftId) {
        deleteDraft(currentDraftId);
      }

      navigate("/dashboard");
    } catch (error) {
      addToast("Erreur lors de la création de l'enveloppe.", "error");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSend = () => {
    if (!file || !fileBase64) {
      addToast("Veuillez charger un document.", "error");
      return;
    }

    // Filtrer les destinataires valides (nom ET email remplis)
    const validRecipients = recipients.filter(
      (r) => r.name.trim() && r.email.trim()
    );

    if (validRecipients.length === 0) {
      addToast(
        "Veuillez ajouter au moins un destinataire avec nom et email.",
        "error"
      );
      return;
    }

    // Valider le format email des destinataires valides
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const recipient of validRecipients) {
      if (!emailRegex.test(recipient.email)) {
        addToast(
          `L'adresse e-mail "${recipient.email}" pour ${recipient.name} semble invalide.`,
          "error"
        );
        return;
      }
    }

    if (fields.filter((f) => f.type === FieldType.SIGNATURE).length === 0) {
      addToast("Veuillez ajouter au moins un champ de signature.", "error");
      return;
    }

    setEmailMessage(
      `Bonjour,

Veuillez examiner et signer le document "${file.name}".

Cordialement.`
    );
    setIsSummaryModalOpen(true);
  };

  useEffect(() => {
    if (!viewerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visiblePage = entries.find((entry) => entry.isIntersecting);
        if (visiblePage) {
          const pageNum = parseInt(
            visiblePage.target.getAttribute("data-page-number") || "1",
            10
          );
          setCurrentPage(pageNum);
          setGoToPageInput(String(pageNum));
        }
      },
      { threshold: 0.5, root: viewerRef.current }
    );
    pageRefs.current.forEach((ref) => ref && observer.observe(ref));
    return () => observer.disconnect();
  }, [totalPages, pageDimensions]);

  const handleGoToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(goToPageInput, 10);
    if (pdf && pageNum >= 1 && pageNum <= pdf.numPages) {
      pageRefs.current[pageNum - 1]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else {
      addToast(
        `Veuillez entrer un numéro de page valide (1-${pdf?.numPages}).`,
        "error"
      );
    }
  };

  const PdfPageRenderer = useCallback(
    ({ pageNum, currentZoom }: { pageNum: number; currentZoom: number }) => {
      const canvasRef = useRef<HTMLCanvasElement>(null);
      const renderTaskRef = useRef<any>(null);
      const isMountedRef = useRef(true);

      useEffect(() => {
        if (!pdf) return;

        isMountedRef.current = true;

        // Annuler le rendu précédent s'il existe
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {
            // Ignorer les erreurs d'annulation
          }
          renderTaskRef.current = null;
        }

        const renderPage = async () => {
          try {
            const page = await pdf.getPage(pageNum);

            if (!isMountedRef.current) return;

            const viewport = page.getViewport({ scale: currentZoom });
            const canvas = canvasRef.current;

            if (canvas && isMountedRef.current) {
              const context = canvas.getContext("2d");
              if (context) {
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                renderTaskRef.current = page.render({
                  canvasContext: context,
                  viewport,
                });

                // Attendre la fin du rendu
                await renderTaskRef.current.promise;
                renderTaskRef.current = null;
              }
            }
          } catch (err: any) {
            // Ignorer les erreurs d'annulation
            if (err?.name !== "RenderingCancelledException") {
              console.error("Erreur rendu PDF:", err);
            }
          }
        };

        renderPage();

        // Cleanup : annuler le rendu au démontage
        return () => {
          isMountedRef.current = false;
          if (renderTaskRef.current) {
            try {
              renderTaskRef.current.cancel();
            } catch (e) {
              // Ignorer les erreurs
            }
            renderTaskRef.current = null;
          }
        };
      }, [pdf, pageNum, currentZoom]);

      return <canvas ref={canvasRef} />;
    },
    [pdf]
  );

  // Fonction helper pour convertir une couleur hex en rgba avec opacité
  const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const renderField = (field: TempField, index: number) => {
    const isSelected = selectedFieldIndex === index;
    const recipient = recipients.find((r) => r.id === field.tempRecipientId);
    const color =
      field.color ||
      (recipient
        ? recipientColors[recipient.id % recipientColors.length]
        : "#71717A");

    // Déterminer le label et l'icône selon le type et sous-type
    const isParaphe =
      field.type === FieldType.SIGNATURE &&
      field.signatureSubType === "initial";
    const displayLabel = isParaphe ? "Paraphe" : field.type;
    const Icon = Signature; // Utiliser Signature pour les deux cas

    // Afficher la signature/paraphe si elle existe
    const hasSignature = field.value && typeof field.value === "string";

    // Style pour le conteneur interne (contenu avec bordure colorée)
    const innerStyle: React.CSSProperties = {
      width: "100%",
      height: "100%",
      border: `2px solid ${color}`,
      backgroundColor: `${color}20`,
      cursor: "move",
    };

    // Style pour le conteneur externe (avec bordure colorée en hover/sélection avec 50% opacité)
    // Les coordonnées du champ représentent le contenu interne
    // Le conteneur externe est décalé de -15px et agrandi de +30px (15px de chaque côté)
    const outerStyle: React.CSSProperties = {
      position: "absolute",
      left: `${(field.x - 15) * zoomLevel}px`,
      top: `${(field.y - 15) * zoomLevel}px`,
      width: `${(field.width + 30) * zoomLevel}px`, // +30px pour les 15px de chaque côté
      height: `${(field.height + 30) * zoomLevel}px`, // +30px pour les 15px de chaque côté
      padding: `${15 * zoomLevel}px`,
      touchAction: "none",
    };

    // Couleur de la bordure externe avec 50% d'opacité
    const borderColorWithOpacity = hexToRgba(color, 0.5);

    return (
      <div
        key={index}
        style={{
          ...outerStyle,
          borderColor: isSelected ? borderColorWithOpacity : "transparent",
        }}
        className={`group border-2 ${
          isSelected ? "" : "hover:border-opacity-100"
        } transition-all`}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.borderColor = borderColorWithOpacity;
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.borderColor = "transparent";
          }
        }}
        onMouseDown={(e) => {
          // Ne démarrer le drag que si on ne clique pas sur une poignée de resize ou le bouton X
          const target = e.target as HTMLElement;
          if (
            !target.closest(".resize-handle") &&
            !target.closest(".delete-button")
          ) {
            handleFieldMouseDown(e, index, "move");
          }
        }}
        onTouchStart={(e) => {
          // Ne démarrer le drag que si on ne clique pas sur une poignée de resize ou le bouton X
          const target = e.target as HTMLElement;
          if (
            !target.closest(".resize-handle") &&
            !target.closest(".delete-button")
          ) {
            handleFieldMouseDown(e, index, "move");
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedFieldIndex(index);
        }}
      >
        {/* Conteneur interne avec le contenu */}
        <div
          style={{ ...innerStyle, position: "relative" }}
          className="w-full h-full flex flex-col justify-center items-center text-xs p-1"
        >
          {hasSignature ? (
            <img
              src={field.value as string}
              alt="signature"
              className="w-full h-full object-contain"
              style={{ maxWidth: "100%", maxHeight: "100%" }}
            />
          ) : (
            <>
              <Icon
                style={{
                  color: color,
                  width: `${14 * zoomLevel}px`,
                  height: `${14 * zoomLevel}px`,
                }}
              />
              <span
                style={{ color: color, fontSize: `${10 * zoomLevel}px` }}
                className="font-bold truncate mt-0.5"
              >
                {displayLabel}
              </span>
            </>
          )}
          <span
            style={{ color: color, fontSize: `${9 * zoomLevel}px` }}
            className="font-medium truncate opacity-80"
          >
            {recipient?.name || "Non assigné"}
          </span>

          {/* Poignées de redimensionnement - aux coins du rectangle principal, visibles seulement si sélectionné */}
          {isSelected && (
            <>
              <div
                className="resize-handle absolute -top-2 -left-2 w-4 h-4 rounded-full cursor-nw-resize shadow-lg border-2 border-white z-50"
                style={{
                  touchAction: "none",
                  pointerEvents: "auto",
                  backgroundColor: color,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleFieldMouseDown(e, index, "resize-nw");
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleFieldMouseDown(e, index, "resize-nw");
                }}
              />
              <div
                className="resize-handle absolute -top-2 -right-2 w-4 h-4 rounded-full cursor-ne-resize shadow-lg border-2 border-white z-50"
                style={{
                  touchAction: "none",
                  pointerEvents: "auto",
                  backgroundColor: color,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleFieldMouseDown(e, index, "resize-ne");
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleFieldMouseDown(e, index, "resize-ne");
                }}
              />
              <div
                className="resize-handle absolute -bottom-2 -left-2 w-4 h-4 rounded-full cursor-sw-resize shadow-lg border-2 border-white z-50"
                style={{
                  touchAction: "none",
                  pointerEvents: "auto",
                  backgroundColor: color,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleFieldMouseDown(e, index, "resize-sw");
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleFieldMouseDown(e, index, "resize-sw");
                }}
              />
              <div
                className="resize-handle absolute -bottom-2 -right-2 w-4 h-4 rounded-full cursor-se-resize shadow-lg border-2 border-white z-50"
                style={{
                  touchAction: "none",
                  pointerEvents: "auto",
                  backgroundColor: color,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleFieldMouseDown(e, index, "resize-se");
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleFieldMouseDown(e, index, "resize-se");
                }}
              />
            </>
          )}
        </div>

        {/* Bouton de suppression - en haut à droite de la bordure externe, dans un cercle légèrement plus gros que les poignées */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeField(index);
          }}
          className="delete-button absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white z-50 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            touchAction: "none",
            pointerEvents: "auto",
            backgroundColor: color,
          }}
        >
          <X size={12} style={{ color: "#ffffff" }} />
        </button>
      </div>
    );
  };

  // --- UI Components ---
  if (!file) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
          <p className="mt-4 text-onSurfaceVariant">Chargement...</p>
        </div>
      </div>
    );
  }

  const fieldTypeButtons: { type: FieldType; icon: React.ElementType }[] = [
    { type: FieldType.SIGNATURE, icon: Signature },
    { type: FieldType.DATE, icon: Calendar },
    { type: FieldType.TEXT, icon: TypeIcon },
    { type: FieldType.CHECKBOX, icon: CheckSquare },
  ];

  return (
    <>
      <SummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        onConfirm={handleConfirmSend}
        documentName={file.name}
        recipients={recipients}
        emailMessage={emailMessage}
        setEmailMessage={setEmailMessage}
        creatorEmail={creatorEmail}
        setCreatorEmail={setCreatorEmail}
        isSubmitting={isSubmitting}
      />
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        <div className="bg-surface/80 backdrop-blur-sm p-3 shadow-sm z-30 border-b border-outlineVariant flex-shrink-0">
          <div className="container mx-auto flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <Button
                variant="text"
                onClick={() => navigate("/dashboard")}
                icon={ArrowLeft}
                size="small"
                className="flex-shrink-0"
              >
                <span className="hidden sm:inline">Retour</span>
              </Button>
              <h1
                className="text-sm sm:text-lg font-bold truncate text-onSurface min-w-0"
                title={file.name}
              >
                {file.name}
              </h1>
            </div>
            <button
              onClick={handleSend}
              disabled={
                !file ||
                recipients.filter((r) => r.name.trim() && r.email.trim())
                  .length === 0 ||
                fields.filter((f) => f.type === FieldType.SIGNATURE).length ===
                  0
              }
              className="btn-premium-shine btn-premium-extended h-10 text-sm focus:outline-none focus:ring-4 focus:ring-primary/30 w-full sm:w-auto flex-shrink-0 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="hidden sm:inline">
                Envoyer la demande de signature
              </span>
              <span className="sm:hidden">Envoyer</span>
            </button>
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Panel: Recipients & Fields - Hidden on mobile, shown as modal */}
          <div className="hidden lg:block w-80 bg-surface flex-shrink-0 p-4 border-r border-outlineVariant overflow-y-auto">
            {selectedFieldIndex !== null && fields[selectedFieldIndex] ? (
              <FieldPropertiesPanel
                field={fields[selectedFieldIndex]}
                recipient={recipients.find(
                  (r) => r.id === fields[selectedFieldIndex].tempRecipientId
                )}
                onUpdate={(updatedField) => {
                  setFields((prevFields) =>
                    prevFields.map((f, i) =>
                      i === selectedFieldIndex ? updatedField : f
                    )
                  );
                }}
                onBack={() => setSelectedFieldIndex(null)}
                totalPages={totalPages}
                onPlaceOnAllPages={handlePlaceOnAllPages}
                fieldIndex={selectedFieldIndex}
                onDrawSignature={handleDrawSignature}
              />
            ) : (
              <>
                <div className="space-y-4">
                  {recipients.map((recipient, index) => (
                    <div
                      key={recipient.id}
                      onClick={() => setActiveRecipientId(recipient.id)}
                      className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                        activeRecipientId === recipient.id
                          ? "border-primary bg-primaryContainer/30"
                          : "border-outlineVariant/50 hover:border-outlineVariant"
                      }`}
                      style={{
                        borderColor:
                          activeRecipientId === recipient.id
                            ? recipientColors[
                                recipient.id % recipientColors.length
                              ]
                            : undefined,
                      }}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                recipientColors[
                                  recipient.id % recipientColors.length
                                ],
                            }}
                          ></div>
                          <h3 className="font-bold text-sm text-onSurface">
                            Destinataire {index + 1}
                          </h3>
                        </div>
                        {recipients.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRecipient(recipient.id);
                            }}
                            className="p-1 rounded-full text-onSurfaceVariant hover:bg-errorContainer hover:text-onErrorContainer"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Nom complet"
                        value={recipient.name}
                        onChange={(e) =>
                          updateRecipient(recipient.id, "name", e.target.value)
                        }
                        className="w-full text-sm p-2 bg-surfaceVariant/60 border border-outlineVariant rounded-lg mb-2 focus:ring-1 focus:ring-primary focus:border-primary focus:bg-surface"
                      />
                      <input
                        type="email"
                        placeholder="Adresse e-mail"
                        value={recipient.email}
                        onChange={(e) =>
                          updateRecipient(recipient.id, "email", e.target.value)
                        }
                        className="w-full text-sm p-2 bg-surfaceVariant/60 border border-outlineVariant rounded-lg focus:ring-1 focus:ring-primary focus:border-primary focus:bg-surface"
                      />
                    </div>
                  ))}
                </div>
                <Button
                  variant="glass"
                  icon={UserPlus}
                  onClick={addRecipient}
                  className="w-full mt-4"
                >
                  Ajouter un destinataire
                </Button>

                {/* Section Destinataires Existants - TOUJOURS visible */}
                <div className="mt-6 border-t border-outlineVariant pt-4">
                  <h3 className="font-bold text-onSurface mb-3">
                    Destinataires Existants
                  </h3>
                  <p className="text-xs text-onSurfaceVariant mb-3">
                    Sélectionnez un destinataire pour l'ajouter au premier slot
                    disponible.
                  </p>
                  {isLoadingExisting ? (
                    <div className="relative">
                      <select
                        disabled
                        className="w-full p-3 pr-10 bg-surfaceVariant/60 border border-outlineVariant rounded-lg text-onSurfaceVariant appearance-none"
                      >
                        <option>Chargement...</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-onSurfaceVariant">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 9l6 6 6-6"
                          />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        onChange={(e) => {
                          const selectedEmail = e.target.value;
                          if (selectedEmail) {
                            const selectedRecipient = existingRecipients.find(
                              (r) => r.email === selectedEmail
                            );
                            if (selectedRecipient) {
                              addExistingRecipient(selectedRecipient);
                              e.target.value = ""; // Réinitialiser le select
                            }
                          }
                        }}
                        className="w-full p-3 pr-10 bg-surfaceVariant/60 border border-outlineVariant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary focus:bg-surface transition-colors text-onSurface appearance-none cursor-pointer"
                        defaultValue=""
                      >
                        {existingRecipients.length === 0 ? (
                          <option value="" disabled>
                            Aucun destinataire existant. Une fois que vous aurez
                            envoyé un document, les destinataires apparaîtront
                            ici.
                          </option>
                        ) : (
                          <>
                            <option value="" disabled>
                              -- Sélectionner un destinataire --
                            </option>
                            {existingRecipients.map((recipient) => (
                              <option
                                key={recipient.email}
                                value={recipient.email}
                              >
                                {recipient.name} ({recipient.email})
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-onSurface">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 9l6 6 6-6"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-outlineVariant pt-4">
                  <h3 className="font-bold text-onSurface mb-2">
                    Champs standards
                  </h3>
                  <p className="text-xs text-onSurfaceVariant mb-3 leading-relaxed">
                    Sélectionnez un type de champ, puis cliquez sur le document
                    pour le placer.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {fieldTypeButtons.map(({ type, icon: Icon }) => (
                      <button
                        key={type}
                        onClick={() => handleFieldTypeSelect(type)}
                        className={`p-2 rounded-lg text-sm font-semibold flex flex-col items-center justify-center border-2 transition-colors ${
                          selectedFieldType === type
                            ? "bg-primaryContainer border-primary text-onPrimaryContainer"
                            : "bg-surfaceVariant/50 border-transparent hover:border-outlineVariant"
                        }`}
                        disabled={activeRecipientId === null}
                      >
                        <Icon className="h-5 w-5 mb-1" />
                        {type}
                      </button>
                    ))}
                  </div>
                  {activeRecipientId === null && (
                    <p className="text-xs text-onSurfaceVariant mt-2 text-center">
                      Veuillez sélectionner un destinataire pour ajouter des
                      champs.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Mobile Drawer Overlay */}
          {isMobileDrawerOpen && (
            <div
              className="lg:hidden fixed inset-0 bg-scrim/50 z-40"
              onClick={() => setIsMobileDrawerOpen(false)}
            />
          )}

          {/* Mobile Drawer */}
          <div
            className={`
                        lg:hidden fixed bottom-0 left-0 right-0 bg-surface rounded-t-3xl shadow-2xl z-50
                        transition-transform duration-300 ease-out max-h-[80vh] overflow-y-auto
                        ${
                          isMobileDrawerOpen
                            ? "translate-y-0"
                            : "translate-y-full"
                        }
                    `}
          >
            <div className="sticky top-0 bg-surface border-b border-outlineVariant px-4 py-3 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-lg font-bold text-onSurface">
                Configuration
              </h2>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-2 rounded-full hover:bg-surfaceVariant"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              {selectedFieldIndex !== null && fields[selectedFieldIndex] ? (
                <FieldPropertiesPanel
                  field={fields[selectedFieldIndex]}
                  recipient={recipients.find(
                    (r) => r.id === fields[selectedFieldIndex].tempRecipientId
                  )}
                  onUpdate={(updatedField) => {
                    setFields((prevFields) =>
                      prevFields.map((f, i) =>
                        i === selectedFieldIndex ? updatedField : f
                      )
                    );
                  }}
                  onBack={() => setSelectedFieldIndex(null)}
                  totalPages={totalPages}
                  onPlaceOnAllPages={handlePlaceOnAllPages}
                  fieldIndex={selectedFieldIndex}
                  onDrawSignature={handleDrawSignature}
                />
              ) : (
                <>
                  <div className="space-y-4">
                    {recipients.map((recipient, index) => (
                      <div
                        key={recipient.id}
                        onClick={() => setActiveRecipientId(recipient.id)}
                        className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                          activeRecipientId === recipient.id
                            ? "border-primary bg-primaryContainer/30"
                            : "border-outlineVariant/50 hover:border-outlineVariant"
                        }`}
                        style={{
                          borderColor:
                            activeRecipientId === recipient.id
                              ? recipientColors[
                                  recipient.id % recipientColors.length
                                ]
                              : undefined,
                        }}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  recipientColors[
                                    recipient.id % recipientColors.length
                                  ],
                              }}
                            ></div>
                            <h3 className="font-bold text-sm text-onSurface">
                              Destinataire {index + 1}
                            </h3>
                          </div>
                          {recipients.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRecipient(recipient.id);
                              }}
                              className="p-1 rounded-full text-onSurfaceVariant hover:bg-errorContainer hover:text-onErrorContainer"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="Nom complet"
                          value={recipient.name}
                          onChange={(e) =>
                            updateRecipient(
                              recipient.id,
                              "name",
                              e.target.value
                            )
                          }
                          className="w-full text-sm p-2 bg-surfaceVariant/60 border border-outlineVariant rounded-lg mb-2 focus:ring-1 focus:ring-primary focus:border-primary focus:bg-surface"
                        />
                        <input
                          type="email"
                          placeholder="Adresse e-mail"
                          value={recipient.email}
                          onChange={(e) =>
                            updateRecipient(
                              recipient.id,
                              "email",
                              e.target.value
                            )
                          }
                          className="w-full text-sm p-2 bg-surfaceVariant/60 border border-outlineVariant rounded-lg focus:ring-1 focus:ring-primary focus:border-primary focus:bg-surface"
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outlined"
                    icon={UserPlus}
                    onClick={addRecipient}
                    className="w-full mt-4"
                  >
                    Ajouter un destinataire
                  </Button>

                  {/* Section Destinataires Existants - TOUJOURS visible */}
                  <div className="mt-6 border-t border-outlineVariant pt-4">
                    <h3 className="font-bold text-onSurface mb-3">
                      Destinataires Existants
                    </h3>
                    <p className="text-xs text-onSurfaceVariant mb-3">
                      Sélectionnez un destinataire pour l'ajouter au premier
                      slot disponible.
                    </p>
                    {isLoadingExisting ? (
                      <select
                        disabled
                        className="w-full p-3 bg-surfaceVariant/60 border border-outlineVariant rounded-lg text-onSurfaceVariant"
                      >
                        <option>Chargement...</option>
                      </select>
                    ) : (
                      <select
                        onChange={(e) => {
                          const selectedEmail = e.target.value;
                          if (selectedEmail) {
                            const selectedRecipient = existingRecipients.find(
                              (r) => r.email === selectedEmail
                            );
                            if (selectedRecipient) {
                              addExistingRecipient(selectedRecipient);
                              e.target.value = ""; // Réinitialiser le select
                            }
                          }
                        }}
                        className="w-full p-3 bg-surfaceVariant/60 border border-outlineVariant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary focus:bg-surface transition-colors text-onSurface"
                        defaultValue=""
                      >
                        {existingRecipients.length === 0 ? (
                          <option value="" disabled>
                            Aucun destinataire existant. Une fois que vous aurez
                            envoyé un document, les destinataires apparaîtront
                            ici.
                          </option>
                        ) : (
                          <>
                            <option value="" disabled>
                              -- Sélectionner un destinataire --
                            </option>
                            {existingRecipients.map((recipient) => (
                              <option
                                key={recipient.email}
                                value={recipient.email}
                              >
                                {recipient.name} ({recipient.email})
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    )}
                  </div>

                  <div className="mt-6 border-t border-outlineVariant pt-4">
                    <h3 className="font-bold text-onSurface mb-2">
                      Champs standards
                    </h3>
                    <p className="text-xs text-onSurfaceVariant mb-3 leading-relaxed">
                      Sélectionnez un type de champ, puis cliquez sur le
                      document pour le placer.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {fieldTypeButtons.map(({ type, icon: Icon }) => (
                        <button
                          key={type}
                          onClick={() => {
                            handleFieldTypeSelect(type);
                            setIsMobileDrawerOpen(false);
                          }}
                          className={`p-2 rounded-lg text-sm font-semibold flex flex-col items-center justify-center border-2 transition-colors ${
                            selectedFieldType === type
                              ? "bg-primaryContainer border-primary text-onPrimaryContainer"
                              : "bg-surfaceVariant/50 border-transparent hover:border-outlineVariant"
                          }`}
                          disabled={activeRecipientId === null}
                        >
                          <Icon className="h-5 w-5 mb-1" />
                          {type}
                        </button>
                      ))}
                    </div>
                    {activeRecipientId === null && (
                      <p className="text-xs text-onSurfaceVariant mt-2 text-center">
                        Veuillez sélectionner un destinataire pour ajouter des
                        champs.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Panel: PDF Viewer */}
          <div
            ref={viewerRef}
            className="flex-grow bg-surfaceVariant/30 p-2 sm:p-4 overflow-auto"
            onClick={() => setSelectedFieldIndex(null)}
          >
            <div className="w-full max-w-full overflow-x-hidden">
              {pageDimensions.map((dim, index) => (
                <div
                  key={`page-wrapper-${index + 1}`}
                  ref={(el) => (pageRefs.current[index] = el)}
                  data-page-number={index + 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePageClick(e, index + 1);
                  }}
                  className="my-4 shadow-lg mx-auto relative bg-white"
                  style={{
                    width: Math.min(
                      dim.width * zoomLevel,
                      window.innerWidth - 32
                    ),
                    height: dim.height * zoomLevel,
                    cursor: selectedFieldType
                      ? "crosshair"
                      : editingField
                      ? editingField.action === "move"
                        ? "grabbing"
                        : editingField.action === "resize-nw"
                        ? "nw-resize"
                        : editingField.action === "resize-ne"
                        ? "ne-resize"
                        : editingField.action === "resize-sw"
                        ? "sw-resize"
                        : "se-resize"
                      : "default",
                    maxWidth: "100%",
                  }}
                >
                  <PdfPageRenderer
                    pageNum={index + 1}
                    currentZoom={zoomLevel}
                  />
                  {fields
                    .filter((f) => f.page === index + 1)
                    .map((field) => {
                      const originalIndex = fields.findIndex(
                        (f) => f === field
                      );
                      return renderField(field, originalIndex);
                    })}
                </div>
              ))}
            </div>
            {/* Bouton flottant pour ouvrir le drawer sur mobile */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden fixed bottom-24 right-4 bg-primary text-onPrimary p-4 rounded-full shadow-2xl z-30 hover:scale-110 transition-transform"
              aria-label="Ouvrir les paramètres"
            >
              <UserPlus className="h-6 w-6" />
            </button>

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-fit max-w-[calc(100vw-2rem)] z-40">
              <div className="bg-surface/90 backdrop-blur-sm rounded-full shadow-lg border border-outlineVariant/50 flex items-center p-1 gap-1 text-onSurface">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.25, z - 0.25))}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-surfaceVariant transition-colors flex-shrink-0"
                  disabled={zoomLevel <= 0.25}
                >
                  <ZoomOut className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <span className="text-xs sm:text-sm font-semibold w-10 sm:w-12 text-center select-none flex-shrink-0">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-surfaceVariant transition-colors flex-shrink-0"
                  disabled={zoomLevel >= 3}
                >
                  <ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <div className="w-px h-6 bg-outlineVariant mx-0.5 sm:mx-1 flex-shrink-0 hidden sm:block"></div>
                <form
                  onSubmit={handleGoToPage}
                  className="hidden sm:flex items-center"
                >
                  <span className="text-sm font-medium px-2">Page</span>
                  <input
                    type="number"
                    value={goToPageInput}
                    onChange={(e) => setGoToPageInput(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-12 text-center bg-surfaceVariant/60 rounded-md py-1 text-sm border border-outlineVariant focus:ring-1 focus:ring-primary focus:border-primary"
                    min="1"
                    max={totalPages}
                  />
                  <span className="text-sm text-onSurfaceVariant px-2">
                    {" "}
                    sur {totalPages}
                  </span>
                  <button
                    type="submit"
                    className="p-2 rounded-full hover:bg-surfaceVariant transition-colors"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </form>
                {/* Version mobile simplifiée */}
                <span className="sm:hidden text-xs text-onSurfaceVariant px-2 flex-shrink-0">
                  Page {currentPage}/{totalPages}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal SignaturePad pour pré-signer/pré-parapher */}
      {fieldToSign && (
        <SignaturePadUnified
          onSave={handleSaveSignature}
          onCancel={handleCancelSignature}
          signerName={
            recipients.find((r) => r.id === fieldToSign.tempRecipientId)
              ?.name || "Utilisateur"
          }
          initialTab="draw"
          isParaphe={fieldToSign.signatureSubType === "initial"}
        />
      )}
    </>
  );
};

export default PrepareDocumentPage;
