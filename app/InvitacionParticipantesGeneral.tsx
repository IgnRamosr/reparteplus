// InvitarParticipantes.tsx
import { Picker } from '@react-native-picker/picker';
import React from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';




export default function InvitarParticipantes() {



return (
    <View style={estilos.container}>
    {/* Header simple (puedes reemplazar con tu header real) */}
    <View style={{ marginTop: 24, alignItems: 'center', marginBottom: 16 }}>
        <Text style={estilos.titulo}>Reparte+</Text>
        <Text style={estilos.subtitulo}>Invitar participantes</Text>
    </View>

    {/* Etiqueta Grupo */}
    <Text style={estilos.label}>Grupo</Text>

    {/* Picker con contenedor estilizado tipo input */}
    <View style={estilos.pickerContainer}>
        <Picker
        dropdownIconColor="#6b7280"
        style={estilos.picker}
        >

        </Picker>

    </View>

    {/* Botones */}
    <Pressable style={estilos.botonNegro} >
        <Text style={estilos.botonTexto}>Compartir enlace</Text>
    </Pressable>

    <Pressable style={{backgroundColor: '#000',borderRadius: 12,height: 48,alignItems: 'center',justifyContent: 'center',marginTop: 16}} disabled={true}>
        <Text style={estilos.botonTexto}>Mostrar QR del grupo</Text>
    </Pressable>

    {/* Invitaciones pendientes */}
    <Text style={[estilos.label, { marginTop: 28 }]}>Invitaciones pendientes</Text>
    <TextInput
        editable={false}
        multiline

        style={estilos.listaPendientes}
    />
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

// Picker estilizado para verse como input del mock
pickerContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    position: 'relative',
},
picker: {
    width: '100%',
    color: '#111827',
    // altura cómoda como input
    height: 44,
},
chevron: {
    position: 'absolute',
    right: 12,
    top: 10,
    fontSize: 18,
    color: '#6b7280',
    // iOS: el Picker no muestra icono; esto mantiene el look del mock
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

listaPendientes: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
    padding: 12,
    minHeight: 80,
},
});
