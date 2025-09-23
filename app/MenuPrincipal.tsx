import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';


    export default function MenuPrincipal() {
    return (
        <View style={estilos.container}>
        <View style={{ width: '100%', alignItems: 'center', marginBottom: 24 }}>
            <Text style={estilos.titulo}>Reparte+</Text>
            <Text style={estilos.subtitulo}>Menú Principal</Text>
        </View>

        {/* Crear Grupo */}
        <Pressable style={estilos.boton} onPress={() => router.push('/CreacionGrupos')} >
            <View style={estilos.row}>
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            <Text style={estilos.botonTexto}>Crear grupo</Text>
            </View>
        </Pressable>

        {/* Pagar saldo pendiente */}
        <Pressable style={[estilos.boton, estilos.botonSec]}>
            <View style={estilos.row}>
            <MaterialCommunityIcons name="currency-usd" size={20} color="#fff" />
            <Text style={estilos.botonTexto}>Pagar saldo pendiente</Text>
            </View>
        </Pressable>

        {/* Registrar gasto */}
        <Pressable style={[estilos.boton, estilos.botonSec]}>
            <View style={estilos.row}>
            <MaterialCommunityIcons name="note-edit-outline" size={20} color="#fff" />
            <Text style={estilos.botonTexto}>Registrar gasto</Text>
            </View>
        </Pressable>

        {/* Añadir participantes */}
        <Pressable style={[estilos.boton]} onPress={() => router.push('/InvitacionParticipantesGeneral')} >
            <View style={estilos.row}>
            <MaterialCommunityIcons name="account-multiple-plus-outline" size={20} color="#fff" />
            <Text style={estilos.botonTexto}>Añadir participantes</Text>
            </View>
        </Pressable>

        {/* Ver todos los grupos */}
        <Pressable style={[estilos.boton, estilos.botonSec]}>
            <View style={estilos.row}>
            <MaterialCommunityIcons name="eye-outline" size={20} color="#fff" />
            <Text style={estilos.botonTexto}>Ver todos los grupos</Text>
            </View>
        </Pressable>

        {/* Modificar equipo de participantes */}
        <Pressable style={[estilos.boton, estilos.botonSec]}>
            <View style={estilos.row}>
            <MaterialCommunityIcons name="pencil-outline" size={20} color="#fff" />
            <Text style={estilos.botonTexto}>Modificar equipo de participantes</Text>
            </View>
        </Pressable>

        {/* Finalizar evento */}
        <Pressable style={[estilos.boton, estilos.botonSec]}>
            <View style={estilos.row}>
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#fff" />
            <Text style={estilos.botonTexto}>Finalizar evento</Text>
            </View>
        </Pressable>
        </View>
    );
    }

    const estilos = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6', padding: 24, paddingTop: 60 },
    titulo: { fontSize: 36, fontWeight: 'bold', color: '#111827' },
    subtitulo: { fontSize: 20, fontWeight: '600', color: '#111827' },


    boton: {
        backgroundColor: '#000',
        borderRadius: 16,
        paddingVertical: 18,
        paddingHorizontal: 20,
        marginBottom: 16,
        alignItems: 'center',
    },
    botonSec: {
        backgroundColor: '#6b7280', 
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    botonTexto: { color: '#fff', fontSize: 18, fontWeight: '600' },
    });
