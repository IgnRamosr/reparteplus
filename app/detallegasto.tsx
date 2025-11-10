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

/* ====== Dinero (minor → major) ====== */
const CURRENCY_DECIMALS: Record<string, number> = {
  CLP: 0, USD: 2, EUR: 2, ARS: 2, BRL: 2, MXN: 2, COP: 2, PEN: 2
};
function getDecimals(moneda?: string, fallback?: number) {
  if (typeof fallback === 'number') return fallback;
  return CURRENCY_DECIMALS[String(moneda || '').toUpperCase()] ?? 0;
}
function toMajorUnits(minor: number, decimals: number) {
  return decimals > 0 ? minor / Math.pow(10, decimals) : minor;
}
function formatMoney(minor: number | string, moneda = 'CLP', decOverride?: number) {
  const dec = getDecimals(moneda, decOverride);
  const n = Number(minor ?? 0);
  if (Number.isNaN(n)) return '—';
  const major = toMajorUnits(n, dec);
  return major.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ` ${moneda}`;
}

/* ====== Tipos ====== */
type Fila = { id: string; nombre: string; pendiente: string; pagado: boolean };

type GastoDetalleResp = {
  gasto: {
    id: string | number;
    grupo_id: string | number;
    descripcion: string;
    moneda: string;
    monto_total: number;   // MINOR
    decimales?: number;
    fecha_registro?: string;
  };
  integrantes: Array<{
    participante_id: string | number;
    nombre: string;
    monto_asignado: number; // MINOR
    monto_pagado: number;   // MINOR
    pendiente: number;      // MINOR
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
  monto_total: number;   // MINOR
  moneda?: string;
  decimales?: number;
  fecha_registro?: string;
};

/* ====== Helpers de fecha SIN desfase ====== */
/** Muestra fecha respetando el día original sin correr por timezone. */
function formatFechaSeguro(src?: string | null) {
  if (!src) return '—';
  const s = String(src).trim();
  // Caso fecha pura YYYY-MM-DD -> construir en local sin TZ.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    const dLocal = new Date(y, (m ?? 1) - 1, d ?? 1);
    return dLocal.toLocaleDateString('es-CL');
  }
  // Caso ISO con hora (posible Z): tomar componentes UTC para no desplazar el día.
  const dIso = new Date(s);
  if (!isNaN(dIso.getTime())) {
    const y = dIso.getUTCFullYear();
    const m = dIso.getUTCMonth();
    const d = dIso.getUTCDate();
    const dLocal = new Date(y, m, d); // recreo solo con Y/M/D
    return dLocal.toLocaleDateString('es-CL');
  }
  return '—';
}

/** Timestamp para ordenar fechas sin correrse por TZ */
function timeForSort(src?: string) {
  if (!src) return 0;
  const s = String(src).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
  }
  const dIso = new Date(s);
  if (!isNaN(dIso.getTime())) {
    // Ordenar por día UTC (00:00:00) para evitar drift
    return Date.UTC(dIso.getUTCFullYear(), dIso.getUTCMonth(), dIso.getUTCDate());
  }
  return 0;
}

/* ====== Otros helpers ====== */
const escapeHtml = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
           .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const safeName = (s: string) =>
  (s || 'gasto').replace(/[^\p{L}\p{N}\-_ ]/gu, '').replace(/\s+/g, '_').slice(0, 60);

/** Convierte a entero base 10 (o null si no es número) */
const toInt = (v: unknown) => {
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number.parseInt(String(s ?? '').trim(), 10);
  return Number.isNaN(n) ? null : n;
};
/** Si es numérico devuelvo número; si no, devuelvo el original (útil para params) */
const asNumberIfNumeric = (v: unknown) => {
  const n = toInt(v);
  return n ?? v;
};

