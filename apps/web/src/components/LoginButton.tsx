import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

export function LoginButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const [busy, setBusy] = useState(false);

  if (!ready) return null;

  if (authenticated) {
    return (
      <button
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

  return <button onClick={() => login()}>Log in</button>;
}
