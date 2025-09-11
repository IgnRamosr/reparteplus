import React, { useMemo, useState } from 'react';
import { ActivityIndicator, InteractionManager, Alert, Platform, Pressable, TextInput } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { registerSchema, type RegisterSchema } from '../../lib/validation';
import { mockApi as api, type ApiError } from '../../lib/mock';
import { saveUser, userExists } from '../../lib/db';

import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';

/** Navega a /login cuando el router ya está listo (evita errores del Root Layout) */
const goLogin = () =>
  InteractionManager.runAfterInteractions(() => router.replace('/login' as const));

/** Muestra mensaje de éxito y luego va a /login */
function showSuccessAndGo(message: string) {
  if (Platform.OS === 'web') {
    window.alert(`¡Listo!\n${message}`);
    goLogin();
  } else {
    Alert.alert('¡Listo!', message, [{ text: 'OK', onPress: goLogin }]);
  }
}

export default function RegisterScreen() {
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const [submitting, setSubmitting] = useState(false);
  const inviteToken = useMemo(() => (Array.isArray(invite) ? invite[0] : invite), [invite]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', phone: '', password: '', inviteToken },
  });

  const onSubmit = async (values: RegisterSchema) => {
    console.log('[SUBMIT] values', values); // 1
    try {
      setSubmitting(true);

      const email = values.email.trim();
      const phone = values.phone?.trim() || null;

      console.log('[SUBMIT] checking userExists', email); // 2
      if (await userExists(email)) {
        console.log('[SUBMIT] exists -> show alert (no navigate)'); // 3
        Alert.alert('El correo ya está registrado', 'Intenta iniciar sesión o usa otro correo.');
        return; // no navegamos ni limpiamos; los inputs quedan iguales
      }

      console.log('[SUBMIT] calling api.register'); // 4
      await api.register({
        email,
        phone: phone || undefined,
        password: values.password,
        inviteToken: inviteToken || undefined,
      });

      console.log('[SUBMIT] saving local sqlite'); // 5
      await saveUser({
        email,
        phone,
        password: values.password, // ⚠️ SOLO para demo
        inviteToken: inviteToken ?? null,
      });

      console.log('[SUBMIT] success -> go login'); // 6
      if (inviteToken) {
        showSuccessAndGo('Cuenta creada y asociada al grupo.');
      } else {
        showSuccessAndGo('Cuenta creada. Ahora puedes iniciar sesión.');
      }
    } catch (e) {
      console.log('[SUBMIT] error', e); // 7
      const err = e as ApiError;
      Alert.alert('Error', err?.message || 'No se pudo registrar');
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
        Crea tu cuenta
      </ThemedText>

      <ThemedText style={{ marginBottom: 8 }}>Correo electrónico</ThemedText>
      <Controller
        control={control}
        name="email"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            value={value ?? ''}              // ← nunca undefined/null
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="usuario@correo.cl"
            style={styles.input}
          />
        )}
      />
      {errors.email?.message && <ThemedText style={styles.error}>{errors.email.message}</ThemedText>}

      <ThemedText style={{ marginTop: 12, marginBottom: 8 }}>Teléfono</ThemedText>
      <Controller
        control={control}
        name="phone"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            value={value ?? ''}              // ← nunca undefined/null
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="phone-pad"
            placeholder="9 1234 5678"
            style={styles.input}
          />
        )}
      />
      {errors.phone?.message && <ThemedText style={styles.error}>{errors.phone.message}</ThemedText>}

      <ThemedText style={{ marginTop: 12, marginBottom: 8 }}>Contraseña</ThemedText>
      <Controller
        control={control}
        name="password"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            value={value ?? ''}              // ← fuerza string también aquí
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            placeholder="******"
            style={styles.input}
          />
        )}
      />
      {errors.password?.message && <ThemedText style={styles.error}>{errors.password.message}</ThemedText>}

      {!!inviteToken && (
        <ThemedText style={{ marginTop: 12, opacity: 0.7 }}>
          Te estás uniendo con invitación:{' '}
          <ThemedText type="defaultSemiBold">{inviteToken}</ThemedText>
        </ThemedText>
      )}

      <Pressable disabled={submitting} onPress={handleSubmit(onSubmit)} style={styles.button}>
        {submitting ? (
          <ActivityIndicator />
        ) : (
          <ThemedText type="link" style={{ textAlign: 'center' }}>
            Registrarse
          </ThemedText>
        )}
      </Pressable>

      <ThemedText style={{ textAlign: 'center', marginTop: 16 }}>
        ¿Ya tienes cuenta? <Link href="/login">Inicia sesión aquí</Link>
      </ThemedText>
    </ThemedView>
  );
}

const styles = {
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  error: { color: '#d00', marginTop: 4 },
  button: {
    marginTop: 24,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'black',
  },
} as const;
