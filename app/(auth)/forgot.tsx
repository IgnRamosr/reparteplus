import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';

import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { forgotPwdSchema, type ForgotPwdSchema } from '../../lib/validation';
import { api, type ApiError } from '../../lib/api';

export default function ForgotPasswordScreen() {
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<ForgotPwdSchema>({
    resolver: zodResolver(forgotPwdSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPwdSchema) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      const res = await api.forgot({ email: data.email.trim().toLowerCase() });
      Alert.alert('Revisa tu correo', res.message || 'Si el correo existe, te enviaremos instrucciones.');
      router.replace('/login' as const);
    } catch (e) {
      const err = e as ApiError;
      Alert.alert('Error', err?.message || 'No se pudo procesar tu solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 56 }}>
      <ThemedText type="title" style={{ textAlign: 'center', marginBottom: 4 }}>Reparte+</ThemedText>
      <ThemedText type="subtitle" style={{ textAlign: 'center', marginBottom: 24 }}>
        Recuperar contraseña
      </ThemedText>

      <ThemedText style={{ marginBottom: 8 }}>Correo electrónico</ThemedText>
      <Controller control={control} name="email" render={({ field }) => (
        <TextInput value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur}
          autoCapitalize="none" keyboardType="email-address" placeholder="usuario@correo.cl"
          style={{ borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 }}
          editable={!submitting} returnKeyType="send" onSubmitEditing={handleSubmit(onSubmit)} />
      )}/>
      {errors.email?.message && <ThemedText style={{ color: '#d00', marginTop: 4 }}>{errors.email.message}</ThemedText>}

      <Pressable disabled={submitting} onPress={handleSubmit(onSubmit)}
        style={{ marginTop: 24, borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'black', opacity: submitting ? 0.7 : 1 }}>
        {submitting ? <ActivityIndicator/> : <ThemedText type="link">Enviar instrucciones</ThemedText>}
      </Pressable>
    </ThemedView>
  );
}
