// app/detallegasto.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  FlatList,
  BackHandler,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';

// ====== PALETA LedgerTeal ======
const PRIMARY = '#0EA5A4';
const BG = '#F8FBFC';
const INK = '#0F172A';
const CARD = '#FFFFFF';
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';
const SUCCESS = '#10B981';
const PENDING = '#F59E0B';

// === API (api_gasto) ===
const apiGasto = axios.create({
  baseURL: 'https://amzcxtvh06.execute-api.us-east-1.amazonaws.com/production',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true,
});

type Fila = {
  id: string;
  nombre: string;
  pendiente: string; // formateado "12.345 CLP"
  pagado: boolean;
};

type GastoDetalleResp = {
  gasto: {
    id: number | string;
    grupo_id: number | string;
    descripcion: string;
    moneda: string;
    monto_total: number;
    fecha_registro?: string;
  };
  integrantes: Array<{
    participante_id: number | string;
    nombre: string;
    monto_asignado: number;
    monto_pagado: number;
    pendiente: number;
    estado: boolean;
  }>;
};

function formatCLP(n: number | string) {
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '—';
  try {
    return new Intl.NumberFormat('es-CL').format(num) + ' CLP';
  } catch {
    return String(num) + ' CLP';
  }
}

// ==== Preferencias de carpeta (Android) ====
const KEY_DOWNLOAD_DIR = 'reparte_download_directory_uri';
const ANDROID_DOWNLOADS = 'content://com.android.externalstorage.documents/document/primary:Download';

const safeName = (s: string) =>
  (s || 'gasto').replace(/[^\p{L}\p{N}\-_ ]/gu, '').replace(/\s+/g, '_').slice(0, 60);

// Guarda copia del PDF y recuerda carpeta en Android
async function savePdfCopy(uri: string, filename: string): Promise<{ savedUri: string | null; where: string }> {
  try {
    if (Platform.OS === 'android') {
      let directoryUri = await AsyncStorage.getItem(KEY_DOWNLOAD_DIR);

      if (!directoryUri) {
        const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
          ANDROID_DOWNLOADS
        );
        if (!perm.granted) {
          return { savedUri: null, where: '' };
        }
        directoryUri = perm.directoryUri;
        await AsyncStorage.setItem(KEY_DOWNLOAD_DIR, directoryUri);
      }

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
        directoryUri,
        filename,
        'application/pdf'
      );
      await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });

      return { savedUri: destUri, where: 'Descargas' };
    } else {
      const dest = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      return { savedUri: dest, where: 'Documentos de la app (Archivos > Reparte+)' };
    }
  } catch (err) {
    console.warn('savePdfCopy error', err);
    return { savedUri: null, where: '' };
  }
}

