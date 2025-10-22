import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  email: string;
}

interface UserContextType {
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  setCurrentUserSilent: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | null>(null);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Charger l'email depuis localStorage au démarrage
  useEffect(() => {
    const storedEmail = localStorage.getItem('currentUserEmail');
    if (storedEmail) {
      setCurrentUserState({ email: storedEmail });
    }
    setIsLoading(false);
  }, []);

  // Sauvegarder l'email dans localStorage quand il change (pour login normal)
  const handleSetCurrentUser = (user: User) => {
    setCurrentUserState(user);
    localStorage.setItem('currentUserEmail', user.email);
  };

  // Auto-login sans localStorage (pour signataires via token)
  const handleSetCurrentUserSilent = (user: User) => {
    setCurrentUserState(user);
    // NE PAS sauvegarder dans localStorage - session temporaire
  };

  const logout = () => {
    setCurrentUserState(null);
    localStorage.removeItem('currentUserEmail');
  };

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser: handleSetCurrentUser, setCurrentUserSilent: handleSetCurrentUserSilent, logout, isLoading }}>
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
