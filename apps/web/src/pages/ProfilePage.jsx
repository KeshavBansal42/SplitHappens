import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { animate, stagger } from 'animejs';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../lib/auth.jsx';
import { useUsdcBalance } from '../lib/useUsdcBalance.js';

export default function ProfilePage() {
  const pageRef = useRef(null);
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const { state: balance, refresh } = useUsdcBalance(user?.wallet || null);

  const wallet = user?.wallet || null;
  const email = user?.email || null;
  const displayName = email?.split('@')[0] || user?.userId || 'Guest';
  const avatar = displayName.slice(0, 2).toUpperCase();
  const shortAddress = wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : 'Not connected';

  useEffect(() => {
    animate('.page > *', {
      opacity: [0, 1],
      y: [12, 0],
      duration: 500,
      delay: stagger(60),
      ease: 'outExpo',
    });
  }, []);

  const copyWallet = async () => {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="page" ref={pageRef}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
          <Link
            to="/"
            className="btn btn-ghost btn-icon"
            style={{ marginLeft: '-0.5rem' }}
            aria-label="Back to dashboard"
          >
            <ArrowLeftIcon />
          </Link>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Profile</h1>
        </div>
        <p className="page-subtitle">Your account and wallet</p>
      </div>

      <div className="card profile-header-card">
        <div className="profile-avatar">{avatar}</div>
        <div className="profile-identity">
          <div className="profile-name">{displayName}</div>
          <div className="profile-email">{email || 'No email on file'}</div>
        </div>
      </div>

      <div className="card profile-details-card">
        <div className="profile-fields">
          <div className="profile-field">
            <span className="profile-field-label">Email</span>
            <span className="profile-field-value">{email || 'No email on file'}</span>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">Wallet Address</span>
            <div className="profile-field-value">
              <span className="profile-wallet">{shortAddress}</span>
              <button
                type="button"
                className="wallet-copy"
                onClick={copyWallet}
                disabled={!wallet}
                title={wallet ? `Copy ${wallet}` : 'No wallet connected'}
                aria-label="Copy wallet address"
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied && <span className="profile-copied">Copied!</span>}
              </button>
            </div>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">USDC Balance</span>
            <div className="profile-field-value">
              {balance.status === 'loading' && (
                <span className="profile-wallet">Checking…</span>
              )}
              {balance.status === 'ok' && (
                <span className="profile-balance">{balance.amount} USDC</span>
              )}
              {balance.status === 'unavailable' &&
                balance.reason === 'no-usdc-address' && (
                  <span className="profile-wallet">USDC address not configured</span>
                )}
              {balance.status === 'unavailable' &&
                balance.reason === 'not-connected' && (
                  <span className="profile-wallet">No wallet connected</span>
                )}
              {balance.status === 'error' && (
                <span className="profile-wallet">{balance.message}</span>
              )}
              {wallet && balance.status !== 'unavailable' && (
                <button
                  type="button"
                  className="wallet-copy"
                  onClick={refresh}
                  title="Refresh balance"
                >
                  <RefreshIcon />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="profile-qr">
          {wallet ? (
            <div
              className="profile-qr-tile"
              role="img"
              aria-label={`QR code for wallet address ${wallet}`}
            >
              <QRCodeSVG
                value={wallet}
                size={132}
                level="M"
                marginSize={2}
                bgColor="#FFFFFF"
                fgColor="#0A0A0A"
              />
            </div>
          ) : (
            <span className="profile-qr-empty">No wallet connected</span>
          )}
        </div>
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
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

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}
