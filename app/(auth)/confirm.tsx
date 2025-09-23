import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ThemedText } from "../../components/ThemedText";
import { ThemedView } from "../../components/ThemedView";
import { authConfirm, authResend } from "../../lib/auth";

export default function ConfirmScreen() {
const { email: initialEmail } = useLocalSearchParams<{ email?: string }>();
const [email, setEmail] = useState((initialEmail ?? "").toString());
const [code, setCode] = useState("");
const [busy, setBusy] = useState(false);

const styles = {
    input: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12, marginTop: 10,
    },
    button: {
    marginTop: 16, borderRadius: 10, paddingVertical: 14,
    alignItems: "center", justifyContent: "center", backgroundColor: "black",
    },
    secondary: {
    marginTop: 8, borderRadius: 10, paddingVertical: 12,
    alignItems: "center", justifyContent: "center", backgroundColor: "#111",
    },
} as const;

const doConfirm = async () => {
    if (!email || !code) return Alert.alert("Faltan datos", "Ingresa email y código");
    try {
    setBusy(true);
    await authConfirm(email.trim().toLowerCase(), code.trim());
    Alert.alert("Cuenta confirmada", "Ahora puedes iniciar sesión.");
    router.replace("/(auth)/login" as const);
    } catch (e: any) {
    Alert.alert("Error", e?.message ?? "No se pudo confirmar");
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
    <ThemedView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 56 }}>
    <ThemedText type="title" style={{ textAlign: "center", marginBottom: 4 }}>Reparte+</ThemedText>
    <ThemedText type="subtitle" style={{ textAlign: "center", marginBottom: 24 }}>Confirmar cuenta</ThemedText>

    <ThemedText>Correo electrónico</ThemedText>
    <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="usuario@correo.cl"
        style={styles.input}
    />

    <ThemedText style={{ marginTop: 10 }}>Código de verificación</ThemedText>
    <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="123456"
        keyboardType="number-pad"
        style={styles.input}
    />

    <Pressable disabled={busy} onPress={doConfirm} style={styles.button}>
        {busy ? <ActivityIndicator /> : <ThemedText type="link">Confirmar</ThemedText>}
    </Pressable>

    <Pressable disabled={busy} onPress={doResend} style={styles.secondary}>
        {busy ? <ActivityIndicator /> : <ThemedText type="link">Reenviar código</ThemedText>}
    </Pressable>
    </ThemedView>
);
}
