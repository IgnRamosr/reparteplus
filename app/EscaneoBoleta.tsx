// app/EscaneoBoleta.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Platform, Linking, Dimensions, BackHandler
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ===========================
 *  APIs (ajusta baseURL)
 * =========================== */
const apiUpload = axios.create({
  baseURL: 'https://76qqofsw26.execute-api.us-east-1.amazonaws.com/production',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true,
});

const apiIA = axios.create({
  baseURL: 'https://pki31c24na.execute-api.us-east-1.amazonaws.com/production',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true,
});

/* ===========================
 *  Utils
 * =========================== */
function inferMimeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

function buildImagePickerOptions() {
  const MediaTypeNew = (ImagePicker as any)?.MediaType;
  if (MediaTypeNew && MediaTypeNew.image) {
    return {
      mediaTypes: [MediaTypeNew.image],
      allowsEditing: false,
      quality: 1,
      exif: false,
      base64: false,
    } as any;
  }
  return {
    mediaTypes: (ImagePicker as any).MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 1,
    exif: false,
    base64: false,
  } as any;
}

async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return await res.blob();
}

function parseBucketFromS3Url(fileUrl: string): { bucket?: string; key?: string } {
  try {
    const u = new URL(fileUrl);
    const host = u.hostname;
    const bucket = host.split('.s3')[0];
    const key = decodeURIComponent(u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname);
    return { bucket, key };
  } catch {
    return {};
  }
}

/* ===========================
 *  Heurística: ¿Es boleta?
 * =========================== */
type ParsedIA = {
  vendor?: string | null;
  date?: string | null;
  currency?: string | null;
  total?: any;
  items?: Array<any>;
  text?: string;
  raw_text?: string;
  full_text?: string;
  type?: string;
};

