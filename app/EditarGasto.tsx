// app/EditarGasto.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';

// ===== LedgerTeal palette =====
const PRIMARY = '#0EA5A4'; // teal
const BG = '#F8FBFC';      // casi blanco azulado
const INK = '#0F172A';     // texto principal
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';
const CARD = '#FFFFFF';

// ==== API cliente local ====
const apiGasto = axios.create({
baseURL: 'https://amzcxtvh06.execute-api.us-east-1.amazonaws.com/production',
timeout: 20000,
headers: { 'Content-Type': 'application/json' },
validateStatus: () => true,
});

export default function EditarGasto() {
const { grupo, gasto, nombreGrupo } =
    useLocalSearchParams<{ nombreGrupo?: string | string[];grupo?: string | string[]; gasto?: string | string[] }>();
const groupId = Array.isArray(grupo) ? grupo[0] : grupo ?? '';
const gastoId = Array.isArray(gasto) ? gasto[0] : gasto ?? '';
const nombreGrup = Array.isArray(nombreGrupo) ? nombreGrupo[0] : nombreGrupo ?? '';

  // Estados — solo editables: concepto, moneda, monto
  const [pagador, setPagador] = useState('');      // display (bloqueado)
  const [concepto, setConcepto] = useState('');    // editable -> descripciongasto
  const [moneda, setMoneda] = useState('CLP');     // editable (input simple, bloqueado)
  const [monto, setMonto] = useState('');          // editable (string)

const [cargando, setCargando] = useState<boolean>(false);
const [submitting, setSubmitting] = useState<boolean>(false);

  // --- Helpers ---
const toNumberString = (raw: string) => {
    // permite dígitos y punto, elimina resto
    const cleaned = String(raw ?? '').replace(/[^\d.]/g, '');
    return cleaned;
};

const precargarGasto = useCallback(async () => {
    if (!groupId || !gastoId) return;
    try {
    setCargando(true);
      // No tenemos endpoint /gasto GET individual, así que listamos por grupo y filtramos
    const resp = await apiGasto.get('/gastos', { params: { grupoId: String(groupId) } });
    if (resp.status >= 200 && resp.status < 300) {
        const arr: any[] = resp.data?.resultados ?? resp.data?.gastos ?? [];
        const fila = arr.find(
        (r: any) => String(r.id ?? r.gasto_id) === String(gastoId)
        );
        if (!fila) {
        Alert.alert('Atención', 'No se encontró el gasto solicitado.');
        return;
        }

        // Normaliza campos
        const _concepto = String(fila.concepto ?? fila.descripciongasto ?? '');
        const _moneda   = String(fila.moneda ?? 'CLP');
        const _monto    = String(fila.monto ?? '');
        const _pagador  = String(fila.pagador ?? fila.pagador_nombre ?? '—');

        setConcepto(_concepto);
        setMoneda(_moneda);
        setMonto(_monto);
        setPagador(_pagador);
    } else {
        Alert.alert('Error', `No se pudo cargar el gasto. Código: ${resp.status}`);
    }
    } catch (e: any) {
    Alert.alert('Error', e?.message || 'No se pudo cargar el gasto.');
    } finally {
    setCargando(false);
    }
}, [groupId, gastoId]);

useEffect(() => {
    precargarGasto();
}, [precargarGasto]);

const onSubmit = async () => {
    // Validaciones
    const valorStr = toNumberString(monto);
    const valorNum = Number(valorStr);
    if (!concepto.trim()) {
    Alert.alert('Revisa el formulario', 'Ingresa un nombre de gasto.');
    return;
    }
    if (!pagador.trim()) {
    Alert.alert('Revisa el formulario', 'Falta el pagador.');
    return;
    }
    if (!valorStr || !isFinite(valorNum) || valorNum <= 0) {
    Alert.alert('Revisa el formulario', 'Ingresa un monto válido (> 0).');
    return;
    }
    if (!moneda.trim()) {
    Alert.alert('Revisa el formulario', 'Ingresa una moneda (ej: CLP, USD, EUR).');
    return;
    }

    try {
    setSubmitting(true);

      // PATCH /gasto con body requerido
    const resp = await apiGasto.patch('/gasto', {
        gastoId: Number(gastoId),
        updates: {
        descripciongasto: concepto.trim(),
        moneda: moneda.trim(),
          monto: valorStr, // el backend espera string 
        },
    });

    if (resp.status >= 200 && resp.status < 300) {
        DeviceEventEmitter.emit('gasto:actualizado', {
        id: gastoId,
        concepto: concepto.trim(),
        pagador: pagador.trim(),
        pagado: false,
        monto: valorStr,
        moneda: moneda.trim(),
        grupo: groupId,
        });

        Alert.alert('Éxito', 'Gasto actualizado correctamente.');
        router.back();
    } else {
        Alert.alert('Error', `No se pudo actualizar. Código: ${resp.status}`);
    }
    } catch (e: any) {
    Alert.alert('Error', e?.message || 'No se pudo conectar con el servidor.');
    } finally {
    setSubmitting(false);
    }
};

return (
    <KeyboardAvoidingView
    style={s.container}
    behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
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

      {/* Grupo (solo display) */}
    <Text style={s.label}>Grupo</Text>
    <View style={[s.select, { opacity: 0.7 }]}>
        <Text style={s.selectText}>{nombreGrup || '—'}</Text>
        <MaterialCommunityIcons name="lock" size={16} color={INK} />
    </View>

      {/* Pagador (bloqueado) */}
    <Text style={s.label}>Pagador</Text>
    <TextInput
        value={pagador}
        editable={false}
        selectTextOnFocus={false}
        style={[s.input, { opacity: 0.7 }]}
    />

      {/* Gasto (editable) */}
    <Text style={s.label}>Gasto</Text>
    <TextInput
        value={concepto}
        onChangeText={setConcepto}
        placeholder="Ej. Almuerzo"
        placeholderTextColor="#9AA3AF"
        style={s.input}
    />

      {/* Moneda (editable, sin dropdown) */}
    <Text style={s.label}>Moneda</Text>
    <TextInput
        value={moneda}
        onChangeText={setMoneda}
        placeholder="Ej. CLP"
        editable={false}
        placeholderTextColor="#9AA3AF"
        autoCapitalize="characters"
        style={s.input}
    />

      {/* Total de gasto (editable) */}
    <Text style={s.label}>Total de gasto</Text>
    <TextInput
        value={monto}
        onChangeText={(t) => setMonto(toNumberString(t))}
        placeholder="0"
        placeholderTextColor="#9AA3AF"
        style={[s.input, { marginBottom: 12 }]}
        keyboardType="numeric"
    />

      {/* Botón Editar */}
    <Pressable
        onPress={onSubmit}
        disabled={submitting || cargando}
        style={({ pressed }) => [
        s.primaryBtn,
        pressed && s.primaryBtnPressed,
        (submitting || cargando) && { opacity: 0.6 },
        ]}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
    >
        {submitting ? (
        <ActivityIndicator color="#fff" />
        ) : (
        <Text style={s.primaryText}>Editar</Text>
        )}
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
selectText: { fontSize: 15, color: INK },

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
