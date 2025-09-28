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
    modo?: string; id?: string; nombre?: string; descripcion?: string; fecha_inicio?: string; fecha_cierre?: string;
  }>();

  const modoEdicion = (params.modo ?? '').toLowerCase() === 'editar';
  const grupoId = params.id ? String(params.id) : null;

  // --------- Estados ---------
  const [participanteId, setParticipanteId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [nombreGrupo, setNombreGrupo] = useState(params.nombre ?? '');
  const [descripcionGrupo, setDescripcionGrupo] = useState(params.descripcion ?? '');

  const [fechaInicio, setFechaInicio] = useState<Date | null>(
    params.fecha_inicio ? new Date(params.fecha_inicio) : null
  );
  const [fechaTermino, setFechaTermino] = useState<Date | null>(
    params.fecha_cierre ? new Date(params.fecha_cierre) : null
  );

  const [showInicio, setShowInicio] = useState(false);
  const [showTermino, setShowTermino] = useState(false);

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
      if (!fechaInicio || !fechaTermino) return;

      if (modoEdicion) {
        const updates = {
          nombre: nombreGrupoLimpio,
          descripcion: descripcionGrupo.trim(),
          fecha_inicio: toYMD(fechaInicio),
          fecha_cierre: toYMD(fechaTermino)
        };

        const body = { grupoId: Number(grupoId), updates };
        const resp = await api.patch('/grupo', body);

        if (resp.status >= 200 && resp.status < 300) {
          router.replace({
            pathname: '/DetalleGrupo',
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
            pathname: '/DetalleGrupo',
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
      <View style={estilos.header}>
        <View style={estilos.headerInner}>
          <Text style={estilos.brand}>Reparte+</Text>
          <Text style={estilos.title}>{modoEdicion ? 'Editar grupo' : 'Creación de grupos'}</Text>
        </View>
      </View>

      <View style={{ width: '100%', gap: 8 }}>
        {/* Nombre */}
        <Text style={estilos.label}>Nombre del grupo</Text>
        <TextInput
          onChangeText={setNombreGrupo}
          placeholder="Ej: Viaje a Pucón"
          placeholderTextColor="#9AA3AF"
          maxLength={40}
          style={estilos.input}
          value={nombreGrupo}
        />

        {/* Descripción */}
        <Text style={estilos.label}>Descripción</Text>
        <TextInput
          onChangeText={setDescripcionGrupo}
          placeholder="Descripción del grupo"
          placeholderTextColor="#9AA3AF"
          multiline
          maxLength={200}
          style={[estilos.input, { height: 88 }]}
          value={descripcionGrupo}
        />

        {/* Fecha de inicio */}
        <Text style={estilos.label}>Fecha de inicio</Text>
        <Pressable
          onPress={() => setShowInicio(true)}
          android_ripple={{ color: 'rgba(14,165,164,0.10)' }}
          style={({ pressed }) => [estilos.inputLike, pressed && estilos.inputLikePressed]}
        >
          <Text style={{ color: formatCL(fechaInicio) ? TEXT : '#9CA3AF' }}>
            {formatCL(fechaInicio) || 'dd/mm/aaaa'}
          </Text>
          <Text style={estilos.iconoCalendario}>📅</Text>
        </Pressable>

        {/* Fecha de término */}
        <Text style={estilos.label}>Fecha de término</Text>
        <Pressable
          onPress={() => setShowTermino(true)}
          android_ripple={{ color: 'rgba(14,165,164,0.10)' }}
          style={({ pressed }) => [estilos.inputLike, pressed && estilos.inputLikePressed]}
        >
          <Text style={{ color: formatCL(fechaTermino) ? TEXT : '#9CA3AF' }}>
            {formatCL(fechaTermino) || 'dd/mm/aaaa'}
          </Text>
          <Text style={estilos.iconoCalendario}>📅</Text>
        </Pressable>

        {/* Pickers */}
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
              android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
              style={({ pressed }) => [
                estilos.btnPrimary,
                (!formValido || enviando || (!modoEdicion && participanteId == null)) && { opacity: 0.6 },
                pressed && formValido && !enviando && estilos.btnPrimaryPressed
              ]}
            >
              <Text style={estilos.btnPrimaryText}>
                {enviando ? (modoEdicion ? 'Guardando…' : 'Creando…') : (modoEdicion ? 'Guardar cambios' : 'Crear')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
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
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingVertical: 20 },
  headerInner: { width: '100%', alignItems: 'center', gap: 6 },
  brand: { color: PRIMARY, fontSize: 34, fontWeight: '800' },
  title: { color: TEXT_MUTED, fontSize: 18, fontWeight: '700' },

  label: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: '5%',
  },

  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 12,
    width: '90%',
    marginLeft: '5%',
    backgroundColor: CARD,
    height: 52,
    // sombra suave
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  inputLike: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    width: '90%',
    marginLeft: '5%',
    backgroundColor: CARD,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 52,
    // sombra suave
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  // 👇 highlight para los "inputs" de fecha
  inputLikePressed: {
    backgroundColor: '#F0FBFA',
    transform: [{ scale: 0.99 }],
  },

  iconoCalendario: { fontSize: 18, marginLeft: 8 },

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
  // 👇 highlight del botón principal
  btnPrimaryPressed: {
    backgroundColor: '#14B8A6',
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.12,
    elevation: 3,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
