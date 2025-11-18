// app/grupos/[id].tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert,
  DeviceEventEmitter, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, Platform,
  BackHandler,
} from 'react-native';
import { useLocalSearchParams, router, type Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';

/* =======================
 *  APIs
 * ======================= */
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

/* ===== Helpers dinero para mostrar ===== */
const DECIMALES_POR_MONEDA: Record<string, number> = {
  CLP: 0, JPY: 0, PYG: 0,
  USD: 2, EUR: 2, ARS: 2, BRL: 2, MXN: 2, PEN: 2, UYU: 2, BOB: 2, COP: 2,
  GBP: 2, CAD: 2, AUD: 2,
};
const decimalesDe = (codigo?: string) =>
  DECIMALES_POR_MONEDA[(codigo || 'CLP').toUpperCase()] ??
  ((codigo || '').toUpperCase() === 'CLP' ? 0 : 2);

const deUnidadesMinimas = (entero: number, moneda?: string) => {
  const d = decimalesDe(moneda);
  return entero / Math.pow(10, d);
};

const formatMontoMostrar = (valor: number, moneda?: string) => {
  const d = decimalesDe(moneda);
  return valor.toLocaleString('es-CL', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
};
/* ====================================== */

type Grupo = {
  id: string | number;
  nombre: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_cierre: string;
  creador?: string;
  estado?: boolean;            // true = abierto, false = cerrado
};

type Gasto = {
  id: string;
  concepto: string;
  pagador: string;
  estado: boolean;
  moneda?: string;
  decimales?: number;
  monto?: number;              // ya desescalado para mostrar
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
          estado: (fecha_cierre ?? '') ? false : true,
        }
      : null
  );

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loadingGastos, setLoadingGastos] = useState<boolean>(false);

  // total del grupo en CLP (cuando cerrado)
  const [totalGrupoCLPMin, setTotalGrupoCLPMin] = useState<number | null>(null);
  const formatCLPFromMin = (min?: number | null) =>
    typeof min === 'number'
      ? min.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      : '—';

  const estaCerrado = grupo?.estado === false;
  const [cerrandoGrupo, setCerrandoGrupo] = useState(false);

  /* ========= carga de meta del grupo ========= */
  const fetchGrupoMeta = useCallback(async (gid: string) => {
    if (!gid) return;
    try {
      setCargando(true);
      const resp = await apiGrupo.get('/grupo', { params: { grupoId: gid } });

      if (resp.status >= 200 && resp.status < 300 && resp.data) {
        const g = resp.data;
        const cerrado = typeof g.estado === 'boolean' ? g.estado === false : Boolean(g.fecha_cierre);
        setGrupo({
          id: gid,
          nombre: g.nombre ?? '',
          descripcion: g.descripcion ?? '',
          fecha_inicio: g.fecha_inicio ?? '',
          fecha_cierre: g.fecha_cierre ?? '',
          creador: g.creador_nombre ?? undefined,
          estado: !cerrado,
        });

        await fetchGastos(gid, cerrado);
      } else {
        Alert.alert('Error', `(${resp.status}) No se pudo cargar el grupo.`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Error cargando el grupo.');
    } finally {
      setCargando(false);
    }
  }, []);

  /* ========= carga de gastos (abierto o liquidado) ========= */
  const fetchGastos = useCallback(async (grupoId: string, cerrado: boolean) => {
    if (!grupoId) return;
    try {
      setLoadingGastos(true);

      if (cerrado) {
        const resp = await apiGrupo.get('/grupo/gastos-liquidados', { params: { grupoId } });

        if (resp.status >= 200 && resp.status < 300) {
          const payload = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;

          const arr: any[] = payload?.gastos_liquidados ?? [];
          const mapped: Gasto[] = arr.map(r => {
            const estado =
              typeof r.estado === 'boolean'
                ? r.estado
                : (typeof r.estado_gasto === 'boolean' ? r.estado_gasto : false);

            // si viene _mayor lo usamos; si no, _min (CLP no tiene decimales)
            const monto =
              typeof r.monto_base_mayor === 'number'
                ? Number(r.monto_base_mayor)
                : (typeof r.monto_base_min === 'number' ? Number(r.monto_base_min) : 0);

            return {
              id: String(r.gasto_id ?? r.id ?? ''),
              concepto: String(r.concepto ?? r.descripciongasto ?? '—'),
              pagador: r.pagador_nombre ?? '-',
              estado,
              moneda: 'CLP',
              decimales: 0,
              monto,
            };
          });
          setGastos(mapped);

          const totalMin: number = Number(payload?.totales?.total_gastos_base_minima || 0);
          setTotalGrupoCLPMin(totalMin);
        } else {
          console.warn('Error /grupo/gastos-liquidados', resp.status, resp.data);
          setGastos([]);
          setTotalGrupoCLPMin(null);
        }
      } else {
        // Grupo abierto: lambda de GASTO
        const resp = await apiGasto.get('/gastos', { params: { grupoId } });
        if (resp.status >= 200 && resp.status < 300) {
          const arr: any[] = resp.data?.resultados ?? resp.data?.gastos ?? [];
          const mapped: Gasto[] = arr.map(r => {
            const moneda = (r.moneda ?? 'CLP') as string;
            const d = typeof r.decimales === 'number' ? r.decimales : decimalesDe(moneda);
            const montoEntero = r.monto != null ? Number(r.monto) : undefined;
            const montoMostrado = montoEntero != null ? deUnidadesMinimas(montoEntero, moneda) : undefined;

            const estado =
              typeof r.estado_gasto === 'boolean'
                ? r.estado_gasto
                : Boolean(r.pagado ?? false);

            return {
              id: String(r.id ?? r.gasto_id ?? ''),
              concepto: String(r.concepto ?? r.descripciongasto ?? '—'),
              pagador: String(r.pagador ?? r.pagador_nombre ?? r.nombre_pagador ?? '—'),
              estado,
              moneda,
              decimales: d,
              monto: montoMostrado,
            };
          });
          setGastos(mapped);
          setTotalGrupoCLPMin(null);
        } else {
          setGastos([]);
          setTotalGrupoCLPMin(null);
          console.warn('Error /gastos', resp.status, resp.data);
        }
      }
    } catch (e) {
      setGastos([]);
      setTotalGrupoCLPMin(null);
      console.warn('Error cargando gastos', e);
    } finally {
      setLoadingGastos(false);
    }
  }, []);

  /* ========= montajes ========= */
  useEffect(() => {
    if (!id) return;
    (async () => {
      await fetchGrupoMeta(String(id));
    })();
  }, [id, fetchGrupoMeta]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const t = setTimeout(() => {
        fetchGrupoMeta(String(id));
      }, 120);
      return () => clearTimeout(t);
    }, [id, fetchGrupoMeta])
  );

  useFocusEffect(
    React.useCallback(() => {
      const onBack = () => {
        router.replace({ pathname:"/MenuPrincipal" });
        return true;
      };
      BackHandler.addEventListener("hardwareBackPress", onBack);
    }, [])
  );

  // Escucha creación de gasto (no afecta a grupo cerrado)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('gasto:creado', (nuevo: any) => {
      if (estaCerrado) return;
      const moneda = nuevo.moneda ?? 'CLP';
      const normalizado: Gasto = {
        id: String(nuevo.id ?? nuevo.gasto_id ?? `tmp-${Date.now()}`),
        concepto: String(nuevo.concepto ?? nuevo.descripciongasto ?? '—'),
        pagador: String(nuevo.pagador ?? nuevo.pagador_nombre ?? '—'),
        estado: typeof nuevo.estado === 'boolean' ? nuevo.estado : Boolean(nuevo.pagado ?? false),
        moneda,
        decimales: decimalesDe(moneda),
        monto: typeof nuevo.monto === 'number' ? Number(nuevo.monto) : undefined,
      };
      setGastos(prev => [normalizado, ...prev]);
    });
    return () => sub.remove();
  }, [estaCerrado]);

  const safePush = (href: Href) => router.replace(href);

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
        groupName: grupo?.nombre ?? '',
        creador_nombre: grupo?.creador ?? '',
      },
    });
  };

  const verGasto = (gastoId: string) => {
    safePush({
      pathname: '/detallegasto',
      params: {
        gasto: gastoId,
        grupoId: String(grupo?.id ?? id ?? ''),
        cerrado: (grupo?.estado === false) ? '1' : '0',
      },
    });
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

  const eliminarGrupo = () => {
    Alert.alert('En construcción', 'La eliminación de grupos estará disponible pronto.');
  };

  const cerrarGrupo = () => {
    if (estaCerrado) {
      Alert.alert('Grupo ya cerrado', 'Este grupo ya se encuentra cerrado.');
      return;
    }

    Alert.alert(
      'Cerrar grupo',
      '¿Estás seguro de cerrar el grupo? Esta acción es permanente y no podrás reabrirlo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            try {
              setCerrandoGrupo(true);
              const resp = await apiGrupo.post('/grupo/cerrar', { grupoId: String(grupo?.id ?? id) });
              if (!(resp.status >= 200 && resp.status < 300)) {
                throw new Error(`Backend respondió ${resp.status}`);
              }

              setGrupo((prev) => prev ? { ...prev, estado: false } : prev);
              await fetchGastos(String(grupo?.id ?? id), true);

              DeviceEventEmitter.emit('grupo:cerrado', { grupoId: String(grupo?.id ?? id) });
              Alert.alert('Grupo cerrado', 'El grupo se ha cerrado permanentemente.');
            } catch (e: any) {
              console.warn('No se pudo cerrar el grupo:', e?.message || e);
              Alert.alert('Error', 'Ocurrió un problema al cerrar el grupo. Intenta nuevamente.');
            } finally {
              setCerrandoGrupo(false);
            }
          },
        },
      ]
    );
  };

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
              ? { ...g, concepto: descripciongasto, moneda, monto: Number(monto) }
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

  const [tableContainerW, setTableContainerW] = useState(0);
  const [tableContentW, setTableContentW] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const onTableContainerLayout = (w: number) => setTableContainerW(w);
  const onTableContentSizeChange = (contentW: number) => setTableContentW(contentW);
  useEffect(() => { setShowScrollHint(tableContentW > tableContainerW + 1); }, [tableContainerW, tableContentW]);
  const handleTableScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (e.nativeEvent.contentOffset.x > 8 && showScrollHint) setShowScrollHint(false);
  };

  const isSmallScreen = SCREEN_W < 375;
  const cardPadding = isSmallScreen ? 12 : 16;

  /* ===========================
   * ESCANEO DE BOLETA (CÁMARA / GALERÍA)
   * =========================== */

  // Abre la pantalla de escaneo pasando la imagen seleccionada
  const navegarAEscanear = (imageUri: string) => {
    const groupId = String(grupo?.id ?? id ?? '');
    router.push({
      pathname: '/', // ⬅️ Ajusta si tu ruta de revisión/escaneo tiene otro path
      params: { grupoId: groupId, imageUri }
    });
  };





