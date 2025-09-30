import React, { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { authSignOut } from '../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { borrarIDparticipante } from '@/lib/funcionesParticipante';

export default function MenuPrincipal() {



  const handleLogout = useCallback(() => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          try {
            await authSignOut();
            await AsyncStorage.removeItem('auth_token');
            await borrarIDparticipante();
            router.replace('/login');
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'No se pudo cerrar sesión');
          }
        },
      },
    ]);
  }, []);

  return (
    <View style={estilos.container}>
      {/* Header */}
      <View style={estilos.header}>
        <Text style={estilos.titulo}>Reparte+</Text>
        <Text style={estilos.subtitulo}>Menú Principal</Text>

        {/* Ícono cerrar sesión */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [estilos.logoutBtn, pressed && estilos.logoutBtnPressed]}
          hitSlop={10}
          android_ripple={{ color: 'rgba(14,165,164,0.15)', borderless: true }}
          accessibilityLabel="Cerrar sesión"
        >
          <MaterialCommunityIcons name="logout" size={26} color="#14B8A6" />
        </Pressable>
      </View>

      {/* Crear Grupo (PRIMARIO) */}
      <Pressable
        onPress={() => router.push('/CreacionGrupos')}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
        style={({ pressed }) => [estilos.boton, pressed && estilos.botonPressed]}
      >
        <View style={estilos.row}>
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          <Text style={estilos.botonTexto}>Crear grupo</Text>
        </View>
      </Pressable>

      {/* Pagar saldo pendiente (SECUNDARIO outline) */}
      <Pressable
        android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
        style={({ pressed }) => [estilos.boton, estilos.botonSec, pressed && estilos.botonSecPressed]}
      >
        <View style={estilos.row}>
          <MaterialCommunityIcons name="currency-usd" size={20} color={PRIMARY} />
          <Text style={[estilos.botonTexto, estilos.botonTextoSec]}>Pagar saldo pendiente</Text>
        </View>
      </Pressable>

      {/* Registrar gasto (SECUNDARIO outline) */}
      <Pressable
        android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
        style={({ pressed }) => [estilos.boton, estilos.botonSec, pressed && estilos.botonSecPressed]}
      >
        <View style={estilos.row}>
          <MaterialCommunityIcons name="note-edit-outline" size={20} color={PRIMARY} />
          <Text style={[estilos.botonTexto, estilos.botonTextoSec]}>Registrar gasto</Text>
        </View>
      </Pressable>

      {/* Añadir participantes (PRIMARIO) */}
      <Pressable
        onPress={() => router.push('/InvitacionParticipantesGeneral')}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
        style={({ pressed }) => [estilos.boton, pressed && estilos.botonPressed]}
      >
        <View style={estilos.row}>
          <MaterialCommunityIcons name="account-multiple-plus-outline" size={20} color="#fff" />
          <Text style={estilos.botonTexto}>Añadir participantes</Text>
        </View>
      </Pressable>

      {/* Ver todos los grupos (SECUNDARIO outline) */}
      <Pressable
        android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
        style={({ pressed }) => [estilos.boton, estilos.boton, pressed && estilos.botonSecPressed]}
        onPress={() => router.push('/VerTodosLosGrupos')}
      >
        <View style={estilos.row}>
          <MaterialCommunityIcons name="eye-outline" size={20} color="#fff" />
          <Text style={[estilos.botonTexto, estilos.botonTexto]}>Ver todos los grupos</Text>
        </View>
      </Pressable>


      {/* Finalizar evento (SECUNDARIO outline) */}
      <Pressable
        android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
        style={({ pressed }) => [estilos.boton, estilos.botonSec, pressed && estilos.botonSecPressed]}
      >
        <View style={estilos.row}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={PRIMARY} />
          <Text style={[estilos.botonTexto, estilos.botonTextoSec]}>Finalizar evento</Text>
        </View>
      </Pressable>
    </View>
  );
}

// ====== SOLO ESTILOS LedgerTeal ======
const PRIMARY = '#0EA5A4'; // teal-500
const BG = '#F8FBFC';      // casi blanco azulado
const TEXT_MUTED = '#64748B';
const CARD = '#FFFFFF';
const BORDER = '#E2E8F0';

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 24, paddingTop: 60 },

  header: { width: '100%', alignItems: 'center', marginBottom: 24, position: 'relative' },
  logoutBtn: { position: 'absolute', top: 0, right: 0, padding: 6, borderRadius: 10  },
  // highlight logout
  logoutBtnPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.96 }] },

  titulo: { fontSize: 34, fontWeight: '800', color: PRIMARY },
  subtitulo: { fontSize: 18, fontWeight: '600', color: TEXT_MUTED, marginTop: 2 },

  boton: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  // highlight primario
  botonPressed: {
    backgroundColor: '#14B8A6',
    transform: [{ scale: 0.985 }],
    shadowOpacity: 0.12,
    elevation: 3,
  },
  // Outline secundario
  botonSec: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  // highlight outline
  botonSecPressed: {
    backgroundColor: '#F0FBFA',
    transform: [{ scale: 0.985 }],
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  botonTextoSec: { color: PRIMARY },
});
