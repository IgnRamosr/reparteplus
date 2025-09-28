// InvitarParticipantes.tsx
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { obtenerCorreoparticipante, obtenerIDparticipante } from '@/lib/funcionesParticipante';
import axios from 'axios';

type GrupoUI = { id: string; nombre: string };

const api = axios.create({
baseURL: 'https://ee61hfpl8e.execute-api.us-east-1.amazonaws.com/production',
timeout: 20000,
headers: { 'Content-Type': 'application/json' },
validateStatus: () => true,
});

export default function InvitarParticipantes() {
const [correoUsuario, setCorreoUsuario] = useState('');
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
        if (resp.status >= 200 && resp.status < 300) {
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
        grupoId: selectedGrupoId,
        nombreGrupo: grupoSeleccionado.nombre,
        correoUsuario: correoUsuario,
    },
    } as const);
};

return (
    <View style={estilos.container}>
    <View style={estilos.header}>
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
        dropdownIconColor={PRIMARY}
        style={estilos.picker}
        >
        {grupos.length === 0 ? (
            <Picker.Item label="No tienes grupos disponibles" value={undefined} />
        ) : (
            grupos.map(g => <Picker.Item key={g.id} label={g.nombre} value={g.id} />)
        )}
        </Picker>
    </View>

      {/* Botón primario con highlight */}
    <Pressable
        onPress={compartirEnlace}
        disabled={!selectedGrupoId}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
        style={({ pressed }) => [
        estilos.btnPrimary,
        !selectedGrupoId && { opacity: 0.65 },
        pressed && selectedGrupoId && estilos.btnPrimaryPressed,
        ]}
    >
        <Text style={estilos.btnPrimaryText}>Compartir enlace</Text>
    </Pressable>

      {/* Botón outline con highlight (ahora sigue disabled como lo tenías) */}
    <Pressable
        disabled
        android_ripple={{ color: 'rgba(14,165,164,0.08)' }}
        style={({ pressed }) => [
        estilos.btnOutline,
        !selectedGrupoId && { opacity: 0.65 },
        pressed && estilos.btnOutlinePressed,
        ]}
    >
        <Text style={estilos.btnOutlineText}>Mostrar QR del grupo</Text>
    </Pressable>
    </View>
);
}

// ====== SOLO ESTILOS LedgerTeal ======
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

pickerContainer: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    backgroundColor: CARD,
    paddingHorizontal: 8,
    position: 'relative',
    overflow: Platform.OS === 'android' ? 'visible' : 'hidden',
    // sombra suave
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
},
picker: {
    width: '100%',
    color: TEXT,
    height: Platform.select({ android: 60, ios: 60 }),
    paddingRight: 28,
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
  // 👇 highlight primario
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
  // 👇 highlight outline
btnOutlinePressed: {
    backgroundColor: '#F0FBFA',
    transform: [{ scale: 0.98 }],
},
btnOutlineText: { color: PRIMARY, fontWeight: '700', fontSize: 16 },
});
