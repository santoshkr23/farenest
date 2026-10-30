import { useColorScheme } from 'react-native';

const light = {
  bg: '#f3f6f5', surface: '#ffffff', ink: '#13232b', muted: '#5a6b70', line: '#dbe3e1',
  band: '#0f3b3f', bandInk: '#eaf3f1', accent: '#e8a317', accentInk: '#1c1405',
  teal: '#0e6b6b', good: '#1d7a4f', bad: '#c4472f', chip: '#e7eeec',
};
const dark = {
  bg: '#0c1517', surface: '#13201f', ink: '#e6efed', muted: '#93a6a4', line: '#24353a',
  band: '#0a2b2e', bandInk: '#e6efed', accent: '#f0b43a', accentInk: '#1c1405',
  teal: '#4fb3ad', good: '#5cc995', bad: '#e0715a', chip: '#1b2c2d',
};

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}

export const fmt = (n, cur = 'INR') => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur || 'INR', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  }
};
export const pad = n => String(n).padStart(2, '0');
export const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const plusDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
export const prettyDate = s => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
export const hm = s => { const d = new Date(s); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const dur = m => `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
export const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
