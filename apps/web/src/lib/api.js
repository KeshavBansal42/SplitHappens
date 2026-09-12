import { DEV_EMAIL, DEV_USER_ID, DEV_WALLET } from './env.js';

// In dev mode the app talks to an AUTH_MODE=dev API using headers. In the
// real path AuthProvider hands us the Privy token getters.
const DEV_MODE = Boolean(DEV_USER_ID && DEV_WALLET);

let tokenGetters = {
  getAccessToken: async () => null,
};

export function configureAuth(next) {
  tokenGetters = { ...tokenGetters, ...next };
}

let unauthorizedHandler = null;

// Called when the API rejects our credentials, so the app can log out.
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

async function authHeaders() {
  const base = { 'Content-Type': 'application/json' };

  if (DEV_MODE) {
    return {
      headers: {
        ...base,
        'x-dev-user-id': DEV_USER_ID,
        'x-dev-wallet': DEV_WALLET,
        ...(DEV_EMAIL ? { 'x-dev-email': DEV_EMAIL } : {}),
      },
      hasToken: true,
    };
  }

  const accessToken = await tokenGetters.getAccessToken();

  return {
    headers: {
      ...base,
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    hasToken: Boolean(accessToken),
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function send(method, path, body) {
  const { headers, hasToken } = await authHeaders();
  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { res, json, hasToken };
}

async function request(method, path, body) {
  let { res, json, hasToken } = await send(method, path, body);

  // Privy reports "authenticated" a moment before the access token exists, so
  // the first calls can go out bare. Wait for a token and try again.
  for (let attempt = 0; attempt < 6 && res.status === 401 && !DEV_MODE; attempt++) {
    await sleep(attempt === 0 && hasToken ? 300 * (attempt + 1) : 250 * (attempt + 1));
    ({ res, json, hasToken } = await send(method, path, body));
  }

  if (!res.ok) {
    // Only treat this as a dead session if we actually presented credentials.
    // A 401 with no token just means Privy isn't ready yet.
    if (res.status === 401 && hasToken) unauthorizedHandler?.();

    const err = new Error(json?.error?.message || 'Request failed');
    err.status = res.status;
    err.code = json?.error?.code;
    err.details = json?.details;
    throw err;
  }
  return json;
}

export const api = {
  createSplit: (body) => request('POST', '/api/v1/splits', body),
  openSplit: (id, body) => request('POST', `/api/v1/splits/${id}/open`, body),
  getSplit: (id) => request('GET', `/api/v1/splits/${id}`),
  getSplitStatus: (id) => request('GET', `/api/v1/splits/${id}/status`),
  getMySplits: () => request('GET', '/api/v1/splits/mine'),
  getInvitedSplits: () => request('GET', '/api/v1/splits/invited'),
  joinSplit: (id) => request('POST', `/api/v1/splits/${id}/join`, {}),
  paySplit: (id, body) => request('POST', `/api/v1/splits/${id}/pay`, body),
  addInvites: (id, body) => request('POST', `/api/v1/splits/${id}/invites`, body),
};

export const IS_DEV_MODE = DEV_MODE;
