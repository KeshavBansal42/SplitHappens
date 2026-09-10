const BASE = '';

function getAuthHeaders() {
  const user = JSON.parse(localStorage.getItem('dev-user') || '{}');
  return {
    'Content-Type': 'application/json',
    'x-dev-user-id': user.userId || 'demo',
    'x-dev-email': user.email || '',
    'x-dev-wallet': user.wallet || '',
  };
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: getAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error?.message || 'Request failed');
    err.status = res.status;
    err.code = json.error?.code;
    throw err;
  }
  return json;
}

export const api = {
  listSplits: () => request('GET', '/api/v1/splits'),
  getSplit: (id) => request('GET', `/api/v1/splits/${id}`),
  createSplit: (body) => request('POST', '/api/v1/splits', body),
  joinSplit: (id) => request('POST', `/api/v1/splits/${id}/join`, {}),
  paySplit: (id, body) => request('POST', `/api/v1/splits/${id}/pay`, body),
  getSplitStatus: (id) => request('GET', `/api/v1/splits/${id}/status`),
  addInvites: (id, body) => request('POST', `/api/v1/splits/${id}/invites`, body),
};