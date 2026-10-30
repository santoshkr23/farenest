import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, BackHandler, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './src/theme';
import SearchScreen from './src/SearchScreen';
import ResultsScreen from './src/ResultsScreen';
import SavedScreen from './src/SavedScreen';
import SettingsScreen from './src/SettingsScreen';
import { addRecent } from './src/storage';

const TABS = [['search', 'Search', '⌕'], ['saved', 'Saved', '★'], ['settings', 'Settings', '⚙']];

function Main() {
  const t = useTheme();
  const scheme = useColorScheme();
  const [tab, setTab] = useState('search');
  const [vertical, setVertical] = useState('flights');
  const [results, setResults] = useState(null); // { vertical, query, label }

  const openSearch = (v, q, label) => {
    setVertical(v); setResults({ vertical: v, query: q, label, at: Date.now() }); setTab('search');
    addRecent(v, q, label);
  };

  // Android back button closes results before leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (results && tab === 'search') { setResults(null); return true; }
      if (tab !== 'search') { setTab('search'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [results, tab]);

  const onSearchTab = tab === 'search';
  const headerDark = onSearchTab; // band colour under the status bar
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: headerDark ? t.band : t.bg }} edges={['top']}>
      <StatusBar style={headerDark || scheme === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        {onSearchTab && !results && <SearchScreen vertical={vertical} setVertical={setVertical} onSearch={openSearch} />}
        {onSearchTab && results && <ResultsScreen key={results.at} {...results} onBack={() => setResults(null)} />}
        {tab === 'saved' && <SavedScreen focused onOpen={openSearch} />}
        {tab === 'settings' && <SettingsScreen />}
      </View>
      <SafeAreaView edges={['bottom']} style={[st.tabbar, { backgroundColor: t.surface, borderTopColor: t.line }]}>
        {TABS.map(([k, l, i]) => {
          const on = tab === k;
          return (
            <Pressable key={k} style={st.tabBtn} onPress={() => { if (k === 'search' && tab === 'search') setResults(null); setTab(k); }}
              accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={l}>
              <Text style={{ fontSize: 20, color: on ? t.teal : t.muted }}>{i}</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: on ? t.teal : t.muted }}>{l}</Text>
            </Pressable>
          );
        })}
      </SafeAreaView>
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><Main /></SafeAreaProvider>;
}

const st = StyleSheet.create({
  tabbar: { flexDirection: 'row', borderTopWidth: 1 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
});
