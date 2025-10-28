// app/ConfirmacionInvitados.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

const PRIMARY = '#0EA5A4';
const PRIMARY_2 = '#14B8A6';
const BG = '#F8FBFC';
const INK = '#0F172A';
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';
const CARD = '#FFFFFF';
const OK = '#16A34A';
const WARN = '#F59E0B';

const apiInvitaciones = axios.create({
  baseURL: 'https://qopxyt66x8.execute-api.us-east-1.amazonaws.com/production',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true,
});

const apiGrupo = axios.create({
  baseURL: 'https://ee61hfpl8e.execute-api.us-east-1.amazonaws.com/production',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true,
});

// ===== Tipos =====
type Invitacion = {
  status: string;
  email: string;
  nombre?: string;
  invitedAt?: string | null;
  respondedAt?: string | null;
  tipo?: string | null;
};

type GrupoInvitaciones = {
  groupId: string;
  groupName?: string;
  creatorName?: string;
  invitations: Invitacion[];
};

// ===== Utils =====
const formatDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusVisual = (s: string) => {
  const st = s?.toUpperCase();
  if (st === 'ACEPTADO' || st === 'ACCEPTED')
    return { label: 'Aceptado', color: OK, icon: 'check-decagram' as const };
  if (st === 'INVITADO' || st === 'INVITED')
    return { label: 'Invitado', color: WARN, icon: 'account-clock' as const };
  return { label: st, color: TEXT_MUTED, icon: 'clock-outline' as const };
};

const typeVisual = (t?: string | null) => {
  const tt = (t || '').toUpperCase();
  if (tt === 'QR') return { label: 'QR', icon: 'qrcode' as const };
  return { label: 'email', icon: 'email-outline' as const };
};

