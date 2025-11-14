import { useEffect, useState } from 'react';

const STORAGE_KEY = 'prepare_document_file';

export interface DraftDocument {
  pdfData: string;
  fileName: string;
  timestamp: number;
}

export const useDraftDocument = () => {
  const [draft, setDraft] = useState<DraftDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Charger le brouillon au montage
  useEffect(() => {
    loadDraft();
  }, []);

  const loadDraft = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DraftDocument;
        setDraft(parsed);
      } else {
        setDraft(null);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du brouillon:', error);
      setDraft(null);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDraft = (pdfData: string, fileName: string) => {
    try {
      const draftData: DraftDocument = {
        pdfData,
        fileName,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draftData));
      setDraft(draftData);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du brouillon:', error);
      // Gérer l'erreur de quota localStorage
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('Quota localStorage dépassé');
      }
    }
  };

  const deleteDraft = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setDraft(null);
    } catch (error) {
      console.error('Erreur lors de la suppression du brouillon:', error);
    }
  };

  const refreshDraft = () => {
    loadDraft();
  };

  const hasDraft = draft !== null;

  return {
    draft,
    isLoading,
    saveDraft,
    deleteDraft,
    refreshDraft,
    hasDraft,
  };
};

