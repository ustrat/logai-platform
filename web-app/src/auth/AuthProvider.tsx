import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { type User } from 'oidc-client-ts';
import { userManager } from './oidcConfig';
import { useAuthStore } from '../store/authStore';

interface AuthContextValue {
  user:       User | null;
  isLoading:  boolean;
  isAuthenticated: boolean;
  signIn:     () => Promise<void>;
  signOut:    () => Promise<void>;
  getToken:   () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]         = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const { setAuth, logout: storeLogout } = useAuthStore();

  const syncUser = useCallback((oidcUser: User | null) => {
    setUser(oidcUser);
    if (oidcUser && !oidcUser.expired) {
      const profile = oidcUser.profile;
      setAuth(
        {
          id:    profile.sub,
          email: profile.email ?? '',
          name:  (profile.name ?? profile.email) as string,
          role:  (profile['custom:role'] as string) ?? 'analyst',
        },
        // Send the ID token as Bearer — it carries plan/entitlements claims
        oidcUser.id_token ?? oidcUser.access_token,
        '',  // refresh handled by oidc-client-ts, not our store
      );
    } else {
      storeLogout();
    }
  }, [setAuth, storeLogout]);

  useEffect(() => {
    // Load any existing session from sessionStorage
    userManager.getUser().then(u => {
      syncUser(u);
      setLoading(false);
    }).catch(() => setLoading(false));

    // Keep store in sync when oidc-client-ts loads/unloads/renews user
    userManager.events.addUserLoaded(syncUser);
    userManager.events.addUserUnloaded(() => syncUser(null));
    userManager.events.addAccessTokenExpired(() => {
      // Silent renewal fires automatically; this is the fallback
      userManager.signinSilent().then(syncUser).catch(() => syncUser(null));
    });
    userManager.events.addSilentRenewError(() => {
      // Silent renewal failed (refresh token expired) — redirect to login
      syncUser(null);
    });

    return () => {
      userManager.events.removeUserLoaded(syncUser);
    };
  }, [syncUser]);

  const signIn  = useCallback(() => userManager.signinRedirect(), []);
  const signOut = useCallback(async () => {
    storeLogout();
    await userManager.signoutRedirect();
  }, [storeLogout]);

  const getToken = useCallback(() =>
    user ? (user.id_token ?? user.access_token) : null
  , [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user && !user.expired, signIn, signOut, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
