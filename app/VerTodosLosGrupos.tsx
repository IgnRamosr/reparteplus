// app/grupos/index.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';

/** ===== Mock y tipos ===== */
    export type Grupo = {
    id: string;
    nombre: string;
    descripcion: string;
    fecha_inicio: string;  // YYYY-MM-DD
    fecha_cierre: string;  // YYYY-MM-DD
    creador?: string;
    };

const MOCK_GRUPOS: Grupo[] = [
  { id: '1', nombre: 'Viaje de negocios', descripcion: 'Gastos de hotel y taxis', fecha_inicio: '2025-09-01', fecha_cierre: '2025-09-05', creador: 'Ignacio' },
  { id: '2', nombre: 'Cena familiar', descripcion: 'Restaurante y propinas', fecha_inicio: '2025-09-10', fecha_cierre: '2025-09-10', creador: 'Francisca' },
  { id: '3', nombre: 'Reunión de amigos', descripcion: 'Picoteo y bebidas', fecha_inicio: '2025-09-20', fecha_cierre: '2025-09-20', creador: 'Cata' },
];

async function fetchGruposMock(): Promise<Grupo[]> {
  // Simula latencia de red
  await new Promise(r => setTimeout(r, 400));
  return MOCK_GRUPOS;
}

/** ===== Pantalla ===== */
export default function ListaGruposScreen() {
    const insets = useSafeAreaInsets();
    const [grupos, setGrupos] = useState<Grupo[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        const data = await fetchGruposMock();
        setGrupos(data);
        setLoading(false);
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        const data = await fetchGruposMock();
        setGrupos(data);
        setRefreshing(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const openGrupo = (g: Grupo) => {
        const href: Href = {
        pathname: '/DetalleGrupo',
        params: {
            id: g.id,
            nombre: g.nombre,
            descripcion: g.descripcion,
            fecha_inicio: g.fecha_inicio,
            fecha_cierre: g.fecha_cierre,
        },
        };
        router.push(href);
    };

    return (
        <View style={[styles.screen, { paddingTop: Math.max(insets.top, 90) }]}>
        {/* Header simple con “volver” */}


        <Text style={styles.brand}>Reparte+</Text>
        <Text style={styles.subtitle}>Ver todos los grupos</Text>

        <Text style={styles.sectionTitle}>Grupos:</Text>

        <View style={styles.cardBox}>
            <FlatList
            data={grupos}
            keyExtractor={(g) => g.id}
            contentContainerStyle={{ paddingVertical: 8 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
                !loading ? <Text style={styles.emptyText}>Aún no hay grupos</Text> : null
            }
            renderItem={({ item }) => (
                <Pressable onPress={() => openGrupo(item)} style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
                <Text style={styles.itemText}>{item.nombre}</Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#111827" />
                </Pressable>
            )}
            />
        </View>
        </View>
    );
    }

/** ===== Estilos ===== */
const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    backBtn: { padding: 6 },

    brand: { fontSize: 24, fontWeight: '800', color: '#111827', textAlign: 'center', marginTop: 4 },
    subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 2, marginBottom: 16 },

    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },

    cardBox: {
        borderWidth: 1,
        borderColor: '#111827',
        borderRadius: 12,
        paddingVertical: 6,
    },

    item: {
        marginHorizontal: 10,
        marginVertical: 6,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: '#E5E7EB', // gris claro
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    itemPressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
    itemText: { fontSize: 15, color: '#111827', fontWeight: '600' },

    emptyText: { textAlign: 'center', color: '#6b7280', paddingVertical: 24, fontStyle: 'italic' },
    });
