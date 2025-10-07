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
  Image,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';


type Pagador = { id: number; nombre: string };

// ====== PALETA LedgerTeal ======
const PRIMARY = '#0EA5A4';
const BG = '#F8FBFC';
const INK = '#0F172A';
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';
const CARD = '#FFFFFF';
const DANGER = '#B91C1C';

// ====== HELPERS ======
const parseMonto = (s: string) =>
  String(s ?? '')
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/[^\d]/g, '');

// ------ Helpers de imagen ------
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

async function getFileSizeBytes(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists) throw new Error('Archivo temporal no existe: ' + uri);
  return (info as any).size ?? 0;
}

async function shrinkImageToLimit(
  uri: string,
  extHint?: string | null
): Promise<{ uri: string; contentType: string; ext: string }> {
  const firstFormat =
    extHint?.toLowerCase() === 'heic'
      ? ImageManipulator.SaveFormat.JPEG
      : extHint?.toLowerCase() === 'png'
      ? ImageManipulator.SaveFormat.PNG
      : ImageManipulator.SaveFormat.JPEG;

  // redimensionar a 1600px para bajar peso
  let result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600, height: 1600 } }],
    { compress: 0.9, format: firstFormat }
  );

  // comprimir en bucle hasta <5MB
  let quality = 0.85;
  let sizeBytes = await getFileSizeBytes(result.uri);
  while (sizeBytes > MAX_BYTES && quality >= 0.3) {
    result = await ImageManipulator.manipulateAsync(
      result.uri,
      [],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    sizeBytes = await getFileSizeBytes(result.uri);
    quality -= 0.15;
  }

  if (sizeBytes > MAX_BYTES) {
    throw new Error(`No se pudo comprimir < 5MB (quedó en ${sizeBytes} bytes).`);
  }

  const becameJpeg = firstFormat === ImageManipulator.SaveFormat.JPEG || quality < 0.85;
  const ext = becameJpeg ? 'jpg' : (extHint?.toLowerCase() || 'jpg');
  const contentType = becameJpeg ? 'image/jpeg' : (ext === 'png' ? 'image/png' : 'image/jpeg');

  console.log('INFO imagen final =>', { bytes: sizeBytes, contentType, ext, uri: result.uri });
  return { uri: result.uri, contentType, ext };
}
// --------------------------------

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

// ⛏️ ENDPOINTS de escaneo
const RAW_PRESIGNED_URL_ENDPOINT =
  'https://76qqofsw26.execute-api.us-east-1.amazonaws.com/production/presigned-url'; // POST recomendado
const PROCESS_IMAGE_ENDPOINT =
  'https://pki31c24na.execute-api.us-east-1.amazonaws.com/production/imagen'; // POST { key }

const PRESIGNED_API_KEY = process.env.EXPO_PUBLIC_PRESIGNED_API_KEY || '';

// ====== Presign helpers ======
type PresignedResp = { uploadUrl: string; key?: string; expectedContentType?: string; message?: string };

async function getPresignedPreferred(endpoint: string, contentType: string, extension: string) {
  const res = await fetch(endpoint.replace(/\/+$/,''), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(PRESIGNED_API_KEY ? { 'x-api-key': PRESIGNED_API_KEY } : {}),
    },
    body: JSON.stringify({ contentType, extension }),
  });
  if (!res.ok) throw new Error(`Presigned ${res.status}: ${await res.text()}`);
  return (await res.json()) as PresignedResp;
}

