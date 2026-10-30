// Account login shared with the FareNest website.
// Google: the app opens the server's Google login in a secure system browser,
// and the server sends the user back to farenest://auth?token=...
// Apple (iOS): native Sign in with Apple, verified by the server.
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getApiUrl } from './api';

const KEY = 'fn_token';
const state = { token: '', user: null, ready: false };
const listeners = new Set();
const emit = () => listeners.forEach(f => f({ ...state }));

async function api(path, { method = 'GET', body, token = state.token } = {}) {
  const base = await getApiUrl();
  if (!base) throw new Error('Accounts need a FareNest server. Add its address in Settings first.');
  let r;
  try {
    r = await fetch(`${base}${path}`, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch { throw new Error('Could not reach FareNest. Check your internet connection.'); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && token) await signOut();
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.');
  return j;
}

async function finish(token) {
  const { user } = await api('/api/me', { token });
  state.token = token; state.user = user;
  await SecureStore.setItemAsync(KEY, token).catch(() => {});
  emit();
  return user;
}

export async function restore() {
  try {
    const t = await SecureStore.getItemAsync(KEY);
    if (t) await finish(t);
  } catch {}
  state.ready = true; emit();
}

export async function signOut() {
  state.token = ''; state.user = null;
  await SecureStore.deleteItemAsync(KEY).catch(() => {});
  emit();
}

export async function loginWithEmail(email, password, signup, name) {
  const r = await api(signup ? '/api/auth/signup' : '/api/auth/login', { method: 'POST', body: { email, password, name }, token: '' });
  return finish(r.token);
}

export async function loginWithGoogle() {
  const base = await getApiUrl();
  if (!base) throw new Error('Accounts need a FareNest server. Add its address in Settings first.');
  const returnUrl = Linking.createURL('auth'); // farenest://auth in store builds
  const res = await WebBrowser.openAuthSessionAsync(`${base}/auth/google/start?redirect=${encodeURIComponent(returnUrl)}`, returnUrl);
  if (res.type !== 'success') return null; // user closed the browser
  const { queryParams } = Linking.parse(res.url);
  if (queryParams?.error) throw new Error(String(queryParams.error));
  if (!queryParams?.token) throw new Error('Google login did not finish. Please try again.');
  return finish(String(queryParams.token));
}

export const appleAvailable = () => Platform.OS === 'ios' ? AppleAuthentication.isAvailableAsync().catch(() => false) : Promise.resolve(false);

export async function loginWithApple() {
  let cred;
  try {
    cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
  } catch (e) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return null;
    throw new Error('Sign in with Apple failed. Please try again.');
  }
  const r = await api('/api/auth/apple', { method: 'POST', body: { identityToken: cred.identityToken, fullName: cred.fullName }, token: '' });
  return finish(r.token);
}

export async function deleteAccount() {
  await api('/api/me', { method: 'DELETE' });
  await signOut();
}

export const getToken = () => state.token;
export const authedApi = (path, opts) => api(path, opts);

export function useAuth() {
  const [s, set] = useState({ ...state });
  useEffect(() => { listeners.add(set); return () => listeners.delete(set); }, []);
  return s;
}
export const onAuthChange = f => { listeners.add(f); return () => listeners.delete(f); };
