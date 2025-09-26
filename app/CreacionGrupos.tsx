import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { obtenerIDparticipante } from '@/lib/funcionesParticipante';
import { router, useLocalSearchParams } from 'expo-router';

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
  // --------- Params y modo ---------
  const params = useLocalSearchParams<{
    modo?: string;           // 'crear' | 'editar'
    id?: string;             // id del grupo cuando editas
    nombre?: string;
    descripcion?: string;
    fecha_inicio?: string;   // 'YYYY-MM-DD'
    fecha_cierre?: string;
  }>();

  const modoEdicion = (params.modo ?? '').toLowerCase() === 'editar';
  const grupoId = params.id ? String(params.id) : null;

  // --------- Estados ---------
  const [participanteId, setParticipanteId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  // precarga
  const [nombreGrupo, setNombreGrupo] = useState(params.nombre ?? '');
  const [descripcionGrupo, setDescripcionGrupo] = useState(params.descripcion ?? '');

  const [fechaInicio, setFechaInicio] = useState<Date | null>(
    params.fecha_inicio ? new Date(params.fecha_inicio) : null
  );
  const [fechaTermino, setFechaTermino] = useState<Date | null>(
    params.fecha_cierre ? new Date(params.fecha_cierre) : null
  );

  // mostrar pickers
  const [showInicio, setShowInicio] = useState(false);
  const [showTermino, setShowTermino] = useState(false);

  // cargar participante solo si estamos creando (lo necesitas para el payload de POST)
  useEffect(() => {
    if (modoEdicion) return;
    (async () => {
      const participante_id = await obtenerIDparticipante();
      setParticipanteId(participante_id);
    })();
  }, [modoEdicion]);

  // --------- Validaciones ---------
  const nombreValido = nombreGrupo.trim().length > 0;

  const formValido = useMemo(() => {
    if (!nombreValido) return false;
    if (!fechaInicio || !fechaTermino) return false;
    return fechaTermino >= fechaInicio;
  }, [nombreValido, fechaInicio, fechaTermino]);

  // --------- Handlers fechas ---------
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

  // --------- Submit unificado (crear/editar) ---------
  const onSubmit = async () => {
    if (!formValido) return;
    setEnviando(true);

    try {
      const nombreGrupoLimpio = nombreGrupo.trim();
      if (!fechaInicio || !fechaTermino) return; // guardrail

      if (modoEdicion) {
        // ================= EDITAR (PATCH /grupo con id en el body) =================
        if (!grupoId) {
          Alert.alert('Error', 'No se encontró el ID del grupo a editar.');
          return;
        }

        const updates = {
          nombre: nombreGrupoLimpio,
          descripcion: descripcionGrupo.trim(),
          fecha_inicio: toYMD(fechaInicio),
          fecha_cierre: toYMD(fechaTermino)
        };

        // respeta el casing EXACTO que espera tu backend: "grupoId"
        const body = {
          grupoId: Number(grupoId),
          updates
        };

        const resp = await api.patch('/grupo', body);

        if (resp.status >= 200 && resp.status < 300) {
          router.replace({
            pathname: '/DetalleGrupo', // ajusta si tu ruta real es '/grupos/[id]'
            params: {
              id: String(grupoId),
              nombre: updates.nombre,
              descripcion: updates.descripcion,
              fecha_inicio: updates.fecha_inicio,
              fecha_cierre: updates.fecha_cierre
            }
          } as const);
        } else {
          Alert.alert('Error', `(${resp.status}) ${resp.data?.message ?? 'No se pudo actualizar el grupo.'}`);
        }
      } else {
        // ================= CREAR (POST /grupo) =================
        const payload = {
          nombre: nombreGrupoLimpio,
          descripcion: descripcionGrupo.trim(),
          fecha_inicio: toYMD(fechaInicio),
          fecha_cierre: toYMD(fechaTermino),
          creado_por: participanteId
        };

        const resp = await api.post('/grupo', payload);

        if (resp.status >= 200 && resp.status < 300) {
          const nuevoId: number | string = resp.data?.grupoId ?? resp.data?.id;

          if (!nuevoId) {
            Alert.alert('OK', 'Grupo creado, pero no recibí el ID. Ve a la lista para verlo.');
            return;
          }

          router.replace({
            pathname: '/DetalleGrupo', // ajusta si tu ruta real es '/grupos/[id]'
            params: {
              id: String(nuevoId),
              nombre: payload.nombre,
              descripcion: payload.descripcion,
              fecha_inicio: payload.fecha_inicio,
              fecha_cierre: payload.fecha_cierre
            }
          } as const);
        } else {
          Alert.alert('Error', `(${resp.status}) ${resp.data?.message ?? 'Fallo al crear el grupo.'}`);
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Ocurrió un error. Intenta nuevamente.';
      Alert.alert('Error', msg);
    } finally {
      setEnviando(false);
    }
  };

  // --------- Render ---------
  return (
    <View style={estilos.container}>
      <View style={{ position: 'absolute', top: 0, justifyContent: 'center', margin: '10%' }}>
        <View style={{ width: '100%', flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: 'black', fontSize: 40, fontWeight: 'bold' }}>Reparte+</Text>
          <Text style={{ color: 'black', fontSize: 20, fontWeight: 'bold' }}>
            {modoEdicion ? 'Editar grupo' : 'Creación de grupos'}
          </Text>
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
        <Pressable onPress={() => setShowTermino(true)} style={estilos.inputLike}>
          <Text style={{ color: formatCL(fechaTermino) ? '#111827' : '#9ca3af' }}>
            {formatCL(fechaTermino) || 'dd/mm/aaaa'}
          </Text>
          <Text style={estilos.iconoCalendario}>📅</Text>
        </Pressable>

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
              onPress={onSubmit}
              disabled={!formValido || enviando || (!modoEdicion && participanteId == null)}
              style={({ pressed }) => [
                estilos.botonCrearGrupo,
                (!formValido || enviando || (!modoEdicion && participanteId == null)) &&
                  estilos.botonCrearGrupoDeshabilitado,
                pressed && formValido && !enviando && estilos.botonCrearGrupoPresionado
              ]}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                {enviando
                  ? modoEdicion
                    ? 'Guardando…'
                    : 'Creando…'
                  : modoEdicion
                  ? 'Guardar cambios'
                  : 'Crear'}
              </Text>
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
