// app/grupos/index.tsx
import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// === Tokens idénticos a MenuPrincipal ===
const PRIMARY = '#0EA5A4'; // teal-500
const BG = '#F8FBFC';      // casi blanco azulado
const TEXT_MUTED = '#64748B';
const CARD = '#FFFFFF';

type Grupo = { id: number; nombre: string };

export default function VerTodosLosGrupos() {
  // Lista sin eventos/contadores; solo navegación
  const grupos: Grupo[] = useMemo(
    () => [
      { id: 59, nombre: 'Viaje a pucon' },
      { id: 60, nombre: 'Viaje a africa' },
      { id: 61, nombre: 'Almuerzo' },
      { id: 62, nombre: 'Fiesta' },
    ],
    []
  );

  const abrirGrupo = (id: number) => {
  router.push({
    pathname: '/grupos/MenuGrupo',   // <-- ruta del archivo destino
    params: { id: String(id) },           // <-- los params SIEMPRE son string
  });
};

  return (
    <View style={estilos.container}>
      {/* Header con back, mismo layout/jerarquía */}
      <View style={estilos.header}>
        <Pressable
          onPress={() => router.back()}
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

      {/* Lista de tarjetas estilo "outline" (como tus botones secundarios) */}
      <FlatList
        data={grupos}
        keyExtractor={(g) => g.id.toString()}
        contentContainerStyle={estilos.listContent}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => abrirGrupo(item.id)}
            android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
            style={({ pressed }) => [estilos.card, pressed && estilos.cardPressed]}
          >
            <Text style={estilos.cardText}>{item.nombre}</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={PRIMARY} />
          </Pressable>
        )}
      />

      {/* Botón primario coherente con “Crear grupo” */}
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
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 24, paddingTop: 60 },

  header: { width: '100%', alignItems: 'center', marginBottom: 16, position: 'relative' },
  backBtn: { position: 'absolute', top: 0, left: 0, padding: 6, borderRadius: 10 },
  backBtnPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.96 }] },

  titulo: { fontSize: 34, fontWeight: '800', color: PRIMARY },
  subtitulo: { fontSize: 18, fontWeight: '600', color: TEXT_MUTED, marginTop: 2 },

  listContent: { paddingVertical: 8 },

  // Tarjeta estilo "botonSec"
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

  // Botón primario (igual a MenuPrincipal)
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
});
