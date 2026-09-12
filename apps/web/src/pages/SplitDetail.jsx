import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { stagger, createTimeline } from 'animejs';
import { encodeFunctionData } from 'viem';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { adaptStatus } from '../lib/transform.js';
import { openSplitOnChain } from '../lib/openSplit.js';
import {
  CHAIN_ID,
  amountToUnits,
  escrowAbi,
  usdcAbi,
} from '../lib/chain.js';
import { ESCROW_ADDRESS, USDC_ADDRESS } from '../lib/env.js';

const DEV_TX_HASH = '0x' + '00'.repeat(32);
const POLL_MS = 5000;

const statusLabels = {
  pending: 'Pending',
  partially_paid: 'Active',
  released: 'Released',
};

const statusClass = {
  pending: 'badge-pending',
  partially_paid: 'badge-partial',
  released: 'badge-released',
};

export default function SplitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const { user, isDev, sendTransaction } = useAuth();
  const [split, setSplit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadSplit = useCallback(async () => {
    try {
      const data = await api.getSplitStatus(id);
      setSplit(adaptStatus(data, user));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    loadSplit();
  }, [loadSplit]);

  useEffect(() => {
    if (loading || !split) return;
    const tl = createTimeline({ easing: 'easeOutExpo' });

    tl.add('.detail-amount-display', {
      opacity: [0, 1],
      scale: [0.95, 1],
      duration: 600,
    }).add('.detail-info-item', {
      opacity: [0, 1],
      y: [8, 0],
      duration: 400,
      delay: stagger(50),
    }, '-=300').add('.participant-row', {
      opacity: [0, 1],
      x: [-8, 0],
      duration: 400,
      delay: stagger(60),
    }, '-=200').add('.pay-cta', {
      opacity: [0, 1],
      y: [12, 0],
      duration: 500,
    }, '-=300');
  }, [loading]);

  useEffect(() => {
    if (!split) return;
    const t = setInterval(() => void loadSplit(), POLL_MS);
    return () => clearInterval(t);
  }, [split, loadSplit]);

  const signTx = async (to, data) => {
    const receipt = await sendTransaction({ to, data, chainId: CHAIN_ID });
    return receipt.transactionHash;
  };

  const openOnChain = async (target) => {
    await openSplitOnChain(
      {
        id: target.id,
        payeeAddress: target.payeeAddress,
        totalAmount: target.totalAmountRaw,
      },
      { isDev, sendTransaction },
    );
  };

  const handleFinishSetup = async () => {
    if (!split || busy) return;
    setBusy(true);
    setError(null);
    try {
      await openOnChain(split);
      await loadSplit();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancelSplit = async () => {
    if (!split || busy) return;
    if (!window.confirm('Cancel this split? Nothing is on-chain yet, so it will just be deleted.')) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.cancelSplit(split.id);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!split || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.joinSplit(split.id);
      await loadSplit();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePay = async () => {
    if (!split || !split.me || paying) return;
    setPaying(true);
    setError(null);
    try {
      const amount = split.me.shareAmountRaw;

      if (isDev) {
        await api.paySplit(split.id, { txHash: DEV_TX_HASH, amount });
      } else {
        if (!USDC_ADDRESS) throw new Error('USDC address is not configured');
        const units = amountToUnits(amount);
        const approveData = encodeFunctionData({
          abi: usdcAbi,
          functionName: 'approve',
          args: [ESCROW_ADDRESS, units],
        });
        await signTx(USDC_ADDRESS, approveData);

        const depositData = encodeFunctionData({
          abi: escrowAbi,
          functionName: 'deposit',
          args: [BigInt(split.id), units],
        });
        const txHash = await signTx(ESCROW_ADDRESS, depositData);
        await api.paySplit(split.id, { txHash, amount });
      }
      await loadSplit();
    } catch (err) {
      setError(err.message);
    } finally {
      setPaying(false);
    }
  };

  const handleRelease = async () => {
    if (!split || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (isDev) throw new Error('Releasing needs a connected wallet');
      const data = encodeFunctionData({
        abi: escrowAbi,
        functionName: 'release',
        args: [BigInt(split.id)],
      });
      await signTx(ESCROW_ADDRESS, data);
      await loadSplit();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="page" ref={pageRef}>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <Link to="/" className="btn btn-ghost btn-icon" style={{ marginLeft: '-0.5rem' }}>
              <ArrowLeftIcon />
            </Link>
            <h1 className="page-title" style={{ marginBottom: 0 }}>Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (error && !split) {
    return (
      <div className="page" ref={pageRef}>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <Link to="/" className="btn btn-ghost btn-icon" style={{ marginLeft: '-0.5rem' }}>
              <ArrowLeftIcon />
            </Link>
            <h1 className="page-title" style={{ marginBottom: 0 }}>Error</h1>
          </div>
          <p className="page-subtitle" style={{ color: 'var(--error)' }}>{error}</p>
        </div>
      </div>
    );
  }

  const collectedPct = split.totalAmount > 0
    ? Math.round((split.collectedAmount / split.totalAmount) * 100)
    : 0;
  const myShare = split.me?.shareAmount || 0;
  const myPaid = split.me?.paid || false;
  const canRelease = split.opened && split.fullyFunded && !split.onChainReleased;
  const isCreator = Boolean(split.me && split.creatorId === split.me.userId);
  // The invite list is the creator's business only.
  const pendingInvites = isCreator
    ? split.invites.filter((i) => !i.claimed)
    : [];

  return (
    <div className="page" ref={pageRef}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
            <Link to="/" className="btn btn-ghost btn-icon" style={{ marginLeft: '-0.5rem' }}>
              <ArrowLeftIcon />
            </Link>
            <h1 className="page-title" style={{ marginBottom: 0 }}>{split.title}</h1>
          </div>
          {!split.opened && (
            <p className="page-subtitle" style={{ color: 'var(--warning, var(--text-muted))' }}>
              Setup incomplete — the escrow is not open yet
            </p>
          )}
        </div>
        <span className={`badge ${statusClass[split.status]}`} style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>
          <span className="badge-dot" />
          {statusLabels[split.status]}
        </span>
      </div>

      <div className="detail-grid">
        <div className="detail-summary">
          <div className="detail-amount-display" style={{ opacity: 0 }}>
            <div className="detail-amount-label">Total Amount</div>
            <div className="detail-amount-value">${split.totalAmount.toLocaleString()}</div>
            <div className="detail-amount-sub">
              ${split.collectedAmount.toFixed(2)} collected · {collectedPct}% funded
            </div>
            <div style={{ padding: '0 var(--sp-8)', marginTop: 'var(--sp-4)' }}>
              <div className="progress-bar" style={{ height: '0.375rem' }}>
                <div className="progress-fill" style={{ width: `${Math.min(collectedPct, 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-4)' }}>
              Split Details
            </h3>
            <div className="detail-info-grid">
              <div className="detail-info-item" style={{ opacity: 0 }}>
                <span className="detail-info-label">Payee Address</span>
                <span className="detail-info-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>
                  {split.payeeAddress}
                </span>
              </div>
              <div className="detail-info-item" style={{ opacity: 0 }}>
                <span className="detail-info-label">Participants</span>
                <span className="detail-info-value">
                  {split.participants.length} / {split.participantCount}
                </span>
              </div>
              <div className="detail-info-item" style={{ opacity: 0 }}>
                <span className="detail-info-label">Network</span>
                <span className="detail-info-value">Arc Testnet</span>
              </div>
              <div className="detail-info-item" style={{ opacity: 0 }}>
                <span className="detail-info-label">Currency</span>
                <span className="detail-info-value">USDC</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-4)' }}>
              Participants
            </h3>
            {split.participants.length === 0 && (
              <p style={{ color: 'var(--text-muted)' }}>No one has joined yet.</p>
            )}
            <div className="participant-list">
              {split.participants.map((p) => (
                <div key={p.id} className="participant-row" style={{ opacity: 0 }}>
                  <div className="participant-avatar">{p.avatar}</div>
                  <div className="participant-info">
                    <div className="participant-name">
                      {p.isCurrentUser ? 'You' : p.name}
                    </div>
                    <div className="participant-address">{p.address}</div>
                  </div>
                  <div className="participant-amount">${p.shareAmount.toLocaleString()}</div>
                  <div className={`participant-status ${p.paid ? 'paid' : 'unpaid'}`}>
                    {p.paid ? 'Paid' : 'Pending'}
                  </div>
                </div>
              ))}
            </div>

            {pendingInvites.length > 0 && (
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--sp-2)' }}>
                  Invited
                </h3>
                {pendingInvites.map((inv) => (
                  <div key={inv.id} className="participant-row">
                    <div className="participant-avatar">@</div>
                    <div className="participant-info">
                      <div className="participant-name">{inv.email}</div>
                      <div className="participant-address">${inv.shareAmount} share</div>
                    </div>
                    <div className="participant-amount">Invited</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!split.opened && isCreator && (
            <div className="pay-cta" style={{ opacity: 0 }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Finish Setup
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                This split still needs its escrow opened on-chain.
              </p>
              <button className="pay-cta-btn" onClick={handleFinishSetup} disabled={busy}>
                <span>{busy ? 'Opening...' : 'Open on-chain'}</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleCancelSplit}
                disabled={busy}
                style={{ marginTop: 'var(--sp-2)', alignSelf: 'center' }}
              >
                Cancel split
              </button>
            </div>
          )}

          {!split.opened && !isCreator && (
            <div className="card">
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Not open yet
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                The creator hasn't finished setting this split up.
              </p>
            </div>
          )}

          {split.opened && !split.me && split.status !== 'released' && (
            <div className="pay-cta" style={{ opacity: 0 }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Join Split
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                You have been invited to pay an equal share.
              </p>
              <button className="pay-cta-btn" onClick={handleJoin} disabled={busy}>
                <span>{busy ? 'Joining...' : 'Join'}</span>
              </button>
            </div>
          )}

          {split.opened && split.me && (
            <div className="pay-cta" style={{ opacity: 0 }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Your Share
              </div>
              <div className="pay-cta-amount">${myShare.toLocaleString()} USDC</div>
              {myPaid ? (
                <div style={{
                  width: '100%',
                  padding: 'var(--sp-4)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--success-soft)',
                  color: 'var(--success)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  Paid
                </div>
              ) : (
                <button className="pay-cta-btn" onClick={handlePay} disabled={paying || split.status === 'released'}>
                  <span>{paying ? 'Processing...' : `Pay $${myShare} USDC`}</span>
                </button>
              )}
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {myPaid
                  ? 'Payment confirmed on Arc testnet'
                  : 'Approves the escrow, then deposits your USDC'}
              </div>
            </div>
          )}

          {canRelease && (
            <div className="pay-cta" style={{ opacity: 0 }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Fully Funded
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                Everyone has paid. Release the USDC to the payee.
              </p>
              <button className="pay-cta-btn" onClick={handleRelease} disabled={busy}>
                <span>{busy ? 'Releasing...' : 'Release funds'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {error && split && (
        <div style={{
          position: 'fixed',
          bottom: 'var(--sp-4)',
          right: 'var(--sp-4)',
          padding: 'var(--sp-3) var(--sp-4)',
          background: 'var(--error-soft)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          color: 'var(--error)',
          border: '1px solid var(--error)',
        }}>
          {error}
        </div>
      )}
    </div>
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
