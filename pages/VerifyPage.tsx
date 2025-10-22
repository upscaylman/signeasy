
import React, { useState } from 'react';
import Button from '../components/Button';
import { getAuditTrail } from '../services/firebaseApi';
import type { AuditEvent } from '../types';
import { ShieldCheck, Search, FilePlus, Send, PenSquare, Ban, CheckCircle, Clock } from 'lucide-react';

interface AuditData {
    documentId: string;
    documentName: string;
    events: AuditEvent[];
    error?: string;
}

const eventIcons: {[key in AuditEvent['type']]: React.ElementType} = {
    CREATE: FilePlus,
    SEND: Send,
    SIGN: PenSquare,
    REJECT: Ban,
    COMPLETE: CheckCircle,
    TIMESTAMP: Clock,
};

const AuditTimeline: React.FC<{data: AuditData}> = ({data}) => {
    return (
        <div className="space-y-4">
            {data.events.map((event, index) => {
                const Icon = eventIcons[event.type] || ShieldCheck;
                return (
                    <div key={index} className="flex items-start gap-2 sm:gap-4 text-left cascade-item">
                        <div className="bg-surface p-2 rounded-full border border-outlineVariant/30 flex-shrink-0 transition-transform hover:scale-110">
                           <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
                        </div>
                        <div className="flex-grow pb-4 border-b border-outlineVariant/30 min-w-0">
                            <p className="font-bold text-onSurface break-words">{event.action}</p>
                            <div className="text-xs text-onSurfaceVariant mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                                <span className="whitespace-nowrap">{new Date(event.timestamp).toLocaleString('fr-FR')}</span>
                                {event.user && <span className="truncate">👤 {event.user}</span>}
                                {event.ip && <span className="truncate">🌐 {event.ip}</span>}
                            </div>
                            {event.reason && <p className="text-xs sm:text-sm text-error mt-2 p-2 bg-errorContainer/30 rounded-lg break-words">Raison : {event.reason}</p>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const VerifyPage: React.FC = () => {
  const [documentId, setDocumentId] = useState('');
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId) {
      setError('Veuillez entrer un ID de document.');
      return;
    }
    setError('');
    setIsLoading(true);
    setAuditData(null);
    try {
      const trailJson = await getAuditTrail(documentId);
      const data: AuditData = JSON.parse(trailJson);
      if(data.error){
        setError(data.error);
      } else {
        setAuditData(data);
      }
    } catch (err) {
      setError('Une erreur est survenue lors de la vérification du document.');
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
            <h1 className="text-4xl font-bold text-onSurface">Vérifier un document</h1>
            <p className="mt-1 text-md text-onSurfaceVariant">
              Entrez l'ID unique du document pour récupérer sa piste d'audit.
            </p>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-4xl">
        <div className="bg-surface p-4 sm:p-6 rounded-3xl shadow-sm border border-outlineVariant/30">
          <form onSubmit={handleVerify} className="flex flex-col sm:flex-row items-stretch gap-2">
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
            <Button variant="glass" type="submit" isLoading={isLoading} className="w-full sm:w-auto">
              Vérifier
            </Button>
          </form>

          {error && <p className="mt-4 text-sm text-error">{error}</p>}
        </div>

        {auditData && (
          <div className="mt-6 bg-surface p-4 sm:p-6 rounded-3xl shadow-sm border border-outlineVariant/30">
            <h2 className="text-lg sm:text-xl font-bold text-onSurface mb-1">Piste d'audit</h2>
            <p className="text-xs sm:text-sm text-onSurfaceVariant mb-4 sm:mb-6 truncate" title={auditData.documentName}>{auditData.documentName}</p>
            <AuditTimeline data={auditData} />
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyPage;
