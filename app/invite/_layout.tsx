// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // ocultamos header por defecto; ajusta por pantalla si quieres
      }}
    >
      {/* para personalizar headers por ruta, descomentar y ajustar:
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="grupos/index" options={{ headerShown: false }} />
      */}
    </Stack>
  );
}