async function fetchPresignedWithTrials(baseUrl: string): Promise<PresignedResp> {
  const urls = [baseUrl.replace(/\/+$/, ''), baseUrl.replace(/\/+$/, '') + '/'];
  const methods: Array<'GET' | 'POST'> = ['POST', 'GET'];
  const apiKeyOptions = PRESIGNED_API_KEY ? [true, false] : [false];
  const errors: string[] = [];

  for (const url of urls) {
    for (const method of methods) {
      for (const withKey of apiKeyOptions) {
        try {
          const headers: Record<string, string> = {};
          if (withKey && PRESIGNED_API_KEY) headers['x-api-key'] = PRESIGNED_API_KEY;
          const res = await fetch(url, { method, headers });
          const text = await res.text();
          if (!res.ok) { errors.push(`${method} ${withKey ? '[x-api-key]' : ''} ${url} -> ${res.status} ${text}`); continue; }
          let parsed: PresignedResp;
          try { parsed = JSON.parse(text) as PresignedResp; } catch { errors.push(`${method} ${withKey ? '[x-api-key]' : ''} ${url} -> 200 pero no JSON`); continue; }
          if (parsed?.uploadUrl) return parsed;
          errors.push(`${method} ${withKey ? '[x-api-key]' : ''} ${url} -> 200 pero falta uploadUrl`);
        } catch (e: any) {
          errors.push(`${method} ${withKey ? '[x-api-key]' : ''} ${url} -> error ${e?.message || e}`);
        }
      }
    }
  }
  throw new Error(`No se pudo obtener presigned URL.\nIntentos:\n- ${errors.join('\n- ')}`);
}

