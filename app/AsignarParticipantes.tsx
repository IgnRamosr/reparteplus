// app/AsignarParticipantes.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert,
  Platform, Switch, TextInput, BackHandler
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import { Picker } from '@react-native-picker/picker';
import { obtenerIDparticipante } from '../lib/funcionesParticipante';

/* ============================================================================
 *  CONFIGURACIÓN DE APIS
 * ============================================================================ */
const apiGrupo = axios.create({
  baseURL: 'https://ee61hfpl8e.execute-api.us-east-1.amazonaws.com/production',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true,
});

const apiGasto = axios.create({
  baseURL: 'https://amzcxtvh06.execute-api.us-east-1.amazonaws.com/production',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true,
});

/* ============================================================================
 *  MONEDAS / FORMATO
 * ============================================================================ */
const MONEDAS = [
  { codigo: 'CLP', nombre: 'Peso chileno', decimales: 0 },
  { codigo: 'USD', nombre: 'Dólar estadounidense', decimales: 2 },
  { codigo: 'EUR', nombre: 'Euro', decimales: 2 },
  { codigo: 'ARS', nombre: 'Peso argentino', decimales: 2 },
  { codigo: 'BRL', nombre: 'Real brasileño', decimales: 2 },
  { codigo: 'MXN', nombre: 'Peso mexicano', decimales: 2 },
];
const nombreMoneda = (code: string) =>
  MONEDAS.find(m => m.codigo === code)?.nombre || '';

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
  return val.toLocaleString('es-CL', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
};

const aCentavos = (visible: string, moneda: string) => {
  const norm = visible.replace(/\./g, '').replace(',', '.').trim();
  const n = Number(norm);
  if (!Number.isFinite(n)) return 0;
  const d = decimalesDe(moneda);
  return Math.round(n * Math.pow(10, d));
};

/* ============================================================================
 *  TIPOS
 * ============================================================================ */
type SplitMode = 'EQUAL' | 'QTY';

type Participante = {
  id: number | string;
  nombre: string;
  es_creador?: boolean;
};

type ItemEntrada = {
  name: string;
  qty: number;               // cantidad total (ej: 10 bebidas)
  unit_price_cents: number;
  line_total_cents: number;
  splitMode?: SplitMode;     // 'EQUAL' | 'QTY'
};

type MetaParsed = {
  vendor?: string | null;
  date?: string | null;
  currency?: string | null;
  total_text?: string | null;
  total_items_cents?: number;
  totals?: {
    discounts_cents?: number;
    net_cents?: number | null;
  } | null;
};

type DiscountView = { name: string; lineCents: number };

type PayloadRevision = {
  parsed: MetaParsed;
  items: ItemEntrada[];
  warnings?: string[];
  discounts?: DiscountView[];
};

/* ============================================================================
 *  HELPERS IDs → número
 * ============================================================================ */
const toInt = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const mapToIntArray = (arr: Array<string | number>): number[] => {
  const out: number[] = [];
  for (const v of arr) {
    const n = toInt(v);
    if (n == null) continue;
    out.push(n);
  }
  return out;
};

/* ============================================================================
 *  VALIDACIONES
 * ============================================================================ */
function validarAsignacion({
  items,
  monedaHeader,
  monedaPorItem,
  pagadorGlobalId,
  pagadoresPorItem,
  asignaciones,
  participantes,
  descuentoCents,
  cantidades,
}: {
  items: ItemEntrada[];
  monedaHeader: string;
  monedaPorItem: Record<number, string>;
  pagadorGlobalId: string | number | null;
  pagadoresPorItem: Record<number, string | number>;
  asignaciones: Record<number, Record<string | number, boolean>>;
  participantes: Participante[];
  descuentoCents: number;
  cantidades: Record<number, Record<string | number, number>>;
}) {
  const errores: string[] = [];

  if (!items.length) {
    errores.push('• Debes agregar al menos 1 gasto.');
  }

  const totalBruto = items.reduce(
    (acc, it) => acc + (it.line_total_cents || 0),
    0
  );
  const totalNeto = Math.max(0, totalBruto - Math.abs(descuentoCents || 0));
  if (totalNeto <= 0) {
    errores.push(
      '• El total de la boleta debe ser mayor a 0.'
    );
  }

  items.forEach((it, idx) => {
    const n = idx + 1;
    const mon = (monedaPorItem[idx] || monedaHeader || 'CLP').toUpperCase();
    const line = it?.line_total_cents ?? 0;
    const mode: SplitMode = it.splitMode === 'QTY' ? 'QTY' : 'EQUAL';

    if (!mon) errores.push(`• Ítem ${n}: falta moneda.`);
    if (!Number.isFinite(line) || line <= 0) {
      errores.push(`• Ítem ${n}: el monto debe ser mayor a 0.`);
    }

    const pagador = pagadoresPorItem[idx] ?? pagadorGlobalId;
    if (pagador == null) {
      errores.push(`• Ítem ${n}: selecciona un pagador.`);
    }

    const a = asignaciones[idx] || {};
    const on = participantes
      .filter(
        p =>
          a[p.id] === true || String(p.id) === String(pagador)
      )
      .map(p => p.id);

    if (on.length === 0) {
      errores.push(
        `• Ítem ${n}: al menos un participante debe estar seleccionado.`
      );
    }

    // === Validación de cantidades consumidas SOLO si el ítem es por cantidad ===
    if (mode === 'QTY') {
      const cantItem = cantidades[idx] || {};
      const sumaCant = Object.values(cantItem).reduce(
        (acc, v) => acc + (Number(v) || 0),
        0
      );
      const qtyItem = typeof it.qty === 'number' ? it.qty : 0;

      // Debe haber al menos 1 unidad asignada
      if (sumaCant === 0) {
        errores.push(
          `• Ítem ${n}: debes asignar al menos 1 unidad consumida.`
        );
      }

      // Si se definió una cantidad total, no se puede superar
      if (qtyItem > 0 && sumaCant > qtyItem) {
        errores.push(
          `• Ítem ${n}: la suma de cantidades asignadas (${sumaCant}) no puede superar las ${qtyItem} unidad(es) ingresadas.`
        );
      }
    }
  });

  return { ok: errores.length === 0, errores };
}

/* ============================================================================
 *  COMPONENTE
 * ============================================================================ */
