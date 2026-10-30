// Accounts shared by the website and the mobile apps.
//  - Email + password
//  - Google: server-side OAuth code flow. The website and the apps both open
//    /auth/google/start; after Google, the server sends the user back with a
//    FareNest token (website: /#auth=..., app: farenest://auth?token=...).
//  - Apple (iOS app): the app sends Apple's identity token, we verify it here.
// Every login returns the same kind of token, so one account works everywhere.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const users = require('./users');

const env = k => process.env[k] || '';
const b64u = b => Buffer.from(b).toString('base64url');

// ---------- Signed tokens ----------
function secret() {
  if (env('AUTH_SECRET')) return env('AUTH_SECRET');
  const f = path.join(__dirname, '..', 'data', 'auth-secret');
  try { return fs.readFileSync(f, 'utf8'); } catch {}
  const s = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}
const SECRET = secret();
function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  return `${body}.${crypto.createHmac('sha256', SECRET).update(body).digest('base64url')}`;
}
function verify(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  return p.exp > Date.now() ? p : null;
}
const SESSION_DAYS = 60;
// tv = token version; bumping it on the user signs out every device.
const issue = u => sign({ uid: u.id, tv: u.tokenVersion || 0, exp: Date.now() + SESSION_DAYS * 864e5 });

function requireUser(req, res, next) {
  const p = verify((req.get('authorization') || '').replace(/^Bearer /, ''));
  const u = p && users.byId(p.uid);
  if (!u || (u.tokenVersion || 0) !== p.tv) return res.status(401).json({ error: 'Please log in again.' });
  req.user = u; next();
}

// ---------- Brute-force protection for password login ----------
const attempts = new Map();
function limited(key) {
  const now = Date.now(), a = (attempts.get(key) || []).filter(t => now - t < 15 * 60e3);
  a.push(now); attempts.set(key, a);
  return a.length > 10;
}

// ---------- Where Google may send people back to ----------
function safeRedirect(target) {
  const t = String(target || '/');
  if (/^\/(?!\/)[^\s]*$/.test(t)) return t; // same-site path
  const schemes = (env('APP_SCHEMES') || 'farenest').split(',').map(s => s.trim()).filter(Boolean);
  if (schemes.some(s => t.startsWith(`${s}://`))) return t;
  if (env('NODE_ENV') !== 'production' && /^exp(s)?:\/\//.test(t)) return t; // Expo Go during development
  return '/';
}
function withToken(target, token, user) {
  if (target.startsWith('/')) return `${target.split('#')[0]}#auth=${encodeURIComponent(token)}`;
  const sep = target.includes('?') ? '&' : '?';
  return `${target}${sep}token=${encodeURIComponent(token)}${user ? '' : ''}`;
}
function withError(target, msg) {
  if (target.startsWith('/')) return `${target.split('#')[0]}#auth_error=${encodeURIComponent(msg)}`;
  return `${target}${target.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`;
}
const publicUrl = req => (env('PUBLIC_URL') || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

// ---------- Apple identity token verification ----------
let appleKeys = { at: 0, keys: [] };
async function verifyAppleToken(idToken) {
  const [h, p, s] = String(idToken).split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url'));
  const payload = JSON.parse(Buffer.from(p, 'base64url'));
  if (Date.now() - appleKeys.at > 6 * 3600e3 || !appleKeys.keys.some(k => k.kid === header.kid)) {
    const r = await fetch('https://appleid.apple.com/auth/keys');
    appleKeys = { at: Date.now(), keys: (await r.json()).keys };
  }
  const jwk = appleKeys.keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown Apple signing key');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
  const audiences = (env('APPLE_BUNDLE_IDS') || 'com.farenest.app').split(',').map(x => x.trim());
  if (!ok || payload.iss !== 'https://appleid.apple.com' || !audiences.includes(payload.aud) || payload.exp * 1000 < Date.now())
    throw new Error('Apple sign-in could not be verified');
  return payload;
}

// ---------- Routes ----------
const router = express.Router();
const reply = (res, u) => res.json({ token: issue(u), user: users.publicUser(u) });

router.get('/api/auth/config', (req, res) => res.json({
  google: !!(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET')),
  apple: true, password: true,
}));

router.post('/api/auth/signup', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (String(password || '').length < 8) return res.status(400).json({ error: 'Use a password with at least 8 characters.' });
  const existing = users.byEmail(email);
  if (existing) return res.status(409).json({ error: existing.passwordHash
    ? 'An account with this email already exists. Log in instead.'
    : 'This email is registered with Google or Apple. Use that button to log in.' });
  reply(res, users.createWithPassword({ email, password, name: String(name || '').slice(0, 80) }));
});

router.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (limited(`${req.ip}|${users.normEmail(email)}`)) return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes and try again.' });
  const u = users.byEmail(email);
  if (!u || !users.checkPassword(String(password || ''), u.passwordHash)) {
    return res.status(401).json({ error: u && !u.passwordHash ? 'This account uses Google or Apple sign-in. Use that button instead.' : 'Wrong email or password.' });
  }
  reply(res, u);
});

