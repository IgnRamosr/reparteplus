// app/EditarGasto.tsx
import React, { useMemo, useState, useEffect } from 'react';
import {
Alert,
DeviceEventEmitter,
KeyboardAvoidingView,
Platform,
Pressable,
StyleSheet,
Text,
TextInput,
View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// ===== LedgerTeal palette =====
const PRIMARY = '#0EA5A4'; // teal
const BG = '#F8FBFC';      // casi blanco azulado
const INK = '#0F172A';     // texto principal
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';
const CARD = '#FFFFFF';

export default function EditarGasto() {
const { grupo, gasto } = useLocalSearchParams<{ grupo?: string | string[]; gasto?: string | string[] }>();
const groupId = Array.isArray(grupo) ? grupo[0] : grupo ?? '';
const gastoId = Array.isArray(gasto) ? gasto[0] : gasto ?? '';

  // mocks
const pagadores = useMemo(() => ['Luis Gonzalez', 'Ignacio Ramos', 'Sebastián Tapia'], []);
const monedas   = useMemo(() => ['CLP', 'USD', 'EUR'], []);

const [pagador, setPagador] = useState(pagadores[0]);
const [concepto, setConcepto] = useState('Bencina');
const [moneda, setMoneda] = useState(monedas[0]);
const [monto, setMonto] = useState('60000');

useEffect(() => {
    // TODO: fetch by gastoId y setear estado
}, [gastoId]);

const onPickPhoto = () => {
    Alert.alert('En construcción', 'Adjuntar foto/boleta se habilitará más adelante.');
};

const onSubmit = () => {
    const valor = Number(String(monto).replace(/[^\d.-]/g, ''));
    if (!concepto.trim() || !pagador.trim() || !valor) {
    Alert.alert('Revisa el formulario', 'Completa pagador, gasto y un monto válido.');
    return;
    }

    DeviceEventEmitter.emit('gasto:actualizado', {
    id: gastoId,
    concepto: concepto.trim(),
    pagador: pagador.trim(),
    pagado: false,
    monto: valor,
    moneda,
    grupo: groupId,
    });

    router.back();
};

const cycle = (arr: string[], value: string, setter: (v: string) => void) => {
    const i = arr.indexOf(value);
    setter(arr[(i + 1) % arr.length]);
};

return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      {/* Header */}
    <View style={s.header}>
        <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [s.iconBtn, pressed && s.iconPressed]}
        hitSlop={10}
        android_ripple={{ color: 'rgba(14,165,164,0.15)', borderless: true }}
        >
        <MaterialCommunityIcons name="arrow-left" size={24} color={INK} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
        <Text style={s.brand}>Reparte+</Text>
        <Text style={s.title}>Editar gasto</Text>
        </View>
        <View style={{ width: 36 }} />
    </View>

      {/* Grupo (solo display rápido) */}
    <Text style={s.label}>Grupo</Text>
    <Pressable style={s.select} disabled>
        <Text style={s.selectText}>Viaje de negocios</Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={INK} />
    </Pressable>

      {/* Pagador */}
    <Text style={s.label}>Pagador</Text>
    <Pressable
        onPress={() => cycle(pagadores, pagador, setPagador)}
        style={({ pressed }) => [s.select, pressed && s.selectPressed]}
        android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
    >
        <Text style={s.selectText}>{pagador}</Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={INK} />
    </Pressable>

      {/* Gasto */}
    <Text style={s.label}>Gasto</Text>
    <TextInput
        value={concepto}
        onChangeText={setConcepto}
        placeholder="Ej. Almuerzo"
        placeholderTextColor="#9AA3AF"
        style={s.input}
    />

      {/* Moneda */}
    <Text style={s.label}>Moneda</Text>
    <Pressable
        onPress={() => cycle(monedas, moneda, setMoneda)}
        style={({ pressed }) => [s.select, pressed && s.selectPressed]}
        android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
    >
        <Text style={s.selectText}>{moneda}</Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={INK} />
    </Pressable>

      {/* Total + cámara */}
    <Text style={s.label}>Total de gasto</Text>
    <View style={s.amountRow}>
        <TextInput
        value={monto}
        onChangeText={setMonto}
        placeholder="0"
        placeholderTextColor="#9AA3AF"
        style={[s.input, { flex: 1, marginBottom: 0 }]}
        keyboardType="numeric"
        />
        <Pressable
        onPress={onPickPhoto}
        style={({ pressed }) => [s.camBtn, pressed && s.camBtnPressed]}
        hitSlop={8}
        android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
        >
        <MaterialCommunityIcons name="camera-outline" size={18} color={INK} />
        </Pressable>
    </View>

      {/* Botón Editar (primario teal) */}
    <Pressable
        onPress={onSubmit}
        style={({ pressed }) => [s.primaryBtn, pressed && s.primaryBtnPressed]}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
    >
        <Text style={s.primaryText}>Editar</Text>
    </Pressable>
    </KeyboardAvoidingView>
);
}

const s = StyleSheet.create({
container: { flex: 1, backgroundColor: BG, padding: 20, paddingTop: 40 },

header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
brand: { fontSize: 28, fontWeight: '800', color: PRIMARY, textAlign: 'center' },
title: { fontSize: 18, fontWeight: '700', color: TEXT_MUTED, marginTop: 2 },

label: { fontSize: 14, fontWeight: '700', color: TEXT_MUTED, marginTop: 14, marginBottom: 6 },

input: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: INK,
    marginBottom: 10,
    // sombra suave
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
},

select: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
},
selectPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.985 }] },
selectText: { fontSize: 15, color: INK },

amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },

camBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
},
camBtnPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.97 }] },

iconBtn: { padding: 8, borderRadius: 12 },
iconPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.97 }] },

primaryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
},
primaryBtnPressed: { backgroundColor: '#14B8A6', transform: [{ scale: 0.985 }], shadowOpacity: 0.12, elevation: 3 },
primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
