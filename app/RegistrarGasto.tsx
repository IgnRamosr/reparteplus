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

const PRIMARY = '#0EA5A4';
const BG = '#F8FBFC';
const INK = '#0F172A';
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';
const CARD = '#FFFFFF';
const DANGER = '#B91C1C';

// Monedas demo
const MONEDAS = [
  { codigo: 'CLP', nombre: 'Peso chileno', decimales: 0 },
  { codigo: 'USD', nombre: 'Dólar estadounidense', decimales: 2 },
  { codigo: 'EUR', nombre: 'Euro', decimales: 2 },
  { codigo: 'ARS', nombre: 'Peso argentino', decimales: 2 },
  { codigo: 'BRL', nombre: 'Real brasileño', decimales: 2 },
  { codigo: 'MXN', nombre: 'Peso mexicano', decimales: 2 },
];

function decimalesDe(codigo: string): number {
  const m = MONEDAS.find(x => x.codigo === codigo);
  return m ? m.decimales : (codigo === 'CLP' ? 0 : 2);
}

/** Normaliza la entrada del monto respetando la cantidad de decimales de la moneda */
function normalizarMontoEntrada(s: string, decimales: number): string {
  let t = String(s ?? '').replace(/[^\d.,]/g, '');
  const lastComma = t.lastIndexOf(',');
  const lastDot   = t.lastIndexOf('.');
  const lastSep   = Math.max(lastComma, lastDot);

  if (lastSep >= 0) {
    const entero = t.slice(0, lastSep).replace(/[^\d]/g, '');
    const frac   = t.slice(lastSep + 1).replace(/[^\d]/g, '');
    const fracLim = decimales > 0 ? frac.slice(0, decimales) : '';
    t = decimales > 0 ? `${entero}.${fracLim}` : entero;
  } else {
    t = t.replace(/[^\d]/g, '');
  }

  if (t.startsWith('0') && !t.startsWith('0.')) {
    t = String(parseInt(t || '0', 10));
  }
  return t;
}

/** Convierte un string de input a número (usa "." como separador decimal) */
function numberFromInput(s: string): number {
  const n = Number(String(s).trim().replace(/\s+/g, '').replace(/\./g, '.').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

const MAX_BYTES = 5 * 1024 * 1024;

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

  let result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600, height: 1600 } }],
    { compress: 0.9, format: firstFormat }
  );

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

  return { uri: result.uri, contentType, ext };
}

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

const RAW_PRESIGNED_URL_ENDPOINT =
  'https://76qqofsw26.execute-api.us-east-1.amazonaws.com/production/presigned-url';
const PROCESS_IMAGE_ENDPOINT =
  'https://pki31c24na.execute-api.us-east-1.amazonaws.com/production/imagen';

const PRESIGNED_API_KEY = process.env.EXPO_PUBLIC_PRESIGNED_API_KEY || '';

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

