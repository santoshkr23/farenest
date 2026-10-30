import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, Platform, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, prettyDate, isoDate } from './theme';

export function Field({ label, children, style }) {
  const t = useTheme();
  return (
    <View style={[s.field, { borderColor: t.line, backgroundColor: t.surface }, style]}>
      <Text style={[s.label, { color: t.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

export function Input({ label, value, onChangeText, code, style, ...rest }) {
  const t = useTheme();
  return (
    <Field label={label} style={style}>
      <TextInput
        value={value}
        onChangeText={v => onChangeText(code ? v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) : v)}
        style={[s.input, { color: t.ink }, code && s.code]}
        placeholderTextColor={t.muted}
        autoCapitalize={code ? 'characters' : 'words'}
        autoCorrect={false}
        accessibilityLabel={label}
        {...rest}
      />
    </Field>
  );
}

export function DateField({ label, value, onChange, minDate, style, disabled }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(null);
  const date = new Date(`${value}T00:00:00`);
  const min = minDate ? new Date(`${minDate}T00:00:00`) : new Date();
  return (
    <>
      <Pressable onPress={() => !disabled && setOpen(true)} style={[{ opacity: disabled ? 0.45 : 1 }, style]} accessibilityRole="button" accessibilityLabel={`${label}, ${prettyDate(value)}`}>
        <Field label={label}><Text style={[s.input, { color: t.ink }]}>{disabled ? '—' : prettyDate(value)}</Text></Field>
      </Pressable>
      {open && Platform.OS === 'android' && (
        <DateTimePicker value={date} mode="date" minimumDate={min}
          onChange={(e, d) => { setOpen(false); if (e.type === 'set' && d) onChange(isoDate(d)); }} />
      )}
      {Platform.OS === 'ios' && (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
          <View style={[s.sheet, { backgroundColor: t.surface }]}>
            <View style={s.sheetBar}>
              <Text style={[s.sheetTitle, { color: t.ink }]}>{label}</Text>
              <Pressable onPress={() => { if (temp) onChange(isoDate(temp)); setTemp(null); setOpen(false); }} hitSlop={12}>
                <Text style={{ color: t.teal, fontWeight: '700', fontSize: 16 }}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker value={temp || date} mode="date" display="inline" minimumDate={min}
              onChange={(e, d) => d && setTemp(d)} themeVariant={t.bg === '#0c1517' ? 'dark' : 'light'} accentColor={t.teal} />
          </View>
        </Modal>
      )}
    </>
  );
}

export function Chip({ label, active, onPress, style }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={[s.chip, { borderColor: active ? t.teal : t.line, backgroundColor: active ? t.teal : t.surface }, style]}>
      <Text style={{ color: active ? '#fff' : t.ink, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Button({ title, onPress, kind = 'primary', style, disabled }) {
  const t = useTheme();
  const bg = kind === 'accent' ? t.accent : kind === 'primary' ? t.teal : 'transparent';
  const fg = kind === 'accent' ? t.accentInk : kind === 'primary' ? '#fff' : t.teal;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, borderColor: kind === 'ghost' ? t.line : bg }, style]}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Pill({ children, color }) {
  const t = useTheme();
  return <View style={[s.pill, { backgroundColor: t.chip }]}><Text style={{ fontSize: 11, color: color || t.ink }}>{children}</Text></View>;
}

const s = StyleSheet.create({
  field: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flex: 1 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  input: { fontSize: 16, paddingVertical: 2, fontWeight: '500' },
  code: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontWeight: '700', fontSize: 20, letterSpacing: 1 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  btn: { borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { paddingBottom: 30, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
});
