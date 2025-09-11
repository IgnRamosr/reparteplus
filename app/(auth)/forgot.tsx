// app/(auth)/forgot.tsx
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';

import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { forgotPwdSchema, type ForgotPwdSchema } from '../../lib/validation';
import { mockApi } from '../../lib/mock';

export default function ForgotPasswordScreen() {
const [submitting, setSubmitting] = useState(false);

const { control, handleSubmit, formState: { errors } } = useForm<ForgotPwdSchema>({
    resolver: zodResolver(forgotPwdSchema),
    defaultValues: { email: '' },
});

const onSubmit = async ({ email }: ForgotPwdSchema) => {
    try {
    setSubmitting(true);
    await mockApi.requestPasswordReset(email.trim().toLowerCase());
    Alert.alert(
        'Revisa tu correo',
        'Si el correo existe, te enviaremos las instrucciones para restablecer tu contraseña.'
    );
      // Vuelve al login (sin repetir el grupo en la ruta)
    router.replace('/login' as const);
    } catch {
    Alert.alert('Error', 'No se pudo procesar tu solicitud.');
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
        Recuperar contraseña
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
            style={{ borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 }}
        />
        )}
    />
    {errors.email?.message && (
        <ThemedText style={{ color: '#d00', marginTop: 4 }}>{errors.email.message}</ThemedText>
    )}

    <Pressable
        disabled={submitting}
        onPress={handleSubmit(onSubmit)}
        style={{
        marginTop: 24,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'black',
        }}
    >
        {submitting ? (
        <ActivityIndicator />
        ) : (
        <ThemedText type="link" style={{ textAlign: 'center' }}>
            Enviar instrucciones
        </ThemedText>
        )}
    </Pressable>
    </ThemedView>
);
}
