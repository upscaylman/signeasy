import { useDrag, usePinch } from "@use-gesture/react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  Settings,
  Signature,
  X,
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
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import DraggableFieldUnified from "../components/DraggableFieldUnified";
import DraggableSignature from "../components/DraggableSignature";
import SignaturePadUnified from "../components/SignaturePadUnified";
import { useToast } from "../components/Toast";
import { useUser } from "../components/UserContext";
import {
  downloadDocument,
  getEnvelopeByToken,
  getPdfData,
  rejectSignature,
  submitSignature,
} from "../services/firebaseApi";
import type { Envelope, Field } from "../types";
import { DocumentStatus, FieldType } from "../types";

// Configure the PDF.js worker, same as in PrepareDocumentPage
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

// Taille de la grille magnétique (en pixels)
const GRID_SIZE = 10;

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

// --- Standalone Components ---

const RejectModal: React.FC<{
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}> = ({ onConfirm, onCancel, isLoading }) => {
  const [reason, setReason] = useState("");
  return (
    <div
      className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-[100] p-4 modal-backdrop"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-3xl shadow-xl w-full max-w-md p-6 modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-onSurface">
          Rejeter le document
        </h2>
        <p className="text-sm text-onSurfaceVariant my-2">
          Veuillez indiquer la raison du rejet. L'expéditeur en sera informé.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex: Les informations du contrat sont incorrectes..."
          rows={3}
          className="w-full p-2 mt-2 bg-surfaceVariant/60 border border-outlineVariant rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary focus:bg-surface"
        />
        <div className="flex justify-end space-x-3 mt-6">
          <Button variant="text" onClick={onCancel}>
            Annuler
          </Button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={isLoading || !reason.trim()}
            className="btn-premium-shine btn-premium-extended h-11 text-sm focus:outline-none focus:ring-4 focus:ring-primary/30 inline-flex items-center justify-center gap-2"
            aria-busy={isLoading}
          >
            {isLoading ? (
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
              <span>Confirmer le rejet</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const SignaturePad = SignaturePadUnified;

// Main Page Component
const SignDocumentPage: React.FC = () => {
  const { token: tokenFromParams } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const {
    currentUser,
    setCurrentUserSilent,
    isLoading: userIsLoading,
  } = useUser();
  // ✅ triggerRefresh n'est plus nécessaire - le dashboard utilise maintenant un listener en temps réel

  // Récupérer le token depuis l'URL ou sessionStorage (pour les documents envoyés)
  const token = tokenFromParams || sessionStorage.getItem("signToken") || null;
  const readOnlyFromStorage = sessionStorage.getItem("signReadOnly") === "true";

  // State
  const [envelope, setEnvelope] = useState<
    (Envelope & { currentSignerId: string }) | null
  >(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageDimensions, setPageDimensions] = useState<
    { width: number; height: number }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<{
    [key: string]: string | boolean | null;
  }>({});
  const [activeField, setActiveField] = useState<Field | null>(null);
  const [signerName, setSignerName] = useState("");
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [readOnly, setReadOnly] = useState(
    location.state?.readOnly === true || readOnlyFromStorage
  );
  const [applyToAllInitials, setApplyToAllInitials] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showTextOptions, setShowTextOptions] = useState(false);
  const [textFieldOptions, setTextFieldOptions] = useState<{
    [key: string]: { fontSize: number; lineHeight: number; wordWrap: boolean };
  }>({});
  const [autoAuthAttempted, setAutoAuthAttempted] = useState(false);
  // 📱 Zoom adaptatif : 0.5 sur mobile, 0.75 sur tablette, 1 sur desktop (cohérent avec PrepareDocumentPage)
  const getInitialZoom = () => {
    const width = window.innerWidth;
    if (width < 640) return 0.5; // mobile
    if (width < 1024) return 0.75; // tablette
    return 1; // desktop
  };
  const [zoomLevel, setZoomLevel] = useState(getInitialZoom());
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [goToPageInput, setGoToPageInput] = useState("1");
  const viewerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textFieldRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>(
    {}
  );
  const toastShownRef = useRef(false);

  const currentSignerId = envelope?.currentSignerId;
  const signableFields =
    envelope?.fields.filter((f) => f.recipientId === currentSignerId) || [];
  const [currentFieldIndex, setCurrentFieldIndex] = useState(-1);

  // Validation : vérifier que tous les champs requis sont remplis
  const isFormValid = useMemo(() => {
    // En lecture seule, pas de validation
    if (readOnly) return true;

    // Si l'enveloppe n'est pas encore chargée, le formulaire n'est PAS valide
    if (!envelope) return false;

    // Vérifier que le nom du signataire est rempli
    if (!signerName.trim()) return false;

    // Vérifier TOUS les champs obligatoires (sauf DATE qui est auto-remplie)
    const requiredFields = signableFields.filter(
      (f) => f.type !== FieldType.DATE
    );

    const allRequiredFieldsFilled = requiredFields.every((field) => {
      const value = fieldValues[field.id];

      // Vérifier selon le type de champ
      if (
        field.type === FieldType.SIGNATURE ||
        field.type === FieldType.INITIAL
      ) {
        return value != null && value !== "";
      } else if (field.type === FieldType.TEXT) {
        return (
          value != null && typeof value === "string" && value.trim() !== ""
        );
      } else if (field.type === FieldType.CHECKBOX) {
        return value === true;
      }

      return true;
    });

    return allRequiredFieldsFilled;
  }, [envelope, signerName, signableFields, fieldValues, readOnly]);

  // Vérifier si au moins une signature/paraphe a été appliquée (pour activer le bouton de téléchargement)
  const hasSignature = useMemo(() => {
    if (!envelope) return false;

    // Vérifier si au moins un champ de signature/paraphe a une valeur
    const signatureFields = envelope.fields.filter(
      (f) => f.type === FieldType.SIGNATURE || f.type === FieldType.INITIAL
    );

    return signatureFields.some((field) => {
      const value = fieldValues[field.id];
      return (
        value != null &&
        value !== "" &&
        typeof value === "string" &&
        value.length > 0
      );
    });
  }, [envelope, fieldValues]);

  // Afficher un toast si le formulaire n'est pas valide (sur desktop uniquement)
  useEffect(() => {
    if (
      !readOnly &&
      envelope &&
      !isSubmitting &&
      !isFormValid &&
      !toastShownRef.current
    ) {
      // Vérifier si on est sur desktop (largeur d'écran >= 1024px)
      if (window.innerWidth >= 1024) {
        const message = !signerName.trim()
          ? "Veuillez confirmer votre nom"
          : "Complétez tous les champs obligatoires (signature/paraphe, texte, cases à cocher)";
        addToast(message, "warning");
        toastShownRef.current = true;
      }
    }
    // Réinitialiser le ref quand le formulaire devient valide
    if (isFormValid) {
      toastShownRef.current = false;
    }
  }, [isFormValid, isSubmitting, readOnly, envelope, signerName, addToast]);

  // State pour les positions et tailles personnalisées des champs
  const [fieldDimensions, setFieldDimensions] = useState<{
    [key: string]: { x: number; y: number; width: number; height: number };
  }>({});
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [resizingField, setResizingField] = useState<string | null>(null);
  const [initialDimensions, setInitialDimensions] = useState({
    width: 0,
    height: 0,
    mouseX: 0,
    mouseY: 0,
    x: 0,
    y: 0,
  });
  const [dimensionTooltip, setDimensionTooltip] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  // Position/taille temporaire pendant le drag/resize (pour éviter le scintillement)
  const [tempTransform, setTempTransform] = useState<{
    fieldId: string;
    dx: number;
    dy: number;
    width?: number;
    height?: number;
  } | null>(null);
  // Pour empêcher le onClick après un drag
  const [hasDragged, setHasDragged] = useState(false);
  // Pour le pinch-to-zoom sur mobile
  const [pinchingField, setPinchingField] = useState<string | null>(null);
  const [pinchDistance, setPinchDistance] = useState<number | null>(null);

  // Fonction pour snapper les coordonnées à la grille
  const snapToGrid = (value: number) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  // Fonction pour obtenir les dimensions par défaut d'un champ
  const getDefaultFieldDimensions = (
    fieldType: FieldType,
    originalWidth: number,
    originalHeight: number
  ) => {
    if (fieldType === FieldType.DATE) {
      return { width: 86, height: 50 };
    } else if (fieldType === FieldType.CHECKBOX) {
      return { width: 80, height: 50 };
    }
    return { width: originalWidth, height: originalHeight };
  };

  useEffect(() => {
    const loadData = async () => {
      if (!token) {
        setError("Lien de signature invalide.");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const env = await getEnvelopeByToken(token);
        if (!env) {
          setError("Document non trouvé ou le lien a expiré.");
          setIsLoading(false);
          return;
        }

        // 🔒 VÉRIFICATION D'EXPIRATION : Si le document a expiré, afficher un message
        if (env.isExpired) {
          const expirationDate = new Date(
            env.document.expiresAt
          ).toLocaleDateString("fr-FR");
          setError(
            `Ce document a expiré le ${expirationDate}. Les documents sont automatiquement supprimés après 1 an pour respecter vos obligations légales.`
          );
          setIsLoading(false);
          return;
        }

        setEnvelope(env);
        const currentSigner = env.recipients.find(
          (r) => r.id === env.currentSignerId
        );
        setSignerName(currentSigner?.name || "");

        // 🚀 AUTO-AUTHENTIFICATION : Si pas encore loggé, auto-login via le token
        if (!currentUser && currentSigner?.email && !autoAuthAttempted) {
          setAutoAuthAttempted(true);
          console.log(
            "🔓 Auto-authentification du signataire:",
            currentSigner.email
          );
          setCurrentUserSilent({ email: currentSigner.email });
        }

        const pdfDataB64 = await getPdfData(env.document.id);
        if (!pdfDataB64) {
          setError("Le fichier du document est introuvable.");
          setIsLoading(false);
          return;
        }

        const pdfData = base64ToUint8Array(pdfDataB64);
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });

        const loadedPdf = await loadingTask.promise;
        setPdf(loadedPdf);

        const dimensions = [];
        for (let i = 1; i <= loadedPdf.numPages; i++) {
          const page = await loadedPdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          dimensions.push({ width: viewport.width, height: viewport.height });
        }
        setPageDimensions(dimensions);

        const initialValues: { [key: string]: string | boolean | null } = {};
        const today = new Date().toLocaleDateString("fr-FR");
        env.fields.forEach((field) => {
          // Pré-remplir automatiquement les champs DATE avec la date du jour pour le signataire actuel
          if (
            field.type === FieldType.DATE &&
            field.recipientId === env.currentSignerId &&
            !field.value
          ) {
            initialValues[field.id] = today;
          } else {
            initialValues[field.id] = field.value ?? null;
          }
        });
        setFieldValues(initialValues);

        console.log("🔍 DEBUG - Champs chargés:", {
          envelopeId: env.document.id,
          currentSignerId: env.currentSignerId,
          totalFields: env.fields.length,
          fieldsWithValues: env.fields.filter((f) => f.value).length,
          fieldValues: initialValues,
        });

        // 🔒 SÉCURITÉ : Vérifier si le signataire actuel a déjà signé
        const currentSignerFields = env.fields.filter(
          (f) => f.recipientId === env.currentSignerId
        );
        const signatureFields = currentSignerFields.filter(
          (f) => f.type === FieldType.SIGNATURE || f.type === FieldType.INITIAL
        );

        // Si tous les champs de signature ont une valeur, le document a déjà été signé
        const hasSignedAll =
          signatureFields.length > 0 &&
          signatureFields.every((f) => f.value != null && f.value !== "");

        if (hasSignedAll) {
          setAlreadySigned(true);
          setReadOnly(true);
          console.log(
            "🔒 Document déjà signé par ce destinataire - Mode lecture seule activé"
          );
          addToast(
            "Vous avez déjà signé ce document. Il est en lecture seule.",
            "info"
          );
        }
      } catch (err) {
        console.error("Failed to load document", err);
        setError("Une erreur est survenue lors du chargement du document.");
      } finally {
        setIsLoading(false);
      }
    };

    // Seulement charger si on a un token
    if (token && !autoAuthAttempted) {
      loadData();
    }

    // Nettoyer sessionStorage au démontage
    return () => {
      if (readOnlyFromStorage) {
        sessionStorage.removeItem("signToken");
        sessionStorage.removeItem("signReadOnly");
      }
    };
  }, [token, readOnlyFromStorage]);

  useEffect(() => {
    pageRefs.current = pageRefs.current.slice(0, pdf?.numPages || 0);
  }, [pdf]);

  // Recalculer la taille des champs texte quand les options changent
  useEffect(() => {
    if (!envelope) return;

    envelope.fields
      .filter((f) => f.type === FieldType.TEXT && fieldValues[f.id])
      .forEach((field) => {
        const textValue = fieldValues[field.id] as string;
        const textOptions = textFieldOptions[field.id] || {
          fontSize: field.textOptions?.fontSize || 12,
          lineHeight: field.textOptions?.lineHeight || 1.3,
          wordWrap: field.textOptions?.wordWrap !== false,
        };

        setTimeout(() => {
          const measureEl = document.createElement("div");
          measureEl.style.position = "absolute";
          measureEl.style.visibility = "hidden";
          measureEl.style.whiteSpace = textOptions.wordWrap
            ? "pre-wrap"
            : "nowrap";
          measureEl.style.fontSize = `${textOptions.fontSize}px`;
          measureEl.style.fontFamily = getComputedStyle(
            document.body
          ).fontFamily;
          measureEl.style.lineHeight = `${textOptions.lineHeight}`;
          measureEl.style.padding = "8px";
          measureEl.style.width = textOptions.wordWrap
            ? `${fieldDimensions[field.id]?.width || field.width || 200}px`
            : "auto";
          measureEl.style.maxWidth = "500px";
          measureEl.textContent = textValue;
          document.body.appendChild(measureEl);

          const measuredWidth = measureEl.scrollWidth;
          const measuredHeight = measureEl.scrollHeight;
          document.body.removeChild(measureEl);

          const currentDims = fieldDimensions[field.id];
          const baseWidth = currentDims?.width || field.width || 200;
          const baseHeight = currentDims?.height || field.height || 50;

          let newWidth = baseWidth;
          let newHeight = baseHeight;

          if (textOptions.wordWrap) {
            newHeight = Math.max(50, measuredHeight + 16);
          } else {
            newWidth = Math.max(200, Math.min(measuredWidth + 16, 500));
            newHeight = Math.max(50, measuredHeight + 16);
          }

          setFieldDimensions((prev) => ({
            ...prev,
            [field.id]: {
              ...prev[field.id],
              width: newWidth,
              height: newHeight,
              x: prev[field.id]?.x ?? field.x,
              y: prev[field.id]?.y ?? field.y,
            },
          }));
        }, 10);
      });
  }, [textFieldOptions, envelope, fieldValues]);

  // 📱 Ajuster le zoom lors du redimensionnement de la fenêtre (changement d'orientation sur mobile)
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const newZoom = width < 640 ? 0.5 : width < 1024 ? 0.75 : 1;

      // Uniquement si on est au zoom par défaut, on ajuste
      const currentIsDefaultZoom =
        zoomLevel === 0.5 || zoomLevel === 0.75 || zoomLevel === 1;
      if (currentIsDefaultZoom && zoomLevel !== newZoom) {
        setZoomLevel(newZoom);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [zoomLevel]);

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

    const currentRefs = pageRefs.current;
    currentRefs.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      currentRefs.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, [pdf, pageDimensions]);

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () =>
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));

  const scrollToField = useCallback(
    (fieldIndex: number) => {
      const field = signableFields[fieldIndex];
      if (field && viewerRef.current) {
        const pageElement = viewerRef.current.querySelector(
          `#page-wrapper-${field.page}`
        );
        if (pageElement) {
          const yOffset = -150; // Offset from the top of the viewport
          const viewerTop = viewerRef.current.getBoundingClientRect().top;
          const fieldTopInViewer =
            pageElement.getBoundingClientRect().top -
            viewerTop +
            viewerRef.current.scrollTop +
            field.y * zoomLevel +
            yOffset;

          viewerRef.current.scrollTo({
            top: fieldTopInViewer,
            behavior: "smooth",
          });
        }
        setCurrentFieldIndex(fieldIndex);
        setCurrentPage(field.page);
        setGoToPageInput(String(field.page));
      }
    },
    [signableFields, zoomLevel]
  );

  // 🎯 Fonction pour démarrer la signature intelligemment
  const handleStartSigning = useCallback(() => {
    // Trouver le premier champ non rempli
    const manualFields = signableFields.filter(
      (f) => f.type !== FieldType.DATE
    );
    const firstEmptyFieldIndex = manualFields.findIndex((field) => {
      const value = fieldValues[field.id];

      if (field.type === FieldType.TEXT) {
        return (
          !value || (typeof value === "string" && value.trim().length === 0)
        );
      } else if (field.type === FieldType.CHECKBOX) {
        return value !== true;
      } else if (
        field.type === FieldType.SIGNATURE ||
        field.type === FieldType.INITIAL
      ) {
        return !value || (typeof value === "string" && value.length === 0);
      }
      return false;
    });

    if (firstEmptyFieldIndex === -1) {
      // Tous les champs sont remplis, scroller au premier champ
      scrollToField(0);
      return;
    }

    const firstEmptyField = manualFields[firstEmptyFieldIndex];
    const actualFieldIndex = signableFields.findIndex(
      (f) => f.id === firstEmptyField.id
    );

    // Scroller vers le champ
    scrollToField(actualFieldIndex);

    // Si c'est un champ SIGNATURE ou INITIAL, ouvrir automatiquement le popup
    if (
      firstEmptyField.type === FieldType.SIGNATURE ||
      firstEmptyField.type === FieldType.INITIAL
    ) {
      // Petit délai pour laisser le scroll se terminer
      setTimeout(() => {
        setActiveField(firstEmptyField);
      }, 300);
    }
    // Si c'est un champ TEXT, focus automatiquement sur le textarea
    else if (firstEmptyField.type === FieldType.TEXT) {
      setTimeout(() => {
        const textFieldRef = textFieldRefs.current[firstEmptyField.id];
        if (textFieldRef) {
          textFieldRef.focus();
          // Optionnel: sélectionner tout le texte existant
          textFieldRef.select();
        }
      }, 400);
    }
    // Pour CHECKBOX, le scroll suffit car il est directement cliquable
  }, [signableFields, fieldValues, scrollToField]);

  const handleNextField = () => {
    if (currentFieldIndex < signableFields.length - 1) {
      scrollToField(currentFieldIndex + 1);
    }
  };
  const handlePrevField = () => {
    if (currentFieldIndex > 0) {
      scrollToField(currentFieldIndex - 1);
    }
  };

  const handleGoToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(goToPageInput, 10);
    if (pdf && pageNum >= 1 && pageNum <= pdf.numPages) {
      pageRefs.current[pageNum - 1]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      const firstFieldIndexOnPage = signableFields.findIndex(
        (f) => f.page === pageNum
      );
      if (firstFieldIndexOnPage !== -1) {
        setCurrentFieldIndex(firstFieldIndexOnPage);
      }
    } else {
      addToast(
        `Veuillez entrer un numéro de page valide (1-${pdf?.numPages}).`,
        "error"
      );
    }
  };

  const handleFieldChange = (fieldId: string, value: string | boolean) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));

    // Auto-ajuster la taille pour les champs texte
    const field = envelope?.fields.find((f) => f.id === fieldId);
    if (field && field.type === FieldType.TEXT && typeof value === "string") {
      const textOptions = textFieldOptions[fieldId] || {
        fontSize: field.textOptions?.fontSize || 12,
        lineHeight: field.textOptions?.lineHeight || 1.3,
        wordWrap: field.textOptions?.wordWrap !== false,
      };

      // Auto-ajuster la taille basée sur le contenu
      setTimeout(() => {
        const measureEl = document.createElement("div");
        measureEl.style.position = "absolute";
        measureEl.style.visibility = "hidden";
        measureEl.style.whiteSpace = textOptions.wordWrap
          ? "pre-wrap"
          : "nowrap";
        measureEl.style.fontSize = `${textOptions.fontSize}px`;
        measureEl.style.fontFamily = getComputedStyle(document.body).fontFamily;
        measureEl.style.lineHeight = `${textOptions.lineHeight}`;
        measureEl.style.padding = "8px";
        measureEl.style.width = textOptions.wordWrap
          ? `${fieldDimensions[fieldId]?.width || field.width || 200}px`
          : "auto";
        measureEl.style.maxWidth = "500px";
        measureEl.textContent = value;
        document.body.appendChild(measureEl);

        const measuredWidth = measureEl.scrollWidth;
        const measuredHeight = measureEl.scrollHeight;
        document.body.removeChild(measureEl);

        const currentDims = fieldDimensions[fieldId];
        const baseWidth = currentDims?.width || field.width || 200;
        const baseHeight = currentDims?.height || field.height || 50;

        // Calculer les nouvelles dimensions
        let newWidth = baseWidth;
        let newHeight = baseHeight;

        if (textOptions.wordWrap) {
          // Avec retour à la ligne : garder la largeur, ajuster la hauteur
          newHeight = Math.max(50, measuredHeight + 16);
        } else {
          // Sans retour à la ligne : ajuster la largeur, garder la hauteur minimale
          newWidth = Math.max(200, Math.min(measuredWidth + 16, 500));
          newHeight = Math.max(50, measuredHeight + 16);
        }

        setFieldDimensions((prev) => ({
          ...prev,
          [fieldId]: {
            ...prev[fieldId],
            width: newWidth,
            height: newHeight,
            x: prev[fieldId]?.x ?? field.x,
            y: prev[fieldId]?.y ?? field.y,
          },
        }));
      }, 10);
    }
  };

  const handleSaveSignature = (dataUrl: string) => {
    if (activeField) {
      // Si c'est une initiale et que la checkbox est cochée, appliquer à tous les champs INITIAL vides
      if (
        applyToAllInitials &&
        (activeField.type === FieldType.INITIAL ||
          (activeField.type === FieldType.SIGNATURE &&
            activeField.signatureSubType === "initial"))
      ) {
        const initialFields =
          envelope?.fields.filter(
            (f) =>
              f.recipientId === currentSignerId &&
              (f.type === FieldType.INITIAL ||
                (f.type === FieldType.SIGNATURE &&
                  f.signatureSubType === "initial")) &&
              !fieldValues[f.id]
          ) || [];

        // Appliquer la signature à tous les champs INITIAL vides
        const newFieldValues = { ...fieldValues };
        initialFields.forEach((field) => {
          newFieldValues[field.id] = dataUrl;
        });
        setFieldValues(newFieldValues);
      } else {
        // Sinon, appliquer seulement au champ actif
        handleFieldChange(activeField.id, dataUrl);
      }
    }
    setApplyToAllInitials(false);
    setActiveField(null);
  };

  const handleDateFieldClick = (fieldId: string) => {
    const today = new Date().toLocaleDateString("fr-FR");
    setFieldValues((prev) => ({ ...prev, [fieldId]: today }));
  };

  // Handlers pour déplacer et redimensionner les champs
  const handleFieldMouseDown = (
    e: React.MouseEvent | React.TouchEvent,
    fieldId: string
  ) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault(); // 🔧 FIX MOBILE : Empêcher le scroll pendant le drag
    const field = envelope?.fields.find((f) => f.id === fieldId);
    if (!field) return;

    setDraggingField(fieldId);
    setHasDragged(false);

    const customDims = fieldDimensions[fieldId];
    const { width: defaultWidth, height: defaultHeight } =
      getDefaultFieldDimensions(field.type, field.width, field.height);

    // 🔧 FIX MOBILE : Gérer les événements touch
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    // 🔧 FIX POSITIONNEMENT : Convertir les coordonnées relatives au page wrapper
    const pageWrapper = pageRefs.current[field.page - 1];
    const pageRect = pageWrapper?.getBoundingClientRect();
    const viewerRect = viewerRef.current?.getBoundingClientRect();

    let adjustedX = clientX;
    let adjustedY = clientY;

    if (pageRect && viewerRect) {
      adjustedX = clientX - viewerRect.left;
      adjustedY = clientY - viewerRect.top;
    }

    setInitialDimensions({
      width: customDims?.width || defaultWidth,
      height: customDims?.height || defaultHeight,
      x: customDims?.x || field.x,
      y: customDims?.y || field.y,
      mouseX: adjustedX,
      mouseY: adjustedY,
    });
  };

  const handleResizeMouseDown = (
    e: React.MouseEvent | React.TouchEvent,
    fieldId: string,
    field: Field
  ) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault(); // 🔧 FIX MOBILE : Empêcher le scroll pendant le resize
    setResizingField(fieldId);
    const customDims = fieldDimensions[fieldId];
    const { width: defaultWidth, height: defaultHeight } =
      getDefaultFieldDimensions(field.type, field.width, field.height);

    // 🔧 FIX MOBILE : Gérer les événements touch
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    // 🔧 FIX POSITIONNEMENT : Convertir les coordonnées relatives au page wrapper
    const viewerRect = viewerRef.current?.getBoundingClientRect();
    let adjustedX = clientX;
    let adjustedY = clientY;

    if (viewerRect) {
      adjustedX = clientX - viewerRect.left;
      adjustedY = clientY - viewerRect.top;
    }

    setInitialDimensions({
      width: customDims?.width || defaultWidth,
      height: customDims?.height || defaultHeight,
      x: customDims?.x || field.x,
      y: customDims?.y || field.y,
      mouseX: adjustedX,
      mouseY: adjustedY,
    });
  };

  // 📱 Pinch-to-zoom : Détecter le geste tactile à 2 doigts pour redimensionner
  const handleFieldTouchStart = (
    e: React.TouchEvent,
    fieldId: string,
    field: Field
  ) => {
    if (readOnly || e.touches.length !== 2) return;

    e.preventDefault();
    setPinchingField(fieldId);

    // Calculer la distance entre les 2 doigts
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const distance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
    setPinchDistance(distance);
  };

  const handleFieldTouchMove = (
    e: React.TouchEvent,
    fieldId: string,
    field: Field
  ) => {
    if (
      readOnly ||
      !pinchingField ||
      pinchingField !== fieldId ||
      e.touches.length !== 2 ||
      !pinchDistance
    )
      return;

    e.preventDefault();

    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const newDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );

    // Calculer le ratio de zoom
    const ratio = newDistance / pinchDistance;
    const customDims = fieldDimensions[fieldId];
    const { width: defaultWidth, height: defaultHeight } =
      getDefaultFieldDimensions(field.type, field.width, field.height);

    const currentWidth = customDims?.width ?? defaultWidth;
    const currentHeight = customDims?.height ?? defaultHeight;

    // Appliquer le zoom avec limites
    const newWidth = snapToGrid(
      Math.max(50, Math.min(500, currentWidth * ratio))
    );
    const newHeight = snapToGrid(
      Math.max(30, Math.min(400, currentHeight * ratio))
    );

    setTempTransform({
      fieldId,
      dx: 0,
      dy: 0,
      width: newWidth,
      height: newHeight,
    });

    setDimensionTooltip({
      x: touch1.clientX,
      y: touch1.clientY,
      width: Math.round(newWidth),
      height: Math.round(newHeight),
    });
  };

  const handleFieldTouchEnd = () => {
    if (tempTransform && envelope) {
      const field = envelope.fields.find((f) => f.id === tempTransform.fieldId);
      if (field) {
        const customDims = fieldDimensions[tempTransform.fieldId];
        const { width: defaultWidth, height: defaultHeight } =
          getDefaultFieldDimensions(field.type, field.width, field.height);

        setFieldDimensions((prev) => ({
          ...prev,
          [tempTransform.fieldId]: {
            x: customDims?.x ?? field.x,
            y: customDims?.y ?? field.y,
            width: tempTransform.width ?? defaultWidth,
            height: tempTransform.height ?? defaultHeight,
          },
        }));
      }
    }

    setPinchingField(null);
    setPinchDistance(null);
    setTempTransform(null);
    setDimensionTooltip(null);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      // 🔧 FIX MOBILE : Gérer les événements touch
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      if (draggingField && envelope) {
        // Calculer le déplacement total depuis le début
        const totalDx = (clientX - initialDimensions.mouseX) / zoomLevel;
        const totalDy = (clientY - initialDimensions.mouseY) / zoomLevel;

        // Détecter si on a vraiment déplacé (mouvement > 5px)
        if (Math.abs(totalDx) > 5 || Math.abs(totalDy) > 5) {
          setHasDragged(true);
        }

        // Appliquer le snap à la position finale
        const snappedDx =
          snapToGrid(initialDimensions.x + totalDx) - initialDimensions.x;
        const snappedDy =
          snapToGrid(initialDimensions.y + totalDy) - initialDimensions.y;

        setTempTransform({
          fieldId: draggingField,
          dx: snappedDx,
          dy: snappedDy,
        });

        // Afficher le tooltip avec les dimensions
        setDimensionTooltip({
          x: clientX,
          y: clientY,
          width: Math.round(initialDimensions.width),
          height: Math.round(initialDimensions.height),
        });
      }

      if (resizingField && envelope) {
        const field = envelope.fields.find((f) => f.id === resizingField);
        if (!field) return;

        const deltaX = (clientX - initialDimensions.mouseX) / zoomLevel;
        const deltaY = (clientY - initialDimensions.mouseY) / zoomLevel;

        // 🎨 Pour checkbox, signature et paraphe : maintenir le ratio homothétique
        if (
          field.type === FieldType.CHECKBOX ||
          field.type === FieldType.SIGNATURE ||
          field.type === FieldType.INITIAL
        ) {
          const delta = Math.max(deltaX, deltaY);
          const ratio = initialDimensions.width / initialDimensions.height;
          const newWidth = snapToGrid(
            Math.max(20, initialDimensions.width + delta)
          );
          const newHeight = snapToGrid(
            Math.max(20, (initialDimensions.width + delta) / ratio)
          );

          setTempTransform({
            fieldId: resizingField,
            dx: 0,
            dy: 0,
            width: newWidth,
            height: newHeight,
          });

          // Afficher le tooltip avec les dimensions
          setDimensionTooltip({
            x: clientX,
            y: clientY,
            width: Math.round(newWidth),
            height: Math.round(newHeight),
          });
        } else {
          // Pour les autres champs (texte, date) : redimensionnement libre
          const newWidth = snapToGrid(
            Math.max(50, initialDimensions.width + deltaX)
          );
          const newHeight = snapToGrid(
            Math.max(30, initialDimensions.height + deltaY)
          );

          setTempTransform({
            fieldId: resizingField,
            dx: 0,
            dy: 0,
            width: newWidth,
            height: newHeight,
          });

          // Afficher le tooltip avec les dimensions
          setDimensionTooltip({
            x: clientX,
            y: clientY,
            width: Math.round(newWidth),
            height: Math.round(newHeight),
          });
        }
      }
    };

    const handleMouseUp = () => {
      // Appliquer les changements définitifs
      if (tempTransform && envelope) {
        const field = envelope.fields.find(
          (f) => f.id === tempTransform.fieldId
        );
        if (field) {
          const customDims = fieldDimensions[tempTransform.fieldId];
          const currentX = customDims?.x ?? field.x;
          const currentY = customDims?.y ?? field.y;

          const { width: defaultWidth, height: defaultHeight } =
            getDefaultFieldDimensions(field.type, field.width, field.height);
          const currentWidth = customDims?.width ?? defaultWidth;
          const currentHeight = customDims?.height ?? defaultHeight;

          setFieldDimensions((prev) => ({
            ...prev,
            [tempTransform.fieldId]: {
              x: currentX + tempTransform.dx,
              y: currentY + tempTransform.dy,
              width: tempTransform.width ?? currentWidth,
              height: tempTransform.height ?? currentHeight,
            },
          }));
        }
      }

      setDraggingField(null);
      setResizingField(null);
      setDimensionTooltip(null);
      setTempTransform(null);

      // Réinitialiser hasDragged après un court délai pour éviter le onClick immédiat
      setTimeout(() => setHasDragged(false), 100);
    };

    if (draggingField || resizingField) {
      // 🔧 FIX MOBILE : Ajouter les événements touch
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
  }, [
    draggingField,
    resizingField,
    initialDimensions,
    fieldDimensions,
    envelope,
    zoomLevel,
    readOnly,
    tempTransform,
  ]);

  const handleReject = async (reason: string) => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      const result = await rejectSignature(token, reason);
      if (result.success) {
        addToast("Document rejeté avec succès.", "success");
        // ✅ Le dashboard se mettra à jour automatiquement via le listener en temps réel
        navigate("/dashboard");
      } else {
        throw new Error("Rejection failed");
      }
    } catch (err) {
      addToast("Échec du rejet. Veuillez réessayer.", "error");
    } finally {
      setIsSubmitting(false);
      setIsRejectModalOpen(false);
    }
  };

  const handleDownload = async () => {
    if (!envelope) return;

    addToast("Téléchargement en cours...", "info");
    const result = await downloadDocument(
      envelope.document.id,
      envelope.document.name
    );

    if (result.success) {
      addToast("Document téléchargé avec succès !", "success");
    } else {
      addToast(result.error || "Erreur lors du téléchargement", "error");
    }
  };

  const handleSubmit = async () => {
    if (!token || !envelope) return;
    if (!signerName.trim()) {
      addToast("Veuillez entrer votre nom avant de terminer.", "error");
      return;
    }

    // Vérifier UNIQUEMENT les champs MANUELS (pas DATE)
    const manualFieldsToCheck = signableFields.filter(
      (f) => f.type !== FieldType.DATE
    );

    const missingFields = manualFieldsToCheck.filter((field) => {
      const value = fieldValues[field.id];

      if (field.type === FieldType.TEXT) {
        return !value || typeof value !== "string" || value.trim().length === 0;
      } else if (field.type === FieldType.CHECKBOX) {
        return value !== true;
      } else if (
        field.type === FieldType.SIGNATURE ||
        field.type === FieldType.INITIAL
      ) {
        return !value || typeof value !== "string" || value.length === 0;
      }
      return false;
    });

    if (missingFields.length > 0) {
      addToast("Veuillez remplir tous les champs requis.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedFields: Field[] = envelope.fields.map((field) => ({
        ...field,
        value: fieldValues[field.id],
      }));
      const result = await submitSignature(token, updatedFields);
      if (result.success) {
        addToast("Document signé avec succès !", "success");
        // ✅ Le dashboard se mettra à jour automatiquement via le listener en temps réel
        navigate("/dashboard");
      } else {
        throw new Error("Signature submission failed");
      }
    } catch (err) {
      addToast(
        "Échec de la soumission de la signature. Veuillez réessayer.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const PdfPageRenderer = ({
    pageNum,
    zoom,
  }: {
    pageNum: number;
    zoom: number;
  }) => {
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

          const viewport = page.getViewport({ scale: zoom });
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
    }, [pdf, pageNum, zoom]);

    return <canvas ref={canvasRef} />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto text-center py-20">
        <AlertTriangle className="mx-auto h-12 w-12 text-error" />
        <h2 className="mt-4 text-2xl font-bold">
          Impossible de charger le document
        </h2>
        <p className="mt-2 text-onSurfaceVariant">{error}</p>
        <Button
          variant="gradient"
          withGlow
          withShine
          onClick={() => navigate("/dashboard")}
          className="mt-6"
        >
          Aller au tableau de bord
        </Button>
      </div>
    );
  }

  if (!token || token === ":token") {
    return (
      <div className="container mx-auto text-center py-20">
        <AlertTriangle className="mx-auto h-12 w-12 text-error" />
        <h2 className="mt-4 text-2xl font-bold">Lien de signature invalide</h2>
        <p className="mt-2 text-onSurfaceVariant">
          Le lien que vous avez utilisé n'est pas valide. Veuillez vérifier
          votre email de signature.
        </p>
        <Button
          variant="gradient"
          withGlow
          withShine
          onClick={() => navigate("/dashboard")}
          className="mt-6"
        >
          Aller au tableau de bord
        </Button>
      </div>
    );
  }

  if (!envelope || !pdf) return null;

  // CHAMPS MANUELS = tous les champs SAUF DATE (car pré-remplie)
  const manualFields = signableFields.filter((f) => f.type !== FieldType.DATE);

  // Compter les champs MANUELS remplis
  let manualFieldsFilledCount = 0;
  manualFields.forEach((field) => {
    const value = fieldValues[field.id];

    if (field.type === FieldType.TEXT) {
      if (value && typeof value === "string" && value.trim().length > 0) {
        manualFieldsFilledCount++;
      }
    } else if (field.type === FieldType.CHECKBOX) {
      if (value === true) {
        manualFieldsFilledCount++;
      }
    } else if (
      field.type === FieldType.SIGNATURE ||
      field.type === FieldType.INITIAL
    ) {
      if (value && typeof value === "string" && value.length > 0) {
        manualFieldsFilledCount++;
      }
    }
  });

  // TOUS les champs manuels sont-ils remplis ? (SANS DATE)
  const allManualFieldsFilled =
    manualFields.length > 0 && manualFieldsFilledCount === manualFields.length;

  const isCompleted =
    envelope.document.status === DocumentStatus.SIGNED ||
    envelope.document.status === DocumentStatus.REJECTED;

  const FieldTooltip: React.FC<{ field: Field; recipientName: string }> = ({
    field,
    recipientName,
  }) => {
    // Déterminer le label selon le type et sous-type
    const isParaphe =
      field.type === FieldType.SIGNATURE &&
      field.signatureSubType === "initial";
    const displayLabel = isParaphe ? "Paraphe" : field.type;

    return (
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-inverseSurface text-inverseOnSurface text-xs rounded-lg shadow-lg p-2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-10 scale-95 group-hover:scale-100 origin-bottom">
        <strong>{displayLabel}</strong>
        <span className="text-inverseOnSurface/80"> pour {recipientName}</span>
      </div>
    );
  };

  // 🎯 Composant wrapper avec @use-gesture/react pour gestes tactiles optimisés
  const DraggableField: React.FC<{
    field: Field;
    children: React.ReactNode;
    isCurrentSignerField: boolean;
    onFieldClick?: () => void;
    hasValue?: boolean; // Indique si le champ a une valeur (pour désactiver le drag si vide)
  }> = ({
    field,
    children,
    isCurrentSignerField,
    onFieldClick,
    hasValue = false,
  }) => {
    const fieldRef = useRef<HTMLDivElement>(null);

    if (readOnly || !isCurrentSignerField) {
      return <div onClick={onFieldClick}>{children}</div>;
    }

    // Si le champ n'a pas de valeur, ne pas permettre le drag
    if (!hasValue) {
      return (
        <div onClick={onFieldClick} style={{ touchAction: "none" }}>
          {children}
        </div>
      );
    }

    // 🖐️ Hook useDrag pour déplacer le champ (souris + tactile) - seulement si le champ a une valeur
    const bindDrag = useDrag(
      ({ active, movement: [mx, my], first, last, event }) => {
        event?.stopPropagation();

        if (first) {
          setDraggingField(field.id);
          setHasDragged(false);
        }

        if (active) {
          const dx = mx / zoomLevel;
          const dy = my / zoomLevel;

          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            setHasDragged(true);
          }

          setTempTransform({
            fieldId: field.id,
            dx: snapToGrid(dx),
            dy: snapToGrid(dy),
          });
        }

        if (last) {
          const dx = mx / zoomLevel;
          const dy = my / zoomLevel;
          const customDims = fieldDimensions[field.id];
          const newX = snapToGrid((customDims?.x ?? field.x) + dx);
          const newY = snapToGrid((customDims?.y ?? field.y) + dy);

          setFieldDimensions((prev) => ({
            ...prev,
            [field.id]: {
              ...prev[field.id],
              x: newX,
              y: newY,
              width: customDims?.width ?? field.width,
              height: customDims?.height ?? field.height,
            },
          }));

          setTempTransform(null);
          setDraggingField(null);

          // Reset hasDragged après un délai pour permettre le clic
          setTimeout(() => setHasDragged(false), 50);
        }
      },
      {
        filterTaps: true,
        pointer: { touch: true },
      }
    );

    // 🤏 Hook usePinch pour redimensionner avec 2 doigts
    const bindPinch = usePinch(
      ({ active, offset: [scale], first, last }) => {
        if (first) {
          setPinchingField(field.id);
        }

        if (active) {
          const customDims = fieldDimensions[field.id];
          const { width: defaultWidth, height: defaultHeight } =
            getDefaultFieldDimensions(field.type, field.width, field.height);
          const currentWidth = customDims?.width ?? defaultWidth;
          const currentHeight = customDims?.height ?? defaultHeight;

          const newWidth = Math.max(50, currentWidth * scale);
          const newHeight = Math.max(30, currentHeight * scale);

          setTempTransform({
            fieldId: field.id,
            dx: 0,
            dy: 0,
            width: newWidth,
            height: newHeight,
          });
        }

        if (last) {
          const customDims = fieldDimensions[field.id];
          const { width: defaultWidth, height: defaultHeight } =
            getDefaultFieldDimensions(field.type, field.width, field.height);
          const currentWidth = customDims?.width ?? defaultWidth;
          const currentHeight = customDims?.height ?? defaultHeight;

          const newWidth = Math.max(50, currentWidth * scale);
          const newHeight = Math.max(30, currentHeight * scale);

          setFieldDimensions((prev) => ({
            ...prev,
            [field.id]: {
              ...prev[field.id],
              x: customDims?.x ?? field.x,
              y: customDims?.y ?? field.y,
              width: newWidth,
              height: newHeight,
            },
          }));

          setTempTransform(null);
          setPinchingField(null);
        }
      },
      {
        scaleBounds: { min: 0.5, max: 3 },
        rubberband: true,
      }
    );

    return (
      <div
        ref={fieldRef}
        {...bindDrag()}
        {...bindPinch()}
        onClick={!hasDragged ? onFieldClick : undefined}
        style={{ touchAction: "none" }}
        className={
          draggingField === field.id || pinchingField === field.id
            ? "cursor-move"
            : ""
        }
      >
        {children}
      </div>
    );
  };

  const renderField = (field: Field) => {
    const value = fieldValues[field.id];
    const customDims = fieldDimensions[field.id];
    let x = customDims?.x ?? field.x;
    let y = customDims?.y ?? field.y;

    // Utiliser les dimensions exactes du champ depuis PrepareDocumentPage
    // Ne pas utiliser getDefaultFieldDimensions qui peut changer les dimensions
    let width = customDims?.width ?? field.width;
    let height = customDims?.height ?? field.height;

    // Appliquer la transformation temporaire si le champ est en cours de déplacement/redimensionnement
    const isBeingManipulated = tempTransform?.fieldId === field.id;
    if (isBeingManipulated && tempTransform) {
      x += tempTransform.dx;
      y += tempTransform.dy;
      if (tempTransform.width !== undefined) width = tempTransform.width;
      if (tempTransform.height !== undefined) height = tempTransform.height;
    }

    // Style de base pour les champs non-signature (DATE, TEXT, CHECKBOX)
    const baseStyle: React.CSSProperties = {
      position: "absolute",
      left: `${x * zoomLevel}px`,
      top: `${y * zoomLevel}px`,
      width: `${width * zoomLevel}px`,
      height: `${height * zoomLevel}px`,
      // Ajouter un contour lors de la manipulation
      ...(isBeingManipulated
        ? {
            outline: "3px solid var(--md-sys-color-primary)",
            outlineOffset: "2px",
            transition: "none",
          }
        : {}),
    };

    const recipient = envelope.recipients.find(
      (r) => r.id === field.recipientId
    );
    const recipientName = recipient?.name || "Utilisateur assigné";
    const isCurrentSignerField = field.recipientId === currentSignerId;

    // Couleurs pour les destinataires (même que PrepareDocumentPage)
    const recipientColors = [
      "#3B82F6",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
    ];
    const color = recipient
      ? recipientColors[recipient.id.charCodeAt(0) % recipientColors.length]
      : "#71717A";

    // Fonction helper pour convertir une couleur hex en rgba avec opacité
    const hexToRgba = (hex: string, opacity: number): string => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    // Style pour le conteneur externe (avec bordure colorée en hover/sélection avec 50% opacité)
    // Les coordonnées représentent le contenu interne
    // Le conteneur externe est décalé de -15px et agrandi de +30px (15px de chaque côté)
    const outerStyle: React.CSSProperties = {
      position: "absolute",
      left: `${(x - 15) * zoomLevel}px`,
      top: `${(y - 15) * zoomLevel}px`,
      width: `${(width + 30) * zoomLevel}px`, // +30px pour les 15px de chaque côté
      height: `${(height + 30) * zoomLevel}px`, // +30px pour les 15px de chaque côté
      padding: `${15 * zoomLevel}px`,
      touchAction: "none",
    };

    // Style pour le conteneur interne (contenu avec bordure colorée)
    const innerStyle: React.CSSProperties = {
      width: "100%",
      height: "100%",
      border: `2px solid ${color}`,
      backgroundColor: `${color}20`,
      cursor: value ? "move" : "pointer",
      position: "relative",
    };

    const fieldIndexInSignable = signableFields.findIndex(
      (sf) => sf.id === field.id
    );
    const isCurrentActiveField =
      !readOnly &&
      isCurrentSignerField &&
      currentFieldIndex === fieldIndexInSignable;

    // Pour les champs d'autres destinataires, afficher la valeur si elle existe
    if (!isCurrentSignerField) {
      // Si le champ a une valeur (signé), l'afficher
      if (value) {
        if (
          field.type === FieldType.SIGNATURE ||
          field.type === FieldType.INITIAL
        ) {
          return (
            <div
              style={baseStyle}
              className="bg-surface rounded-md border border-outlineVariant flex items-center justify-center p-1"
            >
              <img
                src={String(value)}
                alt={
                  field.type === FieldType.SIGNATURE &&
                  field.signatureSubType === "initial"
                    ? "paraphe"
                    : "signature"
                }
                className="object-contain w-full h-full"
              />
            </div>
          );
        } else if (field.type === FieldType.DATE) {
          return (
            <div
              style={baseStyle}
              className="bg-surface rounded-md border border-outlineVariant flex items-center justify-center"
            >
              <span className="text-sm font-semibold text-onSurface">
                {String(value)}
              </span>
            </div>
          );
        } else if (field.type === FieldType.TEXT) {
          return (
            <div
              style={baseStyle}
              className="bg-surface rounded-md border border-outlineVariant flex items-center justify-start p-2"
            >
              <span className="text-sm text-onSurface whitespace-pre-wrap break-words">
                {String(value)}
              </span>
            </div>
          );
        } else if (field.type === FieldType.CHECKBOX) {
          return (
            <div
              style={baseStyle}
              className="bg-surface rounded-md border border-outlineVariant flex items-center justify-center"
            >
              {value === true && (
                <CheckSquare className="h-full w-full text-primary" />
              )}
            </div>
          );
        }
      }
      // Si pas de valeur, afficher le placeholder
      // Déterminer le label selon le type et sous-type
      const isParaphe =
        field.type === FieldType.SIGNATURE &&
        field.signatureSubType === "initial";
      const displayLabel = isParaphe ? "Paraphe" : field.type;

      return (
        <div
          style={baseStyle}
          className="bg-surfaceVariant/50 rounded-md border border-dashed border-outlineVariant flex items-center justify-center opacity-70"
        >
          <span
            className="text-xs text-onSurfaceVariant font-semibold truncate px-1"
            title={`${displayLabel} pour ${recipientName}`}
          >
            {displayLabel} pour {recipientName}
          </span>
        </div>
      );
    }

    if (readOnly && !value) {
      return null; // Don't render empty fields for other people in read-only mode
    }

    const interactiveClasses =
      readOnly || !isCurrentSignerField
        ? ""
        : `cursor-pointer transition-colors hover:bg-primary/20`;
    const fieldWrapperStyle = {
      border: `2px ${isCurrentActiveField ? "solid" : "dashed"} ${
        value || isCurrentActiveField
          ? isCurrentActiveField
            ? "var(--md-sys-color-tertiary)"
            : "transparent"
          : "var(--md-sys-color-primary)"
      }`,
      backgroundColor: value ? "transparent" : "rgba(37, 99, 235, 0.08)",
      borderRadius: "8px",
    };

    // Handlers pour onClick qui vérifient si on a draggé
    const handleSignatureClick = () => {
      if (!hasDragged && !readOnly && isCurrentSignerField) {
        setActiveField(field);
      }
    };

    const handleDateClick = (fieldId?: string) => {
      if (!hasDragged && !readOnly && isCurrentSignerField) {
        handleDateFieldClick(fieldId || field.id);
      }
    };

    switch (field.type) {
      case FieldType.SIGNATURE:
      case FieldType.INITIAL:
        return value && isCurrentSignerField && !readOnly ? (
          <DraggableSignature
            key={field.id}
            id={field.id}
            signatureData={String(value)}
            x={x}
            y={y}
            width={width}
            height={height}
            zoomLevel={zoomLevel}
            currentPage={field.page}
            totalPages={pdf?.numPages || 1}
            pageDimensions={pageDimensions}
            pageRefs={pageRefs}
            viewerRef={viewerRef}
            onUpdate={(id, updates) => {
              setFieldDimensions((prev) => ({
                ...prev,
                [id]: {
                  ...prev[id],
                  x: updates.x ?? prev[id]?.x ?? field.x,
                  y: updates.y ?? prev[id]?.y ?? field.y,
                  width: updates.width ?? prev[id]?.width ?? width,
                  height: updates.height ?? prev[id]?.height ?? height,
                },
              }));
            }}
            onRemove={() => handleFieldChange(field.id, "")}
            maxWidth={pageDimensions[field.page - 1]?.width || 600}
            maxHeight={pageDimensions[field.page - 1]?.height || 800}
          />
        ) : (
          <div
            style={{
              ...outerStyle,
              borderColor: "transparent",
            }}
            className="group border-2 transition-all"
            onMouseEnter={(e) => {
              const borderColorWithOpacity = hexToRgba(color, 0.5);
              e.currentTarget.style.borderColor = borderColorWithOpacity;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            <FieldTooltip field={field} recipientName={recipientName} />
            <DraggableField
              field={field}
              isCurrentSignerField={isCurrentSignerField}
              onFieldClick={handleSignatureClick}
              hasValue={!!value}
            >
              {/* Conteneur interne avec le contenu */}
              <div
                style={innerStyle}
                className="w-full h-full flex flex-col justify-center items-center text-xs p-1"
              >
                {value ? (
                  <img
                    src={String(value)}
                    alt={
                      field.type === FieldType.SIGNATURE &&
                      field.signatureSubType === "initial"
                        ? "paraphe"
                        : "signature"
                    }
                    className="object-contain w-full h-full pointer-events-none"
                  />
                ) : (
                  <div className="text-center pointer-events-none">
                    <span
                      style={{ color: color, fontSize: `${12 * zoomLevel}px` }}
                      className="font-semibold block"
                    >
                      <Signature
                        style={{
                          color: color,
                          width: `${14 * zoomLevel}px`,
                          height: `${14 * zoomLevel}px`,
                        }}
                        className="inline-block mr-1"
                      />
                      {field.type === FieldType.SIGNATURE &&
                      field.signatureSubType === "initial"
                        ? "Cliquez pour parapher"
                        : "Cliquez pour signer"}
                    </span>
                    <span
                      style={{ color: color, fontSize: `${9 * zoomLevel}px` }}
                      className="font-medium truncate opacity-80 mt-1"
                    >
                      {signerName}
                    </span>
                  </div>
                )}
              </div>
            </DraggableField>
          </div>
        );
      case FieldType.DATE:
        return (
          <div
            style={{
              ...outerStyle,
              borderColor:
                selectedFieldId === field.id
                  ? hexToRgba(color, 0.5)
                  : "transparent",
            }}
            className="group border-2 transition-all"
            onMouseEnter={(e) => {
              if (selectedFieldId !== field.id) {
                const borderColorWithOpacity = hexToRgba(color, 0.5);
                e.currentTarget.style.borderColor = borderColorWithOpacity;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedFieldId !== field.id) {
                e.currentTarget.style.borderColor = "transparent";
              }
            }}
          >
            <DraggableFieldUnified
              id={field.id}
              x={x}
              y={y}
              width={width}
              height={height}
              zoomLevel={zoomLevel}
              color={color}
              onUpdate={(id, updates) => {
                setFieldDimensions((prev) => ({
                  ...prev,
                  [id]: {
                    ...prev[id],
                    x: updates.x ?? prev[id]?.x ?? field.x,
                    y: updates.y ?? prev[id]?.y ?? field.y,
                    width: updates.width ?? prev[id]?.width ?? width,
                    height: updates.height ?? prev[id]?.height ?? height,
                  },
                }));
              }}
              maxWidth={pageDimensions[field.page - 1]?.width || 600}
              maxHeight={pageDimensions[field.page - 1]?.height || 800}
              isSelected={selectedFieldId === field.id}
              onSelect={() => {
                if (!readOnly && isCurrentSignerField) {
                  setSelectedFieldId(field.id);
                  if (!hasDragged) {
                    handleDateClick(field.id);
                  }
                }
              }}
              showRemoveButton={!readOnly && isCurrentSignerField}
              onRemove={() => handleFieldChange(field.id, null)}
            >
              {/* Conteneur interne avec le contenu */}
              <div
                style={innerStyle}
                className="w-full h-full flex items-center justify-center text-xs p-1"
              >
                {value ? (
                  <span
                    style={{ color: color, fontSize: `${10 * zoomLevel}px` }}
                    className="font-bold pointer-events-none"
                  >
                    {String(value)}
                  </span>
                ) : (
                  <span
                    style={{ color: color, fontSize: `${10 * zoomLevel}px` }}
                    className="font-semibold pointer-events-none flex items-center gap-1"
                  >
                    <Calendar
                      style={{
                        color: color,
                        width: `${14 * zoomLevel}px`,
                        height: `${14 * zoomLevel}px`,
                      }}
                    />
                    Date
                  </span>
                )}
              </div>
            </DraggableFieldUnified>
          </div>
        );
      case FieldType.TEXT:
        const textValue = (value as string) || "";
        const textOptions = textFieldOptions[field.id] || {
          fontSize: field.textOptions?.fontSize || 12,
          lineHeight: field.textOptions?.lineHeight || 1.3,
          wordWrap: field.textOptions?.wordWrap !== false,
        };

        // Utiliser les dimensions personnalisées ou les dimensions par défaut
        const customDims = fieldDimensions[field.id];
        const finalWidth = customDims?.width ?? width;
        const finalHeight = customDims?.height ?? height;

        // Pour le champ TEXT, on utilise une structure avec bordure externe et padding
        return (
          <div
            style={{
              ...outerStyle,
              borderColor:
                selectedFieldId === field.id
                  ? hexToRgba(color, 0.5)
                  : "transparent",
            }}
            className="group border-2 transition-all"
            onMouseEnter={(e) => {
              if (selectedFieldId !== field.id) {
                const borderColorWithOpacity = hexToRgba(color, 0.5);
                e.currentTarget.style.borderColor = borderColorWithOpacity;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedFieldId !== field.id) {
                e.currentTarget.style.borderColor = "transparent";
              }
            }}
          >
            {/* Bouton options - sur la bordure externe, à gauche du bouton de suppression */}
            {isCurrentSignerField &&
              !readOnly &&
              selectedFieldId === field.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTextOptions(true);
                  }}
                  className="absolute -top-2.5 -left-2.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white z-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    touchAction: "none",
                    pointerEvents: "auto",
                    backgroundColor: color,
                  }}
                  title="Options de mise en page"
                >
                  <Settings size={12} style={{ color: "#ffffff" }} />
                </button>
              )}
            {/* Bouton de suppression - sur la bordure externe, en haut à droite */}
            {isCurrentSignerField &&
              !readOnly &&
              selectedFieldId === field.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFieldChange(field.id, "");
                  }}
                  className="delete-button absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white z-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    touchAction: "none",
                    pointerEvents: "auto",
                    backgroundColor: color,
                  }}
                  title="Supprimer le champ"
                >
                  <X size={12} style={{ color: "#ffffff" }} />
                </button>
              )}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
              }}
            >
              <DraggableFieldUnified
                id={field.id}
                x={0}
                y={0}
                width={finalWidth}
                height={finalHeight}
                zoomLevel={zoomLevel}
                color={color}
                onUpdate={(id, updates) => {
                  // Les coordonnées sont relatives au conteneur avec padding, on les convertit en absolues
                  setFieldDimensions((prev) => ({
                    ...prev,
                    [id]: {
                      ...prev[id],
                      x: (updates.x ?? 0) + (x - 15), // Convertir en coordonnées absolues
                      y: (updates.y ?? 0) + (y - 15), // Convertir en coordonnées absolues
                      width: updates.width ?? prev[id]?.width ?? finalWidth,
                      height: updates.height ?? prev[id]?.height ?? finalHeight,
                    },
                  }));
                }}
                maxWidth={finalWidth}
                maxHeight={finalHeight}
                isSelected={selectedFieldId === field.id}
                onSelect={() => {
                  if (!readOnly && isCurrentSignerField) {
                    setSelectedFieldId(field.id);
                  }
                }}
                showRemoveButton={false}
              >
                {/* Conteneur interne avec le contenu */}
                <div
                  style={innerStyle}
                  className="w-full h-full flex flex-col relative text-xs"
                >
                  <textarea
                    value={textValue}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      handleFieldChange(field.id, newValue);
                    }}
                    ref={(el) => {
                      if (el) {
                        textFieldRefs.current[field.id] = el;
                      }
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                      borderRadius: "0",
                      padding: "8px",
                      fontSize: `${textOptions.fontSize}px`,
                      backgroundColor: "transparent",
                      resize: "none",
                      fontFamily: "inherit",
                      lineHeight: textOptions.lineHeight,
                      overflow: textOptions.wordWrap ? "auto" : "hidden",
                      wordWrap: textOptions.wordWrap ? "break-word" : "normal",
                      whiteSpace: textOptions.wordWrap ? "pre-wrap" : "nowrap",
                      outline: "none",
                      textOverflow: textOptions.wordWrap ? "clip" : "ellipsis",
                      color: color,
                    }}
                    placeholder="Écrivez ici..."
                    readOnly={readOnly || !isCurrentSignerField}
                    onFocus={() => setCurrentFieldIndex(fieldIndexInSignable)}
                  />
                </div>
              </DraggableFieldUnified>
            </div>
          </div>
        );
      case FieldType.CHECKBOX:
        return (
          <div
            style={{
              ...outerStyle,
              borderColor:
                selectedFieldId === field.id
                  ? hexToRgba(color, 0.5)
                  : "transparent",
            }}
            className="group border-2 transition-all"
            onMouseEnter={(e) => {
              if (selectedFieldId !== field.id) {
                const borderColorWithOpacity = hexToRgba(color, 0.5);
                e.currentTarget.style.borderColor = borderColorWithOpacity;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedFieldId !== field.id) {
                e.currentTarget.style.borderColor = "transparent";
              }
            }}
          >
            <DraggableFieldUnified
              id={field.id}
              x={x}
              y={y}
              width={width}
              height={height}
              zoomLevel={zoomLevel}
              color={color}
              onUpdate={(id, updates) => {
                setFieldDimensions((prev) => ({
                  ...prev,
                  [id]: {
                    ...prev[id],
                    x: updates.x ?? prev[id]?.x ?? field.x,
                    y: updates.y ?? prev[id]?.y ?? field.y,
                    width: updates.width ?? prev[id]?.width ?? width,
                    height: updates.height ?? prev[id]?.height ?? height,
                  },
                }));
              }}
              maxWidth={pageDimensions[field.page - 1]?.width || 600}
              maxHeight={pageDimensions[field.page - 1]?.height || 800}
              isSelected={selectedFieldId === field.id}
              onSelect={() => {
                if (!readOnly && isCurrentSignerField) {
                  setSelectedFieldId(field.id);
                }
              }}
              showRemoveButton={!readOnly && isCurrentSignerField}
              onRemove={() => handleFieldChange(field.id, false)}
            >
              {/* Conteneur interne avec le contenu */}
              <div
                style={innerStyle}
                className="w-full h-full flex items-center justify-center text-xs p-1"
              >
                <label
                  className={`${
                    readOnly || !isCurrentSignerField ? "" : "cursor-pointer"
                  } pointer-events-none`}
                >
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) =>
                      handleFieldChange(field.id, e.target.checked)
                    }
                    className="pointer-events-auto"
                    style={{
                      width: `${Math.min(width * 0.7, 40) * zoomLevel}px`,
                      height: `${Math.min(height * 0.7, 40) * zoomLevel}px`,
                      accentColor: color,
                    }}
                    disabled={readOnly || !isCurrentSignerField}
                  />
                </label>
              </div>
            </DraggableFieldUnified>
          </div>
        );
      default:
        return null;
    }
  };

  // Calculer si on doit afficher la checkbox "Appliquer à toutes les initiales"
  const shouldShowApplyToAllInitials =
    activeField &&
    (activeField.type === FieldType.INITIAL ||
      (activeField.type === FieldType.SIGNATURE &&
        activeField.signatureSubType === "initial")) &&
    envelope &&
    currentSignerId &&
    envelope.fields.filter(
      (f) =>
        f.recipientId === currentSignerId &&
        (f.type === FieldType.INITIAL ||
          (f.type === FieldType.SIGNATURE &&
            f.signatureSubType === "initial")) &&
        !fieldValues[f.id]
    ).length >= 2;

  // Obtenir le champ texte actuel pour les options
  const currentTextField = selectedFieldId
    ? envelope?.fields.find(
        (f) => f.id === selectedFieldId && f.type === FieldType.TEXT
      )
    : null;
  const currentTextOptions = currentTextField
    ? textFieldOptions[currentTextField.id] || {
        fontSize: currentTextField.textOptions?.fontSize || 12,
        lineHeight: currentTextField.textOptions?.lineHeight || 1.3,
        wordWrap: currentTextField.textOptions?.wordWrap !== false,
      }
    : null;

  return (
    <>
      {activeField && (
        <SignaturePad
          onSave={handleSaveSignature}
          onCancel={() => {
            setApplyToAllInitials(false);
            setActiveField(null);
          }}
          signerName={signerName}
          initialTab={
            activeField.type === FieldType.SIGNATURE &&
            activeField.signatureSubType === "initial"
              ? "draw" // Paraphe = dessin, pas écriture
              : activeField.type === FieldType.INITIAL
              ? "type"
              : "draw"
          }
          isParaphe={
            activeField.type === FieldType.SIGNATURE &&
            activeField.signatureSubType === "initial"
          }
          showApplyToAll={shouldShowApplyToAllInitials}
          applyToAll={applyToAllInitials}
          onApplyToAllChange={setApplyToAllInitials}
          applyToAllLabel={
            activeField.type === FieldType.SIGNATURE &&
            activeField.signatureSubType === "initial"
              ? "Appliquer ce paraphe à tous les champs de paraphes vides"
              : "Appliquer cette initiale à tous les champs d'initiales vides"
          }
        />
      )}

      {/* Modal Options de mise en page pour le texte */}
      {showTextOptions && currentTextField && currentTextOptions && (
        <div
          className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-[100] p-2 sm:p-4 overflow-y-auto modal-backdrop"
          onClick={() => setShowTextOptions(false)}
        >
          <div
            className="bg-surface rounded-3xl shadow-xl w-full max-w-md p-4 sm:p-6 my-auto max-h-[95vh] overflow-y-auto modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-onSurface">
                Options de mise en page
              </h2>
              <button
                onClick={() => setShowTextOptions(false)}
                className="p-1 rounded-full hover:bg-surfaceVariant"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Taille de caractère */}
              <div>
                <label className="text-sm font-medium text-onSurfaceVariant mb-2 block">
                  Taille de caractère: {currentTextOptions.fontSize}px
                </label>
                <input
                  type="range"
                  min="8"
                  max="24"
                  step="1"
                  value={currentTextOptions.fontSize}
                  onChange={(e) => {
                    setTextFieldOptions((prev) => ({
                      ...prev,
                      [currentTextField.id]: {
                        ...prev[currentTextField.id],
                        fontSize: parseInt(e.target.value, 10),
                        lineHeight:
                          prev[currentTextField.id]?.lineHeight || 1.3,
                        wordWrap: prev[currentTextField.id]?.wordWrap !== false,
                      },
                    }));
                  }}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-onSurfaceVariant mt-1">
                  <span>8px</span>
                  <span>24px</span>
                </div>
              </div>

              {/* Hauteur de ligne */}
              <div>
                <label className="text-sm font-medium text-onSurfaceVariant mb-2 block">
                  Hauteur de ligne: {currentTextOptions.lineHeight.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="1"
                  max="2"
                  step="0.1"
                  value={currentTextOptions.lineHeight}
                  onChange={(e) => {
                    setTextFieldOptions((prev) => ({
                      ...prev,
                      [currentTextField.id]: {
                        ...prev[currentTextField.id],
                        fontSize: prev[currentTextField.id]?.fontSize || 12,
                        lineHeight: parseFloat(e.target.value),
                        wordWrap: prev[currentTextField.id]?.wordWrap !== false,
                      },
                    }));
                  }}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-onSurfaceVariant mt-1">
                  <span>1.0</span>
                  <span>2.0</span>
                </div>
              </div>

              {/* Retour à la ligne */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentTextOptions.wordWrap}
                    onChange={(e) => {
                      setTextFieldOptions((prev) => ({
                        ...prev,
                        [currentTextField.id]: {
                          ...prev[currentTextField.id],
                          fontSize: prev[currentTextField.id]?.fontSize || 12,
                          lineHeight:
                            prev[currentTextField.id]?.lineHeight || 1.3,
                          wordWrap: e.target.checked,
                        },
                      }));
                    }}
                    className="w-5 h-5 accent-primary"
                  />
                  <span className="text-sm font-medium text-onSurface">
                    Retour à la ligne automatique
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="text" onClick={() => setShowTextOptions(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {isRejectModalOpen && (
        <RejectModal
          onConfirm={handleReject}
          onCancel={() => setIsRejectModalOpen(false)}
          isLoading={isSubmitting}
        />
      )}
      <div className="bg-surface/80 backdrop-blur-sm p-4 shadow-sm sticky top-16 z-30 border-b border-outlineVariant">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex-grow min-w-0">
            <h1
              className="text-xl font-bold truncate text-onSurface"
              title={envelope.document.name}
            >
              {envelope.document.name}
            </h1>
            {envelope.document.status === DocumentStatus.SIGNED && readOnly ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                <div className="bg-tertiaryContainer text-onTertiaryContainer px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 h-7">
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="whitespace-nowrap">Document signé</span>
                  <span className="mx-0.5">•</span>
                  <span className="font-mono text-[10px]">
                    {envelope.document.id}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(envelope.document.id);
                      addToast("Numéro de document copié", "success");
                    }}
                    className="hover:bg-onTertiaryContainer/10 rounded p-1 transition-colors flex-shrink-0 ml-0.5 flex items-center justify-center"
                    title="Copier le numéro de document"
                    style={{ minWidth: "24px", minHeight: "24px" }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm text-onSurfaceVariant">
                  {(() => {
                    const signer = envelope.recipients.find(
                      (r) => r.id === envelope.currentSignerId
                    );
                    return signer
                      ? `${signer.name} (${signer.email}) a signé ce document • Mode lecture seule`
                      : "Mode lecture seule";
                  })()}
                </p>
              </div>
            ) : envelope.document.status === DocumentStatus.SIGNED ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                <div className="bg-tertiaryContainer text-onTertiaryContainer px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 h-7">
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="whitespace-nowrap">Document signé</span>
                </div>
                <p className="text-sm text-onSurfaceVariant">
                  {(() => {
                    const signer = envelope.recipients.find(
                      (r) => r.id === envelope.currentSignerId
                    );
                    return signer
                      ? `${signer.name} (${signer.email}) a signé ce document • Mode lecture seule`
                      : "Mode lecture seule";
                  })()}
                </p>
              </div>
            ) : readOnly && envelope?.document?.id ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                <div className="bg-tertiaryContainer text-onTertiaryContainer px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 h-7">
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="whitespace-nowrap">Mode lecture seule</span>
                  {(() => {
                    // Vérifier si le document est signé (par statut ou par vérification des champs)
                    const status = envelope.document.status as
                      | DocumentStatus
                      | string;
                    const isSigned =
                      status === DocumentStatus.SIGNED ||
                      (typeof status === "string" && status === "Signé") ||
                      (envelope.fields.some(
                        (f) =>
                          f.type === FieldType.SIGNATURE ||
                          f.type === FieldType.INITIAL
                      ) &&
                        envelope.fields
                          .filter(
                            (f) =>
                              f.type === FieldType.SIGNATURE ||
                              f.type === FieldType.INITIAL
                          )
                          .every((f) => f.value));
                    return isSigned;
                  })() && (
                    <>
                      <span className="mx-0.5">•</span>
                      <span className="font-mono text-[10px]">
                        {envelope.document.id}
                      </span>
                      <button
                        onClick={() => {
                          if (envelope?.document?.id) {
                            navigator.clipboard.writeText(envelope.document.id);
                            addToast("Numéro de document copié", "success");
                          }
                        }}
                        className="hover:bg-onTertiaryContainer/10 rounded p-1 transition-colors flex-shrink-0 ml-0.5 flex items-center justify-center"
                        title="Copier le numéro de document"
                        style={{ minWidth: "24px", minHeight: "24px" }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : alreadySigned ? (
              <p className="text-sm text-onSurfaceVariant">
                Document en cours de signature
              </p>
            ) : (
              <p className="text-sm text-onSurfaceVariant">{`Signature requise pour : ${signerName}`}</p>
            )}
          </div>
          <div className="flex items-center gap-4 flex-wrap w-full sm:w-auto">
            {!isCompleted && !readOnly && (
              <Button
                variant="text"
                icon={XCircle}
                onClick={() => setIsRejectModalOpen(true)}
              >
                Rejeter le document
              </Button>
            )}
            {/* Bouton Télécharger - Actif uniquement si au moins une signature a été appliquée */}
            <Button
              variant="outlined"
              icon={Download}
              onClick={handleDownload}
              disabled={!hasSignature}
              title={
                hasSignature
                  ? "Télécharger le PDF"
                  : "Ajoutez au moins une signature pour télécharger"
              }
            >
              <span className="hidden sm:inline">Télécharger</span>
            </Button>
            {!readOnly && (
              <div className="flex-grow sm:flex-grow-0">
                <label htmlFor="signerName" className="sr-only">
                  Confirmez votre nom
                </label>
                <input
                  id="signerName"
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full sm:w-56 bg-surfaceVariant/60 border border-outlineVariant rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-primary/80 focus:bg-surface transition-colors"
                  placeholder="Entrez votre nom complet"
                />
              </div>
            )}
            {readOnly ? (
              <Button
                variant="text"
                onClick={() => navigate("/dashboard")}
                className="w-full sm:w-auto flex-shrink-0"
              >
                Fermer
              </Button>
            ) : (
              <div className="flex flex-col gap-2 w-full sm:w-auto flex-shrink-0">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !isFormValid}
                  className="btn-premium-shine btn-premium-extended h-11 text-sm focus:outline-none focus:ring-4 focus:ring-primary/30 w-full inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-busy={isSubmitting}
                  title={
                    !isFormValid
                      ? "Veuillez remplir tous les champs de signature/paraphe et confirmer votre nom"
                      : ""
                  }
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
                      <span>Envoi en cours...</span>
                    </>
                  ) : (
                    <span>Terminer la signature</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        ref={viewerRef}
        className="bg-surfaceVariant/30 p-4 min-h-[calc(100vh-140px)] relative pb-28 overflow-y-auto"
        onClick={() => {
          // Désélectionner le champ quand on clique sur le viewer
          if (!readOnly) {
            setSelectedFieldId(null);
          }
        }}
      >
        <div className="overflow-x-auto">
          {Array.from(new Array(pdf.numPages), (_, index) => (
            <div
              key={`page-wrapper-${index + 1}`}
              id={`page-wrapper-${index + 1}`}
              ref={(el) => (pageRefs.current[index] = el)}
              data-page-number={index + 1}
              className="my-4 shadow-lg mx-auto relative bg-white"
              style={{
                width: pageDimensions[index]?.width * zoomLevel,
                height: pageDimensions[index]?.height * zoomLevel,
              }}
            >
              <PdfPageRenderer pageNum={index + 1} zoom={zoomLevel} />
              {envelope.fields
                .filter((f) => f.page === index + 1)
                .map((field) => (
                  <React.Fragment key={field.id}>
                    {renderField(field)}
                  </React.Fragment>
                ))}
            </div>
          ))}
        </div>
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 w-fit max-w-full z-40">
          <div className="bg-surface/90 backdrop-blur-sm rounded-full shadow-lg border border-outlineVariant/50 flex items-center p-1 space-x-1 text-onSurface">
            <button
              onClick={handleZoomOut}
              className="p-2 rounded-full hover:bg-surfaceVariant transition-colors disabled:opacity-50"
              disabled={zoomLevel <= 0.5}
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold w-12 text-center select-none">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 rounded-full hover:bg-surfaceVariant transition-colors disabled:opacity-50"
              disabled={zoomLevel >= 3}
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <div className="w-px h-6 bg-outlineVariant mx-1"></div>
            <form onSubmit={handleGoToPage} className="flex items-center">
              <span className="text-sm font-medium px-2">Page</span>
              <input
                type="number"
                value={goToPageInput}
                onChange={(e) => setGoToPageInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="w-12 text-center bg-surfaceVariant/60 rounded-md py-1 text-sm border border-outlineVariant focus:ring-1 focus:ring-primary focus:border-primary"
                min="1"
                max={pdf.numPages}
                aria-label="Numéro de page"
              />
              <span className="text-sm text-onSurfaceVariant px-2">
                {" "}
                sur {pdf.numPages}
              </span>
              <button
                type="submit"
                className="p-2 rounded-full hover:bg-surfaceVariant transition-colors"
                aria-label="Aller à la page"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
        {!readOnly && signableFields.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-inverseSurface/90 backdrop-blur-sm text-inverseOnSurface p-3 shadow-2xl z-40">
            <div className="container mx-auto flex justify-between items-center">
              {currentFieldIndex === -1 ? (
                <div className="w-full text-center">
                  <Button variant="filled" onClick={handleStartSigning}>
                    Démarrer la signature
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Champ {currentFieldIndex + 1} sur {signableFields.length}
                    <span className="hidden sm:inline">
                      {" "}
                      ({manualFieldsFilledCount} rempli
                      {manualFieldsFilledCount > 1 ? "s" : ""})
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevField}
                      disabled={currentFieldIndex <= 0}
                      className="p-2 rounded-full hover:bg-inverseOnSurface/10 disabled:opacity-50"
                    >
                      <ChevronLeft />
                    </button>
                    <button
                      onClick={handleNextField}
                      disabled={currentFieldIndex >= signableFields.length - 1}
                      className="p-2 rounded-full hover:bg-inverseOnSurface/10 disabled:opacity-50"
                    >
                      <ChevronRight />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tooltip des dimensions lors du déplacement/redimensionnement */}
      {dimensionTooltip && (
        <div
          style={{
            position: "fixed",
            left: dimensionTooltip.x + 15,
            top: dimensionTooltip.y - 30,
            zIndex: 9999,
            pointerEvents: "none",
          }}
          className="bg-primary text-onPrimary px-3 py-2 rounded-lg shadow-lg text-sm font-semibold whitespace-nowrap"
        >
          {Math.round(dimensionTooltip.width)} ×{" "}
          {Math.round(dimensionTooltip.height)} px
        </div>
      )}
    </>
  );
};

export default SignDocumentPage;
