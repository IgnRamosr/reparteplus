/*/ app/DetalleGasto.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api, GrupoUI, IntegranteUI } from '@/lib/api';
import SelectorGrupo from '@/components/SelectorGrupo';
import { formatCLP, calcularRepartoCLP, SimpleIntegrante } from '@/lib/utils';

const PRIMARY = '#0EA5A4', BG = '#F8FBFC', TEXT = '#0F172A', TEXT_MUTED = '#64748B';
const CARD = '#FFFFFF', BORDER = '#E2E8F0';

type Row = { id: string; nombre: string; pagado: boolean; pendiente: number };

export default function DetalleGasto() {
  const [grupo, setGrupo] = useState<GrupoUI | null>(null);
  const [cargando, setCargando] = useState(false);
  const [integrantes, setIntegrantes] = useState<Row[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [nombreGasto, setNombreGasto] = useState('');
  const [monto, setMonto] = useState('');
  const [pagadoPorId, setPagadoPorId] = useState('');

  const totalCalculado = useMemo(
    () => integrantes.reduce((a, i) => a + (i.pendiente ?? 0), 0),
    [integrantes]
  );

  // Cargar integrantes cuando cambia el grupo
  useEffect(() => {
    (async () => {
      if (!grupo) { setIntegrantes([]); return; }
      setCargando(true);
      try {
        const ints: IntegranteUI[] = await api.listarIntegrantesDeGrupo(grupo.id);
        const filas: Row[] = ints.map(i => ({ id: i.id, nombre: i.nombre, pagado: false, pendiente: 0 }));
        setIntegrantes(filas);
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'No se pudieron cargar los integrantes');
      } finally {
        setCargando(false);
      }
    })();
  }, [grupo?.id]);

  // Validaciones (admite "10.000" o "10000")
  const montoNum = Number(monto.replace(/\./g, '').replace(',', '.'));
  const formEsValido =
    !!grupo &&
    nombreGasto.trim().length > 0 &&
    pagadoPorId.trim().length > 0 &&
    !!monto.trim() &&
    !Number.isNaN(montoNum) &&
    montoNum > 0 &&
    integrantes.length > 0;

  const guardarGasto = async () => {
    if (!formEsValido || !grupo) return;

    // Reparto en CLP (enteros)
    const base: SimpleIntegrante[] = integrantes.map(i => ({ id: i.id, nombre: i.nombre }));
    const reparto = calcularRepartoCLP(Math.round(montoNum), base);
    const nuevos = integrantes.map(i => {
      const r = reparto.find(x => x.participanteId === i.id);
      return r ? { ...i, pendiente: r.monto, pagado: i.id === pagadoPorId ? true : i.pagado } : i;
    });
    setIntegrantes(nuevos);

    // POST real
    await api.registrarGasto({
      grupoId: grupo.id,
      nombreGasto: nombreGasto.trim(),
      montoTotalCLP: Math.round(montoNum),
      pagadoPorId,
    });

    setModalVisible(false);
    Alert.alert('Éxito', 'Gasto registrado correctamente.');
  };

  return (
    <View style={estilos.container}>
      <View style={estilos.header}>
        <Text style={estilos.titulo}>Reparte+</Text>
        <Text style={estilos.subtitulo}>Detalles de gasto</Text>
      </View>

      {/* Selector de grupo }/*
      /*<SelectorGrupo onChange={setGrupo} />

      {/* Cabecera resumen }/*
      /*<View style={{ marginTop: 10 }}>
        <Text style={estilos.labelStrong}>Gasto: <Text style={estilos.text}>{nombreGasto || '—'}</Text></Text>
        <Text style={estilos.labelStrong}>Total: <Text style={estilos.text}>{formatCLP(totalCalculado)}</Text></Text>
      </View>

      {/* Lista integrantes }/*
      /*<View style={estilos.card}>
        <View style={estilos.rowHeader}>
          <Text style={[estilos.hCell, { flex: 2 }]} numberOfLines={1}>Integrante</Text>
          <Text style={estilos.hCell} numberOfLines={1}>Pendiente</Text>
          <Text style={estilos.hCell} numberOfLines={1}>Pagado</Text>
        </View>

        {cargando ? (
          <View style={{ padding: 16, alignItems: 'center' }}><ActivityIndicator color={PRIMARY} /></View>
        ) : (
          <ScrollView style={{ maxHeight: 200 }}>
            {integrantes.map(it => (
              <View key={it.id} style={estilos.rowItem}>
                <Text style={[estilos.cell, { flex: 2 }]} numberOfLines={1}>{it.nombre}</Text>
                <Text style={estilos.cell}>{formatCLP(it.pendiente)}</Text>
                <MaterialCommunityIcons
                  name={it.pagado ? 'check-circle' : 'close-circle-outline'}
                  size={20}
                  color={it.pagado ? PRIMARY : '#94a3b8'}
                />
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Resumen simple }/*
      /*<View style={estilos.card}>
        <View style={estilos.rowHeader}>
          <Text style={[estilos.hCell, { flex: 2 }]}>Integrantes</Text>
        </View>
        {integrantes.map(it => (
          <View key={it.id} style={estilos.rowItem}>
            <Text style={[estilos.cell, { flex: 2 }]} numberOfLines={1}>{it.nombre}</Text>
          </View>
        ))}
      </View>

      {/* Acciones secundarias }/*
      /*<Pressable onPress={() => Alert.alert('Pendiente', 'Aquí irá el gráfico de gasto.')}
        android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
        style={({ pressed }) => [estilos.btnOutline, pressed && estilos.btnOutlinePressed]}>
        <View style={estilos.rowBtn}>
          <MaterialCommunityIcons name="chart-bar" size={18} color={PRIMARY} />
          <Text style={estilos.btnOutlineText}>Ver gráfico de gasto</Text>
        </View>
      </Pressable>

      <Pressable onPress={() => Alert.alert('Pendiente', 'Aquí exportarás a PDF.')}
        android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
        style={({ pressed }) => [estilos.btnOutline, pressed && estilos.btnOutlinePressed]}>
        <View style={estilos.rowBtn}>
          <MaterialCommunityIcons name="file-export-outline" size={18} color={PRIMARY} />
          <Text style={estilos.btnOutlineText}>Exportar gastos a PDF</Text>
        </View>
      </Pressable>

      {/* Abrir formulario }/*
      /*<Pressable
        onPress={() => setModalVisible(true)}
        disabled={!grupo || integrantes.length === 0}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
        style={({ pressed }) => [estilos.btnPrimary, pressed && estilos.btnPrimaryPressed, (!grupo || integrantes.length === 0) && { opacity: 0.6 }]}
      >
        <Text style={estilos.btnPrimaryText}>Registrar gasto</Text>
      </Pressable>

      {/* Modal }/*
      /*<Modal visible={modalVisible} animationType="slide" transparent>
        <View style={estilos.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={estilos.modalCard}>
            <Text style={estilos.modalTitle}>Registrar gasto</Text>
            <ScrollView contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, maxHeight: '70%' }}>
              <TextInput placeholder="Nombre del gasto" value={nombreGasto} onChangeText={setNombreGasto} style={estilos.input} />
              <TextInput placeholder="Monto total (CLP)" value={monto} onChangeText={setMonto} keyboardType="numeric" style={estilos.input} />
              <TextInput placeholder="ID de quien pagó (luego será picker)" value={pagadoPorId} onChangeText={setPagadoPorId} style={estilos.input} />
            </ScrollView>

            <View style={estilos.actionsBar}>
              <Pressable onPress={guardarGasto} disabled={!formEsValido}
                android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
                style={({ pressed }) => [estilos.btnPrimary, { marginTop: 0, flex: 1 }, (!formEsValido) && { opacity: 0.6 }, pressed && formEsValido && estilos.btnPrimaryPressed]}>
                <Text style={estilos.btnPrimaryText}>Guardar gasto</Text>
              </Pressable>
              <View style={{ width: 12 }} />
              <Pressable onPress={() => setModalVisible(false)}
                android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
                style={({ pressed }) => [estilos.btnOutline, { flex: 1, marginTop: 0 }, pressed && estilos.btnOutlinePressed]}>
                <Text style={estilos.btnOutlineText}>Cancelar</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 16, paddingTop: 60 },
  header: { alignItems: 'center', marginBottom: 12 },
  titulo: { fontSize: 32, fontWeight: '800', color: PRIMARY },
  subtitulo: { fontSize: 18, fontWeight: '700', color: TEXT_MUTED, marginTop: 2 },
  labelStrong: { color: TEXT_MUTED, fontSize: 14, fontWeight: '700' },
  text: { color: TEXT, fontWeight: '700' },
  card: { borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, borderRadius: 14, padding: 10, marginTop: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },

rowHeader: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BORDER },
hCell: { flex: 1, color: TEXT_MUTED, fontWeight: '700', fontSize: 13, minWidth: 0 }, // 👈 baja font y evita wrap
cell: { flex: 1, color: TEXT, minWidth: 0 }, // 👈 minWidth 0 ayuda a que no corte raro
  rowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  rowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnPrimary: { backgroundColor: PRIMARY, borderRadius: 14, height: 48, alignItems: 'center', justifyContent: 'center',
    marginTop: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  btnPrimaryPressed: { backgroundColor: '#14B8A6', transform: [{ scale: 0.98 }], shadowOpacity: 0.12, elevation: 3 },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnOutline: { backgroundColor: CARD, borderRadius: 14, height: 48, alignItems: 'center', justifyContent: 'center',
    marginTop: 12, borderWidth: 1, borderColor: PRIMARY },
  btnOutlinePressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.98 }] },
  btnOutlineText: { color: PRIMARY, fontWeight: '700', fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: CARD, padding: 16, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTopWidth: 1, borderColor: BORDER },
  modalTitle: { fontSize: 18, fontWeight: '800', color: TEXT, textAlign: 'center', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, backgroundColor: CARD, marginBottom: 10, color: TEXT },
  actionsBar: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
});
*/

