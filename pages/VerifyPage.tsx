import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle,
  CheckCircle2,
  Clock,
  FilePlus,
  PenSquare,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Icon } from "../src/components/atoms";
import {
  getAuditTrail,
  getPdfData,
  verifyPDFSignature,
} from "../services/firebaseApi";
import type { AuditEvent } from "../types";

interface AuditData {
  documentId: string;
  documentName: string;
  events: AuditEvent[];
  error?: string;
}

interface VerificationResult {
  valid: boolean;
  signer: string | null;
  timestamp: string | null;
  conformanceLevel: string | null;
  errors: string[];
  warnings: string[];
  trustScore: number; // 0-100
}

const eventIcons: { [key in AuditEvent["type"]]: React.ElementType } = {
  CREATE: FilePlus,
  SEND: Send,
  SIGN: PenSquare,
  REJECT: Ban,
  COMPLETE: CheckCircle,
  TIMESTAMP: Clock,
};

const AuditTimeline: React.FC<{ data: AuditData }> = ({ data }) => {
  return (
    <div className="space-y-4">
      {data.events.map((event, index) => {
        const Icon = eventIcons[event.type] || ShieldCheck;
        return (
          <div
            key={index}
            className="flex items-start gap-2 sm:gap-4 text-left cascade-item"
          >
            <div className="bg-surface p-2 rounded-full border border-outlineVariant/30 flex-shrink-0 transition-transform hover:scale-110">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
            </div>
            <div className="flex-grow pb-4 border-b border-outlineVariant/30 min-w-0">
              <p className="font-bold text-onSurface break-words">
                {event.action}
              </p>
              <div className="text-xs text-onSurfaceVariant mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="whitespace-nowrap">
                  {new Date(event.timestamp).toLocaleString("fr-FR")}
                </span>
                {event.user && (
                  <span className="truncate">👤 {event.user}</span>
                )}
                {event.ip && <span className="truncate">🌐 {event.ip}</span>}
              </div>
              {event.reason && (
                <p className="text-xs sm:text-sm text-error mt-2 p-2 bg-errorContainer/30 rounded-lg break-words">
                  Raison : {event.reason}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const VerifyPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [documentId, setDocumentId] = useState("");
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // 🔗 Récupérer le documentId depuis l'URL au chargement
  useEffect(() => {
    const docId = searchParams.get("doc");
    if (docId) {
      setDocumentId(docId);
      console.log("📋 Document ID détecté depuis l'URL:", docId);
    }
  }, [searchParams]);

  // 🔐 Calculer le score de confiance (0-100)
  const calculateTrustScore = (
    result: Omit<VerificationResult, "trustScore">
  ): number => {
    let score = 100;

    // Erreurs critiques : -50 points chacune
    score -= result.errors.length * 50;

    // Warnings : -10 points chacun
    score -= result.warnings.length * 10;

    // Bonus si signature valide
    if (result.valid) score += 20;

    // Bonus si conformité PAdES
    if (result.conformanceLevel?.includes("PAdES")) score += 10;

    return Math.max(0, Math.min(100, score));
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId) {
      setError("Veuillez entrer un ID de document.");
      return;
    }
    setError("");
    setIsLoading(true);
    setAuditData(null);
    setVerificationResult(null);

    try {
      // 📋 Étape 1: Récupérer l'audit trail
      const trailJson = await getAuditTrail(documentId);
      const data: AuditData = JSON.parse(trailJson);

      if (data.error) {
        setError(data.error);
        return;
      }

      setAuditData(data);

      // 🔐 Étape 2: Vérifier la signature PDF
      try {
        const pdfData = await getPdfData(documentId);
        if (!pdfData) {
          throw new Error("Impossible de charger le PDF");
        }

        // Convertir data URL en bytes
        const base64Data = pdfData.split(",")[1];
        const binaryString = atob(base64Data);
        const pdfBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          pdfBytes[i] = binaryString.charCodeAt(i);
        }

        const verification = await verifyPDFSignature(pdfBytes, documentId);

        // Calculer le score de confiance
        const trustScore = calculateTrustScore(verification);

        setVerificationResult({
          ...verification,
          trustScore,
        });
      } catch (pdfError) {
        console.error("Erreur lors de la vérification du PDF:", pdfError);
        setVerificationResult({
          valid: false,
          signer: null,
          timestamp: null,
          conformanceLevel: null,
          errors: ["Impossible de charger le PDF pour vérification"],
          warnings: [],
          trustScore: 0,
        });
      }
    } catch (err) {
      console.error("Erreur de vérification:", err);
      setError("Une erreur est survenue lors de la vérification du document.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header avec icône */}
      <div className="flex items-start sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-tertiaryContainer inline-block p-4 rounded-full progressive-glow">
            <ShieldCheck className="h-12 w-12 text-onTertiaryContainer" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-onSurface">
              Vérifier un document
            </h1>
            <p className="mt-1 text-md text-onSurfaceVariant">
              Entrez l'ID unique du document pour récupérer sa piste d'audit.
            </p>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="">
        <div className="bg-surface p-4 sm:p-6 rounded-3xl shadow-sm border border-outlineVariant/30">
          <form
            onSubmit={handleVerify}
            className="flex flex-col sm:flex-row items-stretch gap-2"
          >
            <div className="relative flex-grow w-full">
              <input
                type="text"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="Entrez l'ID du document (ex: doc1)"
                className="w-full h-full p-3 pl-10 border border-outline bg-surface rounded-full focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-onSurfaceVariant" />
            </div>
            <div className="w-full sm:w-auto">
              <Button
                variant="primary"
                type="submit"
                disabled={isLoading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {isLoading ? (
                  <>
                    <Icon name="Loader2" size="sm" />
                    Vérification...
                  </>
                ) : (
                  <>
                    <Icon name="Search" size="sm" />
                    Vérifier
                  </>
                )}
              </Button>
            </div>
          </form>

          {error && <p className="mt-4 text-sm text-error">{error}</p>}
        </div>

        {/* 🔐 Résultats de vérification cryptographique */}
        {verificationResult && (
          <div className="mt-6 bg-surface p-4 sm:p-6 rounded-3xl shadow-sm border border-outlineVariant/30">
            <h2 className="text-lg sm:text-xl font-bold text-onSurface mb-4">
              Résultats de Vérification
            </h2>

            {/* Score de confiance */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-onSurfaceVariant">
                  Score de Confiance
                </span>
                <span
                  className={`text-2xl font-bold ${
                    verificationResult.trustScore >= 80
                      ? "text-green-600"
                      : verificationResult.trustScore >= 50
                      ? "text-orange-600"
                      : "text-red-600"
                  }`}
                >
                  {verificationResult.trustScore}%
                </span>
              </div>
              <div className="w-full bg-surfaceVariant rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all rounded-full ${
                    verificationResult.trustScore >= 80
                      ? "bg-green-600"
                      : verificationResult.trustScore >= 50
                      ? "bg-orange-600"
                      : "bg-red-600"
                  }`}
                  style={{ width: `${verificationResult.trustScore}%` }}
                />
              </div>
              <p className="text-xs text-onSurfaceVariant mt-2">
                {verificationResult.trustScore >= 80 &&
                  "✅ Document hautement fiable"}
                {verificationResult.trustScore >= 50 &&
                  verificationResult.trustScore < 80 &&
                  "⚠️ Document partiellement vérifié"}
                {verificationResult.trustScore < 50 &&
                  "❌ Document non fiable ou altéré"}
              </p>
            </div>

            {/* Informations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-surfaceVariant/30 p-3 rounded-lg">
                <p className="text-xs text-onSurfaceVariant mb-1">Signataire</p>
                <p className="text-sm font-semibold text-onSurface">
                  {verificationResult.signer || "Non spécifié"}
                </p>
              </div>
              <div className="bg-surfaceVariant/30 p-3 rounded-lg">
                <p className="text-xs text-onSurfaceVariant mb-1">
                  Date de signature
                </p>
                <p className="text-sm font-semibold text-onSurface">
                  {verificationResult.timestamp
                    ? new Date(verificationResult.timestamp).toLocaleString(
                        "fr-FR"
                      )
                    : "Non disponible"}
                </p>
              </div>
              <div className="bg-surfaceVariant/30 p-3 rounded-lg">
                <p className="text-xs text-onSurfaceVariant mb-1">Conformité</p>
                <p className="text-sm font-semibold text-onSurface">
                  {verificationResult.conformanceLevel || "Non spécifié"}
                </p>
              </div>
              <div className="bg-surfaceVariant/30 p-3 rounded-lg">
                <p className="text-xs text-onSurfaceVariant mb-1">Statut</p>
                <p
                  className={`text-sm font-semibold ${
                    verificationResult.valid ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {verificationResult.valid ? "✅ Valide" : "❌ Invalide"}
                </p>
              </div>
            </div>

            {/* Erreurs */}
            {verificationResult.errors.length > 0 && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="ml-3">
                    <h3 className="text-sm font-semibold text-red-900 mb-2">
                      Erreurs détectées
                    </h3>
                    <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                      {verificationResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Avertissements */}
            {verificationResult.warnings.length > 0 && (
              <div className="bg-orange-50 border-l-4 border-orange-600 p-4 rounded-r-lg">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="ml-3">
                    <h3 className="text-sm font-semibold text-orange-900 mb-2">
                      Avertissements
                    </h3>
                    <ul className="list-disc list-inside text-sm text-orange-800 space-y-1">
                      {verificationResult.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Succès */}
            {verificationResult.valid &&
              verificationResult.errors.length === 0 && (
                <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded-r-lg">
                  <div className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-semibold text-green-900">
                        Document vérifié avec succès
                      </h3>
                      <p className="text-sm text-green-800 mt-1">
                        La signature électronique est valide et le document n'a
                        pas été modifié depuis sa signature.
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* 📋 Piste d'audit */}
        {auditData && (
          <div className="mt-6 bg-surface p-4 sm:p-6 rounded-3xl shadow-sm border border-outlineVariant/30">
            <h2 className="text-lg sm:text-xl font-bold text-onSurface mb-1">
              Piste d'audit
            </h2>
            <p
              className="text-xs sm:text-sm text-onSurfaceVariant mb-4 sm:mb-6 truncate"
              title={auditData.documentName}
            >
              {auditData.documentName}
            </p>
            <AuditTimeline data={auditData} />
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyPage;
