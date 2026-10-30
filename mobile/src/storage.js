// Saved and recent searches, kept on the device.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'fn_saved_v1';

export async function loadSaved() {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) || '{"recent":[],"starred":[]}'); }
  catch { return { recent: [], starred: [] }; }
}
async function write(data) { try { await AsyncStorage.setItem(KEY, JSON.stringify(data)); } catch {} }

const id = (vertical, q) => `${vertical}:${JSON.stringify(q)}`;

export async function addRecent(vertical, query, label) {
  const d = await loadSaved();
  const key = id(vertical, query);
  d.recent = [{ key, vertical, query, label, at: Date.now() }, ...d.recent.filter(x => x.key !== key)].slice(0, 15);
  await write(d); return d;
}
export async function toggleStar(vertical, query, label) {
  const d = await loadSaved();
  const key = id(vertical, query);
  d.starred = d.starred.some(x => x.key === key)
    ? d.starred.filter(x => x.key !== key)
    : [{ key, vertical, query, label, at: Date.now() }, ...d.starred];
  await write(d); return d;
}
export async function removeItem(list, key) {
  const d = await loadSaved();
  d[list] = d[list].filter(x => x.key !== key);
  await write(d); return d;
}
export async function clearRecent() {
  const d = await loadSaved(); d.recent = []; await write(d); return d;
}
export const isStarred = (d, vertical, query) => d.starred.some(x => x.key === id(vertical, query));
