// app/index.tsx

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { InteractionManager } from 'react-native';

export default function Index() {
  useEffect(() => {
    let cancelled = false;

    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (cancelled) return; // evita redirección tras desmontar
        if (token) {
          router.replace('/home' as const);
        } else {
          router.replace('/login' as const);
        }
      } catch (e) {
        console.warn('[Index] Error leyendo token:', e);
        if (!cancelled) router.replace('/login' as const);
      }
    });

    return () => {
      cancelled = true;
      (task as any)?.cancel?.();
    };
  }, []);

  return null;
}
