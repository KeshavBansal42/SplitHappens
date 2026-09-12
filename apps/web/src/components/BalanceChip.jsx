import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useUsdcBalance } from '../lib/useUsdcBalance.js';
import { showSnackbar } from '../lib/snackbar.js';

const FAUCET_URL = 'https://faucet.circle.com/';

export default function BalanceChip() {
  const { user } = useAuth();
  const { state, refresh } = useUsdcBalance(user?.wallet || null);
  const [copied, setCopied] = useState(false);

  const openFaucet = async () => {
    if (user?.wallet) {
      try {
        await navigator.clipboard.writeText(user.wallet);
        setCopied(true);
        showSnackbar('Address copied — paste it into the faucet');
        setTimeout(() => setCopied(false), 1500);
      } catch {
        showSnackbar('Copy your address from the sidebar, then paste it in the faucet');
      }
    }
    window.open(FAUCET_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="balance-chip">
      <BalanceValue state={state} />

      <button
        type="button"
        className="balance-chip-btn"
        onClick={refresh}
        title="Refresh balance"
        aria-label="Refresh balance"
      >
        <RefreshIcon />
      </button>

      <button
        type="button"
        className="balance-chip-btn"
        onClick={openFaucet}
        title={user?.wallet ? `Copy ${user.wallet} and open the faucet` : 'Open the faucet'}
        aria-label="Get testnet USDC"
      >
        {copied ? <CheckIcon /> : <FaucetIcon />}
      </button>
    </div>
  );
}

function BalanceValue({ state }) {
  if (state.status === 'loading') {
    return <span className="balance-chip-value is-muted">··· USDC</span>;
  }

  if (state.status === 'ok') {
    return <span className="balance-chip-value">{state.amount} USDC</span>;
  }

  if (state.status === 'error') {
    return (
      <span className="balance-chip-value is-muted" title={state.message}>
        — USDC
      </span>
    );
  }

  const label = state.reason === 'no-usdc-address' ? 'USDC not configured' : 'No wallet';
  return <span className="balance-chip-value is-muted">{label}</span>;
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
}

function FaucetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="15" />
      <polyline points="7 10 12 15 17 10" />
      <path d="M5 19h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
