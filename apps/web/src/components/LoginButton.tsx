import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

export function LoginButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const [busy, setBusy] = useState(false);

  if (!ready) return null;

  if (authenticated) {
    return (
      <button
        className="btn btn-ghost"
        onClick={async () => {
          setBusy(true);
          try {
            await logout();
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
      >
        {busy ? "Logging out…" : "Log out"}
      </button>
    );
  }

  return (
    <button className="btn btn-primary" onClick={() => void login()}>
      Log in
    </button>
  );
}
