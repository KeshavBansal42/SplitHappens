import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { animate, stagger, createTimeline } from 'animejs';
import { api } from '../lib/api.js';
import { showSnackbar } from '../lib/snackbar.js';
import { adaptSplitList, computeStats } from '../lib/transform.js';

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

export default function Dashboard() {
  const pageRef = useRef(null);
  const [splits, setSplits] = useState([]);
  const [invited, setInvited] = useState([]);
  const [stats, setStats] = useState({ totalSplits: 0, activeSplits: 0, totalUSDC: 0, myShare: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [mine, invites] = await Promise.all([
        api.getMySplits(),
        api.getInvitedSplits(),
      ]);
      const adapted = adaptSplitList(mine.splits);
      setSplits(adapted);
      setStats(computeStats(adapted));
      setInvited(adaptSplitList(invites.splits));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Only the creator of a split that was never opened may cancel it.
  const handleCancel = async (event, split) => {
    event.preventDefault();
    event.stopPropagation();

    const ok = window.confirm(
      `Cancel "${split.title}"? Nothing is on-chain yet, so it will just be deleted.`,
    );
    if (!ok) return;

    try {
      await api.cancelSplit(split.id);
      showSnackbar('Split cancelled');
      await load();
    } catch (err) {
      showSnackbar(err.message);
    }
  };

  useEffect(() => {
    if (loading) return;
    const tl = createTimeline({ easing: 'easeOutExpo' });

    tl.add('.stat-card', {
      opacity: [0, 1],
      y: [16, 0],
      duration: 500,
      delay: stagger(80),
    }).add('.split-row-header', {
      opacity: [0, 1],
      duration: 300,
    }, '-=200').add('.split-row:not(.split-row-header)', {
      opacity: [0, 1],
      x: [-12, 0],
      duration: 400,
      delay: stagger(60),
    }, '-=150');
  }, [loading]);

  if (loading) {
    return (
      <div className="page" ref={pageRef}>
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Loading your splits...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page" ref={pageRef}>
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle" style={{ color: 'var(--error)' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page" ref={pageRef}>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Your splits at a glance</p>
      </div>

      <div className="stats-grid">
        <StatCard label="Total Splits" value={stats.totalSplits} />
        <StatCard label="Active Splits" value={stats.activeSplits} accent />
        <StatCard label="Total Volume" value={`$${stats.totalUSDC.toLocaleString()}`} />
        <StatCard label="My Share" value={`$${stats.myShare.toFixed(2)}`} />
      </div>

      {invited.length > 0 && (
        <section style={{ marginBottom: 'var(--sp-8)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-4)' }}>
            Invited to
          </h2>
          <div className="split-list">
            {invited.map((split) => (
              <Link
                key={split.id}
                to={`/splits/${split.id}`}
                className="split-row"
                style={{ textDecoration: 'none' }}
              >
                <div className="split-info">
                  <div className="split-title">{split.title}</div>
                  <div className="split-meta">
                    {split.opened ? `${split.participantCount} participants` : 'Setup incomplete'}
                  </div>
                </div>
                <div className="split-amount">${split.totalAmount.toLocaleString()}</div>
                <div className="split-progress-cell">
                  <div className="split-progress-label">
                    Your share ${split.myShareAmount?.toFixed(2) ?? '0.00'}
                  </div>
                </div>
                <span className={`badge ${statusClass[split.status]}`}>
                  <span className="badge-dot" />
                  {statusLabels[split.status]}
                </span>
                <span className="split-date">{split.createdAt}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Recent Splits
        </h2>
        <Link to="/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          <PlusSmallIcon /> New Split
        </Link>
      </div>

      <div className="split-list">
        <div className="split-row split-row-header">
          <span>Split</span>
          <span style={{ textAlign: 'right' }}>Amount</span>
          <span>Progress</span>
          <span>Status</span>
          <span>Date</span>
        </div>
        {splits.length === 0 ? (
          <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            No splits yet. Create your first split!
          </div>
        ) : (
          splits.map((split) => (
            <Link
              key={split.id}
              to={`/splits/${split.id}`}
              className="split-row"
              style={{ textDecoration: 'none' }}
            >
              <div className="split-info">
                <div className="split-title">{split.title}</div>
                <div className="split-meta">
                  {split.opened
                    ? `${split.participantCount} participants`
                    : 'Setup incomplete'}
                </div>
              </div>
              <div className="split-amount">${split.totalAmount.toLocaleString()}</div>
              <div className="split-progress-cell">
                <div className="progress-bar" style={{ width: '100%' }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${split.totalAmount > 0 ? (split.collectedAmount / split.totalAmount) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="split-progress-label">
                  ${split.collectedAmount.toFixed(2)}/${split.totalAmount.toFixed(2)}
                </div>
              </div>
              <span className={`badge ${statusClass[split.status]}`}>
                <span className="badge-dot" />
                {statusLabels[split.status]}
              </span>
              {split.isCreator && !split.opened ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={(e) => handleCancel(e, split)}
                >
                  Cancel
                </button>
              ) : (
                <span className="split-date">{split.createdAt}</span>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="stat-card" style={{ opacity: 0 }}>
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={accent ? { color: 'var(--accent)' } : undefined}>
        {value}
      </span>
    </div>
  );
}

function PlusSmallIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
