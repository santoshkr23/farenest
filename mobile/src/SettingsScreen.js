import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useTheme } from './theme';
import { getApiUrl, setApiUrl, defaultApiUrl } from './api';
import { Button } from './components';
import AccountCard from './AccountCard';

export default function SettingsScreen() {
  const t = useTheme();
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');
  const extra = Constants.expoConfig?.extra || {};
  const showServer = extra.showServerSetting !== false;

  useEffect(() => { getApiUrl().then(setUrl); }, []);

  const test = async () => {
    setMsg('Checking…');
    const clean = url.trim().replace(/\/$/, '');
    if (clean && !/^https?:\/\//.test(clean)) return setMsg('The address must start with https://');
    await setApiUrl(clean === defaultApiUrl ? '' : clean);
    if (!clean) return setMsg('Saved. The app will use sample prices.');
    try {
      const r = await fetch(`${clean}/api/search/cars?pickup=test&pickupDate=2030-01-01&dropoffDate=2030-01-02`);
      setMsg(r.ok ? 'Connected. Live prices will be used from now on.' : `Server replied with error ${r.status}.`);
    } catch { setMsg('Could not reach that address.'); }
  };

  const link = (title, href) => href ? (
    <Pressable onPress={() => WebBrowser.openBrowserAsync(href)} style={[st.link, { borderColor: t.line, backgroundColor: t.surface }]} accessibilityRole="link">
      <Text style={{ color: t.ink, fontWeight: '600', flex: 1 }}>{title}</Text><Text style={{ color: t.muted, fontSize: 18 }}>›</Text>
    </Pressable>
  ) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={[st.h, { color: t.ink }]}>Account</Text>
      <AccountCard />

      {showServer && (
        <View style={[st.box, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text style={[st.section, { color: t.muted }]}>PRICE SERVER</Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>Address of your FareNest server. Leave empty to use sample prices.</Text>
          <TextInput value={url} onChangeText={setUrl} placeholder="https://api.yourdomain.com" placeholderTextColor={t.muted}
            autoCapitalize="none" autoCorrect={false} keyboardType="url" accessibilityLabel="Price server address"
            style={[st.input, { color: t.ink, borderColor: t.line, backgroundColor: t.bg }]} />
          <Button title="Save and test" onPress={test} />
          {!!msg && <Text style={{ color: t.ink, fontSize: 13 }}>{msg}</Text>}
        </View>
      )}

      <Text style={[st.section, { color: t.muted, marginTop: 8 }]}>ABOUT</Text>
      {link('Privacy policy', extra.privacyUrl)}
      {link('Terms of use', extra.termsUrl)}
      {link('Contact support', extra.supportUrl)}
      <View style={[st.box, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={{ color: t.ink, fontWeight: '700' }}>How FareNest is free</Text>
        <Text style={{ color: t.muted, fontSize: 13, lineHeight: 19 }}>
          We compare prices from travel partners. When you book through a link in the app, the partner may pay us a commission. You pay the same price, and we do not take payments or store your booking details.
        </Text>
      </View>
      <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>FareNest {Constants.expoConfig?.version}</Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  h: { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  box: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15 },
  link: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderRadius: 12 },
});
