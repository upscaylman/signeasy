import {
  ArrowLeft,
  Download,
  Loader2,
  Signature,
  Trash2,
  UploadCloud,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import SignaturePad from "../components/SignaturePad";
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
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [signatures, setSignatures] = useState<SignaturePosition[]>([]);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedSignature, setDraggedSignature] = useState<number | null>(null);

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
          uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), "")
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
    const newSignature: SignaturePosition = {
      id: `sig-${Date.now()}`,
      signatureData,
      page: currentPage,
      x: 50,
      y: 50,
      width: 200,
      height: 100,
    };

    setSignatures([...signatures, newSignature]);
    setShowSignaturePad(false);
    addToast("Signature ajoutée", "success");
  };

  const handleRemoveSignature = (id: string) => {
    setSignatures(signatures.filter((sig) => sig.id !== id));
    addToast("Signature supprimée", "success");
  };

  const handleSignatureDragStart = (
    e: React.MouseEvent,
    index: number,
    signature: SignaturePosition
  ) => {
    e.preventDefault();
    setIsDragging(true);
    setDraggedSignature(index);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const pageElement = pageRefs.current[signature.page - 1];
      if (!pageElement) return;

      const rect = pageElement.getBoundingClientRect();
      const x = ((moveEvent.clientX - rect.left) / zoomLevel);
      const y = ((moveEvent.clientY - rect.top) / zoomLevel);

      setSignatures((prev) =>
        prev.map((sig, i) =>
          i === index
            ? {
                ...sig,
                x: Math.max(0, Math.min(x, pageDimensions[sig.page - 1].width - sig.width)),
                y: Math.max(0, Math.min(y, pageDimensions[sig.page - 1].height - sig.height)),
              }
            : sig
        )
      );
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDraggedSignature(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleDownload = async () => {
    if (!pdfData || signatures.length === 0) {
      addToast("Veuillez ajouter au moins une signature", "warning");
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
      const blob = new Blob([signedPdfBytes as any], { type: "application/pdf" });
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-outlineVariant sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="p-2 hover:bg-surfaceVariant rounded-full transition-colors"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-onSurface">
                  Signature Rapide
                </h1>
                {fileName && (
                  <p className="text-sm text-onSurfaceVariant">{fileName}</p>
                )}
              </div>
            </div>

            {pdfData && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outlined"
                  icon={Signature}
                  onClick={() => setShowSignaturePad(true)}
                >
                  Ajouter signature
                </Button>
                <Button
                  variant="filled"
                  icon={Download}
                  onClick={handleDownload}
                  disabled={signatures.length === 0 || isProcessing}
                >
                  {isProcessing ? "Traitement..." : "Télécharger"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {!pdfData ? (
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
        ) : (
          <div className="space-y-6">
            {/* Zoom Controls */}
            {pdf && (
              <div className="flex items-center justify-center gap-4 bg-surface p-4 rounded-lg">
                <button
                  onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))}
                  className="p-2 hover:bg-surfaceVariant rounded-full"
                >
                  <ZoomOut className="h-5 w-5" />
                </button>
                <span className="text-sm font-medium">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel(Math.min(2.0, zoomLevel + 0.1))}
                  className="p-2 hover:bg-surfaceVariant rounded-full"
                >
                  <ZoomIn className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* PDF Viewer */}
            <div ref={viewerRef} className="space-y-8">
              {pdf &&
                Array.from({ length: pdf.numPages }, (_, i) => i + 1).map(
                  (pageNum) => (
                    <div
                      key={pageNum}
                      ref={(el) => (pageRefs.current[pageNum - 1] = el)}
                      className="relative bg-white shadow-lg mx-auto"
                      style={{
                        width: `${pageDimensions[pageNum - 1]?.width * zoomLevel}px`,
                      }}
                    >
                      <canvas id={`pdf-page-${pageNum}`} />

                      {/* Signatures on this page */}
                      {signatures
                        .filter((sig) => sig.page === pageNum)
                        .map((sig, index) => (
                          <div
                            key={sig.id}
                            className="absolute border-2 border-primary bg-primary/10 cursor-move group"
                            style={{
                              left: `${sig.x * zoomLevel}px`,
                              top: `${sig.y * zoomLevel}px`,
                              width: `${sig.width * zoomLevel}px`,
                              height: `${sig.height * zoomLevel}px`,
                            }}
                            onMouseDown={(e) =>
                              handleSignatureDragStart(
                                e,
                                signatures.indexOf(sig),
                                sig
                              )
                            }
                          >
                            <img
                              src={sig.signatureData}
                              alt="Signature"
                              className="w-full h-full object-contain pointer-events-none"
                            />
                            <button
                              onClick={() => handleRemoveSignature(sig.id)}
                              className="absolute -top-2 -right-2 bg-error text-onError rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )
                )}
            </div>
          </div>
        )}
      </div>

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <SignaturePad
          onSave={handleSaveSignature}
          onCancel={() => setShowSignaturePad(false)}
          signerName={
            currentUser?.email || "Utilisateur"
          }
        />
      )}
    </div>
  );
};

export default QuickSignPage;

