// app/home.tsx
import React, { useEffect } from 'react';
import { Pressable, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';

export default function HomeScreen() {
  // (Opcional) Pequeño guard: si no hay token, manda a /login
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (!cancelled && !token) router.replace('/login' as const);
      } catch {
        if (!cancelled) router.replace('/login' as const);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('auth_token');
      router.replace('/login' as const);
    } catch (e) {
      Alert.alert('Error', 'No se pudo cerrar sesión. Intenta nuevamente.');
    }
  };

  return (
    <ThemedView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 56, gap: 16 }}>
      <ThemedText type="title" style={{ textAlign: 'center' }}>
        Reparte+
      </ThemedText>
      <ThemedText type="subtitle" style={{ textAlign: 'center', marginBottom: 12 }}>
        Mis grupos (demo)
      </ThemedText>

      <ThemedText>Has iniciado sesión correctamente.</ThemedText>

      <Pressable
        onPress={() => router.push('/users' as const)} // lista SQLite (dev)
        style={{
          marginTop: 16,
          borderRadius: 10,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#111',
        }}
      >
        <ThemedText type="link">Ver usuarios (demo)</ThemedText>
      </Pressable>

      <Pressable
        onPress={logout}
        style={{
          marginTop: 8,
          borderRadius: 10,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'black',
        }}
      >
        <ThemedText type="link">Cerrar sesión</ThemedText>
      </Pressable>
    </ThemedView>
  );
}
