// app/EscanearQR.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Platform, useWindowDimensions } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import axios, { AxiosError } from "axios";
import { router } from "expo-router";
import { obtenerIDparticipante } from "@/lib/funcionesParticipante";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const API_BASE_URL = "https://qopxyt66x8.execute-api.us-east-1.amazonaws.com/production";
const PRIMARY = "#0EA5A4";
const SECONDARY = "#14B8A6";
const BG = "#F8FAFC";
const TEXT = "#1F2937";
const TEXT_MUTED = "#6B7280";

type BarcodeResult = { data: string; type: string };

export default function EscanearQR() {
const [permission, requestPermission] = useCameraPermissions();
const [scanned, setScanned] = useState(false);
const [processing, setProcessing] = useState(false);
const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();

const [participanteId, setParticipanteId] = useState<number | null>(null);
const [nombre, setNombre] = useState<string>("Usuario");
const [email, setEmail] = useState<string>("");
const [telefono, setTelefono] = useState<string | null>(null);
const [cargandoPerfil, setCargandoPerfil] = useState(true);

const lockRef = useRef(false);

useEffect(() => {
    (async () => {
    try {
        const uid = await obtenerIDparticipante();
        if (!uid) {
        Alert.alert("Sesión", "No pudimos identificar tu usuario en la app.");
        setCargandoPerfil(false);
        return;
        }
        const res = await axios.get(`${API_BASE_URL}/participante/datos`, {
        params: { usuarioId: uid },
        });
        if (res.status >= 200 && res.status < 300) {
        const p = res.data?.participante;
        setParticipanteId(p?.participante_id ?? uid);
        setNombre(p?.nombre || "Usuario");
        setEmail(p.email || "aaa");
        setTelefono(p?.telefono ?? null);
        } else {
        Alert.alert("Error", res.data?.error || "No fue posible obtener tus datos.");
        }
    } catch (e: any) {
        Alert.alert("Error", e?.message || "No fue posible obtener tus datos.");
    } finally {
        setCargandoPerfil(false);
    }
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
        if (!email) throw new Error("No pudimos identificar tu usuario.");
        const token = extractToken(data);
        if (!token) throw new Error("QR inválido: no contiene token.");

        const p = await axios.get(`${API_BASE_URL}/participante/preview`, { params: { token } });
        if (!(p.status >= 200 && p.status < 300) || !p.data?.valido) {
        throw new Error(p.data?.error || "El código no es válido o expiró.");
        }

        const res = await axios.post(`${API_BASE_URL}/participante/claim-qr-app`, {
        token,
        participante_id: participanteId,
        nombre_usuario: nombre,
        email: email,
        telefono: telefono,
        });

        if (res.status >= 200 && res.status < 300) {
        const msg = res.data?.message || "¡Listo! Te uniste correctamente al grupo.";
        Alert.alert("Éxito", msg, [{ text: "OK", onPress: () => router.replace("/MenuPrincipal") }]);
        } else {
        throw new Error(res.data?.error || "No fue posible unirse al grupo.");
        }
    } catch (err: unknown) {
        const { title, message } = normalizeJoinError(err);
        Alert.alert(title, message, [
        {
            text: "Reintentar",
            onPress: () => {
            setScanned(false);
            lockRef.current = false;
            },
        },
        { text: "Cancelar", style: "cancel", onPress: () => router.replace("/MenuPrincipal") },
        ]);
    } finally {
        setProcessing(false);
    }
    },
    [scanned, processing, participanteId, nombre, telefono]
);

const isSmallScreen = SCREEN_W < 375;
const padding = isSmallScreen ? 16 : 20;

if (permission == null || cargandoPerfil) {
    return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
        <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>
            {permission == null ? "Solicitando permisos..." : "Cargando tu perfil..."}
            </Text>
        </View>
        </View>
    </SafeAreaView>
    );
}

if (!hasPermission) {
    return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
        <View style={[styles.permissionCard, { paddingHorizontal: padding }]}>
            <View style={styles.permissionIcon}>
            <MaterialCommunityIcons name="camera-off" size={48} color={PRIMARY} />
            </View>
            <Text style={styles.permissionTitle}>Acceso a la cámara</Text>
            <Text style={styles.permissionDesc}>
            Necesitamos acceso a tu cámara para escanear códigos QR y unirte a grupos
            </Text>

            <Pressable 
            onPress={requestPermission} 
            style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed
            ]}
            >
            <LinearGradient
                colors={[PRIMARY, SECONDARY]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}
            >
                <MaterialCommunityIcons name="camera" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Conceder permiso</Text>
            </LinearGradient>
            </Pressable>

            <Pressable 
            onPress={() => router.replace("/MenuPrincipal")} 
            style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed
            ]}
            >
            <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
        </View>
        </View>
    </SafeAreaView>
    );
}

