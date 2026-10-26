import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../config/googleAuth';

const AuthContext = createContext(null);

const USERS_KEY = 'suvarna_users';
const SESSION_KEY = 'suvarna_auth_user';
let googleIdentityScriptPromise;

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();
const normalizePhone = (phone = '') => String(phone || '').replace(/\D/g, '');

const loadGoogleIdentity = () => {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (googleIdentityScriptPromise) return googleIdentityScriptPromise;

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) resolve(window.google);
      else reject(new Error('Google sign-in could not be initialized.'));
    };
    script.onerror = () => reject(new Error('Could not load Google sign-in. Check your internet connection and try again.'));
    document.head.appendChild(script);
  }).catch((error) => {
    googleIdentityScriptPromise = null;
    throw error;
  });

  return googleIdentityScriptPromise;
};

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
  const [googleReady, setGoogleReady] = useState(false);
  const [googleLoadError, setGoogleLoadError] = useState('');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let active = true;
    loadGoogleIdentity()
      .then(() => {
        if (active) {
          setGoogleReady(true);
          setGoogleLoadError('');
        }
      })
      .catch((error) => {
        if (active) {
          setGoogleReady(false);
          setGoogleLoadError(error.message || 'Could not load Google sign-in.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

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
      googleReady,
      googleLoadError,

      register: ({ name, email, phone, password }) => {
        const users = loadUsers();
        const cleanEmail = normalizeEmail(email);
        const cleanPhone = normalizePhone(phone);
        if (users.some((u) => normalizeEmail(u.email) === cleanEmail)) {
          return { ok: false, error: 'An account with this email already exists. Please login.' };
        }
        if (cleanPhone && users.some((u) => normalizePhone(u.phone) === cleanPhone)) {
          return { ok: false, error: 'An account with this mobile number already exists. Please login using that email or mobile number.' };
        }
        const newUser = {
          id: Date.now(),
          name: name.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          password, // NOTE: demo only — never store plain passwords in production
          provider: 'email',
          providers: ['email'],
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
        const id = normalizeEmail(identifier);
        const phone = normalizePhone(identifier);
        const found = users.find(
          (u) => normalizeEmail(u.email) === id || (!!phone && normalizePhone(u.phone) === phone)
        );
        if (!found) return { ok: false, error: 'No account found with this email / mobile.' };
        if (!found.password) {
          return { ok: false, error: 'This account uses Google sign-in. Please use Continue with Google.' };
        }
        if (found.password !== password) {
          return { ok: false, error: 'Incorrect password. Please try again.' };
        }
        const { password: _pw, ...safeUser } = found;
        persist(safeUser);
        return { ok: true };
      },

      setPasswordForCurrentUser: (password) => {
        if (!user?.email) {
          return { ok: false, error: 'Verify your account before setting a password.' };
        }
        if (password.length < 8) {
          return { ok: false, error: 'Password must be at least 8 characters.' };
        }

        const users = loadUsers();
        const cleanEmail = normalizeEmail(user.email);
        const index = users.findIndex((item) => normalizeEmail(item.email) === cleanEmail);
        if (index < 0) {
          return { ok: false, error: 'We could not find this account. Sign in with Google again and retry.' };
        }

        const account = users[index];
        const providers = [...new Set([
          ...(account.providers || (account.provider ? [account.provider] : [])),
          'email',
        ])];
        const updatedUser = { ...account, password, provider: 'email', providers };
        users[index] = updatedUser;
        saveUsers(users);

        const { password: _pw, ...safeUser } = updatedUser;
        persist(safeUser);
        return { ok: true };
      },

      loginWithGoogle: () => new Promise((resolve) => {
        loadGoogleIdentity()
          .then((google) => {
            const tokenClient = google.accounts.oauth2.initTokenClient({
              client_id: GOOGLE_CLIENT_ID,
              scope: 'openid email profile',
              callback: async (tokenResponse) => {
                if (tokenResponse.error || !tokenResponse.access_token) {
                  resolve({ ok: false, error: 'Google sign-in was not completed. Please try again.' });
                  return;
                }

                try {
                  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                  });
                  if (!response.ok) {
                    throw new Error('Google could not verify this account. Please try again.');
                  }

                  const profile = await response.json();
                  if (!profile.sub || !profile.email || !profile.email_verified) {
                    throw new Error('Google did not return a verified email address for this account.');
                  }

                  const cleanEmail = normalizeEmail(profile.email);
                  const users = loadUsers();
                  const existing = users.find((item) => normalizeEmail(item.email) === cleanEmail);
                  const providers = [...new Set([...(existing?.providers || (existing?.provider ? [existing.provider] : [])), 'google'])];
                  const googleUser = {
                    ...existing,
                    id: existing?.id || `google-${profile.sub}`,
                    name: existing?.name || profile.name || cleanEmail.split('@')[0],
                    email: cleanEmail,
                    phone: existing?.phone || '',
                    provider: existing?.password ? 'email' : 'google',
                    providers,
                    address: existing?.address || '',
                    city: existing?.city || '',
                    pin: existing?.pin || '',
                    joined: existing?.joined || new Date().toISOString().slice(0, 10),
                  };

                  if (existing) {
                    users[users.indexOf(existing)] = googleUser;
                  } else {
                    users.push(googleUser);
                  }
                  saveUsers(users);

                  const { password: _pw, ...safeUser } = googleUser;
                  persist(safeUser);
                  resolve({ ok: true, user: safeUser });
                } catch (error) {
                  resolve({
                    ok: false,
                    error: error.message || 'Could not sign in with Google. Please try again.',
                  });
                }
              },
              error_callback: (error) => {
                resolve({
                  ok: false,
                  error: error.type === 'popup_closed'
                    ? 'Google sign-in was cancelled.'
                    : 'The Google sign-in popup could not be opened. Allow popups and try again.',
                });
              },
            });

            tokenClient.requestAccessToken({ prompt: 'select_account' });
          })
          .catch((error) => {
            resolve({ ok: false, error: error.message || 'Could not load Google sign-in.' });
          });
      }),

      logout: () => setUser(null),

      updateProfile: (patch) => {
        if (!user) return { ok: false, error: 'Log in before updating your profile.' };
        const users = loadUsers();
        const idx = users.findIndex((u) => normalizeEmail(u.email) === normalizeEmail(user.email));
        const cleanPhone = normalizePhone(patch.phone);
        if (
          cleanPhone &&
          cleanPhone !== normalizePhone(user.phone) &&
          users.some((item, index) => index !== idx && normalizePhone(item.phone) === cleanPhone)
        ) {
          return { ok: false, error: 'This mobile number is already linked to another account.' };
        }
        const updatedUser = { ...user, ...patch };
        if (idx > -1) {
          users[idx] = { ...users[idx], ...patch };
          saveUsers(users);
        }
        persist(updatedUser);
        return { ok: true };
      },
    };
  }, [user, googleReady, googleLoadError]);

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
