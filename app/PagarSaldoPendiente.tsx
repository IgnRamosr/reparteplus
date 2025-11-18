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

/** ====== Types (ajustados a liquidación) ====== */
type Grupo = {
  grupo_id: number;
  nombre: string;
  pendiente_total_base_minima?: number; // puede venir del endpoint
};
type Deudor = {
  participante_id: number;
  nombre: string;
  asignado_base_minima: number;
  pagado_base_minima: number;
  saldo_base_minima: number;
};
type ResumenDeudor = {
  moneda_base: string;
  asignado_base_minima: number;
  pagado_base_minima: number;
  saldo_base_minima: number;
};

/** ====== Helpers ====== */
const onlyDigits = (s: string) => (s || '').replace(/[^\d]/g, '');
const fmtMonedaVisible = (n: number, moneda: string) =>
  new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(n) + ` ${moneda}`;

/**
 * Como en CLP no hay decimales visibles, y en tu UI ingresas “enteros”,
 * mostramos y editamos el número tal cual llega del backend (unidades mínimas).
 * Si más adelante usas USD/EUR, podrías agregar formateo con decimales visibles.
 */
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

  /** resumen de liquidación del deudor seleccionado */
  const [resumen, setResumen] = useState<ResumenDeudor | null>(null);

  /** formulario */
  const [monto, setMonto] = useState<string>(''); // abono parcial (en unidades mínimas de la moneda_base)
  const [loading, setLoading] = useState<{ grupos?: boolean; deudores?: boolean; resumen?: boolean; save?: boolean }>({});

  /** back físico: volver al menú */
  const goBack = useCallback(() => {
    router.replace('/MenuPrincipal');
    return true;
  }, []);
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  }, [goBack]));

  /** cargar grupos del dueño con deuda (usa liquidación) */
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
        setResumen(null);
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
        const resp = await api.get('/grupo-deudores', { params: { grupoId } });
        if (resp.status >= 200 && resp.status < 300) {
          setDeudores(resp.data?.deudores ?? []);
          setDeudorId(undefined);
          setResumen(null);
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
      setResumen(null);
      setMonto('');
      return;
    }
    fetchDeudores();
  }, [grupoId]);

  /** cuando cambia deudor => cargar resumen de su liquidación y autocompletar monto con el saldo */
  useEffect(() => {
    const fetchResumen = async () => {
      if (!grupoId || !deudorId) return;
      try {
        setLoading(s => ({ ...s, resumen: true }));
        const resp = await api.get('/grupo-deudor-gastos', { params: { grupoId, participanteId: deudorId } });
        if (resp.status >= 200 && resp.status < 300) {
          // ahora la API devuelve { resumen: { moneda_base, asignado_base_minima, pagado_base_minima, saldo_base_minima } }
          const r: ResumenDeudor | undefined = resp.data?.resumen;
          setResumen(r ?? null);
          setMonto(r ? String(r.saldo_base_minima) : '');
        } else {
          Alert.alert('Error', resp.data?.message || 'No se pudo cargar el resumen.');
          setResumen(null);
          setMonto('');
        }
      } catch (e: any) {
        Alert.alert('Error', e?.response?.data?.message || e?.message || 'No se pudo cargar el resumen.');
        setResumen(null);
        setMonto('');
      } finally {
        setLoading(s => ({ ...s, resumen: false }));
      }
    };

    if (!deudorId) {
      setResumen(null);
      setMonto('');
      return;
    }
    fetchResumen();
  }, [grupoId, deudorId]);

  /** submit (paga contra liquidación) */
  const onPagar = async () => {
    if (!userId) {
      Alert.alert('Sesión', 'No pude identificar al usuario.');
      return;
    }
    if (!grupoId || !deudorId) {
      Alert.alert('Completa el formulario', 'Selecciona Grupo e Integrante.');
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
        participante_id: deudorId,
        registrado_por: userId,
        monto: montoNum, // unidades mínimas de la moneda_base
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

  /** moneda UI (segura) */
  const monedaUI = resumen?.moneda_base || 'CLP';

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
                label={g.pendiente_total_base_minima != null
                  ? `${g.nombre}`
                  : g.nombre}
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

      {/* Resumen de deuda (liquidación) */}
      {loading.resumen ? (
        <View style={[s.iconPressed, { justifyContent: 'center', height: 64 }]}><ActivityIndicator /></View>
      ) : resumen ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Resumen en {monedaUI}</Text>
          <View style={s.row}>
            <Text style={[s.rowKey, { fontWeight: '800' }]}>Saldo pendiente</Text>
            <Text style={[s.rowVal, { fontWeight: '800', color: PRIMARY }]}>
              {fmtMonedaVisible(resumen.saldo_base_minima, monedaUI)}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Cantidad a pagar */}
      <Text style={s.label}>Cantidad a Pagar</Text>
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
          <Text style={{ color: INK, fontWeight: '700' }}>{monedaUI}</Text>
          <MaterialCommunityIcons name="lock-outline" size={16} color={INK} />
        </View>
      </View>

      {/* Botón pagar */}
      <Pressable
        onPress={onPagar}
        disabled={loading.save || !grupoId || !deudorId || !monto}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
        style={({ pressed }) => [
          s.primaryBtn,
          pressed && s.primaryBtnPressed,
          (loading.save || !grupoId || !deudorId || !monto) && { opacity: 0.6 },
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

  card: {
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 16,
    padding: 12, marginTop: 8, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  cardTitle: { color: TEXT_MUTED, fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  rowKey: { color: TEXT_MUTED, fontWeight: '700' },
  rowVal: { color: INK, fontWeight: '700' },

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    width: 72, height: 44, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
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
