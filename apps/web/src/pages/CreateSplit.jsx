import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { animate, stagger } from 'animejs';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { openSplitOnChain } from '../lib/openSplit.js';

export default function CreateSplit() {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const { user, isDev, sendTransaction } = useAuth();
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [payeeAddress, setPayeeAddress] = useState(user?.wallet || '');
  const [invites, setInvites] = useState([{ email: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    animate('.page > *', {
      opacity: [0, 1],
      y: [12, 0],
      duration: 500,
      delay: stagger(60),
      ease: 'outExpo',
    });
  }, []);

  const addInvite = () => {
    setInvites([...invites, { email: '' }]);
  };

  const removeInvite = (index) => {
    if (invites.length > 1) {
      setInvites(invites.filter((_, i) => i !== index));
    }
  };

  const updateInvite = (index, value) => {
    const updated = [...invites];
    updated[index] = { email: value };
    setInvites(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const participantCount = invites.length + 1;
      const body = {
        title,
        totalAmount: totalAmount.toString(),
        payeeAddress,
        participantCount,
        invites: invites.filter((i) => i.email.trim()),
        requireVerification: false,
      };

      const result = await api.createSplit(body);

      // Signing controls the creator's own wallet, so it can be cancelled.
      // The split page offers a retry if that happens.
      try {
        await openSplitOnChain(result, { isDev, sendTransaction });
      } catch (txErr) {
        console.warn('openSplit not completed:', txErr.message);
      }

      navigate(`/splits/${result.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="page" ref={pageRef}>
      <div className="page-header">
        <h1 className="page-title">New Split</h1>
        <p className="page-subtitle">Create a shared expense and invite participants</p>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '40rem', margin: '0 auto' }}>
        <div className="card form-card" style={{ marginBottom: 'var(--sp-6)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
            <div className="form-group">
              <label className="form-label">Split Title</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. Team dinner, Conference tickets"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Total Amount (USDC)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Payee Address</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="0x..."
                  value={payeeAddress}
                  onChange={(e) => setPayeeAddress(e.target.value)}
                  required
                />
              </div>
            </div>

            {totalAmount && invites.length > 0 && (
              <div style={{
                padding: 'var(--sp-3) var(--sp-4)',
                background: 'var(--accent-soft)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                color: 'var(--accent)',
              }}>
                Each participant pays ~${(parseFloat(totalAmount) / (invites.length + 1)).toFixed(2)} USDC
              </div>
            )}
          </div>
        </div>

        <div className="card form-card" style={{ marginBottom: 'var(--sp-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-5)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
              Invite Participants
            </h3>
            <button type="button" className="btn btn-ghost" onClick={addInvite}>
              <PlusIcon /> Add
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {invites.map((invite, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: 'var(--sp-3)',
                alignItems: 'center',
                padding: 'var(--sp-3)',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}>
                <div style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <input
                  className="form-input"
                  type="email"
                  placeholder="email@example.com"
                  value={invite.email}
                  onChange={(e) => updateInvite(i, e.target.value)}
                  style={{ flex: 1, background: 'var(--bg-surface)' }}
                  required
                />
                {invites.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost"
                    onClick={() => removeInvite(i)}
                    style={{ flexShrink: 0 }}
                  >
                    <XIcon />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            padding: 'var(--sp-3) var(--sp-4)',
            background: 'var(--error-soft)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--error)',
            marginBottom: 'var(--sp-6)',
          }}>
            {error}
          </div>
        )}

        <div className="card form-card" style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate('/')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Split'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}