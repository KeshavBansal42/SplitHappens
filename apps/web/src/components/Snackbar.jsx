import { useEffect, useState } from 'react';
import { subscribeSnackbar } from '../lib/snackbar.js';

export default function Snackbar() {
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let timer;
    const unsubscribe = subscribeSnackbar((next) => {
      setMessage(next);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 4000);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  if (!message) return null;

  return (
    <div className="snackbar" role="status">
      <span>{message}</span>
      <button
        type="button"
        className="snackbar-close"
        onClick={() => setMessage(null)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
