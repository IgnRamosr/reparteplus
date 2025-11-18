// app/RevisionBoleta.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, Modal,
  BackHandler
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

/** Toggle global para activar/ocultar toda la UI de descuentos */
const DISCOUNTS_ENABLED = false;

/* ============================================================================
 *  MONEDAS + FORMATO
 * ============================================================================ */
const MONEDAS = [
  { codigo: 'CLP', nombre: 'Peso chileno', simbolo: '$' },
  { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: '$' },
  { codigo: 'EUR', nombre: 'Euro', simbolo: '€' },
  { codigo: 'ARS', nombre: 'Peso argentino', simbolo: '$' },
  { codigo: 'BRL', nombre: 'Real brasileño', simbolo: 'R$' },
  { codigo: 'MXN', nombre: 'Peso mexicano', simbolo: '$' },
];
const nombreMoneda = (code: string) =>
  MONEDAS.find(m => m.codigo === code)?.nombre || '';
const simboloMoneda = (code: string) =>
  MONEDAS.find(m => m.codigo === code)?.simbolo || '';

const DECIMALES_POR_MONEDA: Record<string, number> = {
  CLP: 0, JPY: 0, PYG: 0,
  USD: 2, EUR: 2, ARS: 2, BRL: 2, MXN: 2, PEN: 2, UYU: 2, BOB: 2, COP: 2,
  GBP: 2, CAD: 2, AUD: 2,
};
const decimalesDe = (codigo?: string) =>
  DECIMALES_POR_MONEDA[(codigo || 'CLP').toUpperCase()] ??
  ((codigo || '').toUpperCase() === 'CLP' ? 0 : 2);

const desdeCentavos = (cents?: number | null, moneda?: string) => {
  if (typeof cents !== 'number') return '—';
  const d = decimalesDe(moneda);
  const val = cents / Math.pow(10, d);
  return val.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
};

/** Parser robusto con punto/coma y soporte 0-decimales (CLP) */
const aCentavos = (str: string, moneda?: string) => {
  const d = decimalesDe(moneda);
  if (str == null) return 0;

  let s = String(str).trim();
  s = s.replace(/[^\d.,\-]/g, '');

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  let n: number;

  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    const decSep = lastDot > lastComma ? '.' : ',';
    const thouSep = decSep === '.' ? ',' : '.';
    s = s.split(thouSep).join('');
    s = s.replace(decSep, '.');
    n = Number(s);
  } else if (hasDot || hasComma) {
    const sep = hasDot ? '.' : ',';
    const parts = s.split(sep);
    const right = parts[1] ?? '';
    if (d === 0) {
      s = parts.join('');
      n = Number(s);
    } else {
      if (right.length > 0 && right.length <= d) {
        s = parts[0] + '.' + right;
        n = Number(s);
      } else {
        s = parts.join('');
        n = Number(s);
      }
    }
  } else {
    n = Number(s);
  }

  if (Number.isNaN(n)) return 0;
  return Math.round(n * Math.pow(10, d));
};

