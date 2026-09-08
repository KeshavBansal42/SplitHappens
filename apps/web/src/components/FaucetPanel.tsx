import { useState } from "react";
import { copyToClipboard, shortAddress } from "../lib/format";

const FAUCET_URL = "https://faucet.circle.com/";

export function FaucetPanel({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      style={{
        marginTop: "var(--sp-5)",
        paddingTop: "var(--sp-5)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <p style={{ marginBottom: "var(--sp-2)" }}>
        <strong>Need testnet USDC?</strong>
      </p>
      <p style={{ marginBottom: "var(--sp-3)" }}>
        Your Arc testnet wallet is{" "}
        <code title={address}>{shortAddress(address)}</code>.
      </p>
      <button
        className="btn btn-ghost"
        onClick={async () => {
          const ok = await copyToClipboard(address);
          setCopied(ok);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied!" : "Copy address"}
      </button>{" "}
      <a
        className="btn btn-ghost"
        href={FAUCET_URL}
        target="_blank"
        rel="noreferrer"
      >
        Open USDC faucet
      </a>
    </div>
  );
}
