import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, BackHandler } from 'react-native';
import axios from 'axios';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';

const api = axios.create({
baseURL: 'https://qopxyt66x8.execute-api.us-east-1.amazonaws.com/production',
timeout: 20000,
headers: { 'Content-Type': 'application/json' },
validateStatus: () => true,
});

export default function InvitacionParticipantesLink() {
const { participanteId, grupoId, nombreGrupo, correoUsuario } =
    useLocalSearchParams<{ participanteId: string; grupoId?: string; nombreGrupo?: string; correoUsuario?: string; }>();

const [nombre, setNombre] = useState('');
const [correo, setCorreo] = useState('');
const [telefono, setTelefono] = useState('');
const [enviando, setEnviando] = useState(false);

const formValido =
    nombre.trim().length > 0 && (correo.trim().length > 0 || telefono.trim().length > 0);

const enviarInvitacion = async () => {
    if (correoUsuario == correo) {
    Alert.alert('Error', 'No puedes enviar una invitación a tí mismo.');
    return;
    }
    if (!grupoId) {
    Alert.alert('Falta información', 'No se recibió el grupo.');
    return;
    }
    if (!formValido) {
    Alert.alert('Datos incompletos', 'Ingresa el nombre y al menos correo o teléfono.');
    return;
    }

    try {
    setEnviando(true);

    const body = {
        participante_id: participanteId,
        email: correo.trim(),
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        grupo_id: Number(grupoId),
        grupo_nombre: nombreGrupo,
    };

    const resp = await api.post('/participante/invitar', body);

    if (resp.status >= 200 && resp.status < 300) {
        const link = resp.data?.link || resp.data?.url || null;
        if (link) {
        Alert.alert('Información', 'Invitación enviada correctamente');
        } else {
        Alert.alert('Invitación creada', 'La invitación fue generada correctamente.');
        }
        router.back();
      } else if (resp.status = 400) { 
        const msg = resp.data?.message || 'Ya existe una invitación registrada o aceptada para este correo en este grupo.';
        Alert.alert('Error', `${msg}`);
    } else {
        const msg = resp.data?.message || 'No se pudo generar la invitación.';
        Alert.alert('Error', `(${resp.status}) ${msg}`);
    }
    } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || 'Error desconocido.';
    Alert.alert('Error', msg);
    } finally {
    setEnviando(false);
    }
};

useFocusEffect(
    React.useCallback(() => {
    const onBack = () => {
        router.replace({
        pathname:"/InvitacionParticipantesGeneral",
        params:{grupoId, nombreGrupo}
        }); // <-- destino
        return true;               // consumimos el back
    };
    BackHandler.addEventListener("hardwareBackPress", onBack);
    }, [])
);

return (
    <View style={estilos.container}>
      {/* Header */}
    <View style={estilos.header}>
        <Text style={estilos.brand}>Reparte+</Text>
        <Text style={estilos.subtitle}>Invitar participante mediante link</Text>
        {!!nombreGrupo && <Text style={estilos.groupHint}>Grupo: {String(nombreGrupo)}</Text>}
    </View>

      {/* Form */}
    <View style={{ width: '100%', gap: 8 }}>
        <Text style={estilos.label}>Nombre</Text>
        <TextInput
        style={estilos.input}
        value={nombre}
        onChangeText={setNombre}
        placeholder="Nombre del invitado"
        placeholderTextColor="#9AA3AF"
        />

        <Text style={estilos.label}>Correo electrónico</Text>
        <TextInput
        style={estilos.input}
        value={correo}
        onChangeText={setCorreo}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="ejemplo@correo.com"
        placeholderTextColor="#9AA3AF"
        />

        <Text style={estilos.label}>Teléfono</Text>
        <TextInput
        style={estilos.input}
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="phone-pad"
        placeholder="+56 9 1234 5678"
        placeholderTextColor="#9AA3AF"
        />

        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: '60%' }}>
            <Pressable
            onPress={enviarInvitacion}
            disabled={!formValido || enviando}
            android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
            style={({ pressed }) => [
                estilos.btnPrimary,
                (!formValido || enviando) && { opacity: 0.6 },
                pressed && formValido && !enviando && estilos.btnPrimaryPressed,
            ]}
            >
            {enviando ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <Text style={estilos.btnPrimaryText}>Compartir link</Text>
            )}
            </Pressable>
        </View>
        </View>
    </View>
    </View>
);
}

// ====== SOLO ESTILOS (LedgerTeal) ======
const PRIMARY = '#0EA5A4'; // teal
const BG = '#F8FBFC';      // casi blanco azulado
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';
const CARD = '#FFFFFF';

const estilos = StyleSheet.create({
container: {
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
},

header: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
},
brand: { color: PRIMARY, fontSize: 34, fontWeight: '800' },
subtitle: { color: TEXT_MUTED, fontSize: 18, fontWeight: '600', textAlign: 'center' },
groupHint: { color: '#374151', marginTop: 6 },

label: { alignItems: 'flex-start', color: TEXT_MUTED, fontSize: 14, fontWeight: '600', marginLeft: '5%' },

input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '90%',
    marginLeft: '5%',
    backgroundColor: CARD,
    height: 52,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
},

btnPrimary: {
    marginTop: 16,
    height: 50,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
},
  // highlight del botón
btnPrimaryPressed: {
    backgroundColor: '#14B8A6',
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.12,
    elevation: 3,
},
btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
