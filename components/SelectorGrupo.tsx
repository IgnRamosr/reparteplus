/*// components/SelectorGrupo.tsx
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { api, GrupoUI } from '@/lib/api';
import { getGrupoIdActivo, setGrupoIdActivo } from '@/lib/grupoActivo';
import { obtenerIDparticipante } from '@/lib/funcionesParticipante';

const PRIMARY = '#0EA5A4'; const BORDER = '#E2E8F0'; const CARD = '#FFFFFF';
const TEXT_MUTED = '#64748B'; const TEXT = '#0F172A';

type Props = { onChange: (grupo: GrupoUI | null) => void; label?: string };

export default function SelectorGrupo({ onChange, label = 'Grupo' }: Props) {
  const [grupos, setGrupos] = useState<GrupoUI[]>([]);
  const [selected, setSelected] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const pid = await obtenerIDparticipante(); // 👈 viene de tus helpers
        if (pid == null) {
          setGrupos([]);
          onChange(null);
          return;
        }

        // 👇 usamos el POST /grupos con { id, tipo: 'grupo' }
        const gs = await api.listarGruposDelUsuarioPorParticipante(pid);
        setGrupos(gs);

        // restaura último grupo si existe
        const ultimo = await getGrupoIdActivo();
        const pre = ultimo && gs.some(g => g.id === ultimo) ? ultimo : gs[0]?.id;

        if (pre) {
          setSelected(pre);
          onChange(gs.find(g => g.id === pre) ?? null);
          await setGrupoIdActivo(pre);
        } else {
          setSelected(undefined);
          onChange(null);
        }
      } catch (e: any) {
        setGrupos([]);
        onChange(null);
        Alert.alert('Error', e?.message || 'No se pudieron cargar los grupos.');
      }
    })();
  }, []);

  const handleChange = async (val: string) => {
    setSelected(val);
    const g = grupos.find(x => x.id === val) ?? null;
    onChange(g);
    if (g) await setGrupoIdActivo(g.id);
  };

  return (
    <View style={{ marginTop: 6 }}>
      <Text style={estilos.label}>{label}</Text>
      <View style={estilos.pickerContainer}>
        <Picker
          enabled={grupos.length > 0}
          selectedValue={selected}
          onValueChange={handleChange}
          mode={Platform.OS === 'android' ? 'dialog' : 'dropdown'}
          dropdownIconColor={PRIMARY}
          style={estilos.picker}
        >
          {grupos.length === 0
            ? <Picker.Item label="No tienes grupos disponibles" value={undefined} />
            : grupos.map(g => <Picker.Item key={g.id} label={g.nombre} value={g.id} />)
          }
        </Picker>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  label: { color: TEXT_MUTED, fontSize: 14, fontWeight: '600', marginBottom: 6, marginLeft: 4 },
  pickerContainer: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 14, backgroundColor: CARD, paddingHorizontal: 8,
    overflow: Platform.OS === 'android' ? 'visible' : 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  picker: { width: '100%', color: TEXT, height: Platform.select({ android: 60, ios: 60 }), paddingRight: 28 },
});
/*/
