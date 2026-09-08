import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import { useApi } from "../api/ApiProvider";
import { WalletCard } from "../components/WalletCard";
import type { ApiClientError } from "../api/client";

type SavedSplit = { id: string; title: string; totalAmount: string };

const STORAGE_KEY = "splitstream.my-splits";

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
  const { user } = usePrivy();
  const { api } = useApi();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [payeeAddress, setPayeeAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email =
    (user?.email as { address?: string } | undefined)?.address ??
    "anonymous user";

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
    <main>
      <header>
        <h1>SplitStream</h1>
        <p>Welcome, {email}</p>
      </header>

      <WalletCard />

      <section className="card">
        <h2>Create a shared expense</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void createSplit();
          }}
        >
          <div>
            <label>
              Title{" "}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Dinner with friends"
              />
            </label>
          </div>
          <div>
            <label>
              Total amount (USDC){" "}
              <input
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="120.00"
                inputMode="decimal"
              />
            </label>
          </div>
          <div>
            <label>
              Payee wallet address{" "}
              <input
                value={payeeAddress}
                onChange={(e) => setPayeeAddress(e.target.value)}
                placeholder="0x…"
                style={{ width: "100%" }}
              />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy || !title || !totalAmount || !payeeAddress}>
            {busy ? "Creating…" : "Create split"}
          </button>
        </form>
      </section>

      {mySplits.length > 0 && (
        <section className="card">
          <h2>Your splits</h2>
          <ul>
            {mySplits.map((s) => (
              <li key={s.id}>
                <Link to={`/splits/${s.id}`}>
                  {s.title} — {s.totalAmount} USDC
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