/** YYYY-MM-DD → dd/mm/aaaa */
const fmtFecha = (ymd?: string | null) => {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
/** dd/mm/aaaa → YYYY-MM-DD */
const aYMD = (cl: string) => {
  const parts = cl.split(/[\/\-\.]/).map(p => p.trim());
  if (parts.length !== 3) return '';
  const [dd, mm, yy] = parts;
  const y = yy.length === 2 ? `20${yy}` : yy;
  return `${y.padStart(4, '0')}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
};
/** dd/mm/aaaa → Date (fallback hoy) */
const aDate = (cl: string) => {
  try {
    const [d, m, y] = cl.split('/').map(Number);
    if (!d || !m || !y) throw new Error();
    return new Date(y, m - 1, d);
  } catch { return new Date(); }
};

/* ============================================================================
 *  TIPOS LOCALES
 * ============================================================================ */
type SplitMode = 'EQUAL' | 'QTY';

type ItemEditable = {
  name: string;
  qtyStr: string;
  unitStr: string;
  lineCents: number; // >= 0
  /** Modo de reparto: 'EQUAL' (por igual) o 'QTY' (por cantidad consumida) */
  splitMode: SplitMode;
};

type DiscountView = {
  name: string;
  lineCents: number; // negativo
  amountStr?: string;
};

type ParsedPayload = {
  parsed?: {
    vendor?: string | null;
    date?: string | null;
    currency?: string | null;
    total?: string | number | null;
  } | null;
  items_normalized?: Array<{
    name?: string;
    qty?: number;
    unit_price_cents?: number | null;
    line_total_cents?: number | null;
  }>;
  discounts_normalized?: Array<{
    name?: string;
    qty?: number;
    unit_price_cents?: number | null;
    line_total_cents?: number | null; // negativo
  }>;
  totals?: {
    sum_items_cents?: number;
    sum_discounts_cents?: number; // negativo
    net_cents?: number;
    parsed_total_cents?: number | null;
    delta_vs_parsed_cents?: number | null;
  };
  currency?: string;
  date?: string | null;
  warnings?: string[];
};

/* ============================================================================
 *  COMPONENTE SELECTOR DE MONEDA
 * ============================================================================ */
const MonedaSelector = ({
  moneda,
  onSelect
}: {
  moneda: string;
  onSelect: (codigo: string) => void;
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setModalVisible(true)}
        style={({ pressed }) => [
          styles.monedaSelectorBtn,
          pressed && styles.monedaSelectorPressed
        ]}
      >
        <View style={styles.monedaSelectorContent}>
          <View style={styles.monedaIconCircle}>
            <Text style={styles.monedaIconText}>{simboloMoneda(moneda)}</Text>
          </View>
          <View style={styles.monedaInfo}>
            <Text style={styles.monedaCodigo}>{moneda}</Text>
            <Text style={styles.monedaNombre} numberOfLines={1}>
              {nombreMoneda(moneda)}
            </Text>
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-down" size={22} color="#0EA5A4" />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Moneda</Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={10}
              >
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              {MONEDAS.map((m) => (
                <Pressable
                  key={m.codigo}
                  onPress={() => {
                    onSelect(m.codigo);
                    setModalVisible(false);
                  }}
                  style={({ pressed }) => [
                    styles.monedaOption,
                    m.codigo === moneda && styles.monedaOptionSelected,
                    pressed && styles.monedaOptionPressed
                  ]}
                >
                  <View style={styles.monedaOptionLeft}>
                    <View style={[
                      styles.monedaOptionCircle,
                      m.codigo === moneda && styles.monedaOptionCircleSelected
                    ]}>
                      <Text style={[
                        styles.monedaOptionSymbol,
                        m.codigo === moneda && styles.monedaOptionSymbolSelected
                      ]}>
                        {m.simbolo}
                      </Text>
                    </View>
                    <View style={styles.monedaOptionInfo}>
                      <Text style={[
                        styles.monedaOptionCodigo,
                        m.codigo === moneda && styles.monedaOptionCodigoSelected
                      ]}>
                        {m.codigo}
                      </Text>
                      <Text style={styles.monedaOptionNombre} numberOfLines={1}>
                        {m.nombre}
                      </Text>
                    </View>
                  </View>
                  {m.codigo === moneda && (
                    <MaterialCommunityIcons name="check-circle" size={24} color="#0EA5A4" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

/* ============================================================================
 *  COMPONENTE PRINCIPAL
 * ============================================================================ */
export default function RevisionBoleta() {
  const params = useLocalSearchParams<{ grupoId?: string; payload?: string }>();
  const grupoId = String(params?.grupoId || '');

  // Meta
  const [vendor, setVendor] = useState<string>('');
  const [fechaCL, setFechaCL] = useState<string>('');
  const [mostrarDatePicker, setMostrarDatePicker] = useState(false);
  const [moneda, setMoneda] = useState<string>('CLP');
  const [totalTexto, setTotalTexto] = useState<string>(''); // total IA (texto)

  // Ítems y (opcional) descuentos
  const [items, setItems] = useState<ItemEditable[]>([]);
  const [discounts, setDiscounts] = useState<DiscountView[]>([]);
  const [mostrarDescuentos, setMostrarDescuentos] = useState<boolean>(false);

  // Warnings
  const [warnings, setWarnings] = useState<string[]>([]);

  // Totales aportados por la Lambda (si vienen)
  const [sumItemsCentsServer, setSumItemsCentsServer] = useState<number | null>(null);
  const [sumDiscountsCentsServer, setSumDiscountsCentsServer] = useState<number | null>(null);
  const [netCentsServer, setNetCentsServer] = useState<number | null>(null);

  const goBackToGroup = useCallback(() => {
    router.back();
    return true;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', goBackToGroup);
      return () => sub.remove();
    }, [goBackToGroup])
  );

  // Carga inicial
  useEffect(() => {
    try {
      const raw: ParsedPayload = params?.payload ? JSON.parse(String(params.payload)) : {};
      const p = raw?.parsed ?? null;

      const cur = (p?.currency || raw?.currency || 'CLP') || 'CLP';
      setMoneda(String(cur).toUpperCase());
      setVendor(String(p?.vendor ?? ''));
      setFechaCL(p?.date ? fmtFecha(p?.date) : '');
      setTotalTexto(p?.total != null ? String(p.total) : '');
      setWarnings(Array.isArray(raw?.warnings) ? raw.warnings! : []);

      const itemsNorm = Array.isArray(raw?.items_normalized) ? raw.items_normalized : [];
      const discountsNorm = Array.isArray(raw?.discounts_normalized) ? raw.discounts_normalized : [];

      // Descuentos detectados (se cargarán pero no se mostrarán si el flag está en false)
      const allDiscounts: DiscountView[] = [
        ...discountsNorm
          .filter(d => typeof d?.line_total_cents === 'number' && (d!.line_total_cents as number) < 0)
          .map(d => ({ name: String(d?.name || 'Descuento'), lineCents: Number(d!.line_total_cents) })),
        ...itemsNorm
          .filter(it => typeof it?.line_total_cents === 'number' && (it!.line_total_cents as number) < 0)
          .map(it => ({ name: String(it?.name || 'Descuento'), lineCents: Number(it!.line_total_cents) })),
      ];

      // Ítems editables solo positivos
      const positivos = itemsNorm
        .filter(it => typeof it?.line_total_cents === 'number' && (it!.line_total_cents as number) > 0);

      const inicial: ItemEditable[] = (positivos.length ? positivos : itemsNorm.filter(it => (it?.line_total_cents ?? 0) >= 0))
        .map(it => {
          const qty = typeof it.qty === 'number' && !Number.isNaN(it.qty) ? it.qty : 1;
          const unitStr = desdeCentavos(it.unit_price_cents ?? 0, cur).replace(/\./g, ',');
          const qtyStr = String(qty);
          const line = (typeof it.line_total_cents === 'number'
            ? it.line_total_cents
            : qty * (it.unit_price_cents ?? 0)) || 0;
          return {
            name: String(it?.name || ''),
            qtyStr,
            unitStr,
            lineCents: Math.max(0, Number(line)),
            // Por defecto, modo "por igual"; el usuario puede cambiarlo a "QTY"
            splitMode: 'EQUAL',
          };
        });

      setItems(inicial.length > 0
        ? inicial
        : [{
          name: '',
          qtyStr: '1',
          unitStr: '0',
          lineCents: 0,
          splitMode: 'EQUAL',
        }]
      );

      setDiscounts(allDiscounts);
      setMostrarDescuentos(DISCOUNTS_ENABLED && allDiscounts.length > 0);

      // Totales del servidor (si vienen)
      setSumItemsCentsServer(
        typeof raw?.totals?.sum_items_cents === 'number' ? raw.totals!.sum_items_cents! : null
      );
      setSumDiscountsCentsServer(
        typeof raw?.totals?.sum_discounts_cents === 'number' ? raw.totals!.sum_discounts_cents! : null
      );
      setNetCentsServer(
        typeof raw?.totals?.net_cents === 'number' ? raw.totals!.net_cents! : null
      );
    } catch (e) {
      console.warn('No se pudo parsear payload en RevisionBoleta:', e);
    }
  }, [params?.payload]);

  // Recalcula suma de ítems editables
  const totalItemsCents = useMemo(
    () => items.reduce((acc, it) => acc + (it.lineCents || 0), 0),
    [items]
  );

  // Suma de descuentos (negativos)
  const totalDiscountsCentsRaw = useMemo(
    () => discounts.reduce((acc, d) => acc + (d.lineCents || 0), 0),
    [discounts]
  );

  // Si descuentos están deshabilitados, su efecto es 0
  const effectiveDiscountsCents = DISCOUNTS_ENABLED
    ? (typeof sumDiscountsCentsServer === 'number' ? sumDiscountsCentsServer : totalDiscountsCentsRaw)
    : 0;

  // Neto mostrado en UI
  const netoCents = useMemo(
    () => {
      const baseItems = (typeof sumItemsCentsServer === 'number') ? sumItemsCentsServer : totalItemsCents;
      return baseItems + effectiveDiscountsCents;
    },
    [sumItemsCentsServer, totalItemsCents, effectiveDiscountsCents]
  );

  // Total IA (texto → centavos)
  const totalIACents = useMemo(() => aCentavos(totalTexto, moneda), [totalTexto, moneda]);

  // Diferencia neto vs IA (si IA>0)
  const desfase = totalIACents > 0 ? (netoCents - totalIACents) : 0;

  // Helpers ÍTEMS
  const actualizarItem = (idx: number, patch: Partial<ItemEditable>) => {
    setItems(prev => {
      const clone = [...prev];
      const base = { ...clone[idx], ...patch };

      const qty = Number((base.qtyStr || '').replace(',', '.'));
      const qtyNum = Number.isFinite(qty) && qty > 0 ? qty : 0;
      const unitCents = aCentavos(base.unitStr || '0', moneda);

      base.lineCents = Math.max(0, Math.round(qtyNum * unitCents));
      clone[idx] = base;
      return clone;
    });
  };

  const cambiarSplitMode = (idx: number, mode: SplitMode) => {
    setItems(prev => {
      const clone = [...prev];
      const base = { ...clone[idx], splitMode: mode };
      clone[idx] = base;
      return clone;
    });
  };

  const agregarItem = () => {
    setItems(prev => [
      ...prev,
      { name: '', qtyStr: '1', unitStr: '0', lineCents: 0, splitMode: 'EQUAL' }
    ]);
  };

  const eliminarItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // (APAGADO) Helpers de descuentos permanecen por compatibilidad, no se muestran
  const agregarDescuento = () => {
    if (!DISCOUNTS_ENABLED) return;
    setDiscounts(prev => [...prev, { name: 'Descuento', lineCents: 0, amountStr: '0' }]);
    setMostrarDescuentos(true);
  };
  const actualizarDescuento = (idx: number, patch: Partial<DiscountView>) => {
    if (!DISCOUNTS_ENABLED) return;
    setDiscounts(prev => {
      const clone = [...prev];
      const base = { ...clone[idx], ...patch };
      if (patch.hasOwnProperty('amountStr')) {
        const centsPos = aCentavos(base.amountStr || '0', moneda);
        base.lineCents = -Math.max(0, centsPos);
      }
      if (patch.hasOwnProperty('lineCents') && typeof base.lineCents === 'number') {
        base.lineCents = -Math.abs(base.lineCents);
        base.amountStr = desdeCentavos(Math.abs(base.lineCents), moneda).replace(/\./g, ',');
      }
      clone[idx] = base;
      return clone;
    });
  };
  const eliminarDescuento = (idx: number) => {
    if (!DISCOUNTS_ENABLED) return;
    setDiscounts(prev => prev.filter((_, i) => i !== idx));
  };

  // Si cambia la moneda, recalcular líneas de ÍTEMS
  useEffect(() => {
    setItems(prev => prev.map(it => {
      const qty = Number((it.qtyStr || '').replace(',', '.'));
      const qtyNum = Number.isFinite(qty) && qty > 0 ? qty : 0;
      const unitCents = aCentavos(it.unitStr || '0', moneda);
      return { ...it, lineCents: Math.max(0, Math.round(qtyNum * unitCents)) };
    }));
  }, [moneda]);

  // DatePicker handlers
  const onChangeFecha = (_: DateTimePickerEvent, date?: Date) => {
    setMostrarDatePicker(false);
    if (date) {
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yy = String(date.getFullYear());
      setFechaCL(`${dd}/${mm}/${yy}`);
    }
  };

  // Continuar → enviar payload limpio (incluye splitMode por ítem)
  const continuar = () => {
    const normalizado = items.map(it => ({
      name: it.name?.trim() || 'Ítem',
      qty: Number((it.qtyStr || '0').replace(',', '.')) || 0,
      unit_price_cents: aCentavos(it.unitStr || '0', moneda),
      line_total_cents: it.lineCents || 0,
      splitMode: it.splitMode || 'EQUAL',
    }));

    const meta = {
      vendor: (vendor || '').trim(),
      date: fechaCL ? aYMD(fechaCL) : null,
      currency: (moneda || 'CLP').toUpperCase(),
      total_text: totalTexto,
      total_items_cents: totalItemsCents,
      // si está oculto, mandamos 0 para que todo cuadre visualmente
      discount_cents: DISCOUNTS_ENABLED ? Math.abs(effectiveDiscountsCents) : 0,
      totals: {
        discounts_cents: DISCOUNTS_ENABLED ? effectiveDiscountsCents : 0,
        net_cents: netoCents,
      }
    };

    router.push({
      pathname: './AsignarParticipantes',
      params: {
        grupoId,
        payload: JSON.stringify({
          parsed: meta,
          items: normalizado,
          discounts: DISCOUNTS_ENABLED ? discounts.map(d => ({ name: d.name, lineCents: d.lineCents })) : [],
          warnings
        }),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <LinearGradient
          colors={['#0EA5A4', '#14B8A6', '#10B981']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
              hitSlop={10}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.headerTitle}>Revisión de Boleta</Text>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>

        {/* Advertencias */}
        {warnings.length > 0 && (
          <View style={styles.warningCard}>
            <View style={styles.warningContent}>
              <View style={styles.warningIconBox}>
                <MaterialCommunityIcons name="alert-circle" size={22} color="#F59E0B" />
              </View>
              <View style={styles.warningTextBox}>
                <Text style={styles.warningTitle}>Advertencias del escaneo</Text>
                {warnings.map((w, i) => (
                  <Text key={i} style={styles.warningText}>• {w}</Text>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Metadatos */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBox}>
              <MaterialCommunityIcons name="receipt" size={20} color="#0EA5A4" />
            </View>
            <Text style={styles.cardTitle}>Datos de la boleta</Text>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.label}>Comercio</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="store" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                value={vendor}
                onChangeText={setVendor}
                placeholder="Ej: Supermercado Ejemplo"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.formGrid2}>
            {/* Fecha */}
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fecha</Text>
              <Pressable
                onPress={() => setMostrarDatePicker(true)}
                style={({ pressed }) => [styles.dateBtn, pressed && styles.dateBtnPressed]}
              >
                <MaterialCommunityIcons name="calendar-month" size={18} color={fechaCL ? '#0EA5A4' : '#9CA3AF'} />
                <Text style={fechaCL ? styles.dateBtnText : styles.dateBtnPlaceholder}>
                  {fechaCL || 'dd/mm/aaaa'}
                </Text>
              </Pressable>
              {mostrarDatePicker && (
                <DateTimePicker
                  value={fechaCL ? aDate(fechaCL) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={onChangeFecha}
                />
              )}
            </View>

            {/* Moneda */}
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Moneda</Text>
              <MonedaSelector moneda={moneda} onSelect={setMoneda} />
            </View>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.label}>Total</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="cash" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                value={totalTexto}
                onChangeText={setTotalTexto}
                placeholder="Ej: 12.345,67"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
          </View>
        </View>

        {/* Ítems */}
        <View style={styles.card}>
          <View style={styles.itemsHeaderRow}>
            <View>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBox}>
                  <MaterialCommunityIcons name="cart" size={20} color="#0EA5A4" />
                </View>
                <Text style={styles.cardTitle}>Ítems</Text>
              </View>
            </View>
            <Pressable
              onPress={agregarItem}
              style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
            >
              <MaterialCommunityIcons name="plus" size={18} color="#fff" />
            </Pressable>
          </View>

          {items.map((it, idx) => (
            <View key={idx} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemNumberBadge}>
                  <Text style={styles.itemNumberText}>{idx + 1}</Text>
                </View>
                <Pressable
                  onPress={() => eliminarItem(idx)}
                  style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="delete" size={18} color="#fff" />
                </Pressable>
              </View>

              <View style={styles.formRow}>
                <Text style={styles.label}>Nombre del producto</Text>
                <TextInput
                  value={it.name}
                  onChangeText={(v) => actualizarItem(idx, { name: v })}
                  placeholder="Ej: Pan integral, Leche descremada…"
                  placeholderTextColor="#9CA3AF"
                  style={styles.inputItem}
                />
              </View>

              <View style={styles.formGrid2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Cantidad</Text>
                  <TextInput
                    value={it.qtyStr}
                    onChangeText={(v) => actualizarItem(idx, { qtyStr: v })}
                    placeholder="1"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    style={styles.inputItem}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Precio unit.</Text>
                  <TextInput
                    value={it.unitStr}
                    onChangeText={(v) => actualizarItem(idx, { unitStr: v })}
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    style={styles.inputItem}
                  />
                </View>
              </View>

              {/* NUEVO: selector de modo de reparto */}
              <View style={styles.splitModeRow}>
                <View style={styles.splitModeLabelBox}>
                  <MaterialCommunityIcons name="account-multiple" size={16} color="#6B7280" />
                  <Text style={styles.splitModeLabel}>Cómo quieres repartir este ítem?</Text>
                </View>
                <View style={styles.splitModePillsRow}>
                  <Pressable
                    onPress={() => cambiarSplitMode(idx, 'EQUAL')}
                    style={({ pressed }) => [
                      styles.splitModePill,
                      it.splitMode === 'EQUAL' && styles.splitModePillActive,
                      pressed && styles.splitModePillPressed
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="scale-balance"
                      size={16}
                      color={it.splitMode === 'EQUAL' ? '#065F46' : '#6B7280'}
                    />
                    <Text style={[
                      styles.splitModePillText,
                      it.splitMode === 'EQUAL' && styles.splitModePillTextActive
                    ]}>
                      Por igual
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => cambiarSplitMode(idx, 'QTY')}
                    style={({ pressed }) => [
                      styles.splitModePill,
                      it.splitMode === 'QTY' && styles.splitModePillActiveAlt,
                      pressed && styles.splitModePillPressed
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="counter"
                      size={16}
                      color={it.splitMode === 'QTY' ? '#1D4ED8' : '#6B7280'}
                    />
                    <Text style={[
                      styles.splitModePillText,
                      it.splitMode === 'QTY' && styles.splitModePillTextActiveAlt
                    ]}>
                      Por cantidad
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.totalLineaBox}>
                <Text style={styles.totalLineaLabel}>Total línea</Text>
                <View style={styles.totalLineaBadge}>
                  <Text style={styles.totalLineaValue} numberOfLines={1} adjustsFontSizeToFit>
                    {simboloMoneda(moneda)} {desdeCentavos(it.lineCents, moneda)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Descuentos (OCULTO cuando DISCOUNTS_ENABLED = false) */}
        {DISCOUNTS_ENABLED && (
          <View style={styles.card}>
            <View style={styles.itemsHeaderRow}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBoxRed}>
                  <MaterialCommunityIcons name="sale" size={20} color="#EF4444" />
                </View>
                <Text style={styles.cardTitle}>Descuentos</Text>
              </View>
              <Pressable
                onPress={agregarDescuento}
                style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed, { backgroundColor: '#EF4444' }]}
              >
                <MaterialCommunityIcons name="plus" size={18} color="#fff" />
              </Pressable>
            </View>

            <Pressable
              onPress={() => setMostrarDescuentos(v => !v)}
              style={({ pressed }) => [styles.toggleRow, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.toggleText}>
                {mostrarDescuentos ? 'Ocultar' : 'Mostrar'} descuentos
              </Text>
              <MaterialCommunityIcons
                name={mostrarDescuentos ? 'chevron-up' : 'chevron-down'}
                size={22}
                color="#B91C1C"
              />
            </Pressable>

            {mostrarDescuentos && (
              <View style={{ marginTop: 6 }}>
                {discounts.length === 0 && (
                  <Text style={{ color: '#6B7280', fontStyle: 'italic', marginBottom: 8 }}>
                    Aún no has agregado descuentos.
                  </Text>
                )}

                {discounts.map((d, i) => (
                  <View key={i} style={styles.discountCard}>
                    <View style={styles.discountHeaderRow}>
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountBadgeText}>-{simboloMoneda(moneda)}</Text>
                      </View>

                      <Pressable
                        onPress={() => eliminarDescuento(i)}
                        style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons name="delete" size={18} color="#fff" />
                      </Pressable>
                    </View>

                    <View style={styles.formRow}>
                      <Text style={styles.label}>Nombre del descuento</Text>
                      <TextInput
                        value={d.name}
                        onChangeText={(v) => actualizarDescuento(i, { name: v })}
                        placeholder="Ej: Descuento de proveedor, Cupón…"
                        placeholderTextColor="#9CA3AF"
                        style={styles.inputItem}
                      />
                    </View>

                    <View style={styles.formGrid2}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: '#B91C1C' }]}>Monto</Text>
                        <View style={styles.inputWithLeft}>
                          <View style={styles.leftMinus}>
                            <Text style={styles.leftMinusText}>-</Text>
                          </View>
                          <TextInput
                            value={d.amountStr ?? desdeCentavos(Math.abs(d.lineCents), moneda).replace(/\./g, ',')}
                            onChangeText={(v) => actualizarDescuento(i, { amountStr: v })}
                            placeholder="0"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="decimal-pad"
                            style={[styles.inputItem, { flex: 1 }]}
                          />
                        </View>
                      </View>

                      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                        <Text style={styles.label}>Total línea</Text>
                        <View style={[styles.totalLineaBadge, { alignSelf: 'flex-end', backgroundColor: '#FEE2E2' }]}>
                          <Text style={[styles.totalLineaValue, { color: '#B91C1C' }]} numberOfLines={1} adjustsFontSizeToFit>
                            - {simboloMoneda(moneda)} {desdeCentavos(Math.abs(d.lineCents), moneda)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}

                <View style={styles.resumeDivider} />
                <View style={styles.discountRow}>
                  <Text style={[styles.discountName, { fontWeight: '800' }]}>
                    Total descuentos
                  </Text>
                  <Text style={[styles.discountValue, { fontWeight: '800' }]}>
                    - {simboloMoneda(moneda)} {desdeCentavos(Math.abs(
                      (typeof sumDiscountsCentsServer === 'number')
                        ? Math.abs(sumDiscountsCentsServer)
                        : Math.abs(totalDiscountsCentsRaw)
                    ), moneda)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Resumen */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBox}>
              <MaterialCommunityIcons name="calculator" size={20} color="#0EA5A4" />
            </View>
            <Text style={styles.cardTitle}>Resumen</Text>
          </View>

          <View style={styles.resumeBox}>
            <View style={styles.resumeRow}>
              <Text style={styles.resumeLabel}>Suma de ítems</Text>
              <Text style={styles.resumeValue} numberOfLines={1} adjustsFontSizeToFit>
                {simboloMoneda(moneda)} {desdeCentavos(
                  (typeof sumItemsCentsServer === 'number') ? sumItemsCentsServer : totalItemsCents,
                  moneda
                )}
              </Text>
            </View>

            {/* Fila de descuentos oculta si DISCOUNTS_ENABLED = false */}
            {DISCOUNTS_ENABLED && (
              <View style={styles.resumeRow}>
                <Text style={[styles.resumeLabel, { color: '#EF4444' }]}>Descuentos</Text>
                <Text style={[styles.resumeValue, { color: '#EF4444' }]} numberOfLines={1} adjustsFontSizeToFit>
                  - {simboloMoneda(moneda)} {desdeCentavos(
                    Math.abs(
                      (typeof sumDiscountsCentsServer === 'number')
                        ? Math.abs(sumDiscountsCentsServer)
                        : Math.abs(totalDiscountsCentsRaw)
                    ),
                    moneda
                  )}
                </Text>
              </View>
            )}

            <View style={styles.resumeDivider} />

            {/* Neto */}
            <View style={styles.resumeRow}>
              <Text style={[styles.resumeLabel, { fontWeight: '800', color: '#111827' }]}>Total neto</Text>
              <Text style={[styles.resumeValue, { fontWeight: '900' }]} numberOfLines={1} adjustsFontSizeToFit>
                {simboloMoneda(moneda)} {desdeCentavos(netoCents, moneda)}
              </Text>
            </View>

            {/* IA y diferencia */}
            {totalIACents > 0 && (
              <>
                <View style={styles.resumeDivider} />
                <View style={styles.resumeRow}>
                  <Text style={styles.resumeLabel}>Total (IA)</Text>
                  <Text style={styles.resumeValue} numberOfLines={1} adjustsFontSizeToFit>
                    {simboloMoneda(moneda)} {desdeCentavos(totalIACents, moneda)}
                  </Text>
                </View>

                <View style={styles.resumeDivider} />
                <View style={styles.resumeRow}>
                  <View style={styles.desfaseInfo}>
                    <MaterialCommunityIcons
                      name={desfase === 0 ? "check-circle" : "alert-circle"}
                      size={18}
                      color={desfase === 0 ? '#10B981' : '#EF4444'}
                    />
                    <Text style={[
                      styles.resumeLabel,
                      { color: desfase === 0 ? '#10B981' : '#EF4444' }
                    ]}>
                      {desfase === 0 ? 'Cuadrado ✓' : (desfase > 0 ? 'Exceso (neto > IA)' : 'Falta (neto < IA)')}
                    </Text>
                  </View>
                  <Text style={[
                    styles.resumeValue,
                    { color: desfase === 0 ? '#10B981' : '#EF4444' }
                  ]} numberOfLines={1} adjustsFontSizeToFit>
                    {desfase === 0 ? 'OK'
                      : `${simboloMoneda(moneda)} ${desdeCentavos(Math.abs(desfase), moneda)}`}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Acciones */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color="#0EA5A4" />
            <Text style={styles.secondaryBtnText}>Volver</Text>
          </Pressable>

          <Pressable
            onPress={continuar}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
          >
            <Text style={styles.primaryBtnText}>Continuar</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ============================================================================
 *  ESTILOS
 * ============================================================================ */
const PRIMARY = '#0EA5A4';
const BG = '#F3F4F6';
const CARD = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT = '#111827';
const MUTED = '#6B7280';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  btnPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },

  // Warning Card
  warningCard: {
    backgroundColor: '#FFFBEB',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    ...Platform.select({
      ios: { shadowColor: '#F59E0B', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  warningContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  warningIconBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF3C7',
    alignItems: 'center', justifyContent: 'center',
  },
  warningTextBox: { flex: 1 },
  warningTitle: { color: '#92400E', fontWeight: '800', fontSize: 14, marginBottom: 6 },
  warningText: { color: '#B45309', fontSize: 12, marginBottom: 3, lineHeight: 16 },

  // Card
  card: {
    backgroundColor: CARD, marginHorizontal: 20, marginTop: 20, padding: 20, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 3 },
    }),
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionIconBox: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#ECFDF5',
    alignItems: 'center', justifyContent: 'center',
  },
  sectionIconBoxRed: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: TEXT, letterSpacing: -0.3 },

  // Form Elements
  formRow: { marginBottom: 16 },
  formGrid2: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  label: {
    fontSize: 11, color: MUTED, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase',
  },

  // Input with icon
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 14, borderWidth: 1.5,
    borderColor: BORDER, backgroundColor: '#FAFAFA', paddingHorizontal: 14, gap: 10,
  },
  inputIcon: { marginRight: 2 },
  input: { flex: 1, color: TEXT, fontSize: 15, fontWeight: '500' },

  // Date Button
  dateBtn: {
    height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, backgroundColor: '#FAFAFA',
    paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  dateBtnPressed: { opacity: 0.8 },
  dateBtnText: { flex: 1, color: TEXT, fontSize: 15, fontWeight: '500' },
  dateBtnPlaceholder: { flex: 1, color: '#9CA3AF', fontSize: 15 },

  // Moneda Selector Button
  monedaSelectorBtn: {
    height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, backgroundColor: '#FAFAFA',
    paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  monedaSelectorPressed: { opacity: 0.8 },
  monedaSelectorContent: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  monedaIconCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  monedaIconText: { fontSize: 16, fontWeight: '700', color: PRIMARY },
  monedaInfo: { flex: 1 },
  monedaCodigo: { fontSize: 15, fontWeight: '700', color: TEXT, letterSpacing: -0.2 },
  monedaNombre: { fontSize: 12, color: MUTED, marginTop: 1 },

  // Modal Moneda
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 8 },
    }),
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: TEXT, letterSpacing: -0.3 },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  modalScroll: { maxHeight: 400 },

  // Moneda Option
  monedaOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  monedaOptionSelected: { backgroundColor: '#ECFDF5' },
  monedaOptionPressed: { opacity: 0.7 },
  monedaOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  monedaOptionCircle: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  monedaOptionCircleSelected: { backgroundColor: PRIMARY },
  monedaOptionSymbol: { fontSize: 18, fontWeight: '700', color: MUTED },
  monedaOptionSymbolSelected: { color: '#fff' },
  monedaOptionInfo: { flex: 1 },
  monedaOptionCodigo: { fontSize: 16, fontWeight: '700', color: TEXT, letterSpacing: -0.2 },
  monedaOptionCodigoSelected: { color: PRIMARY },
  monedaOptionNombre: { fontSize: 13, color: MUTED, marginTop: 2 },

  // Items Header
  itemsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  addBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  addBtnPressed: { transform: [{ scale: 0.95 }], opacity: 0.9 },

  // Item Card
  itemCard: {
    marginTop: 14, borderRadius: 16, borderWidth: 1.5, borderColor: '#E0E7FF',
    backgroundColor: '#F9FAFB', padding: 16, gap: 12,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  itemNumberBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#E0E7FF' },
  itemNumberText: { fontSize: 13, fontWeight: '800', color: '#4F46E5', letterSpacing: 0.5 },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444',
    ...Platform.select({
      ios: { shadowColor: '#EF4444', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
    }),
  },
  deleteBtnPressed: { transform: [{ scale: 0.92 }], opacity: 0.85 },

  // Input Item
  inputItem: {
    height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 12,
    backgroundColor: '#FFFFFF', color: TEXT, fontSize: 15, fontWeight: '500',
  },

  // NUEVO: modo de reparto
  splitModeRow: {
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
  },
  splitModeLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  splitModeLabel: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '700',
  },
  splitModePillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  splitModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  splitModePillActive: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  splitModePillActiveAlt: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#60A5FA',
  },
  splitModePillPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  splitModePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  splitModePillTextActive: {
    color: '#065F46',
  },
  splitModePillTextActiveAlt: {
    color: '#1D4ED8',
  },

  // Total Linea
  totalLineaBox: {
    marginTop: 4, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#E0E7FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  totalLineaLabel: { fontSize: 11, color: MUTED, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalLineaBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#ECFDF5' },
  totalLineaValue: { fontSize: 16, fontWeight: '800', color: PRIMARY, letterSpacing: -0.3 },

  // Descuentos UI
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  toggleText: { color: '#B91C1C', fontWeight: '700' },
  discountCard: { marginTop: 12, borderRadius: 16, borderWidth: 1.5, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', padding: 14 },
  discountHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  discountBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FCA5A5' },
  discountBadgeText: { color: '#7F1D1D', fontWeight: '900', letterSpacing: 0.5 },
  inputWithLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leftMinus: {
    width: 36, height: 44, borderRadius: 12, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  leftMinusText: { color: '#B91C1C', fontSize: 18, fontWeight: '900' },
  discountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  discountName: { fontSize: 14, color: '#991B1B', fontWeight: '600', maxWidth: '64%' },
  discountValue: { fontSize: 16, color: '#B91C1C', fontWeight: '800', letterSpacing: -0.2 },

  // Resume Box
  resumeBox: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER },
  resumeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  resumeDivider: { height: 1, backgroundColor: BORDER, marginVertical: 4 },
  resumeLabel: { fontSize: 14, color: MUTED, fontWeight: '600' },
  resumeValue: {
    fontSize: 17, color: TEXT, fontWeight: '800', letterSpacing: -0.3, maxWidth: '55%', textAlign: 'right',
  },
  desfaseInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Actions
  actions: { flexDirection: 'row', gap: 12, marginTop: 24, marginHorizontal: 20 },
  secondaryBtn: {
    flex: 1, height: 52, borderRadius: 16, backgroundColor: '#ECFDF5', borderWidth: 2, borderColor: '#6EE7B7',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  secondaryBtnPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  secondaryBtnText: { color: PRIMARY, fontWeight: '800', fontSize: 15, letterSpacing: -0.2 },

  primaryBtn: {
    flex: 1, height: 52, borderRadius: 16, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
    ...Platform.select({
      ios: { shadowColor: PRIMARY, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
  primaryBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: -0.2 },
});
