import { PrivyProvider as PrivyProviderBase } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { arcTestnet } from "../lib/arc";
import { PRIVY_APP_ID } from "../lib/env";

export function PrivyProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    return (
      <div style={{ padding: "1rem", fontFamily: "sans-serif" }}>
        <strong>VITE_PRIVY_APP_ID is not set.</strong>
        <p>
          Copy <code>apps/web/.env.example</code> to{" "}
          <code>apps/web/.env</code> and add your Privy App ID, then restart
          the dev server.
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
        embeddedWallets: {
          createOnLogin: "all-users",
        },
        loginMethods: ["email"],
      }}
    >
      {children}
    </PrivyProviderBase>
  );
}
