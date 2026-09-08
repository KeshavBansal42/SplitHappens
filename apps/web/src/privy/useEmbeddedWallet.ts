import { usePrivy } from "@privy-io/react-auth";

export function useEmbeddedWallet() {
  const { user, ready, authenticated, login, logout } = usePrivy();

  const wallet = user?.wallet ?? null;

  return {
    ready,
    authenticated,
    login,
    logout,
    address: (wallet?.address as string | undefined) ?? null,
    hasWallet: Boolean(wallet),
  };
}
