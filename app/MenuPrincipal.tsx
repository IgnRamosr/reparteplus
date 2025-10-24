// app/MenuPrincipal.tsx
import React, { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, Dimensions, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { authSignOut } from '../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { borrarIDparticipante } from '@/lib/funcionesParticipante';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

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
      {/* Gradiente de fondo decorativo */}
      <LinearGradient
        colors={['#0EA5A4', '#14B8A6', '#10B981']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={estilos.headerGradient}
      />
      
      {/* Header mejorado */}
      <View style={estilos.header}>
        <View style={estilos.logoContainer}>
          <View style={estilos.logoCircle}>
            <MaterialCommunityIcons name="share-variant" size={32} color="#fff" />
          </View>
          <View>
            <Text style={estilos.titulo}>Reparte+</Text>
            <Text style={estilos.subtitulo}>Gestiona tus gastos grupales</Text>
          </View>
        </View>

        {/* Ícono cerrar sesión con mejor posicionamiento */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            estilos.logoutBtn, 
            pressed && estilos.logoutBtnPressed
          ]}
          hitSlop={10}
          android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}
          accessibilityLabel="Cerrar sesión"
        >
          <MaterialCommunityIcons name="logout" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Contenedor de botones con mejor espaciado */}
      <View style={estilos.buttonsContainer}>
        {/* Crear grupo - Botón Principal con gradiente */}
        <Pressable
          onPress={() => router.push('/CreacionGrupos')}
          style={({ pressed }) => [
            pressed && estilos.buttonScale
          ]}
        >
          <LinearGradient
            colors={['#0EA5A4', '#14B8A6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={estilos.botonPrimario}
          >
            <View style={estilos.botonIcono}>
              <MaterialCommunityIcons name="account-group-outline" size={24} color="#fff" />
            </View>
            <View style={estilos.botonContent}>
              <Text style={estilos.botonTextoPrimario}>Crear grupo</Text>
              <Text style={estilos.botonDescripcion}>Inicia un nuevo grupo de gastos</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" style={estilos.chevron} />
          </LinearGradient>
        </Pressable>

        {/* Pagar saldo pendiente */}
        <Pressable
          onPress={() => router.push('/PagarSaldoPendiente')}
          style={({ pressed }) => [
            estilos.botonSecundario,
            pressed && estilos.botonSecundarioPressed
          ]}
        >
          <View style={[estilos.botonIcono, estilos.botonIconoSecundario]}>
            <MaterialCommunityIcons name="cash-multiple" size={24} color={PRIMARY} />
          </View>
          <View style={estilos.botonContent}>
            <Text style={estilos.botonTextoSecundario}>Pagar saldo pendiente</Text>
            <Text style={estilos.botonDescripcionSec}>Salda tus deudas pendientes</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={PRIMARY} style={estilos.chevron} />
        </Pressable>

        {/* Ver todos los grupos */}
        <Pressable
          onPress={() => router.push('/VerTodosLosGrupos')}
          style={({ pressed }) => [
            estilos.botonSecundario,
            pressed && estilos.botonSecundarioPressed
          ]}
        >
          <View style={[estilos.botonIcono, estilos.botonIconoSecundario]}>
            <MaterialCommunityIcons name="view-grid-outline" size={24} color={PRIMARY} />
          </View>
          <View style={estilos.botonContent}>
            <Text style={estilos.botonTextoSecundario}>Ver todos los grupos</Text>
            <Text style={estilos.botonDescripcionSec}>Administra tus grupos</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={PRIMARY} style={estilos.chevron} />
        </Pressable>
      </View>

        {/* Ver todos los grupos */}
        <Pressable
          onPress={() => router.push('/EscanearQR')}
          style={({ pressed }) => [
            estilos.botonSecundario,
            pressed && estilos.botonSecundarioPressed
          ]}
        >
          <View style={[estilos.botonIcono, estilos.botonIconoSecundario]}>
            <MaterialCommunityIcons name="view-grid-outline" size={24} color={PRIMARY} />
          </View>
          <View style={estilos.botonContent}>
            <Text style={estilos.botonTextoSecundario}>Escanear QR de grupo</Text>
            <Text style={estilos.botonDescripcionSec}>Unete rápidamente a un grupo</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={PRIMARY} style={estilos.chevron} />
        </Pressable>

      {/* Footer decorativo */}
      <View style={estilos.footer}>
        <View style={estilos.footerLine} />
        <Text style={estilos.footerText}>Divide gastos de manera inteligente</Text>
      </View>
    </View>
  );
}

// ====== ESTILOS MEJORADOS ======
const PRIMARY = '#0EA5A4';
const SECONDARY = '#14B8A6';
const BG = '#F8FBFC';
const CARD = '#FFFFFF';
const TEXT_PRIMARY = '#1F2937';
const TEXT_SECONDARY = '#6B7280';
const BORDER = '#E5E7EB';

const estilos = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: BG,
  },
  
  // Header con gradiente
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  
  header: { 
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    paddingBottom: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  titulo: { 
    fontSize: 32, 
    fontWeight: '800', 
    color: '#fff',
    letterSpacing: -0.5,
  },
  
  subtitulo: { 
    fontSize: 14, 
    fontWeight: '500', 
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  
  logoutBtn: { 
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  
  logoutBtnPressed: { 
    backgroundColor: 'rgba(255,255,255,0.3)',
    transform: [{ scale: 0.95 }],
  },

  // Contenedor de botones
  buttonsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: -20,
  },
  
  // Botón primario con gradiente
  botonPrimario: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  
  buttonScale: {
    transform: [{ scale: 0.98 }],
  },
  
  // Botones secundarios
  botonSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  
  botonSecundarioPressed: {
    backgroundColor: '#F0FDFA',
    borderColor: PRIMARY,
    transform: [{ scale: 0.98 }],
  },
  
  // Iconos de botones
  botonIcono: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  
  botonIconoSecundario: {
    backgroundColor: '#E6FFFA',
  },
  
  // Contenido del botón
  botonContent: {
    flex: 1,
  },
  
  botonTextoPrimario: { 
    color: '#fff', 
    fontSize: 17, 
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  
  botonTextoSecundario: { 
    color: TEXT_PRIMARY, 
    fontSize: 16, 
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  
  botonDescripcion: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 2,
  },
  
  botonDescripcionSec: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    marginTop: 2,
  },
  
  chevron: {
    opacity: 0.6,
  },
  
  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 30,
    alignItems: 'center',
  },
  
  footerLine: {
    width: 40,
    height: 3,
    backgroundColor: PRIMARY,
    borderRadius: 2,
    marginBottom: 8,
    opacity: 0.3,
  },
  
  footerText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
});