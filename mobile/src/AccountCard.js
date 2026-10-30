import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Image, ActivityIndicator } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTheme } from './theme';
import { Button } from './components';
import { useAuth, loginWithEmail, loginWithGoogle, loginWithApple, appleAvailable, signOut, deleteAccount } from './auth';

export default function AccountCard() {
  const t = useTheme();
  const { user, ready } = useAuth();
  const [mode, setMode] = useState('login'); // login | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [apple, setApple] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { appleAvailable().then(setApple); }, []);

  const run = (what, fn) => async () => {
    setErr(''); setBusy(what);
    try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const box = [st.box, { backgroundColor: t.surface, borderColor: t.line }];
  const input = [st.input, { color: t.ink, borderColor: t.line, backgroundColor: t.bg }];

  if (!ready) return <View style={box}><ActivityIndicator color={t.teal} /></View>;

  if (user) {
    return (
      <View style={box}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {user.picture
            ? <Image source={{ uri: user.picture }} style={st.avatar} accessibilityIgnoresInvertColors />
            : <View style={[st.avatar, { backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: t.accentInk, fontWeight: '800', fontSize: 18 }}>{(user.name || user.email)[0].toUpperCase()}</Text></View>}
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>{user.name || user.email.split('@')[0]}</Text>
            <Text style={{ color: t.muted, fontSize: 13 }}>{user.email}</Text>
          </View>
        </View>
        <Text style={{ color: t.muted, fontSize: 13 }}>Your saved searches sync with the FareNest website and your other devices.</Text>
        <Button kind="ghost" title="Log out" onPress={signOut} />
        <Pressable onPress={confirmDelete ? run('delete', deleteAccount) : () => setConfirmDelete(true)} hitSlop={8} accessibilityRole="button">
          <Text style={{ color: t.bad, fontSize: 13, fontWeight: '600' }}>
            {busy === 'delete' ? 'Deleting…' : confirmDelete ? 'Tap again to permanently delete your account' : 'Delete my account'}
          </Text>
        </Pressable>
        {!!err && <Text style={{ color: t.bad, fontSize: 13 }}>{err}</Text>}
      </View>
    );
  }

  return (
    <View style={box}>
      <Text style={{ color: t.ink, fontWeight: '800', fontSize: 18 }}>{mode === 'signup' ? 'Create your account' : 'Log in'}</Text>
      <Text style={{ color: t.muted, fontSize: 13 }}>Use the same account as on the FareNest website. Searching works without an account.</Text>

      {apple && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={t.bg === '#0c1517' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={10} style={{ height: 46 }} onPress={run('apple', loginWithApple)} />
      )}
      <Pressable onPress={run('google', loginWithGoogle)} style={[st.social, { borderColor: t.line, backgroundColor: t.surface }]} accessibilityRole="button" disabled={!!busy}>
        <Text style={{ color: t.ink, fontWeight: '700', fontSize: 15 }}>{busy === 'google' ? 'Opening Google…' : 'Continue with Google'}</Text>
      </Pressable>

      <View style={st.or}><View style={[st.line, { backgroundColor: t.line }]} /><Text style={{ color: t.muted, fontSize: 12 }}>or use email</Text><View style={[st.line, { backgroundColor: t.line }]} /></View>

      {mode === 'signup' && <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={t.muted} style={input} autoComplete="name" textContentType="name" accessibilityLabel="Your name" />}
      <TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={t.muted} style={input}
        autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" accessibilityLabel="Email address" />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password (8+ characters)" placeholderTextColor={t.muted} style={input}
        secureTextEntry autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} textContentType={mode === 'signup' ? 'newPassword' : 'password'} accessibilityLabel="Password" />
      {!!err && <Text style={{ color: t.bad, fontSize: 13 }}>{err}</Text>}
      <Button title={busy === 'email' ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'} disabled={!!busy}
        onPress={run('email', () => loginWithEmail(email.trim(), password, mode === 'signup', name.trim()))} />
      <Pressable onPress={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setErr(''); }} hitSlop={8} accessibilityRole="button">
        <Text style={{ color: t.teal, fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
          {mode === 'signup' ? 'Already have an account? Log in' : 'New here? Create an account'}
        </Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  input: { borderWidth: 1, borderRadius: 8, padding: 11, fontSize: 15 },
  social: { borderWidth: 1, borderRadius: 10, height: 46, alignItems: 'center', justifyContent: 'center' },
  or: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { flex: 1, height: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
});
