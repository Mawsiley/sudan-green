const NETLIFY = '/api/auth';

export async function apiCall(action, params = {}, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(NETLIFY, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json();
  return data;
}

export function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('ar-SD', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return String(d).slice(0, 16); }
}

export function fmt(n) {
  return Number(n || 0).toLocaleString('en-US');
}
