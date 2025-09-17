// app/_layout.tsx
import { Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { initDb } from '../lib/db';
import { ActivityIndicator, Text, View } from 'react-native';

function Loader({ message }: { message?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" />
      {message && (
        <Text style={{ marginTop: 12, textAlign: 'center' }}>{message}</Text>
      )}
    </View>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initDb();
        if (__DEV__) console.log('[DB] inicializada correctamente');
      } catch (e) {
        console.warn('[DB] init error', e);
        setError('Error al inicializar la base de datos');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return <Loader message={error ?? 'Inicializando base de datos...'} />;
  }

  return <Slot />;
}
