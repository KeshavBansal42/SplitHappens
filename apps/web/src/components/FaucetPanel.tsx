import { useState } from "react";
import { copyToClipboard, shortAddress } from "../lib/format";

const FAUCET_URL = "https://faucet.circle.com/";

export function FaucetPanel({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <p>
        <strong>Need testnet USDC?</strong>
      </p>
      <p>
        Your Arc testnet wallet is{" "}
        <code title={address}>{shortAddress(address)}</code>.
      </p>
      <button
        onClick={async () => {
          const ok = await copyToClipboard(address);
          setCopied(ok);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied!" : "Copy address"}
      </button>{" "}
      <a href={FAUCET_URL} target="_blank" rel="noreferrer">
        Open USDC faucet
      </a>
      <p>
        Faucet unavailable? Ask a teammate for a manual transfer to the address
        above.
      </p>
    </div>
  );
}
