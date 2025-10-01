    // InvitarParticipantes.tsx
    import React, { useEffect, useState, useMemo } from 'react';
    import { Pressable, StyleSheet, Text, View, Alert, Platform } from 'react-native';
    import { router, useLocalSearchParams } from 'expo-router';
    import { obtenerCorreoparticipante, obtenerIDparticipante } from '@/lib/funcionesParticipante';

    type Params = {
    grupoId?: string;
    nombreGrupo?: string;
    };

    export default function InvitarParticipantes() {
    // ⬇️ Tomamos los datos del grupo DESDE LOS PARÁMETROS
    const { grupoId, nombreGrupo } = useLocalSearchParams<Params>();

    const [correoUsuario, setCorreoUsuario] = useState('');
    const [participanteId, setParticipanteId] = useState<number | null>(null);

    // Cargamos identidad local del participante (igual que antes)
    useEffect(() => {
        (async () => {
        const correo = await obtenerCorreoparticipante();
        const id = await obtenerIDparticipante();
        setParticipanteId(id);
        setCorreoUsuario(correo);
        })();
    }, []);

    // Validación mínima para deshabilitar acciones si faltan params
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
        <View style={estilos.header}>
            <Text style={estilos.titulo}>Reparte+</Text>
            <Text style={estilos.subtitulo}>Invitar participantes</Text>
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

        {/* Botón outline (sigue deshabilitado, como antes) */}
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
    const PRIMARY = '#0EA5A4'; // teal
    const BG = '#F8FBFC';      // casi blanco azulado
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

    header: { marginTop: 8, alignItems: 'center', marginBottom: 16 },
    titulo: { fontSize: 32, fontWeight: '800', color: PRIMARY },
    subtitulo: { fontSize: 18, fontWeight: '700', color: TEXT_MUTED, marginTop: 2 },

    label: {
        color: TEXT_MUTED,
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
        marginBottom: 6,
        marginLeft: 4,
    },

    /* Reemplazo visual del Picker por un “display card” de solo lectura */
    displayContainer: {
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 14,
        backgroundColor: CARD,
        paddingHorizontal: 14,
        paddingVertical: Platform.select({ android: 12, ios: 14 }),
        // sombra suave
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
    displayLabel: {
        color: TEXT_MUTED,
        fontSize: 13,
        fontWeight: '700',
    },
    displayValue: {
        color: TEXT,
        fontSize: 16,
        fontWeight: '700',
        flexShrink: 1,
        textAlign: 'right',
    },
    displayCode: {
        color: PRIMARY,
        fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
        fontSize: 13,
        fontWeight: '800',
    },
    separator: {
        height: 1,
        backgroundColor: '#EEF7F6',
        marginVertical: 10,
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
