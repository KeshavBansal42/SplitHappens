import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../api/ApiProvider";
import { WalletCard } from "../components/WalletCard";
import type { ApiClientError } from "../api/client";

type SavedSplit = { id: string; title: string; totalAmount: string };

const STORAGE_KEY = "splithappens.my-splits";

function loadSplits(): SavedSplit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedSplit[]) : [];
  } catch {
    return [];
  }
}

function saveSplit(split: SavedSplit) {
  const list = loadSplits().filter((s) => s.id !== split.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([split, ...list]));
}

export function HomePage() {
  const { api } = useApi();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [payeeAddress, setPayeeAddress] = useState("");
  const [people, setPeopleCount] = useState(2);
  const [emails, setEmails] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteCount = people - 1;
  const filledEmails = emails.slice(0, inviteCount);
  const equalShare =
    totalAmount && people > 0
      ? (Number(totalAmount) / people).toFixed(2)
      : null;

  const setEmail = (index: number, value: string) => {
    setEmails((prev) => prev.map((e, i) => (i === index ? value : e)));
  };

  const setPeople = (value: number) => {
    const count = Math.max(2, value);
    setPeopleCount(count);
    setEmails((prev) => {
      const target = count - 1;
      if (prev.length < target) {
        return [...prev, ...Array(target - prev.length).fill("")];
      }
      return prev.slice(0, target);
    });
  };

  const createSplit = async () => {
    if (!api) return;
    setBusy(true);
    setError(null);
    try {
      const invites = filledEmails
        .map((e) => e.trim())
        .filter(Boolean)
        .map((email) => ({ email }));
      const split = await api.createSplit({
        title: title.trim(),
        totalAmount,
        payeeAddress,
        participantCount: people,
        invites,
      });
      saveSplit({
        id: split.id,
        title: split.title,
        totalAmount: split.totalAmount,
      });
      navigate(`/splits/${split.id}`);
    } catch (err) {
      setError((err as ApiClientError).message ?? "Failed to create split.");
    } finally {
      setBusy(false);
    }
  };

  const mySplits = loadSplits();

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Create a shared expense, then share the link so others can join
        </p>
      </div>

      <WalletCard />

      <section className="card" style={{ marginTop: "var(--sp-6)" }}>
        <h2 style={{ marginBottom: "var(--sp-4)" }}>Create a shared expense</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void createSplit();
          }}
        >
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dinner with friends"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Total amount (USDC)</label>
              <input
                className="form-input"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="120.00"
                inputMode="decimal"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payee wallet address</label>
              <input
                className="form-input"
                value={payeeAddress}
                onChange={(e) => setPayeeAddress(e.target.value)}
                placeholder="0x…"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Number of people (including you)</label>
            <input
              className="form-input"
              type="number"
              min={2}
              value={people}
              onChange={(e) => setPeople(Number(e.target.value))}
            />
          </div>

          {equalShare && (
            <p style={{ marginBottom: "var(--sp-4)" }}>
              Each person pays {equalShare} USDC
            </p>
          )}

          {inviteCount > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--sp-3)",
                marginBottom: "var(--sp-4)",
              }}
            >
              <label className="form-label">Invite by email</label>
              {Array.from({ length: inviteCount }).map((_, i) => (
                <input
                  key={i}
                  className="form-input"
                  type="email"
                  value={emails[i] ?? ""}
                  onChange={(e) => setEmail(i, e.target.value)}
                  placeholder={`friend${i + 1}@example.com`}
                />
              ))}
            </div>
          )}

          {error && <p className="error">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !title || !totalAmount || !payeeAddress}
          >
            {busy ? "Creating…" : "Create split"}
          </button>
        </form>
      </section>

      {mySplits.length > 0 && (
        <section className="card" style={{ marginTop: "var(--sp-6)" }}>
          <h2 style={{ marginBottom: "var(--sp-4)" }}>Your splits</h2>
          <div className="split-list">
            {mySplits.map((s) => (
              <Link key={s.id} to={`/splits/${s.id}`} className="split-row">
                <div className="split-info">
                  <div className="split-title">{s.title}</div>
                </div>
                <div className="split-amount">{s.totalAmount} USDC</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
