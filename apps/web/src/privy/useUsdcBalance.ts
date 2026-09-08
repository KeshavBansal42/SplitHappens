import { useCallback, useEffect, useState } from "react";
import { readContract } from "viem/actions";
import { usdcAbi } from "../lib/usdcAbi";
import { getPublicClient, usdcAddress } from "../lib/client";
import { unitsToAmount } from "../lib/units";

export type BalanceState =
  | { status: "unavailable"; reason: "no-usdc-address" | "not-connected" }
  | { status: "loading" }
  | { status: "ok"; amount: string }
  | { status: "error"; message: string };

export function useUsdcBalance(address: string | null) {
  const [state, setState] = useState<BalanceState>(() => {
    const token = usdcAddress();
    if (!token) return { status: "unavailable", reason: "no-usdc-address" };
    if (!address) return { status: "unavailable", reason: "not-connected" };
    return { status: "loading" };
  });
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const token = usdcAddress();
    if (!token) {
      setState({ status: "unavailable", reason: "no-usdc-address" });
      return;
    }
    if (!address) {
      setState({ status: "unavailable", reason: "not-connected" });
      return;
    }

    let active = true;
    setState({ status: "loading" });

    const client = getPublicClient();
    readContract(client, {
      address: token,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    })
      .then((balance) => {
        if (active) setState({ status: "ok", amount: unitsToAmount(balance) });
      })
      .catch(() => {
        if (active)
          setState({
            status: "error",
            message: "Could not read USDC balance from Arc testnet.",
          });
      });

    return () => {
      active = false;
    };
  }, [address, nonce]);

  return { state, refresh };
}
