import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import { encodeFunctionData } from "viem";
import { useApi } from "../api/ApiProvider";
import { getMyUserId, setMyUserId } from "../api/me";
import { useEmbeddedWallet } from "../privy/useEmbeddedWallet";
import { useUsdcBalance } from "../privy/useUsdcBalance";
import { PayMyShare } from "../components/PayMyShare";
import { shortAddress } from "../lib/format";
import { escrowAbi } from "../lib/escrowAbi";
import { amountToUnits } from "../lib/units";
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
  const { sendTransaction } = usePrivy();
  const { authenticated, address } = useEmbeddedWallet();
  const { state: balanceState } = useUsdcBalance(
    authenticated ? address : null,
  );

  const [status, setStatus] = useState<SplitStatusResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [myUserId, setMyUserIdState] = useState<string | null>(getMyUserId);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [pollMs, setPollMs] = useState(5000);
  const [paymentReport, setPaymentReport] = useState<string | null>(null);
  const [inviteEmails, setInviteEmails] = useState([""]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

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

  const finishSetup = async () => {
    if (!api || !status) return;
    setSetupBusy(true);
    setSetupError(null);
    try {
      if (!ESCROW_ADDRESS) throw new Error("Escrow address is not configured.");
      const { split } = status;
      const data = encodeFunctionData({
        abi: escrowAbi,
        functionName: "openSplit",
        args: [
          BigInt(split.id),
          split.payeeAddress as `0x${string}`,
          amountToUnits(split.totalAmount),
        ],
      });
      const receipt = await sendTransaction({
        to: ESCROW_ADDRESS,
        data,
        chainId: 5042002,
      });
      await api.openSplit(split.id, {
        txHash: receipt.transactionHash as `0x${string}`,
      });
      await load();
    } catch (err) {
      setSetupError(
        (err as ApiClientError).message ?? "Could not finish setting up.",
      );
    } finally {
      setSetupBusy(false);
    }
  };

  const releaseFunds = async () => {
    if (!api || !status) return;
    setReleaseBusy(true);
    setReleaseError(null);
    try {
      if (!ESCROW_ADDRESS) throw new Error("Escrow address is not configured.");
      const data = encodeFunctionData({
        abi: escrowAbi,
        functionName: "release",
        args: [BigInt(status.split.id)],
      });
      await sendTransaction({
        to: ESCROW_ADDRESS,
        data,
        chainId: 5042002,
      });
      setPollMs(3000);
      await load();
    } catch (err) {
      setReleaseError(
        (err as ApiClientError).message ?? "Could not release the funds.",
      );
    } finally {
      setReleaseBusy(false);
    }
  };

  const join = async () => {
    if (!api) return;
    setJoinBusy(true);
    setJoinError(null);
    try {
      const res = await api.joinSplit(id);
      setMyUserId(res.userId);
      setMyUserIdState(res.userId);
      await load();
    } catch (err) {
      setJoinError((err as ApiClientError).message ?? "Failed to join.");
    } finally {
      setJoinBusy(false);
    }
  };

  const addPeople = async () => {
    if (!api) return;
    setInviteBusy(true);
    setInviteError(null);
    try {
      const emails = inviteEmails.map((e) => e.trim()).filter(Boolean);
      await api.addInvites(id, { emails });
      setInviteEmails([""]);
      await load();
    } catch (err) {
      setInviteError((err as ApiClientError).message ?? "Failed to add people.");
    } finally {
      setInviteBusy(false);
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
  const pendingInvites = status.invites.filter((i) => !i.claimed);
  const hasOtherParticipants = status.participants.some(
    (p) => myUserId && p.userId !== myUserId,
  );
  const isCreator = Boolean(myUserId && split.creatorId === myUserId);
  const fullyFunded = target > 0 && collected >= target;
  const canRelease = split.opened && !status.onChain.released && fullyFunded;

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
                  {status.participants.length} / {split.participantCount}
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

            {pendingInvites.length > 0 && (
              <div style={{ marginTop: "var(--sp-4)" }}>
                <h3 style={{ fontSize: "var(--text-sm)", marginBottom: "var(--sp-2)" }}>
                  Invited
                </h3>
                {pendingInvites.map((inv) => (
                  <div key={inv.id} className="participant-row">
                    <div className="participant-avatar">@</div>
                    <div className="participant-info">
                      <div className="participant-name">{inv.email}</div>
                      <div className="participant-address">
                        {inv.shareAmount} USDC share
                      </div>
                    </div>
                    <div className="participant-amount">Invited</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!split.opened && isCreator && (
            <div className="card">
              <h3 style={{ marginBottom: "var(--sp-2)" }}>Finish setting up</h3>
              <p style={{ marginBottom: "var(--sp-4)" }}>
                This split still needs its escrow opened on-chain. It's the
                only place gas comes from your wallet.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => void finishSetup()}
                disabled={setupBusy}
              >
                {setupBusy ? "Opening…" : "Open on-chain"}
              </button>
              {setupError && <p className="error">{setupError}</p>}
            </div>
          )}

          {!split.opened && !isCreator && (
            <div className="card">
              <h3 style={{ marginBottom: "var(--sp-2)" }}>Not open yet</h3>
              <p>The creator hasn't finished setting this split up.</p>
            </div>
          )}

          {split.opened && myParticipant && (
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
          )}

          {split.opened &&
            !myParticipant &&
            split.status !== "released" && (
              <div className="card">
                <h3 style={{ marginBottom: "var(--sp-2)" }}>Join this split</h3>
                <p style={{ marginBottom: "var(--sp-4)" }}>
                  You have been invited to pay an equal share.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => void join()}
                  disabled={joinBusy}
                >
                  {joinBusy ? "Joining…" : "Join"}
                </button>
                {joinError && <p className="error">{joinError}</p>}
              </div>
            )}

          {split.opened && !myParticipant && split.status === "released" && (
            <p>This split is released.</p>
          )}

          {canRelease && (
            <div className="card">
              <h3 style={{ marginBottom: "var(--sp-2)" }}>Fully funded</h3>
              <p style={{ marginBottom: "var(--sp-4)" }}>
                Everyone has paid. Release the USDC to the payee.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => void releaseFunds()}
                disabled={releaseBusy}
              >
                {releaseBusy ? "Releasing…" : "Release funds"}
              </button>
              {releaseError && <p className="error">{releaseError}</p>}
            </div>
          )}

          {isCreator &&
            split.opened &&
            split.status !== "released" &&
            !hasOtherParticipants && (
            <div className="card">
              <h3 style={{ marginBottom: "var(--sp-2)" }}>Add people</h3>
              <p style={{ marginBottom: "var(--sp-4)" }}>
                Invite more people before anyone joins — shares stay equal.
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--sp-3)",
                  marginBottom: "var(--sp-4)",
                }}
              >
                {inviteEmails.map((email, i) => (
                  <input
                    key={i}
                    className="form-input"
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setInviteEmails((prev) =>
                        prev.map((v, j) => (j === i ? e.target.value : v)),
                      )
                    }
                    placeholder={`friend${i + 1}@example.com`}
                  />
                ))}
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setInviteEmails((prev) => [...prev, ""])}
              >
                + Another email
              </button>{" "}
              <button
                className="btn btn-primary"
                onClick={() => void addPeople()}
                disabled={inviteBusy || inviteEmails.every((e) => !e.trim())}
              >
                {inviteBusy ? "Adding…" : "Add people"}
              </button>
              {inviteError && <p className="error">{inviteError}</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
