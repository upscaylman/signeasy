import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, FileSignature, CheckCircle, XCircle } from 'lucide-react';
import { collection, query, where, getDocs, getDoc, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from './UserContext';
import Tooltip from './Tooltip';

interface Notification {
  id: string;
  type: 'SEND' | 'SIGN' | 'REJECT' | 'COMPLETE';
  documentId: string;
  documentName: string;
  message: string;
  timestamp: string;
  read: boolean;
  recipientName?: string;
}

const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { currentUser } = useUser();

  // Fermer le dropdown si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Récupérer les notifications depuis Firestore
  const fetchNotifications = async () => {
    if (!currentUser?.email) return;

    try {
      // 1. Récupérer tous les documents créés par l'utilisateur
      const docsQuery = query(
        collection(db, 'documents'),
        where('creatorEmail', '==', currentUser.email.toLowerCase())
      );
      const docsSnapshot = await getDocs(docsQuery);
      
      const allNotifications: Notification[] = [];

      // 2. Pour chaque document, récupérer l'audit trail
      for (const docSnapshot of docsSnapshot.docs) {
        const docData = docSnapshot.data();
        const auditDoc = await getDoc(
          doc(db, 'auditTrails', docData.id)
        );

        if (auditDoc.exists()) {
          const auditData = auditDoc.data();
          const events = auditData.events || [];

          // Filtrer les événements pertinents (SEND, SIGN, REJECT, COMPLETE)
          const relevantEvents = events.filter((event: any) => 
            ['SEND', 'SIGN', 'REJECT', 'COMPLETE'].includes(event.type)
          );

          // Créer des notifications pour chaque événement
          relevantEvents.forEach((event: any) => {
            let message = '';
            const recipientName = event.user || 'Utilisateur';

            switch (event.type) {
              case 'SEND':
                message = `Document envoyé pour signature`;
                break;
              case 'SIGN':
                message = `Document signé par ${recipientName}`;
                break;
              case 'REJECT':
                message = `Document refusé par ${recipientName}`;
                break;
              case 'COMPLETE':
                message = `Toutes les signatures sont complètes`;
                break;
            }

            allNotifications.push({
              id: `${docData.id}-${event.timestamp}`,
              type: event.type,
              documentId: docData.id,
              documentName: docData.name,
              message,
              timestamp: event.timestamp,
              read: event.read || false,
              recipientName
            });
          });
        }
      }

      // Trier par date décroissante et limiter à 5
      const sortedNotifications = allNotifications
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);

      setNotifications(sortedNotifications);
      setUnreadCount(sortedNotifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Erreur lors de la récupération des notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Refetch périodiquement (toutes les 30 secondes)
    const interval = setInterval(fetchNotifications, 30000);
    
    return () => clearInterval(interval);
  }, [currentUser?.email]);

  // Marquer une notification comme lue
  const markAsRead = async (notification: Notification) => {
    try {
      // Mettre à jour dans Firestore
      const auditDocRef = doc(db, 'auditTrails', notification.documentId);
      const auditDoc = await getDoc(
        doc(db, 'auditTrails', notification.documentId)
      );

      if (auditDoc.exists()) {
        const auditData = auditDoc.data();
        const events = auditData.events || [];
        
        const updatedEvents = events.map((event: any) => {
          if (event.timestamp === notification.timestamp) {
            return { ...event, read: true };
          }
          return event;
        });

        await updateDoc(auditDocRef, { events: updatedEvents });
      }

      // Mettre à jour localement
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erreur lors du marquage comme lu:', error);
    }
  };

  // Marquer toutes les notifications comme lues
  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      
      for (const notification of notifications.filter(n => !n.read)) {
        const auditDocRef = doc(db, 'auditTrails', notification.documentId);
        const auditDoc = await getDoc(
          doc(db, 'auditTrails', notification.documentId)
        );

        if (auditDoc.exists()) {
          const auditData = auditDoc.data();
          const events = auditData.events || [];
          
          const updatedEvents = events.map((event: any) => {
            if (event.timestamp === notification.timestamp) {
              return { ...event, read: true };
            }
            return event;
          });

          batch.update(auditDocRef, { events: updatedEvents });
        }
      }

      await batch.commit();

      // Mettre à jour localement
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Erreur lors du marquage de toutes les notifications:', error);
    }
  };

  // Gérer le clic sur une notification
  const handleNotificationClick = async (notification: Notification) => {
    await markAsRead(notification);
    setIsOpen(false);
    
    // Rediriger vers le document concerné
    navigate(`/dashboard`); // TODO: Naviguer vers le document spécifique si possible
  };

  // Icône selon le type de notification
  const getIcon = (type: string) => {
    switch (type) {
      case 'SEND':
        return <FileSignature className="h-4 w-4 text-blue-500" />;
      case 'SIGN':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'REJECT':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'COMPLETE':
        return <Check className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Tooltip content="Notifications" position="bottom">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="
            flex items-center justify-center min-h-[44px] min-w-[44px] w-10 h-10
            rounded-full
            text-onSurfaceVariant state-layer state-layer-primary
            hover:bg-surfaceVariant
            transition-colors
          "
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>
      </Tooltip>
      {unreadCount > 0 && (
        <span className="
          absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center
          rounded-full bg-primary text-onPrimary text-xs font-bold
          animate-fade-in-scale elevation-2 badge-pulse
        ">
          {unreadCount}
        </span>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="
          absolute right-0 mt-2 w-80 sm:w-96
          bg-surface rounded-2xl shadow-2xl border border-outlineVariant
          z-50 overflow-hidden animate-slide-down
        ">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-outlineVariant">
            <h3 className="font-bold text-lg text-onSurface">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary hover:underline font-medium"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* Liste des notifications */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-onSurfaceVariant">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucune notification pour le moment</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    w-full p-4 border-b border-outlineVariant/50 text-left
                    hover:bg-surfaceVariant/50 transition-colors
                    ${!notification.read ? 'bg-primaryContainer/10' : ''}
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'} text-onSurface`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-onSurfaceVariant truncate mt-1">
                        {notification.documentName}
                      </p>
                      <p className="text-xs text-onSurfaceVariant mt-1">
                        {new Date(notification.timestamp).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-outlineVariant text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/dashboard');
                }}
                className="text-sm text-primary hover:underline font-medium"
              >
                Voir tous les documents
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;

