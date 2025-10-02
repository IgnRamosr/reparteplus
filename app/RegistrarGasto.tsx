// app/RegistrarGasto.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';

type GrupoUI = { id: string; nombre: string };
type Pagador = { id: number; nombre: string };

const api = axios.create({
  baseURL: 'https://amzcxtvh06.execute-api.us-east-1.amazonaws.com/production',
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
  const groupIdParam = Array.isArray(grupo) ? grupo[0] : grupo ?? '';

  // participante logueado
  const [participanteId, setParticipanteId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const id = await AsyncStorage.getItem('participant_id'); // guarda esto al iniciar sesión
        if (id) setParticipanteId(id);
      } catch {}
    })();
  }, []);

  // Pagadores (ejemplo). Reemplaza ids por los reales si ya los tienes.
  const pagadores: Pagador[] = useMemo(
    () => [
      { id: 1, nombre: 'Luis Gonzalez' },
      { id: 2, nombre: 'Ignacio Ramos' },
      { id: 3, nombre: 'Sebastián Tapia' },
    ],
    []
  );
  const [pagadorId, setPagadorId] = useState<number>(pagadores[0].id);

  const [concepto, setConcepto] = useState('Bencina');
  const moneda: string = 'CLP';
  const [monto, setMonto] = useState('60000');

  // Estado de grupos (cuando no viene por URL)
  const [grupos, setGrupos] = useState<GrupoUI[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string | undefined>(groupIdParam || undefined);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ====== FOTO (cámara o galería) ======
  const [fotoUri, setFotoUri] = useState<string | null>(null);

  const pedirPermisoGaleria = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert('Permiso requerido', 'Necesitas permiso para acceder a tus fotos.');
      return false;
    }
    return true;
  };

  const pedirPermisoCamara = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert('Permiso requerido', 'Necesitas permiso para usar la cámara.');
      return false;
    }
    return true;
  };

  const pickFromGallery = async () => {
    const ok = await pedirPermisoGaleria();
    if (!ok) return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!res.canceled) {
      setFotoUri(res.assets[0].uri);
    }
  };

  const pickFromCamera = async () => {
    const ok = await pedirPermisoCamara();
    if (!ok) return;

    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!res.canceled) {
      setFotoUri(res.assets[0].uri);
    }
  };

  // Abre opciones: Cámara o Galería
  const onPickPhoto = () => {
    Alert.alert(
      'Adjuntar comprobante',
      '¿Cómo quieres agregar la imagen?',
      [
        { text: 'Tomar foto', onPress: pickFromCamera },
        { text: 'Elegir de galería', onPress: pickFromGallery },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  // --------- CARGA DE GRUPOS DESDE API (si no vino por param) ----------
  const fetchGrupos = useCallback(async () => {
    if (groupIdParam) return;      // ya tenemos grupo por la URL
    if (!participanteId) return;   // si necesitas el participante para pedir grupos

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

  // --------- SUBMIT: ENVÍA GASTO A LA API ----------
  const onSubmit = async () => {
    const grupoFinal = groupIdParam || selectedGrupoId || '';
    const montoStr = parseMonto(monto);
    const descripcion = (concepto || '').trim();

    if (!grupoFinal) {
      Alert.alert('Revisa el formulario', 'Selecciona un grupo.');
      return;
    }
    if (!descripcion || !montoStr) {
      Alert.alert('Revisa el formulario', '¡Completa los campos vacíos!');
      return;
    }

    // Si ya guardas el id real del participante logueado en AsyncStorage, se usará acá
    const participante_id = (participanteId ?? '1').toString();

    const payload = {
      grupo_id: String(grupoFinal),
      participante_id,                         // quien registra
      participantegasto_id: String(pagadorId), // a nombre de quién va el gasto
      descripciongasto: descripcion,
      moneda: 'CLP',
      monto: montoStr,
      fecha_registro: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
      // NOTA: fotoUri queda lista para adjuntar cuando conectes tu API/S3
    };

    try {
      setSubmitting(true);
      const resp = await api.post('/gasto', payload); // <- singular
      if (resp.status >= 200 && resp.status < 300) {
        DeviceEventEmitter.emit('gasto:creado', payload);
        router.back();
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

  // ---------- UI ----------
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
          <Text style={s.title}>Registrar gasto</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Grupo (solo si no vino por URL) */}
      {!groupIdParam && (
        <>
          <Text style={s.label}>Grupo</Text>
          {loadingGrupos ? (
            <View style={[s.select, { justifyContent: 'center' }]}>
              <ActivityIndicator />
            </View>
          ) : (
            <Pressable
              disabled={grupos.length === 0}
              onPress={() => {
                if (grupos.length === 0) return;
                const ids = grupos.map((g) => g.id);
                const curr = selectedGrupoId ?? ids[0];
                const next = ids[(ids.indexOf(curr) + 1) % ids.length];
                setSelectedGrupoId(next);
              }}
              android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
              style={({ pressed }) => [s.select, pressed && s.selectPressed, grupos.length === 0 && { opacity: 0.6 }]}
            >
              <Text style={s.selectText}>
                {grupos.length === 0
                  ? 'Sin grupos disponibles'
                  : grupos.find((g) => g.id === selectedGrupoId)?.nombre ?? 'Selecciona un grupo'}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color={INK} />
            </Pressable>
          )}
        </>
      )}

      {/* Pagador (Picker) */}
      <Text style={s.label}>Pagador</Text>
      <View style={s.pickerWrapper}>
        <Picker
          selectedValue={pagadorId}
          onValueChange={(val) => setPagadorId(Number(val))}
          style={s.picker}
          dropdownIconColor={INK}
        >
          {pagadores.map((p) => (
            <Picker.Item key={p.id} label={p.nombre} value={p.id} color={INK} />
          ))}
        </Picker>
        <MaterialCommunityIcons name="chevron-down" size={18} color={INK} style={s.pickerChevron} />
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

        {!!fotoUri && (
          <View style={s.thumbWrap}>
            <Image source={{ uri: fotoUri }} style={s.thumb} />
            <Pressable
              onPress={() => setFotoUri(null)}
              style={({ pressed }) => [s.removeBtn, pressed && { opacity: 0.8 }]}
              hitSlop={6}
            >
              <MaterialCommunityIcons name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        )}
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
  picker: { width: '100%', color: INK, paddingVertical: 2, paddingHorizontal: 4 },
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
  // Miniatura y botón eliminar
  thumbWrap: { position: 'relative' },
  thumb: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: BORDER },
  removeBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
  },
});
