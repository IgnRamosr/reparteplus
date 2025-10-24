// app/EscanearQR.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import axios, { AxiosError } from "axios";
import { router } from "expo-router";
import {
obtenerCorreoparticipante,
obtenerIDparticipante,
obtenerNombreparticipante,
} from "@/lib/funcionesParticipante";

const API_BASE_URL = "https://qopxyt66x8.execute-api.us-east-1.amazonaws.com/production";
const PRIMARY = "#0EA5A4";
const BG = "#F8FBFC";
const TEXT = "#0F172A";

type BarcodeResult = { data: string; type: string };

export default function EscanearQR() {
const [permission, requestPermission] = useCameraPermissions();
const [scanned, setScanned] = useState(false);
const [processing, setProcessing] = useState(false);

const [correo, setCorreo] = useState<string>("");
const [nombre, setNombre] = useState<string>("");

// evita doble-disparo del handler
const lockRef = useRef(false);

useEffect(() => {
    (async () => {
    const [name, mail] = await Promise.all([
        obtenerNombreparticipante(),
        obtenerCorreoparticipante(),
    ]);
    setNombre(name || "Usuario");
    setCorreo(mail || "");
    })();
}, []);

const hasPermission = permission?.granted === true;

const handleScan = useCallback(
    async ({ data }: BarcodeResult) => {
    if (lockRef.current || scanned || processing) return;
    lockRef.current = true;
    setScanned(true);
    setProcessing(true);

    try {
        const token = extractToken(data);
        if (!token) throw new Error("QR inválido: no contiene token.");

        // 1) Validar preview (para feedback rápido: expirado/ya usado/etc.)
        const p = await axios.get(`${API_BASE_URL}/participante/preview`, { params: { token } });
        if (!(p.status >= 200 && p.status < 300) || !p.data?.valido) {
        // preferimos el mensaje del backend si existe
        throw new Error(p.data?.error || "El código no es válido o expiró.");
        }

        // 2) Reclamar (APP): por participante_id y nombre_usuario (sin email)
        const participanteId = await obtenerIDparticipante();
        if (!participanteId) {
        throw new Error("No pudimos identificar tu usuario en la app.");
        }

        const res = await axios.post(`${API_BASE_URL}/participante/claim-qr-app`, {
        token,
        participante_id: participanteId,
        nombre_usuario: nombre || "Usuario",
        telefono: null,
        });

        if (res.status >= 200 && res.status < 300) {
        const msg = res.data?.message || "¡Listo! Te uniste correctamente al grupo.";
        Alert.alert("Éxito", msg, [{ text: "OK", onPress: () => router.back() }]);
        } else {
        // en teoría no ocurre porque buildResponse siempre da body con error
        throw new Error(res.data?.error || "No fue posible unirse al grupo.");
        }
    } catch (err: unknown) {
        // Normalizamos el error para dar mensajes claros
        const { title, message } = normalizeJoinError(err);
        Alert.alert(title, message, [
        {
            text: "Reintentar",
            onPress: () => {
            setScanned(false);
            lockRef.current = false;
            },
        },
        { text: "Cancelar", style: "cancel", onPress: () => router.back() },
        ]);
    } finally {
        setProcessing(false);
    }
    },
    [scanned, processing, nombre]
);

if (permission == null) {
    // aún cargando estado de permisos
    return (
    <Centered>
        <ActivityIndicator />
        <Text>Pidiendo permiso de cámara…</Text>
    </Centered>
    );
}

if (!hasPermission) {
    return (
    <Centered>
        <Text style={{ marginBottom: 10 }}>Necesitamos acceso a la cámara para leer el QR</Text>
        <Pressable onPress={requestPermission} style={btn.solid}>
        <Text style={btn.solidText}>Conceder permiso</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={[btn.ghost, { marginTop: 12 }]}>
        <Text style={btn.ghostText}>Cancelar</Text>
        </Pressable>
    </Centered>
    );
}

return (
    <View style={{ flex: 1, backgroundColor: BG }}>
    <View style={{ flex: 1 }}>
        <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={(result) => {
            const payload: BarcodeResult = {
            data: (result as any)?.data,
            type: (result as any)?.type,
            };
            if (payload?.data) handleScan(payload);
        }}
        />
        {processing && (
        <View style={overlay.loading}>
            <ActivityIndicator color="#fff" />
            <Text style={{ color: "#fff", marginTop: 6 }}>Procesando…</Text>
        </View>
        )}
    </View>

    <View style={panel.container}>
        <Text style={panel.title}>Escanea el código QR</Text>
        <Text style={panel.subtitle}>
        Te uniremos automáticamente con tu usuario: {nombre || "—"}
        </Text>

        <Pressable
        onPress={() => {
            // Permite otro intento manual si quedó “trancado”
            setScanned(false);
            lockRef.current = false;
        }}
        style={btn.ghost}
        >
        <Text style={btn.ghostText}>Reintentar</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={btn.ghost}>
        <Text style={btn.ghostText}>Cancelar</Text>
        </Pressable>
    </View>
    </View>
);
}

