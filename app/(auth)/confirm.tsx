import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ThemedText } from "../../components/ThemedText";
import { ThemedView } from "../../components/ThemedView";

import {
  authConfirm,
  authResend,
  getCognitoSub,
  authSignIn,   // 👈 añadido
  // authSignOut,
} from "../../lib/auth";
import { api } from "../../lib/api";
import { guardarIdParticipante } from "@/lib/funcionesParticipante";

export default function ConfirmScreen() {
  const {
    email: initialEmail,
    name: initialName,
    phone: initialPhone,
    password: initialPassword,
  } = useLocalSearchParams<{
    email?: string; name?: string; phone?: string; password?: string;
  }>();

  const [email, setEmail] = useState((initialEmail ?? "").toString());
  const [name, setName]   = useState((initialName ?? "").toString());
  const [phone, setPhone] = useState((initialPhone ?? "").toString());
  const [password]        = useState((initialPassword ?? "").toString());
  const [code, setCode]   = useState("");
  const [busy, setBusy]   = useState(false);

  // ========= SOLO ESTILOS: LedgerTeal =========
  const PRIMARY = '#0EA5A4'; // teal
  const BG = '#F8FBFC';      // casi blanco azulado
  const TEXT_MUTED = '#64748B';
  const BORDER = '#E2E8F0';

  const styles = {
    screen: { flex: 1, paddingHorizontal: 24, paddingTop: 56, backgroundColor: BG },

    brand: { textAlign: "center", marginBottom: 4, color: PRIMARY, fontSize: 28, fontWeight: '800' as const },
    subtitleTop: { textAlign: "center", marginBottom: 24, color: TEXT_MUTED },

    label: { marginTop: 10, marginBottom: 6, color: TEXT_MUTED, fontWeight: '600' as const },

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
      marginTop: 4,
    },

    button: {
      marginTop: 16,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: PRIMARY,
    },
    // 👇 highlight al presionar
    buttonPressed: {
      backgroundColor: '#14B8A6',
      transform: [{ scale: 0.98 }],
    },
    buttonText: { color: '#FFFFFF', fontWeight: '700' as const, fontSize: 16 },

    secondary: {
      marginTop: 8,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: BORDER,
    },
    secondaryPressed: {
      backgroundColor: '#F0FBFA',
      transform: [{ scale: 0.98 }],
    },
    secondaryText: { color: PRIMARY, fontWeight: '700' as const },
  } as const;
  // ===========================================

  const doConfirm = async () => {
    if (!email || !code) return Alert.alert("Faltan datos", "Ingresa email y código");

    try {
      setBusy(true);

      const emailNorm = email.trim();

      // 1) Confirmar en Cognito
      await authConfirm(emailNorm, code.trim());

      // 2) Si tenemos la password, iniciamos sesión para obtener el sub
      if (password) {
        await authSignIn(emailNorm, password)


        // 3) Obtener sub y registrar en tu API
        const sub = await getCognitoSub();
        if (!sub) throw new Error("No se pudo obtener el sub de Cognito");

        await api.register({
          name,
          email: emailNorm,
          phone,          // tu API lo espera como string
          sub_cognito: sub // 👈 usa el sub real obtenido tras el sign-in
        });

        const datosUsuario = await api.login({ email, password});


        await guardarIdParticipante(datosUsuario.participante_id, datosUsuario.email, datosUsuario.nombre);



        // 4) Mantén la sesión iniciada y navega al menú principal
        if(datosUsuario.participante_id){
        router.replace("/MenuPrincipal" as const);
        Alert.alert("Cuenta confirmada", "Registro completado.");}

        return;
      } else {
        console.log('No hay contraseña');
      }

      // Si no tenemos la password, pedimos iniciar sesión
      Alert.alert("Cuenta confirmada", "Ahora inicia sesión para completar el registro.");
      router.replace("/(auth)/login" as const);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo confirmar/registrar");
    } finally {
      setBusy(false);
    }
  };

  const doResend = async () => {
    if (!email) return Alert.alert("Email requerido", "Ingresa tu correo");
    try {
      setBusy(true);
      await authResend(email.trim().toLowerCase());
      Alert.alert("Código reenviado", "Revisa tu correo.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo reenviar el código");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <ThemedText type="title" style={styles.brand}>Reparte+</ThemedText>
      <ThemedText type="subtitle" style={styles.subtitleTop}>Confirmar cuenta</ThemedText>

      <ThemedText style={styles.label}>Correo electrónico</ThemedText>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="usuario@correo.cl"
        placeholderTextColor="#9AA3AF"
        style={styles.input}
      />

      <ThemedText style={styles.label}>Código de verificación</ThemedText>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="123456"
        placeholderTextColor="#9AA3AF"
        keyboardType="number-pad"
        style={styles.input}
      />

      {/* Botón Confirmar con highlight */}
      <Pressable
        disabled={busy}
        onPress={doConfirm}
        android_ripple={{ color: '#9be7e5' }}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy ? { opacity: 0.7 } : null]}
      >
        {busy ? <ActivityIndicator /> : (
          <ThemedText type="link" style={styles.buttonText}>Confirmar</ThemedText>
        )}
      </Pressable>

      {/* Botón Reenviar con highlight */}
      <Pressable
        disabled={busy}
        onPress={doResend}
        android_ripple={{ color: '#E6FFFB' }}
        style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed, busy ? { opacity: 0.7 } : null]}
      >
        {busy ? <ActivityIndicator /> : (
          <ThemedText type="link" style={styles.secondaryText}>Reenviar código</ThemedText>
        )}
      </Pressable>
    </ThemedView>
  );
}