return (
    <SafeAreaView style={styles.container} edges={['top']}>
    {/* Header */}
    <View style={[styles.header, { paddingHorizontal: padding }]}>
        <Pressable
        onPress={() => router.replace("/MenuPrincipal")}
        style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed
        ]}
        hitSlop={12}
        >
        <MaterialCommunityIcons name="arrow-left" size={24} color={TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>Escanear QR</Text>
        <View style={{ width: 40 }} />
    </View>

    {/* Camera View */}
    <View style={styles.cameraContainer}>
        <CameraView
        style={styles.camera}
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

        {/* Scanning Frame */}
        <View style={styles.scanFrame}>
        <View style={styles.scanOverlay}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
        </View>
        </View>

        {/* Processing Overlay */}
        {processing && (
        <View style={styles.processingOverlay}>
            <View style={styles.processingCard}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.processingText}>Procesando código...</Text>
            </View>
        </View>
        )}
    </View>

    {/* Bottom Panel */}
    <View style={[styles.bottomPanel, { paddingHorizontal: padding }]}>
        <View style={styles.panelContent}>
        <View style={styles.panelHeader}>
            <MaterialCommunityIcons name="qrcode-scan" size={32} color={PRIMARY} />
            <View style={styles.panelTextContainer}>
            <Text style={styles.panelTitle}>Apunta al código QR</Text>
            <Text style={styles.panelSubtitle}>
                Te uniremos automáticamente como: {nombre || "—"}
            </Text>
            </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.panelActions}>
            <Pressable
            onPress={() => {
                setScanned(false);
                lockRef.current = false;
            }}
            style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed
            ]}
            >
            <MaterialCommunityIcons name="reload" size={20} color={PRIMARY} />
            <Text style={styles.actionButtonText}>Reintentar</Text>
            </Pressable>

            <Pressable
            onPress={() => router.replace("/MenuPrincipal")}
            style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed
            ]}
            >
            <MaterialCommunityIcons name="close" size={20} color={TEXT_MUTED} />
            <Text style={[styles.actionButtonText, { color: TEXT_MUTED }]}>Cancelar</Text>
            </Pressable>
        </View>
        </View>
    </View>
    </SafeAreaView>
);
}

function extractToken(raw: string): string | null {
try {
    const u = new URL(raw);
    const t = u.searchParams.get("token");
    if (t) return t;
} catch {}
const match = raw.match(/[?&]token=([a-zA-Z0-9_-]+)/);
if (match?.[1]) return match[1];
if (/^[a-zA-Z0-9_-]{6,64}$/.test(raw)) return raw;
return null;
}

function normalizeJoinError(err: unknown): { title: string; message: string } {
if ((err as AxiosError)?.isAxiosError) {
    const ax = err as AxiosError<any>;
    const status = ax.response?.status;
    const serverMsg: string | undefined = ax.response?.data?.error || ax.response?.data?.message;
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
    if (status === 400) return { title: "No fue posible continuar", message: serverMsg || "Solicitud inválida." };
    if (status === 404) return { title: "No encontrado", message: serverMsg || "El código no existe o expiró." };
    if (status === 409) return { title: "Conflicto", message: serverMsg || "Ya estás en el grupo." };
    if (status && status >= 500) return { title: "Error del servidor", message: "Intenta nuevamente en unos minutos." };
    if (ax.code === "ECONNABORTED") return { title: "Tiempo de espera agotado", message: "Revisa tu conexión e intenta de nuevo." };
    if (ax.message?.includes("Network Error")) return { title: "Error de red", message: "No pudimos conectar al servidor." };
    return { title: "Error", message: serverMsg || ax.message || "No se pudo procesar el QR." };
}
const m = (err as any)?.message || "No se pudo procesar el QR.";
return { title: "Error", message: m };
}

const styles = StyleSheet.create({
container: {
    flex: 1,
    backgroundColor: BG,
},
centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
},

// ===== LOADING STATE =====
loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    ...Platform.select({
    ios: {
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 4 },
    },
    android: {
        elevation: 8,
    },
    }),
},
loadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_MUTED,
},

// ===== PERMISSION STATE =====
permissionCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    ...Platform.select({
    ios: {
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
    },
    android: {
        elevation: 12,
    },
    }),
},
permissionIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
},
permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
},
permissionDesc: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
},
primaryButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    ...Platform.select({
    ios: {
        shadowColor: PRIMARY,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
    },
    android: {
        elevation: 6,
    },
    }),
},
primaryButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
},
primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 10,
},
primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
},
secondaryButton: {
    width: '100%',
    padding: 14,
    alignItems: 'center',
},
secondaryButtonPressed: {
    opacity: 0.6,
},
secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_MUTED,
},

// ===== HEADER =====
header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
},
backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
},
backButtonPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
},
headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
},

// ===== CAMERA =====
cameraContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
},
camera: {
    flex: 1,
},
scanFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
},
scanOverlay: {
    width: 250,
    height: 250,
    position: 'relative',
},
corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: PRIMARY,
    borderWidth: 4,
},
cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
},
cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
},
cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
},
cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
},

// ===== PROCESSING OVERLAY =====
processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
},
processingCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
},
processingText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
},

// ===== BOTTOM PANEL =====
bottomPanel: {
    backgroundColor: '#fff',
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#E5E7EB',
    ...Platform.select({
    ios: {
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -4 },
    },
    android: {
        elevation: 16,
    },
    }),
},
panelContent: {
    gap: 20,
},
panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
},
panelTextContainer: {
    flex: 1,
    gap: 4,
},
panelTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
},
panelSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_MUTED,
    lineHeight: 20,
},
panelActions: {
    flexDirection: 'row',
    gap: 12,
},
actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: BG,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
},
actionButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
},
actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
},
});