import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const DEFAULT_USER = {
  userId: 'testUser1',
  email: 'testuser1@example.com',
  wallet: '0x71C3A10A2b1b32d32A1f2C0123456789aBcDeF01',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('dev-user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback((userData) => {
    const u = userData || DEFAULT_USER;
    localStorage.setItem('dev-user', JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('dev-user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}