function normalizarTexto(t?: string): string {
  return String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function detectarFecha(t: string): boolean {
  // Soporta formatos como dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, etc.
  const fechaRegex =
    /(?:\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b)|(?:\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b)/;
  return fechaRegex.test(t);
}

function detectarMonedaONumeros(t: string): boolean {
  // signos comunes + números con separadores
  const monedaRegex = /(clp|\$|usd|eur|mxn|ars|brl|pen|uyu|bob|cop|gbp|cad|aud)/;
  const numerosConSeparadores = /\b\d{1,3}([.,]\d{3})*(?:[.,]\d{2})?\b/;
  return monedaRegex.test(t) || numerosConSeparadores.test(t);
}

function evaluarEsBoleta(parsed?: ParsedIA, raw?: string) {
  const razones: string[] = [];
  if (!parsed) return { esBoleta: false, razones: ['La IA no entregó estructura parseada.'] };

  // 1) Señal directa del modelo
  if (parsed.type && /receipt|boleta|ticket/i.test(parsed.type)) {
    razones.push(`Marcado como "${parsed.type}" por la IA.`);
  }

  const txt = normalizarTexto(raw || parsed.raw_text || parsed.full_text || parsed.text || '');
  const tieneTexto = txt.length > 0;

  // 2) Palabras clave frecuentes en boletas
  const keywords = [
    'boleta', 'ticket', 'receipt', 'factura', 'subtotal', 'total', 'iva', 'impuesto',
    'caja', 'cajero', 'vendedor', 'rut', 'r.u.t', 'folio', 'n°', 'nro', 'pago', 'efectivo', 'tarjeta',
  ];
  const hayKeyword = keywords.some(k => txt.includes(k));

  if (hayKeyword) razones.push('Se detectaron palabras típicas de boleta (total/iva/boleta/etc.).');

  // 3) Fecha
  const hayFecha = tieneTexto && detectarFecha(txt);
  if (hayFecha) razones.push('Se detectó una fecha en el texto.');

  // 4) Moneda/números
  const hayMoneda = tieneTexto && detectarMonedaONumeros(txt);
  if (hayMoneda) razones.push('Se detectaron montos o símbolos de moneda.');

  // 5) Estructura mínima del parseo
  const tieneItems = Array.isArray(parsed.items) && parsed.items.length > 0;
  const tieneTotal = parsed.total != null && String(parsed.total).trim().length > 0;
  const tieneVendor = parsed.vendor != null && String(parsed.vendor).trim().length > 0;

  if (tieneItems) razones.push('La IA detectó líneas de ítems.');
  if (tieneTotal) razones.push('La IA detectó un total.');
  if (tieneVendor) razones.push('La IA detectó un comercio/emisor.');

  // Puntaje: con 2 o más señales lo consideramos boleta
  let score = 0;
  if (parsed.type && /receipt|boleta|ticket/i.test(parsed.type)) score += 2;
  if (hayKeyword) score += 1;
  if (hayFecha) score += 1;
  if (hayMoneda) score += 1;
  if (tieneItems) score += 2;
  if (tieneTotal) score += 1;
  if (tieneVendor) score += 1;

  const esBoleta = score >= 2; // umbral conservador
  if (!esBoleta && !tieneTexto && !tieneItems && !tieneTotal) {
    razones.push('No se hallaron señales de boleta (texto, ítems o totales).');
  }
  return { esBoleta, razones };
}

/* ===========================
 *  Alertas UX
 * =========================== */
function alertNoPareceBoleta(grupoId: string, razones: string[]) {
  const msg =
    'La imagen no parece contener una boleta.\n\n'
  Alert.alert(
    'No parece una boleta',
    msg,
    [
      { text: 'Reintentar', style: 'cancel' },
      {
        text: 'Registrar manual',
        onPress: () => {
          router.push({
            pathname: '/RevisionBoleta',
            params: { grupoId },
          });
        },
      },
    ]
  );
}

/* ===========================
 *  Componente
 * =========================== */
export default function EscaneoBoleta() {
  const params = useLocalSearchParams<{ grupoId?: string }>();
  const grupoId = String(params?.grupoId || '');

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [galleryStatus, setGalleryStatus] = useState<ImagePicker.PermissionStatus | null>(null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [facing, setFacing] = useState<'back' | 'front'>('back'); 
  const [showInstruction, setShowInstruction] = useState(true);

  const goBackToGroup = useCallback(() => {
    const gid = String(grupoId);
    if (gid) {
      router.replace({ pathname: '/DetalleGrupo', params: { id: gid, _refresh: Date.now().toString() } });
      return true;
    }
    router.back();
    return true;
  }, [grupoId]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', goBackToGroup);
      return () => sub.remove();
    }, [goBackToGroup])
  );

  // Bloquear botón físico "Atrás" mientras procesa
  useEffect(() => {
    const onBack = () => {
      if (processing) return true; // bloquear
      return false; // permitir comportamiento normal
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [processing]);

  useEffect(() => {
    (async () => {
      const cam = await requestPermission();
      if (!cam.granted) {
        Alert.alert('Permiso de cámara', 'Necesitamos acceso a la cámara para escanear la boleta.', [{ text: 'OK' }]);
      }
      setReady(true);
    })();
  }, [requestPermission]);

  useEffect(() => {
    if (showInstruction) {
      const timer = setTimeout(() => {
        setShowInstruction(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [showInstruction]);

  const ensureGalleryPermission = useCallback(async (): Promise<boolean> => {
    const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setGalleryStatus(status);
    if (status === ImagePicker.PermissionStatus.GRANTED) return true;

    if (!canAskAgain) {
      Alert.alert(
        'Permiso requerido',
        'Para acceder a tu galería, habilita el permiso de fotos/almacenamiento en Ajustes.',
        [{ text: 'Cancelar', style: 'cancel' }, { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() }]
      );
      return false;
    }
    Alert.alert('Permiso denegado', 'No se pudo obtener acceso a la galería.');
    return false;
  }, []);

  const takePhoto = useCallback(async () => {
    try {
      if (!cameraRef.current) return;
      setProcessing(true);
      const pic = await cameraRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
      if (!pic?.uri) throw new Error('No se obtuvo la imagen de la cámara.');
      await processImageUri(pic.uri);
    } catch (e: any) {
      console.error('takePhoto error:', e);
      Alert.alert('Error', e?.message || 'No se pudo tomar la foto.');
      setProcessing(false);
    }
  }, []);

  const openGallery = useCallback(async () => {
    try {
      const ok = await ensureGalleryPermission();
      if (!ok) return;

      const pickerOptions = buildImagePickerOptions();
      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Error', 'No se pudo obtener la imagen seleccionada.');
        return;
      }
      setProcessing(true);
      await processImageUri(asset.uri);
    } catch (e: any) {
      console.error('openGallery error:', e);
      Alert.alert('Error', e?.message || 'No se pudo abrir la galería.');
      setProcessing(false);
    }
  }, [ensureGalleryPermission]);

  const processImageUri = useCallback(async (uri: string) => {
    try {
      const fileName = `boleta_${Date.now()}.jpg`;
      const fileType = inferMimeFromUri(uri);
      const r1 = await apiUpload.post('/presigned-url', { fileName, fileType });

      if (!(r1.status >= 200 && r1.status < 300)) {
        throw new Error(`No se pudo obtener URL prefirmada (${r1.status}).`);
      }
      const { uploadUrl, fileUrl, key } = typeof r1.data === 'string' ? JSON.parse(r1.data) : r1.data;
      if (!uploadUrl || !key) throw new Error('Respuesta presign inválida.');

      const blob = await uriToBlob(uri);
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': fileType }, body: blob });
      if (!put.ok) throw new Error(`Fallo subida a S3 (${put.status}).`);

      const { bucket: parsedBucket } = parseBucketFromS3Url(fileUrl || '');
      const r2 = await apiIA.post('/imagen', { bucket: parsedBucket, key });

      // Si Bedrock/IA falla, lo tratamos como "no leíble" (no boleta)
      if (!(r2.status >= 200 && r2.status < 300)) {
        alertNoPareceBoleta(grupoId, [`La IA respondió estado ${r2.status}.`]);
        return;
      }

      const data = typeof r2.data === 'string' ? JSON.parse(r2.data) : r2.data;
      const parsed: ParsedIA | undefined = data?.parsed;

      if (!parsed) {
        alertNoPareceBoleta(grupoId, ['La IA no retornó datos parseados.']);
        return;
      }

      // === (A) Detección de "boleta" independiente de validez ===
      const { esBoleta, razones } = evaluarEsBoleta(parsed, data?.raw_text || data?.text);
      if (!esBoleta) {
        alertNoPareceBoleta(grupoId, razones);
        return;
      }

      // === (B) Normalización mínima (NO bloquea por totales/ítems)
      const rawItems: any[] = Array.isArray(parsed.items) ? parsed.items : [];
      const cur = String(parsed.currency || 'CLP').toUpperCase();

      const decimalesPorMoneda: Record<string, number> = { CLP: 0, JPY: 0, PYG: 0 };
      const decimales = decimalesPorMoneda[cur] ?? 2;

      const toCents = (num: any) => {
        if (num == null) return 0;
        const cleaned = String(num).replace(/[^\d,.\-]/g, '').replace(',', '.');
        const n = Number(cleaned);
        if (!Number.isFinite(n)) return 0;
        return Math.round(n * Math.pow(10, decimales));
      };

      const items_normalized = rawItems.map((it: any) => {
        const qtyRaw = String(it?.qty ?? 1).replace(',', '.');
        const qty = Number(qtyRaw);
        const unit_cents = Number.isFinite(it?.unit_price_cents)
          ? Number(it.unit_price_cents)
          : toCents(it?.unit_price);
        const line_cents = Number.isFinite(it?.line_total_cents)
          ? Number(it.line_total_cents)
          : Math.round((Number.isFinite(qty) ? qty : 1) * unit_cents);

        return {
          name: String(it?.name || ''),
          qty: Number.isFinite(qty) ? qty : 1,
          unit_price_cents: Number.isFinite(unit_cents) ? unit_cents : 0,
          line_total_cents: Number.isFinite(line_cents) ? line_cents : 0,
        };
      });

      const warnings: string[] = [];
      if (!parsed.currency) warnings.push('No se detectó moneda; se usó CLP.');
      if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
        warnings.push('No se detectaron ítems; puedes agregarlos manualmente.');
      }
      if (parsed.total == null || String(parsed.total).trim() === '' || String(parsed.total).trim() === '0') {
        warnings.push('El total detectado es 0 o vacío; corrige manualmente si corresponde.');
      }

      router.push({
        pathname: '/RevisionBoleta',
        params: {
          grupoId,
          payload: JSON.stringify({
            parsed: {
              vendor: parsed.vendor ?? null,
              date: parsed.date ?? null,
              currency: cur,
              total: parsed.total ?? null,
            },
            items_normalized,
            currency: cur,
            warnings,
            // opcional: enviar trazas de por qué se consideró boleta
            receipt_signals: razones,
          }),
        },
      });
    } catch (e: any) {
      console.error('processImageUri error:', e);
      alertNoPareceBoleta(grupoId, [e?.message || 'No se pudo procesar la imagen.']);
    } finally {
      setProcessing(false);
    }
  }, [grupoId]);

  const irRegistrarManual = useCallback(() => {
    if (processing) return; // safety
    router.push({
      pathname: '/RevisionBoleta',
      params: { grupoId },
    });
  }, [grupoId, processing]);

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0EA5A4" />
          <Text style={styles.loadingText}>Solicitando permisos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <LinearGradient
          colors={['#0EA5A4', '#14B8A6', '#10B981']}
          style={styles.permissionGradient}
        >
          <View style={styles.permissionIconContainer}>
            <MaterialCommunityIcons name="camera-off" size={64} color="#fff" />
          </View>
          <Text style={styles.permissionTitle}>Permiso de cámara</Text>
          <Text style={styles.permissionDescription}>
            Necesitamos acceso a tu cámara para escanear boletas de forma rápida y automática
          </Text>
          <Pressable 
            onPress={requestPermission} 
            style={({ pressed }) => [styles.permissionButton, pressed && styles.permissionButtonPressed]}
          >
            <MaterialCommunityIcons name="camera" size={20} color="#0EA5A4" />
            <Text style={styles.permissionButtonText}>Conceder permiso</Text>
          </Pressable>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0EA5A4', '#14B8A6', '#10B981']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <Pressable 
                onPress={() => !processing && router.back()} 
                disabled={processing}
                style={({ pressed }) => [
                  styles.backButton, 
                  (pressed && !processing) && styles.buttonPressed,
                  processing && { opacity: 0.5 }
                ]} 
                hitSlop={10}
              >
                <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
              </Pressable>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Escanear Boleta</Text>
              </View>
              <View style={{ width: 48 }} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.cameraContainer}>
          {ready ? (
            <CameraView ref={cameraRef} style={styles.camera} facing={facing} flash={flash}>
              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.cornerTopLeft]} />
                <View style={[styles.corner, styles.cornerTopRight]} />
                <View style={[styles.corner, styles.cornerBottomLeft]} />
                <View style={[styles.corner, styles.cornerBottomRight]} />
                
                {/* Guías de escaneo */}
                <View style={styles.scanGuide}>
                  <MaterialCommunityIcons name="receipt" size={48} color="rgba(14, 165, 164, 0.4)" />
                  <Text style={styles.scanGuideText}>Coloca la boleta aquí</Text>
                </View>
              </View>
            </CameraView>
          ) : (
            <View style={[styles.camera, styles.center]}>
              <ActivityIndicator size="large" color="#0EA5A4" />
              <Text style={styles.cameraLoadingText}>Inicializando cámara...</Text>
            </View>
          )}

          <View style={styles.cameraControls}>
            <Pressable
              onPress={() => setFlash(prev => (prev === 'off' ? 'on' : 'off'))}
              style={({ pressed }) => [
                styles.controlButton, 
                flash === 'on' && styles.controlButtonActive,
                pressed && styles.controlButtonPressed
              ]}
              hitSlop={10}
            >
              <MaterialCommunityIcons 
                name={flash === 'on' ? 'flash' : 'flash-off'} 
                size={22} 
                color={flash === 'on' ? '#0EA5A4' : '#fff'} 
              />
            </Pressable>

            <Pressable
              onPress={() => setFacing(prev => (prev === 'back' ? 'front' : 'back'))}
              style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
              hitSlop={10}
            >
              <MaterialCommunityIcons name="camera-flip" size={22} color="#fff" />
            </Pressable>

            {/* Ocultar galería mientras procesa */}
            {!processing && (
              <Pressable
                onPress={openGallery}
                style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
                hitSlop={10}
              >
                <MaterialCommunityIcons name="image-multiple" size={22} color="#fff" />
              </Pressable>
            )}
          </View>

          {showInstruction && (
            <View style={[styles.instructionBanner, { opacity: showInstruction ? 1 : 0 }]}>
              <MaterialCommunityIcons name="information" size={18} color="#0EA5A4" />
              <Text style={styles.instructionText}>
                Centra la boleta dentro del marco
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          <Pressable
            onPress={takePhoto}
            disabled={processing}
            style={({ pressed }) => [
              styles.captureButton,
              (pressed || processing) && styles.captureButtonPressed
            ]}
          >
            <View style={styles.captureButtonOuter}>
              <View style={styles.captureButtonInner}>
                {processing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <MaterialCommunityIcons name="camera" size={28} color="#fff" />
                )}
              </View>
            </View>
            <Text style={styles.captureButtonText}>
              {processing ? 'Procesando...' : 'Capturar Boleta'}
            </Text>
          </Pressable>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.divider} />
          </View>

          {/* Deshabilitar Registro Manual mientras procesa */}
          <Pressable 
            onPress={irRegistrarManual} 
            disabled={processing}
            style={({ pressed }) => [
              styles.manualButton, 
              pressed && !processing && styles.manualButtonPressed,
              processing && { opacity: 0.5 }
            ]}
          >
            <View style={styles.manualButtonContent}>
              <View style={styles.manualButtonIcon}>
                <MaterialCommunityIcons name="pencil" size={20} color="#0EA5A4" />
              </View>
              <View style={styles.manualButtonTextContainer}>
                <Text style={styles.manualButtonTitle}>Registro Manual</Text>
                <Text style={styles.manualButtonSubtitle}>Agregar gastos sin escanear</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
            </View>
          </Pressable>

        </View>
      </View>
    </View>
  );
}

/* ===========================
 *  Estilos
 * =========================== */
const PRIMARY = '#0EA5A4';
const SECONDARY = '#14B8A6';
const TERTIARY = '#10B981';
const BG = '#F9FAFB';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6B7280';
const BORDER = '#E5E7EB';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    fontWeight: '600',
  },

  // Permission Screen
  permissionContainer: {
    flex: 1,
    backgroundColor: PRIMARY,
  },
  permissionGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  permissionDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 300,
  },
  permissionButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  permissionButtonPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  permissionButtonText: { color: PRIMARY, fontSize: 17, fontWeight: '700' },

  // Header
  header: {
    paddingBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  headerContent: { paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },

  // Content
  content: { flex: 1, padding: 16, gap: 16 },

  // Camera
  cameraContainer: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  camera: { flex: 1 },
  cameraLoadingText: { color: '#fff', fontSize: 15, marginTop: 12, fontWeight: '600' },
  scanFrame: {
    flex: 1, margin: 40, borderWidth: 2, borderColor: 'rgba(14, 165, 164, 0.6)', borderRadius: 16,
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center',
  },
  scanGuide: { alignItems: 'center', gap: 8 },
  scanGuideText: {
    color: 'rgba(255, 255, 255, 0.8)', fontSize: 14, fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: PRIMARY, borderWidth: 4 },
  cornerTopLeft: { top: -2, left: -2, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 8 },
  cornerTopRight: { top: -2, right: -2, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 8 },
  cornerBottomLeft: { bottom: -2, left: -2, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 8 },
  cornerBottomRight: { bottom: -2, right: -2, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 8 },

  cameraControls: { position: 'absolute', top: 16, right: 16, gap: 12 },
  controlButton: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  controlButtonActive: { backgroundColor: '#fff' },
  controlButtonPressed: { opacity: 0.8, transform: [{ scale: 0.92 }] },

  instructionBanner: {
    position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 3 } }),
  },
  instructionText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600', flex: 1 },

  // Actions
  actionsContainer: { gap: 16 },
  manualButton: {
    backgroundColor: CARD_BG, borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: BORDER,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  manualButtonPressed: { transform: [{ scale: 0.98 }], opacity: 0.8 },
  manualButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  manualButtonIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  manualButtonTextContainer: { flex: 1, gap: 2 },
  manualButtonTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  manualButtonSubtitle: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '500' },

  dividerContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },

  captureButton: { alignItems: 'center', gap: 12 },
  captureButtonPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  captureButtonOuter: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }, android: { elevation: 8 } }),
  },
  captureButtonInner: { width: 68, height: 68, borderRadius: 34, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  captureButtonText: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
});
