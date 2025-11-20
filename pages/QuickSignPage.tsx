import { ArrowLeft, Download, Signature, ZoomIn, ZoomOut, X } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import DraggableSignature from "../components/DraggableSignature";
import SignaturePadUnified from "../components/SignaturePadUnified";
import { useToast } from "../components/Toast";
import { useUser } from "../components/UserContext";
import { convertWordToPdf, isWordFile } from "../utils/wordToPdf";

// Configuration du worker PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface SignaturePosition {
  id: string;
  signatureData: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const QuickSignPage: React.FC = () => {
  const { addToast } = useToast();
  const { currentUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [pdfData, setPdfData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageDimensions, setPageDimensions] = useState<
    { width: number; height: number }[]
  >([]);
  // 📱 Zoom adaptatif : 50% sur mobile, 100% sur desktop
  const getInitialZoom = () => {
    return window.innerWidth < 768 ? 0.5 : 1.0;
  };
  const [zoomLevel, setZoomLevel] = useState(getInitialZoom());
  const [isProcessing, setIsProcessing] = useState(false);
  const [signatures, setSignatures] = useState<SignaturePosition[]>([]);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);

  // Désactiver le scroll de la page
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Load file from location.state if provided
  useEffect(() => {
    const state = location.state as { file?: File; fileName?: string } | null;
    if (state?.file) {
      handleFileSelected(state.file);
    }
  }, [location.state]);

  // Load PDF
  useEffect(() => {
    if (!pdfData) return;

    const loadPdf = async () => {
      try {
        const pdfBytes = base64ToUint8Array(pdfData);
        const loadedPdf = await pdfjsLib.getDocument({ data: pdfBytes })
          .promise;
        setPdf(loadedPdf);

        const dims: { width: number; height: number }[] = [];
        for (let i = 1; i <= loadedPdf.numPages; i++) {
          const page = await loadedPdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          dims.push({ width: viewport.width, height: viewport.height });
        }
        setPageDimensions(dims);
      } catch (error) {
        console.error("Erreur lors du chargement du PDF:", error);
        addToast("Erreur lors du chargement du PDF", "error");
      }
    };

    loadPdf();
  }, [pdfData, addToast]);

  // Render PDF pages
  useEffect(() => {
    if (!pdf || pageDimensions.length === 0) return;

    const renderPages = async () => {
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: zoomLevel });
        const canvas = document.getElementById(
          `pdf-page-${i}`
        ) as HTMLCanvasElement;
        if (!canvas) continue;

        const context = canvas.getContext("2d");
        if (!context) continue;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;
      }
    };

    renderPages();
  }, [pdf, pageDimensions, zoomLevel]);

  const handleFileSelected = async (file: File) => {
    setIsProcessing(true);
    try {
      let pdfFile = file;

      // Convert Word to PDF if needed
      if (isWordFile(file)) {
        addToast("Conversion du document Word en PDF...", "info");
        pdfFile = await convertWordToPdf(file);
      }

      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64 = btoa(
          uint8Array.reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );

        setPdfData(base64);
        setFileName(file.name.replace(/\.(docx?|pdf)$/i, ""));
        addToast("Document chargé avec succès", "success");
      };

      reader.onerror = () => {
        addToast("Erreur lors de la lecture du fichier", "error");
      };

      reader.readAsArrayBuffer(pdfFile);
    } catch (error) {
      console.error("Erreur:", error);
      addToast("Erreur lors du traitement du fichier", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveSignature = (signatureData: string) => {
    if (!pdf || pageDimensions.length === 0) {
      addToast("Veuillez d'abord charger un document", "error");
      return;
    }

    // Stocker la signature en attente de placement
    setPendingSignature(signatureData);
    setShowSignaturePad(false);
    addToast(
      "Cliquez sur la page où vous souhaitez placer la signature",
      "info"
    );
  };

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    // Si une signature est en attente, la placer à l'endroit du clic
    if (pendingSignature && viewerRef.current && pageRefs.current[pageNum - 1]) {
      // Ne pas placer si on clique sur une signature existante
      const target = e.target as HTMLElement;
      if (target.closest('.group')) {
        return;
      }
      
      e.stopPropagation();
      
      const pageRef = pageRefs.current[pageNum - 1];
      const pageRect = pageRef.getBoundingClientRect();
      
      // Calculer la position relative dans la page (en pixels écran)
      const clickX = e.clientX - pageRect.left;
      const clickY = e.clientY - pageRect.top;
      
      // Convertir en coordonnées de page (sans zoom)
      const x = clickX / zoomLevel;
      const y = clickY / zoomLevel;
      
      // Dimensions par défaut de la signature
      const signatureWidth = 200;
      const signatureHeight = 100;
      
      // Ajuster pour centrer la signature sur le point de clic
      const adjustedX = Math.max(0, Math.min(x - signatureWidth / 2, pageDimensions[pageNum - 1].width - signatureWidth));
      const adjustedY = Math.max(0, Math.min(y - signatureHeight / 2, pageDimensions[pageNum - 1].height - signatureHeight));

      const newSignature: SignaturePosition = {
        id: `sig-${Date.now()}`,
        signatureData: pendingSignature,
        page: pageNum,
        x: adjustedX,
        y: adjustedY,
        width: signatureWidth,
        height: signatureHeight,
      };

      setSignatures([...signatures, newSignature]);
      setPendingSignature(null);
      addToast("Signature placée - Vous pouvez la déplacer si nécessaire", "success");
    }
  };

  const handleRemoveSignature = (id: string) => {
    setSignatures(signatures.filter((sig) => sig.id !== id));
    addToast("Signature supprimée", "success");
  };

  const handleSignatureUpdate = (
    id: string,
    updates: { 
      x?: number; 
      y?: number; 
      width?: number; 
      height?: number;
      page?: number;
    }
  ) => {
    setSignatures((prev) =>
      prev.map((sig) =>
        sig.id === id
          ? {
              ...sig,
              ...updates,
            }
          : sig
      )
    );
  };

  const handleDownload = async () => {
    if (!pdfData || signatures.length === 0) {
      addToast("Veuillez ajouter au moins une signature", "info");
      return;
    }

    setIsProcessing(true);
    try {
      const pdfBytes = base64ToUint8Array(pdfData);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      for (const signature of signatures) {
        const page = pdfDoc.getPage(signature.page - 1);
        const signatureImageBytes = await fetch(signature.signatureData).then(
          (res) => res.arrayBuffer()
        );
        const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

        const pageHeight = page.getHeight();
        page.drawImage(signatureImage, {
          x: signature.x,
          y: pageHeight - signature.y - signature.height,
          width: signature.width,
          height: signature.height,
        });
      }

      const signedPdfBytes = await pdfDoc.save();
      const blob = new Blob([signedPdfBytes as any], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}_signé.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      addToast("Document signé téléchargé avec succès", "success");
    } catch (error) {
      console.error("Erreur lors de la signature:", error);
      addToast("Erreur lors de la signature du document", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
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
              title={fileName || "Signature Rapide"}
            >
              {fileName || "Signature Rapide"}
            </h1>
          </div>

          {pdfData && (
            <div className="flex items-center gap-2">
              {pendingSignature ? (
                <Button
                  variant="outlined"
                  icon={X}
                  onClick={() => {
                    setPendingSignature(null);
                    addToast("Placement de signature annulé", "info");
                  }}
                  size="small"
                >
                  <span className="hidden sm:inline">Annuler</span>
                  <span className="sm:hidden">Annuler</span>
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  icon={Signature}
                  onClick={() => setShowSignaturePad(true)}
                  size="small"
                >
                  <span className="hidden sm:inline">Ajouter signature</span>
                  <span className="sm:hidden">Signature</span>
                </Button>
              )}
              <Button
                variant="filled"
                icon={Download}
                onClick={handleDownload}
                disabled={signatures.length === 0 || isProcessing}
                size="small"
              >
                {isProcessing ? "Traitement..." : "Télécharger"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      {!pdfData ? (
        <div className="flex-1 container mx-auto px-4 py-8 overflow-auto">
          <div className="max-w-2xl mx-auto">
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
          </div>
        </div>
      ) : (
        <div className="flex-1 flex relative overflow-hidden">
          {/* PDF Viewer */}
          <div
            ref={viewerRef}
            className={`flex-1 bg-surfaceVariant/30 p-2 sm:p-4 overflow-auto ${
              pendingSignature ? "cursor-crosshair" : ""
            }`}
          >
            <div className="w-full max-w-full overflow-x-hidden">
              <div className="space-y-8">
                {pdf &&
                  Array.from({ length: pdf.numPages }, (_, i) => i + 1).map(
                    (pageNum) => (
                      <div
                        key={pageNum}
                        ref={(el) => (pageRefs.current[pageNum - 1] = el)}
                        className={`relative bg-white shadow-lg mx-auto ${
                          pendingSignature ? "cursor-crosshair" : ""
                        }`}
                        style={{
                          width: `${
                            pageDimensions[pageNum - 1]?.width * zoomLevel
                          }px`,
                        }}
                        onClick={(e) => handlePageClick(e, pageNum)}
                      >
                        <canvas id={`pdf-page-${pageNum}`} />

                        {/* Signatures on this page - Manipulables au doigt et à la souris */}
                        {signatures
                          .filter((sig) => sig.page === pageNum)
                          .map((sig) => (
                            <DraggableSignature
                              key={sig.id}
                              id={sig.id}
                              signatureData={sig.signatureData}
                              x={sig.x}
                              y={sig.y}
                              width={sig.width}
                              height={sig.height}
                              zoomLevel={zoomLevel}
                              currentPage={sig.page}
                              totalPages={pdf.numPages}
                              pageDimensions={pageDimensions}
                              pageRefs={pageRefs}
                              viewerRef={viewerRef}
                              onUpdate={handleSignatureUpdate}
                              onRemove={handleRemoveSignature}
                              maxWidth={
                                pageDimensions[pageNum - 1]?.width || 600
                              }
                              maxHeight={
                                pageDimensions[pageNum - 1]?.height || 800
                              }
                            />
                          ))}
                      </div>
                    )
                  )}
              </div>
            </div>

            {/* Zoom Controls - Fixed at bottom */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-fit max-w-[calc(100vw-2rem)] z-40">
              <div className="bg-surface/90 backdrop-blur-sm rounded-full shadow-lg border border-outlineVariant/50 flex items-center p-1 gap-1 text-onSurface">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.25, z - 0.25))}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-surfaceVariant transition-colors flex-shrink-0"
                  disabled={zoomLevel <= 0.25}
                >
                  <ZoomOut className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <span className="text-xs sm:text-sm font-medium px-2 sm:px-3 whitespace-nowrap">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3.0, z + 0.25))}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-surfaceVariant transition-colors flex-shrink-0"
                  disabled={zoomLevel >= 3.0}
                >
                  <ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <SignaturePadUnified
          onSave={handleSaveSignature}
          onCancel={() => setShowSignaturePad(false)}
          signerName={currentUser?.email || "Utilisateur"}
        />
      )}
    </div>
  );
};

export default QuickSignPage;
