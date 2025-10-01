// app/PagarSaldoPendiente.tsx
import React, { useState } from 'react';
import {
Alert,
Platform,
Pressable,
SafeAreaView,
StyleSheet,
Text,
TextInput,
View,
ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

type Opcion = { id: string; nombre: string };

export default function PagarSaldoPendiente() {
const [grupoId, setGrupoId] = useState<string | undefined>();
const [integranteId, setIntegranteId] = useState<string | undefined>();
const [gastoId, setGastoId] = useState<string | undefined>();
const [monto] = useState<string>(''); // valor fijo mostrado (input bloqueado)

return (
    <SafeAreaView style={estilos.safe}>
    <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
    >
        {/* Header centrado */}
        <View style={estilos.header}>
        <Text style={estilos.titulo}>Reparte+</Text>
        <Text style={estilos.subtitulo}>Pagar saldo pendiente</Text>
        </View>

        {/* Grupo */}
        <Text style={estilos.label}>Grupo</Text>
        <View style={estilos.pickerContainer}>
        <Picker
            selectedValue={grupoId}
            onValueChange={(v) => setGrupoId(String(v))}
            mode={Platform.OS === 'android' ? 'dialog' : 'dropdown'}
            dropdownIconColor={PRIMARY}
            style={estilos.picker}
        >
            {/* Opciones reales van aquí */}
        </Picker>
        </View>

        {/* Integrante */}
        <Text style={estilos.label}>Integrante</Text>
        <View style={estilos.pickerContainer}>
        <Picker
            selectedValue={integranteId}
            onValueChange={(v) => setIntegranteId(String(v))}
            mode={Platform.OS === 'android' ? 'dialog' : 'dropdown'}
            dropdownIconColor={PRIMARY}
            style={estilos.picker}
        >
            {/* Opciones reales van aquí */}
        </Picker>
        </View>

        {/* Gasto */}
        <Text style={estilos.label}>Gasto</Text>
        <View style={estilos.pickerContainer}>
        <Picker
            selectedValue={gastoId}
            onValueChange={(v) => setGastoId(String(v))}
            mode={Platform.OS === 'android' ? 'dialog' : 'dropdown'}
            dropdownIconColor={PRIMARY}
            style={estilos.picker}
        >
            {/* Opciones reales van aquí */}
        </Picker>
        </View>

        {/* Cantidad a pagar (siempre bloqueado) */}
        <Text style={estilos.label}>Cantidad a pagar</Text>
        <View style={estilos.inputContainer}>
        <TextInput
            style={[estilos.input, { color: '#64748B' }]} // tono gris para indicar bloqueo
            value={monto}
            editable={false}
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
        />
        <Text style={estilos.inputSufijo}>CLP</Text>

        {/* Candado estático (no presionable) */}
        <View
            style={estilos.lockBtn}
            accessibilityLabel="Monto bloqueado"
            accessible
        >
            <MaterialCommunityIcons name="lock" size={18} color={PRIMARY} />
        </View>
        </View>

        {/* CTA Pagar (deshabilitado aquí; habilítalo cuando conectes la lógica) */}
        <Pressable
        disabled={true}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
        style={({ pressed }) => [
            estilos.btnPrimary,
            { opacity: 0.6 },
            pressed && estilos.btnPrimaryPressed,
        ]}
        >
        <Text style={estilos.btnPrimaryText}>Pagar</Text>
        </Pressable>
    </ScrollView>
    </SafeAreaView>
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
safe: { flex: 1, backgroundColor: BG, paddingTop: 80 },

backBtn: { padding: 8, borderRadius: 10, alignSelf: 'flex-start' },
backBtnPressed: { backgroundColor: '#EEF7F6', transform: [{ scale: 0.97 }] },

header: { marginTop: 2, alignItems: 'center', marginBottom: 16 },
titulo: { fontSize: 28, fontWeight: '800', color: PRIMARY },
subtitulo: { fontSize: 16, fontWeight: '700', color: TEXT_MUTED, marginTop: 4 },

label: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
    marginLeft: 4,
},

/* Picker wrapper */
pickerContainer: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    backgroundColor: CARD,
    paddingHorizontal: 8,
    position: 'relative',
    overflow: Platform.OS === 'android' ? 'visible' : 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
},
picker: {
    width: '100%',
    color: TEXT,
    height: Platform.select({ android: 56, ios: 56 }),
    paddingRight: 28,
},

/* Input bloqueado */
inputContainer: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    backgroundColor: CARD,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
},
input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: Platform.select({ ios: 12, android: 8 }),
},
inputSufijo: {
    color: TEXT_MUTED,
    fontWeight: '800',
    marginRight: 8,
},
lockBtn: { padding: 8, borderRadius: 10 },

/* CTA */
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
});
