import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckSquare,
  GripVertical,
  Info,
  Loader2,
  Mail,
  Signature,
  Trash2,
  Type as TypeIcon,
  UploadCloud,
  UserPlus,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { useToast } from "../components/Toast";
import { useUser } from "../components/UserContext";
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
type TempField = Omit<Field, "id" | "recipientId" | "value"> & {
  tempRecipientId: number;
  color?: string;
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
      // Par défaut, sélectionner tous les destinataires
      setSelectedRecipients(recipients.map((r) => r.id));
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
      className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-50 p-4 modal-backdrop"
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
                DESTINATAIRES ({selectedCount}/{recipients.length} sélectionné
                {selectedCount > 1 ? "s" : ""})
              </h3>
              <ul className="space-y-2">
                {recipients.map((r) => (
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
}> = ({ field, recipient, onUpdate, onBack }) => {
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
          <p className="font-semibold text-onSurface">{field.type}</p>
        </div>
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
      </div>
    </div>
  );
};

const PrepareDocumentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const { currentUser } = useUser();

  // State
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

  const viewerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [editingField, setEditingField] = useState<{
    index: number;
    action: "move" | "resize-br";
  } | null>(null);
  const [initialDragPosition, setInitialDragPosition] = useState<{
    mouseX: number;
    mouseY: number;
    fieldX: number;
    fieldY: number;
    fieldW: number;
    fieldH: number;
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

  // Charger automatiquement le fichier depuis le Dashboard
  useEffect(() => {
    const pdfData = (location.state as any)?.pdfData;
    const fileName = (location.state as any)?.fileName;

    if (pdfData && fileName) {
      // Convertir le base64 en File object
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
    }
  }, []);

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
          ? 244
          : 110,
      height:
        selectedFieldType === FieldType.CHECKBOX
          ? 50
          : selectedFieldType === FieldType.DATE
          ? 50
          : selectedFieldType === FieldType.SIGNATURE ||
            selectedFieldType === FieldType.INITIAL
          ? 110
          : 50,
      tempRecipientId: activeRecipientId,
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
    setFields(fields.filter((_, i) => i !== fieldIndex));
  };

  // --- Field Drag & Resize ---
  const handleFieldMouseDown = (
    e: React.MouseEvent,
    index: number,
    action: "move" | "resize-br"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFieldIndex(index);
    setEditingField({ index, action });
    const field = fields[index];
    setInitialDragPosition({
      mouseX: e.clientX,
      mouseY: e.clientY,
      fieldX: field.x,
      fieldY: field.y,
      fieldW: field.width,
      fieldH: field.height,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!editingField || !initialDragPosition) return;

    const dx = (e.clientX - initialDragPosition.mouseX) / zoomLevel;
    const dy = (e.clientY - initialDragPosition.mouseY) / zoomLevel;

    setFields((currentFields) =>
      currentFields.map((field, index) => {
        if (index === editingField.index) {
          if (editingField.action === "move") {
            return {
              ...field,
              x: initialDragPosition.fieldX + dx,
              y: initialDragPosition.fieldY + dy,
            };
          } else if (editingField.action === "resize-br") {
            return {
              ...field,
              width: Math.max(20, initialDragPosition.fieldW + dx),
              height: Math.max(20, initialDragPosition.fieldH + dy),
            };
          }
        }
        return field;
      })
    );
  };

  const handleMouseUp = () => {
    setEditingField(null);
    setInitialDragPosition(null);
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
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
      { id: "service_tcdw2fd", name: "Gmail" },
      { id: "service_ltiackr", name: "Outlook" },
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
    if (recipients.length === 0) {
      addToast("Veuillez ajouter au moins un destinataire.", "error");
      return;
    }

    for (const recipient of recipients) {
      if (!recipient.name.trim()) {
        addToast(
          "Veuillez renseigner le nom pour tous les destinataires.",
          "error"
        );
        return;
      }
      if (!recipient.email.trim()) {
        addToast(
          `Veuillez renseigner l'e-mail pour ${recipient.name}.`,
          "error"
        );
        return;
      }
      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
      `Bonjour,\n\nVeuillez examiner et signer le document "${file.name}".\n\nCordialement.`
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

  const renderField = (field: TempField, index: number) => {
    const isSelected = selectedFieldIndex === index;
    const recipient = recipients.find((r) => r.id === field.tempRecipientId);
    const color =
      field.color ||
      (recipient
        ? recipientColors[recipient.id % recipientColors.length]
        : "#71717A");

    const baseStyle: React.CSSProperties = {
      position: "absolute",
      left: `${field.x * zoomLevel}px`,
      top: `${field.y * zoomLevel}px`,
      width: `${field.width * zoomLevel}px`,
      height: `${field.height * zoomLevel}px`,
      border: `2px solid ${color}`,
      backgroundColor: `${color}20`,
      cursor: "move",
    };

    const icons: { [key in FieldType]: React.ElementType } = {
      [FieldType.SIGNATURE]: Signature,
      [FieldType.INITIAL]: Signature,
      [FieldType.DATE]: Calendar,
      [FieldType.TEXT]: TypeIcon,
      [FieldType.CHECKBOX]: CheckSquare,
    };
    const Icon = icons[field.type];

    return (
      <div
        key={index}
        style={baseStyle}
        className={`rounded-md group p-1 flex flex-col justify-center items-center text-xs transition-shadow ${
          isSelected
            ? "ring-2 ring-offset-2 ring-offset-white ring-primary shadow-lg"
            : ""
        }`}
        onMouseDown={(e) => handleFieldMouseDown(e, index, "move")}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedFieldIndex(index);
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeField(index);
          }}
          className="absolute -top-2 -right-2 bg-error text-onError rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <X size={12} />
        </button>
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
          {field.type}
        </span>
        <span
          style={{ color: color, fontSize: `${9 * zoomLevel}px` }}
          className="font-medium truncate opacity-80"
        >
          {recipient?.name || "Non assigné"}
        </span>
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={(e) => handleFieldMouseDown(e, index, "resize-br")}
        >
          <div className="w-full h-full p-1">
            <GripVertical size={12} className="text-white/50 rotate-45" />
          </div>
        </div>
      </div>
    );
  };

  // --- UI Components ---
  if (!file) {
    return (
      <div className="container mx-auto max-w-3xl text-center">
        <div className="bg-surface p-8 rounded-3xl shadow-sm border border-outlineVariant/30">
          <div className="bg-primaryContainer inline-block p-4 rounded-full">
            <UploadCloud className="h-12 w-12 text-onPrimaryContainer" />
          </div>
          <h1 className="text-3xl font-bold text-onSurface mt-4">
            Préparez votre document
          </h1>
          <p className="mt-2 text-md text-onSurfaceVariant max-w-md mx-auto">
            Téléversez un document PDF pour commencer à ajouter des
            destinataires et des champs de signature.
          </p>
          <div className="mt-8">
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="relative border-2 border-dashed border-outlineVariant rounded-2xl p-12 hover:bg-surfaceVariant/50 transition-colors">
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="mt-4 font-semibold text-onSurface">
                      Traitement du PDF...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <UploadCloud className="h-10 w-10 text-onSurfaceVariant" />
                    <span className="mt-4 font-semibold text-primary">
                      Cliquez pour téléverser
                    </span>
                    <p className="text-sm text-onSurfaceVariant mt-1">
                      ou glissez-déposez un fichier PDF ou Word ici
                    </p>
                  </div>
                )}
              </div>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={isProcessing}
              />
            </label>
          </div>
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
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="bg-surface/80 backdrop-blur-sm p-3 shadow-sm sticky top-16 z-30 border-b border-outlineVariant">
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
                recipients.length === 0 ||
                fields.filter((f) => f.type === FieldType.SIGNATURE).length ===
                  0 ||
                recipients.some((r) => !r.name.trim() || !r.email.trim())
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
        <div className="flex-grow flex overflow-hidden relative">
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
    </>
  );
};

export default PrepareDocumentPage;
