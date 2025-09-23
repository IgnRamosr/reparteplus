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
    defaultValues: { name: '', email: '', phone: '', password: '', inviteToken },
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

      const email = data.email.trim().toLowerCase();
      router.replace({ pathname: '/(auth)/confirm', params: { email } } as any);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo registrar');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = {
    input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
    error: { color: '#d00', marginTop: 4 },
    button: {
      marginTop: 24, borderRadius: 10, paddingVertical: 14,
      alignItems: 'center', justifyContent: 'center', backgroundColor: 'black',
    },
  } as const;

  return (
    <ThemedView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 56 }}>
      <ThemedText type="title" style={{ textAlign: 'center', marginBottom: 4 }}>Reparte+</ThemedText>
      <ThemedText type="subtitle" style={{ textAlign: 'center', marginBottom: 24 }}>Crea tu cuenta</ThemedText>

      <ThemedText style={{ marginBottom: 8 }}>Nombre</ThemedText>
      <Controller control={control} name="name" render={({ field: { value, onChange, onBlur } }) => (
        <TextInput value={value ?? ''} onChangeText={onChange} onBlur={onBlur}
          autoCapitalize="words" placeholder="Tu nombre" style={styles.input} />
      )}/>
      {errors.name?.message && <ThemedText style={styles.error}>{errors.name.message}</ThemedText>}

      <ThemedText style={{ marginTop: 12, marginBottom: 8 }}>Correo electrónico</ThemedText>
      <Controller control={control} name="email" render={({ field }) => (
        <TextInput value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur}
          autoCapitalize="none" keyboardType="email-address" placeholder="usuario@correo.cl" style={styles.input}/>
      )}/>
      {errors.email?.message && <ThemedText style={styles.error}>{errors.email.message}</ThemedText>}

      <ThemedText style={{ marginTop: 12, marginBottom: 8 }}>Teléfono (opcional)</ThemedText>
      <Controller control={control} name="phone" render={({ field }) => (
        <TextInput value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur}
          keyboardType="phone-pad" placeholder="9 1234 5678" style={styles.input}/>
      )}/>
      {errors.phone?.message && <ThemedText style={styles.error}>{errors.phone.message}</ThemedText>}

      <ThemedText style={{ marginTop: 12, marginBottom: 8 }}>Contraseña</ThemedText>
      <Controller control={control} name="password" render={({ field }) => (
        <TextInput value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur}
          secureTextEntry placeholder="******" style={styles.input}/>
      )}/>
      {errors.password?.message && <ThemedText style={styles.error}>{errors.password.message}</ThemedText>}

      {!!inviteToken && (
        <ThemedText style={{ marginTop: 12, opacity: 0.7 }}>
          Te estás uniendo con invitación: <ThemedText type="defaultSemiBold">{inviteToken}</ThemedText>
        </ThemedText>
      )}

      <Pressable disabled={submitting} onPress={handleSubmit(onSubmit)} style={styles.button}>
        {submitting ? <ActivityIndicator/> : <ThemedText type="link">Registrarse</ThemedText>}
      </Pressable>

      <ThemedText style={{ textAlign: 'center', marginTop: 16 }}>
        ¿Ya tienes cuenta? <Link href="/login">Inicia sesión aquí</Link>
      </ThemedText>
    </ThemedView>
  );
}
