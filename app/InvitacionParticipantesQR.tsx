    // app/InvitarQR.tsx
    import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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

    function extractTokenFromUrl(url?: string | null) {
    if (!url) return null;
    try {
        const u = new URL(url);
        const t = u.searchParams.get("token");
        return t || null;
    } catch {
        // fallback por si llega un string sin protocolo, etc.
        const match = url.match(/[?&]token=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    }
    }

    export default function InvitarQR() {
    const { grupoId, nombreGrupo, participanteId } = useLocalSearchParams<Params>();

    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // refs para controlar intervalos y evitar regeneraciones múltiples
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isRefreshingRef = useRef(false);

    // === Navegación back física Android: volver a listado/previo ===
    useFocusEffect(
        React.useCallback(() => {
        const onBack = () => {
            router.replace({
            pathname: "/InvitacionParticipantesGeneral",
            params: { grupoId, nombreGrupo },
            });
            return true;
        };
        BackHandler.addEventListener("hardwareBackPress", onBack);

        }, [grupoId, nombreGrupo])
    );

    // === Crear o reutilizar QR (según backend) ===
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
            const nextQrUrl: string | null = res.data.qrUrl ?? null;
            const nextExpires: string | null = res.data.expires_at ?? null;
            const nextToken: string | null = res.data.token ?? extractTokenFromUrl(nextQrUrl);
            setQrUrl(nextQrUrl);
            setExpiresAt(nextExpires);
            setToken(nextToken);
        } else {
            Alert.alert("Error", res.data?.error || "No se pudo crear el QR.");
        }
        } catch (e: any) {
        Alert.alert("Error", e?.message || "Error de red.");
        } finally {
        setLoading(false);
        isRefreshingRef.current = false;
        }
    }, [grupoId, nombreGrupo, participanteId]);

    // === Copiar enlace del QR ===
    const copiar = useCallback(async () => {
        if (qrUrl) {
        await Clipboard.setStringAsync(qrUrl);
        Alert.alert("Copiado", "Enlace del QR copiado al portapapeles.");
        }
    }, [qrUrl]);

    // === Primera carga: pedir/recuperar QR ===
    useEffect(() => {
        crearQR();
    }, [crearQR]);

    // === Countdown (visual) ===
    const [remaining, setRemaining] = useState("");
    useEffect(() => {
        let t: any;
        if (expiresAt) {
        t = setInterval(() => {
            const diff = new Date(expiresAt).getTime() - Date.now();
            if (diff <= 0) {
            setRemaining("Expirado");
            clearInterval(t);
            // al expirar, regeneramos automáticamente
            if (!isRefreshingRef.current) {
                isRefreshingRef.current = true;
                crearQR();
            }
            } else {
            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setRemaining(`${m}m ${s}s`);
            }
        }, 1000);
        } else {
        setRemaining("—");
        }
        return () => clearInterval(t);
    }, [expiresAt, crearQR]);

    // === Polling: verificar si el QR fue "tomado" (previewInvite invalida) ===
    const checkQRStatus = useCallback(async () => {
        if (!token) return;
        try {
        // GET /participante/preview?token=...
        const url = `${API_BASE_URL}/participante/preview?token=${encodeURIComponent(token)}`;
        const res = await axios.get(url);

        // Respuesta válida → el QR aún es utilizable
        // { valido: true, ... } => no hacemos nada
        const valido = !!res.data?.valido;

        if (!valido) {
            // Si por alguna razón el status 200 vino con valido=false (poco probable), regeneramos.
            if (!isRefreshingRef.current) {
            isRefreshingRef.current = true;
            Alert.alert("QR usado", "Se generó un nuevo código QR automáticamente.");
            await crearQR();
            }
        }
        } catch (err: any) {
        // Si el preview falla con 4xx y mensaje "ya fue utilizado" o "expirado", regeneramos
        const msg = err?.response?.data?.error?.toString()?.toLowerCase() || "";
        const status = err?.response?.status;
        const yaUsado =
            msg.includes("ya fue utilizado") ||
            msg.includes("ya fue usado") ||
            msg.includes("utilizado");
        const expirado = msg.includes("expirado") || msg.includes("expiró") || msg.includes("expire");

        if (status === 400 || status === 404 || yaUsado || expirado) {
            if (!isRefreshingRef.current) {
            isRefreshingRef.current = true;
            // opcional: no alertar si expira, solo si fue usado
            if (yaUsado) {
                Alert.alert("QR tomado", "Alguien usó tu invitación. Generamos un nuevo código.");
            }
            await crearQR();
            }
        }
        // Otros errores de red: ignorar silenciosamente para el siguiente ciclo
        }
    }, [token, crearQR]);

    // === Intervalo de polling (cada 3s) mientras haya token ===
    useEffect(() => {
        if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        }
        if (!token) return;

            pollingRef.current = setInterval(() => {
            checkQRStatus();
            }, 3000);

            // limpiar
            return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
            };
    }, [token, checkQRStatus]);

    // === Botón "Regenerar" manual ===
    const regenerarManual = useCallback(async () => {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;
        await crearQR();
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
                <Pressable onPress={regenerarManual} style={s.btnGhost}>
                <Text style={s.ghostText}>Regenerar</Text>
                </Pressable>
            </View>
            </View>
        ) : null}

        <Pressable
            onPress={() =>
            router.replace({
                pathname: "/InvitacionParticipantesGeneral",
                params: { grupoId, nombreGrupo },
            })
            }
            style={[s.btnBack, { marginTop: 28 }]}
        >
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
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    muted: { color: "#6B7280" },
    btnOutline: {
        borderWidth: 1.5,
        borderColor: PRIMARY,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: CARD,
    },
    outText: { color: PRIMARY, fontWeight: "700" },
    btnGhost: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
    ghostText: { color: TEXT, fontWeight: "700" },
    btnBack: { marginTop: 8, alignSelf: "center", padding: 12 },
    backText: { color: PRIMARY, fontWeight: "700" },
    });
