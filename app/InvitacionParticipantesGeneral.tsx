    // InvitarParticipantes.tsx
    import { Picker } from '@react-native-picker/picker';
    import React, { useEffect, useMemo, useState } from 'react';
    import { Pressable, StyleSheet, Text, View, Alert, Platform } from 'react-native';
    import { router } from 'expo-router';
    import { obtenerCorreoparticipante, obtenerIDparticipante } from '@/lib/funcionesParticipante';
    import axios from 'axios';

    type GrupoUI = {
    id: string;     // usamos string para evitar problemas de igualdad en Picker
    nombre: string; // viene de "grupo"
    };

    const api = axios.create({
    baseURL: 'https://ee61hfpl8e.execute-api.us-east-1.amazonaws.com/production',
    timeout: 20000,
    headers: { 'Content-Type': 'application/json' },
    validateStatus: () => true,
    });

    export default function InvitarParticipantes() {
    const [correoUsuario, setCorreoUsuario] = useState('')
    const [participanteId, setParticipanteId] = useState<number | null>(null);
    const [grupos, setGrupos] = useState<GrupoUI[]>([]);
    const [selectedGrupoId, setSelectedGrupoId] = useState<string | undefined>(undefined);


    useEffect(() => {
        (async () => {
        const correo = await obtenerCorreoparticipante();
        const id = await obtenerIDparticipante();
        setParticipanteId(id);
        setCorreoUsuario(correo);
        if (id == null) return;

        try {
            const resp = await api.post('/grupos', { id, tipo: 'grupo' });
            // console.log('RESP:', resp.data);

            if (resp.status >= 200 && resp.status < 300) {
            // ✅ tu payload real:
            const resultados: any[] = resp.data?.resultados ?? [];

            const mapped: GrupoUI[] = resultados
                .map((item, idx) => {
                const nombre = item?.grupo ?? '';
                const gid = item?.grupo_id ?? `row-${idx}`;
                if (!nombre) return null;
                return { id: String(gid), nombre: String(nombre) };
                })
                .filter(Boolean) as GrupoUI[];

            setGrupos(mapped);
            if (mapped.length > 0) setSelectedGrupoId(mapped[0].id);
            } else {
            Alert.alert('Error', `(${resp.status}) ${resp.data?.message ?? 'No se pudieron cargar los grupos.'}`);
            }
        } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'No se pudieron cargar los grupos.';
            Alert.alert('Error', msg);
        }
        })();
    }, []);

    const grupoSeleccionado = useMemo(
        () => grupos.find(g => g.id === selectedGrupoId) || null,
        [grupos, selectedGrupoId]
    );

    const compartirEnlace = () => {
        if (!participanteId || !selectedGrupoId || !grupoSeleccionado) {
        Alert.alert('Selecciona un grupo primero');
        return;
        }
        router.push({
        pathname: '/InvitacionParticipantesLink',
        params: {
            participanteId: String(participanteId),
            grupoId: selectedGrupoId,            // id del grupo (string)
            nombreGrupo: grupoSeleccionado.nombre,    // nombre desde "grupo"
            correoUsuario: correoUsuario
        },
        } as const);
        // console.log(grupoSeleccionado.nombre)
    };

    return (
        <View style={estilos.container}>
        <View style={{ marginTop: 24, alignItems: 'center', marginBottom: 16 }}>
            <Text style={estilos.titulo}>Reparte+</Text>
            <Text style={estilos.subtitulo}>Invitar participantes</Text>
        </View>

        <Text style={estilos.label}>Grupo</Text>

        <View style={estilos.pickerContainer}>
            <Picker
            enabled={grupos.length > 0}
            selectedValue={selectedGrupoId}
            onValueChange={(val) => setSelectedGrupoId(String(val))}
            mode={Platform.OS === 'android' ? 'dialog' : 'dropdown'}
            dropdownIconColor="#6b7280"
            style={estilos.picker}
            >
            {grupos.length === 0 ? (
                <Picker.Item label="No tienes grupos disponibles" value={undefined} />
            ) : (
                grupos.map(g => (
                <Picker.Item key={g.id} label={g.nombre} value={g.id} />
                ))
            )}
            </Picker>
        </View>

        <Pressable style={estilos.botonNegro} onPress={compartirEnlace} disabled={!selectedGrupoId}>
            <Text style={estilos.botonTexto}>Compartir enlace</Text>
        </Pressable>

        <Pressable
            style={{
            backgroundColor: '#6b7280',
            borderRadius: 12,
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 16,
            opacity: selectedGrupoId ? 1 : 0.6
            }}
            disabled
        >
            <Text style={estilos.botonTexto}>Mostrar QR del grupo</Text>
        </Pressable>
        </View>
    );
    }

    const estilos = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
        paddingHorizontal: 16,
        paddingTop: 60
    },
    titulo: { fontSize: 32, fontWeight: 'bold', color: '#111827' },
    subtitulo: { fontSize: 18, fontWeight: '700', color: '#111827' },
    label: {
        color: '#111827',
        fontSize: 16,
        fontWeight: '700',
        marginTop: 8,
        marginBottom: 6,
        marginLeft: 4,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 10,
        backgroundColor: '#fff',
        paddingHorizontal: 8,
        position: 'relative',
        overflow: Platform.OS === 'android' ? 'visible' : 'hidden',
    },
    picker: {
        width: '100%',
        color: '#111827',
        height: Platform.select({ android: 60, ios: 60 }),
        paddingRight: 28,
    },
    botonNegro: {
        backgroundColor: '#000',
        borderRadius: 12,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
    },
    botonTexto: { color: '#fff', fontWeight: '700' },
    });
