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

  // ======= SOLO ESTILOS: LedgerTeal =======
  const PRIMARY = '#0EA5A4'; // teal
  const BG = '#F8FBFC';      // casi blanco azulado
  const TEXT_MUTED = '#64748B';
  const BORDER = '#E2E8F0';

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
      marginTop: 10,
    },

    button: {
      marginTop: 16,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: PRIMARY,
    },
    // highlight al presionar
    buttonPressed: {
      backgroundColor: '#14B8A6',
      transform: [{ scale: 0.98 }],
    },
    buttonText: { color: '#FFFFFF', fontWeight: '700' as const, fontSize: 16 },
  } as const;
  // ========================================

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
    <ThemedView style={styles.screen}>
      <ThemedText type="title" style={styles.brand}>Reparte+</ThemedText>
      <ThemedText type="subtitle" style={styles.subtitleTop}>
        Recuperar contraseña
      </ThemedText>

      <ThemedText style={styles.label}>Correo electrónico</ThemedText>
      <TextInput
        value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address"
        placeholder="usuario@correo.cl" placeholderTextColor="#9AA3AF"
        style={styles.input}
      />

      {sent && (
        <>
          <ThemedText style={[styles.label, { marginTop: 10 }]}>Código</ThemedText>
          <TextInput
            value={code} onChangeText={setCode}
            placeholder="123456" placeholderTextColor="#9AA3AF"
            keyboardType="number-pad" style={styles.input}
          />
          <ThemedText style={[styles.label, { marginTop: 10 }]}>Nueva contraseña</ThemedText>
          <TextInput
            value={newPwd} onChangeText={setNewPwd}
            placeholder="********" placeholderTextColor="#9AA3AF"
            secureTextEntry style={styles.input}
          />
        </>
      )}

      {/* Botón con highlight */}
      <Pressable
        disabled={busy}
        onPress={sent ? confirm : send}
        android_ripple={{ color: '#9be7e5' }}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy ? { opacity: 0.7 } : null]}
      >
        {busy
          ? <ActivityIndicator />
          : <ThemedText type="link" style={styles.buttonText}>
              {sent ? 'Confirmar nueva contraseña' : 'Enviar código'}
            </ThemedText>}
      </Pressable>
    </ThemedView>
  );
}
