const NETLIFY = '/api/auth';

export async function apiCall(action, params = {}, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(NETLIFY, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...params }),
    });
    const data = await res.json().catch(() => ({
      success: false, code: 'PARSE_ERROR', message: 'استجابة غير صالحة من الخادم'
    }));
    return data;
  } catch (e) {
    return { success: false, code: 'NETWORK_ERROR', message: 'تعذر الاتصال بالخادم — تحقق من الإنترنت' };
  }
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
