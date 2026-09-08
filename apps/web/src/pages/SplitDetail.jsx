import { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { animate, stagger, createTimeline } from 'animejs';
import { splits } from '../data/mockData';

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
  const pageRef = useRef(null);
  const split = splits.find((s) => s.id === id) || splits[0];

  const collectedPct = Math.round((split.collectedAmount / split.totalAmount) * 100);
  const myParticipant = split.participants.find((p) => p.name === 'testUser1');
  const myShare = myParticipant?.shareAmount || 0;
  const myPaid = myParticipant?.paid || false;

  useEffect(() => {
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
  }, []);

  const handlePay = () => {
    animate('.pay-cta-btn', {
      scale: [1, 0.95, 1],
      duration: 300,
      ease: 'inOutQuad',
    });
  };

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
          <p className="page-subtitle">Created {split.createdAt}</p>
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
              ${split.collectedAmount.toLocaleString()} collected · {collectedPct}% funded
            </div>
            <div style={{ padding: '0 var(--sp-8)', marginTop: 'var(--sp-4)' }}>
              <div className="progress-bar" style={{ height: '0.375rem' }}>
                <div className="progress-fill" style={{ width: `${collectedPct}%` }} />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-4)' }}>
              Split Details
            </h3>
            <div className="detail-info-grid">
              <div className="detail-info-item" style={{ opacity: 0 }}>
                <span className="detail-info-label">Payee</span>
                <span className="detail-info-value">{split.payeeName}</span>
              </div>
              <div className="detail-info-item" style={{ opacity: 0 }}>
                <span className="detail-info-label">Payee Address</span>
                <span className="detail-info-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>
                  {split.payeeAddress}
                </span>
              </div>
              <div className="detail-info-item" style={{ opacity: 0 }}>
                <span className="detail-info-label">Participants</span>
                <span className="detail-info-value">{split.participants.length}</span>
              </div>
              <div className="detail-info-item" style={{ opacity: 0 }}>
                <span className="detail-info-label">Network</span>
                <span className="detail-info-value">Arc Testnet</span>
              </div>
              <div className="detail-info-item" style={{ opacity: 0 }}>
                <span className="detail-info-label">Currency</span>
                <span className="detail-info-value">USDC</span>
              </div>
              <div className="detail-info-item" style={{ opacity: 0 }}>
                <span className="detail-info-label">Verification</span>
                <span className="detail-info-value">
                  {split.requireVerification ? 'Required' : 'Not required'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-4)' }}>
              Participants
            </h3>
            <div className="participant-list">
              {split.participants.map((p) => (
                <div key={p.id} className="participant-row" style={{ opacity: 0 }}>
                  <div className="participant-avatar">
                    {p.avatar}
                  </div>
                  <div className="participant-info">
                    <div className="participant-name">
                      {p.name}
                      {p.name === 'testUser1' && (
                        <span className="participant-you-tag">YOU</span>
                      )}
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
          </div>

          {myParticipant && (
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
                <button className="pay-cta-btn" onClick={handlePay}>
                  <span>Pay ${myShare} USDC</span>
                </button>
              )}
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {myPaid
                  ? 'Payment confirmed on Arc testnet'
                  : 'Payment will be sent to the escrow contract'}
              </div>
            </div>
          )}
        </div>
      </div>
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