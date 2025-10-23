import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, FileText, Inbox, ShieldCheck } from 'lucide-react';
import { useUser } from './UserContext';

const MobileMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { logout } = useUser();

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
        className={`fixed left-0 top-16 h-[calc(100vh-64px)] w-full bg-[#fffbff] z-40 transform transition-all duration-300 ease-in-out flex flex-col overflow-y-auto ${
          isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'
        }`}
      >
        {/* Navigation Links - Match Desktop Header Styles */}
        <nav className="flex-1 flex flex-col gap-1 p-6">
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
        <div className="p-6 border-t border-outlineVariant/20">
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
