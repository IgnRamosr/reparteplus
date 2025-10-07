// app/PagarEfectivo.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
StyleSheet, Text, TextInput, View, BackHandler
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/** ====== API client (api_gasto) ====== */
const api = axios.create({
baseURL: 'https://amzcxtvh06.execute-api.us-east-1.amazonaws.com/production',
timeout: 20000,
headers: { 'Content-Type': 'application/json' },
validateStatus: () => true,
});

/** ====== UI palette ====== */
const PRIMARY = '#0EA5A4';
const BG = '#F8FBFC';
const INK = '#0F172A';
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';
const CARD = '#FFFFFF';

/** ====== Types ====== */
type Grupo = { grupo_id: number; nombre: string; pendiente_total?: number };
type Deudor = { participante_id: number; nombre: string; pendiente_total: number };
type GastoPend = { gasto_id: number; descripciongasto: string; pendiente: number };

/** ====== Helpers ====== */
const fmtCLP = (n: number) => new Intl.NumberFormat('es-CL').format(n) + ' CLP';
const onlyDigits = (s: string) => (s || '').replace(/[^\d]/g, '');

export default function PagarEfectivo() {
/** identidad del participante (userId) */
const [userId, setUserId] = useState<number | null>(null);
useEffect(() => {
    (async () => {
    const idStr = await AsyncStorage.getItem('participant_id');
    setUserId(idStr ? Number(idStr) : null);
    })();
}, []);

/** estado de selects */
const [grupos, setGrupos] = useState<Grupo[]>([]);
const [grupoId, setGrupoId] = useState<number | undefined>(undefined);

const [deudores, setDeudores] = useState<Deudor[]>([]);
const [deudorId, setDeudorId] = useState<number | undefined>(undefined);

const [gastos, setGastos] = useState<GastoPend[]>([]);
const [gastoId, setGastoId] = useState<number | undefined>(undefined);

const [monto, setMonto] = useState<string>(''); // editable para abono parcial
const [loading, setLoading] = useState<{ grupos?: boolean; deudores?: boolean; gastos?: boolean; save?: boolean }>({});

/** back físico: volver al menú */
const goBack = useCallback(() => {
    router.replace('/MenuPrincipal');
    return true;
}, []);
useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
}, [goBack]));

/** cargar grupos con deuda del usuario */
const loadGrupos = useCallback(async () => {
    if (!userId) return;
    try {
    setLoading(s => ({ ...s, grupos: true }));
    const resp = await api.get('/grupos-con-deuda', { params: { userId } });
    if (resp.status >= 200 && resp.status < 300) {
        setGrupos(resp.data?.grupos ?? []);
        // reset cadena
        setGrupoId(undefined);
        setDeudores([]); setDeudorId(undefined);
        setGastos([]); setGastoId(undefined);
        setMonto('');
    } else {
        Alert.alert('Error', resp.data?.message || 'No se pudieron cargar los grupos.');
    }
    } catch (e: any) {
    Alert.alert('Error', e?.response?.data?.message || e?.message || 'No se pudieron cargar los grupos.');
    } finally {
    setLoading(s => ({ ...s, grupos: false }));
    }
}, [userId]);

useEffect(() => { loadGrupos(); }, [loadGrupos]);

/** cuando cambia grupo => cargar deudores y reset dependientes */
useEffect(() => {
    const fetchDeudores = async () => {
    if (!grupoId) return;
    try {
        setLoading(s => ({ ...s, deudores: true }));
        // ENDPOINT REAL: /grupo-deudores?grupoId=...
        const resp = await api.get('/grupo-deudores', { params: { grupoId } });
        if (resp.status >= 200 && resp.status < 300) {
        setDeudores(resp.data?.deudores ?? []);
        // reset siguientes
        setDeudorId(undefined);
        setGastos([]); setGastoId(undefined);
        setMonto('');
        } else {
        Alert.alert('Error', resp.data?.message || 'No se pudieron cargar los integrantes con deuda.');
        setDeudores([]); setDeudorId(undefined);
        }
    } catch (e: any) {
        Alert.alert('Error', e?.response?.data?.message || e?.message || 'No se pudieron cargar los integrantes.');
        setDeudores([]); setDeudorId(undefined);
    } finally {
        setLoading(s => ({ ...s, deudores: false }));
    }
    };

    if (!grupoId) {
    setDeudores([]); setDeudorId(undefined);
    setGastos([]); setGastoId(undefined);
    setMonto('');
    return;
    }
    fetchDeudores();
}, [grupoId]);

