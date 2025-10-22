
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FileSignature, LayoutDashboard, ShieldCheck, Inbox } from 'lucide-react';
import { getUnreadEmailCount } from '../services/firebaseApi';
import Tooltip from './Tooltip';

const Header: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

  const activeLinkClass = "bg-secondaryContainer text-onSecondaryContainer elevation-1";
  const inactiveLinkClass = "text-onSurfaceVariant state-layer state-layer-primary";

  const fetchUnreadCount = async () => {
    try {
      const count = await getUnreadEmailCount();
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
                <span className="text-xl font-bold whitespace-nowrap hidden sm:inline"><span className="text-gradient-primary">SignEase</span> <span className="text-onSurface">by FO Metaux</span></span>
                <span className="text-xl font-bold text-gradient-primary whitespace-nowrap sm:hidden">SignEase</span>
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
            <NavLink 
              to="/inbox" 
              className={({ isActive }) => `
                relative flex items-center min-h-[44px] px-4 py-2 rounded-full
                text-sm font-medium
                ${isActive ? activeLinkClass : inactiveLinkClass}
              `.trim().replace(/\s+/g, ' ')}
            >
              <Inbox className="h-5 w-5 mr-2" />
              Boîte de réception
              {unreadCount > 0 && (
                 <span className="
                   absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center
                   rounded-full bg-primary text-onPrimary text-xs font-bold
                   animate-fade-in-scale elevation-2 badge-pulse
                 ">
                    {unreadCount}
                 </span>
              )}
            </NavLink>
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

          {/* Navigation Mobile/Tablette - icônes uniquement avec tooltips */}
          <nav className="flex lg:hidden items-center space-x-2">
            <Tooltip content="Tableau de bord">
              <NavLink 
                to="/dashboard" 
                className={({ isActive }) => `
                  flex items-center justify-center min-h-[44px] min-w-[44px] p-2.5 rounded-full
                  text-sm font-medium
                  ${isActive ? activeLinkClass : inactiveLinkClass}
                `.trim().replace(/\s+/g, ' ')}
                aria-label="Tableau de bord"
              >
                <LayoutDashboard className="h-5 w-5" />
              </NavLink>
            </Tooltip>
            <Tooltip content="Boîte de réception">
              <NavLink 
                to="/inbox" 
                className={({ isActive }) => `
                  relative flex items-center justify-center min-h-[44px] min-w-[44px] p-2.5 rounded-full
                  text-sm font-medium
                  ${isActive ? activeLinkClass : inactiveLinkClass}
                `.trim().replace(/\s+/g, ' ')}
                aria-label="Boîte de réception"
              >
                <Inbox className="h-5 w-5" />
                {unreadCount > 0 && (
                   <span className="
                     absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center
                     rounded-full bg-primary text-onPrimary text-xs font-bold
                     animate-fade-in-scale elevation-2 badge-pulse
                   ">
                      {unreadCount}
                   </span>
                )}
              </NavLink>
            </Tooltip>
            <Tooltip content="Vérifier le document">
              <NavLink 
                to="/verify" 
                className={({ isActive }) => `
                  flex items-center justify-center min-h-[44px] min-w-[44px] p-2.5 rounded-full
                  text-sm font-medium
                  ${isActive ? activeLinkClass : inactiveLinkClass}
                `.trim().replace(/\s+/g, ' ')}
                aria-label="Vérifier le document"
              >
                <ShieldCheck className="h-5 w-5" />
              </NavLink>
            </Tooltip>
          </nav>
          <div className="flex items-center">
             {/* User profile would go here */}
            <Tooltip content="FO Métaux" position="bottom">
              <button 
                className="
                  min-h-[44px] min-w-[44px] w-10 h-10
                  bg-primaryContainer text-onPrimaryContainer
                  rounded-full flex items-center justify-center
                  font-bold text-lg
                  state-layer state-layer-primary press-effect
                  elevation-0 hover:elevation-1 transition-all
                  hover:scale-110
                "
                aria-label="Profil utilisateur"
              >
                FM
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