// ===== Componente =====
export default function ConfirmacionInvitados() {
  const { grupo, creador_nombre, groupName } = useLocalSearchParams<{
    grupo?: string | string[];
    creador_nombre?: string | string[];
    groupName?: string | string[];
  }>();

  const groupId = Array.isArray(grupo) ? grupo[0] : grupo ?? '';
  const creadorParam = Array.isArray(creador_nombre) ? creador_nombre[0] : (creador_nombre ?? '');
  const groupNameParam = Array.isArray(groupName) ? groupName[0] : (groupName ?? '');

  const [creatorName, setCreatorName] = useState<string>(creadorParam);
  const [nameOverride, setNameOverride] = useState<string>(groupNameParam);
  const [data, setData] = useState<GrupoInvitaciones | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const title = 'Confirmación de Invitaciones';

  const invitedCount = useMemo(
    () => (data?.invitations ?? []).filter(i => (i.status || '').toUpperCase() === 'INVITADO').length,
    [data?.invitations]
  );
  const acceptedCount = useMemo(
    () => (data?.invitations ?? []).filter(i => (i.status || '').toUpperCase() === 'ACEPTADO').length,
    [data?.invitations]
  );

  const fetchCreatorFallback = useCallback(async () => {
    try {
      if (!groupId) return;
      const r = await apiGrupo.get('/grupo', { params: { grupoId: groupId } });
      if (r.status >= 200 && r.status < 300 && r.data) {
        if (!creatorName) {
          setCreatorName(
            r.data?.creador_nombre ??
              r.data?.creadorNombre ??
              r.data?.creador ??
              r.data?.creatorName ??
              ''
          );
        }
        if (!nameOverride) {
          setNameOverride(r.data?.nombre ?? r.data?.groupName ?? r.data?.title ?? '');
        }
      }
    } catch {
      // silent
    }
  }, [groupId, creatorName, nameOverride]);

  const fetchData = useCallback(
    async (showAlerts = true) => {
      if (!groupId) {
        if (showAlerts) Alert.alert('Grupo no válido', 'Falta el id del grupo.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);

        const res = await apiInvitaciones.post('/participante/invitaciones', { grupo_id: String(groupId) });

        if (res.status >= 200 && res.status < 300 && res.data) {
          const p = res.data;
          const invitationsRaw: any[] = p.invitaciones ?? p.invitations ?? [];

          const normalized: GrupoInvitaciones = {
            groupId: String(groupId),
            groupName: p.groupName ?? p.nombreGrupo ?? p.title,
            creatorName:
              p.creator?.nombre ??
              p.creador?.nombre ??
              p.creatorName ??
              p.creadorNombre ??
              p.creador_nombre ??
              p.creador ??
              undefined,
            invitations: invitationsRaw.map(it => ({
              status: it.estado ?? it.status ?? 'PENDIENTE',
              email: it.email ?? '',
              nombre: it.nombre ?? it.name,
              invitedAt: it.fecha_invitacion ?? it.invitedAt ?? null,
              respondedAt: it.fecha_respuesta ?? it.respondedAt ?? null,
              tipo: it.tipo ?? null,
            })),
          };

          normalized.invitations = normalized.invitations.filter(i => {
            const s = (i.status || '').toUpperCase();
            return s === 'INVITADO' || s === 'ACEPTADO';
          });

          setData(normalized);

          setLastUpdated(
            new Date().toLocaleString('es-CL', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
            })
          );

          if (normalized.creatorName) setCreatorName(normalized.creatorName);
          if (normalized.groupName) setNameOverride(normalized.groupName);
          else if (groupNameParam) setNameOverride(groupNameParam);

          if (!normalized.creatorName || !normalized.groupName) {
            fetchCreatorFallback();
          }
        } else if (showAlerts) {
          Alert.alert('Error', `No se pudieron obtener invitaciones (código ${res.status}).`);
        }
      } catch (e: any) {
        if (showAlerts) Alert.alert('Error de red', e?.message ?? 'Intenta nuevamente.');
      } finally {
        setLoading(false);
      }
    },
    [groupId, groupNameParam, fetchCreatorFallback]
  );

  useFocusEffect(
    React.useCallback(() => {
      const onBack = () => {
        router.replace({
          pathname:"/DetalleGrupo",
          params:{id:groupId}
        }); // <-- destino
        return true;               // consumimos el back
      };
      BackHandler.addEventListener("hardwareBackPress", onBack);
    }, [])
  );

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(false);
    setRefreshing(false);
  }, [fetchData]);

  const renderHeader = () => (
    <LinearGradient
      colors={[PRIMARY, PRIMARY_2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.headerGradient}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.replace('/DetalleGrupo')}
          style={({ pressed }) => [styles.iconGlass, pressed && styles.press]}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Pressable
          onPress={onRefresh}
          disabled={loading || refreshing}
          style={({ pressed }) => [styles.iconGlass, pressed && styles.press]}
          hitSlop={10}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
          )}
        </Pressable>
      </View>

      <Text style={styles.headerApp}>Reparte+</Text>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
    </LinearGradient>
  );

  const renderItem = ({ item }: { item: Invitacion }) => {
    const vis = statusVisual(item.status);
    const tv = typeVisual(item.tipo);
    const initials = (item.nombre || item.email || '?')
      .split(' ')
      .map(p => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <View style={styles.cardRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || '?'}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {item.nombre || 'Sin nombre'}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {item.email}
          </Text>

          <View style={styles.datesRow}>
            <View style={styles.pill}>
              <MaterialCommunityIcons name={tv.icon} size={14} color={TEXT_MUTED} />
              <Text style={styles.pillText}>{tv.label}</Text>
            </View>
            <View style={styles.pill}>
              <MaterialCommunityIcons name="send-clock" size={14} color={TEXT_MUTED} />
              <Text style={styles.pillText}>Invitación: {formatDateTime(item.invitedAt)}</Text>
            </View>
            <View style={styles.pill}>
              <MaterialCommunityIcons name="reply" size={14} color={TEXT_MUTED} />
              <Text style={styles.pillText}>Respuesta: {formatDateTime(item.respondedAt)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statusCol}>
          <MaterialCommunityIcons name={vis.icon} size={22} color={vis.color} />
          <Text style={[styles.statusText, { color: vis.color }]}>{vis.label}</Text>
        </View>
      </View>
    );
  };

  if (loading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        {renderHeader()}
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={{ color: TEXT_MUTED, marginTop: 8 }}>Cargando invitaciones…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      <View style={styles.contentWrap}>
        <Text style={styles.groupName}>{nameOverride || data?.groupName || 'Grupo'}</Text>
        <View style={styles.creatorCard}>
          <View style={styles.creatorIcon}>
            <MaterialCommunityIcons name="account-tie" size={20} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.creatorLabel}>Creador del grupo</Text>
            <Text style={styles.creatorName}>{creatorName || '—'}</Text>
          </View>
        </View>
        <View style={styles.chipsRow}>
          <View style={[styles.chip, { borderColor: WARN }]}>
            <View style={[styles.dot, { backgroundColor: WARN }]} />
            <Text style={styles.chipText}>Invitado</Text>
            <Text style={styles.chipBadge}>{invitedCount}</Text>
          </View>
          <View style={[styles.chip, { borderColor: OK }]}>
            <View style={[styles.dot, { backgroundColor: OK }]} />
            <Text style={styles.chipText}>Aceptado</Text>
            <Text style={styles.chipBadge}>{acceptedCount}</Text>
          </View>
        </View>
        {!!lastUpdated && (
          <Text style={styles.updatedText}>Última actualización: {lastUpdated}</Text>
        )}
      </View>

      <FlatList
        data={data?.invitations ?? []}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="account-group-outline" size={38} color={TEXT_MUTED} />
            </View>
            <Text style={styles.emptyTitle}>Sin invitaciones visibles</Text>
            <Text style={styles.emptyDesc}>
              Aún no hay personas en estado Invitado o Aceptado para este grupo.
            </Text>
          </View>
        }
      />
    </View>
  );
}

