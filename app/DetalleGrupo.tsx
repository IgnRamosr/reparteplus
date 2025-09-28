// app/grupos/[id].tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

export default function DetalleGrupo() {
const { id, nombre, descripcion, fecha_inicio, fecha_cierre } =
    useLocalSearchParams<{ id: string, nombre?: string; descripcion?: string; fecha_inicio?: string; fecha_cierre?: string;}>();
const insets = useSafeAreaInsets();

const [creador, setCreador] = useState<string | null>(null);
const [cargando, setCargando] = useState<boolean>(true);

useEffect(() => {
    let cancel = false;
    (async () => {
    const creadorGrupo = await obtenerNombreparticipante().catch(() => null);
    if (!cancel) setCreador(creadorGrupo);
    if (!id) return;
    setCargando(true);
    const resp = await api.get(`/grupo/${id}`);
    if (!cancel) {
        if (resp.status >= 200 && resp.status < 300 && resp.data) {
        const g = resp.data;
        setGrupo({
            id,
            nombre: g.nombre,
            descripcion: g.descripcion,
            fecha_inicio: g.fecha_inicio,
            fecha_cierre: g.fecha_cierre,
            creador: creadorGrupo ?? undefined,
        });
        }
        setCargando(false);
    }
    })();
    return () => { cancel = true; };
}, [id]);

const [grupo, setGrupo] = useState<Grupo | null>(() =>
    id ? {
    id,
    nombre: nombre ?? '',
    descripcion: descripcion ?? '',
    fecha_inicio: fecha_inicio ?? '',
    fecha_cierre: fecha_cierre ?? '',
    } : null
);

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

return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['top', 'left', 'right']}>
    <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
        paddingTop: insets.top ? 8 : 16,
        paddingHorizontal: 16,
        paddingBottom: 24,
        backgroundColor: BG,
        flexGrow: 1,
        }}
    >
        {/* Header */}
        <View style={styles.header}>
        <Pressable
            onPress={editarGrupo}
            hitSlop={10}
            android_ripple={{ color: 'rgba(14,165,164,0.12)', borderless: true }}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
            <MaterialCommunityIcons name="layers-edit" size={40} color={PRIMARY} />
        </Pressable>
        </View>

        {/* Títulos */}
        <Text style={styles.appTitle}>Reparte+</Text>

        {cargando && !grupo?.nombre ? (
        <View style={{ marginTop: 24, alignItems: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: TEXT_MUTED }}>Cargando grupo…</Text>
        </View>
        ) : (
        <>
            <Text style={styles.groupTitle}>{grupo?.nombre || '—'}</Text>
            <Text style={styles.groupSubtitle}>{grupo?.descripcion || '—'}</Text>

            {/* Meta */}
            <View style={{ marginTop: 8 }}>
            <Text style={styles.meta}>
                <Text style={styles.metaLabel}>Creador:</Text> {String(grupo?.creador ?? creador ?? '—')}
            </Text>

            <Text style={styles.meta}>
                <Text style={styles.metaLabel}>Fecha de inicio:</Text> {fmtCL(grupo?.fecha_inicio)}
            </Text>
            <Text style={styles.meta}>
                <Text style={styles.metaLabel}>Fecha de término:</Text> {fmtCL(grupo?.fecha_cierre)}
            </Text>
            </View>
        </>
        )}

        {/* Tabla */}
        <View style={styles.table}>
          {/* Encabezado */}
        <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.th, styles.thHeader, { flex: 1.2 }]}>Gasto</Text>
            <Text style={[styles.th, styles.thHeader, { flex: 1.2 }]}>Pagador</Text>
            <Text style={[styles.th, styles.thHeader, { width: 70, textAlign: 'center' }]}>Pagado</Text>
            <Text style={[styles.th, styles.thHeader, { width: 110, textAlign: 'center' }]}>Acciones</Text>
        </View>

          {/* Cuerpo (sin datos aún) */}
        <View style={[styles.row, styles.emptyRow]}>
            <Text style={styles.emptyText}>Aún no hay gastos registrados</Text>
        </View>
        </View>
    </ScrollView>
    </SafeAreaView>
);
}

/** dd/mm/aaaa desde 'YYYY-MM-DD' */
function fmtCL(ymd?: string) {
if (!ymd) return '';
const [y, m, d] = ymd.split('-').map(Number);
const date = new Date(y, (m ?? 1) - 1, d ?? 1);
return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ====== SOLO ESTILOS LedgerTeal ======
const PRIMARY = '#0EA5A4'; // teal
const BG = '#F8FBFC';      // casi blanco azulado
const TEXT = '#0F172A';
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';
const CARD = '#FFFFFF';

const styles = StyleSheet.create({
header: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
iconBtn: { padding: 6, borderRadius: 12 },
  // 👇 highlight para el botón de editar
iconBtnPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.97 }] },

appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: PRIMARY,
    textAlign: 'center',
    marginTop: 8,
},
groupTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT,
    textAlign: 'center',
    marginTop: 4,
},
groupSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 4,
},

meta: { fontSize: 14, color: TEXT, marginTop: 2 },
metaLabel: { fontWeight: '700', color: TEXT_MUTED },

table: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: CARD,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
},
row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 44 },

headerRow: {
    backgroundColor: PRIMARY,
},
th: { fontSize: 14, fontWeight: '700', paddingVertical: 10 },
thHeader: { color: '#FFFFFF' },

td: { fontSize: 14, color: TEXT },
tdBox: { flexDirection: 'row', alignItems: 'center' },

emptyRow: { justifyContent: 'center', paddingVertical: 20 },
emptyText: { color: TEXT_MUTED, fontStyle: 'italic' },
});
