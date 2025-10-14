import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, TextInput } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { registerSchema, type RegisterSchema } from '../../lib/validation';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { authSignUp } from '../../lib/auth';

export default function RegisterScreen() {
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const inviteToken = useMemo(() => (Array.isArray(invite) ? invite[0] : invite), [invite]);
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', phone: '' , sub_cognito: ''},
  });

  const onSubmit = async (data: RegisterSchema) => {
    if (submitting) return;
    try {
      setSubmitting(true);

      await authSignUp(data.email.trim().toLowerCase(), data.password);

      const msg = inviteToken
        ? 'Cuenta creada. Te enviamos un código para confirmar y quedas asociado al grupo.'
        : 'Cuenta creada. Te enviamos un código para confirmar tu email.';
      if (Platform.OS === 'web') window.alert(`¡Listo!\n${msg}`); else Alert.alert('¡Listo!', msg);

      const email = data.email.trim();
      const name = data.name.trim();
      const phone = data.phone.trim();
      const password= data.password.trim();

      router.replace({ pathname: '/(auth)/confirm', params: { email, name, phone, password} } as any);
    } catch (e: any) {
      if (e?.message === 'User already exists') {
        Alert.alert('El usuario ya existe. Usa otro correo para registro.');
      } else {
        Alert.alert('Error', e?.message || 'No se pudo registrar');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ======= SOLO ESTILOS: LedgerTeal =======
  const PRIMARY = '#0EA5A4'; // teal
  const BG = '#F8FBFC';      // casi blanco azulado
  const TEXT_MUTED = '#64748B';
  const BORDER = '#E2E8F0';
  const ERROR = '#EF4444';

  const styles = {
    screen: { flex: 1, paddingHorizontal: 24, paddingTop: 56, backgroundColor: BG },

    brand: { textAlign: 'center', marginBottom: 4, color: PRIMARY, fontSize: 28, fontWeight: '800' as const },
    subtitleTop: { textAlign: 'center', marginBottom: 24, color: TEXT_MUTED },

    label: { marginBottom: 8, color: TEXT_MUTED, fontWeight: '600' as const },

    input: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderColor: BORDER,
      backgroundColor: '#FFFFFF',
      height: 52,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },

    error: { color: ERROR, marginTop: 6, fontSize: 12 },

    button: {
      marginTop: 24,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: PRIMARY,
    },
    // estado presionado (highlight)
    buttonPressed: {
      backgroundColor: '#14B8A6',
      transform: [{ scale: 0.98 }],
    },
    buttonText: { color: '#FFFFFF', fontWeight: '700' as const, fontSize: 16 },
  } as const;
  // ========================================

  return (
    <ThemedView style={styles.screen}>
      <ThemedText type="title" style={styles.brand}>Reparte+</ThemedText>
      <ThemedText type="subtitle" style={styles.subtitleTop}>Crea tu cuenta</ThemedText>

      <ThemedText style={styles.label}>Nombre</ThemedText>
      <Controller control={control} name="name" render={({ field: { value, onChange, onBlur } }) => (
        <TextInput
          value={value ?? ''} onChangeText={onChange} onBlur={onBlur}
          autoCapitalize="words" placeholder="Tu nombre"
          placeholderTextColor="#9AA3AF"
          style={styles.input}
        />
      )}/>
      {errors.name?.message && <ThemedText style={styles.error}>{errors.name.message}</ThemedText>}

      <ThemedText style={[styles.label, { marginTop: 12 }]}>Correo electrónico</ThemedText>
      <Controller control={control} name="email" render={({ field }) => (
        <TextInput
          value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur}
          autoCapitalize="none" keyboardType="email-address" placeholder="usuario@correo.cl"
          placeholderTextColor="#9AA3AF"
          style={styles.input}
        />
      )}/>
      {errors.email?.message && <ThemedText style={styles.error}>{errors.email.message}</ThemedText>}

      <ThemedText style={[styles.label, { marginTop: 12 }]}>Teléfono</ThemedText>
      <Controller control={control} name="phone" render={({ field }) => (
        <TextInput
          value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur}
          keyboardType="phone-pad" placeholder="9 1234 5678"
          placeholderTextColor="#9AA3AF"
          style={styles.input}
        />
      )}/>
      {errors.phone?.message && <ThemedText style={styles.error}>{errors.phone.message}</ThemedText>}

      <ThemedText style={[styles.label, { marginTop: 12 }]}>Contraseña</ThemedText>
      <Controller control={control} name="password" render={({ field }) => (
        <TextInput
          value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur}
          secureTextEntry placeholder="******"
          placeholderTextColor="#9AA3AF"
          style={styles.input}
        />
      )}/>
      {errors.password?.message && <ThemedText style={styles.error}>{errors.password.message}</ThemedText>}

      {!!inviteToken && (
        <ThemedText style={{ marginTop: 12, color: TEXT_MUTED }}>
          Te estás uniendo con invitación: <ThemedText type="defaultSemiBold">{inviteToken}</ThemedText>
        </ThemedText>
      )}

      {/* Botón con highlight */}
      <Pressable
        disabled={submitting}
        onPress={handleSubmit(onSubmit)}
        android_ripple={{ color: '#9be7e5' }}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        {submitting
          ? <ActivityIndicator/>
          : <ThemedText type="link" style={styles.buttonText}>Registrarse</ThemedText>}
      </Pressable>

      <ThemedText style={{ textAlign: 'center', marginTop: 16, color: TEXT_MUTED }}>
        ¿Ya tienes cuenta? <Link href="/login">Inicia sesión aquí</Link>
      </ThemedText>
    </ThemedView>
  );
}
