import { useEmbeddedWallet } from "../privy/useEmbeddedWallet";
import { useUsdcBalance } from "../privy/useUsdcBalance";
import { LoginButton } from "./LoginButton";
import { FaucetPanel } from "./FaucetPanel";
import { shortAddress } from "../lib/format";

export function WalletCard() {
  const { ready, authenticated, address } = useEmbeddedWallet();
  const { state, refresh } = useUsdcBalance(authenticated ? address : null);

  if (!ready) return null;

  if (!authenticated) {
    return (
      <section className="card">
        <h2 style={{ marginBottom: "var(--sp-2)" }}>Wallet</h2>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          Log in with email to get your embedded wallet.
        </p>
        <LoginButton />
      </section>
    );
  }

  return (
    <section className="card">
      <h2 style={{ marginBottom: "var(--sp-2)" }}>Wallet</h2>
      <p style={{ marginBottom: "var(--sp-4)" }}>
        {address ? (
          <code title={address}>{shortAddress(address)}</code>
        ) : (
          "No embedded wallet yet."
        )}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <h3 style={{ fontSize: "var(--text-sm)" }}>USDC balance</h3>
        {state.status === "ok" && (
          <button className="btn btn-ghost" onClick={refresh}>
            Refresh
          </button>
        )}
      </div>
      {state.status === "loading" && <p>Checking balance…</p>}
      {state.status === "ok" && (
        <p className="stat-value">{state.amount} USDC</p>
      )}
      {state.status === "unavailable" &&
        state.reason === "no-usdc-address" && (
          <p>
            USDC address not configured. Set <code>VITE_USDC_ADDRESS</code> in{" "}
            <code>apps/web/.env</code>.
          </p>
        )}
      {state.status === "error" && (
        <p>
          {state.message}{" "}
          <button className="btn btn-ghost" onClick={refresh}>
            Retry
          </button>
        </p>
      )}

      {address && <FaucetPanel address={address} />}
    </section>
  );
}
