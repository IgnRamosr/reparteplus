// app/grupos/[id].tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router, type Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PRIMARY = '#0EA5A4';
const BG = '#F8FBFC';
const INK = '#0F172A';
const CARD = '#FFFFFF';

type Gasto = {
  id: string;
  concepto: string;
  pagador: string;
  pagado: boolean;
  monto?: number;
  moneda?: string;
};

export default function GrupoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const groupId = Array.isArray(id) ? id[0] : id ?? '';

  console.log(id, groupId )

  const detalles = useMemo(
    () => ({
      nombre: 'Viaje de negocios',
      descripcion: 'Viaje de negocios a viña del mar',
      creador: 'Luis Gonzalez',
      inicio: '2025-08-13',
      termino: '2025-12-12',
    }),
    []
  );

  const [gastos, setGastos] = useState<Gasto[]>([
    { id: 'g1', concepto: 'Bencina',   pagador: 'Luis Gonzalez',   pagado: false, monto: 60000, moneda: 'CLP' },
    { id: 'g2', concepto: 'Almuerzo',  pagador: 'Ignacio Ramos',   pagado: true,  monto: 18000, moneda: 'CLP' },
    { id: 'g3', concepto: 'Desayuno',  pagador: 'Sebastián Tapia', pagado: false, monto: 4500,  moneda: 'CLP' },
  ]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('gasto:creado', (nuevo: Gasto) => {
      setGastos(prev => [nuevo, ...prev]);
    });
    return () => sub.remove();
  }, []);

  const safePush = (href: Href) => router.push(href);

  const goRegistrarGasto = useCallback(() => {
    safePush({ pathname: '/RegistrarGasto', params: { grupo: groupId } });
  }, [groupId]);

  const goInvitar = useCallback(() => {
    safePush({ pathname: '/InvitacionParticipantesGeneral', params: { grupo: groupId } });
  }, [groupId]);

  const verGasto = (gastoId: string) => {
    safePush({ pathname: '/detallegasto', params: { gasto: gastoId } });
  };

  const editarGasto = (gastoId: string) => {
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

  return (
    <View style={estilos.container}>
      {/* Header */}
      <View style={estilos.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [estilos.backBtn, pressed && estilos.backBtnPressed]}
          hitSlop={10}
          android_ripple={{ color: 'rgba(14,165,164,0.15)', borderless: true }}
          accessibilityLabel="Volver"
        >
          <MaterialCommunityIcons name="arrow-left" size={26} color={INK} />
        </Pressable>

        <View style={{ alignItems: 'center' }}>
          <Text style={estilos.appTitle}>Reparte+</Text>
          <Text style={estilos.groupTitle}>{detalles.nombre}</Text>
        </View>

        <Pressable
          onPress={() => safePush('/CreacionGrupos' as Href)}
          style={({ pressed }) => [estilos.editTop, pressed && estilos.editTopPressed]}
          hitSlop={10}
          android_ripple={{ color: 'rgba(14,165,164,0.15)', borderless: true }}
          accessibilityLabel="Crear/Editar grupo"
        >
          <MaterialCommunityIcons name="pencil-outline" size={22} color={INK} />
        </Pressable>
      </View>

      {/* Descripción */}
      <View style={{ alignItems: 'center', marginBottom: 6 }}>
        <Text style={estilos.groupSubtitle}>{detalles.descripcion}</Text>
      </View>

      {/* Metadatos */}
      <View style={{ marginBottom: 10 }}>
        <Text style={estilos.metaText}>Creador: <Text style={estilos.metaStrong}>{detalles.creador}</Text></Text>
        <Text style={estilos.metaText}>Fecha de inicio: <Text style={estilos.metaStrong}>{fmt(detalles.inicio)}</Text></Text>
        <Text style={estilos.metaText}>Fecha de término: <Text style={estilos.metaStrong}>{fmt(detalles.termino)}</Text></Text>
      </View>

      {/* Tabla de gastos */}
      <View style={estilos.tableWrapper}>
        <View style={estilos.tableHeader}>
          <Text style={[estilos.th, estilos.colGasto]}>Gasto</Text>
          <Text style={[estilos.th, estilos.colPagador]}>Pagador</Text>
          <Text style={[estilos.th, estilos.colPagado, estilos.center]}>Pagado</Text>
          <Text style={[estilos.th, estilos.colAcciones, estilos.center]}>Acciones</Text>
        </View>

        <FlatList<Gasto>
          data={gastos}
          keyExtractor={(g: Gasto) => g.id}
          renderItem={({ item }: { item: Gasto }) => (
            <View style={estilos.row}>
              <Text style={[estilos.cellText, estilos.colGasto]} numberOfLines={1} ellipsizeMode="tail">
                {item.concepto}
              </Text>
              <Text style={[estilos.cellText, estilos.colPagador]} numberOfLines={1} ellipsizeMode="tail">
                {item.pagador}
              </Text>

              <View style={[estilos.colPagado, estilos.center]}>
                {item.pagado ? (
                  <MaterialCommunityIcons name="check" size={15} color={INK} />
                ) : (
                  <MaterialCommunityIcons name="close-circle-outline" size={15} color={INK} />
                )}
              </View>

              <View style={[estilos.colAcciones, estilos.actionsCell]}>
                <Pressable onPress={() => verGasto(item.id)} style={estilos.iconBtn}>
                  <MaterialCommunityIcons name="eye-outline" size={15} color={INK} />
                </Pressable>
                <Pressable onPress={() => editarGasto(item.id)} style={estilos.iconBtn}>
                  <MaterialCommunityIcons name="pencil-outline" size={15} color={INK} />
                </Pressable>
                <Pressable onPress={() => eliminarGasto(item.id)} style={estilos.iconBtn}>
                  <MaterialCommunityIcons name="delete-outline" size={15} color={INK} />
                </Pressable>
              </View>
            </View>
          )}
        />
      </View>

      {/* Acciones */}
      <Pressable onPress={goRegistrarGasto} style={estilos.primaryBtn}>
        <View style={estilos.rowInline}>
          <MaterialCommunityIcons name="pencil-box-outline" size={18} color="#fff" />
          <Text style={estilos.primaryBtnText}>Registrar gasto</Text>
        </View>
      </Pressable>

      <Pressable onPress={goInvitar} style={estilos.secondaryBtn}>
        <View style={estilos.rowInline}>
          <MaterialCommunityIcons name="account-multiple-plus-outline" size={18} color={PRIMARY} />
          <Text style={estilos.secondaryBtnText}>Añadir participantes</Text>
        </View>
      </Pressable>
    </View>
  );
}

