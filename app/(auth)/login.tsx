// app/(auth)/login.tsx
import React, { useState } from 'react';
import { ActivityIndicator, Alert, InteractionManager, Pressable, TextInput } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';

import { loginSchema, type LoginSchema } from '../../lib/validation';
import { mockApi, type ApiError } from '../../lib/mock';
import { verifyUserLocal } from '../../lib/db';

import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';

const goHome = () =>
  InteractionManager.runAfterInteractions(() => router.replace('/home' as const));

export default function LoginScreen() {
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginSchema) => {
    try {
      setSubmitting(true);

      const email = values.email.trim().toLowerCase();
      const password = values.password;

      // 1) Intento con API (mock)
      try {
        await mockApi.login({ email, password });
        goHome();
        return;
      } catch (e) {
        const err = e as ApiError;
        if (err?.status !== 401) throw e; // otros errores “reales”
      }

      // 2) Fallback demo: verifica credencial guardada en SQLite
      const okLocal = await verifyUserLocal(email, password);
      if (okLocal) {
        goHome();
        return;
      }

      Alert.alert('Credenciales inválidas', 'Revisa tu correo o contraseña.');
    } catch (e) {
      const err = e as ApiError;
      Alert.alert('Error', err?.message || 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 56 }}>
      <ThemedText type="title" style={{ textAlign: 'center', marginBottom: 4 }}>
        Reparte+
      </ThemedText>
      <ThemedText type="subtitle" style={{ textAlign: 'center', marginBottom: 24 }}>
        Iniciar Sesión
      </ThemedText>

      <ThemedText style={{ marginBottom: 8 }}>Correo electrónico</ThemedText>
      <Controller
        control={control}
        name="email"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="usuario@correo.cl"
            style={styles.input}
          />
        )}
      />
      {errors.email?.message && (
        <ThemedText style={styles.error}>{errors.email.message}</ThemedText>
      )}

      <ThemedText style={{ marginTop: 12, marginBottom: 8 }}>Contraseña</ThemedText>
      <Controller
        control={control}
        name="password"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="******"
            secureTextEntry
            style={styles.input}
          />
        )}
      />
      {errors.password?.message && (
        <ThemedText style={styles.error}>{errors.password.message}</ThemedText>
      )}

      <Pressable disabled={submitting} onPress={handleSubmit(onSubmit)} style={styles.button}>
        {submitting ? (
          <ActivityIndicator />
        ) : (
          <ThemedText type="link" style={{ textAlign: 'center' }}>
            Ingresar
          </ThemedText>
        )}
      </Pressable>

      <Pressable
        disabled={submitting}
        onPress={() => router.push('/register' as const)}
        style={[styles.button, { backgroundColor: '#111', marginTop: 8 }]}
      >
        <ThemedText type="link" style={{ textAlign: 'center' }}>
          Crea tu cuenta aquí
        </ThemedText>
      </Pressable>

      <ThemedText style={{ textAlign: 'center', marginTop: 14, opacity: 0.6 }}>
        ¿Olvidaste tu contraseña?
      </ThemedText>
      <ThemedText
        type="link"
        onPress={() => router.push('/forgot' as const)}
        style={{ textAlign: 'center', color:'black' }}
      >
        Recuperarla
      </ThemedText>
    </ThemedView>
  );
}

const styles = {
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
  error: { color: '#d00', marginTop: 4 },
  button: {
    marginTop: 20,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'black',
  },
} as const;
