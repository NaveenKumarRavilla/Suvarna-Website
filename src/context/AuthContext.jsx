import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../config/googleAuth';
import { apiRequest } from '../utils/api';

const AuthContext = createContext(null);

const SESSION_KEY = 'suvarna_auth_user';
let googleIdentityScriptPromise;

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();
const loadGoogleIdentity = () => {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (googleIdentityScriptPromise) return googleIdentityScriptPromise;

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    const timeoutId = window.setTimeout(() => {
      script.remove();
      reject(new Error('Google sign-in took too long to load. Check your connection and try again.'));
    }, 20_000);
    script.onload = () => {
      window.clearTimeout(timeoutId);
      if (window.google?.accounts?.oauth2) resolve(window.google);
      else reject(new Error('Google sign-in could not be initialized.'));
    };
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error('Could not load Google sign-in. Check your internet connection and try again.'));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    googleIdentityScriptPromise = null;
    throw error;
  });

  return googleIdentityScriptPromise;
};

const loadSessionUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
};

const saveSessionUser = (user) => {
  try {
    if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error('Could not save the customer sign-in session.', error);
  }
};

export function AuthProvider({ children }) {
  const [googleReady, setGoogleReady] = useState(false);
  const [googleLoadError, setGoogleLoadError] = useState('');
  const [user, setUser] = useState(() => {
    return loadSessionUser();
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
    saveSessionUser(user);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    apiRequest('customer-session')
      .then((result) => {
        if (active) setUser(result.user);
      })
      .catch((error) => {
        if (active && [401, 403].includes(error.status)) setUser(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const result = await apiRequest('customer-session');
      if (!result?.user) throw new Error('The customer session response was invalid.');
      setUser(result.user);
      return { ok: true, user: result.user };
    } catch (error) {
      if ([401, 403].includes(error.status)) {
        setUser(null);
        apiRequest('customer-logout', { method: 'POST' }).catch(() => {});
      }
      return { ok: false, error: error.message, status: error.status };
    }
  }, []);

  const value = useMemo(() => {
    const persist = (u) => {
      setUser(u);
    };

    return {
      user,
      isLoggedIn: !!user,
      googleReady,
      googleLoadError,
      refreshSession,

      register: async ({ name, email, phone, password }) => {
        const cleanEmail = normalizeEmail(email);
        try {
          const result = await apiRequest('customer-register', {
            method: 'POST',
            body: { name: name.trim(), email: cleanEmail, phone: phone.trim(), password },
          });
          persist(result.user);
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error.message };
        }
      },

      login: async (identifier, password) => {
        try {
          const result = await apiRequest('customer-login', {
            method: 'POST',
            body: { identifier: identifier.trim(), password },
          });
          persist(result.user);
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error.message };
        }
      },

      setPasswordForCurrentUser: (password) => {
        if (!user?.email) {
          return { ok: false, error: 'Verify your account before setting a password.' };
        }
        if (password.length < 8) {
          return { ok: false, error: 'Password must be at least 8 characters.' };
        }

        return apiRequest('customer-set-password', {
          method: 'POST',
          body: { password, expectedEmail: normalizeEmail(user.email) },
        })
          .then(() => {
            const providers = [...new Set([...(user.providers || (user.provider ? [user.provider] : [])), 'email'])];
            persist({ ...user, provider: 'email', providers });
            return { ok: true };
          })
          .catch(async (error) => {
            if (error.status === 409) {
              setUser(null);
              await refreshSession();
            }
            return { ok: false, error: error.message, status: error.status };
          });
      },

      setPasswordForRecovery: async (recoveryToken, password) => {
        if (!recoveryToken) {
          return { ok: false, error: 'Verify the account with Google before setting a password.' };
        }
        if (password.length < 8) {
          return { ok: false, error: 'Password must be at least 8 characters.' };
        }
        try {
          await apiRequest('customer-set-password', {
            method: 'POST',
            body: { flow: 'recovery', recoveryToken, password },
          });
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error.message, status: error.status };
        }
      },

      validatePasswordRecovery: async (recoveryToken) => {
        if (!recoveryToken) return { ok: false, error: 'This password reset link is invalid or has expired. Request a new link.' };
        try {
          await apiRequest('customer-password-recovery-validate', {
            method: 'POST',
            body: { recoveryToken },
          });
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error.message, status: error.status };
        }
      },

      requestPasswordRecovery: async (email) => {
        try {
          await apiRequest('customer-password-recovery-request', {
            method: 'POST',
            body: { email: normalizeEmail(email) },
          });
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error.message, status: error.status };
        }
      },

      loginWithGoogle: (options = {}) => new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          resolve(result);
        };
        const timeoutId = window.setTimeout(() => {
          finish({
            ok: false,
            error: 'Google sign-in timed out. Check pop-up settings and try again.',
          });
        }, 60_000);
        loadGoogleIdentity()
          .then((google) => {
            const tokenClient = google.accounts.oauth2.initTokenClient({
              client_id: GOOGLE_CLIENT_ID,
              scope: 'openid email profile',
              callback: async (tokenResponse) => {
                if (tokenResponse.error || !tokenResponse.access_token) {
                  finish({ ok: false, error: 'Google sign-in was not completed. Please try again.' });
                  return;
                }

                try {
                  const result = await apiRequest('customer-google', {
                    method: 'POST',
                    body: {
                      accessToken: tokenResponse.access_token,
                      ...(options.purpose ? { purpose: options.purpose } : {}),
                    },
                  });
                  if (settled) return;
                  if (options.purpose === 'password-recovery') {
                    if (!result.recoveryToken || !result.email) {
                      throw new Error('The password recovery response was invalid.');
                    }
                    finish({
                      ok: true,
                      recoveryToken: result.recoveryToken,
                      email: result.email,
                      expiresIn: result.expiresIn,
                    });
                    return;
                  }
                  persist(result.user);
                  finish({ ok: true, user: result.user });
                } catch (error) {
                  finish({
                    ok: false,
                    error: error.message || 'Could not sign in with Google. Please try again.',
                  });
                }
              },
              error_callback: (error) => {
                finish({
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
            finish({ ok: false, error: error.message || 'Could not load Google sign-in.' });
          });
      }),

      logout: () => {
        setUser(null);
        apiRequest('customer-logout', { method: 'POST' }).catch((error) => {
          console.error('Could not close the customer server session.', error);
        });
      },

      updateProfile: async (patch) => {
        if (!user) return { ok: false, error: 'Log in before updating your profile.' };
        try {
          const result = await apiRequest('customer-profile', {
            method: 'POST',
            body: { ...patch, expectedEmail: normalizeEmail(user.email) },
          });
          persist(result.user);
          return { ok: true };
        } catch (error) {
          if (error.status === 409) {
            setUser(null);
            await refreshSession();
          }
          return { ok: false, error: error.message, status: error.status };
        }
      },

      upsertAddress: async (address, expectedVersion) => {
        if (!user?.email) return { ok: false, error: 'Log in before saving an address.' };
        const body = { expectedEmail: normalizeEmail(user.email), address };
        if (expectedVersion !== undefined) body.expectedVersion = expectedVersion;
        try {
          const result = await apiRequest('customer-address-upsert', { method: 'POST', body });
          let updatedUser = result.user;
          if (updatedUser) persist(updatedUser);
          else {
            const refreshed = await refreshSession();
            if (!refreshed.ok) {
              return { ok: false, error: refreshed.error, status: refreshed.status };
            }
            updatedUser = refreshed.user;
          }
          return {
            ok: true,
            address: result.address,
            addresses: updatedUser?.addresses,
          };
        } catch (error) {
          if (error.status === 409) {
            setUser(null);
            await refreshSession();
          }
          return { ok: false, error: error.message, status: error.status };
        }
      },

      deleteAddress: async (id, expectedVersion) => {
        if (!user?.email) return { ok: false, error: 'Log in before deleting an address.' };
        const body = { expectedEmail: normalizeEmail(user.email), id };
        if (expectedVersion !== undefined) body.expectedVersion = expectedVersion;
        try {
          const result = await apiRequest('customer-address-delete', { method: 'POST', body });
          if (result.user) persist(result.user);
          else {
            const refreshed = await refreshSession();
            if (!refreshed.ok) {
              return { ok: false, error: refreshed.error, status: refreshed.status };
            }
          }
          return { ok: true };
        } catch (error) {
          if (error.status === 409) {
            setUser(null);
            await refreshSession();
          }
          return { ok: false, error: error.message, status: error.status };
        }
      },
    };
  }, [user, googleReady, googleLoadError, refreshSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