/** cuando cambia deudor => cargar gastos y reset dependientes */
useEffect(() => {
    const fetchGastos = async () => {
    if (!grupoId || !deudorId) return;
    try {
        setLoading(s => ({ ...s, gastos: true }));
        // ENDPOINT REAL: /grupo-deudor-gastos?grupoId=...&participanteId=...
        const resp = await api.get('/grupo-deudor-gastos', { params: { grupoId, participanteId: deudorId } });
        if (resp.status >= 200 && resp.status < 300) {
        setGastos(resp.data?.gastos ?? []);
        setGastoId(undefined);
        setMonto('');
        } else {
        Alert.alert('Error', resp.data?.message || 'No se pudieron cargar los gastos del integrante.');
        setGastos([]); setGastoId(undefined);
        }
    } catch (e: any) {
        Alert.alert('Error', e?.response?.data?.message || e?.message || 'No se pudieron cargar los gastos.');
        setGastos([]); setGastoId(undefined);
    } finally {
        setLoading(s => ({ ...s, gastos: false }));
    }
    };

    if (!deudorId) {
    setGastos([]); setGastoId(undefined);
    setMonto('');
    return;
    }
    fetchGastos();
}, [grupoId, deudorId]);

/** cuando cambia gasto => autocompletar el pendiente en “monto” */
useEffect(() => {
    if (!gastoId) { setMonto(''); return; }
    const g = gastos.find(x => x.gasto_id === gastoId);
    setMonto(g ? String(g.pendiente) : '');
}, [gastoId, gastos]);

/** submit */
const onPagar = async () => {
    if (!userId) {
    Alert.alert('Sesión', 'No pude identificar al usuario.');
    return;
    }
    if (!grupoId || !deudorId || !gastoId) {
    Alert.alert('Completa el formulario', 'Selecciona Grupo, Integrante y Gasto.');
    return;
    }
    const montoNum = Number(onlyDigits(monto));
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
    Alert.alert('Monto inválido', 'La cantidad a pagar debe ser mayor a 0.');
    return;
    }

    try {
    setLoading(s => ({ ...s, save: true }));
    const resp = await api.post('/pago-efectivo', {
        grupo_id: grupoId,
        gasto_id: gastoId,
        participante_id: deudorId,
        registrado_por: userId,
        monto: montoNum,
        moneda: 'CLP',
        fecha: new Date().toISOString().slice(0, 10),
    });

    if (resp.status >= 200 && resp.status < 300) {
        Alert.alert('Éxito', 'Pago registrado correctamente.');
        router.replace('/MenuPrincipal');
    } else {
        Alert.alert('No se pudo registrar', resp.data?.message || `Estado ${resp.status}`);
    }
    } catch (e: any) {
    Alert.alert('Error', e?.response?.data?.message || e?.message || 'Error registrando el pago.');
    } finally {
    setLoading(s => ({ ...s, save: false }));
    }
};

