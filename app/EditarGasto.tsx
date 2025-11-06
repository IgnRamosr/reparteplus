// app/EditarGasto.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';

// ===== LedgerTeal palette =====
const PRIMARY = '#0EA5A4';
const BG = '#F8FBFC';
const INK = '#0F172A';
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';
const CARD = '#FFFFFF';

// ===== Monedas (mismas que en RegistrarGasto) =====
const MONEDAS = [
  { codigo: 'CLP', nombre: 'Peso chileno', decimales: 0 },
  { codigo: 'USD', nombre: 'Dólar estadounidense', decimales: 2 },
  { codigo: 'EUR', nombre: 'Euro', decimales: 2 },
  { codigo: 'ARS', nombre: 'Peso argentino', decimales: 2 },
  { codigo: 'BRL', nombre: 'Real brasileño', decimales: 2 },
  { codigo: 'MXN', nombre: 'Peso mexicano', decimales: 2 },
];

function decimalesDe(codigo: string): number {
  const m = MONEDAS.find(x => x.codigo === codigo);
  return m ? m.decimales : (codigo === 'CLP' ? 0 : 2);
}

/** Normaliza lo que escribe el usuario respetando decimales de la moneda */
function normalizarMontoEntrada(s: string, decimales: number): string {
  let t = String(s ?? '').replace(/[^\d.,]/g, '');
  const lastComma = t.lastIndexOf(',');
  const lastDot   = t.lastIndexOf('.');
  const lastSep   = Math.max(lastComma, lastDot);

  if (lastSep >= 0) {
    const entero = t.slice(0, lastSep).replace(/[^\d]/g, '');
    const frac   = t.slice(lastSep + 1).replace(/[^\d]/g, '');
    const fracLim = decimales > 0 ? frac.slice(0, decimales) : '';
    t = decimales > 0 ? `${entero}.${fracLim}` : entero;
  } else {
    t = t.replace(/[^\d]/g, '');
  }

  if (t.startsWith('0') && !t.startsWith('0.')) {
    t = String(parseInt(t || '0', 10));
  }
  return t;
}

/** Convierte entero en unidades mínimas → string visible con decimales */
function fromUnidadesMinimas(minor: number | string, moneda: string): string {
  const d = decimalesDe(moneda);
  const n = Number(minor || 0);
  const factor = Math.pow(10, d);
  const visible = n / factor;
  return d > 0 ? visible.toFixed(d) : String(Math.round(visible));
}

// ==== API clientes ====
const apiGasto = axios.create({
  baseURL: 'https://amzcxtvh06.execute-api.us-east-1.amazonaws.com/production',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true,
});

const apiGrupo = axios.create({
  baseURL: 'https://ee61hfpl8e.execute-api.us-east-1.amazonaws.com/production',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true,
});


// Tipos mínimos
type Participante = { participante_id: number; nombre: string };

