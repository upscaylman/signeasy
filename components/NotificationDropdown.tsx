import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, Check, FileSignature, CheckCircle, XCircle, Mail, Send, X } from 'lucide-react';
import { collection, query, where, getDocs, getDoc, updateDoc, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from './UserContext';
import Tooltip from './Tooltip';

interface Notification {
  id: string;
  type: 'SEND' | 'SIGN' | 'REJECT' | 'COMPLETE' | 'RECEIVED' | 'SIGNED_BY_ME' | 'REJECTED_BY_ME';
  documentId: string;
  documentName: string;
  message: string;
  timestamp: string;
  read: boolean;
  recipientName?: string;
  source: 'sent' | 'received'; // Pour distinguer expéditeur vs destinataire
  emailId?: string; // Pour les notifications de type email
}

const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuHeight, setMenuHeight] = useState('calc(100dvh - 64px)');
  const navigate = useNavigate();
  const { currentUser } = useUser();

  // Calculer la hauteur du menu en fonction de la taille de l'écran
  useEffect(() => {
    const updateMenuHeight = () => {
      const isSmallScreen = window.innerWidth < 640;
      setMenuHeight(isSmallScreen ? 'calc(100dvh - 64px)' : 'calc(100dvh - 72px)');
    };

    updateMenuHeight();
    window.addEventListener('resize', updateMenuHeight);
    return () => window.removeEventListener('resize', updateMenuHeight);
  }, []);

  // Bloquer le scroll quand le menu est ouvert
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // Récupérer les notifications depuis Firestore
  const fetchNotifications = async () => {
    if (!currentUser?.email) return;

    try {
      const allNotifications: Notification[] = [];

      // ========== PARTIE 1 : NOTIFICATIONS EXPÉDITEUR (documents envoyés) ==========
      const docsQuery = query(
        collection(db, 'documents'),
        where('creatorEmail', '==', currentUser.email.toLowerCase())
      );
      const docsSnapshot = await getDocs(docsQuery);

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
                message = `Document rejeté par ${recipientName}`;
                break;
              case 'COMPLETE':
                message = `Toutes les signatures sont complètes`;
                break;
            }

            allNotifications.push({
              id: `sent-${docData.id}-${event.timestamp}`,
              type: event.type,
              documentId: docData.id,
              documentName: docData.name,
              message,
              timestamp: event.timestamp,
              read: event.read || false,
              recipientName,
              source: 'sent'
            });
          });
        }
      }

      // ========== PARTIE 2 : NOTIFICATIONS DESTINATAIRE (emails reçus) ==========
      const emailsQuery = query(
        collection(db, 'emails'),
        where('toEmail', '==', currentUser.email.toLowerCase())
      );
      const emailsSnapshot = await getDocs(emailsQuery);

      for (const emailDoc of emailsSnapshot.docs) {
        const emailData = emailDoc.data();
        let notifType: Notification['type'] = 'RECEIVED';
        let message = '';

        // Déterminer le type selon le contenu de l'email
        if (emailData.subject.includes('✅') || emailData.body?.includes('signé')) {
          notifType = 'SIGNED_BY_ME';
          message = 'Vous avez signé ce document';
        } else if (emailData.subject.includes('❌') || emailData.body?.includes('rejeté')) {
          notifType = 'REJECTED_BY_ME';
          message = 'Vous avez rejeté ce document';
        } else {
          notifType = 'RECEIVED';
          message = 'Nouveau document à signer';
        }

        allNotifications.push({
          id: `received-${emailDoc.id}`,
          type: notifType,
          documentId: emailData.documentId || emailDoc.id,
          documentName: emailData.documentName || emailData.subject,
          message,
          timestamp: emailData.sentAt,
          read: emailData.read || false,
          source: 'received',
          emailId: emailDoc.id
        });
      }

      // Trier par date décroissante et limiter à 10
      const sortedNotifications = allNotifications
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

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
      if (notification.source === 'sent') {
        // Notification expéditeur : Mettre à jour dans audit trail
        const auditDocRef = doc(db, 'auditTrails', notification.documentId);
        const auditDoc = await getDoc(auditDocRef);

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
      } else if (notification.source === 'received' && notification.emailId) {
        // Notification destinataire : Mettre à jour l'email
        const emailRef = doc(db, 'emails', notification.emailId);
        await updateDoc(emailRef, { read: true });
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
        if (notification.source === 'sent') {
          // Notifications expéditeur
          const auditDocRef = doc(db, 'auditTrails', notification.documentId);
          const auditDoc = await getDoc(auditDocRef);

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
        } else if (notification.source === 'received' && notification.emailId) {
          // Notifications destinataire
          const emailRef = doc(db, 'emails', notification.emailId);
          batch.update(emailRef, { read: true });
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

  // Supprimer une notification
  const deleteNotification = async (notification: Notification, event: React.MouseEvent) => {
    event.stopPropagation(); // Empêcher le clic sur la notification
    
    try {
      if (notification.source === 'sent') {
        // Notification expéditeur : Supprimer l'événement de l'audit trail
        const auditDocRef = doc(db, 'auditTrails', notification.documentId);
        const auditDoc = await getDoc(auditDocRef);

        if (auditDoc.exists()) {
          const auditData = auditDoc.data();
          const events = auditData.events || [];
          
          // Filtrer pour retirer cet événement
          const updatedEvents = events.filter((event: any) => 
            event.timestamp !== notification.timestamp
          );

          await updateDoc(auditDocRef, { events: updatedEvents });
        }
      } else if (notification.source === 'received' && notification.emailId) {
        // Notification destinataire : Supprimer l'email
        const emailRef = doc(db, 'emails', notification.emailId);
        await deleteDoc(emailRef);
      }

      // Mettre à jour localement
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      if (!notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Erreur lors de la suppression de la notification:', error);
    }
  };

  // Gérer le clic sur une notification
  const handleNotificationClick = async (notification: Notification) => {
    await markAsRead(notification);
    setIsOpen(false);
    
    // Rediriger selon la source
    if (notification.source === 'received') {
      navigate('/inbox'); // Destinataire -> inbox
    } else {
      navigate('/dashboard'); // Expéditeur -> dashboard
    }
  };

  // Icône selon le type de notification
  const getIcon = (type: string) => {
    switch (type) {
      case 'SEND':
        return <Send className="h-4 w-4 text-blue-500" />;
      case 'SIGN':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'REJECT':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'COMPLETE':
        return <Check className="h-4 w-4 text-purple-500" />;
      case 'RECEIVED':
        return <Mail className="h-4 w-4 text-blue-500" />;
      case 'SIGNED_BY_ME':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'REJECTED_BY_ME':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="relative">
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

      {/* Slide-in Notifications from RIGHT (comme le menu burger) */}
      {isOpen && (
        <div
          className="fixed right-0 top-16 sm:top-18 w-full sm:w-96 bg-surface z-40 flex flex-col shadow-2xl animate-slide-down"
          style={{ 
            height: menuHeight,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-outlineVariant flex-shrink-0">
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
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex items-center justify-center h-full p-8 text-center text-onSurfaceVariant">
                <div>
                  <BellOff className="h-16 w-16 mx-auto mb-4 opacity-40" />
                  <p className="text-base font-medium">Aucune notification</p>
                  <p className="text-xs mt-2 opacity-70">Vous n'avez aucune notification pour le moment</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`
                      w-full p-4 border-b border-outlineVariant/50 text-left
                      hover:bg-surfaceVariant/50 transition-colors group relative
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
                    {/* Bouton de suppression */}
                    <button
                      onClick={(e) => deleteNotification(notification, e)}
                      className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-error/10 text-error opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Supprimer cette notification"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer - Toujours visible */}
          <div className="p-3 border-t border-outlineVariant flex-shrink-0">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/inbox');
                }}
                className="text-sm text-primary hover:underline font-medium"
              >
                Voir la boîte de réception
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/dashboard');
                }}
                className="text-sm text-primary hover:underline font-medium"
              >
                Voir le tableau de bord
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;

