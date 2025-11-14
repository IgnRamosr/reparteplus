// app/grupos/VerTodosLosGrupos.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { obtenerIDparticipante } from '@/lib/funcionesParticipante';

/** ======== Tokens de diseño ======== */
const PRIMARY = '#0EA5A4';
const BG = '#F8FBFC';
const TEXT_MUTED = '#64748B';
const CARD = '#FFFFFF';

/** ============== Config API ============== */
const API_BASE = 'https://ee61hfpl8e.execute-api.us-east-1.amazonaws.com/production';
const MIS_GRUPOS_PATH = '/mis-grupos';

/** ============== Tipos de datos ============== */
export type Grupo = {
  id: string;
  nombre: string;
  descripcion: string;
  fecha_inicio: string;   // YYYY-MM-DD
  fecha_cierre: string;   // planificada (NO indica cerrado real)
  creador?: string;
  creador_nombre?: string;

  /** posibles flags del backend */
  estado?: string | boolean;
  estado_grupo?: string;
  cerrado?: boolean;
  liquidado?: boolean;
};

type GrupoAPI = {
  grupo_id: number;
  nombre: string;
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_cierre: string | null;
  creado_por: number | null;
  creador_nombre: string | null;

  estado?: string | boolean | null;
  estado_grupo?: string | null;
  cerrado?: boolean | null;
  liquidado?: boolean | null;

  es_propietario?: boolean;
  es_participante?: boolean;
};

type MisGruposResponse = {
  data: GrupoAPI[];
  pagination: { limit: number; offset: number; total: number; hasMore: boolean };
};

