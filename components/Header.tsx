import {
  Inbox,
  LayoutDashboard,
  LogOut,
  PenTool,
  ShieldCheck,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  getUnreadEmailCount,
  subscribeToNotifications,
} from "../services/firebaseApi";
import MobileMenu from "./MobileMenu";
import NotificationDropdown from "./NotificationDropdown";
import Tooltip from "./Tooltip";
import { useUser } from "./UserContext";

const Header: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const { currentUser } = useUser();
  const { logout } = useUser();
  const [profileColor, setProfileColor] = useState<string>("");

  // Générer une couleur aléatoire au login (une fois par session)
  useEffect(() => {
    if (currentUser?.email) {
      // Vérifier si on a une couleur en localStorage pour cette email
      const storedColor = localStorage.getItem(
        `profileColor_${currentUser.email}`
      );

      if (storedColor) {
        setProfileColor(storedColor);
      } else {
        // Générer une nouvelle couleur aléatoire et la stocker
        const colors = [
          "bg-red-500",
          "bg-blue-500",
          "bg-green-500",
          "bg-purple-500",
          "bg-pink-500",
          "bg-indigo-500",
          "bg-cyan-500",
          "bg-orange-500",
          "bg-yellow-500",
          "bg-teal-500",
        ];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        setProfileColor(randomColor);
        localStorage.setItem(`profileColor_${currentUser.email}`, randomColor);
      }
    } else {
      // Déconnexion: nettoyer la couleur
      setProfileColor("");
      // Nettoyer aussi les localStorage des anciennes sessions
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("profileColor_")) {
          localStorage.removeItem(key);
        }
      });
    }
  }, [currentUser?.email]);

  // Extraire les 2 premières lettres de l'email
  const getInitials = () => {
    if (!currentUser?.email) return "U";
    const parts = currentUser.email.split("@")[0];
    return parts.substring(0, 2).toUpperCase();
  };

  const activeLinkClass =
    "bg-secondaryContainer text-onSecondaryContainer elevation-1";
  const inactiveLinkClass =
    "text-onSurfaceVariant state-layer state-layer-primary";

  const fetchUnreadCount = async () => {
    if (!currentUser?.email) return;

    try {
      const count = await getUnreadEmailCount(currentUser.email);
      if (count !== unreadCount) {
        // Mise à jour uniquement si le compteur change
        setUnreadCount(count);
        console.log("📧 Notifications non lues:", count);
      }
    } catch (error) {
      console.error("❌ Erreur récupération notifications:", error);
    }
  };

  useEffect(() => {
    if (!currentUser?.email) {
      setUnreadCount(0);
      return;
    }

    fetchUnreadCount();

    // 🔔 Listener en temps réel pour détecter les changements
    const unsubscribe = subscribeToNotifications(currentUser.email, () => {
      console.log("🔔 Badge notification - Rafraîchissement en temps réel");
      fetchUnreadCount();
    });

    // Listen for custom event when storage is updated
    window.addEventListener("storage_updated", fetchUnreadCount);
    
    // Écouter les événements de mise à jour de l'inbox
    const handleInboxUpdated = () => {
      fetchUnreadCount();
    };
    window.addEventListener("inboxUpdated", handleInboxUpdated);

    // 🔄 Polling de secours toutes les 10 secondes
    const interval = setInterval(fetchUnreadCount, 10000);

    return () => {
      unsubscribe();
      window.removeEventListener("storage_updated", fetchUnreadCount);
      window.removeEventListener("inboxUpdated", handleInboxUpdated);
      clearInterval(interval);
    };
  }, [currentUser?.email]);

  // Also refetch when navigating to the inbox, in case the event is missed
  useEffect(() => {
    if (location.pathname === "/inbox" || location.pathname === "/dashboard") {
      fetchUnreadCount();
    }
  }, [location.pathname]);

  return (
    <header className="glass-effect-strong border-b border-outlineVariant/50 sticky top-0 z-40 animate-slide-down backdrop-blur-xl">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          <Link
            to="/dashboard"
            className="flex items-center space-x-3 cursor-pointer transition-opacity hover:opacity-80"
          >
            <div className="bg-gradient-primary p-2 rounded-lg flex items-center justify-center h-10 w-10 elevation-2 progressive-glow transition-transform hover:scale-110">
              <PenTool className="h-6 w-6 text-onPrimary" />
            </div>
            {/* Desktop: SignEase by FO Metaux */}
            <span className="hidden sm:inline text-xl font-bold whitespace-nowrap">
              <span className="text-gradient-primary">SignEase</span>{" "}
              <span className="text-onSurface">by FO Metaux</span>
            </span>
            {/* Mobile: juste SignEase */}
            <span className="sm:hidden text-xl font-bold whitespace-nowrap">
              <span className="text-gradient-primary">SignEase</span>
            </span>
          </Link>
          {/* Navigation Desktop - avec labels */}
          <nav className="hidden lg:flex items-center space-x-2">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `
                flex items-center min-h-[44px] px-4 py-2 rounded-full
                text-sm font-medium
                ${isActive ? activeLinkClass : inactiveLinkClass}
              `
                  .trim()
                  .replace(/\s+/g, " ")
              }
            >
              <LayoutDashboard className="h-5 w-5 mr-2" />
              Tableau de bord
            </NavLink>
            <div className="relative">
              <NavLink
                to="/inbox"
                className={({ isActive }) =>
                  `
                  flex items-center min-h-[44px] px-4 py-2 rounded-full
                  text-sm font-medium
                  ${
                    isActive
                      ? "bg-secondaryContainer text-onSecondaryContainer elevation-1"
                      : "text-onSurfaceVariant state-layer state-layer-primary"
                  }
                `
                    .trim()
                    .replace(/\s+/g, " ")
                }
              >
                <Inbox className="h-5 w-5 mr-2" />
                Boîte de réception
              </NavLink>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-onPrimary text-xs font-bold animate-fade-in-scale elevation-2 badge-pulse">
                  {unreadCount}
                </span>
              )}
            </div>
            <NavLink
              to="/verify"
              className={({ isActive }) =>
                `
                flex items-center min-h-[44px] px-4 py-2 rounded-full
                text-sm font-medium
                ${isActive ? activeLinkClass : inactiveLinkClass}
              `
                  .trim()
                  .replace(/\s+/g, " ")
              }
            >
              <ShieldCheck className="h-5 w-5 mr-2" />
              Vérifier le document
            </NavLink>
          </nav>

          {/* Navigation Mobile/Tablette - REMOVED - now in burger menu */}
          <nav className="hidden"></nav>

          <div className="flex items-center gap-2">
            {/* Notification Dropdown - Toujours visible */}
            <NotificationDropdown />

            {/* Burger Menu - Mobile/Tablette uniquement */}
            <div className="lg:hidden">
              <MobileMenu />
            </div>

            {/* Profile Button */}
            <Tooltip content={`${currentUser?.email || "Profil"}${currentUser?.isAdmin ? " (Admin)" : ""}`} position="bottom">
              <div className={`relative rounded-full ${currentUser?.isAdmin ? "ring-3 ring-yellow-400 ring-offset-2 ring-offset-surface" : ""}`}>
                <button
                  className={`
                    min-h-[44px] min-w-[44px] w-10 h-10
                    ${profileColor || "bg-primaryContainer"} text-white
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
                {currentUser?.isAdmin && (
                  <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-900 text-[8px] font-bold px-1 py-0.5 rounded-full shadow-md">
                    ADMIN
                  </div>
                )}
              </div>
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
