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
      const datosUsuario = await api.login({
        email,
        password: data.password
      })

      await guardarIdParticipante(datosUsuario.participante_id, datosUsuario.email, datosUsuario.nombre);

      // console.log(datosUsuario)

      await AsyncStorage.setItem('auth_token', 'cognito');

      goHome();
    } catch (e: any) {
      console.error('[signIn error raw]', e);

      // Traducción de errores típicos de Cognito
      const code = e?.name || e?.__type || 'Unknown';
      const msgMap: Record<string, string> = {
        UserNotConfirmedException: 'Debes confirmar tu cuenta. Revisa tu correo.',
        NotAuthorizedException: 'Correo o contraseña inválidos.',
        UserNotFoundException: 'No existe una cuenta con ese correo.',
        PasswordResetRequiredException: 'Debes restablecer tu contraseña.',
        InvalidParameterException: 'Parámetros inválidos.',
        TooManyRequestsException: 'Demasiados intentos. Intenta más tarde.',
        LimitExceededException: 'Límite excedido. Intenta más tarde.',
        // fallback
        Unknown: e?.message || 'Ocurrió un error desconocido.',
      };
      const human = msgMap[code] || (e?.message ?? 'No se pudo iniciar sesión');
      Alert.alert('Error', human);

      // Si está sin confirmar, abre confirmación con el email
      if (code === 'UserNotConfirmedException') {
        router.push({ pathname: '/(auth)/confirm', params: { email } } as any);
      }
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
