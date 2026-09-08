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
import type { SplitStatusResponse } from "@splitstream/shared";

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
      <main>
        <p className="error">{loadError}</p>
        <Link to="/">← Back home</Link>
      </main>
    );
  }

  if (!status) {
    return (
      <main>
        <p>Loading split…</p>
        <Link to="/">← Back home</Link>
      </main>
    );
  }

  const split = status.split;
  const myParticipant = status.participants.find(
    (p) => myUserId && p.userId === myUserId,
  );
  const balance = balanceState.status === "ok" ? balanceState.amount : null;

  return (
    <main>
      <header>
        <h1>{split.title}</h1>
        <p>
          <Link to="/">← Home</Link>
        </p>
      </header>

      <section className="card">
        <h2>Details</h2>
        <p>
          Total: <strong>{split.totalAmount} USDC</strong> · Status:{" "}
          <strong>{split.status}</strong>
        </p>
        <p>
          Payee:{" "}
          <code title={split.payeeAddress}>
            {shortAddress(split.payeeAddress)}
          </code>
        </p>
        <p>
          Collected on chain: {status.onChain.collected} / {status.onChain.target}{" "}
          USDC
        </p>
      </section>

      <section className="card">
        <h2>Participants</h2>
        {status.participants.length === 0 && <p>No one has joined yet.</p>}
        <ul>
          {status.participants.map((p) => {
            const isMe = myUserId && p.userId === myUserId;
            return (
              <li key={p.id}>
                {isMe
                  ? "You"
                  : shortAddress(p.walletAddress ?? p.userId)}{" "}
                — {p.shareAmount} USDC · {p.paid ? "paid ✓" : "not paid"}
                {p.txHash && !p.paid ? " (confirming…)" : ""}
              </li>
            );
          })}
        </ul>
      </section>

      {myParticipant ? (
        <section className="card">
          <h2>Pay your share</h2>
          <p>
            Your share: {myParticipant.shareAmount} USDC
            {myParticipant.paid ? " — already paid ✓" : ""}
          </p>
          {split.status === "released" ? (
            <p>This split is released — funds went to the payee.</p>
          ) : (
            <>
              {!myParticipant.paid && !ESCROW_ADDRESS && (
                <p>
                  The escrow contract is not deployed yet. Set{" "}
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
        </section>
      ) : split.status === "released" ? (
        <p>This split is released.</p>
      ) : (
        <section className="card">
          <h2>Join this split</h2>
          <p>Add your share to start paying toward the total.</p>
          <label>
            Your share (USDC){" "}
            <input
              value={shareAmount}
              onChange={(e) => setShareAmount(e.target.value)}
              placeholder="40.00"
              inputMode="decimal"
            />
          </label>{" "}
          <button onClick={join} disabled={joinBusy || !shareAmount}>
            {joinBusy ? "Joining…" : "Join"}
          </button>
          {joinError && <p className="error">{joinError}</p>}
        </section>
      )}
    </main>
  );
}
