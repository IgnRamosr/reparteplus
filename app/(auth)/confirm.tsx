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
    // authSignOut, // si luego quieres cerrar sesión, lo tienes disponible
    } from "../../lib/auth";
    import { api } from "../../lib/api";

    export default function ConfirmScreen() {
    const {
        email: initialEmail,
        name: initialName,
        phone: initialPhone,
        // 👇 password que envías desde la pantalla de registro
        password: initialPassword,
    } = useLocalSearchParams<{
        email?: string; name?: string; phone?: string; password?: string;
    }>();

    const [email, setEmail] = useState((initialEmail ?? "").toString());
    const [name, setName]   = useState((initialName ?? "").toString());
    const [phone, setPhone] = useState((initialPhone ?? "").toString());
    const [password]             = useState((initialPassword ?? "").toString());
    const [code, setCode]   = useState("");
    const [busy, setBusy]   = useState(false);

    const styles = {
        input:  { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, marginTop: 10 },
        button: { marginTop: 16, borderRadius: 10, paddingVertical: 14, alignItems: "center", justifyContent: "center", backgroundColor: "black" },
        secondary: { marginTop: 8, borderRadius: 10, paddingVertical: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#111" },
    } as const;

    const doConfirm = async () => {
        if (!email || !code) return Alert.alert("Faltan datos", "Ingresa email y código");

        try {
        setBusy(true);

        const emailNorm = email.trim().toLowerCase();

        // 1) Confirmar en Cognito
        await authConfirm(emailNorm, code.trim());

        // 2) Si tenemos la password, iniciamos sesión para obtener el sub
        if (password) {
            await authSignIn(emailNorm, password);

            // 3) Obtener sub y registrar en tu API
            const sub = await getCognitoSub();
            if (!sub) throw new Error("No se pudo obtener el sub de Cognito");

            console.log(name,email,password,sub);

            await api.register({
            name,
            email: emailNorm,
            phone,          // tu API lo espera como string
            sub_cognito: sub // 👈 usa el sub real obtenido tras el sign-in
            });

            // 4) Mantén la sesión iniciada y navega al menú principal
            router.replace("/MenuPrincipal" as const); // ajusta la ruta si tu pantalla se llama diferente
            Alert.alert("Cuenta confirmada", "Registro completado.");
            return;
        }else{console.log('No hay contraseña')}

        // Si no tenemos la password, pedimos iniciar sesión para completar registro allí
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
