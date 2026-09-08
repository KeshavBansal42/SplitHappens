import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../api/ApiProvider";
import { getMyUserId, setMyUserId } from "../api/me";
import { useEmbeddedWallet } from "../privy/useEmbeddedWallet";
import { useUsdcBalance } from "../privy/useUsdcBalance";
import { PayMyShare } from "../components/PayMyShare";
import { shortAddress } from "../lib/format";
import { ESCROW_ADDRESS } from "../lib/env";
import type { ApiClientError } from "../api/client";
import type { SplitStatusResponse } from "@splithappens/shared";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  partially_paid: "Active",
  released: "Released",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "badge-pending",
  partially_paid: "badge-partial",
  released: "badge-released",
};

export function SplitPage() {
  const { id } = useParams<{ id: string }>();
  const { api } = useApi();
  const { authenticated, address } = useEmbeddedWallet();
  const { state: balanceState } = useUsdcBalance(
    authenticated ? address : null,
  );

  const [status, setStatus] = useState<SplitStatusResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [myUserId, setMyUserIdState] = useState<string | null>(getMyUserId);
  const [shareAmount, setShareAmount] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [pollMs, setPollMs] = useState(5000);
  const [paymentReport, setPaymentReport] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!api || !id) return;
    try {
      setStatus(await api.getStatus(id));
      setLoadError(null);
    } catch (err) {
      setLoadError((err as ApiClientError).message ?? "Failed to load split.");
    }
  }, [api, id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pollMs) return;
    const t = setInterval(() => void load(), pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  if (!id) return null;

  const join = async () => {
    if (!api) return;
    setJoinBusy(true);
    setJoinError(null);
    try {
      const res = await api.joinSplit(id, { shareAmount });
      setMyUserId(res.userId);
      setMyUserIdState(res.userId);
      await load();
    } catch (err) {
      setJoinError((err as ApiClientError).message ?? "Failed to join.");
    } finally {
      setJoinBusy(false);
    }
  };

  const reportPayment = async (txHash: string) => {
    if (!api) return;
    try {
      const me = status?.participants.find((p) => p.userId === myUserId);
      if (!me) return;
      await api.paySplit(id, { txHash, amount: me.shareAmount });
      setPollMs(3000);
      setPaymentReport(null);
      await load();
    } catch (err) {
      setPaymentReport(
        (err as ApiClientError).message ?? "Payment sent but not recorded.",
      );
    }
  };

  if (loadError) {
    return (
      <>
        <p className="error">{loadError}</p>
        <Link className="btn btn-ghost" to="/">
          ← Back home
        </Link>
      </>
    );
  }

  if (!status) {
    return (
      <>
        <p>Loading split…</p>
        <Link className="btn btn-ghost" to="/">
          ← Back home
        </Link>
      </>
    );
  }

  const split = status.split;
  const target = Number(split.totalAmount) || 0;
  const collected = Number(status.onChain.collected) || 0;
  const collectedPct = target > 0 ? Math.round((collected / target) * 100) : 0;
  const myParticipant = status.participants.find(
    (p) => myUserId && p.userId === myUserId,
  );
  const balance = balanceState.status === "ok" ? balanceState.amount : null;
  const badge = STATUS_CLASS[split.status] ?? "badge-pending";

  return (
    <>
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-3)",
              marginBottom: "var(--sp-2)",
            }}
          >
            <Link
              className="btn btn-ghost btn-icon"
              to="/"
              style={{ marginLeft: "-0.5rem" }}
            >
              ←
            </Link>
            <h1 className="page-title" style={{ marginBottom: 0 }}>
              {split.title}
            </h1>
          </div>
        </div>
        <span className={`badge ${badge}`}>
          <span className="badge-dot" />
          {STATUS_LABEL[split.status] ?? split.status}
        </span>
      </div>

      <div className="detail-grid">
        <div className="detail-summary">
          <div className="detail-amount-display">
            <div className="detail-amount-label">Total Amount</div>
            <div className="detail-amount-value">
              {split.totalAmount} USDC
            </div>
            <div className="detail-amount-sub">
              {status.onChain.collected} collected · {collectedPct}% funded
            </div>
            <div style={{ padding: "0 var(--sp-8)", marginTop: "var(--sp-4)" }}>
              <div className="progress-bar" style={{ height: "0.375rem" }}>
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(collectedPct, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: "var(--sp-4)" }}>Split Details</h3>
            <div className="detail-info-grid">
              <div className="detail-info-item">
                <span className="detail-info-label">Payee Address</span>
                <span
                  className="detail-info-value"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-xs)",
                    wordBreak: "break-all",
                  }}
                >
                  {shortAddress(split.payeeAddress)}
                </span>
              </div>
              <div className="detail-info-item">
                <span className="detail-info-label">Participants</span>
                <span className="detail-info-value">
                  {status.participants.length}
                </span>
              </div>
              <div className="detail-info-item">
                <span className="detail-info-label">Network</span>
                <span className="detail-info-value">Arc Testnet</span>
              </div>
              <div className="detail-info-item">
                <span className="detail-info-label">Currency</span>
                <span className="detail-info-value">USDC</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
          <div className="card">
            <h3 style={{ marginBottom: "var(--sp-4)" }}>Participants</h3>
            {status.participants.length === 0 && (
              <p className="empty-state-title">No one has joined yet.</p>
            )}
            <div className="participant-list">
              {status.participants.map((p) => {
                const isMe = myUserId && p.userId === myUserId;
                return (
                  <div key={p.id} className="participant-row">
                    <div className="participant-avatar">
                      {(p.walletAddress ?? p.userId).slice(2, 4).toUpperCase()}
                    </div>
                    <div className="participant-info">
                      <div className="participant-name">
                        {isMe
                          ? "You"
                          : shortAddress(p.walletAddress ?? p.userId)}
                        {isMe && (
                          <span className="participant-you-tag">YOU</span>
                        )}
                      </div>
                      <div className="participant-address">
                        {p.shareAmount} USDC share
                      </div>
                    </div>
                    <div className="participant-amount">
                      {p.paid ? "Paid" : "Pending"}
                    </div>
                    <div
                      className={`participant-status ${p.paid ? "paid" : "unpaid"}`}
                    >
                      {p.txHash && !p.paid ? "confirming…" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {myParticipant ? (
            <div className="card">
              <h3 style={{ marginBottom: "var(--sp-2)" }}>Pay your share</h3>
              <p className="pay-cta-amount">
                {myParticipant.shareAmount} USDC
                {myParticipant.paid ? " — already paid ✓" : ""}
              </p>
              {split.status === "released" ? (
                <p>This split is released — funds went to the payee.</p>
              ) : (
                <>
                  {!myParticipant.paid && !ESCROW_ADDRESS && (
                    <p>
                      The escrow contract is not configured. Set{" "}
                      <code>VITE_ESCROW_ADDRESS</code> to enable payments.
                    </p>
                  )}
                  {!myParticipant.paid && ESCROW_ADDRESS && (
                    <PayMyShare
                      splitId={split.id}
                      amount={myParticipant.shareAmount}
                      escrowAddress={ESCROW_ADDRESS}
                      balance={balance}
                      onSuccess={reportPayment}
                    />
                  )}
                  {paymentReport && <p className="error">{paymentReport}</p>}
                </>
              )}
            </div>
          ) : split.status === "released" ? (
            <p>This split is released.</p>
          ) : (
            <div className="card">
              <h3 style={{ marginBottom: "var(--sp-2)" }}>Join this split</h3>
              <p style={{ marginBottom: "var(--sp-4)" }}>
                Add your share to start paying toward the total.
              </p>
              <div className="form-group">
                <label className="form-label">Your share (USDC)</label>
                <input
                  className="form-input"
                  value={shareAmount}
                  onChange={(e) => setShareAmount(e.target.value)}
                  placeholder="40.00"
                  inputMode="decimal"
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={() => void join()}
                disabled={joinBusy || !shareAmount}
              >
                {joinBusy ? "Joining…" : "Join"}
              </button>
              {joinError && <p className="error">{joinError}</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