export default function RegistrarGasto() {
  const { grupo } = useLocalSearchParams<{ grupo?: string | string[] }>();
  const groupIdParam = Array.isArray(grupo) ? grupo[0] : grupo ?? '';

  const [participanteId, setParticipanteId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const id = await AsyncStorage.getItem('participant_id');
        if (id) setParticipanteId(id);
      } catch {}
    })();
  }, []);

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

  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);
  const [pagadorId, setPagadorId] = useState<number | undefined>(undefined);

  const [grupos, setGrupos] = useState<GrupoUI[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string | undefined>(groupIdParam || undefined);
  const [loadingGrupos, setLoadingGrupos] = useState(false);

  const [concepto, setConcepto] = useState('');
  const [monedaSel, setMonedaSel] = useState<string>('CLP');
  const [monto, setMonto] = useState('');
  const [montoError, setMontoError] = useState<string>(''); // <-- error del monto
  const [submitting, setSubmitting] = useState(false);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pickedMime, setPickedMime] = useState<string | null>(null);
  const [pickedExt, setPickedExt] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const [isReceiptValid, setIsReceiptValid] = useState<boolean>(false);
  const [receiptWarning, setReceiptWarning] = useState<string>('');

  const [fechaFocused, setFechaFocused] = useState(false);
  const [fechaValor, setFechaValor] = useState('');

  useEffect(() => {
    if (scanResult?.date && typeof scanResult.date === 'string') {
      setFechaValor(scanResult.date.slice(0, 10));
    }
  }, [scanResult]);

  const pickFromGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permisos', 'Se requiere permiso para acceder a tus fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 1,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      selectionLimit: 1,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      const mime = asset.mimeType ?? null;
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

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permisos', 'Se requiere permiso para usar la cámara.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1 });
    if (!result.canceled) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      const mime = asset.mimeType ?? null;
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

  const removeImage = useCallback(() => {
    setImageUri(null);
    setPickedMime(null);
    setPickedExt(null);
    setScanResult(null);
    setIsReceiptValid(false);
    setReceiptWarning('');
  }, []);

  const uploadAndProcess = useCallback(async () => {
    if (!imageUri) { Alert.alert('Falta la foto', 'Primero toma una foto o elige una imagen de la galería.'); return; }

    try {
      setScanLoading(true);
      setScanResult(null);
      setIsReceiptValid(false);
      setReceiptWarning('');

      const shrunk = await shrinkImageToLimit(imageUri, pickedExt);
      const uploadUri = shrunk.uri;
      const wantContentType = shrunk.contentType;
      const effectiveExt = shrunk.ext;

      let presign: PresignedResp;
      try {
        presign = await getPresignedPreferred(RAW_PRESIGNED_URL_ENDPOINT, wantContentType, effectiveExt || 'jpg');
      } catch (e) {
        presign = await fetchPresignedWithTrials(RAW_PRESIGNED_URL_ENDPOINT);
      }

      const { uploadUrl, expectedContentType } = presign;
      let { key } = presign;

      if (!key) {
        const u = new URL(uploadUrl);
        key = u.searchParams.get('key') || decodeURIComponent(u.pathname.split('/').slice(2).join('/'));
      }
      if (!uploadUrl || !key) throw new Error('El endpoint de presign no entregó uploadUrl o key.');

      const contentType = expectedContentType || wantContentType;
      const put = await FileSystem.uploadAsync(uploadUrl, uploadUri, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': contentType },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });
      if (put.status !== 200) throw new Error(`Fallo subida S3: ${put.status}`);

      const keyOnlyName = (key.split('/').pop() || key).trim();

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
      if (!processRes.ok) throw new Error(`Process: ${processRes.status} ${dataText}`);

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

      const totalStr = parsed?.total != null ? String(parsed.total) : '';
      const montoAuto = totalStr.replace(/[^0-9.,]/g, '');
      if (montoAuto) {
        const normal = normalizarMontoEntrada(montoAuto, decimalesDe(monedaSel));
        setMonto(normal);
        const n = numberFromInput(normal);
        setMontoError(!Number.isFinite(n) || n <= 0 ? 'Ingresa un monto mayor a 0' : '');
      }

      if (parsed?.vendor) setConcepto(String(parsed.vendor));
      if (parsed?.date) setFechaValor(String(parsed.date).slice(0, 10));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error procesando la imagen.');
      setIsReceiptValid(false);
      setReceiptWarning('Ocurrió un error procesando la imagen.');
    } finally {
      setScanLoading(false);
    }
  }, [imageUri, pickedExt, monedaSel]);

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

  const onSubmit = useCallback(async () => {
    const grupoFinal = groupIdParam || selectedGrupoId || '';
    const descripcion = (concepto || '').trim();

    if (!grupoFinal) { Alert.alert('Revisa el formulario', 'Selecciona un grupo.'); return; }
    if (!pagadorId) { Alert.alert('Revisa el formulario', 'Selecciona el pagador.'); return; }
    if (!descripcion || !monto) { Alert.alert('Revisa el formulario', '¡Completa los campos vacíos!'); return; }

    // Validación monto > 0
    const nMonto = numberFromInput(monto);
    if (!Number.isFinite(nMonto) || nMonto <= 0) {
      setMontoError('Ingresa un monto mayor a 0');
      Alert.alert('Monto inválido', 'El total debe ser un número mayor a 0.');
      return;
    }

    if (fechaValor && !/^\d{4}-\d{2}-\d{2}$/.test(fechaValor)) {
      Alert.alert('Fecha inválida', 'Usa el formato aaaa-mm-dd, por ejemplo 2025-10-06.');
      return;
    }

    if (imageUri && !isReceiptValid) {
      Alert.alert('No se puede registrar', 'La imagen no fue reconocida como boleta/factura válida. Por favor verifica.');
      return;
    }

    // Enviamos "monto mostrado"; la Lambda lo convertirá a unidades mínimas
    const participante_id = (participanteId ?? '1').toString();
    const fechaEnviar =
      (fechaValor && /^\d{4}-\d{2}-\d{2}$/.test(fechaValor))
        ? fechaValor
        : new Date().toISOString().slice(0, 10);

    const payload = {
      grupo_id: String(grupoFinal),
      participante_id,
      participantegasto_id: String(pagadorId),
      descripciongasto: descripcion,
      moneda: monedaSel,
      monto: Number(monto), // <-- monto visible; Lambda hace la conversión
      fecha_registro: fechaEnviar,
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
          monto: Number(monto),
          moneda: monedaSel,
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
  }, [groupIdParam, selectedGrupoId, monto, concepto, pagadorId, participanteId, submitting, participantes, imageUri, isReceiptValid, fechaValor, monedaSel]);

  // invalida/valida dinámicamente cuando cambia el texto del monto
  const onChangeMonto = useCallback((txt: string) => {
    const norm = normalizarMontoEntrada(txt, decimalesDe(monedaSel));
    setMonto(norm);
    const n = numberFromInput(norm);
    setMontoError(!Number.isFinite(n) || n <= 0 ? 'Ingresa un monto mayor a 0' : '');
  }, [monedaSel]);

  const disableRegister =
    submitting ||
    (imageUri && !isReceiptValid) ||
    !!montoError ||
    !monto;

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
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

        {/* Pagador */}
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
                <Picker.Item label="Sin participantes" value="" color={INK} />
              ) : (
                participantes.map((p) => (
                  <Picker.Item key={p.participante_id} label={p.nombre} value={p.participante_id} color={INK} />
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

        {/* Fecha */}
        <Text style={s.label}>Fecha</Text>
        <View style={[s.select, { position: 'relative' }]}>
          <TextInput
            style={[s.selectText, { paddingLeft: 12, color: '#0F172A' }]}
            value={fechaValor}
            onChangeText={setFechaValor}
            placeholder="Ingrese fecha (aaaa-mm-dd)"
            placeholderTextColor="#94A3B8"
            keyboardType="numbers-and-punctuation"
            onFocus={() => {
              setFechaFocused(true);
              if (!fechaValor) {
                const hoy = new Date().toISOString().slice(0, 10);
                setFechaValor(hoy);
              }
            }}
            onBlur={() => setFechaFocused(false)}
          />
        </View>

        {/* Moneda */}
        <Text style={s.label}>Moneda</Text>
        <View style={s.pickerWrapper}>
          <Picker
            selectedValue={monedaSel}
            onValueChange={(val) => {
              const dAnt = decimalesDe(monedaSel);
              const dNue = decimalesDe(String(val));
              setMonedaSel(String(val));
              if (dNue !== dAnt) {
                setMonto(prev => {
                  const norm = normalizarMontoEntrada(prev, dNue);
                  const n = numberFromInput(norm);
                  setMontoError(!Number.isFinite(n) || n <= 0 ? 'Ingresa un monto mayor a 0' : '');
                  return norm;
                });
              }
            }}
            style={s.picker}
            dropdownIconColor={INK}
          >
            {MONEDAS.map(m => (
              <Picker.Item key={m.codigo} label={`${m.nombre} (${m.codigo})`} value={m.codigo} color={INK} />
            ))}
          </Picker>
        </View>

        {/* Total + cámara/galería */}
        <Text style={s.label}>Total de gasto</Text>
        <View style={s.amountRow}>
          <TextInput
            value={monto}
            onChangeText={onChangeMonto}
            placeholder="0"
            placeholderTextColor="#9AA3AF"
            style={[s.input, { flex: 1, marginBottom: 0 }]}
            keyboardType={Platform.select({ ios: 'decimal-pad', android: 'numeric' })}
            inputMode="decimal"
          />
          <Pressable
            onPress={takePhoto}
            style={({ pressed }) => [s.camBtn, pressed && s.camBtnPressed]}
            hitSlop={8}
            android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
          >
            <MaterialCommunityIcons name="camera-outline" size={18} color={INK} />
          </Pressable>
          <Pressable
            onPress={pickFromGallery}
            style={({ pressed }) => [s.camBtn, pressed && s.camBtnPressed]}
            hitSlop={8}
            android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
          >
            <MaterialCommunityIcons name="image-outline" size={18} color={INK} />
          </Pressable>
        </View>
        {!!montoError && <Text style={s.errorText}>{montoError}</Text>}

        {/* Preview + botones procesar/eliminar */}
        {imageUri ? (
          <View style={{ gap: 10, marginBottom: 8 }}>
            <Image
              source={{ uri: imageUri }}
              style={{ width: '100%', height: 220, borderRadius: 12, backgroundColor: '#eee' }}
              resizeMode="cover"
            />
            <Pressable
              onPress={uploadAndProcess}
              disabled={scanLoading}
              style={({ pressed }) => [s.secondaryBtn, pressed && s.secondaryBtnPressed, scanLoading && { opacity: 0.6 }]}
              android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
            >
              {scanLoading ? (
                <ActivityIndicator color={PRIMARY} />
              ) : (
                <Text style={s.secondaryText}>Subir y procesar boleta</Text>
              )}
            </Pressable>

            <Pressable
              onPress={removeImage}
              disabled={scanLoading}
              style={({ pressed }) => [s.dangerBtn, pressed && s.dangerBtnPressed, scanLoading && { opacity: 0.6 }]}
              android_ripple={{ color: 'rgba(185,28,28,0.08)' }}
            >
              <Text style={s.dangerText}>Eliminar imagen</Text>
            </Pressable>

            {!!receiptWarning && (
              <View style={s.warnCard}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={DANGER} />
                <Text style={s.warnText}>{String(receiptWarning)}</Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Resultado IA */}
        {scanResult ? (
          <View style={s.scanCard}>
            <Text style={{ fontWeight: '700', color: INK, marginBottom: 6 }}>Resultado IA</Text>
            <Text style={{ color: INK }}>Vendedor: {String(scanResult.vendor ?? '—')}</Text>
            <Text style={{ color: INK }}>Total: {String(scanResult.total ?? '—')}</Text>
            <Text style={{ color: INK }}>Moneda detectada: {String(scanResult.currency ?? monedaSel)}</Text>
            <Text style={{ color: INK }}>Fecha: {String(scanResult.date ?? '—')}</Text>
          </View>
        ) : null}

        {/* Botón Registrar */}
        <Pressable
          onPress={onSubmit}
          disabled={!!disableRegister}
          android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
          style={({ pressed }) => [
            s.primaryBtn,
            pressed && s.primaryBtnPressed,
            disableRegister && { opacity: 0.5 }
          ]}
        >
          <Text style={s.primaryText}>
            {submitting
              ? 'Guardando…'
              : (imageUri && !isReceiptValid ? 'Adjunta una boleta válida' : 'Registrar gasto')}
          </Text>
        </Pressable>
      </ScrollView>
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
  errorText: { color: DANGER, marginTop: -6, marginBottom: 8, fontSize: 12, fontWeight: '600' },
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
    borderWidth: 1, borderColor: BORDER, marginBottom: 8
  },
  secondaryBtnPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.985 }] },
  secondaryText: { color: INK, fontSize: 15, fontWeight: '700' },
  dangerBtn: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 12,
  },
  dangerBtnPressed: { backgroundColor: '#FEF2F2', transform: [{ scale: 0.985 }] },
  dangerText: { color: DANGER, fontSize: 15, fontWeight: '700' },
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
