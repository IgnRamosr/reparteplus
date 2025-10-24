    // app/InvitarQR.tsx
    import React, { useEffect, useMemo, useState, useCallback } from "react";
    import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, BackHandler } from "react-native";
    import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
    import QRCode from "react-native-qrcode-svg";
    import * as Clipboard from "expo-clipboard";
    import axios from "axios";

    const API_BASE_URL = "https://qopxyt66x8.execute-api.us-east-1.amazonaws.com/production";
    const PRIMARY = "#0EA5A4";
    const BORDER = "#E5E7EB";
    const CARD = "#FFFFFF";
    const TEXT = "#0F172A";
    const BG = "#F8FBFC";

    type Params = { grupoId?: string; nombreGrupo?: string; participanteId?: string };



    export default function InvitarQR() {
    const { grupoId, nombreGrupo, participanteId } = useLocalSearchParams<Params>();
    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useFocusEffect(
    React.useCallback(() => {
    const onBack = () => {
    router.replace({
        pathname:"/InvitacionParticipantesGeneral",
        params:{grupoId,nombreGrupo}
    }); // <-- destino
    return true;               // consumimos el back
    };
    BackHandler.addEventListener("hardwareBackPress", onBack);
    }, [])
    );

    const crearQR = useCallback(async () => {
        if (!grupoId || !nombreGrupo || !participanteId) {
        Alert.alert("Faltan datos", "No se pudo detectar grupo o participante.");
        return;
        }
        try {
        setLoading(true);
        const res = await axios.post(`${API_BASE_URL}/participante/invitar-qr`, {
            grupo_id: Number(grupoId),
            grupo_nombre: String(nombreGrupo),
            participante_id: Number(participanteId),
        });
        if (res.status >= 200 && res.status < 300) {
            setQrUrl(res.data.qrUrl);
            setExpiresAt(res.data.expires_at ?? null);
        } else {
            Alert.alert("Error", res.data?.error || "No se pudo crear el QR.");
        }
        } catch (e: any) {
        Alert.alert("Error", e?.message || "Error de red.");
        } finally {
        setLoading(false);
        }
    }, [grupoId, nombreGrupo, participanteId]);

    // countdown simple
    const [remaining, setRemaining] = useState("");
    useEffect(() => {
        let t: any;
        if (expiresAt) {
        t = setInterval(() => {
            const diff = new Date(expiresAt).getTime() - Date.now();
            if (diff <= 0) {
            setRemaining("Expirado");
            clearInterval(t);
            } else {
            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setRemaining(`${m}m ${s}s`);
            }
        }, 1000);
        }
        return () => clearInterval(t);
    }, [expiresAt]);

    const copiar = async () => {
        if (qrUrl) {
        await Clipboard.setStringAsync(qrUrl);
        Alert.alert("Copiado", "Enlace del QR copiado al portapapeles.");
        }
    };

    useEffect(() => {
        crearQR();
    }, [crearQR]);

    return (
        <View style={s.container}>
        <Text style={s.title}>Invitar por QR</Text>
        <Text style={s.subtitle}>Comparte este código para que se unan al grupo</Text>

        {loading && !qrUrl ? (
            <View style={{ marginTop: 30, alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8 }}>Generando QR…</Text>
            </View>
        ) : qrUrl ? (
            <View style={{ alignItems: "center", gap: 12, marginTop: 20 }}>
            <View style={s.qrCard}>
                <QRCode value={qrUrl} size={260} />
            </View>
            <Text style={s.muted}>Vence en: {remaining || "—"}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable onPress={copiar} style={s.btnOutline}>
                <Text style={s.outText}>Copiar enlace</Text>
                </Pressable>
                <Pressable onPress={crearQR} style={s.btnGhost}>
                <Text style={s.ghostText}>Regenerar</Text>
                </Pressable>
            </View>
            </View>
        ) : null}

        <Pressable onPress={() => router.back()} style={[s.btnBack, { marginTop: 28 }]}>
            <Text style={s.backText}>Volver</Text>
        </Pressable>
        </View>
    );
    }

    const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG, padding: 20 },
    title: { fontSize: 22, fontWeight: "800", color: TEXT },
    subtitle: { marginTop: 4, color: "#64748B", fontWeight: "600" },
    qrCard: {
        backgroundColor: CARD,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER,
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    },
    muted: { color: "#6B7280" },
    btnOutline: { borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: CARD },
    outText: { color: PRIMARY, fontWeight: "700" },
    btnGhost: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
    ghostText: { color: TEXT, fontWeight: "700" },
    btnBack: { marginTop: 8, alignSelf: "center", padding: 12 },
    backText: { color: PRIMARY, fontWeight: "700" },
    });
