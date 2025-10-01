// app/grupos/[id].tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, type Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { obtenerNombreparticipante } from '@/lib/funcionesParticipante';

const api = axios.create({
  baseURL: 'https://ee61hfpl8e.execute-api.us-east-1.amazonaws.com/production',
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
  creador?: string;
};

type Gasto = {
  id: string;
  concepto: string;
  pagador: string;
  pagado: boolean;
  moneda?: string;
};

export default function DetalleGrupo() {
  const { id, nombre, descripcion, fecha_inicio, fecha_cierre, creador_nombre } =
    useLocalSearchParams<{
      id: string;
      nombre?: string;
      descripcion?: string;
      fecha_inicio?: string;
      fecha_cierre?: string;
      creador_nombre?: string;
    }>();

  const insets = useSafeAreaInsets();
  const { width: SCREEN_W } = useWindowDimensions();
  const SMALL = SCREEN_W < 360;

  const [creador, setCreador] = useState<string | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);

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

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (!creador_nombre) {
          const creadorGrupo = await obtenerNombreparticipante().catch(() => null);
          if (!cancel) setCreador(creadorGrupo);
        }
        if (!id) return;
        const resp = await api.get(`/grupo/${id}`);
        if (!cancel) {
          if (resp.status >= 200 && resp.status < 300 && resp.data) {
            const g = resp.data;
            setGrupo(prev => ({
              id,
              nombre: prev?.nombre || g.nombre,
              descripcion: prev?.descripcion || g.descripcion,
              fecha_inicio: prev?.fecha_inicio || g.fecha_inicio,
              fecha_cierre: prev?.fecha_cierre || g.fecha_cierre,
              creador: (prev?.creador ?? creador_nombre) ?? creador ?? undefined,
            }));
          }
          setCargando(false);
        }
      } catch {
        if (!cancel) setCargando(false);
      }
    })();
    return () => { cancel = true; };
  }, [id, creador_nombre]);

  const [gastos, setGastos] = useState<Gasto[]>([
    { id: 'g1', concepto: 'Bencina',   pagador: 'Luis Gonzalez',   pagado: false,  moneda: 'CLP' },
    { id: 'g2', concepto: 'Almuerzo',  pagador: 'Ignacio Ramos',   pagado: true,   moneda: 'CLP' },
    { id: 'g3', concepto: 'Desayuno',  pagador: 'Sebastián Tapia', pagado: false,  moneda: 'CLP' },
  ]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('gasto:creado', (nuevo: Gasto) => {
      setGastos(prev => [nuevo, ...prev]);
    });
    return () => sub.remove();
  }, []);

  const safePush = (href: Href) => router.push(href);

  const goRegistrarGasto = useCallback(() => {
    const groupId = String(grupo?.id ?? id ?? '');
    safePush({ pathname: '/RegistrarGasto', params: { grupo: groupId } });
  }, [grupo?.id, id]);

  const goInvitar = useCallback(() => {
    const groupId = String(grupo?.id ?? id ?? '');
    safePush({ pathname: '/InvitacionParticipantesGeneral', params: { grupoId: groupId, nombreGrupo: grupo?.nombre } });
  }, [grupo?.id, id]);

  const verGasto = (gastoId: string) => {
    safePush({ pathname: '/detallegasto', params: { gasto: gastoId } });
  };

  const editarGasto = (gastoId: string) => {
    const groupId = String(grupo?.id ?? id ?? '');
    safePush({ pathname: '/EditarGasto', params: { grupo: groupId, gasto: gastoId } });
  };

  const eliminarGasto = (gastoId: string) => {
    Alert.alert('Eliminar gasto', '¿Seguro que quieres eliminar este gasto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => setGastos(prev => prev.filter(g => g.id !== gastoId)),
      },
    ]);
  };

  const editarGrupo = () => {
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
  };

  /** =========================
   *  Aviso "desliza la tabla"
   *  ========================= */
  const [tableContainerW, setTableContainerW] = useState(0);
  const [tableContentW, setTableContentW] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const onTableContainerLayout = (w: number) => {
    setTableContainerW(w);
  };

  const onTableContentSizeChange = (contentW: number) => {
    setTableContentW(contentW);
  };

  useEffect(() => {
    setShowScrollHint(tableContentW > tableContainerW + 1);
  }, [tableContainerW, tableContentW]);

  const handleTableScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (e.nativeEvent.contentOffset.x > 8 && showScrollHint) {
      setShowScrollHint(false);
    }
  };



  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['top', 'left', 'right']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header con gradiente */}
        <LinearGradient
          colors={['#0EA5A4', '#14B8A6', '#10B981']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
                hitSlop={10}
              >
                <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
              </Pressable>
              
              <Text style={styles.appTitle}>Reparte+</Text>
              
              <Pressable
                onPress={editarGrupo}
                style={({ pressed }) => [styles.editGroupBtn, pressed && styles.editGroupBtnPressed]}
                hitSlop={10}
              >
                <MaterialCommunityIcons name="layers-edit" size={22} color="#fff" />
              </Pressable>
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



        {/* Hint de deslizamiento */}
        {showScrollHint && (
          <Pressable
            onPress={() => setShowScrollHint(false)}
            style={styles.scrollHint}
          >
            <LinearGradient
              colors={['#E6FFFA', '#CCFBF1']}
              style={styles.hintGradient}
            >
              <MaterialCommunityIcons name="gesture-swipe-horizontal" size={18} color={PRIMARY} />
              <Text style={styles.hintText}>Desliza la tabla para ver más detalles</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color={PRIMARY} />
            </LinearGradient>
          </Pressable>
        )}

        {/* Tabla de gastos mejorada */}
        <Text style={styles.sectionTitle}>
          <MaterialCommunityIcons name="script-text-outline" size={20} color={TEXT} /> Registro de Gastos
        </Text>
        
        <View
          style={styles.tableWrapper}
          onLayout={e => onTableContainerLayout(e.nativeEvent.layout.width)}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ minWidth: TABLE_MIN_WIDTH }}
            onContentSizeChange={(w) => onTableContentSizeChange(w)}
            onScroll={handleTableScroll}
            scrollEventThrottle={16}
          >
            <View style={styles.table}>
              {/* Header de tabla con gradiente */}
              <LinearGradient
                colors={['#0EA5A4', '#14B8A6']}
                style={styles.tableHeader}
              >
                <Text style={[styles.th, styles.colGasto]}>Gasto</Text>
                <Text style={[styles.th, styles.colPagador]}>Pagador</Text>
                <Text style={[styles.th, styles.colEstado, styles.centerText]}>Estado</Text>
                <Text style={[styles.th, styles.colAcciones, styles.centerText]}>Acciones</Text>
              </LinearGradient>

              {/* Filas de gastos */}
              {gastos.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="folder-open-outline" size={48} color={TEXT_MUTED} />
                  <Text style={styles.emptyTitle}>No hay gastos registrados</Text>
                  <Text style={styles.emptyDesc}>Comienza agregando el primer gasto del grupo</Text>
                </View>
              ) : (
                gastos.map((item, idx) => (
                  <View
                    key={item.id}
                    style={[
                      styles.tableRow,
                      idx % 2 === 0 && styles.rowEven,
                    ]}
                  >
                    <View style={[styles.td, styles.colGasto]}>
                      <Text style={styles.conceptText} numberOfLines={2}>{item.concepto}</Text>
                    </View>

                    <View style={[styles.td, styles.colPagador]}>
                      <Text style={styles.pagadorText} numberOfLines={2}>{item.pagador}</Text>
                    </View>


                    <View style={[styles.td, styles.colEstado, styles.centerContent]}>
                      <View style={[styles.statusBadge, item.pagado ? styles.badgePaid : styles.badgePending]}>
                        <MaterialCommunityIcons
                          name={item.pagado ? 'check-circle' : 'clock-outline'}
                          size={14}
                          color={item.pagado ? '#047857' : '#DC2626'}
                        />
                        <Text style={[styles.statusText, item.pagado ? styles.statusPaid : styles.statusPending]}>
                          {item.pagado ? 'Pagado' : 'Pendiente'}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.td, styles.colAcciones, styles.actionsCell]}>
                      <Pressable
                        onPress={() => verGasto(item.id)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          styles.viewButton,
                          pressed && styles.actionPressed
                        ]}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons name="eye-outline" size={16} color="#0EA5A4" />
                      </Pressable>

                      <Pressable
                        onPress={() => editarGasto(item.id)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          styles.editButton,
                          pressed && styles.actionPressed
                        ]}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={16} color="#F59E0B" />
                      </Pressable>

                      <Pressable
                        onPress={() => eliminarGasto(item.id)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          styles.deleteButton,
                          pressed && styles.actionPressed
                        ]}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons name="delete-outline" size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>

        {/* Botones de acción flotantes */}
        <View style={styles.floatingActions}>
          <Pressable
            onPress={goRegistrarGasto}
            style={({ pressed }) => [pressed && styles.buttonScale]}
          >
            <LinearGradient
              colors={['#0EA5A4', '#14B8A6']}
              style={styles.primaryButton}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Registrar gasto</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={goInvitar}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryPressed
            ]}
          >
            <MaterialCommunityIcons name="account-plus-outline" size={20} color={PRIMARY} />
            <Text style={styles.secondaryButtonText}>Añadir participantes</Text>
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