/** Extrae el token desde:
 * - URL con ?token=xxxx
 * - Texto que incluya token=xxxx
 * - Token crudo (alfanumérico)
 */
function extractToken(raw: string): string | null {
try {
    const u = new URL(raw);
    const t = u.searchParams.get("token");
    if (t) return t;
} catch {
    // no era URL
}
const match = raw.match(/[?&]token=([a-zA-Z0-9_-]+)/);
if (match?.[1]) return match[1];
if (/^[a-zA-Z0-9_-]{6,64}$/.test(raw)) return raw;
return null;
}

/** Traduce Axios/network/backend errors a mensajes de UX */
function normalizeJoinError(err: unknown): { title: string; message: string } {
// Network/timeout
if ((err as AxiosError)?.isAxiosError) {
    const ax = err as AxiosError<any>;
    const status = ax.response?.status;
    const serverMsg: string | undefined = ax.response?.data?.error || ax.response?.data?.message;

    // Mensajes “conocidos” de nuestro backend
    const known = [
    "El token no es de tipo QR.",
    "El token ya fue utilizado.",
    "El código QR ha expirado.",
    "Invitación inválida o no existe.",
    "Participante no existe.",
    "Este usuario ya pertenece al grupo.",
    "Este correo ya pertenece al grupo.",
    "Este correo ya está registrado en el grupo.",
    "El código no es válido o expiró.",
    ];

    if (serverMsg && known.includes(serverMsg)) {
    return { title: "No fue posible continuar", message: serverMsg };
    }

    // Status específicos (por si el mensaje cambia)
    if (status === 400) {
    return { title: "No fue posible continuar", message: serverMsg || "Solicitud inválida." };
    }
    if (status === 404) {
    return { title: "No encontrado", message: serverMsg || "El código no existe o expiró." };
    }
    if (status === 409) {
    return { title: "Conflicto", message: serverMsg || "Ya estás en el grupo." };
    }
    if (status && status >= 500) {
    return { title: "Error del servidor", message: "Intenta nuevamente en unos minutos." };
    }

    // Error de red / sin conexión / CORS
    if (ax.code === "ECONNABORTED") {
    return { title: "Tiempo de espera agotado", message: "Revisa tu conexión e intenta de nuevo." };
    }
    if (ax.message?.includes("Network Error")) {
    return { title: "Error de red", message: "No pudimos conectar al servidor." };
    }

    return { title: "Error", message: serverMsg || ax.message || "No se pudo procesar el QR." };
}

// Error común (throw new Error(...))
const m = (err as any)?.message || "No se pudo procesar el QR.";
return { title: "Error", message: m };
}

/* UI helpers */
function Centered({ children }: { children: React.ReactNode }) {
return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: BG }}>
    {children}
    </View>
);
}

const overlay = StyleSheet.create({
loading: { position: "absolute", left: 0, right: 0, bottom: 100, alignItems: "center" },
});
const panel = StyleSheet.create({
container: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
},
title: { fontSize: 18, fontWeight: "800", color: TEXT },
subtitle: { marginTop: 6, color: "#6B7280", fontWeight: "600" },
});
const btn = StyleSheet.create({
solid: { backgroundColor: PRIMARY, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
solidText: { color: "#fff", fontWeight: "700" },
ghost: { padding: 12, alignSelf: "flex-start" },
ghostText: { color: PRIMARY, fontWeight: "700" },
});
