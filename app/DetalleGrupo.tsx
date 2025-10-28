// app/grupos/[id].tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert,
  DeviceEventEmitter, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, Platform,
} from 'react-native';
import { useLocalSearchParams, router, type Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';

const apiGrupo = axios.create({
  baseURL: 'https://ee61hfpl8e.execute-api.us-east-1.amazonaws.com/production',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true,
});

const apiGasto = axios.create({
  baseURL: 'https://amzcxtvh06.execute-api.us-east-1.amazonaws.com/production',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true,
});

type Grupo = {
  id: string | number;
  nombre: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_cierre: string;
  creador?: string; // creador_nombre
};

type Gasto = {
  id: string;
  concepto: string;
  pagador: string;
  estado: boolean;
  moneda?: string;
  monto?: string | number;
};

export default function DetalleGrupo() {
  const params = useLocalSearchParams<{
    id: string;
    nombre?: string;
    descripcion?: string;
    fecha_inicio?: string;
    fecha_cierre?: string;
    creador_nombre?: string;
    _refresh?: string;
  }>();

  const { id, nombre, descripcion, fecha_inicio, fecha_cierre, creador_nombre } = params;
  const { width: SCREEN_W } = useWindowDimensions();

  const [cargando, setCargando] = useState<boolean>(false);
  const [grupo, setGrupo] = useState<Grupo | null>(() =>
    id
      ? {
          id,
          nombre: nombre ?? '',
          descripcion: descripcion ?? '',
          fecha_inicio: fecha_inicio ?? '',
          fecha_cierre: fecha_cierre ?? '',
          creador: creador_nombre ?? undefined,
        }
      : null
  );

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loadingGastos, setLoadingGastos] = useState<boolean>(false);

  // ===== Cargar meta del grupo desde API =====
  const fetchGrupoMeta = useCallback(async (gid: string) => {
    if (!gid) return;
    try {
      setCargando(true);
      const resp = await apiGrupo.get('/grupo', { params: { grupoId: gid } });

      if (resp.status >= 200 && resp.status < 300 && resp.data) {
        const g = resp.data;
        setGrupo({
          id: gid,
          nombre: g.nombre ?? '',
          descripcion: g.descripcion ?? '',
          fecha_inicio: g.fecha_inicio ?? '',
          fecha_cierre: g.fecha_cierre ?? '',
          creador: g.creador_nombre ?? undefined,
        });
      } else {
        Alert.alert('Error', `(${resp.status}) No se pudo cargar el grupo.`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Error cargando el grupo.');
    } finally {
      setCargando(false);
    }
  }, []);

  // ===== Cargar gastos REALES por grupo =====
  const fetchGastos = useCallback(async (grupoId: string) => {
    if (!grupoId) return;
    try {
      setLoadingGastos(true);
      const resp = await apiGasto.get('/gastos', { params: { grupoId } });
      if (resp.status >= 200 && resp.status < 300) {
        const arr: any[] = resp.data?.resultados ?? resp.data?.gastos ?? [];
        const mapped: Gasto[] = arr.map(r => ({
          id: String(r.id ?? r.gasto_id ?? ''),
          concepto: String(r.concepto ?? r.descripciongasto ?? '—'),
          pagador: String(r.pagador ?? r.pagador_nombre ?? r.nombre_pagador ?? '—'),
          estado: typeof r.estado === 'boolean' ? r.estado : Boolean(r.pagado ?? false),
          moneda: r.moneda ?? 'CLP',
          monto: r.monto ?? undefined,
        }));
        setGastos(mapped);
      } else {
        setGastos([]);
        console.warn('Error /gastos', resp.status, resp.data);
      }
    } catch (e) {
      setGastos([]);
      console.warn('Error cargando gastos', e);
    } finally {
      setLoadingGastos(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    if (!id) return;
    (async () => {
      await fetchGrupoMeta(String(id));
      await fetchGastos(String(id));
    })();
  }, [id, fetchGrupoMeta, fetchGastos]);

  // Refresco al volver a enfocar
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const t = setTimeout(() => {
        fetchGrupoMeta(String(id));
        fetchGastos(String(id));
      }, 120);
      return () => clearTimeout(t);
    }, [id, fetchGrupoMeta, fetchGastos])
  );

  // Escucha: gasto creado
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('gasto:creado', (nuevo: any) => {
      const normalizado: Gasto = {
        id: String(nuevo.id ?? nuevo.gasto_id ?? `tmp-${Date.now()}`),
        concepto: String(nuevo.concepto ?? nuevo.descripciongasto ?? '—'),
        pagador: String(nuevo.pagador ?? nuevo.pagador_nombre ?? '—'),
        estado: typeof nuevo.estado === 'boolean' ? nuevo.estado : Boolean(nuevo.pagado ?? false),
        moneda: nuevo.moneda ?? 'CLP',
        monto: nuevo.monto ?? undefined,
      };
      setGastos(prev => [normalizado, ...prev]);
    });
    return () => sub.remove();
  }, []);

  const safePush = (href: Href) => router.replace(href);

  // === Navegaciones / acciones ===
  const goRegistrarGasto = useCallback(() => {
    const groupId = String(grupo?.id ?? id ?? '');
    safePush({ pathname: '/RegistrarGasto', params: { grupo: groupId } });
  }, [grupo?.id, id]);

  const goInvitar = useCallback(() => {
    const groupId = String(grupo?.id ?? id ?? '');
    safePush({ pathname: '/InvitacionParticipantesGeneral', params: { grupoId: groupId, nombreGrupo: grupo?.nombre } });
  }, [grupo?.id, id, grupo?.nombre]);

  const goConfirmacionInvitados = () => {
    const groupId = String(grupo?.id ?? id ?? '');
    router.replace({
      pathname: '/ConfirmacionInvitados',
      params: {
        grupo: groupId,
        groupName: grupo?.nombre ?? '',        // ← nombre del grupo
        creador_nombre: grupo?.creador ?? '',  // ← creador
      },
    });
  };

  const verGasto = (gastoId: string) => {
    safePush({ pathname: '/detallegasto', params: { gasto: gastoId, grupoId: String(grupo?.id ?? id ?? '') } });
  };

  const goEditarGasto = (gastoId: string) => {
    const groupId = String(grupo?.id ?? id ?? '');
    safePush({ pathname: '/EditarGasto', params: { grupo: groupId, gasto: gastoId, nombreGrupo: grupo?.nombre } });
  };

  const verGrafico = useCallback(() => {
  const groupId = String(grupo?.id ?? id ?? '');
  router.push({
    pathname: './GraficoGastosEvento',
    params: {
      id: groupId,
      nombre: grupo?.nombre ?? '',
    },
  });
  }, [grupo?.id, id, grupo?.nombre]);

 // Placeholders en construcción
  const eliminarGrupo = () => {
    Alert.alert('En construcción', 'La eliminación de grupos estará disponible pronto.');
  };
  const cerrarGrupo = () => {
    Alert.alert('En construcción', 'El cierre de grupos estará disponible pronto.');
  };

  // ==== ACTUALIZAR GASTO (PATCH) ====
  const actualizarGasto = async (
    gastoId: string,
    { descripciongasto, moneda, monto }: { descripciongasto: string; moneda: string; monto: string }
  ) => {
    try {
      const resp = await apiGasto.patch('/gasto', {
        gastoId: Number(gastoId),
        updates: { descripciongasto, moneda, monto },
      });

      if (resp.status >= 200 && resp.status < 300) {
        Alert.alert('Éxito', 'Gasto actualizado correctamente.');
        setGastos(prev =>
          prev.map(g =>
            g.id === String(gastoId)
              ? { ...g, concepto: descripciongasto, moneda, monto }
              : g
          )
        );
      } else {
        console.warn('Respuesta PATCH gasto:', resp.data);
        Alert.alert('Error', `No se pudo actualizar el gasto. Código: ${resp.status}`);
      }
    } catch (e: any) {
      console.error('Error al actualizar gasto:', e);
      Alert.alert('Error', e?.message || 'No se pudo conectar con el servidor.');
    }
  };

  // ==== ELIMINAR GASTO (DELETE con body) ====
  const eliminarGastoItem = async (gastoId: string) => {
    Alert.alert(
      'Eliminar gasto',
      '¿Seguro que quieres eliminar este gasto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const resp = await apiGasto.delete('/gasto', { data: { gastoId } });
              if (resp.status >= 200 && resp.status < 300) {
                setGastos(prev => prev.filter(g => g.id !== gastoId));
                Alert.alert('Éxito', 'Gasto eliminado correctamente.');
              } else {
                console.warn('Error al eliminar gasto', resp.data);
                Alert.alert('Error', `No se pudo eliminar el gasto. Código: ${resp.status}`);
              }
            } catch (error: any) {
              console.error('Error al eliminar gasto:', error);
              Alert.alert('Error', error?.message || 'No se pudo conectar con el servidor.');
            }
          },
        },
      ]
    );
  };

  // Hint "desliza la tabla"
  const [tableContainerW, setTableContainerW] = useState(0);
  const [tableContentW, setTableContentW] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const onTableContainerLayout = (w: number) => setTableContainerW(w);
  const onTableContentSizeChange = (contentW: number) => setTableContentW(contentW);
  useEffect(() => { setShowScrollHint(tableContentW > tableContainerW + 1); }, [tableContainerW, tableContentW]);
  const handleTableScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (e.nativeEvent.contentOffset.x > 8 && showScrollHint) setShowScrollHint(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['top', 'left', 'right']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header con gradiente */}
        <LinearGradient colors={['#0EA5A4', '#14B8A6', '#10B981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <Pressable onPress={() => router.replace('/VerTodosLosGrupos')} style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]} hitSlop={10}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
              </Pressable>

              <Text style={styles.appTitle}>Reparte+</Text>

              {/* Botonera superior derecha: Editar, Basurero (eliminar grupo), Gráfico */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => {
                    if (!grupo) return;
                    router.replace({
                      pathname: '/CreacionGrupos',
                      params: {
                        modo: 'editar',
                        id: String(grupo.id),
                        nombre: grupo.nombre ?? '',
                        descripcion: grupo.descripcion ?? '',
                        fecha_inicio: grupo.fecha_inicio ?? '',
                        fecha_cierre: grupo.fecha_cierre ?? '',
                      },
                    } as const);
                  }}
                  style={({ pressed }) => [styles.iconTopBtn, pressed && styles.iconTopBtnPressed]}
                  hitSlop={10}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={22} color="#fff" />
                </Pressable>

                <Pressable onPress={eliminarGrupo} style={({ pressed }) => [styles.iconTopBtn, pressed && styles.iconTopBtnPressed]} hitSlop={10}>
                  <MaterialCommunityIcons name="trash-can-outline" size={22} color="#fff" />
                </Pressable>

                <Pressable onPress={verGrafico} style={({ pressed }) => [styles.iconTopBtn, pressed && styles.iconTopBtnPressed]} hitSlop={10}>
                  <MaterialCommunityIcons name="chart-line" size={22} color="#fff" />
                </Pressable>
              </View>
            </View>

            {cargando && !grupo?.nombre ? (
              <View style={styles.loadingHeader}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.loadingText}>Cargando grupo…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.groupName}>{grupo?.nombre || '—'}</Text>
                <Text style={styles.groupDesc}>{grupo?.descripcion || '—'}</Text>
              </>
            )}
          </View>
        </LinearGradient>

        {/* Tarjetas de información */}
        <View style={styles.infoCards}>
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="account-circle-outline" size={20} color={PRIMARY} />
            <Text style={styles.infoLabel}>Creador</Text>
            <Text style={styles.infoValue}>{String(grupo?.creador ?? '—')}</Text>
          </View>

          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="calendar-start" size={20} color={PRIMARY} />
            <Text style={styles.infoLabel}>Inicio</Text>
            <Text style={styles.infoValue}>{fmtCL(grupo?.fecha_inicio)}</Text>
          </View>

          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="calendar-end" size={20} color={PRIMARY} />
            <Text style={styles.infoLabel}>Término</Text>
            <Text style={styles.infoValue}>{fmtCL(grupo?.fecha_cierre)}</Text>
          </View>
        </View>

        {/* Tabla de gastos */}
        <Text style={styles.sectionTitle}>
          <MaterialCommunityIcons name="script-text-outline" size={20} color={TEXT} /> Registro de Gastos
        </Text>

        <View style={styles.tableWrapper} onLayout={e => onTableContainerLayout(e.nativeEvent.layout.width)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ minWidth: TABLE_MIN_WIDTH }}
            onContentSizeChange={(w: number) => onTableContentSizeChange(w)}
            onScroll={handleTableScroll}
            scrollEventThrottle={16}
          >
            <View style={styles.table}>
              <LinearGradient colors={['#0EA5A4', '#14B8A6']} style={styles.tableHeader}>
                <Text style={[styles.th, styles.colGasto]}>Gasto</Text>
                <Text style={[styles.th, styles.colPagador]}>Pagador</Text>
                <Text style={[styles.th, styles.colEstado, styles.centerText]}>Estado</Text>
                <Text style={[styles.th, styles.colAcciones, styles.centerText]}>Acciones</Text>
              </LinearGradient>

              {loadingGastos ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator />
                  <Text style={{ marginTop: 8, color: TEXT_MUTED }}>Cargando gastos…</Text>
                </View>
              ) : gastos.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="folder-open-outline" size={48} color={TEXT_MUTED} />
                  <Text style={styles.emptyTitle}>No hay gastos registrados</Text>
                  <Text style={styles.emptyDesc}>Comienza agregando el primer gasto del grupo</Text>
                </View>
              ) : (
                gastos.map((item, idx) => {
                  const isPaid = item.estado === true;
                  return (
                    <View key={item.id} style={[styles.tableRow, idx % 2 === 0 && styles.rowEven]}>
                      <View style={[styles.td, styles.colGasto]}>
                        <Text style={styles.conceptText} numberOfLines={2}>{item.concepto}</Text>
                      </View>
                      <View style={[styles.td, styles.colPagador]}>
                        <Text style={styles.pagadorText} numberOfLines={2}>{item.pagador}</Text>
                      </View>
                      <View style={[styles.td, styles.colEstado, styles.centerContent]}>
                        <View style={[styles.statusBadge, isPaid ? styles.badgePaid : styles.badgePending]}>
                          <MaterialCommunityIcons name={isPaid ? 'check-circle' : 'clock-outline'} size={14} color={isPaid ? '#047857' : '#DC2626'} />
                          <Text style={[styles.statusText, isPaid ? styles.statusPaid : styles.statusPending]}>
                            {isPaid ? 'Pagado' : 'Pendiente'}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.td, styles.colAcciones, styles.actionsCell]}>
                        <Pressable onPress={() => verGasto(item.id)} style={({ pressed }) => [styles.actionButton, styles.viewButton, pressed && styles.actionPressed]} hitSlop={8}>
                          <MaterialCommunityIcons name="eye-outline" size={16} color="#0EA5A4" />
                        </Pressable>
                        <Pressable onPress={() => goEditarGasto(item.id)} style={({ pressed }) => [styles.actionButton, styles.editButton, pressed && styles.actionPressed]} hitSlop={8}>
                          <MaterialCommunityIcons name="pencil-outline" size={16} color="#F59E0B" />
                        </Pressable>
                        <Pressable onPress={() => eliminarGastoItem(item.id)} style={({ pressed }) => [styles.actionButton, styles.deleteButton, pressed && styles.actionPressed]} hitSlop={8}>
                          <MaterialCommunityIcons name="delete-outline" size={16} color="#EF4444" />
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>

        {/* --- Botonera inferior (4 botones) --- */}
        <View style={styles.bottomButtonsRow}>
          <Pressable onPress={goInvitar} style={({ pressed }) => [styles.bottomBtn, pressed && styles.bottomBtnPressed]}>
            <MaterialCommunityIcons name="account-plus-outline" size={22} color="#fff" />
          </Pressable>

          <Pressable onPress={goConfirmacionInvitados} style={({ pressed }) => [styles.bottomBtn, pressed && styles.bottomBtnPressed]}>
            <MaterialCommunityIcons name="account-group-outline" size={22} color="#fff" />
          </Pressable>

          <Pressable onPress={goRegistrarGasto} style={({ pressed }) => [styles.bottomBtn, pressed && styles.bottomBtnPressed]}>
            <MaterialCommunityIcons name="note-edit-outline" size={22} color="#fff" />
          </Pressable>

          <Pressable onPress={cerrarGrupo} style={({ pressed }) => [styles.bottomBtn, pressed && styles.bottomBtnPressed]}>
            <MaterialCommunityIcons name="lock-outline" size={22} color="#fff" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function fmtCL(ymd?: string) {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ====== Estilos ====== */
const PRIMARY = '#0EA5A4';
const SECONDARY = '#14B8A6';
const BG = '#F8FBFC';
const TEXT = '#1F2937';
const TEXT_MUTED = '#6B7280';
const CARD = '#FFFFFF';
const BORDER = '#E5E7EB';

// Dimensiones de tabla
const COL_W_ESTADO = 110;
const COL_W_ACCIONES = 140;
const COL_MIN_GASTO = 160;
const COL_MIN_PAGADOR = 160;
const TABLE_MIN_WIDTH = COL_MIN_GASTO + COL_MIN_PAGADOR + COL_W_ESTADO + COL_W_ACCIONES + 40;

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, backgroundColor: BG, paddingBottom: 30 },

  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 20 : 30,
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: PRIMARY,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  headerContent: { paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },

  backBtn: { padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  backBtnPressed: { backgroundColor: 'rgba(255,255,255,0.25)', transform: [{ scale: 0.95 }] },

  appTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },

  iconTopBtn: { padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  iconTopBtnPressed: { backgroundColor: 'rgba(255,255,255,0.25)', transform: [{ scale: 0.95 }] },

  loadingHeader: { alignItems: 'center', paddingVertical: 20 },
  loadingText: { color: 'rgba(255,255,255,0.9)', marginTop: 8, fontSize: 14 },
  groupName: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  groupDesc: { fontSize: 16, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 22 },

  infoCards: { flexDirection: 'row', marginHorizontal: 20, marginTop: -15, gap: 12 },
  infoCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  infoLabel: { fontSize: 11, color: TEXT_MUTED, fontWeight: '600', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 13, color: TEXT, fontWeight: '700', marginTop: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: TEXT, marginHorizontal: 20, marginTop: 20, marginBottom: 12 },

  tableWrapper: { marginHorizontal: 20, marginTop: 8 },
  table: {
    backgroundColor: CARD, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  tableHeader: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16 },
  th: { fontSize: 12, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },

  tableRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  rowEven: { backgroundColor: '#FAFBFC' },
  td: { justifyContent: 'center' },

  colGasto: { minWidth: COL_MIN_GASTO, flexGrow: 1, paddingRight: 12 },
  colPagador: { minWidth: COL_MIN_PAGADOR, flexGrow: 1, paddingRight: 12 },
  colEstado: { width: COL_W_ESTADO },
  colAcciones: { width: COL_W_ACCIONES },

  centerText: { textAlign: 'center' },
  centerContent: { alignItems: 'center', justifyContent: 'center' },

  conceptText: { fontSize: 14, fontWeight: '600', color: TEXT },
  pagadorText: { fontSize: 13, color: TEXT_MUTED },

  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 4 },
  badgePaid: { backgroundColor: '#D1FAE5' },
  badgePending: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusPaid: { color: '#047857' },
  statusPending: { color: '#DC2626' },

  actionsCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  actionButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  actionPressed: { transform: [{ scale: 0.92 }], opacity: 0.8 },
  viewButton: { backgroundColor: '#E6FFFA', borderColor: '#5EEAD4' },
  editButton: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  deleteButton: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },

  emptyState: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: TEXT, marginTop: 12 },
  emptyDesc: { fontSize: 13, color: TEXT_MUTED, marginTop: 4 },

  
  bottomButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 30,
    gap: 12,
  },
  bottomBtn: {
    flex: 1,
    backgroundColor: PRIMARY,       
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,                  
    borderColor: SECONDARY,
    shadowColor: PRIMARY,            
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  bottomBtnPressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
});