return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
    {/* Header */}
    <View style={s.header}>
        <Pressable
        onPress={goBack}
        style={({ pressed }) => [s.iconBtn, pressed && s.iconPressed]}
        hitSlop={10}
        android_ripple={{ color: 'rgba(14,165,164,0.15)', borderless: true }}
        >
        <MaterialCommunityIcons name="arrow-left" size={24} color={INK} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
        <Text style={s.brand}>Reparte+</Text>
        <Text style={s.title}>Pagar saldo pendiente</Text>
        </View>
        <View style={{ width: 36 }} />
    </View>

    {/* Grupo */}
    <Text style={s.label}>Grupo</Text>
    <View style={s.pickerWrapper}>
        {loading.grupos ? (
        <View style={[s.iconPressed, { justifyContent: 'center', marginBottom: 0 }]}><ActivityIndicator /></View>
        ) : (
        <Picker
            selectedValue={grupoId}
            onValueChange={(val) => setGrupoId(val || undefined)}
            style={s.picker}
            dropdownIconColor={INK}
        >
            <Picker.Item label="Selecciona un grupo" value={undefined} color={INK} />
            {grupos.map(g => (
            <Picker.Item
                key={g.grupo_id}
                label={g.pendiente_total != null ? `${g.nombre}` : g.nombre}
                value={g.grupo_id}
                color={INK}
            />
            ))}
        </Picker>
        )}
    </View>

    {/* Integrante */}
    <Text style={s.label}>Integrante</Text>
    <View style={s.pickerWrapper}>
        {loading.deudores ? (
        <View style={[s.iconPressed, { justifyContent: 'center', marginBottom: 0 }]}><ActivityIndicator /></View>
        ) : (
        <Picker
            enabled={Boolean(grupoId) && deudores.length > 0}
            selectedValue={deudorId}
            onValueChange={(val) => setDeudorId(val || undefined)}
            style={s.picker}
            dropdownIconColor={INK}
        >
            <Picker.Item label="Selecciona un integrante" value={undefined} color={INK} />
            {deudores.map(d => (
            <Picker.Item
                key={d.participante_id}
                label={`${d.nombre}`}
                value={d.participante_id}
                color={INK}
            />
            ))}
        </Picker>
        )}
    </View>

    {/* Gasto */}
    <Text style={s.label}>Gasto</Text>
    <View style={s.pickerWrapper}>
        {loading.gastos ? (
        <View style={[s.iconPressed, { justifyContent: 'center', marginBottom: 0 }]}><ActivityIndicator /></View>
        ) : (
        <Picker
            enabled={Boolean(deudorId) && gastos.length > 0}
            selectedValue={gastoId}
            onValueChange={(val) => setGastoId(val || undefined)}
            style={s.picker}
            dropdownIconColor={INK}
        >
            <Picker.Item label="Selecciona un gasto" value={undefined} color={INK} />
            {gastos.map(g => (
            <Picker.Item
                key={g.gasto_id}
                label={`${g.descripciongasto} · pendiente ${fmtCLP(Number(g.pendiente))}`}
                value={g.gasto_id}
                color={INK}
            />
            ))}
        </Picker>
        )}
    </View>

    {/* Cantidad a pagar */}
    <Text style={s.label}>Cantidad a pagar</Text>
    <View style={s.amountRow}>
        <TextInput
        value={monto}
        onChangeText={(t) => setMonto(onlyDigits(t))}
        placeholder="0"
        placeholderTextColor="#9AA3AF"
        style={[s.input, { flex: 1, marginBottom: 0 }]}
        keyboardType="numeric"
        inputMode="numeric"
        />
        <View style={s.lockBadge}>
        <Text style={{ color: INK, fontWeight: '700' }}>CLP</Text>
        <MaterialCommunityIcons name="lock-outline" size={16} color={INK} />
        </View>
    </View>

    {/* Botón pagar */}
    <Pressable
        onPress={onPagar}
        disabled={loading.save || !grupoId || !deudorId || !gastoId || !monto}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
        style={({ pressed }) => [
        s.primaryBtn,
        pressed && s.primaryBtnPressed,
        (loading.save || !grupoId || !deudorId || !gastoId || !monto) && { opacity: 0.6 },
        ]}
    >
        <Text style={s.primaryText}>{loading.save ? 'Procesando…' : 'Pagar'}</Text>
    </Pressable>
    </KeyboardAvoidingView>
);
}

/** ====== styles ====== */
const s = StyleSheet.create({
container: { flex: 1, backgroundColor: BG, padding: 20, paddingTop: 40 },
header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
brand:  { fontSize: 28, fontWeight: '800', color: PRIMARY, textAlign: 'center' },
title:  { fontSize: 18, fontWeight: '700', color: TEXT_MUTED, marginTop: 2 },
iconBtn: { padding: 8, borderRadius: 12 },
iconPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.97 }] },

label: { fontSize: 14, fontWeight: '700', color: TEXT_MUTED, marginTop: 14, marginBottom: 6 },

pickerWrapper: {
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14,
    marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1, position: 'relative',
},
picker: { width: '100%', color: INK, paddingVertical: 2, paddingHorizontal: 4, height: Platform.select({ ios: 54, android: 54 }) },

input: {
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, color: INK,
    marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
},

amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    width: 64, height: 44, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD, justifyContent: 'center',
},

primaryBtn: {
    backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', marginTop: 16, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2,
},
primaryBtnPressed: { backgroundColor: '#14B8A6', transform: [{ scale: 0.985 }], shadowOpacity: 0.12, elevation: 3 },
primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
