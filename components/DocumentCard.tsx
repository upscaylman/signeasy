
import React from 'react';
import type { Document } from '../types';
import { DocumentStatus } from '../types';
import { FileText, Clock, PenSquare, Eye, AlertCircle, Calendar, CheckCircle } from 'lucide-react';

interface DocumentCardProps {
  document: Document;
  onSign?: (id: string) => void;
  onView?: (id: string) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  documentSource?: 'sent' | 'received'; // Pour différencier expéditeur/destinataire
}

const statusStyles: { [key in DocumentStatus]: { bg: string, text: string } } = {
  [DocumentStatus.DRAFT]: { bg: 'bg-surfaceVariant', text: 'text-onSurfaceVariant' },
  [DocumentStatus.SENT]: { bg: 'bg-primaryContainer', text: 'text-onPrimaryContainer' },
  [DocumentStatus.SIGNED]: { bg: 'bg-tertiaryContainer', text: 'text-onTertiaryContainer' }, // Using tertiary for success
  [DocumentStatus.REJECTED]: { bg: 'bg-errorContainer', text: 'text-onErrorContainer' },
};


const DocumentCard: React.FC<DocumentCardProps> = ({ document, onSign, onView, isSelectionMode, isSelected, onSelect, documentSource }) => {
  const { bg, text } = statusStyles[document.status];
  // 🔒 needsAction uniquement si destinataire (received) et statut SENT
  // Si expéditeur (sent), toujours en lecture seule
  const needsAction = documentSource === 'received' && document.status === DocumentStatus.SENT;

  return (
    <div className="relative h-full cascade-item">
      <div 
        onClick={() => { if (isSelectionMode) onSelect(document.id) }}
        className={`
          bg-surfaceVariant/30 rounded-2xl border border-outlineVariant/30
          card-transition card-depth elevation-0 flex flex-col h-full
          ${isSelectionMode ? 'cursor-pointer press-effect' : ''}
          ${isSelected 
            ? 'ring-2 ring-primary border-primary elevation-3 success-pop' 
            : 'hover:elevation-2 hover:border-outlineVariant/50'
          }
        `.trim().replace(/\s+/g, ' ')}
      >
        <div className="p-5 flex-grow">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="bg-primaryContainer p-2 rounded-full flex-shrink-0">
                <FileText className="h-5 w-5 text-onPrimaryContainer" />
              </div>
              <h3 className="text-md font-bold text-onSurface truncate" title={document.name}>
                {document.name}
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`
                px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                animate-fade-in-scale
                ${bg} ${text}
                ${needsAction ? 'badge-pulse' : ''}
              `.trim().replace(/\s+/g, ' ')}>
                {document.status}
              </span>
              {isSelectionMode && (
                <label className="cursor-pointer group animate-fade-in-scale" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelect(document.id)}
                    className="sr-only peer"
                    aria-label={`Sélectionner le document ${document.name}`}
                  />
                  <div className="
                    w-6 h-6 sm:w-7 sm:h-7
                    rounded-full border-2
                    bg-surface elevation-1
                    flex items-center justify-center
                    transition-all duration-200
                    peer-checked:bg-primary peer-checked:border-primary peer-checked:elevation-2
                    peer-focus:ring-2 peer-focus:ring-primary
                    group-hover:elevation-2 group-hover:scale-105
                    border-outlineVariant
                  ">
                    {isSelected && (
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-onPrimary animate-expand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </label>
              )}
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center text-sm text-onSurfaceVariant">
              <Clock className="flex-shrink-0 mr-1.5 h-5 w-5" />
              <p>Mis à jour le: {new Date(document.updatedAt).toLocaleDateString()}</p>
            </div>
            {document.expiresAt && (
              <div className="flex items-center text-xs">
                {(() => {
                  const now = new Date();
                  const expiresAt = new Date(document.expiresAt);
                  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  
                  if (daysLeft < 0) {
                    return (
                      <span className="text-error font-semibold flex items-center gap-1">
                        <Clock className="h-4 w-4 flex-shrink-0" /> Expiré le {expiresAt.toLocaleDateString('fr-FR')}
                      </span>
                    );
                  } else if (daysLeft <= 2) {
                    return (
                      <span className="text-error font-semibold flex items-center gap-1">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" /> Expire dans {daysLeft} jour{daysLeft > 1 ? 's' : ''} ({expiresAt.toLocaleDateString('fr-FR')})
                      </span>
                    );
                  } else {
                    return (
                      <span className="text-onSurfaceVariant flex items-center gap-1">
                        <Calendar className="h-4 w-4 flex-shrink-0" /> Expire le {expiresAt.toLocaleDateString('fr-FR')} ({daysLeft} jours restants)
                      </span>
                    );
                  }
                })()}
              </div>
            )}
          </div>
        </div>
        
        {!isSelectionMode && (
          <div className="border-t border-outlineVariant/30 bg-surfaceVariant/20 px-5 py-3 rounded-b-2xl">
            <div className="flex items-center justify-end space-x-4">
              {needsAction && onSign && (
                 <button 
                   onClick={() => onSign(document.id)} 
                   className="
                     inline-flex items-center min-h-[40px] px-3 py-2
                     text-sm font-bold text-primary rounded-lg
                     state-layer state-layer-primary press-effect
                     transition-all hover:scale-[1.02]
                   "
                   aria-label={`Signer le document ${document.name}`}
                 >
                    Signer maintenant <PenSquare className="ml-1.5 h-4 w-4" />
                 </button>
              )}
              {!needsAction && onView && (
                 <>
                   {documentSource === 'sent' && (
                     <div className="bg-tertiaryContainer text-onTertiaryContainer px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
                       <CheckCircle className="h-3.5 w-3.5" />
                       Document en lecture seule
                     </div>
                   )}
                   <button 
                     onClick={() => onView(document.id)} 
                     className="
                       inline-flex items-center min-h-[40px] px-3 py-2
                       text-sm font-bold text-secondary rounded-lg
                       state-layer state-layer-secondary press-effect
                       transition-all hover:scale-[1.02]
                     "
                     aria-label={`Voir le document ${document.name}`}
                   >
                      Voir <Eye className="ml-1.5 h-4 w-4" />
                   </button>
                 </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentCard;
