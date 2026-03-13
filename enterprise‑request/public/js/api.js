// Shared helper for authenticated API requests.
// On 401 or 403 responses, the user is redirected to /autorizacao.
// Error responses are expected to be JSON { error: 'message' }; the
// error message is extracted and thrown so callers receive a clean string.
async function fetchJSON(url, opts = {}) {
  opts.credentials = 'include';
  const res = await fetch(url, opts);
  if (res.status === 401 || res.status === 403) {
    window.location.href = '/autorizacao';
    throw new Error('Não autenticado');
  }
  if (!res.ok) {
    let msg;
    try {
      const body = await res.json();
      msg = body.error || res.statusText;
    } catch {
      msg = res.statusText;
    }
    throw new Error(msg);
  }
  return res.json();
}
