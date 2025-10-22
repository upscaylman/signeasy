
import React from 'react';
import type { Document } from '../types';
import { DocumentStatus } from '../types';
import { FileText, Clock, PenSquare, Eye } from 'lucide-react';

interface DocumentCardProps {
  document: Document;
  onSign?: (id: string) => void;
  onView?: (id: string) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const statusStyles: { [key in DocumentStatus]: { bg: string, text: string } } = {
  [DocumentStatus.DRAFT]: { bg: 'bg-surfaceVariant', text: 'text-onSurfaceVariant' },
  [DocumentStatus.SENT]: { bg: 'bg-primaryContainer', text: 'text-onPrimaryContainer' },
  [DocumentStatus.SIGNED]: { bg: 'bg-tertiaryContainer', text: 'text-onTertiaryContainer' }, // Using tertiary for success
  [DocumentStatus.REJECTED]: { bg: 'bg-errorContainer', text: 'text-onErrorContainer' },
};


const DocumentCard: React.FC<DocumentCardProps> = ({ document, onSign, onView, isSelectionMode, isSelected, onSelect }) => {
  const { bg, text } = statusStyles[document.status];
  const needsAction = document.status === DocumentStatus.SENT;

  return (
    <div className="relative h-full">
      {isSelectionMode && (
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 bg-surface/90 rounded-md p-1.5 shadow-sm">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(document.id)}
            className="h-5 w-5 sm:h-6 sm:w-6 rounded text-primary focus:ring-primary border-outlineVariant cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Sélectionner le document ${document.name}`}
          />
        </div>
      )}
      <div 
        onClick={() => { if (isSelectionMode) onSelect(document.id) }}
        className={`
          bg-surfaceVariant/30 rounded-2xl border border-outlineVariant/30
          card-transition elevation-0 flex flex-col h-full
          ${isSelectionMode ? 'cursor-pointer' : ''}
          ${isSelected 
            ? 'ring-2 ring-primary border-primary elevation-3' 
            : 'hover:elevation-2 hover:border-outlineVariant/50'
          }
        `.trim().replace(/\s+/g, ' ')}
      >
        <div className="p-5 flex-grow">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3 pr-2 min-w-0">
              <div className="bg-primaryContainer p-2 rounded-full flex-shrink-0">
                <FileText className="h-5 w-5 text-onPrimaryContainer" />
              </div>
              <h3 className="text-md font-bold text-onSurface truncate" title={document.name}>
                {document.name}
              </h3>
            </div>
            <span className={`
              px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
              flex-shrink-0 animate-fade-in-scale
              ${bg} ${text}
              ${needsAction ? 'animate-pulse' : ''}
            `.trim().replace(/\s+/g, ' ')}>
              {document.status}
            </span>
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
                      <span className="text-error font-semibold">
                        ⏰ Expiré le {expiresAt.toLocaleDateString('fr-FR')}
                      </span>
                    );
                  } else if (daysLeft <= 2) {
                    return (
                      <span className="text-error font-semibold">
                        ⚠️ Expire dans {daysLeft} jour{daysLeft > 1 ? 's' : ''} ({expiresAt.toLocaleDateString('fr-FR')})
                      </span>
                    );
                  } else {
                    return (
                      <span className="text-onSurfaceVariant">
                        📅 Expire le {expiresAt.toLocaleDateString('fr-FR')} ({daysLeft} jours restants)
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
                     state-layer state-layer-primary
                     transition-colors
                   "
                 >
                    Signer maintenant <PenSquare className="ml-1.5 h-4 w-4" />
                 </button>
              )}
              {!needsAction && onView && (
                 <button 
                   onClick={() => onView(document.id)} 
                   className="
                     inline-flex items-center min-h-[40px] px-3 py-2
                     text-sm font-bold text-secondary rounded-lg
                     state-layer state-layer-secondary
                     transition-colors
                   "
                 >
                    Voir <Eye className="ml-1.5 h-4 w-4" />
                 </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentCard;
