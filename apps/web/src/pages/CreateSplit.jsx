import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { animate, stagger } from 'animejs';

export default function CreateSplit() {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [payeeAddress, setPayeeAddress] = useState('');
  const [participants, setParticipants] = useState([
    { name: '', address: '' },
  ]);

  useEffect(() => {
    animate('.page > *', {
      opacity: [0, 1],
      y: [12, 0],
      duration: 500,
      delay: stagger(60),
      ease: 'outExpo',
    });
  }, []);

  const addParticipant = () => {
    setParticipants([...participants, { name: '', address: '' }]);
  };

  const removeParticipant = (index) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((_, i) => i !== index));
    }
  };

  const updateParticipant = (index, field, value) => {
    const updated = [...participants];
    updated[index] = { ...updated[index], [field]: value };
    setParticipants(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    animate('.form-card', {
      scale: [1, 0.98],
      opacity: [1, 0.5],
      duration: 300,
      ease: 'inQuad',
      onComplete: () => navigate('/splits/split-1'),
    });
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
                />
              </div>
            </div>

            {totalAmount && participants.length > 0 && (
              <div style={{
                padding: 'var(--sp-3) var(--sp-4)',
                background: 'var(--accent-soft)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                color: 'var(--accent)',
              }}>
                Each participant pays ~${(parseFloat(totalAmount) / (participants.length + 1)).toFixed(2)} USDC
              </div>
            )}
          </div>
        </div>

        <div className="card form-card" style={{ marginBottom: 'var(--sp-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-5)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
              Participants
            </h3>
            <button type="button" className="btn btn-ghost" onClick={addParticipant}>
              <PlusIcon /> Add
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {participants.map((p, i) => (
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
                  type="text"
                  placeholder="Name"
                  value={p.name}
                  onChange={(e) => updateParticipant(i, 'name', e.target.value)}
                  style={{ flex: 1, background: 'var(--bg-surface)' }}
                />
                <input
                  className="form-input"
                  type="text"
                  placeholder="Address (0x...)"
                  value={p.address}
                  onChange={(e) => updateParticipant(i, 'address', e.target.value)}
                  style={{ flex: 1.5, background: 'var(--bg-surface)' }}
                />
                {participants.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost"
                    onClick={() => removeParticipant(i)}
                    style={{ flexShrink: 0 }}
                  >
                    <XIcon />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card form-card" style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate('/')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-lg">
            Create Split
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