import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { useLocalSearchParams, router } from 'expo-router';


const api = axios.create({
baseURL: 'https://qopxyt66x8.execute-api.us-east-1.amazonaws.com/production',
timeout: 20000,
headers: { 'Content-Type': 'application/json' },
validateStatus: () => true,
});

export default function InvitacionParticipantesLink() {


const {participanteId, grupoId, nombreGrupo, correoUsuario } = useLocalSearchParams<{ participanteId: string; grupoId?: string; nombreGrupo?: string, correoUsuario?: string; }>();

const [nombre, setNombre] = useState('');
const [correo, setCorreo] = useState('');
const [telefono, setTelefono] = useState('');
const [enviando, setEnviando] = useState(false);

const formValido = nombre.trim().length > 0 && (correo.trim().length > 0 || telefono.trim().length > 0);

const enviarInvitacion = async () => {
    
    if (correoUsuario == correo){
        Alert.alert('Error', 'No puedes enviar una invitación a tí mismo.');
        return
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
        email: correo.trim() ,
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        grupo_id: Number(grupoId),
        grupo_nombre: nombreGrupo
    };

    const resp = await api.post('/participante/invitar', body);

    if (resp.status >= 200 && resp.status < 300) {
        // Muchos endpoints devuelven un "link" o "token" de invitación
        const link = resp.data?.link || resp.data?.url || null;
        if (link) {
        Alert.alert('Información', 'Invitación enviada correctamente');
        } else {
        Alert.alert('Invitación creada', 'La invitación fue generada correctamente.');
        }
        // Opcional: volver a la pantalla anterior
        router.back();
    }else if(resp.status = 400){
        const msg = resp.data?.message || 'Ya existe una invitación registrada o aceptada para este correo en este grupo.';
        Alert.alert('Error', `${msg}`);
    } 
    else {
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

return (
    <View style={estilos.container}>
    <View style={{ position: 'absolute', top: 0, justifyContent: 'center', margin: '10%' }}>
        <View style={{ width: '100%', flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'black', fontSize: 40, fontWeight: 'bold' }}>Reparte+</Text>
        <Text style={{ color: 'black', fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
            Invitar participante mediante link
        </Text>
        {!!nombreGrupo && (
            <Text style={{ color: '#374151', marginTop: 6 }}>Grupo: {String(nombreGrupo)}</Text>
        )}
        </View>
    </View>

    <View style={{ width: '100%', gap: 8 }}>
        <Text style={estilos.label}>Nombre</Text>
        <TextInput
        style={estilos.inputLinkGrupo}
        value={nombre}
        onChangeText={setNombre}
        placeholder="Nombre del invitado"
        />

        <Text style={estilos.label}>Correo electrónico</Text>
        <TextInput
        style={estilos.inputLinkGrupo}
        value={correo}
        onChangeText={setCorreo}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="ejemplo@correo.com"
        />

        <Text style={estilos.label}>Teléfono</Text>
        <TextInput
        style={estilos.inputLinkGrupo}
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="phone-pad"
        placeholder="+56 9 1234 5678"
        />

        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: '60%' }}>
            <Pressable
            style={[
                estilos.botonCrearGrupo,
                (!formValido || enviando) && { opacity: 0.6 },
            ]}
            onPress={enviarInvitacion}
            disabled={!formValido || enviando}
            >
            {enviando ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Compartir link</Text>
            )}
            </Pressable>
        </View>
        </View>
    </View>
    </View>
);
}

const estilos = StyleSheet.create({
container: { backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', flex: 1 },
label: { alignItems: 'flex-start', color: 'black', fontSize: 20, fontWeight: '600', marginLeft: '5%' },
inputLinkGrupo: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    width: '90%',
    marginLeft: '5%',
    backgroundColor: '#fff',
},
botonCrearGrupo: {
    marginTop: 16,
    height: 48,
    borderRadius: 15,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
},
});
