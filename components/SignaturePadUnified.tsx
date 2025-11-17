import {
  Signature,
  Type as TypeIcon,
  Upload,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import Button from "./Button";
import { useToast } from "./Toast";

interface SignaturePadUnifiedProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  signerName: string;
  initialTab?: "draw" | "type" | "upload";
  isParaphe?: boolean; // Indique si c'est un paraphe (true) ou une signature (false)
  showApplyToAll?: boolean; // Afficher la checkbox "Appliquer à tous"
  applyToAll?: boolean; // État de la checkbox
  onApplyToAllChange?: (checked: boolean) => void; // Callback pour changer l'état
  applyToAllLabel?: string; // Label de la checkbox
}

const SignaturePadUnified: React.FC<SignaturePadUnifiedProps> = ({
  onSave,
  onCancel,
  signerName,
  initialTab = "draw",
  isParaphe = false,
  showApplyToAll = false,
  applyToAll = false,
  onApplyToAllChange,
  applyToAllLabel,
}) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<"draw" | "type" | "upload">(
    initialTab
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedName, setTypedName] = useState(signerName);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [scale, setScale] = useState(1); // Zoom pour redimensionnement proportionnel

  // Drawing tools state
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(2);

  const signatureColors = [
    { name: "Noir", color: "#000000" },
    { name: "Bleu", color: "#2563EB" },
    { name: "Rouge", color: "#BA1A1A" },
  ];

  const signatureWidths = [
    { name: "Fine", width: 2 },
    { name: "Moyenne", width: 4 },
    { name: "Épaisse", width: 6 },
  ];

  // Initialiser le canvas avec la bonne taille et les bonnes propriétés
  useEffect(() => {
    if (activeTab === "draw" && canvasRef.current) {
      // Attendre que le canvas soit rendu
      const initCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(window.devicePixelRatio || 1, 2);

        // Redimensionner le canvas
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Réinitialiser la transformation avant de rescale
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(ratio, ratio);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
        }
      };

      // Attendre le prochain frame pour que le canvas soit rendu
      requestAnimationFrame(() => {
        setTimeout(initCanvas, 0);
      });
    }
  }, [activeTab, strokeColor, lineWidth]);

  const getPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // 🔧 FIX MOBILE : Empêcher le scroll pendant le dessin
    const { x, y } = getPosition(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault(); // 🔧 FIX MOBILE : Empêcher le scroll pendant le dessin
    const { x, y } = getPosition(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    if ("touches" in e) {
      e.preventDefault(); // 🔧 FIX MOBILE : Empêcher le scroll après le dessin
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    let dataUrl = "";
    if (activeTab === "draw" && canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (context) {
        const pixelBuffer = new Uint32Array(
          context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
        );
        if (!pixelBuffer.some((color) => color !== 0)) {
          addToast(
            isParaphe 
              ? "Veuillez dessiner votre paraphe avant de l'appliquer."
              : "Veuillez dessiner votre signature avant de l'appliquer.",
            "info"
          );
          return;
        }
      }
      dataUrl = canvas.toDataURL("image/png");
    } else if (activeTab === "type") {
      if (!typedName.trim()) {
        addToast(
          isParaphe 
            ? "Veuillez taper votre nom pour créer un paraphe."
            : "Veuillez taper votre nom pour créer une signature.",
          "info"
        );
        return;
      }
      const tempCanvas = document.createElement("canvas");
      // Calculer la taille de police en fonction du scale
      const fontSize = 48 * scale;
      // Ajuster la taille du canvas en fonction de la taille du texte
      tempCanvas.width = 400;
      tempCanvas.height = Math.max(100, fontSize + 40);
      const ctx = tempCanvas.getContext("2d")!;
      ctx.font = `${fontSize}px "Caveat", cursive`;
      ctx.fillStyle = strokeColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        typedName.trim(),
        tempCanvas.width / 2,
        tempCanvas.height / 2
      );
      dataUrl = tempCanvas.toDataURL("image/png");
    } else if (activeTab === "upload") {
      if (!uploadedImage) {
        addToast(
          isParaphe 
            ? "Veuillez téléverser une image pour votre paraphe."
            : "Veuillez téléverser une image pour votre signature.",
          "info"
        );
        return;
      }
      dataUrl = uploadedImage;
    }
    if (dataUrl) onSave(dataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (file) {
      addToast(
        "Veuillez téléverser un fichier image valide (PNG ou JPG).",
        "error"
      );
    }
  };

  const tabClasses = (tabName: "draw" | "type" | "upload") =>
    `px-4 py-2 text-sm font-semibold rounded-full transition-colors w-full ${
      activeTab === tabName
        ? "bg-primaryContainer text-onPrimaryContainer"
        : "hover:bg-surfaceVariant"
    }`;

  return (
    <div
      className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-[100] p-2 sm:p-4 overflow-y-auto modal-backdrop"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-3xl shadow-xl w-full max-w-lg p-4 sm:p-6 my-auto max-h-[95vh] overflow-y-auto modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-onSurface">
            {isParaphe ? "Créer un paraphe" : "Créer une signature"}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-surfaceVariant"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex space-x-1 sm:space-x-2 bg-surfaceVariant p-1 rounded-full mb-4">
          <button
            className={tabClasses("draw")}
            onClick={() => setActiveTab("draw")}
          >
            Dessiner
          </button>
          <button
            className={tabClasses("type")}
            onClick={() => setActiveTab("type")}
          >
            Taper
          </button>
          <button
            className={tabClasses("upload")}
            onClick={() => setActiveTab("upload")}
          >
            Importer
          </button>
        </div>

        <div className="bg-surfaceVariant/50 rounded-2xl p-2">
          {activeTab === "draw" && (
            <div className="space-y-3">
              {/* Message d'aide */}
              <div>
                <p className="text-xs text-onSurfaceVariant text-center">
                  ✍️ {isParaphe 
                    ? "Dessinez votre paraphe avec précision. Utilisez un stylet ou votre doigt pour un meilleur résultat."
                    : "Dessinez votre signature avec précision. Utilisez un stylet ou votre doigt pour un meilleur résultat."}
                </p>
              </div>
              {/* Canvas pour dessiner */}
              <canvas
                ref={canvasRef}
                className="bg-white rounded-xl cursor-crosshair w-full border-2 border-primary/30 touch-none shadow-inner max-w-full"
                style={{
                  touchAction: "none",
                  height: "320px",
                  display: "block",
                }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {/* Checkbox "Appliquer à tous" - seulement pour les paraphes dans l'onglet dessiner */}
              {showApplyToAll && isParaphe && onApplyToAllChange && applyToAllLabel && (
                <div className="bg-surface rounded-lg p-3 border border-outlineVariant">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyToAll}
                      onChange={(e) => onApplyToAllChange(e.target.checked)}
                      className="w-5 h-5 accent-primary"
                    />
                    <span className="text-sm font-medium text-onSurface">
                      {applyToAllLabel}
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}
          {activeTab === "type" && (
            <div className="h-[280px] flex flex-col items-center justify-center bg-white rounded-xl p-4 gap-2 overflow-hidden">
              <label className="text-xs font-semibold text-onSurfaceVariant">
                Taille:
              </label>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-32"
              />
              <span className="text-xs text-onSurfaceVariant font-medium mb-2">
                {Math.round(scale * 100)}%
              </span>
              <div className="w-full flex items-center justify-center overflow-hidden">
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  className="font-['Caveat',_cursive] text-center bg-transparent outline-none border-b-2 border-solid border-outline focus:border-primary transition-colors"
                  style={{
                    fontSize: `${48 * scale}px`,
                    maxWidth: "100%",
                    width: "100%",
                  }}
                  placeholder="Tapez votre nom"
                />
              </div>
            </div>
          )}
          {activeTab === "upload" && (
            <div className="h-[280px] flex flex-col items-center justify-center bg-white rounded-xl p-4 gap-3">
              {uploadedImage ? (
                <>
                  <label className="text-xs font-semibold text-onSurfaceVariant">
                    Taille:
                  </label>
                  <input
                    type="range"
                    min="0.8"
                    max="1.4"
                    step="0.1"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-xs text-onSurfaceVariant font-medium">
                    {Math.round(scale * 100)}%
                  </span>
                  <img
                    src={uploadedImage}
                    alt="Aperçu de la signature"
                    className="max-h-40 object-contain border border-outlineVariant/50 rounded-lg p-1"
                    style={{
                      transform: `scale(${scale})`,
                      transformOrigin: "center",
                    }}
                  />
                  <Button
                    variant="text"
                    onClick={() => setUploadedImage(null)}
                    className="mt-1"
                  >
                    Changer l'image
                  </Button>
                </>
              ) : (
                <label className="cursor-pointer text-center w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-outlineVariant rounded-lg hover:bg-surfaceVariant transition-colors">
                  <Upload
                    size={40}
                    className="mx-auto text-onSurfaceVariant mb-2"
                  />
                  <span className="text-primary font-semibold">
                    Cliquez pour téléverser
                  </span>
                  <p className="text-xs text-onSurfaceVariant mt-1">
                    Fichier PNG ou JPG
                  </p>
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/png, image/jpeg"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
            </div>
          )}
        </div>

        {activeTab === "draw" && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-center flex-wrap gap-2">
              <span className="text-sm font-medium text-onSurfaceVariant hidden sm:inline">
                Couleur :
              </span>
              {signatureColors.map(({ name, color }) => (
                <button
                  key={name}
                  title={name}
                  onClick={() => setStrokeColor(color)}
                  className={`h-8 w-8 rounded-full transition-all duration-200 flex-shrink-0 ${
                    strokeColor === color
                      ? "ring-2 ring-offset-2 ring-offset-surface ring-primary"
                      : ""
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-center justify-center flex-wrap gap-2">
              <span className="text-sm font-medium text-onSurfaceVariant">
                Épaisseur :
              </span>
              {signatureWidths.map(({ name, width }) => (
                <button
                  key={name}
                  title={name}
                  onClick={() => setLineWidth(width)}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                    lineWidth === width
                      ? "bg-primaryContainer"
                      : "hover:bg-surfaceVariant"
                  }`}
                >
                  <div className="h-4 w-6 flex items-center justify-center">
                    <div
                      className="bg-onSurface rounded-full"
                      style={{ height: `${width}px`, width: "100%" }}
                    ></div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mt-6">
          <div className="flex-shrink-0">
            {activeTab === "draw" && (
              <Button
                variant="text"
                onClick={clearCanvas}
                className="w-full sm:w-auto"
              >
                Effacer
              </Button>
            )}
          </div>
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <Button
              variant="text"
              onClick={onCancel}
              className="flex-1 sm:flex-initial"
            >
              Annuler
            </Button>
            <button
              onClick={handleSave}
              className="btn-premium-shine btn-premium-extended h-11 text-sm focus:outline-none focus:ring-4 focus:ring-primary/30 flex-1 sm:flex-initial inline-flex items-center justify-center"
            >
              <span className="hidden sm:inline">
                {isParaphe ? "Appliquer le paraphe" : "Appliquer la signature"}
              </span>
              <span className="sm:hidden">Appliquer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignaturePadUnified;

