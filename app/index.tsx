// app/index.tsx
import { useEffect } from 'react';
import { router } from 'expo-router';
import { InteractionManager } from 'react-native';

// 👇 ejemplo simple: cambiar cuando tengas un estado de sesión real
const isLoggedIn = false;

export default function Index() {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      if (isLoggedIn) {
        router.replace('/home' as const);   // si hay sesión activa
      } else {
        router.replace('/(auth)/login' as const); // si no hay sesión
      }
    });
    return () => (task as any)?.cancel?.();
  }, []);

  return null;
}
