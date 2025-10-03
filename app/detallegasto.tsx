// app/detallegasto.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';

// ====== PALETA LedgerTeal ======
const PRIMARY = '#0EA5A4';
const PRIMARY_LIGHT = '#10B9B8';
const PRIMARY_DARK = '#0C8988';
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
  pendiente: string;
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
    return new Intl.NumberFormat('es-CL').format(num) + 'CLP';
  } catch {
    return String(num) + 'CLP';
  }
}

export default function DetalleGastoScreen() {
  const { gasto } = useLocalSearchParams<{ gasto?: string }>();
  const gastoId = Array.isArray(gasto) ? gasto[0] : gasto;

  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState<{ titulo: string; total: string; id: string }>({
    titulo: '—',
    total: '—',
    id: gastoId ?? '—',
  });
  const [filas, setFilas] = useState<Fila[]>([]);

  // Cargar detalle real
  useEffect(() => {
    (async () => {
      if (!gastoId) {
        setLoading(false);
        Alert.alert('Falta parámetro', 'No se recibió el id del gasto.');
        return;
      }
      try {
        setLoading(true);
        const resp = await apiGasto.get<GastoDetalleResp>('/gasto-detalle', {
          params: { gastoId },
        });

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
        const msg = e?.response?.data?.message || e?.message || 'No se pudo cargar el detalle';
        Alert.alert('Error', msg);
        setFilas([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [gastoId]);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
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
          <View style={s.summaryItem}>
            <Text style={s.summaryItemLabel}>ID</Text>
            <Text style={s.summaryItemValueSmall}>{header.id}</Text>
          </View>
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

      {/* Botones secundarios (placeholders) */}
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
          onPress={() => {}}
          style={({ pressed }) => [s.primaryBtn, pressed && s.primaryBtnPressed]}
          android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
        >
          <View style={s.btnContent}>
            <MaterialCommunityIcons name="file-download-outline" size={18} color="#fff" />
            <Text style={s.primaryBtnText}>Exportar PDF</Text>
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
  summaryItemValueSmall: { fontSize: 14, fontWeight: '600', color: INK },
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