/** ============== Llamada al backend ============== */
async function fetchMisGrupos(params: {
  userId: number;
  limit?: number;
  offset?: number;
  search?: string;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
  jwt?: string;
}): Promise<MisGruposResponse> {
  if (params.userId === null || params.userId === undefined) {
    throw new Error('participanteId no disponible todavía');
  }

  const q = new URLSearchParams();
  q.set('userId', String(params.userId));
  if (params.limit != null)  q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  if (params.search)         q.set('search', params.search);
  if (params.orderBy)        q.set('orderBy', params.orderBy);
  if (params.orderDir)       q.set('orderDir', params.orderDir);

  const headers: Record<string, string> = {};
  if (params.jwt) headers.Authorization = `Bearer ${params.jwt}`;

  const res = await fetch(`${API_BASE}${MIS_GRUPOS_PATH}?${q.toString()}`, { headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`);
  }
  return (await res.json()) as MisGruposResponse;
}

/** ============== Componente ============== */
export default function VerTodosLosGrupos() {
  const insets = useSafeAreaInsets();

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participanteId, setParticipanteId] = useState<number | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  // Mostrar por defecto ABiertos
  const [mostrarCerrados, setMostrarCerrados] = useState(false);

  // 1) Obtener participante_id una sola vez
  useEffect(() => {
    (async () => {
      try {
        const id = await obtenerIDparticipante();
        const num = Number(id);
        if (Number.isNaN(num)) throw new Error(`participante_id inválido: ${id}`);
        setParticipanteId(num);
      } catch (e: any) {
        setError(e.message ?? 'No fue posible obtener el participante_id');
        setParticipanteId(null);
        setLoading(false);
      }
    })();
  }, []);

  // Mapeo a UI (passthrough de flags de estado)
  const mapToUI = useCallback((rows: GrupoAPI[]): Grupo[] => (
    rows.map(g => ({
      id: String(g.grupo_id),
      nombre: g.nombre,
      descripcion: g.descripcion ?? '',
      fecha_inicio: g.fecha_inicio ? String(g.fecha_inicio).slice(0, 10) : '',
      fecha_cierre: g.fecha_cierre ? String(g.fecha_cierre).slice(0, 10) : '',
      creador: g.creado_por != null ? String(g.creado_por) : undefined,
      creador_nombre: g.creador_nombre ?? undefined,
      estado: g.estado ?? undefined,
      estado_grupo: g.estado_grupo ?? undefined,
      cerrado: typeof g.cerrado === 'boolean' ? g.cerrado : undefined,
      liquidado: typeof g.liquidado === 'boolean' ? g.liquidado : undefined,
    }))
  ), []);

  // 2) Cargar cuando ya tengamos participanteId
  const cargar = useCallback(async () => {
    if (participanteId === null) return;
    try {
      setError(null);
      setLoading(true);
      const resp = await fetchMisGrupos({ userId: participanteId, limit: 50, offset: 0 });
      setGrupos(mapToUI(resp.data));
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar grupos');
    } finally {
      setLoading(false);
      setLastRefreshAt(new Date());
    }
  }, [participanteId, mapToUI]);

  // 3) Refresh
  const onRefresh = useCallback(async () => {
    if (participanteId === null) return;
    try {
      setRefreshing(true);
      const resp = await fetchMisGrupos({ userId: participanteId, limit: 50, offset: 0 });
      setGrupos(mapToUI(resp.data));
    } catch (e: any) {
      setError(e.message ?? 'Error al refrescar');
    } finally {
      setRefreshing(false);
      setLastRefreshAt(new Date());
    }
  }, [participanteId, mapToUI]);

  useEffect(() => { if (participanteId !== null) cargar(); }, [participanteId, cargar]);

  // === Regla de cerrado (NO usa fecha_cierre) ===
  const esCerrado = useCallback((g: Grupo | any) => {
    // 1) Si viene boolean en `estado`: true = abierto, false = cerrado
    if (typeof g?.estado === 'boolean') return g.estado === false;

    // 2) Si viene boolean explícito `cerrado`
    if (typeof g?.cerrado === 'boolean') return g.cerrado === true;

    // 3) Si viene string en `estado` / `estado_grupo`
    const s = String(g?.estado ?? g?.estado_grupo ?? '')
      .toLowerCase()
      .trim();

    if (['cerrado', 'closed', 'liquidado', 'finalizado'].includes(s)) return true;
    if (['abierto', 'open', 'activo'].includes(s)) return false;

    // 4) Si no hay señal, trátalo como ABIERTO
    return false;
  }, []);

  // Derivados
  const abiertos = useMemo(() => grupos.filter(g => !esCerrado(g)), [grupos, esCerrado]);
  const cerrados = useMemo(() => grupos.filter(g =>  esCerrado(g)), [grupos, esCerrado]);
  const gruposFiltrados = useMemo(
    () => (mostrarCerrados ? cerrados : abiertos),
    [mostrarCerrados, abiertos, cerrados]
  );

  // Navegación
  const abrirGrupo = useCallback((g: Grupo) => {
    const href: Href = {
      pathname: '/DetalleGrupo',
      params: {
        id: g.id,
        nombre: g.nombre,
        descripcion: g.descripcion,
        fecha_inicio: g.fecha_inicio,
        fecha_cierre: g.fecha_cierre,
        creador_nombre: g.creador_nombre ?? '',
      },
    };
    router.replace(href);
  }, []);

  const keyExtractor = useCallback((g: Grupo) => g.id, []);

  // Helper fecha/hora legible
  const fmtFechaHora = (d?: Date | null) => {
    if (!d) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
  };

  return (
    <View style={[estilos.container, { paddingTop: Math.max(insets.top, 60) }]}>
      {/* Header */}
      <View style={estilos.header}>
        <Pressable
          onPress={() => router.replace('/MenuPrincipal')}
          style={({ pressed }) => [estilos.backBtn, pressed && estilos.backBtnPressed]}
          hitSlop={10}
          android_ripple={{ color: 'rgba(14,165,164,0.15)', borderless: true }}
          accessibilityLabel="Volver"
        >
          <MaterialCommunityIcons name="arrow-left" size={26} color="#0F172A" />
        </Pressable>

        <Text style={estilos.titulo}>Reparte+</Text>
        <Text style={estilos.subtitulo}>Ver todos los grupos</Text>

        {/* Filtros */}
        <View style={estilos.filtrosRow}>
          <View style={estilos.badges}>
            {/* Abiertos con check */}
            <View style={[estilos.badge, estilos.badgeOpen]}>
              <MaterialCommunityIcons name="check-circle" size={14} color={PRIMARY} />
              <Text style={[estilos.badgeTxt, { color: PRIMARY }]}>
                Abiertos: {abiertos.length}
              </Text>
            </View>
            {/* Cerrados con X */}
            <View style={[estilos.badge, estilos.badgeClosed]}>
              <MaterialCommunityIcons name="close-circle" size={14} color={TEXT_MUTED} />
              <Text style={[estilos.badgeTxt, { color: TEXT_MUTED }]}>
                Cerrados: {cerrados.length}
              </Text>
            </View>
          </View>

          {/* Toggle + Refresh agrupados */}
          <View style={estilos.controlsRow}>
            <Pressable
              onPress={() => setMostrarCerrados(v => !v)}
              android_ripple={{ color: 'rgba(14,165,164,0.15)', borderless: false }}
              style={({ pressed }) => [
                estilos.toggleBtn,
                { backgroundColor: mostrarCerrados ? '#0F172A' : PRIMARY, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text style={estilos.toggleTxt}>{mostrarCerrados ? 'Ver abiertos' : 'Ver cerrados'}</Text>
            </Pressable>

            <Pressable
              onPress={onRefresh}
              android_ripple={{ color: 'rgba(14,165,164,0.15)', borderless: false }}
              style={({ pressed }) => [
                estilos.refreshBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityLabel="Refrescar lista"
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>

        {/* Última actualización */}
        <Text style={estilos.lastRefreshTxt}>
          Última actualización: {fmtFechaHora(lastRefreshAt)}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={gruposFiltrados}
          keyExtractor={keyExtractor}
          contentContainerStyle={estilos.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
          ListEmptyComponent={
            <Text style={estilos.emptyText}>
              {error
                ? `Error: ${error}`
                : mostrarCerrados
                  ? 'No tienes grupos cerrados.'
                  : 'No tienes grupos abiertos.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => abrirGrupo(item)}
              android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
              style={({ pressed }) => [estilos.card, pressed && estilos.cardPressed]}
            >
              <Text style={estilos.cardText}>{item.nombre}</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color={PRIMARY} />
            </Pressable>
          )}
        />
      )}

      <Pressable
        onPress={() => router.replace({ pathname: "/MenuPrincipal" })}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
        style={({ pressed }) => [estilos.boton, pressed && estilos.botonPressed]}
      >
        <View style={estilos.row}>
          <MaterialCommunityIcons name="check-circle-outline" size={20} color="#fff" />
          <Text style={estilos.botonTexto}>Listo</Text>
        </View>
      </Pressable>

      {error && !loading ? <Text style={{ color: 'red', marginTop: 8 }}>{error}</Text> : null}
    </View>
  );
}

/** ===== Estilos ===== */
const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 24 },
  header: { width: '100%', alignItems: 'center', marginBottom: 8, position: 'relative' },
  backBtn: { position: 'absolute', top: 0, left: 0, padding: 6, borderRadius: 10 },
  backBtnPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.96 }] },
  titulo: { fontSize: 34, fontWeight: '800', color: PRIMARY },
  subtitulo: { fontSize: 18, fontWeight: '600', color: TEXT_MUTED, marginTop: 2 },

  filtrosRow: {
    marginTop: 12,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // centrado de todo el bloque
    gap: 12,
    flexWrap: 'wrap',
    alignSelf: 'center',
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeOpen: { backgroundColor: 'rgba(14,165,164,0.12)' },
  badgeClosed: { backgroundColor: '#F1F5F9' },
  badgeTxt: { fontSize: 13, fontWeight: '700' },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'center',
  },
  toggleTxt: { color: '#FFFFFF', fontWeight: '700' },

  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },

  lastRefreshTxt: {
    marginTop: 6,
    color: TEXT_MUTED,
    fontSize: 12,
    textAlign: 'center',
  },

  listContent: { paddingVertical: 8 },

  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.985 }] },
  cardText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },

  boton: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  botonPressed: { backgroundColor: '#14B8A6', transform: [{ scale: 0.985 }], shadowOpacity: 0.12, elevation: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },

  emptyText: { textAlign: 'center', color: TEXT_MUTED, paddingVertical: 24, fontStyle: 'italic' },
});
