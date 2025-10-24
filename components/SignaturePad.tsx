import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useToast } from './Toast';
import Button from './Button';
import { Signature, Type as TypeIcon, Upload, X } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  signerName: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onCancel, signerName }) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const signatureCanvasRef = useRef<any>(null);
  const [typedName, setTypedName] = useState(signerName);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  // Mode DESSINER : Utiliser react-signature-canvas
  const handleSaveDraw = () => {
    if (signatureCanvasRef.current && !signatureCanvasRef.current.isEmpty()) {
      const dataUrl = signatureCanvasRef.current.getTrimmedCanvas().toDataURL('image/png');
      onSave(dataUrl);
    } else {
      addToast('Veuillez dessiner votre signature avant de l\'appliquer.', 'info');
    }
  };

  // Mode TAPER : Générer signature texte
  const handleSaveTyped = () => {
    if (!typedName.trim()) {
      addToast('Veuillez taper votre nom pour créer une signature.', 'info');
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 400;
    tempCanvas.height = 100;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      ctx.font = '48px "Caveat", cursive';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName.trim(), tempCanvas.width / 2, tempCanvas.height / 2);
    }
    const dataUrl = tempCanvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  // Mode IMPORTER : Charger une image
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (file) {
      addToast('Veuillez téléverser un fichier image valide (PNG ou JPG).', 'error');
    }
  };

  const handleSaveUploaded = () => {
    if (!uploadedImage) {
      addToast('Veuillez téléverser une image pour votre signature.', 'info');
      return;
    }
    onSave(uploadedImage);
  };

  const handleClear = () => {
    if (signatureCanvasRef.current) {
      signatureCanvasRef.current.clear();
    }
  };

  const tabClasses = (tabName: 'draw' | 'type' | 'upload') =>
    `px-4 py-2 text-sm font-semibold rounded-full transition-colors w-full ${
      activeTab === tabName ? 'bg-primaryContainer text-onPrimaryContainer' : 'hover:bg-surfaceVariant'
    }`;

  return (
    <div className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto modal-backdrop" onClick={onCancel}>
      <div className="bg-surface rounded-3xl shadow-xl w-full max-w-lg p-4 sm:p-6 my-auto max-h-[95vh] overflow-y-auto modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-onSurface">Créer une signature</h2>
          <button onClick={onCancel} className="p-1 rounded-full hover:bg-surfaceVariant" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 sm:space-x-2 bg-surfaceVariant p-1 rounded-full mb-4">
          <button className={tabClasses('draw')} onClick={() => setActiveTab('draw')}>
            <Signature className="inline h-4 w-4 mr-1" />
            Dessiner
          </button>
          <button className={tabClasses('type')} onClick={() => setActiveTab('type')}>
            <TypeIcon className="inline h-4 w-4 mr-1" />
            Taper
          </button>
          <button className={tabClasses('upload')} onClick={() => setActiveTab('upload')}>
            <Upload className="inline h-4 w-4 mr-1" />
            Importer
          </button>
        </div>

        {/* Content */}
        <div className="bg-surfaceVariant/50 rounded-2xl p-2 mb-4">
          {activeTab === 'draw' && (
            <div>
              <div className="flex items-center gap-3 mb-3 px-2">
                <label className="text-xs font-semibold text-onSurfaceVariant">Taille:</label>
                <input
                  type="range"
                  min="0.8"
                  max="1.4"
                  step="0.1"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs text-onSurfaceVariant font-medium">{Math.round(scale * 100)}%</span>
              </div>
              <SignatureCanvas
                ref={signatureCanvasRef}
                penColor="black"
                velocityFilterWeight={0.7}
                minWidth={1.5}
                maxWidth={2.5}
                dotSize={2}
                canvasProps={{
                  width: Math.round(600 * scale),
                  height: Math.round(300 * scale),
                  className: 'bg-white rounded-xl cursor-crosshair w-full border border-outlineVariant touch-none',
                  style: { touchAction: 'none' }
                }}
              />
            </div>
          )}

          {activeTab === 'type' && (
            <div className="h-[280px] flex flex-col items-center justify-center bg-white rounded-xl p-4 gap-2">
              <label className="text-xs font-semibold text-onSurfaceVariant">Taille:</label>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-32"
              />
              <span className="text-xs text-onSurfaceVariant font-medium mb-2">{Math.round(scale * 100)}%</span>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                className="text-6xl font-['Caveat',_cursive] text-center w-full bg-transparent outline-none border-b-2 border-solid border-outline focus:border-primary transition-colors"
                style={{ transform: `scale(${scale})`, transformOrigin: 'center', fontSize: `${48 * scale}px` }}
                placeholder="Tapez votre nom"
              />
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="h-[280px] flex flex-col items-center justify-center bg-white rounded-xl p-4 gap-3">
              {uploadedImage ? (
                <>
                  <label className="text-xs font-semibold text-onSurfaceVariant">Taille:</label>
                  <input
                    type="range"
                    min="0.8"
                    max="1.4"
                    step="0.1"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-xs text-onSurfaceVariant font-medium">{Math.round(scale * 100)}%</span>
                  <img
                    src={uploadedImage}
                    alt="Aperçu de la signature"
                    className="max-h-40 object-contain border border-outlineVariant/50 rounded-lg p-1"
                    style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
                  />
                  <Button variant="text" onClick={() => setUploadedImage(null)} className="mt-1">
                    Changer l'image
                  </Button>
                </>
              ) : (
                <label className="cursor-pointer text-center w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-outlineVariant rounded-lg hover:bg-surfaceVariant transition-colors">
                  <Upload size={40} className="mx-auto text-onSurfaceVariant mb-2" />
                  <span className="text-primary font-semibold">Cliquez pour téléverser</span>
                  <p className="text-xs text-onSurfaceVariant mt-1">Fichier PNG ou JPG</p>
                  <input type="file" className="sr-only" accept="image/png, image/jpeg" onChange={handleFileUpload} />
                </label>
              )}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex-shrink-0">
            {activeTab === 'draw' && <Button variant="text" onClick={handleClear} className="w-full sm:w-auto">Effacer</Button>}
          </div>
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <Button variant="text" onClick={onCancel} className="flex-1 sm:flex-initial">
              Annuler
            </Button>
            <button
              onClick={
                activeTab === 'draw'
                  ? handleSaveDraw
                  : activeTab === 'type'
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

export default SignaturePad;