export default function EditarGasto() {
  const { nombreGrupo, grupo, gasto } =
    useLocalSearchParams<{ nombreGrupo?: string | string[]; grupo?: string | string[]; gasto?: string | string[] }>();
  const groupId = Array.isArray(grupo) ? grupo[0] : grupo ?? '';
  const gastoId = Array.isArray(gasto) ? gasto[0] : gasto ?? '';
  const nombreGrup = Array.isArray(nombreGrupo) ? nombreGrupo[0] : nombreGrupo ?? '';

  const goBackToGroup = useCallback(() => {
    const gid = String(groupId  || '');
    if (gid) {
      router.replace({ pathname: '/DetalleGrupo', params: { id: gid} });
      return true;
    }
    router.back();
    return true;
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', goBackToGroup);
      return () => sub.remove();
    }, [goBackToGroup])
  );

  // Estados
  const [concepto, setConcepto] = useState('');     // descripciongasto
  const [moneda, setMoneda] = useState('CLP');      // dropdown
  const [monto, setMonto] = useState('');           // visible (con decimales)
  const [pagadorId, setPagadorId] = useState<number | undefined>(undefined);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [cargando, setCargando] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);

  // Cargar participantes del grupo para permitir cambiar pagador
  const cargarParticipantes = useCallback(async (gid: string) => {
    if (!gid) return;
    try {
      setLoadingParticipantes(true);
      const resp = await apiGrupo.get('/grupo-miembros', { params: { grupoId: String(gid) } });
      if (resp.status >= 200 && resp.status < 300) {
        const arr: any[] = resp.data?.resultados ?? [];
        const mapped: Participante[] = arr.map(r => ({
          participante_id: Number(r.participante_id),
          nombre: String(r.nombre || r.nombre_participante || '—'),
        }));
        setParticipantes(mapped);
        if (!pagadorId && mapped.length > 0) setPagadorId(mapped[0].participante_id);
      } else {
        setParticipantes([]);
      }
    } catch {
      setParticipantes([]);
    } finally {
      setLoadingParticipantes(false);
    }
  }, [pagadorId]);

  // Precargar gasto: convertir monto minor → visible con decimales
  const precargarGasto = useCallback(async () => {
    if (!groupId || !gastoId) return;
    try {
      setCargando(true);

      // No hay GET /gasto individual, listamos y filtramos
      const resp = await apiGasto.get('/gastos', { params: { grupoId: String(groupId) } });
      if (resp.status >= 200 && resp.status < 300) {
        const arr: any[] = resp.data?.resultados ?? resp.data?.gastos ?? [];
        const fila = arr.find((r: any) => String(r.id ?? r.gasto_id) === String(gastoId));
        if (!fila) {
          Alert.alert('Atención', 'No se encontró el gasto solicitado.');
          return;
        }

        const _concepto = String(fila.concepto ?? fila.descripciongasto ?? '');
        const _moneda   = String(fila.moneda ?? 'CLP').toUpperCase();
        const _montoMinor = Number(fila.monto ?? 0); // ENTERO en DB
        const _pagadorId  = Number(fila.participantegasto_id ?? fila.pagador_id ?? 0);

        setConcepto(_concepto);
        setMoneda(_moneda);
        setMonto(fromUnidadesMinimas(_montoMinor, _moneda)); // <-- mostrar 5.00 en EUR, 5 en CLP
        if (_pagadorId > 0) setPagadorId(_pagadorId);
      } else {
        Alert.alert('Error', `No se pudo cargar el gasto. Código: ${resp.status}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo cargar el gasto.');
    } finally {
      setCargando(false);
    }
  }, [groupId, gastoId]);

  useEffect(() => {
    cargarParticipantes(String(groupId));
    precargarGasto();
  }, [cargarParticipantes, precargarGasto, groupId]);

  // Al cambiar de moneda, solo ajustamos el formato permitido de la caja de texto (no convertimos valor)
  const onChangeMoneda = (codigo: string) => {
    const dNue = decimalesDe(codigo);
    setMoneda(codigo);
    setMonto(prev => normalizarMontoEntrada(prev, dNue));
  };

  const onSubmit = async () => {
    // Validaciones
    const valorStr = normalizarMontoEntrada(monto, decimalesDe(moneda));
    const valorNum = Number(valorStr);
    if (!concepto.trim()) {
      Alert.alert('Revisa el formulario', 'Ingresa un nombre de gasto.');
      return;
    }
    if (!pagadorId) {
      Alert.alert('Revisa el formulario', 'Selecciona el pagador.');
      return;
    }
    if (!valorStr || !isFinite(valorNum) || valorNum <= 0) {
      Alert.alert('Revisa el formulario', 'Ingresa un monto válido (> 0).');
      return;
    }
    if (!moneda.trim()) {
      Alert.alert('Revisa el formulario', 'Selecciona una moneda.');
      return;
    }

    try {
      setSubmitting(true);

      // Enviamos monto VISIBLE; la Lambda lo convierte a unidades mínimas
      const resp = await apiGasto.patch('/gasto', {
        gastoId: Number(gastoId),
        updates: {
          descripciongasto: concepto.trim(),
          moneda: moneda.trim(),
          monto: valorStr, // visible (p.ej. "5.00" para EUR) -> Lambda convierte
          participantegasto_id: Number(pagadorId)
        },
      });

      if (resp.status >= 200 && resp.status < 300) {
        DeviceEventEmitter.emit('gasto:actualizado', {
          id: gastoId,
          concepto: concepto.trim(),
          pagador: participantes.find(p => p.participante_id === pagadorId)?.nombre ?? '—',
          pagado: false,
          monto: valorStr,
          moneda: moneda.trim(),
          grupo: groupId,
        });

        Alert.alert('Éxito', 'Gasto actualizado correctamente.');
        router.replace({ pathname: '/DetalleGrupo', params: { id: groupId} });
      } else {
        Alert.alert('Error', `No se pudo actualizar. Código: ${resp.status}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo conectar con el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => router.replace({ pathname: '/DetalleGrupo', params: { id: groupId} })}
          style={({ pressed }) => [s.iconBtn, pressed && s.iconPressed]}
          hitSlop={10}
          android_ripple={{ color: 'rgba(14,165,164,0.15)', borderless: true }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={INK} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={s.brand}>Reparte+</Text>
          <Text style={s.title}>Editar gasto</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Grupo (solo display) */}
      <Text style={s.label}>Grupo</Text>
      <View style={[s.select, { opacity: 0.7 }]}>
        <Text style={s.selectText}>{nombreGrup || '—'}</Text>
        <MaterialCommunityIcons name="lock" size={16} color={INK} />
      </View>

      {/* Pagador (picker editable) */}
      <Text style={s.label}>Pagador</Text>
      <View style={s.pickerWrapper}>
        {loadingParticipantes ? (
          <View style={[s.select, { justifyContent: 'center', marginBottom: 0 }]}>
            <ActivityIndicator />
          </View>
        ) : (
          <Picker
            enabled={participantes.length > 0}
            selectedValue={pagadorId}
            onValueChange={(val) => setPagadorId(Number(val))}
            style={s.picker}
            dropdownIconColor={INK}
          >
            {participantes.length === 0 ? (
              <Picker.Item label="Sin participantes" value="" color={INK} />
            ) : (
              participantes.map((p) => (
                <Picker.Item key={p.participante_id} label={p.nombre} value={p.participante_id} color={INK} />
              ))
            )}
          </Picker>
        )}
      </View>

      {/* Gasto (editable) */}
      <Text style={s.label}>Gasto</Text>
      <TextInput
        value={concepto}
        onChangeText={setConcepto}
        placeholder="Ej. Almuerzo"
        placeholderTextColor="#9AA3AF"
        style={s.input}
      />

      {/* Moneda (dropdown) */}
      <Text style={s.label}>Moneda</Text>
      <View style={s.pickerWrapper}>
        <Picker
          selectedValue={moneda}
          onValueChange={onChangeMoneda}
          style={s.picker}
          dropdownIconColor={INK}
        >
          {MONEDAS.map(m => (
            <Picker.Item key={m.codigo} label={`${m.nombre} (${m.codigo})`} value={m.codigo} color={INK} />
          ))}
        </Picker>
      </View>

      {/* Total de gasto (editable, respetando decimales de la moneda) */}
      <Text style={s.label}>Total de gasto</Text>
      <TextInput
        value={monto}
        onChangeText={(t) => setMonto(normalizarMontoEntrada(t, decimalesDe(moneda)))}
        placeholder="0"
        placeholderTextColor="#9AA3AF"
        style={[s.input, { marginBottom: 12 }]}
        keyboardType={Platform.select({ ios: 'decimal-pad', android: 'numeric' })}
        inputMode="decimal"
      />

      {/* Botón Editar */}
      <Pressable
        onPress={onSubmit}
        disabled={submitting || cargando}
        style={({ pressed }) => [
          s.primaryBtn,
          pressed && s.primaryBtnPressed,
          (submitting || cargando) && { opacity: 0.6 },
        ]}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.primaryText}>Editar</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 20, paddingTop: 40 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  brand: { fontSize: 28, fontWeight: '800', color: PRIMARY, textAlign: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: TEXT_MUTED, marginTop: 2 },

  label: { fontSize: 14, fontWeight: '700', color: TEXT_MUTED, marginTop: 14, marginBottom: 6 },

  input: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: INK,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  select: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  selectText: { fontSize: 15, color: INK },

  pickerWrapper: {
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14,
    marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1, position: 'relative',
  },
  picker: { width: '100%', color: INK, paddingVertical: 2, paddingHorizontal: 4, height: Platform.select({ ios: 54, android: 54 }) },

  iconBtn: { padding: 8, borderRadius: 12 },
  iconPressed: { backgroundColor: '#F0FBFA', transform: [{ scale: 0.97 }] },

  primaryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  primaryBtnPressed: { backgroundColor: '#14B8A6', transform: [{ scale: 0.985 }], shadowOpacity: 0.12, elevation: 3 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
