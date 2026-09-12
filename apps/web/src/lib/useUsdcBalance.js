import { useCallback, useEffect, useState } from 'react';
import { getPublicClient, unitsToAmount, usdcAbi, usdcAddress } from './chain.js';

/**
 * Reads the wallet's USDC balance from the escrow's token on Arc.
 * Retries on tab focus so a faucet top-up shows up without a reload.
 */
export function useUsdcBalance(address) {
  const [state, setState] = useState({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const token = usdcAddress();
    if (!token) {
      setState({ status: 'unavailable', reason: 'no-usdc-address' });
      return undefined;
    }
    if (!address) {
      setState({ status: 'unavailable', reason: 'not-connected' });
      return undefined;
    }

    let active = true;
    setState({ status: 'loading' });

    const read = () => {
      getPublicClient()
        .readContract({
          address: token,
          abi: usdcAbi,
          functionName: 'balanceOf',
          args: [address],
        })
        .then((raw) => {
          if (active) setState({ status: 'ok', amount: unitsToAmount(raw) });
        })
        .catch((err) => {
          if (active) {
            setState({
              status: 'error',
              message: err.shortMessage || err.message || 'Could not read balance',
            });
          }
        });
    };

    read();
    window.addEventListener('focus', read);

    return () => {
      active = false;
      window.removeEventListener('focus', read);
    };
  }, [address, nonce]);

  return { state, refresh };
}