// Abre la pantalla personalizada de escaneo con CameraView y botón de galería
const abrirCamara = React.useCallback(() => {
  const groupId = String(grupo?.id ?? id ?? '');
  router.push({ pathname: '/EscaneoBoleta', params: { grupoId: groupId } });
}, [grupo?.id, id]);




  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient 
          colors={['#0EA5A4', '#14B8A6', '#10B981']} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 1 }} 
          style={[styles.headerGradient, { paddingHorizontal: cardPadding }]}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <Pressable 
                onPress={() => router.replace('/VerTodosLosGrupos')} 
                style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]} 
                hitSlop={10}
              >
                <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
              </Pressable>

              <Text style={styles.appTitle}>Reparte+</Text>

              <View style={styles.headerActions}>
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
                  disabled={estaCerrado}
                  style={({ pressed }) => [
                    styles.headerIconBtn,
                    pressed && !estaCerrado && styles.headerIconBtnPressed,
                    estaCerrado && styles.headerIconBtnDisabled,
                  ]}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons
                    name="square-edit-outline"
                    size={19}
                    color={estaCerrado ? 'rgba(255,255,255,0.35)' : '#fff'}
                  />
                </Pressable>

                <Pressable
                  onPress={eliminarGrupo}
                  disabled={estaCerrado}
                  style={({ pressed }) => [
                    styles.headerIconBtn,
                    pressed && !estaCerrado && styles.headerIconBtnPressed,
                    estaCerrado && styles.headerIconBtnDisabled,
                  ]}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons
                    name="delete-outline"
                    size={19}
                    color={estaCerrado ? 'rgba(255,255,255,0.35)' : '#fff'}
                  />
                </Pressable>

                <Pressable 
                  onPress={verGrafico} 
                  style={({ pressed }) => [styles.headerIconBtn, pressed && styles.headerIconBtnPressed]} 
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="chart-box-outline" size={19} color="#fff" />
                </Pressable>
              </View>
            </View>

            {cargando && !grupo?.nombre ? (
              <View style={styles.loadingHeader}>
                <ActivityIndicator color="#fff" size="large" />
                <Text style={styles.loadingText}>Cargando grupo…</Text>
              </View>
            ) : (
              <View style={styles.headerInfo}>
                <Text style={styles.groupName} numberOfLines={2}>
                  {grupo?.nombre || '—'}
                </Text>
                <Text style={styles.groupDesc} numberOfLines={3}>
                  {grupo?.descripcion || '—'}
                </Text>

                <View style={styles.statusBadgeContainer}>
                  <View style={[styles.statusBadge, estaCerrado ? styles.statusBadgeClosed : styles.statusBadgeOpen]}>
                    <MaterialCommunityIcons 
                      name={estaCerrado ? 'lock' : 'lock-open-variant'} 
                      size={14} 
                      color={estaCerrado ? '#991B1B' : '#065F46'} 
                    />
                    <Text style={[styles.statusBadgeText, estaCerrado ? styles.statusTextClosed : styles.statusTextOpen]}>
                      {estaCerrado ? 'CERRADO' : 'ABIERTO'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Tarjetas de información */}
        <View style={[styles.infoCardsContainer, { paddingHorizontal: cardPadding }]}>
          <View style={styles.infoCard}>
            <View style={styles.infoCardIcon}>
              <MaterialCommunityIcons name="account-circle" size={22} color={PRIMARY} />
            </View>
            <Text style={styles.infoLabel}>Creador</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {String(grupo?.creador ?? '—')}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoCardIcon}>
              <MaterialCommunityIcons name="calendar-start" size={22} color={PRIMARY} />
            </View>
            <Text style={styles.infoLabel}>Inicio</Text>
            <Text style={styles.infoValue}>{fmtCL(grupo?.fecha_inicio)}</Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoCardIcon}>
              <MaterialCommunityIcons name="calendar-end" size={22} color={PRIMARY} />
            </View>
            <Text style={styles.infoLabel}>Término</Text>
            <Text style={styles.infoValue}>{fmtCL(grupo?.fecha_cierre)}</Text>
          </View>
        </View>

        {/* Tabla de gastos */}
        <View style={[styles.gastosSection, { paddingHorizontal: cardPadding }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <MaterialCommunityIcons name="receipt" size={24} color={PRIMARY} />
              <Text style={styles.sectionTitle}>Gastos del Grupo</Text>
            </View>
            <View style={styles.gastosBadge}>
              <Text style={styles.gastosBadgeText}>{gastos.length}</Text>
            </View>
          </View>

          <View style={styles.tableCard}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={Platform.OS === 'web'}
              contentContainerStyle={{ minWidth: '100%' }}
              onContentSizeChange={(w: number) => onTableContentSizeChange(w)}
              onScroll={handleTableScroll}
              scrollEventThrottle={16}
            >
              <View style={styles.table}>
                <LinearGradient 
                  colors={['#0EA5A4', '#14B8A6']} 
                  style={styles.tableHeader}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={[styles.th, styles.colGasto]}>Concepto</Text>
                  <Text style={[styles.th, styles.colPagador]}>Pagador</Text>
                  <Text style={[styles.th, styles.colEstado]}>Estado</Text>
                  <Text style={[styles.th, styles.colAcciones]}>Acciones</Text>
                </LinearGradient>

                {loadingGastos ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={PRIMARY} />
                    <Text style={styles.loadingText2}>Cargando gastos…</Text>
                  </View>
                ) : gastos.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIconContainer}>
                      <MaterialCommunityIcons name="wallet-outline" size={56} color={TEXT_MUTED} />
                    </View>
                    <Text style={styles.emptyTitle}>No hay gastos aún</Text>
                    <Text style={styles.emptyDesc}>
                      Comienza agregando el primer gasto del grupo
                    </Text>
                  </View>
                ) : (
                  gastos.map((item, idx) => {
                    const isPaid = item.estado === true;
                    return (
                      <View 
                        key={item.id} 
                        style={[
                          styles.tableRow, 
                          idx % 2 === 0 && styles.rowEven,
                          idx === gastos.length - 1 && styles.lastRow
                        ]}
                      >
                        <View style={[styles.td, styles.colGasto]}>
                          <Text style={styles.conceptText} numberOfLines={2}>
                            {item.concepto}
                          </Text>
                          {typeof item.monto === 'number' && (
                            <Text style={styles.montoText}>
                              {estaCerrado ? 'CLP' : item.moneda} {formatMontoMostrar(item.monto, estaCerrado ? 'CLP' : item.moneda)}
                            </Text>
                          )}
                        </View>
                        
                        <View style={[styles.td, styles.colPagador]}>
                          <Text style={styles.pagadorText} numberOfLines={2}>
                            {item.pagador}
                          </Text>
                        </View>
                        
                        <View style={[styles.td, styles.colEstado]}>
                          <View style={[styles.estadoBadge, isPaid ? styles.badgePaid : styles.badgePending]}>
                            <MaterialCommunityIcons 
                              name={isPaid ? 'check-circle' : 'clock-alert-outline'} 
                              size={16} 
                              color={isPaid ? '#047857' : '#DC2626'} 
                            />
                            <Text style={[styles.estadoText, isPaid ? styles.estadoPaid : styles.estadoPending]}>
                              {isPaid ? 'Pagado' : 'Pendiente'}
                            </Text>
                          </View>
                        </View>
                        
                        <View style={[styles.td, styles.colAcciones]}>
                          <View style={styles.actionsContainer}>
                            <Pressable
                              onPress={() => verGasto(item.id)}
                              style={({ pressed }) => [
                                styles.actionBtn,
                                styles.viewBtn,
                                pressed && styles.actionBtnPressed
                              ]}
                              hitSlop={6}
                            >
                              <MaterialCommunityIcons name="eye-outline" size={18} color="#0EA5A4" />
                            </Pressable>
                            
                            <Pressable
                              disabled={estaCerrado}
                              onPress={() => goEditarGasto(item.id)}
                              style={({ pressed }) => [
                                styles.actionBtn,
                                styles.editBtn,
                                pressed && !estaCerrado && styles.actionBtnPressed,
                                estaCerrado && styles.actionBtnDisabled
                              ]}
                              hitSlop={6}
                            >
                              <MaterialCommunityIcons 
                                name="pencil-outline" 
                                size={18} 
                                color={estaCerrado ? '#D1D5DB' : '#F59E0B'} 
                              />
                            </Pressable>
                            
                            <Pressable
                              disabled={estaCerrado}
                              onPress={() => eliminarGastoItem(item.id)}
                              style={({ pressed }) => [
                                styles.actionBtn,
                                styles.deleteBtn,
                                pressed && !estaCerrado && styles.actionBtnPressed,
                                estaCerrado && styles.actionBtnDisabled
                              ]}
                              hitSlop={6}
                            >
                              <MaterialCommunityIcons 
                                name="delete-outline" 
                                size={18} 
                                color={estaCerrado ? '#D1D5DB' : '#EF4444'} 
                              />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </View>

          {/* total CLP del grupo cuando está cerrado */}
          {estaCerrado && (
            <View style={{ marginTop: 12, alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>Total gastado (CLP)</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>
                CLP {formatCLPFromMin(totalGrupoCLPMin)}
              </Text>
            </View>
          )}
        </View>

        {/* Botones de acción - Grid 2x2 + fila extra para escaneo */}
        <View style={[styles.actionsGrid, { paddingHorizontal: cardPadding }]}>
          {/* Fila 1 */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={goInvitar}
              disabled={estaCerrado}
              style={({ pressed }) => [
                styles.gridActionCard,
                pressed && !estaCerrado && styles.gridActionCardPressed,
                estaCerrado && styles.gridActionCardDisabled
              ]}
            >
              <View style={[styles.gridActionIcon, estaCerrado && styles.gridActionIconDisabled]}>
                <MaterialCommunityIcons 
                  name="account-multiple-plus" 
                  size={26} 
                  color={estaCerrado ? '#94A3B8' : PRIMARY} 
                />
              </View>
              <Text style={[styles.gridActionTitle, estaCerrado && styles.gridActionTitleDisabled]}>
                Invitar
              </Text>
              <Text style={[styles.gridActionDesc, estaCerrado && styles.gridActionDescDisabled]}>
                Agregar personas
              </Text>
            </Pressable>

            <Pressable
              onPress={goConfirmacionInvitados}
              style={({ pressed }) => [
                styles.gridActionCard,
                pressed && styles.gridActionCardPressed,
              ]}
            >
              <View style={[styles.gridActionIcon]}>
                <MaterialCommunityIcons 
                  name="account-group" 
                  size={26} 
                  color={PRIMARY} 
                />
              </View>
              <Text style={[styles.gridActionTitle]}>
                Participantes
              </Text>
              <Text style={[styles.gridActionDesc]}>
                Ver invitados
              </Text>
            </Pressable>
          </View>

          {/* Fila 2 */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={abrirCamara}
              disabled={estaCerrado}
              style={({ pressed }) => [
                styles.gridActionCard,
                pressed && !estaCerrado && styles.gridActionCardPressed,
                estaCerrado && styles.gridActionCardDisabled
              ]}
            >
              <View style={[styles.gridActionIcon, estaCerrado && styles.gridActionIconDisabled]}>
                <MaterialCommunityIcons 
                  name="plus-circle" 
                  size={26} 
                  color={estaCerrado ? '#94A3B8' : PRIMARY} 
                />
              </View>
              <Text style={[styles.gridActionTitle, estaCerrado && styles.gridActionTitleDisabled]}>
                Nuevo Gasto
              </Text>
              <Text style={[styles.gridActionDesc, estaCerrado && styles.gridActionDescDisabled]}>
                Registrar gasto
              </Text>
            </Pressable>

            <Pressable
              onPress={cerrarGrupo}
              disabled={estaCerrado || cerrandoGrupo}
              style={({ pressed }) => [
                styles.gridActionCard,
                styles.gridActionCardDanger,
                pressed && !estaCerrado && !cerrandoGrupo && styles.gridActionCardDangerPressed,
                (estaCerrado || cerrandoGrupo) && styles.gridActionCardDisabled
              ]}
            >
              <View style={[styles.gridActionIconDanger, (estaCerrado || cerrandoGrupo) && styles.gridActionIconDisabled]}>
                {cerrandoGrupo ? (
                  <ActivityIndicator color="#94A3B8" size="small" />
                ) : (
                  <MaterialCommunityIcons 
                    name="lock" 
                    size={26} 
                    color={estaCerrado || cerrandoGrupo ? '#94A3B8' : '#EF4444'} 
                  />
                )}
              </View>
              <Text style={[styles.gridActionTitleDanger, (estaCerrado || cerrandoGrupo) && styles.gridActionTitleDisabled]}>
                {estaCerrado ? 'Cerrado' : 'Cerrar'}
              </Text>
              <Text style={[styles.gridActionDesc, (estaCerrado || cerrandoGrupo) && styles.gridActionDescDisabled]}>
                {estaCerrado ? 'Cerrado' : 'Cerrar grupo'}
              </Text>
            </Pressable>
          </View>

          {/* Fila 3 — Escanear boleta */}
          {/* <View style={styles.actionsRow}>
            <Pressable
              onPress={abrirCamara}
              disabled={estaCerrado}
              style={({ pressed }) => [
                styles.gridActionCard,
                pressed && !estaCerrado && styles.gridActionCardPressed,
                estaCerrado && styles.gridActionCardDisabled,
                { position: 'relative' }
              ]}
            >
              <View style={[styles.gridActionIcon, estaCerrado && styles.gridActionIconDisabled]}>
                <MaterialCommunityIcons 
                  name="camera" 
                  size={28} 
                  color={estaCerrado ? '#94A3B8' : PRIMARY} 
                />
              </View>
              <Text style={[styles.gridActionTitle, estaCerrado && styles.gridActionTitleDisabled]}>
                Escanear boleta
              </Text>
              <Text style={[styles.gridActionDesc, estaCerrado && styles.gridActionDescDisabled]}>
                Cámara para escanear
              </Text>
            </Pressable> */}

            {/* Espaciador para mantener la grilla 2x2 */}
            {/* <View style={[styles.gridActionCard, { opacity: 0 }]} />
          </View> */}
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

/* ====== ESTILOS ====== */
const PRIMARY = '#0EA5A4';
const SECONDARY = '#14B8A6';
const BG = '#F3F4F6';
const TEXT = '#111827';
const TEXT_MUTED = '#6B7280';
const CARD = '#FFFFFF';
const BORDER = '#E2E8F0';
const SUCCESS = '#10B981';
const DANGER = '#EF4444';
const WARNING = '#F59E0B';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },

  // HEADER
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    ...Platform.select({
      ios: { shadowColor: PRIMARY, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 12 },
    }),
  },
  headerContent: { gap: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  btnPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  appTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  headerIconBtnPressed: { backgroundColor: 'rgba(255,255,255,0.30)', transform: [{ scale: 0.93 }] },
  headerIconBtnDisabled: { opacity: 0.35, backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)' },
  loadingHeader: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingText: { color: 'rgba(255,255,255,0.95)', fontSize: 15, fontWeight: '600' },
  headerInfo: { gap: 8, paddingHorizontal: 4 },
  groupName: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: -0.5, lineHeight: 32 },
  groupDesc: { fontSize: 15, color: 'rgba(255,255,255,0.95)', textAlign: 'center', lineHeight: 21 },
  statusBadgeContainer: { alignItems: 'center', marginTop: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
  statusBadgeOpen: { backgroundColor: '#D1FAE5' },
  statusBadgeClosed: { backgroundColor: '#FEE2E2' },
  statusBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  statusTextOpen: { color: '#065F46' },
  statusTextClosed: { color: '#991B1B' },

  // INFO CARDS
  infoCardsContainer: { flexDirection: 'row', marginTop: -20, gap: 10, paddingBottom: 20 },
  infoCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 4 } }),
  },
  infoCardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  infoLabel: { fontSize: 11, color: TEXT_MUTED, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  infoValue: { fontSize: 13, color: TEXT, fontWeight: '700', textAlign: 'center' },

  // GASTOS
  gastosSection: { paddingTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: TEXT, letterSpacing: -0.3 },
  gastosBadge: { backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, minWidth: 36, alignItems: 'center' },
  gastosBadgeText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  tableCard: {
    backgroundColor: CARD, borderRadius: 18, overflow: 'hidden',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }, android: { elevation: 6 } }),
  },
  table: { minWidth: '100%' },
  tableHeader: { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: 'rgba(255,255,255,0.3)' },
  th: { fontSize: 12, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.8 },
  tableRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: BORDER, minHeight: 72 },
  rowEven: { backgroundColor: '#F9FAFB' },
  lastRow: { borderBottomWidth: 0 },
  td: { justifyContent: 'center' },
  colGasto: { flex: 2, minWidth: 140, paddingRight: 12 },
  colPagador: { flex: 1.5, minWidth: 120, paddingRight: 12 },
  colEstado: { flex: 1, minWidth: 100, alignItems: 'center', paddingRight: 8 },
  colAcciones: { flex: 1.2, minWidth: 120 },
  conceptText: { fontSize: 14, fontWeight: '700', color: TEXT, lineHeight: 20, marginBottom: 4 },
  montoText: { fontSize: 12, fontWeight: '600', color: PRIMARY },
  pagadorText: { fontSize: 13, color: TEXT_MUTED, fontWeight: '500', lineHeight: 18 },
  estadoBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, gap: 5 },
  badgePaid: { backgroundColor: '#D1FAE5' },
  badgePending: { backgroundColor: '#FEE2E2' },
  estadoText: { fontSize: 12, fontWeight: '700' },
  estadoPaid: { color: '#047857' },
  estadoPending: { color: '#DC2626' },
  actionsContainer: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  actionBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  actionBtnPressed: { transform: [{ scale: 0.9 }], opacity: 0.7 },
  actionBtnDisabled: { opacity: 0.35 },
  viewBtn: { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' },
  editBtn: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  deleteBtn: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },

  // EMPTY & LOADING
  loadingContainer: { paddingVertical: 64, alignItems: 'center', gap: 12 },
  loadingText2: { color: TEXT_MUTED, fontSize: 14, fontWeight: '500' },
  emptyState: { paddingVertical: 72, alignItems: 'center', paddingHorizontal: 32 },
  emptyIconContainer: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: TEXT, marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: TEXT_MUTED, textAlign: 'center', lineHeight: 20 },

  gridActionDescDisabled: { color: '#CBD5E1' },

  // GRID acciones
  actionsGrid: { marginTop: 24, gap: 10 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  gridActionCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 18, padding: 18, alignItems: 'center',
    justifyContent: 'center', gap: 10, minHeight: 140, borderWidth: 1, borderColor: BORDER,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 3 } }),
  },
  gridActionCardPressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  gridActionCardDisabled: { opacity: 0.45 },
  gridActionCardDanger: { backgroundColor: CARD, borderColor: '#FEE2E2', borderWidth: 1.5 },
  gridActionCardDangerPressed: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  gridActionIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center' },
  gridActionIconDanger: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  gridActionIconDisabled: { backgroundColor: '#F8FAFC' },
  gridActionTitle: { fontSize: 15, fontWeight: '800', color: TEXT, textAlign: 'center', letterSpacing: -0.3 },
  gridActionTitleDanger: { fontSize: 15, fontWeight: '800', color: DANGER, textAlign: 'center', letterSpacing: -0.3 },
  gridActionTitleDisabled: { color: TEXT_MUTED },
  gridActionDesc: { fontSize: 12, color: TEXT_MUTED, textAlign: 'center', fontWeight: '500', lineHeight: 16 },

  // Botón flotante de galería en la tarjeta de escaneo
  galleryFloatingBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
});