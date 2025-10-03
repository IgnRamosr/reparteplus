// app/RegistrarGasto.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  ActivityIndicator,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  BackHandler,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

type GrupoUI = { id: string; nombre: string };
type Participante = { participante_id: number; nombre: string; correo?: string | null };

const api = axios.create({
  baseURL: 'https://amzcxtvh06.execute-api.us-east-1.amazonaws.com/production',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true,
});

const api2 = axios.create({
  baseURL: 'https://ee61hfpl8e.execute-api.us-east-1.amazonaws.com/production',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true,
});

// ====== PALETA LedgerTeal ======
const PRIMARY = '#0EA5A4';
const BG = '#F8FBFC';
const INK = '#0F172A';
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';
const CARD = '#FFFFFF';

// helper: limpia el monto (soporta "10.000", "10,000", etc.)
const parseMonto = (s: string) =>
  String(s ?? '')
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/[^\d]/g, '');

export default function RegistrarGasto() {
  const { grupo } = useLocalSearchParams<{ grupo?: string | string[] }>();
  const groupIdParam = Array.isArray(grupo) ? grupo[0] : (grupo ?? '');

  // ===== Back a /grupos/[id] con refresh =====
  const goBackToGroup = useCallback(() => {
    const gid = String(groupIdParam || selectedGrupoId || '');
    if (gid) {
      router.replace({
        pathname: '/DetalleGrupo',
        params: { id: gid, _refresh: Date.now().toString() },
      });
      return true;
    }
    router.back();
    return true;
  }, [groupIdParam]); // selectedGrupoId se define más abajo; TS lo aceptará por hoisting de funciones

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', goBackToGroup);
      return () => sub.remove();
    }, [goBackToGroup])
  );

  // participante logueado
  const [participanteId, setParticipanteId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const id = await AsyncStorage.getItem('participant_id');
        if (id) setParticipanteId(id);
      } catch {}
    })();
  }, []);

  // ====== Participantes (pagadores) por grupo — REAL desde API ======
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);
  const [pagadorId, setPagadorId] = useState<number | undefined>(undefined);

  // ====== Estado de grupos (cuando no viene por URL) ======
  const [grupos, setGrupos] = useState<GrupoUI[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string | undefined>(groupIdParam || undefined);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onPickPhoto = () => {
    Alert.alert('En construcción', 'Adjuntar foto/boleta se habilitará más adelante.');
  };

  // --------- CARGA DE GRUPOS DESDE API (si no vino por param) ----------
  const fetchGrupos = useCallback(async () => {
    if (groupIdParam) return;
    if (!participanteId) return;

    try {
      setLoadingGrupos(true);
      const resp = await api.post('/grupos', { id: participanteId, tipo: 'grupo' });

      if (resp.status >= 200 && resp.status < 300) {
        const resultados: any[] = resp.data?.resultados ?? [];
        const mapped: GrupoUI[] = resultados
          .map((item: any, idx: number) => {
            const nombre = item?.grupo ?? '';
            const gid = item?.grupo_id ?? `row-${idx}`;
            if (!nombre) return null;
            return { id: String(gid), nombre: String(nombre) };
          })
          .filter(Boolean) as GrupoUI[];

        setGrupos(mapped);
        if (mapped.length > 0) setSelectedGrupoId(mapped[0].id);
      } else {
        Alert.alert('Error', `(${resp.status}) ${resp.data?.message ?? 'No se pudieron cargar los grupos.'}`);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'No se pudieron cargar los grupos.';
      Alert.alert('Error', msg);
    } finally {
      setLoadingGrupos(false);
    }
  }, [groupIdParam, participanteId]);

  useEffect(() => { fetchGrupos(); }, [fetchGrupos]);

  // --------- CARGA DE PARTICIPANTES DEL GRUPO SELECCIONADO ----------
  const grupoActual = groupIdParam || selectedGrupoId || '';
  const fetchParticipantes = useCallback(async (grupoId: string) => {
    if (!grupoId) {
      setParticipantes([]);
      setPagadorId(undefined);
      return;
    }
    try {
      setLoadingParticipantes(true);
      const resp = await api2.get('/grupo-miembros', { params: { grupoId } });

      if (resp.status >= 200 && resp.status < 300) {
        const arr: any[] = resp.data?.resultados ?? [];
        const mapped: Participante[] = arr.map((r) => ({
          participante_id: Number(r.participante_id),
          nombre: String(r.nombre || r.nombre_participante || '—'),
          correo: r.correo ?? null,
        }));
        setParticipantes(mapped);
        if (mapped.length > 0 && !pagadorId) {
          setPagadorId(mapped[0].participante_id);
        }
      } else {
        Alert.alert('Error', `(${resp.status}) ${resp.data?.message ?? 'No se pudieron cargar los participantes.'}`);
        setParticipantes([]);
        setPagadorId(undefined);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'No se pudieron cargar los participantes.';
      Alert.alert('Error', msg);
      setParticipantes([]);
      setPagadorId(undefined);
    } finally {
      setLoadingParticipantes(false);
    }
  }, []); // sin dependencias

  useEffect(() => {
    fetchParticipantes(String(grupoActual));
  }, [grupoActual, fetchParticipantes]);

  // ====== UI ======
  const [concepto, setConcepto] = useState('');
  const moneda: string = 'CLP';
  const [monto, setMonto] = useState('');

  // --------- SUBMIT: ENVÍA GASTO Y VUELVE A /grupos/[id] ----------
  const onSubmit = async () => {
    const grupoFinal = groupIdParam || selectedGrupoId || '';
    const montoStr = parseMonto(monto);
    const descripcion = (concepto || '').trim();

    if (!grupoFinal) {
      Alert.alert('Revisa el formulario', 'Selecciona un grupo.');
      return;
    }
    if (!pagadorId) {
      Alert.alert('Revisa el formulario', 'Selecciona el pagador.');
      return;
    }
    if (!descripcion || !montoStr) {
      Alert.alert('Revisa el formulario', '¡Completa los campos vacíos!');
      return;
    }

    const participante_id = (participanteId ?? '1').toString();

    const payload = {
      grupo_id: String(grupoFinal),
      participante_id,
      participantegasto_id: String(pagadorId),
      descripciongasto: descripcion,
      moneda: 'CLP',
      monto: montoStr,
      fecha_registro: new Date().toISOString().slice(0, 10),
    };

    try {
      if (submitting) return;
      setSubmitting(true);
      const resp = await api.post('/gasto', payload);

      if (resp.status >= 200 && resp.status < 300) {
        DeviceEventEmitter.emit('gasto:creado', {
          grupo_id: Number(grupoFinal),
          concepto: descripcion,
          pagador: participantes.find(p => p.participante_id === pagadorId)?.nombre ?? '—',
          pagado: false,
          monto: Number(montoStr),
          moneda: 'CLP',
        });

        router.replace({
          pathname: '/DetalleGrupo',
          params: { id: String(grupoFinal), _refresh: Date.now().toString() },
        });
      } else {
        const msg = resp.data?.message || `La API respondió con estado ${resp.status}.`;
        Alert.alert('No se pudo registrar', msg);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Error enviando el gasto.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={goBackToGroup}
          style={({ pressed }) => [s.iconBtn, pressed && s.iconPressed]}
          hitSlop={10}
          android_ripple={{ color: 'rgba(14,165,164,0.15)', borderless: true }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={INK} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={s.brand}>Reparte+</Text>
          <Text style={s.title}>Registrar gasto</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Pagador (Picker con participantes reales) */}
      <Text style={s.label}>Pagador</Text>
      <View style={s.pickerWrapper}>
        {loadingParticipantes ? (
          <View style={[s.select, { justifyContent: 'center', marginBottom: 0 }]}>
            <ActivityIndicator />
          </View>
        ) : (
          <Picker
            enabled={participantes.length > 0}
            selectedValue={pagadorId}
            onValueChange={(val) => setPagadorId(Number(val))}
            style={s.picker}
            dropdownIconColor={INK}
          >
            {participantes.length === 0 ? (
              <Picker.Item label="Sin participantes" value={undefined} color={INK} />
            ) : (
              participantes.map((p) => (
                <Picker.Item
                  key={p.participante_id}
                  label={p.nombre}
                  value={p.participante_id}
                  color={INK}
                />
              ))
            )}
          </Picker>
        )}
      </View>

      {/* Gasto */}
      <Text style={s.label}>Gasto</Text>
      <TextInput
        value={concepto}
        onChangeText={setConcepto}
        placeholder="Ej. Almuerzo"
        placeholderTextColor="#9AA3AF"
        style={s.input}
      />

      {/* Moneda (fija) */}
      <Text style={s.label}>Moneda</Text>
      <View style={s.select}>
        <Text style={s.selectText}>{moneda}</Text>
        <MaterialCommunityIcons name="lock-outline" size={18} color={INK} />
      </View>

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
          inputMode="numeric"
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

      {/* Botón Registrar */}
      <Pressable
        onPress={onSubmit}
        disabled={submitting}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
        style={({ pressed }) => [
          s.primaryBtn,
          pressed && s.primaryBtnPressed,
          submitting && { opacity: 0.6 },
        ]}
      >
        <Text style={s.primaryText}>{submitting ? 'Guardando…' : 'Registrar gasto'}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 20, paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  brand:  { fontSize: 28, fontWeight: '800', color: PRIMARY, textAlign: 'center' },
  title:  { fontSize: 18, fontWeight: '700', color: TEXT_MUTED, marginTop: 2 },
  label: { fontSize: 14, fontWeight: '700', color: TEXT_MUTED, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, color: INK,
    marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  select: {
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  selectPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.985 }] },
  selectText: { fontSize: 15, color: INK },
  pickerWrapper: {
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14,
    marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1, position: 'relative',
  },
  picker: { width: '100%', color: INK, paddingVertical: 2, paddingHorizontal: 4, height: Platform.select({ ios: 54, android: 54 }) },
  pickerChevron: { position: 'absolute', right: 12, top: 14, opacity: 0.6, pointerEvents: 'none' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  camBtn: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  camBtnPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.97 }] },
  iconBtn: { padding: 8, borderRadius: 12 },
  iconPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.97 }] },
  primaryBtn: {
    backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', marginTop: 16, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  primaryBtnPressed: { backgroundColor: '#14B8A6', transform: [{ scale: 0.985 }], shadowOpacity: 0.12, elevation: 3 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
