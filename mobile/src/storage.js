// Saved and recent searches. Kept on the device, and synced to the account
// (same list as the website) while the user is logged in.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, authedApi, onAuthChange } from './auth';

const KEY = 'fn_saved_v1';
const empty = () => ({ recent: [], starred: [] });

async function local() {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) || 'null') || empty(); } catch { return empty(); }
}
async function write(data) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  if (getToken()) authedApi('/api/me/saved', { method: 'PUT', body: data }).catch(() => {});
}

// Merge two lists by key, newest first.
function merge(a, b, max) {
  const m = new Map();
  for (const x of [...a, ...b]) if (!m.has(x.key) || m.get(x.key).at < x.at) m.set(x.key, x);
  return [...m.values()].sort((x, y) => y.at - x.at).slice(0, max);
}

// On login: combine what's on this phone with what's in the account.
onAuthChange(async s => {
  if (!s.token) return;
  try {
    const remote = await authedApi('/api/me/saved');
    const mine = await local();
    const merged = { recent: merge(mine.recent, remote.recent || [], 15), starred: merge(mine.starred, remote.starred || [], 100) };
    await write(merged);
  } catch {}
});

export async function loadSaved() {
  if (getToken()) {
    try {
      const remote = await authedApi('/api/me/saved');
      await AsyncStorage.setItem(KEY, JSON.stringify(remote)).catch(() => {});
      return remote;
    } catch {}
  }
  return local();
}

const id = (vertical, q) => `${vertical}:${JSON.stringify(q)}`;

export async function addRecent(vertical, query, label) {
  const d = await local();
  const key = id(vertical, query);
  d.recent = [{ key, vertical, query, label, at: Date.now() }, ...d.recent.filter(x => x.key !== key)].slice(0, 15);
  await write(d); return d;
}
export async function toggleStar(vertical, query, label) {
  const d = await local();
  const key = id(vertical, query);
  d.starred = d.starred.some(x => x.key === key)
    ? d.starred.filter(x => x.key !== key)
    : [{ key, vertical, query, label, at: Date.now() }, ...d.starred];
  await write(d); return d;
}
export async function removeItem(list, key) {
  const d = await local();
  d[list] = d[list].filter(x => x.key !== key);
  await write(d); return d;
}
export async function clearRecent() {
  const d = await local(); d.recent = []; await write(d); return d;
}
export const isStarred = (d, vertical, query) => d.starred.some(x => x.key === id(vertical, query));
