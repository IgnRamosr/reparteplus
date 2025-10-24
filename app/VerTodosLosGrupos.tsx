// app/grupos/VerTodosLosGrupos.tsx
import React, { useEffect, useState, useCallback } from 'react';
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
  fecha_inicio: string;  // YYYY-MM-DD
  fecha_cierre: string;  // YYYY-MM-DD
  creador?: string;      // id del creador (opcional)
  creador_nombre?: string; // ← nombre del creador (nuevo)
};

type GrupoAPI = {
  grupo_id: number;
  nombre: string;
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_cierre: string | null;
  creado_por: number | null;
  creador_nombre: string | null; // ← lo añadimos en el backend
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

  // Mapeo a UI (incluye creador_nombre)
  const mapToUI = useCallback((rows: GrupoAPI[]): Grupo[] => (
    rows.map(g => ({
      id: String(g.grupo_id),
      nombre: g.nombre,
      descripcion: g.descripcion ?? '',
      fecha_inicio: g.fecha_inicio ? String(g.fecha_inicio).slice(0, 10) : '',
      fecha_cierre: g.fecha_cierre ? String(g.fecha_cierre).slice(0, 10) : '',
      creador: g.creado_por != null ? String(g.creado_por) : undefined,
      creador_nombre: g.creador_nombre ?? undefined, // ← nuevo
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
    }
  }, [participanteId, mapToUI]);

  // Dispara carga inicial solo cuando tengamos ID
  useEffect(() => { if (participanteId !== null) cargar(); }, [participanteId, cargar]);

  // Navegación: ahora pasamos TODOS los params solicitados
  const abrirGrupo = useCallback((g: Grupo) => {
    const href: Href = {
      pathname: '/DetalleGrupo',
      params: {
        id: g.id,
        nombre: g.nombre,
        descripcion: g.descripcion,
        fecha_inicio: g.fecha_inicio,
        fecha_cierre: g.fecha_cierre,
        creador_nombre: g.creador_nombre ?? '', // ← nuevo
      },
    };
    router.replace(href);
  }, []);

  const keyExtractor = useCallback((g: Grupo) => g.id, []);

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
      </View>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={grupos}
          keyExtractor={keyExtractor}
          contentContainerStyle={estilos.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={estilos.emptyText}>
              {error ? `Error: ${error}` : 'Aún no hay grupos'}
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
        onPress={() => router.back()}
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
  header: { width: '100%', alignItems: 'center', marginBottom: 16, position: 'relative' },
  backBtn: { position: 'absolute', top: 0, left: 0, padding: 6, borderRadius: 10 },
  backBtnPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.96 }] },
  titulo: { fontSize: 34, fontWeight: '800', color: PRIMARY },
  subtitulo: { fontSize: 18, fontWeight: '600', color: TEXT_MUTED, marginTop: 2 },
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
