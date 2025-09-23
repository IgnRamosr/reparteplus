// app/invite/+not-found.tsx
import { Link } from 'expo-router';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';


export default function NotFound() {
  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <ThemedText type="title">404</ThemedText>
      <ThemedText>Pantalla no encontrada</ThemedText>
      <Link href="/login">Volver al inicio</Link>
    </ThemedView>
  );
}