// Step 1: website or app opens this URL; we send the browser to Google.
router.get('/auth/google/start', (req, res) => {
  const target = safeRedirect(req.query.redirect);
  if (!env('GOOGLE_CLIENT_ID')) return res.redirect(withError(target, 'Google login is not set up yet.'));
  const state = sign({ r: target, n: crypto.randomBytes(8).toString('hex'), exp: Date.now() + 10 * 60e3 });
  const q = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'), redirect_uri: `${publicUrl(req)}/auth/google/callback`,
    response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
});

// Step 2: Google sends the user back here with a code; we swap it for their profile.
router.get('/auth/google/callback', async (req, res) => {
  const st = verify(req.query.state);
  const target = safeRedirect(st?.r);
  if (!st) return res.redirect(withError('/', 'Login took too long. Please try again.'));
  if (req.query.error) return res.redirect(withError(target, 'Google login was cancelled.'));
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: String(req.query.code || ''), client_id: env('GOOGLE_CLIENT_ID'),
        client_secret: env('GOOGLE_CLIENT_SECRET'), redirect_uri: `${publicUrl(req)}/auth/google/callback`, grant_type: 'authorization_code' }),
    });
    const tok = await r.json();
    if (!r.ok || !tok.id_token) throw new Error(tok.error_description || 'Google did not return a profile');
    // The ID token came straight from Google over TLS, so its claims can be trusted; still check them.
    const c = JSON.parse(Buffer.from(tok.id_token.split('.')[1], 'base64url'));
    if (c.aud !== env('GOOGLE_CLIENT_ID') || !['accounts.google.com', 'https://accounts.google.com'].includes(c.iss) || c.exp * 1000 < Date.now())
      throw new Error('Google profile could not be verified');
    const u = users.upsertSocial('google', { sub: c.sub, email: c.email, emailVerified: c.email_verified === true || c.email_verified === 'true', name: c.name, picture: c.picture });
    res.redirect(withToken(target, issue(u)));
  } catch (e) {
    console.error('Google login failed:', e.message);
    res.redirect(withError(target, 'Google login failed. Please try again.'));
  }
});

// iOS app: Sign in with Apple
router.post('/api/auth/apple', async (req, res) => {
  try {
    const c = await verifyAppleToken(req.body?.identityToken);
    const fn = req.body?.fullName || {};
    const name = [fn.givenName, fn.familyName].filter(Boolean).join(' ');
    const u = users.upsertSocial('apple', { sub: c.sub, email: c.email, emailVerified: c.email_verified === true || c.email_verified === 'true', name });
    reply(res, u);
  } catch (e) {
    console.error('Apple login failed:', e.message);
    res.status(401).json({ error: 'Apple sign-in could not be verified. Please try again.' });
  }
});

// ---------- Account ----------
router.get('/api/me', requireUser, (req, res) => res.json({ user: users.publicUser(req.user) }));

router.patch('/api/me', requireUser, (req, res) => {
  const name = String(req.body?.name ?? req.user.name).slice(0, 80);
  res.json({ user: users.publicUser(users.update(req.user.id, { name })) });
});

router.post('/api/me/logout-all', requireUser, (req, res) => {
  users.update(req.user.id, { tokenVersion: (req.user.tokenVersion || 0) + 1 });
  res.json({ ok: true });
});

// Required by Apple and Google Play: users can delete their account in the app.
router.delete('/api/me', requireUser, (req, res) => res.json({ ok: users.remove(req.user.id) }));

// Saved searches, synced between website and apps.
const cleanList = (l, max) => (Array.isArray(l) ? l : []).slice(0, max)
  .filter(x => x && typeof x.key === 'string' && ['flights', 'hotels', 'cars'].includes(x.vertical) && x.query && typeof x.query === 'object')
  .map(x => ({ key: x.key.slice(0, 500), vertical: x.vertical, query: x.query, label: String(x.label || '').slice(0, 120), at: Number(x.at) || Date.now() }));

router.get('/api/me/saved', requireUser, (req, res) => res.json(req.user.saved || { recent: [], starred: [] }));
router.put('/api/me/saved', requireUser, (req, res) => {
  const saved = { recent: cleanList(req.body?.recent, 15), starred: cleanList(req.body?.starred, 100) };
  users.update(req.user.id, { saved });
  res.json(saved);
});

module.exports = { router, requireUser };
