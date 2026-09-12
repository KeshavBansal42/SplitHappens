import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { PrivyProvider as PrivyProviderBase, usePrivy, useIdentityToken } from '@privy-io/react-auth';
import { configureAuth, IS_DEV_MODE } from './api.js';
import { DEV_EMAIL, DEV_USER_ID, DEV_WALLET, PRIVY_APP_ID } from './env.js';
import { arcTestnet } from './chain.js';

const AuthContext = createContext(null);

const DEV_USER = {
  userId: DEV_USER_ID,
  email: DEV_EMAIL || null,
  wallet: DEV_WALLET,
};

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

  const value = useMemo(
    () => ({
      ready: true,
      authenticated,
      isDev: true,
      user: authenticated ? DEV_USER : null,
      login: () => setAuthenticated(true),
      logout: () => setAuthenticated(false),
      sendTransaction: async () => {
        throw new Error('Transactions are disabled in dev mode');
      },
    }),
    [authenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function PrivyAuthBridge({ children }) {
  const { ready, authenticated, login, logout, user, getAccessToken, sendTransaction } = usePrivy();
  const { identityToken } = useIdentityToken();

  useEffect(() => {
    configureAuth({
      getAccessToken: () => getAccessToken(),
      getIdentityToken: () => identityToken,
    });
  }, [getAccessToken, identityToken]);

  const value = useMemo(() => {
    const email = user?.email?.address ?? null;
    const wallet = user?.wallet?.address ?? null;
    return {
      ready,
      authenticated,
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
  }, [ready, authenticated, login, logout, sendTransaction, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