// === Helpers ===
const escapeHtml = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Carga un asset local y lo devuelve como data URI base64 (ideal para HTML->PDF)
async function loadLogoDataUri(): Promise<string | null> {
  try {
    // pon tu archivo en: /assets/reparte-logo.png
    const asset = Asset.fromModule(require('assets/images/logo.png'));
    await asset.downloadAsync(); // asegura localUri
    const fileUri = asset.localUri || asset.uri;
    const base64 = await FileSystem.readAsStringAsync(fileUri!, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/${(asset.type || 'png').toLowerCase()};base64,${base64}`;
  } catch (e) {
    console.warn('No se pudo cargar el logo:', e);
    return null;
  }
}

export default function DetalleGastoScreen() {
  const { gasto, grupoId } = useLocalSearchParams<{ gasto?: string; grupoId?: string }>();
  const gastoId = Array.isArray(gasto) ? gasto[0] : gasto;
  const gid = Array.isArray(grupoId) ? grupoId[0] : grupoId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [header, setHeader] = useState<{ titulo: string; total: string; id: string }>({
    titulo: '—',
    total: '—',
    id: gastoId ?? '—',
  });
  const [filas, setFilas] = useState<Fila[]>([]);

  const goBackToGroup = useCallback(() => {
    if (gid) {
      router.replace({ pathname: '/DetalleGrupo', params: { id: String(gid), _refresh: Date.now().toString() } });
      return true;
    }
    router.back();
    return true;
  }, [gid]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', goBackToGroup);
      return () => sub.remove();
    }, [goBackToGroup])
  );

  useEffect(() => {
    (async () => {
      if (!gastoId) {
        setLoading(false);
        Alert.alert('Falta parámetro', 'No se recibió el id del gasto.');
        return;
      }
      try {
        setLoading(true);
        const resp = await apiGasto.get<GastoDetalleResp>('/gasto-detalle', { params: { gastoId } });

        if (resp.status >= 200 && resp.status < 300 && resp.data?.gasto) {
          const g = resp.data.gasto;
          setHeader({
            titulo: g.descripcion || '—',
            total: formatCLP(g.monto_total),
            id: String(g.id ?? gastoId),
          });

          const rows: Fila[] = (resp.data.integrantes ?? []).map((p) => ({
            id: String(p.participante_id),
            nombre: p.nombre,
            pendiente: formatCLP(p.pendiente),
            pagado: !!p.estado,
          }));
          setFilas(rows);
        } else {
          const msg = resp.data ? JSON.stringify(resp.data) : 'Respuesta inválida';
          Alert.alert('Error cargando gasto', `(${resp.status}) ${msg}`);
          setFilas([]);
        }
      } catch (e: any) {
        Alert.alert('Error', e?.response?.data?.message || e?.message || 'No se pudo cargar el detalle');
        setFilas([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [gastoId]);

  const buildPdfHtml = useCallback((logoDataUri?: string | null) => {
    const fecha = new Date().toLocaleString('es-CL');

    const rowsHtml = filas.map((f) => `
      <tr>
        <td class="left">
          <div class="chip">${f.nombre?.charAt(0) || '?'}</div>
          <span class="name">${escapeHtml(f.nombre)}</span>
        </td>
        <td class="center">${escapeHtml(f.pendiente)}</td>
        <td class="center">${f.pagado
          ? '<span class="estado ok">Pagado &#10004;</span>'
          : '<span class="estado wait">Pendiente &#128337;</span>'}
        </td>
      </tr>
    `).join('');

    // si hay logoDataUri lo mostramos, si no ponemos el emoji
    const logoHtml = logoDataUri
      ? `<img src="${logoDataUri}" style="width:44px;height:44px;border-radius:12px;object-fit:cover" />`
      : `<div class="logo">🧾</div>`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Detalle de gasto</title>
<style>
  *{ box-sizing:border-box }
  body{ font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,"Helvetica Neue",Arial,"Noto Sans"; color:#0F172A; margin:0; padding:24px; background:#F8FBFC }
  .card{ background:#fff; border:1px solid #E2E8F0; border-radius:16px; padding:20px }
  .header{ display:flex; align-items:center; gap:12px }
  .logo{ width:44px; height:44px; border-radius:12px; background:rgba(14,165,164,.1); display:flex; align-items:center; justify-content:center }
  .label{ font-size:12px; color:#64748B; text-transform:uppercase; letter-spacing:.5px; margin:0 }
  .title{ font-size:22px; font-weight:800; margin:2px 0 0 }
  .divider{ height:1px; background:#E2E8F0; margin:16px 0 }
  .row{ display:flex; gap:16px; align-items:center }
  .pill{ font-size:13px; padding:6px 10px; border-radius:999px; border:1px solid rgba(14,165,164,.3); color:#0EA5A4 }
  .total{ font-size:18px; font-weight:800; color:#0EA5A4 }
  table{ width:100%; border-collapse:collapse; margin-top:10px }
  thead th{ background:#F8FAFB; color:#64748B; font-size:11px; text-transform:uppercase; letter-spacing:.6px; text-align:left; padding:10px 12px; border-bottom:1px solid #E2E8F0 }
  td{ padding:12px; border-bottom:1px solid #E2E8F0; font-size:14px }
  tr:last-child td{ border-bottom:0 }
  .left{ display:flex; align-items:center; gap:10px }
  .chip{ width:28px; height:28px; border-radius:999px; background:rgba(14,165,164,.12); color:#0EA5A4; font-weight:800; display:flex; align-items:center; justify-content:center }
  .name{ font-weight:600 }
  .center{ text-align:center }
  .estado{ font-weight:700; font-size:12px; padding:4px 8px; border-radius:8px }
  .ok{ color:#10B981; background:rgba(16,185,113,.10) }
  .wait{ color:#F59E0B; background:rgba(245,158,11,.12) }
  .footer{ margin-top:14px; color:#64748B; font-size:12px }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      ${logoHtml}
      <div>
        <p class="label">Gasto</p>
        <h1 class="title">${escapeHtml(header.titulo)}</h1>
      </div>
    </div>

    <div class="divider"></div>

    <div class="row">
      <span class="total">Total: ${escapeHtml(header.total)}</span>
    </div>

    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th class="center">Pendiente</th>
          <th class="center">Estado</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="3" class="center" style="color:#64748B">Sin integrantes</td></tr>'}
      </tbody>
    </table>

    <div class="footer">Generado en Reparte+ • ${escapeHtml(fecha)} • Plataforma: ${Platform.OS}</div>
  </div>
</body>
</html>`;
  }, [filas, header]);

  // ====== Exportar PDF: logo + guarda + compartir ======
  const onExportPdf = useCallback(async () => {
    try {
      if (loading) return;
      if (!header?.titulo || !header?.total) {
        Alert.alert('Sin datos', 'Aún no hay información para exportar.');
        return;
      }
      setSubmitting(true);

      // 0) Cargar logo como data URI
      const logoDataUri = await loadLogoDataUri();

      // 1) Generar PDF
      const html = buildPdfHtml(logoDataUri || undefined);
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      // 2) Guardar copia (Android: Descargas recordada; iOS: documentos app)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${safeName(header.titulo)}_${timestamp}.pdf`;
      const { savedUri, where } = await savePdfCopy(uri, filename);

      if (savedUri) {
        Alert.alert('PDF guardado', `Se guardó una copia en ${where}:\n${filename}`);
      } else if (Platform.OS === 'android') {
        Alert.alert('Permiso requerido', 'No se pudo guardar automáticamente. Vuelve a intentar y autoriza la carpeta.');
      }

      // 3) Abrir cuadro de compartir/guardar
      await Sharing.shareAsync(uri, {
        dialogTitle: `Detalle de gasto - ${header.titulo}`,
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo generar el PDF');
    } finally {
      setSubmitting(false);
    }
  }, [buildPdfHtml, header, loading]);

  const disableExport = loading || submitting || !filas.length;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={goBackToGroup}
          style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}
          hitSlop={10}
          android_ripple={{ color: 'rgba(14,165,164,0.15)', borderless: true, radius: 20 }}
          accessibilityLabel="Volver"
        >
          <View style={s.backBtnInner}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={PRIMARY} />
          </View>
        </Pressable>

        <View style={s.headerCenter}>
          <Text style={s.appTitle}>Reparte+</Text>
          <Text style={s.screenTitle}>Detalles de gasto</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* Card de Resumen */}
      <View style={s.summaryCard}>
        <View style={s.summaryHeader}>
          <View style={s.iconCircle}>
            <MaterialCommunityIcons name="script-text-outline" size={24} color={PRIMARY} />
          </View>
          <View style={s.summaryInfo}>
            <Text style={s.summaryLabel}>Gasto</Text>
            <Text style={s.summaryTitle}>{header.titulo}</Text>
          </View>
        </View>

        <View style={s.divider} />

        <View style={s.summaryRow}>
          <View style={s.summaryItem}>
            <Text style={s.summaryItemLabel}>Total</Text>
            <Text style={s.summaryItemValue}>{header.total}</Text>
          </View>
          <View style={s.summaryDividerVertical} />
        </View>
      </View>

      {/* Integrantes */}
      <View style={s.sectionHeader}>
        <MaterialCommunityIcons name="account-group" size={18} color={PRIMARY} />
        <Text style={s.sectionTitle}>Integrantes</Text>
      </View>

      <View style={s.tableWrapper}>
        <View style={s.tableHeader}>
          <Text style={[s.th, s.colIntegrante]}>NOMBRE</Text>
          <Text style={[s.th, s.colPendiente, s.center]}>PENDIENTE</Text>
          <Text style={[s.th, s.colPagado, s.center]}>ESTADO</Text>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 28, alignItems: 'center' }}>
            <ActivityIndicator color={PRIMARY} />
            <Text style={{ color: TEXT_MUTED, marginTop: 8 }}>Cargando detalle…</Text>
          </View>
        ) : (
          <FlatList<Fila>
            data={filas}
            keyExtractor={(f) => f.id}
            renderItem={({ item, index }) => (
              <View style={[s.row, index === filas.length - 1 && s.rowLast]}>
                <View style={s.avatarNameContainer}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{item.nombre.charAt(0)}</Text>
                  </View>
                  <Text style={[s.cellText, s.colIntegranteText]} numberOfLines={1}>
                    {item.nombre}
                  </Text>
                </View>

                <View style={[s.colPendiente, s.center]}>
                  <View style={[s.badge, !item.pagado && s.badgePending]}>
                    <Text style={[s.badgeText, !item.pagado && s.badgeTextPending]} numberOfLines={1}>
                      {item.pendiente}
                    </Text>
                  </View>
                </View>

                <View style={[s.colPagado, s.center]}>
                  {item.pagado ? (
                    <View style={s.statusSuccess}>
                      <MaterialCommunityIcons name="check-circle" size={20} color={SUCCESS} />
                    </View>
                  ) : (
                    <View style={s.statusPending}>
                      <MaterialCommunityIcons name="clock-outline" size={20} color={PENDING} />
                    </View>
                  )}
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <MaterialCommunityIcons name="folder-open-outline" size={40} color={TEXT_MUTED} />
                <Text style={{ color: TEXT_MUTED, marginTop: 8 }}>Sin integrantes para este gasto.</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Botones */}
      <View style={s.buttonGroup}>
        <Pressable
          onPress={() => {}}
          style={({ pressed }) => [s.secondaryBtn, pressed && s.secondaryBtnPressed]}
          android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
        >
          <View style={s.btnContent}>
            <View style={s.btnIconCircle}>
              <MaterialCommunityIcons name="chart-donut" size={18} color={PRIMARY} />
            </View>
            <Text style={s.secondaryBtnText}>Ver gráfico</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={onExportPdf}
          disabled={disableExport}
          style={({ pressed }) => [
            s.primaryBtn,
            pressed && s.primaryBtnPressed,
            (disableExport || submitting) && { opacity: 0.6 },
          ]}
          android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
        >
          <View style={s.btnContent}>
            <MaterialCommunityIcons name="file-download-outline" size={18} color="#fff" />
            <Text style={s.primaryBtnText}>
              {submitting ? 'Generando PDF…' : 'Exportar PDF'}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 20, paddingTop: 48 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { padding: 4, borderRadius: 12 },
  backBtnPressed: { transform: [{ scale: 0.95 }] },
  backBtnInner: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: CARD,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  headerCenter: { alignItems: 'center', flex: 1 },
  appTitle: { fontSize: 24, fontWeight: '800', color: PRIMARY, letterSpacing: -0.5 },
  screenTitle: { fontSize: 13, fontWeight: '600', color: TEXT_MUTED, marginTop: 2, letterSpacing: 0.3 },

  summaryCard: {
    backgroundColor: CARD, borderRadius: 16, padding: 20, marginBottom: 24,
    shadowColor: PRIMARY, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    borderWidth: 1, borderColor: 'rgba(14,165,164,0.08)',
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(14,165,164,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  summaryInfo: { flex: 1 },
  summaryLabel: { fontSize: 12, color: TEXT_MUTED, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryTitle: { fontSize: 22, fontWeight: '700', color: INK },
  divider: { height: 1, backgroundColor: BORDER, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryItemLabel: { fontSize: 11, color: TEXT_MUTED, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryItemValue: { fontSize: 18, fontWeight: '700', color: PRIMARY },
  summaryDividerVertical: { width: 1, height: 30, backgroundColor: BORDER },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: INK, letterSpacing: -0.3 },

  tableWrapper: {
    backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
    marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F8FAFB', paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: BORDER },
  th: { fontSize: 10, fontWeight: '700', color: TEXT_MUTED, letterSpacing: 0.8 },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  rowLast: { borderBottomWidth: 0 },

  avatarNameContainer: { flex: 1.4, flexDirection: 'row', alignItems: 'center', minWidth: 110 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(14,165,164,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  colIntegrante: { flex: 1.4, minWidth: 110 },
  colIntegranteText: { flex: 1 },
  colPendiente: { flex: 1.1, minWidth: 90 },
  colPagado: { width: 52 },

  cellText: { fontSize: 14, color: INK, fontWeight: '500', flexShrink: 1 },
  center: { textAlign: 'center', alignItems: 'center', justifyContent: 'center' } as any,

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(16,185,113,0.1)', minWidth: 70 },
  badgePending: { backgroundColor: 'rgba(245,158,11,0.12)' },
  badgeText: { fontSize: 12, fontWeight: '700', color: SUCCESS, textAlign: 'center' },
  badgeTextPending: { color: PENDING },

  statusSuccess: { opacity: 1 },
  statusPending: { opacity: 0.8 },

  buttonGroup: { gap: 10 },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  btnIconCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(14,165,164,0.12)', alignItems: 'center', justifyContent: 'center' },

  secondaryBtn: {
    backgroundColor: CARD, borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center',
    shadowColor: PRIMARY, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  secondaryBtnPressed: { backgroundColor: 'rgba(14,165,164,0.05)', transform: [{ scale: 0.98 }] },
  secondaryBtnText: { color: PRIMARY, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

  primaryBtn: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center',
    shadowColor: PRIMARY, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  primaryBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});