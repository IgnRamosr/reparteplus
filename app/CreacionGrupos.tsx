import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import axios from 'axios';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';


const api = axios.create({
  baseURL: 'https://ee61hfpl8e.execute-api.us-east-1.amazonaws.com/production',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true
});


const toYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function CrearGrupo() {
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [descripcionGrupo, setDescripcionGrupo] = useState('');

  // fechas
  const [fechaInicio, setFechaInicio] = useState<Date | null>(null);
  const [fechaTermino, setFechaTermino] = useState<Date | null>(null);

  // mostrar pickers
  const [showInicio, setShowInicio] = useState(false);
  const [showTermino, setShowTermino] = useState(false);

  const nombreValido = nombreGrupo.trim().length > 0;

  // habilita botón solo si todo está válido
  const formValido = useMemo(() => {
    if (!nombreValido) return false;
    if (!fechaInicio || !fechaTermino) return false;
    return fechaTermino >= fechaInicio;
  }, [nombreValido, fechaInicio, fechaTermino]);

  const onChangeInicio = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowInicio(false);
    if (date) {
      setFechaInicio(date);
      if (fechaTermino && date > fechaTermino) setFechaTermino(null);
    }
  };

  const onChangeTermino = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowTermino(false);
    if (date) setFechaTermino(date);
  };

  const formatCL = (d?: Date | null) =>
    d ? d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

  const crearGrupo = async () => {
    const nombreGrupoLimpio = nombreGrupo.trim();
    if (!nombreGrupoLimpio) return;

    if (!fechaInicio) {
      Alert.alert('Falta información', 'Selecciona la fecha de inicio.');
      return;
    }
    if (!fechaTermino) {
      Alert.alert('Falta información', 'Selecciona la fecha de término.');
      return;
    }
    if (fechaTermino < fechaInicio) {
      Alert.alert('Rango inválido', 'La fecha de término no puede ser anterior a la de inicio.');
      return;
    }

    try {
      // payload según ejemplo tuyo
      const payload = {
        nombre: nombreGrupoLimpio,
        descripcion: descripcionGrupo.trim(),
        fecha_inicio: toYMD(fechaInicio),   
        fecha_cierre: toYMD(fechaTermino),  
        creado_por: 1
      };


      const resp = await api.post('/grupo', payload);

      if (resp.status >= 200 && resp.status < 300) {
        Alert.alert('OK', `Grupo creado: ${resp.data?.nombre ?? payload.nombre}`);
      } else {
        Alert.alert(
          'Error',
          `(${resp.status}) ${resp.data?.message ?? 'Fallo al crear el grupo.'}`
        );
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'No se pudo crear el grupo. Intenta nuevamente.';
      Alert.alert('Error', msg);
    }
  };

  return (
    <View style={estilos.container}>
      <View style={{ position: 'absolute', top: 0, justifyContent: 'center', margin: '10%' }}>
        <View style={{ width: '100%', flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: 'black', fontSize: 40, fontWeight: 'bold' }}>Reparte+</Text>
          <Text style={{ color: 'black', fontSize: 20, fontWeight: 'bold' }}>Creación de grupos</Text>
        </View>
      </View>

      <View style={{ width: '100%', gap: 8 }}>
        {/* Nombre */}
        <Text style={estilos.label}>Nombre del grupo</Text>
        <TextInput
          onChangeText={setNombreGrupo}
          placeholder="Ej: Viaje a Pucón"
          maxLength={40}
          style={estilos.input}
          value={nombreGrupo}
        />

        {/* Descripción */}
        <Text style={estilos.label}>Descripción</Text>
        <TextInput
          onChangeText={setDescripcionGrupo}
          placeholder="Descripción del grupo"
          multiline
          maxLength={200}
          style={[estilos.input, { height: 88 }]}
          value={descripcionGrupo}
        />

        {/* Fecha de inicio */}
        <Text style={estilos.label}>Fecha de inicio</Text>
        <Pressable onPress={() => setShowInicio(true)} style={estilos.inputLike}>
          <Text style={{ color: formatCL(fechaInicio) ? '#111827' : '#9ca3af' }}>
            {formatCL(fechaInicio) || 'dd/mm/aaaa'}
          </Text>
          <Text style={estilos.iconoCalendario}>📅</Text>
        </Pressable>

        {/* Fecha de término */}
        <Text style={estilos.label}>Fecha de término</Text>
        <Pressable
          onPress={() => setShowTermino(true)}
          style={estilos.inputLike}
          disabled={!fechaInicio}
        >
          <Text
            style={{
              color: formatCL(fechaTermino) ? '#111827' : '#9ca3af',
              opacity: fechaInicio ? 1 : 0.5
            }}
          >
            {formatCL(fechaTermino) || 'dd/mm/aaaa'}
          </Text>
          <Text style={[estilos.iconoCalendario, !fechaInicio && { opacity: 0.5 }]}>📅</Text>
        </Pressable>

        {/* Aviso de rango inválido (opcional) */}
        {fechaInicio && fechaTermino && fechaTermino < fechaInicio && (
          <Text style={{ color: '#dc2626', marginLeft: '5%' }}>
            La fecha de término no puede ser anterior a la de inicio.
          </Text>
        )}

        {/* Pickers nativos */}
        {showInicio && (
          <DateTimePicker
            value={fechaInicio ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onChangeInicio}
            minimumDate={new Date(2000, 0, 1)}
          />
        )}
        {showTermino && (
          <DateTimePicker
            value={fechaTermino ?? (fechaInicio ?? new Date())}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onChangeTermino}
            minimumDate={fechaInicio ?? new Date(2000, 0, 1)}
          />
        )}

        {/* Botón */}
        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '60%' }}>
            <Pressable
              onPress={crearGrupo}
              disabled={!formValido}
              style={({ pressed }) => [
                estilos.botonCrearGrupo,
                !formValido && estilos.botonCrearGrupoDeshabilitado,
                pressed && formValido && estilos.botonCrearGrupoPresionado
              ]}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Crear</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', flex: 1 },
  label: {
    alignItems: 'flex-start',
    color: 'black',
    fontSize: 20,
    fontWeight: '600',
    marginLeft: '5%'
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    width: '90%',
    marginLeft: '5%',
    backgroundColor: '#ffffff'
  },
  inputLike: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    width: '90%',
    marginLeft: '5%',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  iconoCalendario: { fontSize: 18, marginLeft: 8 },
  botonCrearGrupo: {
    marginTop: 16,
    height: 48,
    borderRadius: 15,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center'
  },
  botonCrearGrupoDeshabilitado: {
    marginTop: 16,
    height: 48,
    borderRadius: 15,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5
  },
  botonCrearGrupoPresionado: { opacity: 0.85, transform: [{ scale: 0.99 }] }
});