/* Descripción robusta */
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
    moneda: r.moneda ?? 'CLP',
    decimales: r.decimales,
    // Mantengo el string original; el formateo/orden usa helpers "seguros"
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
  const { gasto, grupoId, cerrado: cerradoParam } =
    useLocalSearchParams<{ gasto?: string; grupoId?: string; cerrado?: string }>();

  // Normalizo posibles string[] de los params
  const gastoIdRaw = Array.isArray(gasto) ? gasto[0] : gasto;
  const gidRaw     = Array.isArray(grupoId) ? grupoId[0] : grupoId;

  // Convierto a número cuando sea posible
  const gastoIdNum = toInt(gastoIdRaw);
  const gidNum     = toInt(gidRaw);

  // Flag de cerrado forzado desde la pantalla anterior
  const cerradoForzado =
    typeof cerradoParam !== 'undefined'
      ? (cerradoParam === '1' || String(cerradoParam).toLowerCase() === 'true')
      : null;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [header, setHeader] = useState<{ titulo: string; total: string; id: string; grupoId?: string | number }>({
    titulo: '—',
    total: '—',
    id: String(gastoIdRaw ?? '—'),
    grupoId: gidRaw,
  });

  const [filas, setFilas] = useState<Fila[]>([]);
  const [grupoResumen, setGrupoResumen] = useState<GrupoResumen | null>(null);
  const [gastosGrupo, setGastosGrupo] = useState<GastoGrupo[]>([]);

  const goBack = useCallback(() => { router.replace({ pathname: '/DetalleGrupo', params: { id: gidRaw } }); return true; }, [gidRaw]);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
      return () => sub.remove();
    }, [goBack])
  );

  /* ====== Loaders ====== */
  // ABIERTO: apiGasto '/gasto-detalle'
  const loadAbierto = useCallback(async () => {
    const resp = await apiGasto.get<GastoDetalleResp>('/gasto-detalle', {
      params: { gastoId: gastoIdNum ?? gastoIdRaw }
    });
    if (!(resp.status >= 200 && resp.data?.gasto)) throw new Error('No se pudo cargar detalle (abierto).');

    const g = resp.data.gasto;
    const grupoIdResolved = (typeof g.grupo_id !== 'undefined' ? g.grupo_id : (gidNum ?? gidRaw));
    const dec = getDecimals(g.moneda, g.decimales);

    setHeader({
      titulo: g.descripcion || '—',
      total: formatMoney(g.monto_total, g.moneda, dec),
      id: String(g.id ?? (gastoIdNum ?? gastoIdRaw)),
      grupoId: grupoIdResolved,
    });

    setFilas(
      (resp.data.integrantes ?? []).map((p) => ({
        id: String(p.participante_id),
        nombre: p.nombre,
        pendiente: formatMoney(p.pendiente, g.moneda, dec),
        pagado: !!p.estado,
      }))
    );

    // Meta grupo
    try {
      const gr = await apiGrupo.get('/grupo', { params: { grupoId: asNumberIfNumeric(grupoIdResolved), _t: Date.now() } });
      if (gr.status >= 200 && gr.data) setGrupoResumen(mapGrupo(gr.data, grupoIdResolved as any));
    } catch {}

    // Registro de gastos (abierto)
    const _t = Date.now();
    let reg: any[] = [];
    try {
      const r0 = await apiGasto.get('/gastos', { params: { grupoId: asNumberIfNumeric(grupoIdResolved), _t } });
      const raw = r0?.data?.resultados ?? r0?.data;
      if (Array.isArray(raw)) reg = raw;
    } catch {}
    if (!reg.length) {
      try {
        const r1 = await apiGrupo.get('/grupo/gastos', { params: { grupoId: asNumberIfNumeric(grupoIdResolved), _t } });
        const raw1 = Array.isArray(r1?.data) ? r1.data : (r1?.data?.items ?? []);
        if (Array.isArray(raw1)) reg = raw1;
      } catch {}
    }
    setGastosGrupo(mapGastos(reg));
  }, [gastoIdNum, gastoIdRaw, gidNum, gidRaw]);

  // CERRADO: apiGrupo '/gasto/liquidado'
  const loadCerrado = useCallback(async (grupoIdResolved?: string | number) => {
    const liqParams: any = {
      gastoId:  gastoIdNum ?? gastoIdRaw,
      gasto_id: gastoIdNum ?? gastoIdRaw,
      id:       gastoIdNum ?? gastoIdRaw,
    };
    const gidQuery = typeof grupoIdResolved !== 'undefined' ? grupoIdResolved : (gidNum ?? gidRaw);
    if (gidQuery != null) liqParams.grupoId = asNumberIfNumeric(gidQuery);

    let r: any;
    try {
      r = await apiGrupo.get('/gasto/liquidado', { params: liqParams });
    } catch {
      r = await apiGrupo.get('/gasto/liquidado', {
        params: { gastoId: gastoIdNum ?? gastoIdRaw, gasto_id: gastoIdNum ?? gastoIdRaw, id: gastoIdNum ?? gastoIdRaw }
      });
    }

    const g = r?.data;
    if (!g || !(g.gasto_id || g.id)) throw new Error('No se pudo cargar detalle (cerrado).');

    const gidResolved = g.grupo_id ?? gidQuery;

    setHeader({
      titulo: g.concepto || g.descripcion || '—',
      total: formatMoney(g.monto_base_min ?? g.total_base_min ?? g.monto ?? 0, 'CLP', 0),
      id: String(g.gasto_id ?? g.id ?? (gastoIdNum ?? gastoIdRaw)),
      grupoId: gidResolved,
    });

    const asign = Array.isArray(g.asignaciones) ? g.asignaciones : (g.integrantes ?? []);
    setFilas(
      asign.map((a: any) => ({
        id: String(a.participante_id ?? a.id ?? a.pid ?? Math.random()),
        nombre: a.participante_nombre ?? a.nombre ?? '—',
        pendiente: formatMoney(
          a.pendiente_base_min ??
          Math.max((a.asignado_base_min ?? a.asignado ?? 0) - (a.pagado_base_min ?? a.pagado ?? 0), 0),
          'CLP',
          0
        ),
        pagado: !!(a.estado ?? a.pagado_total ?? (a.pendiente_base_min === 0)),
      }))
    );

    // Meta grupo
    try {
      const gr = await apiGrupo.get('/grupo', { params: { grupoId: asNumberIfNumeric(gidResolved), _t: Date.now() } });
      if (gr.status >= 200 && gr.data) setGrupoResumen(mapGrupo(gr.data, gidResolved as any));
    } catch {}

    // Registro de gastos liquidados (CLP)
    let reg: any[] = [];
    try {
      const r2 = await apiGrupo.get('/grupo/gastos-liquidados', { params: { grupoId: asNumberIfNumeric(gidResolved), _t: Date.now() } });
      const raw = r2?.data?.gastos_liquidados ?? r2?.data ?? [];
      reg = Array.isArray(raw) ? raw : [];
    } catch {
      try {
        const r3 = await apiGrupo.get('/grupo/gastos', { params: { grupoId: asNumberIfNumeric(gidResolved), _t: Date.now() } });
        const raw3 = Array.isArray(r3?.data) ? r3.data : (r3?.data?.items ?? []);
        reg = Array.isArray(raw3) ? raw3 : [];
      } catch {}
    }

    setGastosGrupo(
      reg.map((row: any, i: number) => ({
        id: row.gasto_id ?? row.id ?? i,
        descripcion: row.concepto ?? row.descripcion ?? '—',
        monto_total: Number(row.monto_base_min ?? row.total_base_min ?? row.monto ?? 0),
        moneda: 'CLP',
        decimales: 0,
        fecha_registro: row.fecha ?? row.fecha_registro ?? row.created_at ?? undefined,
      }))
    );
  }, [gastoIdNum, gastoIdRaw, gidNum, gidRaw]);

  /* ====== Carga ====== */
  useEffect(() => {
    (async () => {
      if (gastoIdNum == null && !gastoIdRaw) {
        setLoading(false);
        Alert.alert('Falta parámetro', 'No se recibió el id del gasto.');
        return;
      }
      try {
        setLoading(true);

        if (cerradoForzado === true) {
          await loadCerrado(gidNum ?? gidRaw);
          return;
        }
        if (cerradoForzado === false) {
          await loadAbierto();
          return;
        }

        let cerrado: boolean | null = null;
        let grupoIdResolved: string | number | undefined = (gidNum ?? gidRaw);

        if (gidNum != null || gidRaw) {
          try {
            const gr = await apiGrupo.get('/grupo', { params: { grupoId: asNumberIfNumeric(gidNum ?? gidRaw), _t: Date.now() } });
            if (gr.status >= 200 && gr.data) {
              const meta = mapGrupo(gr.data, (gidNum ?? gidRaw) as any);
              setGrupoResumen(meta);
              cerrado = !!meta.fecha_cierre;
              grupoIdResolved = meta.grupo_id;
            }
          } catch { /* noop */ }
        }

        if (cerrado === true) {
          await loadCerrado(grupoIdResolved);
        } else if (cerrado === false) {
          await loadAbierto();
        } else {
          try { await loadAbierto(); } catch { await loadCerrado(grupoIdResolved); }
        }
      } catch (e: any) {
        const msg = e?.response?.data?.error || e?.message || 'No se pudo cargar el detalle.';
        Alert.alert('Error', msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [gastoIdNum, gastoIdRaw, gidNum, gidRaw, cerradoForzado, loadAbierto, loadCerrado]);

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
    const fechaInicio = formatFechaSeguro(grupoResumen?.fecha_inicio);

    const gastosGrupoHtml = (gastosGrupo ?? [])
      .sort((a, b) => timeForSort(b.fecha_registro) - timeForSort(a.fecha_registro))
      .map(
        (g) => `
      <tr>
        <td>${escapeHtml(g.descripcion || '—')}</td>
        <td class="center">${escapeHtml(formatFechaSeguro(g.fecha_registro))}</td>
        <td class="right"><strong>${
          escapeHtml(formatMoney(g.monto_total, g.moneda ?? 'CLP', getDecimals(g.moneda, g.decimales)))
        }</strong></td>
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
        ${(gastosGrupo ?? [])
          .sort((a, b) => timeForSort(b.fecha_registro) - timeForSort(a.fecha_registro))
          .map(
            (g) => `
          <tr>
            <td>${escapeHtml(g.descripcion || '—')}</td>
            <td class="center">${escapeHtml(formatFechaSeguro(g.fecha_registro))}</td>
            <td class="right"><strong>${
              escapeHtml(formatMoney(g.monto_total, g.moneda ?? 'CLP', getDecimals(g.moneda, g.decimales)))
            }</strong></td>
          </tr>`
          ).join('') || '<tr><td colspan="3" class="center" style="color:#64748B">Sin registros</td></tr>'}
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
            .sort((a, b) => timeForSort(b.fecha_registro) - timeForSort(a.fecha_registro))
            .map((g, idx) => (
              <View key={String(g.id)} style={[s.row, idx === gastosGrupo.length - 1 && s.rowLast]}>
                <Text style={[s.cellText, s.colGasto]} numberOfLines={1}>
                  {g.descripcion}
                </Text>
                <Text style={[s.cellText, s.colFecha, s.center]}>{formatFechaSeguro(g.fecha_registro)}</Text>
                <Text style={[s.cellText, s.colMonto, s.right]}>
                  {formatMoney(g.monto_total, g.moneda ?? 'CLP', getDecimals(g.moneda, g.decimales))}
                </Text>
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
    marginTop: Platform.OS === 'android' ? 30 : 40,
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