function fmt(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 20, paddingTop: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  backBtn: { padding: 6, borderRadius: 10 },
  backBtnPressed: { backgroundColor: '#F0FBFA' },

  appTitle: { fontSize: 22, fontWeight: '800', color: INK },
  groupTitle: { fontSize: 18, fontWeight: '700', color: INK },
  groupSubtitle: { fontSize: 14, fontWeight: '600', color: INK },

  editTop: { padding: 6, borderRadius: 10 },
  editTopPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.95 }] },

  metaText: { fontSize: 12, color: INK },
  metaStrong: { fontWeight: '700' },

  tableWrapper: {
    backgroundColor: CARD,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5F5F4',
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FBFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  th: { fontSize: 11, fontWeight: '700', color: INK },
  center: { textAlign: 'center', alignItems: 'center', justifyContent: 'center' } as any,

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#EEF7F6',
  },

  colGasto:   { flex: 1, minWidth: 80 },
  colPagador: { flex: 1, minWidth: 80 },
  colPagado:  { width: 42 },
  colAcciones:{ width: 78 },

  cellText: { fontSize: 12, color: INK, paddingRight: 4, flexShrink: 1 },
  cellBox: { justifyContent: 'center' },

  actionsCell: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  iconBtn: { padding: 3, borderRadius: 8 },

  rowInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtn: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginTop: 6, marginBottom: 8, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryBtn: { backgroundColor: CARD, borderWidth: 1, borderColor: PRIMARY, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  secondaryBtnText: { color: PRIMARY, fontSize: 14, fontWeight: '700' },
});
