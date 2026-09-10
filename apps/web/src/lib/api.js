import { DEV_EMAIL, DEV_USER_ID, DEV_WALLET } from './env.js';

// In dev mode the app talks to an AUTH_MODE=dev API using headers. In the
// real path AuthProvider hands us the Privy token getters.
const DEV_MODE = Boolean(DEV_USER_ID && DEV_WALLET);

let tokenGetters = {
  getAccessToken: async () => null,
  getIdentityToken: () => null,
};

export function configureAuth(next) {
  tokenGetters = { ...tokenGetters, ...next };
}

async function authHeaders() {
  const base = { 'Content-Type': 'application/json' };

  if (DEV_MODE) {
    return {
      ...base,
      'x-dev-user-id': DEV_USER_ID,
      'x-dev-wallet': DEV_WALLET,
      ...(DEV_EMAIL ? { 'x-dev-email': DEV_EMAIL } : {}),
    };
  }

  const [accessToken, identityToken] = [
    await tokenGetters.getAccessToken(),
    tokenGetters.getIdentityToken(),
  ];

  return {
    ...base,
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    ...(identityToken ? { 'x-privy-id-token': identityToken } : {}),
  };
}

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: await authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
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