// app/detallegasto.tsx
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// ====== PALETA LedgerTeal ======
const PRIMARY = '#0EA5A4'; // teal
const BG = '#F8FBFC';      // fondo claro
const INK = '#0F172A';     // texto principal
const CARD = '#FFFFFF';    // tarjetas
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';

type Fila = {
  id: string;
  nombre: string;
  pendiente: string;
  pagado: boolean;
};

export default function DetalleGastoScreen() {
  // id del gasto (mock)
  const { gasto } = useLocalSearchParams<{ gasto?: string }>();

  // Datos demo
  const header = useMemo(
    () => ({ titulo: 'Bencina', total: '60000CLP', id: (gasto as string) || 'g1' }),
    [gasto]
  );

  const filas: Fila[] = useMemo(
    () => [
      { id: 'u1', nombre: 'Ignacio Ramos',     pendiente: '20000CLP',  pagado: false },
      { id: 'u2', nombre: 'Luis Gonzalez',     pendiente: '0CLP',   pagado: true  },
      { id: 'u3', nombre: 'Sebastián Tapia',   pendiente: '20000CLP', pagado: false },
    ],
    []
  );

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}
          hitSlop={10}
          android_ripple={{ color: 'rgba(14,165,164,0.15)', borderless: true }}
          accessibilityLabel="Volver"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={INK} />
        </Pressable>

        <View style={{ alignItems: 'center' }}>
          <Text style={s.appTitle}>Reparte+</Text>
          <Text style={s.screenTitle}>Detalles de gasto</Text>
        </View>

        {/* Placeholder para alinear el título */}
        <View style={{ width: 24 }} />
      </View>

      {/* Resumen */}
      <View style={{ marginBottom: 12 }}>
        <Text style={s.titleRow}>
          <Text style={s.titleLabel}>Gasto: </Text>
          <Text style={s.titleValue}>{header.titulo}</Text>
        </Text>
        <Text style={s.titleRow}>
          <Text style={s.titleLabel}>Total: </Text>
          <Text style={s.titleValue}>{header.total}</Text>
        </Text>
        <Text style={s.idText}>ID: {header.id}</Text>
      </View>

      {/* Tabla */}
      <View style={s.tableWrapper}>
        <View style={s.tableHeader}>
          <Text style={[s.th, s.colIntegrante]}>Integrante</Text>
          <Text style={[s.th, s.colPendiente, s.center]}>Pendiente</Text>
          <Text style={[s.th, s.colPagado, s.center]}>Pagado</Text>
        </View>

        <FlatList<Fila>
          data={filas}
          keyExtractor={(f) => f.id}
          renderItem={({ item }) => (
            <View style={s.row}>
              <Text style={[s.cellText, s.colIntegrante]} numberOfLines={1} ellipsizeMode="tail">
                {item.nombre}
              </Text>

              <Text style={[s.cellText, s.colPendiente, s.center]} numberOfLines={1} ellipsizeMode="tail">
                {item.pendiente}
              </Text>

              <View style={[s.colPagado, s.center]}>
                {item.pagado ? (
                  <MaterialCommunityIcons name="check" size={15} color={INK} />
                ) : (
                  <MaterialCommunityIcons name="close-circle-outline" size={15} color={INK} />
                )}
              </View>
            </View>
          )}
        />
      </View>

      {/* Botón outline */}
      <Pressable
        onPress={() => {}}
        style={({ pressed }) => [s.secondaryBtn, pressed && s.secondaryBtnPressed]}
        android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
      >
        <View style={s.rowInline}>
          <MaterialCommunityIcons name="chart-bar" size={18} color={PRIMARY} />
          <Text style={s.secondaryBtnText}>Ver gráfico de gasto</Text>
        </View>
      </Pressable>

      {/* Botón primario oscuro */}
      <Pressable
        onPress={() => {}}
        style={({ pressed }) => [s.darkBtn, pressed && s.darkBtnPressed]}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
      >
        <View style={s.rowInline}>
          <MaterialCommunityIcons name="file-export" size={18} color="#fff" />
          <Text style={s.darkBtnText}>Exportar gastos a pdf</Text>
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 20, paddingTop: 48 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  backBtn: { padding: 6, borderRadius: 10 },
  backBtnPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.98 }] },

  appTitle: { fontSize: 22, fontWeight: '800', color: PRIMARY },
  screenTitle: { fontSize: 18, fontWeight: '700', color: TEXT_MUTED, marginTop: 2 },

  titleRow: { fontSize: 16, color: INK, marginTop: 2 },
  titleLabel: { fontWeight: '700' },
  titleValue: { fontWeight: '700' },
  idText: { marginTop: 4, color: TEXT_MUTED },

  // === Tabla compacta ===
  tableWrapper: {
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BG,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
  },
  th: { fontSize: 11, fontWeight: '700', color: INK },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },

  // Columnas
  colIntegrante: { flex: 1.4, minWidth: 110 },
  colPendiente:  { flex: 1.1, minWidth: 90 },
  colPagado:     { width: 52 },

  cellText: { fontSize: 12, color: INK, paddingRight: 4, flexShrink: 1 },
  center: { textAlign: 'center', alignItems: 'center', justifyContent: 'center' } as any,

  // Botones
  rowInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  secondaryBtn: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryBtnPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.985 }] },
  secondaryBtnText: { color: PRIMARY, fontSize: 14, fontWeight: '700' },

  darkBtn: {
    backgroundColor: INK,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  darkBtnPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  darkBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
