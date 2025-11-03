// app/MenuPrincipal.tsx
import React, { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, Dimensions, Platform, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { authSignOut } from '../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { borrarIDparticipante } from '@/lib/funcionesParticipante';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    <SafeAreaView style={estilos.container} edges={['top']}>
      <ScrollView
        style={estilos.scrollView}
        contentContainerStyle={estilos.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Header con gradiente ultra premium */}
        <LinearGradient
          colors={['#0EA5A4', '#14B8A6', '#10B981']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={estilos.headerGradient}
        >
          <View style={estilos.headerContent}>
            {/* Top bar */}
            <View style={estilos.headerTop}>
              <View style={estilos.logoContainer}>
                <View style={estilos.logoCircle}>
                  <MaterialCommunityIcons name="share-variant" size={30} color="#fff" />
                </View>
                <View style={estilos.brandInfo}>
                  <Text style={estilos.titulo}>Reparte+</Text>
                  <Text style={estilos.subtitulo}>Gestiona tus gastos grupales</Text>
                </View>
              </View>

              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [
                  estilos.logoutBtn,
                  pressed && estilos.logoutBtnPressed
                ]}
                hitSlop={12}
              >
                <MaterialCommunityIcons name="logout" size={22} color="#fff" />
              </Pressable>
            </View>

            {/* Decorative wave pattern */}
            <View style={estilos.wavePattern}>
              <View style={estilos.waveDot} />
              <View style={[estilos.waveDot, { opacity: 0.7 }]} />
              <View style={[estilos.waveDot, { opacity: 0.4 }]} />
            </View>
          </View>
        </LinearGradient>

        {/* Main content con mejor espaciado */}
        <View style={estilos.mainContent}>
          {/* Botón principal destacado con diseño hero */}
          <View style={estilos.heroSection}>
            <Pressable
              onPress={() => router.push('/CreacionGrupos')}
              style={({ pressed }) => [
                estilos.heroPressable,
                pressed && estilos.heroPressed
              ]}
            >
              <LinearGradient
                colors={['#0EA5A4', '#14B8A6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={estilos.heroButton}
              >
                <View style={estilos.heroIconContainer}>
                  <View style={estilos.heroIconCircle}>
                    <MaterialCommunityIcons name="account-group-outline" size={28} color="#fff" />
                  </View>
                </View>
                <View style={estilos.heroTextContainer}>
                  <Text style={estilos.heroTitle}>Crear grupo</Text>
                  <Text style={estilos.heroDescription}>Inicia un nuevo grupo de gastos</Text>
                </View>
                <View style={estilos.heroArrow}>
                  <MaterialCommunityIcons name="arrow-right" size={24} color="#fff" />
                </View>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Botones secundarios refinados */}
          <View style={estilos.actionsSection}>
            {/* Pagar saldo pendiente */}
            <Pressable
              onPress={() => router.replace('/PagarSaldoPendiente')}
              style={({ pressed }) => [
                estilos.actionCard,
                pressed && estilos.actionCardPressed
              ]}
            >
              <View style={estilos.actionCardContent}>
                <View style={estilos.actionIconWrapper}>
                  <MaterialCommunityIcons name="cash-multiple" size={26} color={PRIMARY} />
                </View>
                <View style={estilos.actionTextWrapper}>
                  <Text style={estilos.actionTitle}>Pagar saldo pendiente</Text>
                  <Text style={estilos.actionDescription}>Registra deudas pendientes</Text>
                </View>
                <View style={estilos.actionChevron}>
                  <MaterialCommunityIcons name="chevron-right" size={22} color="#CBD5E1" />
                </View>
              </View>
            </Pressable>

            {/* Ver todos los grupos */}
            <Pressable
              onPress={() => router.replace('/VerTodosLosGrupos')}
              style={({ pressed }) => [
                estilos.actionCard,
                pressed && estilos.actionCardPressed
              ]}
            >
              <View style={estilos.actionCardContent}>
                <View style={estilos.actionIconWrapper}>
                  <MaterialCommunityIcons name="view-grid-outline" size={26} color={PRIMARY} />
                </View>
                <View style={estilos.actionTextWrapper}>
                  <Text style={estilos.actionTitle}>Ver todos los grupos</Text>
                  <Text style={estilos.actionDescription}>Administra tus grupos</Text>
                </View>
                <View style={estilos.actionChevron}>
                  <MaterialCommunityIcons name="chevron-right" size={22} color="#CBD5E1" />
                </View>
              </View>
            </Pressable>

            {/* Escanear QR */}
            <Pressable
              onPress={() => router.replace('/EscanearQR')}
              style={({ pressed }) => [
                estilos.actionCard,
                pressed && estilos.actionCardPressed
              ]}
            >
              <View style={estilos.actionCardContent}>
                <View style={estilos.actionIconWrapper}>
                  <MaterialCommunityIcons name="qrcode-scan" size={26} color={PRIMARY} />
                </View>
                <View style={estilos.actionTextWrapper}>
                  <Text style={estilos.actionTitle}>Escanear QR de grupo</Text>
                  <Text style={estilos.actionDescription}>Únete rápidamente a un grupo</Text>
                </View>
                <View style={estilos.actionChevron}>
                  <MaterialCommunityIcons name="chevron-right" size={22} color="#CBD5E1" />
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Footer elegante y minimalista */}
        <View style={estilos.footer}>
          <View style={estilos.footerDivider} />
          <Text style={estilos.footerText}>Divide gastos de manera inteligente</Text>
          <View style={estilos.footerDecoration}>
            <View style={estilos.footerDot} />
            <View style={[estilos.footerDot, { opacity: 0.5 }]} />
            <View style={[estilos.footerDot, { opacity: 0.25 }]} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ====== ESTILOS ULTRA REFINADOS ======
const PRIMARY = '#0EA5A4';
const SECONDARY = '#14B8A6';
const BG = '#F8FAFC';
const CARD = '#FFFFFF';
const TEXT_PRIMARY = '#1F2937';
const TEXT_SECONDARY = '#6B7280';
const BORDER = '#E5E7EB';

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  // ===== HEADER ULTRA PREMIUM =====
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 48,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    ...Platform.select({
      ios: {
        shadowColor: PRIMARY,
        shadowOpacity: 0.35,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
      },
      android: {
        elevation: 16,
      },
    }),
  },
  headerContent: {
    paddingHorizontal: 22,
    gap: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 6,
      },
    }),
  },
  brandInfo: {
    gap: 3,
  },
  titulo: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.8,
  },
  subtitulo: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.1,
  },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoutBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    transform: [{ scale: 0.92 }],
  },

  // Wave pattern decorativo
  wavePattern: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  waveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },

  // ===== MAIN CONTENT =====
  mainContent: {
    paddingHorizontal: 20,
    marginTop: -28,
    gap: 20,
  },

  // ===== HERO BUTTON (Crear grupo) =====
  heroSection: {
    marginBottom: 8,
  },
  heroPressable: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  heroPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 22,
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: PRIMARY,
        shadowOpacity: 0.4,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
      },
      android: {
        elevation: 12,
      },
    }),
  },
  heroIconContainer: {
    marginRight: 4,
  },
  heroIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroTextContainer: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  heroDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 19,
  },
  heroArrow: {
    opacity: 0.9,
  },

  // ===== ACTION CARDS (Botones secundarios) =====
  actionsSection: {
    gap: 12,
  },
  actionCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: BORDER,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 3,
      },
    }),
  },
  actionCardPressed: {
    backgroundColor: '#F0FDFA',
    borderColor: PRIMARY,
    transform: [{ scale: 0.98 }],
    ...Platform.select({
      ios: {
        shadowOpacity: 0.08,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  actionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  actionIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrapper: {
    flex: 1,
    gap: 3,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.2,
  },
  actionDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  actionChevron: {
    opacity: 0.5,
  },

  // ===== FOOTER ELEGANTE =====
  footer: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 10,
    alignItems: 'center',
    gap: 12,
  },
  footerDivider: {
    width: 50,
    height: 3,
    backgroundColor: PRIMARY,
    borderRadius: 2,
    opacity: 0.25,
  },
  footerText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  footerDecoration: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  footerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: PRIMARY,
  },
});