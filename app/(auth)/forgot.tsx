import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { router } from 'expo-router';
import { authForgot, authReset } from '../../lib/auth';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [busy, setBusy] = useState(false);

  const styles = {
    input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, marginTop: 10 },
    button: {
      marginTop: 16, borderRadius: 10, paddingVertical: 14,
      alignItems: 'center', justifyContent: 'center', backgroundColor: 'black',
    },
  } as const;

  const send = async () => {
    if (!email) return Alert.alert('Email requerido');
    try {
      setBusy(true);
      await authForgot(email.trim().toLowerCase());
      setSent(true);
      Alert.alert('Código enviado', 'Revisa tu correo.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo enviar el código');
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!email || !code || !newPwd) return Alert.alert('Faltan datos');
    try {
      setBusy(true);
      await authReset(email.trim().toLowerCase(), code.trim(), newPwd);
      Alert.alert('Listo', 'Contraseña actualizada. Inicia sesión.');
      router.replace('/login' as const);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo actualizar la contraseña');
    } finally { setBusy(false); }
  };

  return (
    <ThemedView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 56 }}>
      <ThemedText type="title" style={{ textAlign: 'center', marginBottom: 4 }}>Reparte+</ThemedText>
      <ThemedText type="subtitle" style={{ textAlign: 'center', marginBottom: 24 }}>
        Recuperar contraseña
      </ThemedText>

      <ThemedText>Correo electrónico</ThemedText>
      <TextInput value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" placeholder="usuario@correo.cl" style={styles.input} />

      {sent && (
        <>
          <ThemedText style={{ marginTop: 10 }}>Código</ThemedText>
          <TextInput value={code} onChangeText={setCode} placeholder="123456"
            keyboardType="number-pad" style={styles.input} />
          <ThemedText style={{ marginTop: 10 }}>Nueva contraseña</ThemedText>
          <TextInput value={newPwd} onChangeText={setNewPwd} placeholder="********" secureTextEntry style={styles.input} />
        </>
      )}

      <Pressable disabled={busy} onPress={sent ? confirm : send} style={styles.button}>
        {busy ? <ActivityIndicator /> : <ThemedText type="link">{sent ? 'Confirmar nueva contraseña' : 'Enviar código'}</ThemedText>}
      </Pressable>
    </ThemedView>
  );
}