export default function AsignarParticipantes() {
  const params = useLocalSearchParams<{
    grupoId?: string;
    payload?: string;
    creadorId?: string;
  }>();
  const grupoId = String(params?.grupoId || '');

  const [enviando, setEnviando] = useState<boolean>(false);

  // cantidades[itemIndex][participanteId] = número de unidades consumidas
  const [cantidades, setCantidades] = useState<
    Record<number, Record<string | number, number>>
  >({});

  // Meta e ítems
  const [meta, setMeta] = useState<MetaParsed>({});
  const [monedaHeader, setMonedaHeader] = useState<string>('CLP');
  const [items, setItems] = useState<ItemEntrada[]>([]);

  // Estados per-ítem
  const [monedaPorItem, setMonedaPorItem] = useState<Record<number, string>>(
    {}
  );
  const [montoVisiblePorItem, setMontoVisiblePorItem] = useState<
    Record<number, string>
  >({});

  // Participantes y pagadores
  const [cargandoParticipantes, setCargandoParticipantes] =
    useState<boolean>(true);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [pagadorGlobalId, setPagadorGlobalId] = useState<
    string | number | null
  >(null);
  const [pagadoresPorItem, setPagadoresPorItem] = useState<
    Record<number, string | number>
  >({});

  // Asignaciones por ítem (participa / no participa)
  const [asignaciones, setAsignaciones] = useState<
    Record<number, Record<string | number, boolean>>
  >({});

  // Descuento (por ahora no se aplica en lógica de splits, pero se considera en el total)
  const [descuentoCents, setDescuentoCents] = useState<number>(0);

  /* Cargar payload inicial */
  useEffect(() => {
    try {
      const raw: PayloadRevision = params?.payload
        ? (JSON.parse(String(params.payload)) as PayloadRevision)
        : ({ parsed: {}, items: [] } as any);

      setMeta(raw.parsed || {});
      const m = ((raw.parsed?.currency as string) || 'CLP').toUpperCase();
      setMonedaHeader(m);

      // Solo ítems con monto positivo, normalizando splitMode
      const all = Array.isArray(raw.items) ? raw.items : [];
      const arr: ItemEntrada[] = all
        .filter(it => (it?.line_total_cents ?? 0) > 0)
        .map(it => ({
          ...it,
          splitMode: it.splitMode === 'QTY' ? 'QTY' : 'EQUAL',
        }));

      setItems(arr);

      // Descuentos → solo para cálculo de total (si los estás usando en backend)
      let d = 0;
      const totalsDisc = raw?.parsed?.totals?.discounts_cents;
      if (typeof totalsDisc === 'number' && Number.isFinite(totalsDisc)) {
        d = Math.abs(totalsDisc);
      } else if (Array.isArray(raw?.discounts)) {
        const sum = raw.discounts.reduce(
          (acc, x) =>
            acc +
            (typeof x?.lineCents === 'number' ? x.lineCents : 0),
          0
        );
        d = Math.abs(sum);
      } else {
        const legacy =
          (raw.parsed as any)?.discount_cents ??
          (raw.parsed as any)?.descuento_cents ??
          (raw.parsed as any)?.discount ??
          (raw.parsed as any)?.descuento ??
          0;
        const n = Number(legacy);
        if (Number.isFinite(n)) d = Math.abs(n);
      }
      setDescuentoCents(d);

      // Inicializar moneda/montos visibles
      const mp: Record<number, string> = {};
      const mv: Record<number, string> = {};
      arr.forEach((it, i) => {
        mp[i] = m;
        mv[i] = desdeCentavos(it.line_total_cents, mp[i]);
      });
      setMonedaPorItem(mp);
      setMontoVisiblePorItem(mv);
    } catch (e) {
      console.warn(
        'No se pudo parsear payload en AsignarParticipantes:',
        e
      );
      setItems([]);
      setMonedaPorItem({});
      setMontoVisiblePorItem({});
      setDescuentoCents(0);
    }
  }, [params?.payload]);

  /* Cargar participantes del grupo */
  const fetchParticipantes = useCallback(async () => {
    if (!grupoId) return;
    try {
      setCargandoParticipantes(true);

      const resp = await apiGrupo.get('/grupo-miembros', {
        params: { grupoId, grupoid: grupoId },
      });
      if (!(resp.status >= 200 && resp.status < 300)) {
        throw new Error(`GET /grupo-miembros → ${resp.status}`);
      }

      const arr: any[] = Array.isArray(resp.data?.resultados)
        ? resp.data.resultados
        : [];
      const mapped: Participante[] = arr
        .map((p: any) => ({
          id: p.participante_id ?? p.id ?? '',
          nombre: p.nombre ?? p.email ?? '—',
          es_creador: false,
        }))
        .filter(p => String(p.id).length > 0);

      setParticipantes(mapped);

      const defaultPagador =
        params?.creadorId != null
          ? params.creadorId
          : mapped[0]?.id ?? null;
      setPagadorGlobalId(defaultPagador);

      // Asignaciones ON para todos por defecto
      const inicial: Record<
        number,
        Record<string | number, boolean>
      > = {};
      items.forEach((_, idx) => {
        const base: Record<string | number, boolean> = {};
        mapped.forEach(p => {
          base[p.id] = true;
        });
        if (defaultPagador != null) base[defaultPagador] = true;
        inicial[idx] = base;
      });
      setAsignaciones(inicial);

      // Pagadores por ítem = pagador global
      const initPayers: Record<number, string | number> = {};
      items.forEach((_, idx) => {
        initPayers[idx] = defaultPagador as any;
      });
      setPagadoresPorItem(initPayers);
    } catch (e: any) {
      console.error('Error cargando participantes:', e);
      Alert.alert(
        'Error',
        e?.message || 'No se pudieron cargar los participantes.'
      );
    } finally {
      setCargandoParticipantes(false);
    }
  }, [grupoId, params?.creadorId, items.length]);

  useEffect(() => {
    fetchParticipantes();
  }, [fetchParticipantes]);

  /* Inicializar estructura de cantidades por ítem / participante */
  useEffect(() => {
    if (!items.length || !participantes.length) return;
    setCantidades(prev => {
      const next: Record<
        number,
        Record<string | number, number>
      > = { ...prev };
      items.forEach((_, idx) => {
        const prevItem = prev[idx] || {};
        const nuevoItem: Record<string | number, number> = {};
        participantes.forEach(p => {
          const prevVal = prevItem[p.id];
          nuevoItem[p.id] =
            typeof prevVal === 'number' && prevVal >= 0 ? prevVal : 0;
        });
        next[idx] = nuevoItem;
      });
      return next;
    });
  }, [items.length, participantes.length]);

  const goBackToGroup = useCallback(() => {
    router.back();
    return true;
  }, []);

  useFocusEffect(
    useCallback(() => {
      setEnviando(false);
      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        goBackToGroup
      );
      return () => sub.remove();
    }, [goBackToGroup])
  );

  /* Helpers de edición de ítems */

  const cambiarPagadorGlobal = (nuevoId: string | number) => {
    setPagadorGlobalId(nuevoId);

    setPagadoresPorItem(prev => {
      const next: Record<number, string | number> = {};
      const len = items.length;
      for (let i = 0; i < len; i++) next[i] = nuevoId;
      return next;
    });

    setAsignaciones(prev => {
      const clone: Record<
        number,
        Record<string | number, boolean>
      > = {};
      for (let i = 0; i < items.length; i++) {
        const base = { ...(prev[i] || {}) };
        base[nuevoId] = true;
        clone[i] = base;
      }
      return clone;
    });
  };

  const cambiarPagadorItem = (
    itemIndex: number,
    nuevoId: string | number
  ) => {
    setPagadoresPorItem(prev => ({ ...prev, [itemIndex]: nuevoId }));
    setAsignaciones(prev => {
      const copia = { ...(prev[itemIndex] || {}) };
      copia[nuevoId] = true;
      return { ...prev, [itemIndex]: copia };
    });
  };

  const toggleParticipa = (
    itemIndex: number,
    participanteId: string | number
  ) => {
    const pagadorDeEsteItem =
      pagadoresPorItem[itemIndex] ?? pagadorGlobalId;
    if (participanteId === pagadorDeEsteItem) return;

    setAsignaciones(prev => {
      const actual = prev[itemIndex] || {};
      const nuevoValor = !actual[participanteId];
      const next = { ...actual, [participanteId]: nuevoValor };

      const hayAlguien = Object.entries(next).some(
        ([, on]) => on === true
      );
      if (!hayAlguien && pagadorDeEsteItem != null)
        next[pagadorDeEsteItem] = true;

      // Si se desactiva, ponemos su cantidad en 0
      if (!nuevoValor) {
        setCantidades(prevCant => {
          const copia = { ...prevCant };
          const itemCant = { ...(prevCant[itemIndex] || {}) };
          itemCant[participanteId] = 0;
          copia[itemIndex] = itemCant;
          return copia;
        });
      }

      return { ...prev, [itemIndex]: next };
    });
  };

  const setAllForItem = (itemIndex: number, value: boolean) => {
    const pagadorDeEsteItem =
      pagadoresPorItem[itemIndex] ?? pagadorGlobalId;
    setAsignaciones(prev => {
      const base = { ...(prev[itemIndex] || {}) };
      participantes.forEach(p => {
        if (String(p.id) === String(pagadorDeEsteItem))
          base[p.id] = true;
        else base[p.id] = value;
      });
      return { ...prev, [itemIndex]: base };
    });

    // Si desmarcamos todos, también ponemos las cantidades en 0
    if (!value) {
      setCantidades(prevCant => {
        const copia = { ...prevCant };
        const itemCant = { ...(prevCant[itemIndex] || {}) };
        participantes.forEach(p => {
          itemCant[p.id] = 0;
        });
        copia[itemIndex] = itemCant;
        return copia;
      });
    }
  };

  const cambiarMonedaItem = (idx: number, code: string) => {
    setMonedaPorItem(p => ({ ...p, [idx]: code }));
    setMontoVisiblePorItem(v => ({
      ...v,
      [idx]: desdeCentavos(
        items[idx]?.line_total_cents ?? 0,
        code
      ),
    }));
  };

  // CLAMP: nunca permitir negativos al escribir
  const cambiarMontoVisiblePorItemSeguro = (
    idx: number,
    text: string
  ) => {
    setMontoVisiblePorItem(v => ({ ...v, [idx]: text }));
    setItems(prev => {
      const nuevo = [...prev];
      const moneda = (monedaPorItem[idx] || 'CLP').toUpperCase();
      const cents = Math.max(0, aCentavos(text, moneda));
      const base: ItemEntrada =
        nuevo[idx] || {
          name: `Ítem ${idx + 1}`,
          qty: 1,
          unit_price_cents: cents,
          line_total_cents: cents,
          splitMode: 'EQUAL',
        };
      base.line_total_cents = cents;
      base.unit_price_cents = Math.round(
        cents / Math.max(1, base.qty)
      );
      nuevo[idx] = base;
      return nuevo;
    });
  };

  const eliminarItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    setMonedaPorItem(prev => {
      const out: Record<number, string> = {};
      let k = 0;
      Object.keys(prev)
        .sort((a, b) => Number(a) - Number(b))
        .forEach((key, i) => {
          if (i !== idx) out[k++] = prev[Number(key)];
        });
      return out;
    });
    setMontoVisiblePorItem(prev => {
      const out: Record<number, string> = {};
      let k = 0;
      Object.keys(prev)
        .sort((a, b) => Number(a) - Number(b))
        .forEach((key, i) => {
          if (i !== idx) out[k++] = prev[Number(key)];
        });
      return out;
    });
    setAsignaciones(prev => {
      const out: Record<
        number,
        Record<string | number, boolean>
      > = {};
      let k = 0;
      Object.keys(prev)
        .sort((a, b) => Number(a) - Number(b))
        .forEach((key, i) => {
          if (i !== idx) out[k++] = prev[Number(key)];
        });
      return out;
    });
    setPagadoresPorItem(prev => {
      const out: Record<number, string | number> = {};
      let k = 0;
      Object.keys(prev)
        .sort((a, b) => Number(a) - Number(b))
        .forEach((key, i) => {
          if (i !== idx) out[k++] = prev[Number(key)];
        });
      return out;
    });
    setCantidades(prev => {
      const out: Record<
        number,
        Record<string | number, number>
      > = {};
      let k = 0;
      Object.keys(prev)
        .sort((a, b) => Number(a) - Number(b))
        .forEach((key, i) => {
          if (i !== idx) out[k++] = prev[Number(key)];
        });
      return out;
    });
  };

  const agregarItem = () => {
    setItems(prev => {
      const idx = prev.length;
      const monedaDefault = (monedaHeader || 'CLP').toUpperCase();

      setMonedaPorItem(p => ({ ...p, [idx]: monedaDefault }));
      setMontoVisiblePorItem(v => ({ ...v, [idx]: '0' }));

      setAsignaciones(prevA => {
        const base: Record<string | number, boolean> = {};
        participantes.forEach(p => {
          base[p.id] = true;
        });
        const pItem =
          pagadoresPorItem[idx] ?? pagadorGlobalId;
        if (pItem != null) base[pItem] = true;
        return { ...prevA, [idx]: base };
      });

      setPagadoresPorItem(prevP => ({
        ...prevP,
        [idx]: pagadorGlobalId as any,
      }));

      // inicializar cantidades del nuevo ítem en 0
      setCantidades(prevCant => ({
        ...prevCant,
        [idx]: participantes.reduce(
          (acc, p) => {
            acc[p.id] = 0;
            return acc;
          },
          {} as Record<string | number, number>
        ),
      }));

      return [
        ...prev,
        {
          name: `Ítem ${idx + 1}`,
          qty: 1,
          unit_price_cents: 0,
          line_total_cents: 0,
          splitMode: 'EQUAL',
        },
      ];
    });
  };

  const onChangeMonedaGlobal = (code: string) => {
    const newCode = String(code).toUpperCase();
    setMonedaHeader(newCode);

    setMonedaPorItem(prev => {
      const out: Record<number, string> = {};
      items.forEach((_, i) => {
        out[i] = newCode;
      });
      return out;
    });
    setMontoVisiblePorItem(() => {
      const out: Record<number, string> = {};
      items.forEach((it, i) => {
        out[i] = desdeCentavos(
          it?.line_total_cents ?? 0,
          newCode
        );
      });
      return out;
    });
  };

  /* Split equitativo (por igual) */
  const splitEquitativo = (
    lineTotalCents: number,
    participantesOn: Array<string | number>
  ) => {
    const n = participantesOn.length || 1;
    const base = Math.floor(lineTotalCents / n);
    let resto = lineTotalCents - base * n;
    return participantesOn.map((pid, idx) => ({
      participante_id: pid,
      monto_cents: base + (idx < resto ? 1 : 0),
    }));
  };

  /* Split por consumo: usa cantidades consumidas */
  const splitPorConsumo = (
    lineTotalCents: number,
    onIds: Array<string | number>,
    cantidadesItem: Record<string | number, number>
  ) => {
    const activos = onIds.map(id => String(id));
    const entries = Object.entries(cantidadesItem)
      .map(([pid, cant]) => ({
        participante_id: pid,
        cantidad: Number(cant) || 0,
      }))
      .filter(
        e =>
          e.cantidad > 0 &&
          activos.includes(String(e.participante_id))
      );

    if (entries.length === 0) return [];

    const totalCant = entries.reduce(
      (acc, e) => acc + e.cantidad,
      0
    );
    if (totalCant <= 0) return [];

    const basePerUnit = lineTotalCents / totalCant;

    const provisional = entries.map(e => {
      const raw = basePerUnit * e.cantidad;
      const base = Math.floor(raw);
      return { ...e, raw, base };
    });

    let sumBase = provisional.reduce(
      (acc, e) => acc + e.base,
      0
    );
    let resto = lineTotalCents - sumBase;

    provisional.sort(
      (a, b) =>
        b.raw - b.base - (a.raw - a.base)
    );

    const splits = provisional.map(e => ({
      participante_id: e.participante_id,
      monto_cents: e.base,
    }));

    let i = 0;
    while (resto > 0 && splits.length > 0) {
      splits[i % splits.length].monto_cents += 1;
      resto--;
      i++;
    }

    return splits;
  };

  /* Handler de cantidad consumida por participante */
  const cambiarCantidadConsumida = (
    itemIndex: number,
    participanteId: string | number,
    valorTexto: string
  ) => {
    const item = items[itemIndex];
    if (!item || item.splitMode !== 'QTY') {
      // Si el ítem no es por cantidad, ignoramos cambios.
      return;
    }

    const limpio = valorTexto.replace(/[^0-9]/g, '');
    const nuevoValor = limpio === '' ? 0 : parseInt(limpio, 10);
    if (nuevoValor < 0) return;

    const maxUnidades = item?.qty ?? 0;
    const actuales = cantidades[itemIndex] || {};

    let sumaOtros = 0;
    Object.entries(actuales).forEach(([pid, val]) => {
      if (String(pid) === String(participanteId)) return;
      sumaOtros += Number(val) || 0;
    });

    const nuevaSuma = sumaOtros + nuevoValor;
    if (maxUnidades > 0 && nuevaSuma > maxUnidades) {
      const excedente = nuevaSuma - maxUnidades;
      Alert.alert(
        'Límite de unidades',
        `Para este ítem se indicaron ${maxUnidades} unidad(es).\nTe estás pasando en ${excedente} unidad(es).`
      );
      return;
    }

    setCantidades(prev => {
      const copia = { ...prev };
      const itemCant = { ...(prev[itemIndex] || {}) };
      itemCant[participanteId] = nuevoValor;
      copia[itemIndex] = itemCant;
      return copia;
    });

    // Si se pone cantidad > 0, aseguramos que esté marcado como participante
    if (nuevoValor > 0) {
      setAsignaciones(prev => {
        const actual = prev[itemIndex] || {};
        const next = { ...actual, [participanteId]: true };
        return { ...prev, [itemIndex]: next };
      });
    }
  };

  const previewItems = useMemo(() => {
    return items.map((it, idx) => {
      const a = asignaciones[idx] || {};
      const pagadorDeEsteItem =
        pagadoresPorItem[idx] ?? pagadorGlobalId ?? null;
      const monedaItem = (
        monedaPorItem[idx] ||
        monedaHeader ||
        'CLP'
      ).toUpperCase();

      const onIds = participantes
        .filter(
          p =>
            a[p.id] === true ||
            String(p.id) === String(pagadorDeEsteItem)
        )
        .map(p => p.id);

      const cantidadesItem = cantidades[idx] || {};
      const mode: SplitMode =
        it.splitMode === 'QTY' ? 'QTY' : 'EQUAL';

      let splits;
      if (mode === 'QTY') {
        splits = splitPorConsumo(
          it.line_total_cents,
          onIds,
          cantidadesItem
        );
      } else {
        splits = splitEquitativo(it.line_total_cents, onIds);
      }

      return {
        ...it,
        participantes_on: onIds,
        splits,
        pagadorDeEsteItem,
        monedaItem,
        splitMode: mode,
      };
    });
  }, [
    items,
    asignaciones,
    participantes,
    pagadoresPorItem,
    pagadorGlobalId,
    monedaPorItem,
    monedaHeader,
    cantidades,
  ]);

  const totalBoletaCentsBruto = useMemo(
    () =>
      items.reduce(
        (acc, it) => acc + (it.line_total_cents || 0),
        0
      ),
    [items]
  );

  const totalBoletaCentsConDescuento = useMemo(() => {
    const t =
      totalBoletaCentsBruto - Math.abs(descuentoCents || 0);
    return Math.max(0, t);
  }, [totalBoletaCentsBruto, descuentoCents]);

  /* Crear en backend (con validación estricta) */
  const crearGastos = async () => {
    try {
      if (!grupoId) {
        Alert.alert('Error', 'Falta el ID del grupo.');
        return;
      }
      if (items.length === 0) {
        Alert.alert('Atención', 'Agrega al menos un gasto.');
        return;
      }

      const { ok, errores } = validarAsignacion({
        items,
        monedaHeader,
        monedaPorItem,
        pagadorGlobalId,
        pagadoresPorItem,
        asignaciones,
        participantes,
        descuentoCents,
        cantidades,
      });

      if (!ok) {
        Alert.alert('Corrige estos campos', errores.join('\n'));
        return;
      }

      if (totalBoletaCentsConDescuento <= 0) {
        Alert.alert(
          'Atención',
          'El total con descuento aplicado es 0. Agrega gastos o ajusta el descuento.'
        );
        return;
      }

      setEnviando(true);

      let creadorId: number | null = null;
      try {
        const v = await obtenerIDparticipante();
        if (Number.isFinite(Number(v))) creadorId = Number(v);
      } catch (e) {
        console.warn(
          'No se pudo obtener participante_id desde storage:',
          e
        );
      }

      const pagadorFallback = pagadorGlobalId ?? creadorId;
      const pagadorFallbackNum = toInt(pagadorFallback);
      if (!pagadorFallbackNum) {
        Alert.alert('Error', 'Debes seleccionar el pagador.');
        setEnviando(false);
        return;
      }

      const grupoIdNum = toInt(grupoId);
      if (!grupoIdNum) {
        Alert.alert('Error', 'grupo_id inválido.');
        setEnviando(false);
        return;
      }

      const payload = {
        grupo_id: grupoIdNum,
        moneda: (monedaHeader || 'CLP').toUpperCase(),
        participante_id: creadorId ?? null,
        vendor: meta.vendor ?? null,
        fecha: meta.date ?? null,
        items: items
          .map((it, idx) => {
            const a = asignaciones[idx] || {};
            const pagadorDeEsteItem = toInt(
              pagadoresPorItem[idx] ?? pagadorFallbackNum
            );
            if (!pagadorDeEsteItem) return null;

            const monedaItem = (
              monedaPorItem[idx] ||
              monedaHeader ||
              'CLP'
            ).toUpperCase();
            const onIdsRaw = participantes
              .filter(
                p =>
                  a[p.id] === true ||
                  String(p.id) === String(pagadorDeEsteItem)
              )
              .map(p => p.id);

            const cantidadesItem = cantidades[idx] || {};
            const mode: SplitMode =
              it.splitMode === 'QTY' ? 'QTY' : 'EQUAL';

            let splits;
            if (mode === 'QTY') {
              splits = splitPorConsumo(
                it.line_total_cents,
                onIdsRaw,
                cantidadesItem
              );
            } else {
              splits = splitEquitativo(
                it.line_total_cents,
                onIdsRaw
              );
            }
            if (!splits || splits.length === 0) return null;

            return {
              nombre: it.name || `Ítem ${idx + 1}`,
              total_cents: it.line_total_cents,
              moneda: monedaItem,
              pagador_id: pagadorDeEsteItem,
              participantes: splits.map(s => ({
                participante_id: toInt(s.participante_id)!,
                monto_cents: s.monto_cents,
              })),
            };
          })
          .filter(Boolean) as any[],
      };

      const resp = await apiGasto.post(
        '/gasto/multiples',
        payload
      );
      if (!(resp.status >= 200 && resp.status < 300)) {
        console.warn(
          'Respuesta backend:',
          resp.status,
          resp.data
        );
        throw new Error(
          `Error al crear gastos (${resp.status})`
        );
      }

      Alert.alert('Éxito', 'Se crearon los gastos correctamente.', [
        {
          text: 'OK',
          onPress: () =>
            router.replace({
              pathname: '/DetalleGrupo',
              params: { id: grupoId, _refresh: '1' },
            }),
        },
      ]);
    } catch (e: any) {
      console.error('crearGastos error:', e);
      Alert.alert(
        'Error',
        e?.message || 'No se pudo crear los gastos.'
      );
    } finally {
      setEnviando(false);
    }
  };

  /* Render */
  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <LinearGradient
          colors={['#0D9488', '#14B8A6', '#2DD4BF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backBtn,
                pressed && styles.btnPressed,
              ]}
              hitSlop={12}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color="#fff"
              />
            </Pressable>
            <Text style={styles.headerTitle}>
              Asignar Participantes
            </Text>
            <View style={{ width: 48 }} />
          </View>

          {items.length === 0 && (
            <View
              style={[styles.card, { alignItems: 'center' }]}
            >
              <MaterialCommunityIcons
                name="information-outline"
                size={22}
                color={MUTED}
              />
              <Text
                style={{
                  color: MUTED,
                  marginTop: 8,
                  textAlign: 'center',
                }}
              >
                No hay gastos positivos para asignar.
              </Text>
            </View>
          )}

          {/* Moneda global */}
          <View style={styles.monedaRow}>
            <View style={styles.monedaLabelContainer}>
              <MaterialCommunityIcons
                name="cash-multiple"
                size={18}
                color="#fff"
              />
              <Text style={styles.monedaLabel}>
                Moneda
              </Text>
            </View>
            <View style={styles.pickerBox}>
              <Picker
                selectedValue={(
                  monedaHeader || 'CLP'
                ).toUpperCase()}
                onValueChange={onChangeMonedaGlobal}
                dropdownIconColor="#fff"
                style={styles.picker}
                mode="dropdown"
                itemStyle={styles.pickerItem}
              >
                {MONEDAS.map(m => (
                  <Picker.Item
                    key={m.codigo}
                    label={m.codigo}
                    value={m.codigo}
                  />
                ))}
              </Picker>
            </View>
          </View>
          <View style={styles.monedaHelperContainer}>
            <MaterialCommunityIcons
              name="information-outline"
              size={14}
              color="rgba(255,255,255,0.9)"
            />
            <Text style={styles.monedaHelper}>
              {nombreMoneda(
                (monedaHeader || 'CLP').toUpperCase()
              )}
            </Text>
          </View>
        </LinearGradient>

        {/* Pagador global */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons
              name="wallet"
              size={20}
              color={PRIMARY}
            />
            <Text style={styles.cardTitle}>
              Pagador Global
            </Text>
          </View>
          {cargandoParticipantes ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color={PRIMARY}
              />
              <Text style={styles.loadingText}>
                Cargando participantes…
              </Text>
            </View>
          ) : participantes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="account-off-outline"
                size={48}
                color={MUTED}
              />
              <Text style={styles.emptyText}>
                No hay participantes en el grupo
              </Text>
            </View>
          ) : (
            <View style={styles.pillWrap}>
              {participantes.map(p => {
                const isActive =
                  String(p.id) === String(pagadorGlobalId);
                return (
                  <Pressable
                    key={String(p.id)}
                    onPress={() =>
                      cambiarPagadorGlobal(p.id)
                    }
                    style={({ pressed }) => [
                      styles.pill,
                      isActive
                        ? styles.pillActive
                        : styles.pillInactive,
                      pressed && styles.pillPressed,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        isActive
                          ? 'account-check'
                          : 'account-outline'
                      }
                      size={18}
                      color={
                        isActive ? '#065F46' : MUTED
                      }
                    />
                    <Text
                      style={[
                        styles.pillText,
                        isActive
                          ? styles.pillTextActive
                          : styles.pillTextInactive,
                      ]}
                    >
                      {p.nombre}
                    </Text>
                    {p.es_creador && (
                      <MaterialCommunityIcons
                        name="crown"
                        size={16}
                        color={
                          isActive ? '#047857' : MUTED
                        }
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Ítems */}
        {items.map((it, idx) => {
          const preview = previewItems[idx];
          const a = asignaciones[idx] || {};
          const pagadorDeEsteItem =
            pagadoresPorItem[idx] ?? pagadorGlobalId;
          const monedaItem = (
            monedaPorItem[idx] ||
            monedaHeader ||
            'CLP'
          ).toUpperCase();
          const cantidadesItem = cantidades[idx] || {};
          const mode: SplitMode =
            preview?.splitMode ||
            it.splitMode ||
            'EQUAL';
          const isQtyMode = mode === 'QTY';

          const totalCantidades = isQtyMode
            ? Object.values(cantidadesItem).reduce(
                (acc, v) =>
                  acc + (Number(v) || 0),
                0
              )
            : 0;
          const unidadesTotales = it.qty ?? 0;
          const unidadesRestantes = isQtyMode
            ? Math.max(
                unidadesTotales - totalCantidades,
                0
              )
            : 0;
          const splits = preview?.splits || [];

          return (
            <View key={idx} style={styles.card}>
              <View style={styles.itemHeaderRow}>
                <View style={styles.itemTitleContainer}>
                  <MaterialCommunityIcons
                    name="receipt"
                    size={20}
                    color={PRIMARY}
                  />
                  <Text
                    style={styles.cardTitle}
                    numberOfLines={1}
                  >
                    {it.name || `Ítem ${idx + 1}`}
                  </Text>
                </View>
                <View style={styles.itemTotalContainer}>
                  <Text style={styles.itemTotalLabel}>
                    {monedaItem}{' '}
                    {mode === 'QTY'
                      ? '· por cantidad'
                      : '· por igual'}
                  </Text>
                  <Text style={styles.itemTotal}>
                    {desdeCentavos(
                      it.line_total_cents,
                      monedaItem
                    )}
                  </Text>
                </View>
              </View>

              {/* Resumen de unidades / modo */}
              {isQtyMode ? (
                <View style={styles.itemQtyRow}>
                  <Text style={styles.itemQtyMain}>
                    Unidades totales:{' '}
                    <Text style={{ fontWeight: '800' }}>
                      {unidadesTotales || '—'}
                    </Text>
                  </Text>
                  {unidadesTotales > 0 && (
                    <Text style={styles.itemQtySecondary}>
                      Asignadas: {totalCantidades} ·
                      Restantes: {unidadesRestantes}
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.itemQtyRow}>
                  <Text style={styles.itemQtyMain}>
                    Reparto por igual entre
                    participantes seleccionados.
                  </Text>
                </View>
              )}

              {/* Controles de monto / moneda / eliminar */}
              <View style={styles.controlsRow}>
                <View style={styles.pickerBoxItem}>
                  <Picker
                    selectedValue={monedaItem}
                    onValueChange={val =>
                      cambiarMonedaItem(
                        idx,
                        String(val)
                      )
                    }
                    dropdownIconColor="#065F46"
                    style={styles.pickerItem2}
                    mode="dropdown"
                  >
                    {MONEDAS.map(m => (
                      <Picker.Item
                        key={m.codigo}
                        label={m.codigo}
                        value={m.codigo}
                      />
                    ))}
                  </Picker>
                </View>
                <View style={styles.amountBox}>
                  <Text style={styles.amountLabel}>
                    Monto
                  </Text>
                  <TextInput
                    value={
                      montoVisiblePorItem[idx] ??
                      desdeCentavos(
                        it.line_total_cents,
                        monedaItem
                      )
                    }
                    onChangeText={t =>
                      cambiarMontoVisiblePorItemSeguro(
                        idx,
                        t
                      )
                    }
                    keyboardType="decimal-pad"
                    placeholder={`0${
                      decimalesDe(monedaItem)
                        ? ',00'
                        : ''
                    }`}
                    placeholderTextColor="#94A3B8"
                    style={styles.amountInput}
                  />
                </View>
                <Pressable
                  onPress={() => eliminarItem(idx)}
                  style={({ pressed }) => [
                    styles.trashBtn,
                    pressed &&
                      styles.trashBtnPressed,
                  ]}
                  hitSlop={10}
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={22}
                    color="#DC2626"
                  />
                </Pressable>
              </View>
              <View
                style={
                  styles.monedaItemHelperContainer
                }
              >
                <MaterialCommunityIcons
                  name="information-outline"
                  size={12}
                  color="#059669"
                />
                <Text style={styles.monedaItemHelper}>
                  {nombreMoneda(monedaItem)}
                </Text>
              </View>

              {/* Pagador por ítem */}
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name="account-cash"
                  size={16}
                  color={MUTED}
                />
                <Text style={styles.sectionLabel}>
                  Pagador de este ítem
                </Text>
              </View>
              <View style={styles.pillWrap}>
                {participantes.map(p => {
                  const isActive =
                    String(p.id) ===
                    String(pagadorDeEsteItem);
                  return (
                    <Pressable
                      key={String(p.id)}
                      onPress={() =>
                        cambiarPagadorItem(idx, p.id)
                      }
                      style={({ pressed }) => [
                        styles.pillSmall,
                        isActive
                          ? styles.pillActive
                          : styles.pillInactive,
                        pressed &&
                          styles.pillPressed,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          isActive
                            ? 'account-cash'
                            : 'account-outline'
                        }
                        size={16}
                        color={
                          isActive
                            ? '#065F46'
                            : MUTED
                        }
                      />
                      <Text
                        style={[
                          styles.pillText,
                          isActive
                            ? styles.pillTextActive
                            : styles.pillTextInactive,
                        ]}
                      >
                        {p.nombre}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Marcar todos / desmarcar todos */}
              <View style={styles.selectAllRow}>
                <Pressable
                  onPress={() =>
                    setAllForItem(idx, true)
                  }
                  style={({ pressed }) => [
                    styles.smallBtn,
                    pressed &&
                      styles.smallBtnPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="check-all"
                    size={18}
                    color={PRIMARY}
                  />
                  <Text
                    style={styles.smallBtnText}
                  >
                    Marcar todos
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setAllForItem(idx, false)
                  }
                  style={({ pressed }) => [
                    styles.smallBtn,
                    styles.smallBtnSecondary,
                    pressed &&
                      styles.smallBtnPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={18}
                    color="#64748B"
                  />
                  <Text
                    style={[
                      styles.smallBtnText,
                      { color: '#64748B' },
                    ]}
                  >
                    Desmarcar todos
                  </Text>
                </Pressable>
              </View>

              {/* Título de participantes */}
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name="account-multiple"
                  size={16}
                  color={MUTED}
                />
                <Text style={styles.sectionLabel}>
                  {isQtyMode
                    ? 'Consumo por participante'
                    : 'Participantes que comparten este ítem'}
                </Text>
              </View>

              {/* Lista de participantes */}
              <View style={styles.participantesList}>
                {participantes.map(p => {
                  const checked =
                    (asignaciones[idx] || {})[p.id] ===
                      true ||
                    String(p.id) ===
                      String(pagadorDeEsteItem);
                  const esPagador =
                    String(p.id) ===
                    String(pagadorDeEsteItem);
                  const split = splits.find(
                    s =>
                      String(s.participante_id) ===
                      String(p.id)
                  );
                  const cantidadConsumida =
                    cantidadesItem[p.id] ?? 0;

                  return (
                    <View
                      key={String(p.id)}
                      style={styles.partRow}
                    >
                      <View
                        style={
                          styles.partIconContainer
                        }
                      >
                        <MaterialCommunityIcons
                          name={
                            esPagador
                              ? 'wallet'
                              : checked
                              ? 'account-check'
                              : 'account-outline'
                          }
                          size={24}
                          color={
                            checked
                              ? PRIMARY
                              : MUTED
                          }
                        />
                      </View>
                      <View style={styles.partInfo}>
                        <Text
                          style={styles.partName}
                        >
                          {p.nombre}
                        </Text>
                        {esPagador && (
                          <View
                            style={
                              styles.pagadorBadge
                            }
                          >
                            <MaterialCommunityIcons
                              name="cash"
                              size={12}
                              color="#065F46"
                            />
                            <Text
                              style={
                                styles.pagadorBadgeText
                              }
                            >
                              Pagador
                            </Text>
                          </View>
                        )}
                        {checked ? (
                          <>
                            {isQtyMode && (
                              <Text
                                style={
                                  styles.partCantidad
                                }
                              >
                                Cantidad:{' '}
                                {
                                  cantidadConsumida
                                }{' '}
                                unidad(es)
                              </Text>
                            )}
                            {split ? (
                              <Text
                                style={
                                  styles.partMonto
                                }
                              >
                                {monedaItem}{' '}
                                {desdeCentavos(
                                  split.monto_cents,
                                  monedaItem
                                )}
                              </Text>
                            ) : isQtyMode ? (
                              <Text
                                style={
                                  styles.partMontoOff
                                }
                              >
                                Asigna cantidad
                                para calcular el
                                monto
                              </Text>
                            ) : (
                              <Text
                                style={
                                  styles.partMontoOff
                                }
                              >
                                Se dividirá por
                                igual entre
                                los seleccionados
                              </Text>
                            )}
                          </>
                        ) : (
                          <Text
                            style={
                              styles.partMontoOff
                            }
                          >
                            No participa
                          </Text>
                        )}
                      </View>

                      <View style={styles.partRight}>
                        {isQtyMode && (
                          <View
                            style={styles.cantidadBox}
                          >
                            <Text
                              style={
                                styles.cantidadLabel
                              }
                            >
                              Cant.
                            </Text>
                            <TextInput
                              style={
                                styles.cantidadInput
                              }
                              keyboardType="numeric"
                              value={
                                cantidadConsumida
                                  ? String(
                                      cantidadConsumida
                                    )
                                  : ''
                              }
                              onChangeText={t =>
                                cambiarCantidadConsumida(
                                  idx,
                                  p.id,
                                  t
                                )
                              }
                              placeholder="0"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        )}
                        <Switch
                          value={checked}
                          onValueChange={() =>
                            toggleParticipa(
                              idx,
                              p.id
                            )
                          }
                          disabled={esPagador}
                          thumbColor={
                            checked
                              ? '#059669'
                              : '#F1F5F9'
                          }
                          trackColor={{
                            true: '#A7F3D0',
                            false: '#CBD5E1',
                          }}
                          style={styles.switch}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* Resumen */}
        <View
          style={[styles.card, styles.resumenCard]}
        >
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons
              name="calculator"
              size={20}
              color={PRIMARY}
            />
            <Text style={styles.cardTitle}>
              Resumen Total
            </Text>
          </View>

          <View style={styles.resumeRow}>
            <View style={styles.resumeLabelContainer}>
              <MaterialCommunityIcons
                name="receipt"
                size={18}
                color={MUTED}
              />
              <Text style={styles.resumeLabel}>
                Total bruto
              </Text>
            </View>
            <View
              style={styles.resumeValueContainer}
            >
              <Text style={styles.resumeMoneda}>
                {(monedaHeader || 'CLP').toUpperCase()}
              </Text>
              <Text style={styles.resumeValue}>
                {desdeCentavos(
                  totalBoletaCentsBruto,
                  monedaHeader
                )}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.resumeRow,
              {
                borderTopWidth: 1,
                borderTopColor: '#99F6E4',
                paddingTop: 10,
              },
            ]}
          >
            <View style={styles.resumeLabelContainer}>
              <MaterialCommunityIcons
                name="cash-check"
                size={18}
                color={MUTED}
              />
              <Text
                style={[
                  styles.resumeLabel,
                  { fontWeight: '800' },
                ]}
              >
                Total a repartir
              </Text>
            </View>
            <View
              style={styles.resumeValueContainer}
            >
              <Text style={styles.resumeMoneda}>
                {(monedaHeader || 'CLP').toUpperCase()}
              </Text>
              <Text
                style={[
                  styles.resumeValue,
                  { color: PRIMARY },
                ]}
              >
                {desdeCentavos(
                  totalBoletaCentsConDescuento,
                  monedaHeader
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* Agregar gasto */}
        <View style={styles.addItemContainer}>
          <Pressable
            onPress={agregarItem}
            style={({ pressed }) => [
              styles.addBtn,
              pressed && styles.addBtnPressed,
            ]}
          >
            <View
              style={styles.addBtnIconContainer}
            >
              <MaterialCommunityIcons
                name="plus-circle"
                size={24}
                color="#fff"
              />
            </View>
            <Text style={styles.addBtnText}>
              Agregar nuevo gasto
            </Text>
            <MaterialCommunityIcons
              name="arrow-right"
              size={20}
              color="#fff"
            />
          </Pressable>
        </View>

        {/* Acciones finales */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.secondaryBtnPressed,
            ]}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={20}
              color="#0D9488"
            />
            <Text style={styles.secondaryBtnText}>
              Volver
            </Text>
          </Pressable>

          <Pressable
            onPress={crearGastos}
            disabled={
              enviando || participantes.length === 0
            }
            style={({ pressed }) => [
              styles.primaryBtn,
              (enviando ||
                participantes.length === 0) &&
                styles.btnDisabled,
              pressed &&
                !enviando &&
                styles.primaryBtnPressed,
            ]}
          >
            {enviando ? (
              <ActivityIndicator
                color="#fff"
                size="small"
              />
            ) : (
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color="#fff"
              />
            )}
            <Text style={styles.primaryBtnText}>
              {enviando
                ? 'Creando gastos…'
                : 'Crear gastos'}
            </Text>
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
const PRIMARY = '#0D9488';
const BG = '#F8FAFC';
const CARD = '#FFFFFF';
const BORDER = '#E2E8F0';
const TEXT = '#0F172A';
const MUTED = '#64748B';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },

  header: {
    paddingTop: Platform.OS === 'ios' ? 20 : 28,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
    }),
  },
  btnPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    flex: 1,
  },

  monedaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  monedaLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monedaLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  pickerBox: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  picker: {
    color: '#fff',
    height: 56,
    fontSize: 16,
    fontWeight: '600',
    ...Platform.select({
      android: { marginTop: -8, marginBottom: -8 },
    }),
  },
  pickerItem: { fontSize: 16, height: 56, fontWeight: '600' },
  monedaHelperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 80,
    marginBottom: 12,
  },
  monedaHelper: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 12,
    fontWeight: '500',
  },

  card: {
    backgroundColor: CARD,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },

  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  loadingText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '500',
  },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '500',
  },

  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 44,
  },
  pillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    minHeight: 40,
  },
  pillInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  pillActive: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  pillPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  pillTextInactive: { color: MUTED },
  pillTextActive: { color: '#065F46' },

  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  itemTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  itemTotalContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  itemTotalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.5,
  },
  itemTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: -0.3,
  },

  itemQtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  itemQtyMain: {
    fontSize: 13,
    color: '#065F46',
    fontWeight: '700',
  },
  itemQtySecondary: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '700',
    letterSpacing: -0.1,
  },

  selectAllRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 14,
  },
  smallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    backgroundColor: '#ECFDF5',
    minHeight: 44,
  },
  smallBtnSecondary: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  smallBtnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.85,
  },
  smallBtnText: {
    color: PRIMARY,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: -0.1,
  },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  pickerBoxItem: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    backgroundColor: '#ECFDF5',
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  pickerItem2: {
    color: '#065F46',
    height: 54,
    fontSize: 15,
    fontWeight: '600',
    ...Platform.select({
      android: { marginTop: -8, marginBottom: -8 },
    }),
  },
  monedaItemHelperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  monedaItemHelper: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '500',
  },

  amountBox: {
    flex: 1.2,
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 54,
    justifyContent: 'center',
  },
  amountLabel: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
    marginBottom: 4,
  },
  amountInput: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
    padding: 0,
  },

  trashBtn: {
    width: 54,
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  trashBtnPressed: {
    backgroundColor: '#FECACA',
    transform: [{ scale: 0.95 }],
  },

  participantesList: { gap: 4 },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
  },
  partIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  partInfo: { flex: 1, gap: 2 },
  partName: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.2,
  },
  pagadorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  pagadorBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  partCantidad: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  partMonto: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  partMontoOff: {
    fontSize: 13,
    color: MUTED,
    fontStyle: 'italic',
    fontWeight: '500',
  },

  partRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cantidadBox: {
    width: 70,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
  },
  cantidadLabel: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '700',
    marginBottom: 2,
  },
  cantidadInput: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    padding: 0,
    textAlign: 'center',
    minWidth: 40,
  },

  switch: {
    marginLeft: 2,
    transform:
      Platform.OS === 'ios'
        ? [{ scaleX: 0.9 }, { scaleY: 0.9 }]
        : [],
  },

  resumenCard: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
  },
  resumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  resumeLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resumeLabel: {
    fontSize: 14,
    color: MUTED,
    fontWeight: '600',
  },
  resumeValueContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  resumeMoneda: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
    letterSpacing: 0.5,
  },
  resumeValue: {
    fontSize: 24,
    color: PRIMARY,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  addItemContainer: { marginHorizontal: 20, marginTop: 20 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    ...Platform.select({
      ios: {
        shadowColor: PRIMARY,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
    }),
  },
  addBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  addBtnIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginHorizontal: 20,
  },
  secondaryBtn: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#6EE7B7',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.85,
    backgroundColor: '#D1FAE5',
  },
  secondaryBtnText: {
    color: '#0D9488',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: -0.2,
  },

  primaryBtn: {
    flex: 1.5,
    height: 54,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: PRIMARY,
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
  },
  primaryBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.3,
  },
  btnDisabled: { backgroundColor: '#94A3B8', opacity: 0.6 },
});
