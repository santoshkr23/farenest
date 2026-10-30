// Small fetch helper with timeout + readable errors.
async function http(url, { method = 'GET', headers = {}, body, timeoutMs = 12000, form } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const opts = { method, headers: { Accept: 'application/json', ...headers }, signal: ctrl.signal };
    if (form) {
      opts.body = new URLSearchParams(form).toString();
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (body !== undefined) {
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
      opts.headers['Content-Type'] ||= 'application/json';
    }
    const res = await fetch(url, opts);
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = null; }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    return json ?? text;
  } finally { clearTimeout(t); }
}

// "PT2H35M" -> 155
function isoDurationToMin(s = '') {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(s) || [];
  return (Number(m[1] || 0) * 60) + Number(m[2] || 0);
}

module.exports = { http, isoDurationToMin };
