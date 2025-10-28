// app/detallegasto.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  BackHandler,
  Platform,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

/* ====== PALETA LedgerTeal ====== */
const PRIMARY = '#0EA5A4';
const PRIMARY_10 = 'rgba(14,165,164,0.1)';
const BG = '#F8FBFC';
const INK = '#0F172A';
const CARD = '#FFFFFF';
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';
const SUCCESS = '#10B981';
const PENDING = '#F59E0B';

/* ====== API ====== */
const apiGasto = axios.create({
  baseURL: 'https://amzcxtvh06.execute-api.us-east-1.amazonaws.com/production',
  timeout: 20000,
  headers: { 'Cache-Control': 'no-cache' },
});
const apiGrupo = axios.create({
  baseURL: 'https://ee61hfpl8e.execute-api.us-east-1.amazonaws.com/production',
  timeout: 20000,
  headers: { 'Cache-Control': 'no-cache' },
});

/* ====== Tipos ====== */
type Fila = { id: string; nombre: string; pendiente: string; pagado: boolean };
type GastoDetalleResp = {
  gasto: {
    id: string | number;
    grupo_id: string | number;
    descripcion: string;
    moneda: string;
    monto_total: number;
    fecha_registro?: string;
  };
  integrantes: Array<{
    participante_id: string | number;
    nombre: string;
    monto_asignado: number;
    monto_pagado: number;
    pendiente: number;
    estado: boolean;
  }>;
};

type GrupoResumen = {
  grupo_id: string | number;
  nombre?: string;
  creador_nombre?: string;
  fecha_inicio?: string;
  fecha_cierre?: string | null;
};

type GastoGrupo = {
  id: string | number;
  descripcion: string;
  monto_total: number;
  fecha_registro?: string;
};

