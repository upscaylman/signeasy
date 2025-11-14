import { useEffect, useState } from "react";

const STORAGE_KEY = "prepare_document_drafts";
const MAX_DRAFTS = 3;

export interface DraftDocument {
  id: string;
  pdfData: string;
  fileName: string;
  timestamp: number;
}

export const useDraftDocument = () => {
  const [drafts, setDrafts] = useState<DraftDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Charger les brouillons au montage et écouter les changements
  useEffect(() => {
    loadDrafts();

    // Écouter les changements de localStorage (synchronisation entre onglets/composants)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        loadDrafts();
      }
    };

    // Écouter les événements personnalisés pour la synchronisation interne
    const handleCustomStorageChange = () => {
      loadDrafts();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("draftsChanged", handleCustomStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("draftsChanged", handleCustomStorageChange);
    };
  }, []);

  const loadDrafts = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DraftDocument[];
        setDrafts(parsed);
      } else {
        setDrafts([]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des brouillons:", error);
      setDrafts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDraft = (pdfData: string, fileName: string): string | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      let currentDrafts: DraftDocument[] = stored ? JSON.parse(stored) : [];

      // Vérifier si on a déjà un brouillon avec ce nom de fichier
      const existingIndex = currentDrafts.findIndex(
        (d) => d.fileName === fileName
      );

      if (existingIndex !== -1) {
        // Mettre à jour le brouillon existant
        currentDrafts[existingIndex] = {
          ...currentDrafts[existingIndex],
          pdfData,
          timestamp: Date.now(),
        };
        console.log("💾 Brouillon mis à jour:", fileName);
      } else {
        // Vérifier la limite de 3 brouillons
        if (currentDrafts.length >= MAX_DRAFTS) {
          console.warn("⚠️ Limite de 3 brouillons atteinte");
          return null;
        }

        // Créer un nouveau brouillon
        const newDraft: DraftDocument = {
          id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          pdfData,
          fileName,
          timestamp: Date.now(),
        };
        currentDrafts.push(newDraft);
        console.log("💾 Nouveau brouillon sauvegardé:", fileName);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentDrafts));
      setDrafts(currentDrafts);

      // Déclencher un événement personnalisé pour notifier les autres composants
      window.dispatchEvent(new Event("draftsChanged"));

      return currentDrafts[currentDrafts.length - 1].id;
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du brouillon:", error);
      // Gérer l'erreur de quota localStorage
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        console.error("Quota localStorage dépassé");
      }
      return null;
    }
  };

  const deleteDraft = (draftId: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const currentDrafts: DraftDocument[] = JSON.parse(stored);
      const updatedDrafts = currentDrafts.filter((d) => d.id !== draftId);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDrafts));
      setDrafts(updatedDrafts);

      // Déclencher un événement personnalisé pour notifier les autres composants
      window.dispatchEvent(new Event("draftsChanged"));

      console.log("🗑️ Brouillon supprimé:", draftId);
    } catch (error) {
      console.error("Erreur lors de la suppression du brouillon:", error);
    }
  };

  const getDraft = (draftId: string): DraftDocument | null => {
    return drafts.find((d) => d.id === draftId) || null;
  };

  const refreshDrafts = () => {
    loadDrafts();
  };

  const hasDrafts = drafts.length > 0;

  const canAddDraft = (): boolean => {
    return drafts.length < MAX_DRAFTS;
  };

  return {
    drafts,
    isLoading,
    saveDraft,
    deleteDraft,
    getDraft,
    refreshDrafts,
    hasDrafts,
    canAddDraft,
    maxDrafts: MAX_DRAFTS,
  };
};
