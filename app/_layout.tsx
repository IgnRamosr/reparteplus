// app/_layout.tsx
import { Slot } from 'expo-router';
import { useEffect } from 'react';
import { initDb } from '../lib/db';

export default function RootLayout() {
  useEffect(() => {
    initDb().catch((e) => console.warn('[DB] init error', e));
  }, []);
  return <Slot />;
}