// ===================== Componente principal =====================
export default function RegistrarGasto() {
  const { grupo } = useLocalSearchParams<{ grupo?: string | string[] }>();
  const groupIdParam = Array.isArray(grupo) ? grupo[0] : grupo ?? '';

  // ===== Back a /DetalleGrupo con refresh =====
  const goBackToGroup = useCallback(() => {
    const gid = String(groupIdParam || selectedGrupoId || '');
    if (gid) {
      router.replace({ pathname: '/DetalleGrupo', params: { id: gid, _refresh: Date.now().toString() } });
      return true;
    }
    router.back();
    return true;
  }, [groupIdParam]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', goBackToGroup);
      return () => sub.remove();
    }, [goBackToGroup])
  );

  // ===== participante logueado
  const [participanteId, setParticipanteId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const id = await AsyncStorage.getItem('participant_id');
        if (id) setParticipanteId(id);
      } catch {}
    })();
  }, []);

  // ====== Participantes y grupos ======
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);
  const [pagadorId, setPagadorId] = useState<number | undefined>(undefined);

  const [grupos, setGrupos] = useState<GrupoUI[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string | undefined>(groupIdParam || undefined);
  const [loadingGrupos, setLoadingGrupos] = useState(false);

  // ====== UI Form ======
  const [concepto, setConcepto] = useState('');
  const moneda: string = 'CLP';
  const [monto, setMonto] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ====== Cámara + Upload a S3 ======
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pickedMime, setPickedMime] = useState<string | null>(null);
  const [pickedExt, setPickedExt] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  // Validación de boleta
  const [isReceiptValid, setIsReceiptValid] = useState<boolean>(false);
  const [receiptWarning, setReceiptWarning] = useState<string>('');

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permisos', 'Se requiere permiso para usar la cámara.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1 });
    if (!result.canceled) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      const mime = asset.mimeType ?? null; // image/heic, image/png, image/jpeg
      const ext =
        asset.fileName?.split('.').pop()?.toLowerCase() ||
        mime?.split('/').pop()?.toLowerCase() ||
        (asset.uri.toLowerCase().endsWith('.png') ? 'png' : 'jpg');
      setPickedMime(mime);
      setPickedExt(ext);
      setScanResult(null);
      setIsReceiptValid(false);
      setReceiptWarning('');
    }
  }, []);

  const uploadAndProcess = useCallback(async () => {
    if (!imageUri) { Alert.alert('Falta la foto', 'Primero toma una foto de la boleta.'); return; }

    try {
      setScanLoading(true);
      setScanResult(null);
      setIsReceiptValid(false);
      setReceiptWarning('');

      // 1) Comprimir/Redimensionar <5MB
      const shrunk = await shrinkImageToLimit(imageUri, pickedExt);
      const uploadUri = shrunk.uri;
      const wantContentType = shrunk.contentType;
      const effectiveExt = shrunk.ext;

      // 2) Presigned preferido + fallback
      let presign: PresignedResp;
      try {
        presign = await getPresignedPreferred(RAW_PRESIGNED_URL_ENDPOINT, wantContentType, effectiveExt || 'jpg');
      } catch (e) {
        console.warn('getPresignedPreferred falló, usando trials...', e);
        presign = await fetchPresignedWithTrials(RAW_PRESIGNED_URL_ENDPOINT);
      }

      const { uploadUrl, expectedContentType } = presign;
      let { key } = presign;

      if (!key) {
        const u = new URL(uploadUrl);
        key = u.searchParams.get('key') || decodeURIComponent(u.pathname.split('/').slice(2).join('/'));
      }
      if (!uploadUrl || !key) throw new Error('El endpoint de presign no entregó uploadUrl o key.');

      // 3) Subida a S3
      const contentType = expectedContentType || wantContentType;
      const put = await FileSystem.uploadAsync(uploadUrl, uploadUri, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': contentType },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });
      console.log('PUT to S3 =>', put.status, (put.body || '').slice(0, 200));
      if (put.status !== 200) throw new Error(`Fallo subida S3: ${put.status}`);

      // 4) Solo nombre del archivo para tu API
      const keyOnlyName = (key.split('/').pop() || key).trim();
      console.log('DEBUG subir/leer =>', { keyEnviadoALeer: keyOnlyName, keySubido: key });

      // 5) Procesar
      const processRes = await fetch(PROCESS_IMAGE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: keyOnlyName,
          content_type: contentType,
          extension: effectiveExt || 'jpg'
        }),
      });
      const dataText = await processRes.text();
      console.log('PROCESS =>', processRes.status, dataText);
      if (!processRes.ok) throw new Error(`Process: ${processRes.status} ${dataText}`);

      // 6) Autollenado y VALIDACIÓN de boleta
      const data = JSON.parse(dataText);
      const parsed = data?.parsed ?? data;

      const textoPlano = JSON.stringify(parsed).toLowerCase();
      const tieneDatosValidos =
        (parsed?.vendor && parsed?.total) ||
        textoPlano.includes('boleta') ||
        textoPlano.includes('factura') ||
        textoPlano.includes('subtotal') ||
        textoPlano.includes('total');

      if (!tieneDatosValidos) {
        const msg = 'La imagen no parece ser una boleta o factura válida. Verifica que sea legible y contenga detalles de compra.';
        Alert.alert('Verifica la imagen', msg);
        setReceiptWarning(msg);
        setScanResult(null);
        setMonto('');
        setConcepto('');
        setIsReceiptValid(false);
        return;
      }

      setScanResult(parsed);
      setIsReceiptValid(true);
      setReceiptWarning('');

      // Normalizar CLP para el input (solo dígitos)
      const totalStr = parsed?.total != null ? String(parsed.total) : '';
      const montoAuto = totalStr.replace(/[^\d]/g, '');
      if (montoAuto) setMonto(montoAuto);

      if (parsed?.vendor) setConcepto(String(parsed.vendor));
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.message || 'Error procesando la imagen.');
      setIsReceiptValid(false);
      setReceiptWarning('Ocurrió un error procesando la imagen.');
    } finally {
      setScanLoading(false);
    }
  }, [imageUri, pickedExt]);

  // --------- CARGA DE GRUPOS DESDE API ----------
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
    } finally { setLoadingGrupos(false); }
  }, [groupIdParam, participanteId]);

  useEffect(() => { fetchGrupos(); }, [fetchGrupos]);

  // --------- CARGA DE PARTICIPANTES ----------
  const grupoActual = groupIdParam || selectedGrupoId || '';
  const fetchParticipantes = useCallback(async (grupoId: string) => {
    if (!grupoId) { setParticipantes([]); setPagadorId(undefined); return; }
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
        if (mapped.length > 0 && !pagadorId) setPagadorId(mapped[0].participante_id);
      } else {
        Alert.alert('Error', `(${resp.status}) ${resp.data?.message ?? 'No se pudieron cargar los participantes.'}`);
        setParticipantes([]); setPagadorId(undefined);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'No se pudieron cargar los participantes.';
      Alert.alert('Error', msg);
      setParticipantes([]); setPagadorId(undefined);
    } finally { setLoadingParticipantes(false); }
  }, [pagadorId]);

  useEffect(() => { if (grupoActual) fetchParticipantes(String(grupoActual)); }, [grupoActual, fetchParticipantes]);

  // --------- SUBMIT: ENVÍA GASTO ----------
  const onSubmit = useCallback(async () => {
    const grupoFinal = groupIdParam || selectedGrupoId || '';
    const montoStr = parseMonto(monto);
    const descripcion = (concepto || '').trim();

    if (!grupoFinal) { Alert.alert('Revisa el formulario', 'Selecciona un grupo.'); return; }
    if (!pagadorId) { Alert.alert('Revisa el formulario', 'Selecciona el pagador.'); return; }
    if (!descripcion || !montoStr) { Alert.alert('Revisa el formulario', '¡Completa los campos vacíos!'); return; }

    // Si se usó imagen, exigir validación de boleta
    if (imageUri && !isReceiptValid) {
      Alert.alert('No se puede registrar', 'La imagen no fue reconocida como boleta/factura válida. Por favor verifica.');
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
          pagador: participantes.find((p) => p.participante_id === pagadorId)?.nombre ?? '—',
          pagado: false,
          monto: Number(montoStr),
          moneda: 'CLP',
        });

        router.replace({ pathname: '/DetalleGrupo', params: { id: String(grupoFinal), _refresh: Date.now().toString() } });
      } else {
        const msg = resp.data?.message || `La API respondió con estado ${resp.status}.`;
        Alert.alert('No se pudo registrar', msg);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Error enviando el gasto.';
      Alert.alert('Error', msg);
    } finally { setSubmitting(false); }
  }, [groupIdParam, selectedGrupoId, monto, concepto, pagadorId, participanteId, submitting, participantes, imageUri, isReceiptValid]);

  // ====== UI ======
  const disableRegister = submitting || (imageUri && !isReceiptValid);

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}/>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={goBackToGroup} style={({ pressed }) => [s.iconBtn, pressed && s.iconPressed]} hitSlop={10} android_ripple={{ color: 'rgba(14,165,164,0.15)', borderless: true }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={INK} />
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={s.brand}>Reparte+</Text>
            <Text style={s.title}>Registrar gasto</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Pagador */}
        <Text style={s.label}>Pagador</Text>
        <View style={s.pickerWrapper}>
          {loadingParticipantes ? (
            <View style={[s.select, { justifyContent: 'center', marginBottom: 0 }]}><ActivityIndicator /></View>
          ) : (
            <Picker enabled={participantes.length > 0} selectedValue={pagadorId} onValueChange={(val) => setPagadorId(Number(val))} style={s.picker} dropdownIconColor={INK}>
              {participantes.length === 0 ? (
                <Picker.Item label="Sin participantes" value={undefined} color={INK} />
              ) : (
                participantes.map((p) => <Picker.Item key={p.participante_id} label={p.nombre} value={p.participante_id} color={INK} />)
              )}
            </Picker>
          )}
        </View>

        {/* Gasto */}
        <Text style={s.label}>Gasto</Text>
        <TextInput value={concepto} onChangeText={setConcepto} placeholder="Ej. Almuerzo" placeholderTextColor="#9AA3AF" style={s.input} />

        {/* Moneda */}
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
          onPress={takePhoto}
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
  brand: { fontSize: 28, fontWeight: '800', color: PRIMARY, textAlign: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: TEXT_MUTED, marginTop: 2 },
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
  selectText: { fontSize: 15, color: INK },
  pickerWrapper: {
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14,
    marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1, position: 'relative',
  },
  picker: { width: '100%', color: INK, paddingVertical: 2, paddingHorizontal: 4, height: Platform.select({ ios: 54, android: 54 }) },
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
  secondaryBtn: {
    backgroundColor: CARD, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: BORDER, marginBottom: 12
  },
  secondaryBtnPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.985 }] },
  secondaryText: { color: INK, fontSize: 15, fontWeight: '700' },
  scanCard: {
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14,
    padding: 12, marginTop: 6, marginBottom: 4,
  },
  warnCard: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warnText: { color: DANGER, fontSize: 13, flex: 1 },
});
