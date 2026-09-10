import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useIdentityToken, usePrivy } from "@privy-io/react-auth";
import { createApiClient, type ApiClient } from "./client";

type ApiContextValue = {
  api: ApiClient | null;
  ready: boolean;
  authenticated: boolean;
};

const ApiContext = createContext<ApiContextValue>({
  api: null,
  ready: false,
  authenticated: false,
});

const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID as string | undefined;
const DEV_WALLET = import.meta.env.VITE_DEV_WALLET as string | undefined;

export function ApiProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, getAccessToken, user } = usePrivy();
  const { identityToken } = useIdentityToken();
  const { linkedAccounts, wallet } = user ?? {};

  const value = useMemo<ApiContextValue>(() => {
    if (!ready) return { api: null, ready, authenticated };

    if (DEV_USER_ID && DEV_WALLET) {
      return {
        api: createApiClient({
          mode: "dev",
          userId: DEV_USER_ID,
          wallet: DEV_WALLET,
        }),
        ready,
        authenticated,
      };
    }

    if (!authenticated) return { api: null, ready, authenticated };

    const address =
      (wallet?.address as string | undefined) ??
      (linkedAccounts ?? []).find(
        (a): a is Extract<typeof a, { address: string }> =>
          a.type === "wallet" && a.walletClientType === "privy",
      )?.address;

    if (!address) {
      return { api: null, ready, authenticated };
    }

    return {
      api: createApiClient({
        mode: "privy",
        getAccessToken: () => getAccessToken(),
        getIdentityToken: () => identityToken,
      }),
      ready,
      authenticated,
    };
  }, [ready, authenticated, getAccessToken, identityToken, wallet, linkedAccounts]);

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiContextValue {
  return useContext(ApiContext);
}