/* ====== Helpers ====== */
const formatCLP = (n: number | string) => `${Intl.NumberFormat('es-CL').format(Number(n || 0))} CLP`;
const formatFecha = (iso?: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('es-CL') : '—';
const escapeHtml = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const safeName = (s: string) =>
  (s || 'gasto').replace(/[^\p{L}\p{N}\-_ ]/gu, '').replace(/\s+/g, '_').slice(0, 60);

/* Toma descripción robusta (igual al dashboard) */
function pickDescripcion(row: any): string {
  if (!row || typeof row !== 'object') return 'Sin descripción';
  const keys = Object.keys(row);
  const candidates = [
    'descripciongasto','descripcion_gasto','descripcion','desc',
    'nombre_gasto','nombre','titulo','detalle','concepto','observacion','item',
  ];
  const norm = (s: string) => s.toLowerCase().replace(/_/g, '');
  const map = new Map(keys.map((k) => [norm(k), k]));
  for (const c of candidates) {
    const hit = map.get(norm(c));
    if (hit && row[hit] != null && String(row[hit]).trim() !== '') return String(row[hit]).trim();
  }
  const fuzzy = keys.find((k) => /(desc|concept|titulo|detalle|nombre)/i.test(k));
  if (fuzzy && row[fuzzy] != null && String(row[fuzzy]).trim() !== '') return String(row[fuzzy]).trim();
  return 'Sin descripción';
}

function mapGastos(list: any[]): GastoGrupo[] {
  if (!Array.isArray(list)) return [];
  return list.map((r: any, i: number) => ({
    id: r.id ?? r.gasto_id ?? r.uuid ?? String(i),
    descripcion: pickDescripcion(r),
    monto_total: Number(r.monto ?? r.monto_total ?? r.total ?? r.valor ?? r.precio ?? 0),
    fecha_registro: r.fecha ?? r.fecha_registro ?? r.created_at ?? undefined,
  }));
}

function mapGrupo(data: any, gid: string | number): GrupoResumen {
  if (!data) return { grupo_id: gid };
  return {
    grupo_id: data.grupo_id ?? data.id ?? gid,
    nombre: data.nombre ?? data.titulo ?? '—',
    creador_nombre: data.creador_nombre ?? data.owner_name ?? '—',
    fecha_inicio: data.fecha_inicio ?? data.inicio ?? data.created_at ?? undefined,
    fecha_cierre: data.fecha_cierre ?? data.cierre ?? null,
  };
}

/* === Logo para PDF === */
async function loadLogoDataUri(): Promise<string | null> {
  try {
    const asset = Asset.fromModule(require('assets/images/logo.png'));
    await asset.downloadAsync();
    const fileUri = asset.localUri || asset.uri;
    const base64 = await FileSystem.readAsStringAsync(fileUri!, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/${(asset.type || 'png').toLowerCase()};base64,${base64}`;
  } catch {
    return null;
  }
}

/* ====== Componente ====== */
export default function DetalleGastoScreen() {
  const { gasto, grupoId } = useLocalSearchParams<{ gasto?: string; grupoId?: string }>();
  const gastoId = Array.isArray(gasto) ? gasto[0] : gasto;
  const gid = Array.isArray(grupoId) ? grupoId[0] : grupoId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [header, setHeader] = useState<{ titulo: string; total: string; id: string; grupoId?: string | number }>({
    titulo: '—',
    total: '—',
    id: gastoId ?? '—',
    grupoId: gid,
  });

  const [filas, setFilas] = useState<Fila[]>([]);
  const [grupoResumen, setGrupoResumen] = useState<GrupoResumen | null>(null);
  const [gastosGrupo, setGastosGrupo] = useState<GastoGrupo[]>([]);

  const goBack = useCallback(() => { router.back(); return true; }, []);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
      return () => sub.remove();
    }, [goBack])
  );

  /* ====== Carga ====== */
  useEffect(() => {
    (async () => {
      if (!gastoId) {
        setLoading(false);
        Alert.alert('Falta parámetro', 'No se recibió el id del gasto.');
        return;
      }
      try {
        setLoading(true);
        // 1) Detalle del gasto
        const resp = await apiGasto.get<GastoDetalleResp>('/gasto-detalle', { params: { gastoId } });
        if (resp.status >= 200 && resp.data?.gasto) {
          const g = resp.data.gasto;
          const grupoIdResolved = g.grupo_id ?? gid;

          setHeader({
            titulo: g.descripcion || '—',
            total: formatCLP(g.monto_total),
            id: String(g.id ?? gastoId),
            grupoId: grupoIdResolved,
          });

          setFilas(
            (resp.data.integrantes ?? []).map((p) => ({
              id: String(p.participante_id),
              nombre: p.nombre,
              pendiente: formatCLP(p.pendiente),
              pagado: !!p.estado,
            }))
          );

          // 2) META DEL GRUPO
          let meta: any = null;
          try {
            const gr = await apiGrupo.get('/grupo', { params: { grupoId: grupoIdResolved, _t: Date.now() } });
            if (gr.status >= 200 && gr.data) meta = gr.data;
          } catch {}
          setGrupoResumen(mapGrupo(meta, grupoIdResolved));

          // 3) REGISTRO DE GASTOS (misma fuente del dashboard)
          const _t = Date.now();
          let reg: any[] = [];
          try {
            const r0 = await apiGasto.get('/gastos', { params: { grupoId: grupoIdResolved, _t } });
            const raw = r0?.data?.resultados ?? r0?.data;
            if (Array.isArray(raw)) reg = raw;
          } catch {}
          if (!reg.length) {
            try {
              const r1 = await apiGrupo.get('/grupo/gastos', { params: { grupoId: grupoIdResolved, _t } });
              const raw1 = Array.isArray(r1?.data) ? r1.data : (r1?.data?.items ?? []);
              if (Array.isArray(raw1)) reg = raw1;
            } catch {}
          }
          setGastosGrupo(mapGastos(reg));
        } else {
          Alert.alert('Error', 'No se pudo cargar el detalle.');
        }
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'No se pudo cargar el detalle.');
      } finally {
        setLoading(false);
      }
    })();
  }, [gastoId, gid]);

  /* ====== HTML del PDF ====== */
  const buildPdfHtml = useCallback((logoDataUri?: string | null) => {
    const fecha = new Date().toLocaleString('es-CL');

    const rowsHtml = filas
      .map(
        (f) => `
      <tr>
        <td class="left">
          <div class="chip">${escapeHtml(f.nombre?.charAt(0) || '?')}</div>
          <span class="name">${escapeHtml(f.nombre)}</span>
        </td>
        <td class="center">${escapeHtml(f.pendiente)}</td>
        <td class="center">${
          f.pagado
            ? '<span class="estado ok">Pagado &#10004;</span>'
            : '<span class="estado wait">Pendiente &#128337;</span>'
        }</td>
      </tr>`
      )
      .join('');

    const logoHtml = logoDataUri
      ? `<img src="${logoDataUri}" style="width:44px;height:44px;border-radius:12px;object-fit:cover" />`
      : `<div class="logo">🧾</div>`;

    const nombreGrupo = grupoResumen?.nombre || '—';
    const creador = grupoResumen?.creador_nombre || '—';
    const fechaInicio = formatFecha(grupoResumen?.fecha_inicio);
    const fechaCierre = formatFecha(grupoResumen?.fecha_cierre ?? null);

    const gastosGrupoHtml = (gastosGrupo ?? [])
      .sort((a, b) => {
        const da = a.fecha_registro ? new Date(a.fecha_registro).getTime() : 0;
        const db = b.fecha_registro ? new Date(b.fecha_registro).getTime() : 0;
        return db - da;
      })
      .map(
        (g) => `
      <tr>
        <td>${escapeHtml(g.descripcion || '—')}</td>
        <td class="center">${escapeHtml(formatFecha(g.fecha_registro))}</td>
        <td class="right"><strong>${escapeHtml(formatCLP(g.monto_total))}</strong></td>
      </tr>`
      )
      .join('');

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
  .logo{ width:44px; height:44px; border-radius:12px; background:${PRIMARY_10}; display:flex; align-items:center; justify-content:center }
  .label{ font-size:12px; color:#64748B; text-transform:uppercase; letter-spacing:.5px; margin:0 }
  .title{ font-size:22px; font-weight:800; margin:2px 0 0 }
  .divider{ height:1px; background:#E2E8F0; margin:16px 0 }
  .row{ display:flex; gap:12px; align-items:center; flex-wrap:wrap; justify-content:space-between }
  .meta{ display:flex; gap:10px; flex-wrap:wrap }
  .meta .kv{ font-size:13px; color:#0F172A; background:#F8FAFB; border:1px solid #E2E8F0; padding:6px 10px; border-radius:10px }
  .total{ font-size:18px; font-weight:800; color:${PRIMARY} }
  table{ width:100%; border-collapse:collapse; margin-top:10px }
  thead th{ background:#F8FAFB; color:#64748B; font-size:11px; text-transform:uppercase; letter-spacing:.6px; text-align:left; padding:10px 12px; border-bottom:1px solid #E2E8F0 }
  td{ padding:12px; border-bottom:1px solid #E2E8F0; font-size:14px }
  tr:last-child td{ border-bottom:0 }
  .left{ display:flex; align-items:center; gap:10px }
  .chip{ width:28px; height:28px; border-radius:999px; background:${PRIMARY_10}; color:${PRIMARY}; font-weight:800; display:flex; align-items:center; justify-content:center }
  .name{ font-weight:600 }
  .center{ text-align:center }
  .right{ text-align:right }
  .estado{ font-weight:700; font-size:12px; padding:4px 8px; border-radius:8px }
  .ok{ color:#10B981; background:rgba(16,185,113,.10) }
  .wait{ color:#F59E0B; background:rgba(245,158,11,.12) }
  .footer{ margin-top:14px; color:#64748B; font-size:12px }
  .sectionTitle{ font-size:14px; font-weight:800; color:#0F172A; margin:14px 0 4px }
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
      <div class="meta">
        <span class="kv"><strong>Grupo:</strong> ${escapeHtml(nombreGrupo)}</span>
        <span class="kv"><strong>Creador:</strong> ${escapeHtml(creador)}</span>
        <span class="kv"><strong>Inicio del grupo:</strong> ${escapeHtml(fechaInicio)}</span>
      </div>
    </div>

    <div class="sectionTitle">Gasto Puntual Evento</div>
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

    <div class="sectionTitle">Gastos Del Grupo En Evento</div>
    <table>
      <thead>
        <tr>
          <th>Gasto</th>
          <th class="center">Fecha</th>
          <th class="right">Monto</th>
        </tr>
      </thead>
      <tbody>
        ${gastosGrupoHtml || '<tr><td colspan="3" class="center" style="color:#64748B">Sin registros</td></tr>'}
      </tbody>
    </table>

    <div class="footer">Generado en Reparte+ • ${escapeHtml(fecha)} • Plataforma: ${Platform.OS}</div>
  </div>
</body>
</html>`;
  }, [filas, header, grupoResumen, gastosGrupo]);

  /* ====== Exportar PDF ====== */
  const onExportPdf = useCallback(async () => {
    try {
      if (!header?.titulo || !header?.total) {
        Alert.alert('Sin datos', 'Aún no hay información para exportar.');
        return;
      }
      setSubmitting(true);

      const logoDataUri = await loadLogoDataUri();
      const html = buildPdfHtml(logoDataUri || undefined);
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const filename = `${safeName(header.titulo)}_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
      const dest = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.copyAsync({ from: uri, to: dest });

      await Sharing.shareAsync(dest, {
        dialogTitle: `Detalle de gasto - ${header.titulo}`,
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo generar el PDF');
    } finally {
      setSubmitting(false);
    }
  }, [buildPdfHtml, header]);

  /* ====== UI ====== */
  return (
    <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
      {/* HEADER */}
      <View style={s.header}>
        <Pressable onPress={goBack} style={s.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={PRIMARY} />
        </Pressable>
        <Text style={s.appTitle}>Reparte+</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* CARD RESUMEN */}
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

      {/* INTEGRANTES */}
      <View style={s.sectionHeader}>
        <MaterialCommunityIcons name="account-group" size={18} color={PRIMARY} />
        <Text style={s.sectionTitle}>Gasto Puntual Evento</Text>
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
        ) : filas.length === 0 ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <MaterialCommunityIcons name="folder-open-outline" size={40} color={TEXT_MUTED} />
            <Text style={{ color: TEXT_MUTED, marginTop: 8 }}>Sin integrantes para este gasto.</Text>
          </View>
        ) : (
          filas.map((item, index) => (
            <View key={item.id} style={[s.row, index === filas.length - 1 && s.rowLast]}>
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
                  <View style={s.pillOk}>
                    <Text style={s.pillOkText}>Pagado</Text>
                    <Text style={s.pillOkIcon}> ✔︎</Text>
                  </View>
                ) : (
                  <View style={s.pillWait}>
                    <Text style={s.pillWaitText}>Pendiente</Text>
                    <MaterialCommunityIcons name="clock-outline" size={14} color={PENDING} style={{ marginLeft: 6 }} />
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* REGISTRO GASTOS DEL GRUPO */}
      <View style={s.sectionHeader}>
        <MaterialCommunityIcons name="file-clock-outline" size={18} color={PRIMARY} />
        <Text style={s.sectionTitle}> Gastos Del Grupo En Evento </Text>
      </View>

      <View style={s.tableWrapper}>
        <View style={s.tableHeader}>
          <Text style={[s.th, s.colGasto]}>GASTO</Text>
          <Text style={[s.th, s.colFecha, s.center]}>FECHA</Text>
          <Text style={[s.th, s.colMonto, s.right]}>MONTO</Text>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator color={PRIMARY} />
            <Text style={{ color: TEXT_MUTED, marginTop: 8 }}>Cargando…</Text>
          </View>
        ) : gastosGrupo.length === 0 ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <Text style={{ color: TEXT_MUTED }}>Sin registros</Text>
          </View>
        ) : (
          gastosGrupo
            .slice()
            .sort((a, b) => {
              const da = a.fecha_registro ? new Date(a.fecha_registro).getTime() : 0;
              const db = b.fecha_registro ? new Date(b.fecha_registro).getTime() : 0;
              return db - da;
            })
            .map((g, idx) => (
              <View key={String(g.id)} style={[s.row, idx === gastosGrupo.length - 1 && s.rowLast]}>
                <Text style={[s.cellText, s.colGasto]} numberOfLines={1}>
                  {g.descripcion}
                </Text>
                <Text style={[s.cellText, s.colFecha, s.center]}>{formatFecha(g.fecha_registro)}</Text>
                <Text style={[s.cellText, s.colMonto, s.right]}>{formatCLP(g.monto_total)}</Text>
              </View>
            ))
        )}
      </View>

      {/* BOTÓN PDF */}
      <Pressable onPress={onExportPdf} disabled={submitting} style={[s.primaryBtn, submitting && { opacity: 0.7 }]}>
        <MaterialCommunityIcons name="file-download-outline" size={18} color="#fff" />
        <Text style={s.primaryBtnText}>{submitting ? 'Generando PDF…' : 'Exportar PDF'}</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ====== Estilos ====== */
const s = StyleSheet.create({

  header: { 
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
  marginTop: Platform.OS === 'android' ? 30 : 40, // 🔥 baja el header según el dispositivo
},
  backBtn: { backgroundColor: CARD, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: BORDER },
  appTitle: { fontSize: 22, fontWeight: '800', color: PRIMARY },

  /* Summary */
  summaryCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(14,165,164,0.08)',
    shadowColor: PRIMARY,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: PRIMARY_10, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  summaryInfo: { flex: 1 },
  summaryLabel: { fontSize: 12, color: TEXT_MUTED, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryTitle: { fontSize: 22, fontWeight: '800', color: INK },
  divider: { height: 1, backgroundColor: BORDER, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryItemLabel: { fontSize: 11, color: TEXT_MUTED, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryItemValue: { fontSize: 18, fontWeight: '700', color: PRIMARY },
  summaryDividerVertical: { width: 1, height: 28, backgroundColor: BORDER },

  /* Secciones & tablas */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: INK },
  tableWrapper: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  th: { fontSize: 10, fontWeight: '700', color: TEXT_MUTED, letterSpacing: 0.8 },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  rowLast: { borderBottomWidth: 0 },

  avatarNameContainer: { flex: 1.4, flexDirection: 'row', alignItems: 'center', minWidth: 110 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: PRIMARY_10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { fontSize: 13, fontWeight: '800', color: PRIMARY },

  colIntegrante: { flex: 1.4, minWidth: 110 },
  colIntegranteText: { flex: 1 },
  colPendiente: { flex: 1.1, minWidth: 90 },
  colPagado: { width: 96 },

  cellText: { fontSize: 14, color: INK, fontWeight: '600', flexShrink: 1 },
  center: { textAlign: 'center', alignItems: 'center', justifyContent: 'center' } as any,
  right: { textAlign: 'right' } as any,

  /* badges/estado */
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(16,185,113,0.1)', minWidth: 72 },
  badgePending: { backgroundColor: 'rgba(245,158,11,0.12)' },
  badgeText: { fontSize: 12, fontWeight: '800', color: SUCCESS, textAlign: 'center' },
  badgeTextPending: { color: PENDING },

  pillOk: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,113,.10)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  pillOkText: { color: SUCCESS, fontSize: 12, fontWeight: '900' },
  pillOkIcon: { color: SUCCESS, fontWeight: '900', fontSize: 12, marginLeft: 2 },

  pillWait: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  pillWaitText: { color: PENDING, fontSize: 12, fontWeight: '900' },

  /* columnas registro */
  colGasto: { flex: 1.4, minWidth: 120 },
  colFecha: { flex: 1, minWidth: 86 },
  colMonto: { flex: 0.9, minWidth: 90 },

  /* Botón PDF */
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 14, gap: 8,
    shadowColor: PRIMARY, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
