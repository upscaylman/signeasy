import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, FileText, Inbox, ShieldCheck } from 'lucide-react';
import { useUser } from './UserContext';
import { getUnreadEmailCount } from '../services/firebaseApi';

const MobileMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuHeight, setMenuHeight] = useState('calc(100dvh - 64px)');
  const location = useLocation();
  const { currentUser, logout } = useUser();

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
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // Récupérer le nombre d'emails non lus
  const fetchUnreadCount = async () => {
    try {
      const count = await getUnreadEmailCount(currentUser?.email);
      setUnreadCount(count);
    } catch (error) {
      console.error("Failed to fetch unread email count:", error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    
    // Listen for custom event when storage is updated
    window.addEventListener('storage_updated', fetchUnreadCount);
    
    // Écouter les événements de mise à jour de l'inbox
    const handleInboxUpdated = () => {
      fetchUnreadCount();
    };
    window.addEventListener('inboxUpdated', handleInboxUpdated);

    return () => {
      window.removeEventListener('storage_updated', fetchUnreadCount);
      window.removeEventListener('inboxUpdated', handleInboxUpdated);
    };
  }, [currentUser?.email]);

  // Refetch when navigating to inbox or dashboard
  useEffect(() => {
    if (location.pathname === '/inbox' || location.pathname === '/dashboard') {
      fetchUnreadCount();
    }
  }, [location.pathname]);

  const handleLogout = () => {
    setIsOpen(false);
    logout();
  };

  return (
    <>
      {/* Burger Icon - Toggle between Menu and X */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden flex items-center justify-center h-10 w-10 rounded-full hover:bg-surfaceVariant transition-colors"
        aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-onSurface" />
        ) : (
          <Menu className="h-6 w-6 text-onSurface" />
        )}
      </button>

      {/* Slide-in Menu from LEFT (below header) - Material Design 3 Expressive */}
      <div
        className={`fixed left-0 top-16 sm:top-18 w-full bg-[#fffbff] z-40 transform transition-all duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'
        }`}
        style={{ 
          height: menuHeight, // dvh = dynamic viewport height (prend en compte la barre du navigateur mobile)
        }}
      >
        {/* Navigation Links - Match Desktop Header Styles */}
        <nav className="flex-1 flex flex-col gap-1 p-6 overflow-y-auto pb-2">
          <NavLink
            to="/dashboard"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `flex items-center min-h-[44px] px-4 py-2 rounded-full text-base font-medium transition-colors ${
                isActive
                  ? 'bg-secondaryContainer text-onSecondaryContainer elevation-1'
                  : 'text-onSurfaceVariant state-layer state-layer-primary'
              }`
            }
          >
            <LayoutDashboard className="h-5 w-5 mr-2" />
            Tableau de bord
          </NavLink>

          <div className="relative">
            <NavLink
              to="/inbox"
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `flex items-center min-h-[44px] px-4 py-2 rounded-full text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-secondaryContainer text-onSecondaryContainer elevation-1'
                    : 'text-onSurfaceVariant state-layer state-layer-primary'
                }`
              }
            >
              <Inbox className="h-5 w-5 mr-2" />
              Boîte de réception
            </NavLink>
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-onPrimary text-xs font-bold animate-fade-in-scale elevation-2 badge-pulse">
                {unreadCount}
              </span>
            )}
          </div>

          <NavLink
            to="/verify"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `flex items-center min-h-[44px] px-4 py-2 rounded-full text-base font-medium transition-colors ${
                isActive
                  ? 'bg-secondaryContainer text-onSecondaryContainer elevation-1'
                  : 'text-onSurfaceVariant state-layer state-layer-primary'
              }`
            }
          >
            <ShieldCheck className="h-5 w-5 mr-2" />
            Vérifier le document
          </NavLink>
        </nav>

        {/* Logout Button at Bottom */}
        <div className="p-6 pb-8 sm:pb-6 border-t border-outlineVariant/20 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full text-white font-medium transition-all btn-premium-shine btn-premium-extended focus:outline-none focus:ring-4 focus:ring-primary/30"
            style={{ backgroundColor: '#201a19' }}
          >
            <LogOut className="h-5 w-5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default MobileMenu;
