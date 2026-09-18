import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

const USERS_KEY = 'suvarna_users';
const SESSION_KEY = 'suvarna_auth_user';

const loadUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
};

const saveUsers = (users) => {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    /* storage unavailable */
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage unavailable */
    }
  }, [user]);

  const value = useMemo(() => {
    const persist = (u) => {
      setUser(u);
    };

    return {
      user,
      isLoggedIn: !!user,

      register: ({ name, email, phone, password }) => {
        const users = loadUsers();
        const cleanEmail = email.trim().toLowerCase();
        if (users.some((u) => u.email === cleanEmail)) {
          return { ok: false, error: 'An account with this email already exists. Please login.' };
        }
        const newUser = {
          id: Date.now(),
          name: name.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          password, // NOTE: demo only — never store plain passwords in production
          provider: 'email',
          address: '',
          city: '',
          pin: '',
          joined: new Date().toISOString().slice(0, 10),
        };
        users.push(newUser);
        saveUsers(users);
        const { password: _pw, ...safeUser } = newUser;
        persist(safeUser);
        return { ok: true };
      },

      login: (identifier, password) => {
        const users = loadUsers();
        const id = identifier.trim().toLowerCase();
        const found = users.find(
          (u) => u.email === id || u.phone.replace(/\s/g, '') === identifier.replace(/\s/g, '')
        );
        if (!found) return { ok: false, error: 'No account found with this email / mobile.' };
        if (found.provider === 'google') {
          return { ok: false, error: 'This account uses Google sign-in. Please use Continue with Google.' };
        }
        if (found.password !== password) {
          return { ok: false, error: 'Incorrect password. Please try again.' };
        }
        const { password: _pw, ...safeUser } = found;
        persist(safeUser);
        return { ok: true };
      },

      loginWithGoogle: () => {
        // Demo Google sign-in (no real OAuth). Replace with real provider later.
        const users = loadUsers();
        const gUser = {
          id: 'g' + Date.now(),
          name: 'Google User',
          email: 'user.google@gmail.com',
          phone: '',
          provider: 'google',
          address: '',
          city: '',
          pin: '',
          joined: new Date().toISOString().slice(0, 10),
        };
        let finalUser = users.find((u) => u.email === gUser.email);
        if (!finalUser) {
          users.push(gUser);
          saveUsers(users);
          finalUser = gUser;
        }
        const { password: _pw, ...safeUser } = finalUser;
        persist(safeUser);
        return { ok: true };
      },

      logout: () => setUser(null),

      updateProfile: (patch) => {
        if (!user) return;
        const users = loadUsers();
        const idx = users.findIndex((u) => u.email === user.email);
        if (idx > -1) {
          users[idx] = { ...users[idx], ...patch };
          saveUsers(users);
        }
        persist({ ...user, ...patch });
      },
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Helper for admin panel: read all registered users (without passwords)
export function getRegisteredCustomers() {
  return loadUsers().map(({ password: _pw, ...u }) => u);
}
