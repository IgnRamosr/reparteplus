// app/(auth)/login.tsx
import React, { useState } from 'react';
import { ActivityIndicator, Alert, InteractionManager, Pressable, TextInput } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { loginSchema, type LoginSchema } from '../../lib/validation';
import { api, type ApiError } from '../../lib/api';
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

  const onSubmit = async (data: LoginSchema) => {
    if (submitting) return;
    try {
      setSubmitting(true);

      const res = await api.login({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });

      // 👇 Para depurar qué está devolviendo tu backend
      console.log('[LOGIN RES]', res);

      // Si NO viene token, igual guardamos un marcador local para que el app te deje pasar.
      const token =
        typeof res?.token === 'string' && res.token.trim().length > 0
          ? res.token.trim()
          : 'local-session'; // marcador local

      await AsyncStorage.setItem('auth_token', token);
      goHome();
    } catch (e) {
      const err = e as ApiError;
      Alert.alert('Error', err?.message || 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = {
    input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
    error: { color: '#d00', marginTop: 4 },
    button: {
      marginTop: 20, borderRadius: 10, paddingVertical: 14,
      alignItems: 'center', justifyContent: 'center', backgroundColor: 'black',
      opacity: submitting ? 0.7 : 1,
    },
    secondary: {
      marginTop: 8, borderRadius: 10, paddingVertical: 14,
      alignItems: 'center', justifyContent: 'center', backgroundColor: '#111',
      opacity: submitting ? 0.7 : 1,
    },
  } as const;

  return (
    <ThemedView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 56 }}>
      <ThemedText type="title" style={{ textAlign: 'center', marginBottom: 4 }}>Reparte+</ThemedText>
      <ThemedText type="subtitle" style={{ textAlign: 'center', marginBottom: 24 }}>Iniciar Sesión</ThemedText>

      <ThemedText style={{ marginBottom: 8 }}>Correo electrónico</ThemedText>
      <Controller control={control} name="email" render={({ field }) => (
        <TextInput
          value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur}
          autoCapitalize="none" keyboardType="email-address" placeholder="usuario@correo.cl"
          style={styles.input} editable={!submitting} returnKeyType="next"
        />
      )}/>
      {errors.email?.message && <ThemedText style={styles.error}>{errors.email.message}</ThemedText>}

      <ThemedText style={{ marginTop: 12, marginBottom: 8 }}>Contraseña</ThemedText>
      <Controller control={control} name="password" render={({ field }) => (
        <TextInput
          value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur}
          placeholder="********" secureTextEntry style={styles.input}
          editable={!submitting} returnKeyType="go" onSubmitEditing={handleSubmit(onSubmit)}
        />
      )}/>
      {errors.password?.message && <ThemedText style={styles.error}>{errors.password.message}</ThemedText>}

      <Pressable disabled={submitting} onPress={handleSubmit(onSubmit)} style={styles.button}>
        {submitting ? <ActivityIndicator/> : <ThemedText type="link">Ingresar</ThemedText>}
      </Pressable>

      <Pressable disabled={submitting} onPress={() => router.push('/register' as const)} style={styles.secondary}>
        <ThemedText type="link">Crea tu cuenta aquí</ThemedText>
      </Pressable>

      <ThemedText style={{ textAlign: 'center', marginTop: 14, opacity: 0.6 }}>
        ¿Olvidaste tu contraseña?
      </ThemedText>
      <ThemedText type="link" onPress={() => router.push('/forgot' as const)}
        style={{ textAlign: 'center', color: 'black' }}>
        Recuperarla
      </ThemedText>
    </ThemedView>
  );
}
