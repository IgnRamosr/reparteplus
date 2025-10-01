// app/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Image, StatusBar, StyleSheet, Text, View } from 'react-native';

const TEAL = '#e4ececff';

export default function Index() {
  const navigated = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (navigated.current) return;

        // 👇 Espera 2000ms antes de navegar (2 segundos)
        setTimeout(() => {
          if (!navigated.current) {
            navigated.current = true;
            router.replace(token ? '/MenuPrincipal' : '/login');
          }
        }, 2000);
      } catch {
        if (!navigated.current) {
          navigated.current = true;
          router.replace('/login');
        }
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={TEAL} />
      <View style={styles.hero}>
        <Image source={require('assets/images/logo.png')} style={styles.image} resizeMode="contain" />
        <Text style={styles.tagline}>¡Porque compartir es más fácil que nunca!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },
  hero: { width: '78%', alignItems: 'center', gap: 12 },
  image: { width: '100%', height: 200 },
  tagline: { textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#0c0a0aff' },
});
