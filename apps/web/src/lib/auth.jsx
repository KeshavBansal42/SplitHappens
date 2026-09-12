import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PrivyProvider as PrivyProviderBase, usePrivy } from '@privy-io/react-auth';
import { configureAuth, IS_DEV_MODE, setUnauthorizedHandler } from './api.js';
import { showSnackbar } from './snackbar.js';
import { DEV_EMAIL, DEV_USER_ID, DEV_WALLET, PRIVY_APP_ID } from './env.js';
import { arcTestnet } from './chain.js';

const AuthContext = createContext(null);

const DEV_USER = {
  userId: DEV_USER_ID,
  email: DEV_EMAIL || null,
  wallet: DEV_WALLET,
};

// An expired or rejected session shouldn't strand the user on a broken page:
// drop them at the login screen and say why.
function useExpireSession(logout) {
  useEffect(() => {
    setUnauthorizedHandler(() => {
      showSnackbar('Your session expired. Please log in again.');
      logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);
}

export function AuthProvider({ children }) {
  if (IS_DEV_MODE) {
    return <DevAuthProvider>{children}</DevAuthProvider>;
  }

  if (!PRIVY_APP_ID) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
        <strong>VITE_PRIVY_APP_ID is not set.</strong>
        <p>
          Copy <code>apps/web/.env.example</code> to <code>apps/web/.env</code>,
          add your Privy App ID, then restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <PrivyProviderBase
      appId={PRIVY_APP_ID}
      config={{
        supportedChains: [arcTestnet],
        defaultChain: arcTestnet,
        embeddedWallets: { createOnLogin: 'all-users' },
        loginMethods: ['email'],
      }}
    >
      <PrivyAuthBridge>{children}</PrivyAuthBridge>
    </PrivyProviderBase>
  );
}

function DevAuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(true);
  const login = useCallback(() => setAuthenticated(true), []);
  const logout = useCallback(() => setAuthenticated(false), []);

  useExpireSession(logout);

  const value = useMemo(
    () => ({
      ready: true,
      authenticated,
      tokenReady: true,
      isDev: true,
      user: authenticated ? DEV_USER : null,
      login,
      logout,
      sendTransaction: async () => {
        throw new Error('Transactions are disabled in dev mode');
      },
    }),
    [authenticated, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function PrivyAuthBridge({ children }) {
  const { ready, authenticated, login, logout, user, getAccessToken, sendTransaction } = usePrivy();
  const [tokenReady, setTokenReady] = useState(false);

  // Set during render, not in an effect: child effects run before parent
  // effects, so a page fetching on mount would otherwise fire with no token.
  configureAuth({
    getAccessToken: () => getAccessToken(),
  });

  useExpireSession(logout);

  // Privy flips `authenticated` before the access token is minted. Hold the
  // app back until it exists, otherwise the first calls 401 and we log out.
  useEffect(() => {
    if (!authenticated) {
      setTokenReady(false);
      return undefined;
    }

    let cancelled = false;
    let timer;
    let attempts = 0;

    const check = async () => {
      const token = await getAccessToken().catch(() => null);
      if (cancelled) return;
      if (token) {
        setTokenReady(true);
        return;
      }
      // Give up after ~10s so a dead session can't hang the app forever;
      // the API layer then surfaces the failure without force-logging-out.
      attempts += 1;
      if (attempts >= 40) {
        setTokenReady(true);
        return;
      }
      timer = setTimeout(check, 250);
    };

    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authenticated, getAccessToken]);

  const value = useMemo(() => {
    const email = user?.email?.address ?? null;
    const wallet = user?.wallet?.address ?? null;
    return {
      ready,
      authenticated,
      tokenReady: authenticated ? tokenReady : false,
      isDev: false,
      login,
      logout,
      sendTransaction,
      user: {
        userId: user?.id ?? null,
        email,
        wallet,
      },
    };
  }, [ready, authenticated, tokenReady, login, logout, sendTransaction, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
