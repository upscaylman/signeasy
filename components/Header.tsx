
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FileSignature, LayoutDashboard, ShieldCheck, Inbox } from 'lucide-react';
import { getUnreadEmailCount } from '../services/firebaseApi';
import Tooltip from './Tooltip';

const Header: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

  const activeLinkClass = "bg-secondaryContainer text-onSecondaryContainer";
  const inactiveLinkClass = "text-onSurfaceVariant hover:bg-surfaceVariant";

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
    <header className="bg-surface border-b border-outlineVariant sticky top-0 z-40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="bg-primary p-2 rounded-lg flex items-center justify-center h-10 w-10">
              <span className="text-xl font-extrabold text-onPrimary">FO</span>
            </div>
            <span className="text-xl font-bold text-onSurface whitespace-nowrap hidden sm:inline">SignEase by FO Metaux</span>
            <span className="text-xl font-bold text-onSurface whitespace-nowrap sm:hidden">SignEase</span>
          </div>
          {/* Navigation Desktop - avec labels */}
          <nav className="hidden lg:flex items-center space-x-2">
            <NavLink 
              to="/dashboard" 
              className={({ isActive }) => `flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${isActive ? activeLinkClass : inactiveLinkClass}`}
            >
              <LayoutDashboard className="h-5 w-5 mr-2" />
              Tableau de bord
            </NavLink>
            <NavLink 
              to="/inbox" 
              className={({ isActive }) => `relative flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${isActive ? activeLinkClass : inactiveLinkClass}`}
            >
              <Inbox className="h-5 w-5 mr-2" />
              Boîte de réception
              {unreadCount > 0 && (
                 <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-onPrimary text-xs font-bold">
                    {unreadCount}
                 </span>
              )}
            </NavLink>
            <NavLink 
              to="/verify" 
              className={({ isActive }) => `flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${isActive ? activeLinkClass : inactiveLinkClass}`}
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
                className={({ isActive }) => `flex items-center justify-center p-2.5 rounded-full text-sm font-medium transition-colors ${isActive ? activeLinkClass : inactiveLinkClass}`}
                aria-label="Tableau de bord"
              >
                <LayoutDashboard className="h-5 w-5" />
              </NavLink>
            </Tooltip>
            <Tooltip content="Boîte de réception">
              <NavLink 
                to="/inbox" 
                className={({ isActive }) => `relative flex items-center justify-center p-2.5 rounded-full text-sm font-medium transition-colors ${isActive ? activeLinkClass : inactiveLinkClass}`}
                aria-label="Boîte de réception"
              >
                <Inbox className="h-5 w-5" />
                {unreadCount > 0 && (
                   <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-onPrimary text-xs font-bold">
                      {unreadCount}
                   </span>
                )}
              </NavLink>
            </Tooltip>
            <Tooltip content="Vérifier le document">
              <NavLink 
                to="/verify" 
                className={({ isActive }) => `flex items-center justify-center p-2.5 rounded-full text-sm font-medium transition-colors ${isActive ? activeLinkClass : inactiveLinkClass}`}
                aria-label="Vérifier le document"
              >
                <ShieldCheck className="h-5 w-5" />
              </NavLink>
            </Tooltip>
          </nav>
          <div className="flex items-center">
             {/* User profile would go here */}
            <Tooltip content="FO Métaux" position="bottom">
              <div className="w-10 h-10 bg-primaryContainer text-onPrimaryContainer rounded-full flex items-center justify-center font-bold text-lg cursor-pointer hover:opacity-80 transition-opacity">
                FM
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
