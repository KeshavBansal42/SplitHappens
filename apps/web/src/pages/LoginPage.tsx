import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";

export function LoginPage() {
  const { login, ready } = usePrivy();
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true);
    try {
      await login();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-glow glow-1" />
      <div className="login-bg-glow glow-2" />

      <div className="login-card">
        <div className="login-logo">S</div>
        <h1 className="login-title">splitHappens</h1>
        <p className="login-subtitle">
          Group payments, settled on-chain. No seed phrases.
        </p>

        <button
          className="login-btn login-btn-primary"
          onClick={() => void handleLogin()}
          disabled={!ready || busy}
        >
          <EmailIcon />
          {busy ? "Opening…" : "Continue with Email"}
        </button>

        <p className="login-footer">
          Your embedded wallet is created automatically. No seed phrase is
          ever shown to you.
        </p>
      </div>
    </div>
  );
}

function EmailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
