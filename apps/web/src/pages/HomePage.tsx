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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSplit = async () => {
    if (!api) return;
    setBusy(true);
    setError(null);
    try {
      const split = await api.createSplit({
        title: title.trim(),
        totalAmount,
        payeeAddress,
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
