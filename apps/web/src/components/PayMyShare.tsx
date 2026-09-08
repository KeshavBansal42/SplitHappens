import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { encodeFunctionData, parseUnits } from "viem";
import { escrowAbi } from "../lib/escrowAbi";
import { usdcAbi } from "../lib/usdcAbi";
import { USDC_ADDRESS } from "../lib/env";
import { USDC_DECIMALS, amountToUnits } from "../lib/units";

export type PayStep = "approve" | "deposit";

export type PayStatus =
  | { status: "idle" }
  | { status: "loading"; step: PayStep }
  | { status: "approved" }
  | { status: "success"; txHash: string }
  | { status: "error"; message: string };

type PayMyShareProps = {
  splitId: string;
  amount: string;
  escrowAddress: `0x${string}`;
  usdcAddress?: `0x${string}`;
  balance: string | null;
  onApproved?: () => void;
  onSuccess?: (txHash: string) => void;
  onError?: (message: string) => void;
};

export function PayMyShare({
  splitId,
  amount,
  escrowAddress,
  usdcAddress = USDC_ADDRESS,
  balance,
  onApproved,
  onSuccess,
  onError,
}: PayMyShareProps) {
  const { sendTransaction, authenticated, user } = usePrivy();
  const [status, setStatus] = useState<PayStatus>({ status: "idle" });

  useEffect(() => {
    setStatus({ status: "idle" });
  }, [splitId, amount, escrowAddress, usdcAddress]);

  if (!authenticated) {
    return <p>Log in to pay your share.</p>;
  }

  const insufficient =
    balance !== null && amountToUnits(balance) < amountToUnits(amount);
  const missingToken = !usdcAddress;

  const run = async (step: PayStep, data: `0x${string}`, to: `0x${string}`) => {
    setStatus({ status: "loading", step });
    const receipt = await sendTransaction({
      to,
      data,
      chainId: 5042002,
    });
    return receipt.transactionHash;
  };

  const pay = async () => {
    if (!usdcAddress) return;
    try {
      const amountUnits = parseUnits(amount, USDC_DECIMALS);

      if (status.status !== "approved") {
        const approveData = encodeFunctionData({
          abi: usdcAbi,
          functionName: "approve",
          args: [escrowAddress, amountUnits],
        });
        await run("approve", approveData, usdcAddress);
        setStatus({ status: "approved" });
        onApproved?.();
      }

      const depositData = encodeFunctionData({
        abi: escrowAbi,
        functionName: "deposit",
        args: [BigInt(splitId), amountUnits],
      });
      const txHash = await run("deposit", depositData, escrowAddress);
      setStatus({ status: "success", txHash });
      onSuccess?.(txHash);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Transaction failed.";
      setStatus({ status: "error", message });
      onError?.(message);
    }
  };

  const canPay = authenticated && Boolean(user?.wallet);

  return (
    <div>
      <p>
        Pay {amount} USDC for split {splitId}
      </p>
      {!canPay && <p>No embedded wallet available. Log in to create one.</p>}
      {missingToken && (
        <p>
          USDC token address not configured. Set <code>VITE_USDC_ADDRESS</code>{" "}
          in <code>apps/web/.env</code>.
        </p>
      )}
      {insufficient && (
        <p>Not enough USDC. Use the faucet to fund your wallet first.</p>
      )}

      {status.status === "idle" && (
        <button onClick={pay} disabled={!canPay || insufficient || missingToken}>
          Pay my share
        </button>
      )}
      {status.status === "loading" && (
        <p>
          {status.step === "approve"
            ? "Waiting for you to approve the escrow…"
            : "Waiting for you to confirm the deposit…"}
        </p>
      )}
      {status.status === "approved" && (
        <p>
          Escrow approved.{" "}
          <button onClick={pay} disabled={!canPay || insufficient}>
            Confirm deposit
          </button>
        </p>
      )}
      {status.status === "success" && (
        <p>
          Payment sent.{" "}
          <a
            href={`https://testnet.arcscan.app/tx/${status.txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View on explorer
          </a>{" "}
          <code>{status.txHash}</code>
        </p>
      )}
      {status.status === "error" && (
        <p>
          {status.message} <button onClick={pay}>Retry</button>
        </p>
      )}
    </div>
  );
}
