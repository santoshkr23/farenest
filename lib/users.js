// User accounts in a JSON file (swap for a database when traffic grows).
// One account per email address: signing in with Google, Apple or a password
// for the same verified email lands in the same account on web and app.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'users.json');

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; } }
function save(list) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, FILE);
}

const normEmail = e => String(e || '').trim().toLowerCase();

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function checkPassword(pw, stored) {
  if (!stored) return false;
  const [, salt, hash] = stored.split('$');
  const test = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

// Public shape sent to clients (never includes the password hash).
const publicUser = u => u && ({
  id: u.id, email: u.email, name: u.name || '', picture: u.picture || '',
  providers: Object.keys(u.providers || {}).concat(u.passwordHash ? ['password'] : []),
  createdAt: u.createdAt,
});

module.exports = {
  publicUser, hashPassword, checkPassword, normEmail,
  byId: id => load().find(u => u.id === id),
  byEmail: email => load().find(u => u.email === normEmail(email)),

  createWithPassword({ email, password, name }) {
    const list = load();
    if (list.some(u => u.email === normEmail(email))) return null;
    const u = { id: crypto.randomUUID(), email: normEmail(email), name: name || '', picture: '',
      passwordHash: hashPassword(password), providers: {}, saved: { recent: [], starred: [] }, createdAt: new Date().toISOString() };
    list.push(u); save(list); return u;
  },

  // Find or create the account for a social login. Links by provider id first,
  // then by verified email so the same person never ends up with two accounts.
  upsertSocial(provider, { sub, email, emailVerified, name, picture }) {
    const list = load();
    let u = list.find(x => x.providers?.[provider] === sub);
    if (!u && email && emailVerified) u = list.find(x => x.email === normEmail(email));
    if (!u) {
      if (!email) throw new Error('Your account did not share an email address');
      u = { id: crypto.randomUUID(), email: normEmail(email), name: name || '', picture: picture || '',
        passwordHash: '', providers: {}, saved: { recent: [], starred: [] }, createdAt: new Date().toISOString() };
      list.push(u);
    }
    u.providers = { ...u.providers, [provider]: sub };
    if (!u.name && name) u.name = name;
    if (picture) u.picture = picture;
    u.lastLoginAt = new Date().toISOString();
    save(list); return u;
  },

  update(id, patch) {
    const list = load();
    const u = list.find(x => x.id === id);
    if (!u) return null;
    Object.assign(u, patch); save(list); return u;
  },

  remove(id) {
    const list = load();
    const next = list.filter(u => u.id !== id);
    save(next); return next.length !== list.length;
  },
};
