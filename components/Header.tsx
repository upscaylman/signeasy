
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FileSignature, LayoutDashboard, ShieldCheck, Inbox, LogOut } from 'lucide-react';
import { getUnreadEmailCount } from '../services/firebaseApi';
import { useUser } from './UserContext';
import Tooltip from './Tooltip';
import MobileMenu from './MobileMenu';

const Header: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const { currentUser } = useUser();
  const { logout } = useUser();
  const [profileColor, setProfileColor] = useState<string>('');

  // Générer une couleur aléatoire au login (une fois par session)
  useEffect(() => {
    if (currentUser?.email) {
      // Vérifier si on a une couleur en localStorage pour cette email
      const storedColor = localStorage.getItem(`profileColor_${currentUser.email}`);
      
      if (storedColor) {
        setProfileColor(storedColor);
      } else {
        // Générer une nouvelle couleur aléatoire et la stocker
        const colors = [
          'bg-red-500',
          'bg-blue-500',
          'bg-green-500',
          'bg-purple-500',
          'bg-pink-500',
          'bg-indigo-500',
          'bg-cyan-500',
          'bg-orange-500',
          'bg-yellow-500',
          'bg-teal-500',
        ];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        setProfileColor(randomColor);
        localStorage.setItem(`profileColor_${currentUser.email}`, randomColor);
      }
    } else {
      // Déconnexion: nettoyer la couleur
      setProfileColor('');
      // Nettoyer aussi les localStorage des anciennes sessions
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('profileColor_')) {
          localStorage.removeItem(key);
        }
      });
    }
  }, [currentUser?.email]);

  // Extraire les 2 premières lettres de l'email
  const getInitials = () => {
    if (!currentUser?.email) return 'U';
    const parts = currentUser.email.split('@')[0];
    return parts.substring(0, 2).toUpperCase();
  };

  const activeLinkClass = "bg-secondaryContainer text-onSecondaryContainer elevation-1";
  const inactiveLinkClass = "text-onSurfaceVariant state-layer state-layer-primary";

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

    return () => {
      window.removeEventListener('storage_updated', fetchUnreadCount);
    };
  }, []);

  // Also refetch when navigating to the inbox, in case the event is missed
  useEffect(() => {
    if(location.pathname === '/inbox' || location.pathname === '/dashboard') {
        fetchUnreadCount();
    }
  }, [location.pathname]);

  return (
    <header className="glass-effect-strong border-b border-outlineVariant/50 sticky top-0 z-40 animate-slide-down backdrop-blur-xl">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-primary p-2 rounded-lg flex items-center justify-center h-10 w-10 elevation-2 progressive-glow transition-transform hover:scale-110">
              <span className="text-xl font-extrabold text-onPrimary">FO</span>
            </div>
            {/* Desktop: SignEase by FO Metaux */}
            <span className="hidden sm:inline text-xl font-bold whitespace-nowrap"><span className="text-gradient-primary">SignEase</span> <span className="text-onSurface">by FO Metaux</span></span>
            {/* Mobile: juste SignEase */}
            <span className="sm:hidden text-xl font-bold whitespace-nowrap"><span className="text-gradient-primary">SignEase</span></span>
          </div>
          {/* Navigation Desktop - avec labels */}
          <nav className="hidden lg:flex items-center space-x-2">
            <NavLink 
              to="/dashboard" 
              className={({ isActive }) => `
                flex items-center min-h-[44px] px-4 py-2 rounded-full
                text-sm font-medium
                ${isActive ? activeLinkClass : inactiveLinkClass}
              `.trim().replace(/\s+/g, ' ')}
            >
              <LayoutDashboard className="h-5 w-5 mr-2" />
              Tableau de bord
            </NavLink>
            <div className="relative">
              <NavLink 
                to="/inbox" 
                className={({ isActive }) => `
                  flex items-center min-h-[44px] px-4 py-2 rounded-full
                  text-sm font-medium
                  ${isActive ? activeLinkClass : inactiveLinkClass}
                `.trim().replace(/\s+/g, ' ')}
              >
                <Inbox className="h-5 w-5 mr-2" />
                Boîte de réception
              </NavLink>
              {unreadCount > 0 && (
                 <span className="
                   absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center
                   rounded-full bg-primary text-onPrimary text-xs font-bold
                   animate-fade-in-scale elevation-2 badge-pulse
                 ">
                    {unreadCount}
                 </span>
              )}
            </div>
            <NavLink 
              to="/verify" 
              className={({ isActive }) => `
                flex items-center min-h-[44px] px-4 py-2 rounded-full
                text-sm font-medium
                ${isActive ? activeLinkClass : inactiveLinkClass}
              `.trim().replace(/\s+/g, ' ')}
            >
              <ShieldCheck className="h-5 w-5 mr-2" />
              Vérifier le document
            </NavLink>
            
          </nav>

          {/* Navigation Mobile/Tablette - REMOVED - now in burger menu */}
          <nav className="hidden">
          </nav>
          
          <div className="flex items-center gap-2">
             {/* Burger Menu - BEFORE Profile */}
            <div className="lg:hidden">
              <MobileMenu />
            </div>
             
            {/* Profile Button */}
            <Tooltip content={currentUser?.email || "Profil"} position="bottom">
              <button 
                className={`
                  min-h-[44px] min-w-[44px] w-10 h-10
                  ${profileColor || 'bg-primaryContainer'} text-white
                  rounded-full flex items-center justify-center
                  font-bold text-lg
                  state-layer state-layer-primary press-effect
                  elevation-0 hover:elevation-1 transition-all
                  hover:scale-110
                `}
                aria-label="Profil utilisateur"
              >
                {getInitials()}
              </button>
            </Tooltip>
            {/* Logout Button in Desktop Nav - ICON ONLY */}
            <Tooltip content="Déconnexion" position="bottom">
              <button 
                onClick={logout}
                className="
                  hidden lg:flex items-center justify-center min-h-[44px] min-w-[44px] p-2.5 rounded-full
                  text-sm font-medium
                  text-onSurfaceVariant state-layer state-layer-primary
                  hover:bg-secondaryContainer
                  transition-colors
                "
                aria-label="Déconnexion"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
