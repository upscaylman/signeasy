import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isAdmin as checkIsAdmin } from '../services/firebaseApi';

interface User {
  email: string;
  isAdmin?: boolean;
}

interface UserContextType {
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  setCurrentUserSilent: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Charger l'email depuis localStorage au démarrage
  useEffect(() => {
    const storedEmail = localStorage.getItem('currentUserEmail');
    if (storedEmail) {
      setCurrentUserState({ 
        email: storedEmail,
        isAdmin: checkIsAdmin(storedEmail)
      });
    }
    setIsLoading(false);
  }, []);

  // Sauvegarder l'email dans localStorage quand il change (pour login normal)
  const handleSetCurrentUser = (user: User) => {
    const userWithAdmin = {
      ...user,
      isAdmin: checkIsAdmin(user.email)
    };
    setCurrentUserState(userWithAdmin);
    localStorage.setItem('currentUserEmail', user.email);
  };

  // Auto-login sans localStorage (pour signataires via token)
  const handleSetCurrentUserSilent = (user: User) => {
    const userWithAdmin = {
      ...user,
      isAdmin: checkIsAdmin(user.email)
    };
    setCurrentUserState(userWithAdmin);
    // NE PAS sauvegarder dans localStorage - session temporaire
  };

  const logout = () => {
    setCurrentUserState(null);
    localStorage.removeItem('currentUserEmail');
  };

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser: handleSetCurrentUser, setCurrentUserSilent: handleSetCurrentUserSilent, logout, isLoading, refreshTrigger, triggerRefresh }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
