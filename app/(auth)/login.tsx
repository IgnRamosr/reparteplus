import React, { useState } from 'react';
import { ActivityIndicator, Alert, InteractionManager, Pressable, TextInput } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { loginSchema, type LoginSchema } from '../../lib/validation';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { authSignIn } from '../../lib/auth';
import { api } from '@/lib/api';
import { guardarIdParticipante } from '@/lib/funcionesParticipante';

const goHome = () =>
  InteractionManager.runAfterInteractions(() => router.replace('/MenuPrincipal' as const));

export default function LoginScreen() {
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginSchema) => {
    if (submitting) return;
    const email = data.email.trim().toLowerCase();

    try {
      setSubmitting(true);
      console.log('[signIn attempt]', email);

      await authSignIn(email, data.password);
      const datosUsuario = await api.login({ email, password: data.password });

      await guardarIdParticipante(datosUsuario.participante_id, datosUsuario.email, datosUsuario.nombre);
      await AsyncStorage.setItem('auth_token', 'cognito');
      goHome();
    } catch (e: any) {
      console.error('[signIn error raw]', e);
      const code = e?.name || e?.__type || 'Unknown';
      const msgMap: Record<string, string> = {
        UserNotConfirmedException: 'Debes confirmar tu cuenta. Revisa tu correo.',
        NotAuthorizedException: 'Correo o contraseña inválidos.',
        UserNotFoundException: 'No existe una cuenta con ese correo.',
        PasswordResetRequiredException: 'Debes restablecer tu contraseña.',
        InvalidParameterException: 'Parámetros inválidos.',
        TooManyRequestsException: 'Demasiados intentos. Intenta más tarde.',
        LimitExceededException: 'Límite excedido. Intenta más tarde.',
        Unknown: e?.message || 'Ocurrió un error desconocido.',
      };
      const human = msgMap[code] || (e?.message ?? 'No se pudo iniciar sesión');
      Alert.alert('Error', human);
      if (code === 'UserNotConfirmedException') {
        router.push({ pathname: '/(auth)/confirm', params: { email } } as any);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ----------- STYLES LedgerTeal -----------
  const PRIMARY = '#0EA5A4'; // teal
  const ACCENT = '#F59E0B';  // ámbar
  const BG = '#F8FBFC';      // azul claro casi blanco
  const TEXT_MUTED = '#64748B';
  const BORDER = '#E2E8F0';
  const ERROR = '#EF4444';

  const styles = {
    screen: { flex: 1, paddingHorizontal: 24, paddingTop: 56, backgroundColor: BG },

    brand: { textAlign: 'center', marginBottom: 4, color: PRIMARY, fontSize: 28, fontWeight: '800' as const },
    subtitleTop: { textAlign: 'center', marginBottom: 24, color: TEXT_MUTED },

    label: { marginBottom: 8, color: TEXT_MUTED, fontWeight: '600' as const },

    input: {
      borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
      borderColor: BORDER, backgroundColor: '#FFFFFF', height: 52,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 }, elevation: 1,
    },

    error: { color: ERROR, marginTop: 6, fontSize: 12 },

    button: {
      marginTop: 20, borderRadius: 14, paddingVertical: 14,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: PRIMARY,
    },
    buttonPressed: {
      backgroundColor: '#14B8A6', // highlight
      transform: [{ scale: 0.98 }],
    },
    buttonText: { color: '#FFFFFF', fontWeight: '700' as const, fontSize: 16 },

    secondary: {
      marginTop: 10, borderRadius: 14, paddingVertical: 14,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER,
    },
    secondaryPressed: {
      backgroundColor: '#F0FBFA',
      transform: [{ scale: 0.98 }],
    },
    secondaryText: { color: PRIMARY, fontWeight: '700' as const },

    forgotHint: { textAlign: 'center', marginTop: 14, color: TEXT_MUTED },
    forgotLink: { textAlign: 'center', color: PRIMARY, fontWeight: '700' as const },
  } as const;
  // -------------------------------------------------------------------------

  return (
    <ThemedView style={styles.screen}>
      <ThemedText type="title" style={styles.brand}>Reparte+</ThemedText>
      <ThemedText type="subtitle" style={styles.subtitleTop}>Iniciar Sesión</ThemedText>

      <ThemedText style={styles.label}>Correo electrónico</ThemedText>
      <Controller control={control} name="email" render={({ field }) => (
        <TextInput
          value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur}
          autoCapitalize="none" keyboardType="email-address" placeholder="usuario@correo.cl"
          placeholderTextColor="#9AA3AF"
          style={styles.input} editable={!submitting} returnKeyType="next"
        />
      )}/>
      {errors.email?.message && <ThemedText style={styles.error}>{errors.email.message}</ThemedText>}

      <ThemedText style={[styles.label, { marginTop: 12 }]}>Contraseña</ThemedText>
      <Controller control={control} name="password" render={({ field }) => (
        <TextInput
          value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur}
          placeholder="********" placeholderTextColor="#9AA3AF"
          secureTextEntry style={styles.input}
          editable={!submitting} returnKeyType="go" onSubmitEditing={handleSubmit(onSubmit)}
        />
      )}/>
      {errors.password?.message && <ThemedText style={styles.error}>{errors.password.message}</ThemedText>}

      {/* Botón primario con highlight */}
      <Pressable
        disabled={submitting}
        onPress={handleSubmit(onSubmit)}
        android_ripple={{ color: '#9be7e5' }}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        {submitting
          ? <ActivityIndicator/>
          : <ThemedText style={styles.buttonText}>Ingresar</ThemedText>}
      </Pressable>

      {/* Botón secundario con highlight */}
      <Pressable
        disabled={submitting}
        onPress={() => router.push('/register' as const)}
        android_ripple={{ color: '#E6FFFB' }}
        style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
      >
        <ThemedText style={styles.secondaryText}>Crea tu cuenta aquí</ThemedText>
      </Pressable>

      <ThemedText style={styles.forgotHint}>¿Olvidaste tu contraseña?</ThemedText>
      <ThemedText type="link" onPress={() => router.push('/forgot' as const)} style={styles.forgotLink}>
        Recuperarla
      </ThemedText>
    </ThemedView>
  );
}
