    // app/InvitacionParticipantesGeneral.tsx
    import React, { useEffect, useState, useMemo, useCallback } from 'react';
    import { Pressable, StyleSheet, Text, View, Alert, Platform, BackHandler } from 'react-native';
    import { router, useLocalSearchParams } from 'expo-router';
    import { useFocusEffect } from '@react-navigation/native';
    import { MaterialCommunityIcons } from '@expo/vector-icons';
    import { obtenerCorreoparticipante, obtenerIDparticipante } from '@/lib/funcionesParticipante';

    type Params = {
    grupoId?: string;
    nombreGrupo?: string;
    };

    export default function InvitarParticipantes() {
    // Datos del grupo desde los parámetros
    const { grupoId, nombreGrupo } = useLocalSearchParams<Params>();

    const [correoUsuario, setCorreoUsuario] = useState('');
    const [participanteId, setParticipanteId] = useState<number | null>(null);

    // ===== Navegación de regreso a /grupos/[id] con refresh =====
    const goBackToGroup = useCallback(() => {
        const gid = String(grupoId ?? '');
        if (gid) {
        router.replace({
            pathname: '/DetalleGrupo',
            params: { id: gid, _refresh: Date.now().toString() },
        });
        return true; 
        }
        router.back();
        return true;
    }, [grupoId]);

    // Capturar botón físico de Android
    useFocusEffect(
        useCallback(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', goBackToGroup);
        return () => sub.remove();
        }, [goBackToGroup])
    );

    // Cargamos identidad local del participante
    useEffect(() => {
        (async () => {
        const correo = await obtenerCorreoparticipante();
        const id = await obtenerIDparticipante();
        setParticipanteId(id);
        setCorreoUsuario(correo);
        })();
    }, []);

    // Validación mínima
    const tieneGrupoValido = useMemo(
        () => Boolean(grupoId && nombreGrupo && String(grupoId).trim() && String(nombreGrupo).trim()),
        [grupoId, nombreGrupo]
    );

    const compartirEnlace = () => {
        if (!participanteId || !tieneGrupoValido) {
        Alert.alert('Faltan datos', 'No se pudo detectar el grupo o el participante.');
        return;
        }
        router.push({
        pathname: '/InvitacionParticipantesLink',
        params: {
            participanteId: String(participanteId),
            grupoId: String(grupoId),
            nombreGrupo: String(nombreGrupo ?? ''),
            correoUsuario: correoUsuario,
        },
        } as const);
    };

    return (
        <View style={estilos.container}>
        {/* Header */}
        <View style={[estilos.headerRow]}>
            <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={estilos.titulo}>Reparte+</Text>
            <Text style={estilos.subtitulo}>Invitar participantes</Text>
            </View>
            <View style={{ width: 40 }} />
        </View>

        {/* Muestra del grupo proveniente de params */}
        <Text style={estilos.label}>Grupo</Text>

        <View style={estilos.displayContainer}>
            <View style={estilos.displayRow}>
            <Text style={estilos.displayValue}>
                {tieneGrupoValido ? String(nombreGrupo) : '—'}
            </Text>
            </View>
        </View>

        {/* Botón primario */}
        <Pressable
            onPress={compartirEnlace}
            disabled={!tieneGrupoValido}
            android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
            style={({ pressed }) => [
            estilos.btnPrimary,
            !tieneGrupoValido && { opacity: 0.65 },
            pressed && tieneGrupoValido && estilos.btnPrimaryPressed,
            ]}
        >
            <Text style={estilos.btnPrimaryText}>Compartir enlace</Text>
        </Pressable>

        {/* Botón outline (placeholder) */}
        <Pressable
            disabled
            android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
            style={({ pressed }) => [
            estilos.btnOutline,
            !tieneGrupoValido && { opacity: 0.65 },
            pressed && estilos.btnOutlinePressed,
            ]}
        >
            <Text style={estilos.btnOutlineText}>Mostrar QR del grupo</Text>
        </Pressable>
        </View>
    );
    }

    /* ====== Estilos LedgerTeal ====== */
    const PRIMARY = '#0EA5A4';
    const BG = '#F8FBFC';
    const TEXT = '#0F172A';
    const TEXT_MUTED = '#64748B';
    const BORDER = '#E2E8F0';
    const CARD = '#FFFFFF';

    const estilos = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG,
        paddingHorizontal: 16,
        paddingTop: 60,
    },

    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: CARD,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: PRIMARY,
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    backBtnPressed: { transform: [{ scale: 0.95 }] },

    header: { marginTop: 8, alignItems: 'center', marginBottom: 16 },
    titulo: { fontSize: 28, fontWeight: '800', color: PRIMARY },
    subtitulo: { fontSize: 16, fontWeight: '700', color: TEXT_MUTED, marginTop: 2 },

    label: {
        color: TEXT_MUTED,
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
        marginBottom: 6,
        marginLeft: 4,
    },

    displayContainer: {
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 14,
        backgroundColor: CARD,
        paddingHorizontal: 14,
        paddingVertical: Platform.select({ android: 12, ios: 14 }),
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    displayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        justifyContent: 'space-between',
    },
    displayValue: {
        color: TEXT,
        fontSize: 16,
        fontWeight: '700',
        flexShrink: 1,
        textAlign: 'right',
    },

    btnPrimary: {
        backgroundColor: PRIMARY,
        borderRadius: 14,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    btnPrimaryPressed: {
        backgroundColor: '#14B8A6',
        transform: [{ scale: 0.98 }],
        shadowOpacity: 0.12,
        elevation: 3,
    },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    btnOutline: {
        backgroundColor: CARD,
        borderRadius: 14,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        borderWidth: 1,
        borderColor: PRIMARY,
    },
    btnOutlinePressed: {
        backgroundColor: '#F0FBFA',
        transform: [{ scale: 0.98 }],
    },
    btnOutlineText: { color: PRIMARY, fontWeight: '700', fontSize: 16 },
    });
