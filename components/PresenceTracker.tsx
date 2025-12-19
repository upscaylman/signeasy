// Composant invisible qui gère le tracking de présence
import { useEffect } from 'react';
import { usePresence } from '../hooks/usePresence';
import { useUser } from './UserContext';

export const PresenceTracker: React.FC = () => {
  const { currentUser } = useUser();
  const { updatePresence, removePresence } = usePresence({ userEmail: currentUser?.email });

  useEffect(() => {
    if (currentUser) {
      // Mettre à jour la présence quand l'utilisateur change de page
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          updatePresence('signease');
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [currentUser, updatePresence]);

  // Ce composant ne rend rien visuellement
  return null;
};
