const listeners = new Set();

export function showSnackbar(message) {
  for (const listener of listeners) listener(message);
}

export function subscribeSnackbar(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
