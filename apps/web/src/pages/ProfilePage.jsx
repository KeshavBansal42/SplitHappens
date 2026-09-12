import { useEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import { useAuth } from '../lib/auth.jsx';

export default function ProfilePage() {
  const pageRef = useRef(null);
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

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
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Your account and wallet</p>
      </div>

      <div className="card profile-header-card">
        <div className="profile-avatar">{avatar}</div>
        <div className="profile-identity">
          <div className="profile-name">{displayName}</div>
          <div className="profile-email">{email || 'No email on file'}</div>
        </div>
      </div>

      <div className="card">
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

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