// ===== Estilos =====
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  headerGradient: {
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: PRIMARY,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconGlass: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  press: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  headerApp: { color: '#FFFFFF', marginTop: 10, textAlign: 'center', fontSize: 14, opacity: 0.9, fontWeight: '700' },
  headerTitle: { color: '#FFFFFF', textAlign: 'center', marginTop: 6, fontSize: 22, fontWeight: '800' },
  contentWrap: { paddingHorizontal: 16, paddingTop: 16 },
  groupName: { fontSize: 20, fontWeight: '800', color: INK, textAlign: 'center', marginBottom: 10 },
  creatorCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderColor: BORDER,
    borderWidth: 1, padding: 14, borderRadius: 18, marginBottom: 12,
  },
  creatorIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E6FFFA', borderWidth: 1, borderColor: '#CFFAFE', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  creatorLabel: { color: TEXT_MUTED, fontSize: 12 },
  creatorName: { color: INK, fontSize: 15, fontWeight: '700', marginTop: 2 },
  chipsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.2, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#FFF', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 999 },
  chipText: { color: INK, fontSize: 12, fontWeight: '600' },
  chipBadge: { marginLeft: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#F1F5F9', color: INK, fontSize: 12, fontWeight: '700' },
  updatedText: { textAlign: 'center', color: TEXT_MUTED, fontSize: 12, marginBottom: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: CARD, borderColor: BORDER, borderWidth: 1, padding: 12, borderRadius: 16, marginTop: 10, gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 999, backgroundColor: '#E6FFFA', borderWidth: 1, borderColor: '#CFFAFE', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: PRIMARY, fontWeight: '800' },
  name: { color: INK, fontWeight: '700', fontSize: 14 },
  email: { color: TEXT_MUTED, fontSize: 12, marginTop: 2 },
  datesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC',
    borderColor: BORDER, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: 999, alignSelf: 'flex-start',
  },
  pillText: { color: TEXT_MUTED, fontSize: 12 },
  statusCol: { alignItems: 'center', justifyContent: 'center', minWidth: 86, gap: 4 },
  statusText: { fontWeight: '800', fontSize: 12 },
  loadingBox: { paddingTop: 40, alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 36, gap: 10, paddingHorizontal: 24 },
  emptyIcon: {
    width: 66, height: 66, borderRadius: 22, backgroundColor: '#EEF2F7',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { color: INK, fontWeight: '800', fontSize: 16, marginTop: 6 },
  emptyDesc: { color: TEXT_MUTED, textAlign: 'center', fontSize: 13, lineHeight: 18 },
});
