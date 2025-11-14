import {
  Eraser,
  Signature,
  Type as TypeIcon,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import Button from "./Button";
import { useToast } from "./Toast";

interface SignaturePadComponentProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  signerName: string;
}

const SignaturePadComponent: React.FC<SignaturePadComponentProps> = ({
  onSave,
  onCancel,
  signerName,
}) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<"draw" | "type" | "upload">(
    "draw"
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const [typedName, setTypedName] = useState(signerName);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [penColor, setPenColor] = useState("#000000");
  const [penWidth, setPenWidth] = useState(2);

  // 🎨 Initialiser signature_pad quand le canvas est monté
  useEffect(() => {
    if (canvasRef.current && !signaturePadRef.current) {
      const canvas = canvasRef.current;

      // Adapter taille canvas à son conteneur
      const resizeCanvas = () => {
        const ratio = Math.max(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        canvas.getContext("2d")!.scale(ratio, ratio);

        // Restaurer les données après resize si elles existent
        if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
          const data = signaturePadRef.current.toData();
          signaturePadRef.current.clear();
          signaturePadRef.current.fromData(data);
        }
      };

      // Créer instance SignaturePad avec paramètres optimisés pour précision
      signaturePadRef.current = new SignaturePad(canvas, {
        penColor: penColor,
        minWidth: penWidth * 0.5,
        maxWidth: penWidth * 1.5,
        velocityFilterWeight: 0.5,
        throttle: 8,
        backgroundColor: "rgb(255, 255, 255)",
      });

      // Attendre que le canvas soit rendu puis redimensionner
      setTimeout(() => {
        resizeCanvas();
      }, 0);

      // Resize listener
      window.addEventListener("resize", resizeCanvas);
      return () => window.removeEventListener("resize", resizeCanvas);
    }
  }, [canvasRef]);

  // 🎨 Mettre à jour les options quand elles changent
  useEffect(() => {
    if (signaturePadRef.current) {
      signaturePadRef.current.penColor = penColor;
      signaturePadRef.current.minWidth = penWidth * 0.5;
      signaturePadRef.current.maxWidth = penWidth * 1.5;
    }
  }, [penColor, penWidth]);

  // Mode DESSINER : Utiliser signature_pad (30k⭐)
  const handleSaveDraw = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      const dataUrl = signaturePadRef.current.toDataURL("image/png", 1.0);
      onSave(dataUrl);
    } else {
      addToast(
        "Veuillez dessiner votre signature avant de l'appliquer.",
        "info"
      );
    }
  };

  // Mode TAPER : Générer signature texte
  const handleSaveTyped = () => {
    if (!typedName.trim()) {
      addToast("Veuillez taper votre nom pour créer une signature.", "info");
      return;
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 400;
    tempCanvas.height = 100;
    const ctx = tempCanvas.getContext("2d");
    if (ctx) {
      ctx.font = '48px "Caveat", cursive';
      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        typedName.trim(),
        tempCanvas.width / 2,
        tempCanvas.height / 2
      );
    }
    const dataUrl = tempCanvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  // Mode IMPORTER : Charger une image
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

  const handleSaveUploaded = () => {
    if (!uploadedImage) {
      addToast("Veuillez téléverser une image pour votre signature.", "info");
      return;
    }
    onSave(uploadedImage);
  };

  const handleClear = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  const handleUndo = () => {
    if (signaturePadRef.current) {
      const data = signaturePadRef.current.toData();
      if (data.length > 0) {
        data.pop(); // Retirer le dernier trait
        signaturePadRef.current.fromData(data);
      }
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
      className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto modal-backdrop"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-3xl shadow-xl w-full max-w-lg p-4 sm:p-6 my-auto max-h-[95vh] overflow-y-auto modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-onSurface">
            Créer une signature
          </h2>
          <button
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-surfaceVariant"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 sm:space-x-2 bg-surfaceVariant p-1 rounded-full mb-4">
          <button
            className={tabClasses("draw")}
            onClick={() => setActiveTab("draw")}
          >
            <Signature className="inline h-4 w-4 mr-1" />
            Dessiner
          </button>
          <button
            className={tabClasses("type")}
            onClick={() => setActiveTab("type")}
          >
            <TypeIcon className="inline h-4 w-4 mr-1" />
            Taper
          </button>
          <button
            className={tabClasses("upload")}
            onClick={() => setActiveTab("upload")}
          >
            <Upload className="inline h-4 w-4 mr-1" />
            Importer
          </button>
        </div>

        {/* Content */}
        <div className="bg-surfaceVariant/50 rounded-2xl p-3 mb-4">
          {activeTab === "draw" && (
            <div className="space-y-3">
              {/* Message d'aide */}
              <div>
                <p className="text-xs text-onSurfaceVariant text-center">
                  ✍️ Dessinez votre signature avec précision. Utilisez un stylet
                  ou votre doigt pour un meilleur résultat.
                </p>
              </div>

              {/* Contrôles améliorés */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Épaisseur */}
                <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                  <label className="text-xs font-semibold text-onSurfaceVariant whitespace-nowrap">
                    Épaisseur:
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={penWidth}
                    onChange={(e) => setPenWidth(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-onSurfaceVariant font-medium w-8 text-right">
                    {penWidth.toFixed(1)}
                  </span>
                </div>

                {/* Couleur */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-onSurfaceVariant">
                    Couleur:
                  </label>
                  <input
                    type="color"
                    value={penColor}
                    onChange={(e) => setPenColor(e.target.value)}
                    className="w-10 h-8 rounded border border-outlineVariant cursor-pointer"
                  />
                </div>
              </div>

              {/* Canvas signature_pad (30k⭐) - Hauteur augmentée + bordure visible */}
              <canvas
                ref={canvasRef}
                className="bg-white rounded-xl cursor-crosshair w-full border-2 border-primary/30 touch-none shadow-inner max-w-full"
                style={{
                  touchAction: "none",
                  height: "320px",
                  display: "block",
                }}
              />
            </div>
          )}

          {activeTab === "type" && (
            <div className="h-[280px] flex flex-col items-center justify-center bg-white rounded-xl p-4 gap-2">
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
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                className="text-6xl font-['Caveat',_cursive] text-center w-full bg-transparent outline-none border-b-2 border-solid border-outline focus:border-primary transition-colors"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "center",
                  fontSize: `${48 * scale}px`,
                }}
                placeholder="Tapez votre nom"
              />
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

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex gap-2 flex-shrink-0">
            {activeTab === "draw" && (
              <>
                <Button
                  variant="text"
                  icon={Undo2}
                  onClick={handleUndo}
                  className="w-auto"
                  title="Annuler le dernier trait"
                >
                  <span className="hidden sm:inline">Annuler</span>
                </Button>
                <Button
                  variant="text"
                  icon={Eraser}
                  onClick={handleClear}
                  className="w-auto"
                  title="Effacer tout"
                >
                  <span className="hidden sm:inline">Effacer</span>
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <Button
              variant="text"
              onClick={onCancel}
              className="flex-1 sm:flex-initial"
            >
              Fermer
            </Button>
            <button
              onClick={
                activeTab === "draw"
                  ? handleSaveDraw
                  : activeTab === "type"
                  ? handleSaveTyped
                  : handleSaveUploaded
              }
              className="btn-premium-shine btn-premium-extended h-11 text-sm focus:outline-none focus:ring-4 focus:ring-primary/30 flex-1 sm:flex-initial inline-flex items-center justify-center"
            >
              <span className="hidden sm:inline">Appliquer la signature</span>
              <span className="sm:hidden">Appliquer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignaturePadComponent;
