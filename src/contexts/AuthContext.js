import React, { createContext, useContext } from 'react';
import { useDataContext } from './DataContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { api, loading } = useDataContext();
  const user = { id: 1, nume: 'Planner', prenume: '', rol: 'planificator' };
  
  return (
    <AuthContext.Provider value={{ user, api, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