/* ====== Estilos Mejorados ====== */
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
const TABLE_MIN_WIDTH = COL_MIN_GASTO + COL_MIN_PAGADOR  + COL_W_ESTADO + COL_W_ACCIONES + 40;

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: BG,
    paddingBottom: 30,
  },

  // Header con gradiente
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

  headerContent: {
    paddingHorizontal: 20,
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  backBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  backBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    transform: [{ scale: 0.95 }],
  },

    secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  secondaryPressed: {
    backgroundColor: '#F0FDFA',
    borderColor: PRIMARY,
    transform: [{ scale: 0.98 }],
  },

  secondaryButtonText: { 
    color: SECONDARY, 
    fontSize: 16, 
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  

  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },

  editGroupBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  editGroupBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    transform: [{ scale: 0.95 }],
  },

  loadingHeader: {
    alignItems: 'center',
    paddingVertical: 20,
  },

  loadingText: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    fontSize: 14,
  },

  groupName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },

  groupDesc: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Tarjetas de información
  infoCards: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: -15,
    gap: 12,
  },

  infoCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  infoLabel: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontWeight: '600',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  infoValue: {
    fontSize: 13,
    color: TEXT,
    fontWeight: '700',
    marginTop: 4,
  },

  // Estadísticas
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },

  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(14,165,164,0.1)',
  },

  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
    marginTop: 8,
  },

  statLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontWeight: '600',
    marginTop: 4,
  },

  // Hint de scroll
  scrollHint: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },

  hintGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },

  hintText: {
    color: PRIMARY,
    fontWeight: '600',
    fontSize: 13,
  },

  // Sección de tabla
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },

  tableWrapper: {
    marginHorizontal: 20,
    marginTop: 8,
  },

  table: {
    backgroundColor: CARD,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },

  th: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },

  rowEven: {
    backgroundColor: '#FAFBFC',
  },

  td: {
    justifyContent: 'center',
  },

  // Columnas
  colGasto: { minWidth: COL_MIN_GASTO, flexGrow: 1, paddingRight: 12 },
  colPagador: { minWidth: COL_MIN_PAGADOR, flexGrow: 1, paddingRight: 12 },
  colEstado: { width: COL_W_ESTADO },
  colAcciones: { width: COL_W_ACCIONES },

  centerText: { textAlign: 'center' },
  centerContent: { alignItems: 'center', justifyContent: 'center' },

  // Contenido de celdas
  conceptText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
  },

  pagadorText: {
    fontSize: 13,
    color: TEXT_MUTED,
  },


  monedaText: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 2,
  },

  // Badges de estado
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },

  badgePaid: {
    backgroundColor: '#D1FAE5',
  },

  badgePending: {
    backgroundColor: '#FEE2E2',
  },

  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  statusPaid: {
    color: '#047857',
  },

  statusPending: {
    color: '#DC2626',
  },

  // Botones de acción en tabla
  actionsCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },

  actionPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.8,
  },

  viewButton: {
    backgroundColor: '#E6FFFA',
    borderColor: '#5EEAD4',
  },

  editButton: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },

  deleteButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },

  // Estado vacío
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT,
    marginTop: 12,
  },

  emptyDesc: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 4,
  },

  // Botones flotantes
  floatingActions: {
    marginHorizontal: 20,
    marginTop: 24,
    gap: 12,
  },

  buttonScale: {
    transform: [{ scale: 0.98 }],
  },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  primaryButtonText: { 
    color: '#fff', 
    fontSize: 17, 
    fontWeight: '700',
    letterSpacing: -0.2,
  }})