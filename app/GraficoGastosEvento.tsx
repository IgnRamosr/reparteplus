// app/GraficoGastosEvento.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, DeviceEventEmitter, Dimensions, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View, Animated, Easing, BackHandler,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import axios from "axios";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BarChart as RNCKBarChart, PieChart } from "react-native-chart-kit";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

/* ===== TS fix ===== */
type BarChartPropsFix = React.ComponentProps<typeof RNCKBarChart> & { formatYLabel?: (val: string) => string };
const BarChartFixed = RNCKBarChart as unknown as React.ComponentType<BarChartPropsFix>;

/* ===== UI ===== */
const PRIMARY = "#0EA5A4";
const PRIMARY_DARK = "#0A8E8C";
const SECONDARY = "#14B8A6";
const BG = "#F8FBFC";
const CARD = "#FFFFFF";
const INK = "#0F172A";
const TEXT_MUTED = "#6B7280";
const BORDER = "#E5E7EB";

const { width: SCREEN_W } = Dimensions.get("window");
const S = Math.min(Math.max(SCREEN_W / 390, 0.85), 1.05);
const chartWidth = Math.min(SCREEN_W - 24, 560);
const chartHeight = Math.round(200 * S);

/* ===== APIs ===== */
const apiReparto = axios.create({
  baseURL: "https://ee61hfpl8e.execute-api.us-east-1.amazonaws.com/production",
  timeout: 20000,
  headers: { "Cache-Control": "no-cache" },
});
const apiLiq = axios.create({
  baseURL: "https://amzcxtvh06.execute-api.us-east-1.amazonaws.com/production",
  timeout: 20000,
  headers: { "Cache-Control": "no-cache" },
});

/* ===== Tipos ===== */
type Grupo = { id: string; nombre: string; fecha_inicio?: string; fecha_cierre?: string; creador_nombre?: string; descripcion?: string };
type Participante = { participante_id: number; nombre: string; email?: string };
type Gasto = { id: string; descripcion: string; monto: number; moneda: string; fecha?: string; pagador_nombre: string };
type LiqRow = { participante_id: number; nombre: string; asignado_base_minima: number; pagado_base_minima: number; saldo_base_minima: number; moneda_base?: string };

/* ===== Helpers ===== */
// Fecha sin corrimiento de zona
const fmtDate = (v?: string | number | Date) => {
  if (!v) return "—";
  const s = String(v);
  const m = s.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{10,13}$/.test(s)) {
    const n = Number(s.length === 13 ? s : Number(s) * 1000);
    return new Date(n).toLocaleDateString("es-CL");
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toLocaleDateString("es-CL", { timeZone: "UTC" });
  return "—";
};
const money = (n?: number, cur = "CLP") => `${Intl.NumberFormat("es-CL").format(Math.round(Number(n || 0)))} ${cur}`;
const fmtMiles = (n: number) => Intl.NumberFormat("es-CL").format(Math.round(n));
const num = (v: any) => (v == null || v === "" || isNaN(Number(v)) ? 0 : Number(v));
const normName = (s?: string) => String(s || "—").trim();
const keyName = (s?: string) => normName(s).toLowerCase();

// <<< Tolerancia para CLP (sin decimales)
const EPS = 10;                          // <= 10 CLP se considera 0
const zeroish = (n: number) => Math.abs(n) <= EPS;

/* ===== Componente ===== */
export default function GraficoGastosEvento() {
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre?: string }>();

  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [integrantesPorGasto, setIntegrantesPorGasto] = useState<Record<string, string[]>>({});
  const [liq, setLiq] = useState<LiqRow[]>([]);
  const [monedaBase, setMonedaBase] = useState<string>("CLP");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estado, setEstado] = useState<"all" | "pagado" | "pendiente">("all");

  /* Animaciones */
  const saldosOpacity = useRef(new Animated.Value(0)).current;
  const resumenOpacity = useRef(new Animated.Value(0)).current;
  const runFade = useCallback(() => {
    const anim = (v: Animated.Value) => Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    saldosOpacity.setValue(0); resumenOpacity.setValue(0);
    Animated.stagger(120, [anim(resumenOpacity), anim(saldosOpacity)]).start();
  }, [saldosOpacity, resumenOpacity]);

  useFocusEffect(useCallback(() => {
    const onBack = () => { router.replace({ pathname: "/DetalleGrupo", params: { id, nombre } }); return true; };
    BackHandler.addEventListener("hardwareBackPress", onBack);
  }, [id, nombre]));

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const _t = Date.now();

      /* Grupo */
      try {
        const r = await apiReparto.get("/grupo", { params: { grupoId: id, _t } });
        const g = r?.data ?? {};
        setGrupo({
          id: String(id),
          nombre: g?.nombre ?? nombre ?? "Evento",
          fecha_inicio: g?.fecha_inicio,
          fecha_cierre: g?.fecha_cierre,
          creador_nombre: g?.creador_nombre ?? "—",
          descripcion: g?.descripcion ?? "Salida",
        });
      } catch {}

      /* Participantes */
      try {
        const r = await apiReparto.get("/grupo/participantes", { params: { grupoId: id, _t } });
        const arr = r?.data?.participantes ?? r?.data?.rows ?? r?.data ?? [];
        setParticipantes(
          (Array.isArray(arr) ? arr : []).map((p: any, i: number) => ({
            participante_id: Number(p.participante_id ?? p.id ?? p.usuario_id ?? i),
            nombre: normName(p.nombre ?? p.nombre_participante ?? p.participante_nombre ?? p.alias ?? p.email ?? `Participante ${i + 1}`),
            email: p?.email,
          }))
        );
      } catch {}

      /* Registro de gastos (preferir liquidados) */
      let list: any[] = [];
      try {
        const r1 = await apiReparto.get("/grupo/gastos-liquidados", { params: { grupoid: id, _t } });
        setMonedaBase(String(r1?.data?.moneda_base ?? "CLP"));
        list = r1?.data?.gastos_liquidados ?? r1?.data ?? [];
      } catch {
        try {
          const r2 = await apiReparto.get("/grupo/gastos", { params: { grupoId: id, _t } });
          list = Array.isArray(r2?.data) ? r2?.data : (r2?.data?.items ?? []);
        } catch {}
      }

          function pickDescripcion(row: any): string {
      if (!row || typeof row !== "object") return "Sin descripción";

      const keys = Object.keys(row);
      const candidates = [
        "concepto",
        "descripciongasto",
        "descripcion_gasto",
        "descripcion",
        "desc",
        "nombre_gasto",
        "nombre",
        "titulo",
        "detalle",
        "observacion",
        "item",
      ];

      const norm = (s: string) => s.toLowerCase().replace(/_/g, "");
      const map = new Map(keys.map((k) => [norm(k), k]));

      for (const c of candidates) {
        const hit = map.get(norm(c));
        if (hit) {
          const val = row[hit];
          if (val != null && String(val).trim() !== "") return String(val).trim();
        }
      }

      // Fallback “fuzzy”
      const fuzzy = keys.find((k) => /(concept|desc|titulo|detalle|nombre)/i.test(k));
      if (fuzzy && row[fuzzy] != null && String(row[fuzzy]).trim() !== "") {
        return String(row[fuzzy]).trim();
      }

      return "Sin descripción";
    }
      const gastosMap: Gasto[] = (Array.isArray(list) ? list : []).map((r: any, i: number) => ({
        id: String(r.gasto_id ?? r.id ?? i),
        descripcion: pickDescripcion(r),
        monto: num(r.monto_base_min ?? r.total_base_min ?? r.monto ?? r.total ?? 0),
        moneda: "CLP",
        fecha: r.fecha ?? r.fecha_registro ?? r.created_at,
        pagador_nombre: normName(r.pagador_nombre ?? r.nombre_pagador ?? r.pagador ?? "—"),
      }));
      setGastos(gastosMap);

      /* Integrantes por gasto */
      const detResults = await Promise.allSettled(
        gastosMap.map(async (g) => {
          const tryOne = async (base: typeof apiReparto, key: string) => {
            try { const r = await base.get("/gasto-detalle", { params: { gastoId: key, _t } }); return r?.data; } catch { return null; }
          };
          const d = (await tryOne(apiReparto, g.id)) ?? null;
          const arr =
            d?.integrantes ?? d?.participantes ?? d?.detalle ?? (Array.isArray(d) ? d : []);
          const names: string[] = Array.isArray(arr)
            ? arr.map((x: any) =>
                normName(x?.nombre ?? x?.nombre_participante ?? x?.participante_nombre ?? x?.alias ?? x?.email)
              ).filter(Boolean)
            : [];
          return { gastoId: g.id, names: names.length ? names : participantes.map((p) => p.nombre) };
        })
      );
      const mapDet: Record<string, string[]> = {};
      detResults.forEach((r) => { if (r.status === "fulfilled") mapDet[r.value.gastoId] = r.value.names; });
      setIntegrantesPorGasto(mapDet);

      /* LIQUIDACIÓN por participante (grupo) */
      try {
        const dRes = await apiLiq.get("/grupo-deudores", { params: { grupoId: id, _t } });
        const arr = dRes?.data?.deudores ?? dRes?.data ?? [];
        const parsed: LiqRow[] = (Array.isArray(arr) ? arr : []).map((r: any) => ({
          participante_id: Number(r.participante_id ?? r.id ?? 0),
          nombre: normName(r.nombre ?? r.email ?? String(r.participante_id ?? "")),
          asignado_base_minima: num(r.asignado_base_minima ?? r.asignado),
          pagado_base_minima:   num(r.pagado_base_minima   ?? r.pagado),
          saldo_base_minima:    num(r.saldo_base_minima    ?? r.saldo),
          moneda_base: r.moneda_base ?? "CLP",
        }));
        setLiq(parsed);
        if (parsed[0]?.moneda_base) setMonedaBase(parsed[0].moneda_base);
      } catch {}
    } catch {
      Alert.alert("Error", "No se pudieron cargar los datos del evento.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      runFade();
    }
  }, [id, nombre, runFade, participantes.length]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("reparte:gasto:actualizado", fetchData);
    const sub2 = DeviceEventEmitter.addListener("reparte:pago:registrado", fetchData);
    return () => { sub.remove(); sub2.remove(); };
  }, [fetchData]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  /* ===== Datos de trabajo ===== */
  const deudaPorNombre = useMemo(() => {
    const m: Record<string, number> = {};
    liq.forEach((r) => (m[keyName(r.nombre)] = r.saldo_base_minima));
    return m;
  }, [liq]);

  const tengoLiq = liq.length > 0;

  // Estado preliminar (por liquidación)
  const eventoSaldadoPre = useMemo(() => {
    if (tengoLiq) return liq.every(r => zeroish(Math.max(0, r.saldo_base_minima)));
    return Object.values(deudaPorNombre).every(v => zeroish(Math.max(0, v)));
  }, [tengoLiq, liq, deudaPorNombre]);

  const nombresGrupo = useMemo(() => {
    const set = new Set<string>();
    participantes.forEach((p) => set.add(normName(p.nombre || p.email || "—")));
    liq.forEach((r) => set.add(normName(r.nombre)));
    gastos.forEach((g) => set.add(normName(g.pagador_nombre)));
    const arr = Array.from(set);
    return arr.length ? arr : ["—"];
  }, [participantes, gastos, liq]);

  /* ===== Cálculo por gasto (agotando saldo por persona) ===== */
  type GastoCalc = { restante: number; abonadoAprox: number; deudores: string[]; cuota: number };

  const calcPorGasto: Record<string, GastoCalc> = useMemo(() => {
    const map: Record<string, GastoCalc> = {};

    // Si ya está saldado por liquidación, todo 0
    if (eventoSaldadoPre) {
      gastos.forEach((g) => {
        let integrantes = (integrantesPorGasto[g.id] ?? []).map(normName);
        if (!integrantes.length) integrantes = [...nombresGrupo];
        const pagador = normName(g.pagador_nombre);
        const deudores = integrantes.filter((n) => keyName(n) !== keyName(pagador));
        const N = Math.max(integrantes.length, 1);
        const cuota = g.monto / N;
        const target = cuota * deudores.length;
        map[g.id] = { restante: 0, abonadoAprox: target, deudores, cuota };
      });
      return map;
    }

    // Orden determinístico por fecha e id
    const parseFecha = (f?: string) => {
      if (!f) return Number.MAX_SAFE_INTEGER;
      const s = String(f);
      const ymd = /^\d{4}-\d{2}-\d{2}$/.test(s);
      const d = new Date(ymd ? `${s}T00:00:00` : s);
      return isNaN(d.getTime()) ? Number.MAX_SAFE_INTEGER : d.getTime();
    };
    const ordenados = [...gastos].sort((a, b) => parseFecha(a.fecha) - parseFecha(b.fecha) || String(a.id).localeCompare(String(b.id)));

    // Saldos remanentes mutables por persona
    const rem: Record<string, number> = {};
    const todos = new Set<string>(nombresGrupo.map(keyName));
    todos.forEach((k) => { rem[k] = Math.max(0, deudaPorNombre[k] ?? 0); });

    for (const g of ordenados) {
      let integrantes = (integrantesPorGasto[g.id] ?? []).map(normName);
      if (!integrantes.length) integrantes = [...nombresGrupo];
      const pagador = normName(g.pagador_nombre);
      const deudores = integrantes.filter((n) => keyName(n) !== keyName(pagador));
      const N = Math.max(integrantes.length, 1);
      const cuota = g.monto / N;

      let restante = 0;
      for (const n of deudores) {
        const k = keyName(n);
        // Si hay liquidación y el nombre no existe, trátalo como 0 (no inflar cuotas)
        const saldoRem = (k in rem) ? rem[k] : (tengoLiq ? 0 : undefined);
        const aporte = saldoRem == null ? cuota : Math.min(cuota, Math.max(0, saldoRem));
        restante += aporte;
        if (saldoRem != null) rem[k] = Math.max(0, (rem[k] ?? 0) - aporte); // agota
      }

      const target = cuota * deudores.length;
      const abonadoAprox = Math.max(0, target - restante);
      map[g.id] = { restante: zeroish(restante) ? 0 : restante, abonadoAprox, deudores, cuota };
    }

    return map;
  }, [gastos, integrantesPorGasto, nombresGrupo, deudaPorNombre, tengoLiq, eventoSaldadoPre]);

  /* ===== Totales del evento (globales con tolerancia) ===== */
  const totalEvento = useMemo(() => gastos.reduce((a, g) => a + g.monto, 0), [gastos]);

  const totalPendienteEvento = useMemo(() => {
    const raw = gastos.reduce((acc, g) => acc + (calcPorGasto[g.id]?.restante ?? 0), 0);
    return zeroish(raw) ? 0 : raw;
  }, [gastos, calcPorGasto]);

  const totalPagadoEvento = useMemo(
    () => Math.max(0, totalEvento - totalPendienteEvento),
    [totalEvento, totalPendienteEvento]
  );

  // Estado final (si por residuo EPS quedó en 0, también se considera saldado)
  const eventoSaldado = eventoSaldadoPre || zeroish(totalPendienteEvento);

  /* ===== Filtros para UI ===== */
  const esGastoSaldado = (g: Gasto) => {
    const rest = calcPorGasto[g.id]?.restante ?? 0;
    return eventoSaldado || zeroish(rest);
  };

  const gastosPagados = useMemo(() => gastos.filter(esGastoSaldado), [gastos, calcPorGasto, eventoSaldado]);
  const gastosPendientes = useMemo(() => gastos.filter((g) => !esGastoSaldado(g)), [gastos, calcPorGasto, eventoSaldado]);

  const filtered = useMemo(() => {
    if (estado === "pagado") return gastosPagados;
    if (estado === "pendiente") return gastosPendientes;
    return gastos;
  }, [estado, gastosPagados, gastosPendientes, gastos]);

  /* ===== Gráficas ===== */
  // Barras: en "pendiente" mostramos saldo pendiente por pagador; en otros, total del gasto por pagador
  const barAgg = useMemo(() => {
    const map = new Map<string, number>();
    if (estado === "pendiente") {
      filtered.forEach((g) => {
        const rest = calcPorGasto[g.id]?.restante ?? 0;
        map.set(g.pagador_nombre, (map.get(g.pagador_nombre) ?? 0) + rest);
      });
    } else {
      filtered.forEach((g) => {
        map.set(g.pagador_nombre, (map.get(g.pagador_nombre) ?? 0) + g.monto);
      });
    }
    return Array.from(map.entries())
      .map(([nombre, monto]) => ({ nombre, monto }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 5);
  }, [filtered, estado, calcPorGasto]);

  const barData = {
    labels: barAgg.map((x) => (x.nombre.length > 12 ? x.nombre.slice(0, 12) + "…" : x.nombre)),
    datasets: [{ data: barAgg.map((x) => x.monto) }],
  };

  const pieData = [
    { name: "Pagado",    population: totalPagadoEvento,    color: "#10B981", legendFontColor: TEXT_MUTED, legendFontSize: Math.round(11 * S) },
    { name: "Pendiente", population: totalPendienteEvento, color: "#F59E0B", legendFontColor: TEXT_MUTED, legendFontSize: Math.round(11 * S) },
  ];

  /* ===== Saldos del grupo ===== */
  type Saldo = { nombre: string; pago: number; debe: number; saldo: number };
  const saldos: Saldo[] = useMemo(() => {
    const map = new Map<string, Saldo>();
    nombresGrupo.forEach((n) => map.set(keyName(n), { nombre: n, pago: 0, debe: 0, saldo: 0 }));

    gastos.forEach((g) => {
      const k = keyName(g.pagador_nombre);
      if (!map.has(k)) map.set(k, { nombre: g.pagador_nombre, pago: 0, debe: 0, saldo: 0 });
      map.get(k)!.pago += g.monto;
    });

    nombresGrupo.forEach((n) => {
      const k = keyName(n);
      let debe = 0;
      if (!eventoSaldado) {
        const saldoGrp = tengoLiq ? Math.max(0, deudaPorNombre[k] ?? 0) : deudaPorNombre[k];
        if (saldoGrp != null) {
          debe = saldoGrp;
        } else {
          // sólo si NO hay liquidación disponible calculamos un aproximado por gasto
          gastos.forEach((g) => {
            const c = calcPorGasto[g.id];
            if (!c) return;
            if (c.deudores.find((x) => keyName(x) === k)) debe += Math.min(c.cuota, c.restante);
          });
        }
      }
      map.get(k)!.debe = zeroish(debe) ? 0 : debe;
    });

    map.forEach((s) => (s.saldo = Math.round(s.pago - s.debe)));
    return Array.from(map.values()).sort((a, b) => b.saldo - a.saldo || a.nombre.localeCompare(b.nombre));
  }, [nombresGrupo, gastos, deudaPorNombre, calcPorGasto, eventoSaldado, tengoLiq]);

  /* ===== UI ===== */
  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ color: TEXT_MUTED, marginTop: 8 }}>Cargando dashboard…</Text>
      </View>
    );

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={{ paddingBottom: 24 }}>
      {/* HERO */}
      <LinearGradient colors={[SECONDARY, PRIMARY_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Pressable onPress={() => router.replace({ pathname: "/DetalleGrupo", params: { id, nombre } })} style={styles.heroIconBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.heroBrand} numberOfLines={1}>Reparte+</Text>
          <Pressable onPress={onRefresh} style={styles.heroIconBtn} hitSlop={8}>
            <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.heroSubtitle}>Dashboard del Evento</Text>
        <Text style={styles.heroTitle} numberOfLines={1}>{grupo?.nombre ?? "Evento"}</Text>
        {!!grupo?.descripcion && <Text style={styles.heroDesc} numberOfLines={1}>{grupo.descripcion}</Text>}
        {eventoSaldado && (
          <View style={styles.heroBadgeOk}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#166534" />
            <Text style={styles.heroBadgeOkText}>Evento saldado 🎉</Text>
          </View>
        )}
      </LinearGradient>

      {/* BADGES */}
      <View style={styles.heroBadgesRow}>
        <MiniBadge icon="account" label="CREADOR" value={grupo?.creador_nombre || "—"} />
        <MiniBadge icon="calendar-start" label="INICIO" value={fmtDate(grupo?.fecha_inicio)} />
        <MiniBadge icon="calendar-end" label="TÉRMINO" value={fmtDate(grupo?.fecha_cierre)} />
      </View>

      {/* RESUMEN */}
      <Animated.View style={[styles.card, { opacity: resumenOpacity }]}>
        <Text style={styles.cardTitle}>Resumen</Text>
        <View style={styles.kpis}>
          <Kpi label="Total del evento" value={money(totalEvento, monedaBase)} icon="cash-multiple" />
          <Kpi label="Gastos filtrados" value={`${filtered.length}`} icon="filter-variant" />
          <Kpi
            label={estado === "pendiente" ? "Saldo pendiente" : estado === "pagado" ? "Monto pagado" : "Monto filtrado"}
            value={money(estado === "pendiente" ? totalPendienteEvento : estado === "pagado" ? totalPagadoEvento : filtered.reduce((a, g) => a + g.monto, 0), monedaBase)}
            icon="chart-donut"
          />
        </View>
      </Animated.View>

      {/* CONTROLES */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Controles</Text>
        <View style={styles.rowChips}>
          <Chip label="Pagados"  active={estado === "pagado"}    onPress={() => setEstado("pagado")} />
          <Chip label="Pendientes" active={estado === "pendiente"} onPress={() => setEstado("pendiente")} />
        </View>
      </View>

      {/* GRÁFICAS */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gráficas</Text>
        <Text style={styles.cardSub}>
          {estado === "pagado" ? "Total del gasto por pagador" : estado === "pendiente" ? "Saldo pendiente por pagador" : "Gastos Evento"}
        </Text>
        {barData.datasets[0].data.length > 0 ? (
          <BarChartFixed
            width={chartWidth}
            height={chartHeight}
            data={barData}
            fromZero
            segments={4}
            yLabelsOffset={8}
            showValuesOnTopOfBars
            chartConfig={{
              backgroundGradientFrom: CARD,
              backgroundGradientTo: CARD,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(14,165,164,${opacity})`,
              labelColor: () => TEXT_MUTED,
              propsForBackgroundLines: { stroke: BORDER },
            }}
            formatYLabel={(val: string) => `${fmtMiles(Number(val))} ${monedaBase}`}
            style={{ borderRadius: 12, alignSelf: "center", marginTop: 8 }}
            verticalLabelRotation={0}
            yAxisLabel={""}
            yAxisSuffix={""}
          />
        ) : (
          <Text style={styles.emptyInfo}>No hay datos suficientes.</Text>
        )}

        <Text style={[styles.cardSub, { marginTop: 12 }]}>Monto por estado</Text>
        {(totalPagadoEvento + totalPendienteEvento) > 0 ? (
          <PieChart
            data={pieData}
            width={chartWidth}
            height={180}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="16"
            absolute
            hasLegend
            chartConfig={{ color: () => PRIMARY, labelColor: () => TEXT_MUTED }}
            style={{ alignSelf: "center", marginTop: 8 }}
          />
        ) : (
          <Text style={styles.emptyInfo}>Sin montos para mostrar.</Text>
        )}
      </View>

      {/* SALDOS */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Saldos del grupo</Text>
        <Animated.View style={{ opacity: saldosOpacity }}>
          {saldos.length === 0 ? (
            <Text style={styles.emptyInfo}>No hay gastos pendientes 🎉</Text>
          ) : (
            saldos.map((s, i) => (
              <View key={s.nombre} style={[styles.saldoRow, { backgroundColor: i % 2 === 0 ? "#F9FAFB" : "#FFFFFF" }]}>
                <MaterialCommunityIcons name="account-circle" size={24} color={PRIMARY} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.saldoNombre}>{s.nombre}</Text>
                  <View style={styles.saldoLine}>
                    <Text style={[styles.saldoKV, styles.saldoPago]}>Pagó: {money(s.pago, monedaBase)}</Text>
                    <Text style={styles.saldoSep}> • </Text>
                    <Text style={[styles.saldoKV, styles.saldoDebe]}>Debe: {money(s.debe, monedaBase)}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </Animated.View>
      </View>

      {/* GASTOS */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gastos Evento</Text>
        {filtered.map((g) => {
          const c = calcPorGasto[g.id];
          const restanteCalc = c?.restante ?? 0;
          const restante = eventoSaldado ? 0 : (zeroish(restanteCalc) ? 0 : restanteCalc);
          const saldado = eventoSaldado || zeroish(restante);
          return (
            <View key={g.id} style={styles.row}>
              <MaterialCommunityIcons
                name={saldado ? "check-circle" : restante < g.monto ? "progress-clock" : "clock-outline"}
                size={18}
                color={saldado ? "#16A34A" : restante < g.monto ? "#0EA5A4" : "#F59E0B"}
                style={{ marginRight: 8 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{g.descripcion}</Text>
                <Text style={styles.rowSub}>
                  Pagador: {g.pagador_nombre} {g.fecha ? `• Fecha: ${fmtDate(g.fecha)}` : ""}
                </Text>
                {saldado ? (
                  <View style={styles.badgeOk}>
                    <Text style={styles.badgeOkText}>Gastos saldados</Text>
                  </View>
                ) : (
                  <Text style={[styles.rowSub, { marginTop: 2 }]}>Restante: {money(restante, monedaBase)}</Text>
                )}
              </View>
              <Text style={styles.rowAmount}>{money(g.monto, monedaBase)}</Text>
            </View>
          );
        })}
      </View>

      {/* Acciones */}
      <Pressable onPress={() => router.replace({ pathname: "/PagarSaldoPendiente", params: { id, nombre } })} style={styles.backBtn}>
        <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
        <Text style={styles.backBtnText}>Ir a Pagar</Text>
      </Pressable>

      <Pressable onPress={() => router.replace({ pathname: "/DetalleGrupo", params: { id, nombre } })} style={styles.backBtn}>
        <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
        <Text style={styles.backBtnText}>Volver al grupo</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ===== UI bits ===== */
const MiniBadge = ({ icon, label, value }: { icon: any; label: string; value?: string }) => (
  <View style={styles.miniBadge}>
    <View style={styles.miniIconWrap}>
      <MaterialCommunityIcons name={icon} size={16} color={PRIMARY} />
    </View>
    <Text style={styles.miniLabel}>{label}</Text>
    <Text style={styles.miniValue}>{value || "—"}</Text>
  </View>
);
const Kpi = ({ label, value, icon }: { label: string; value: string; icon: any }) => (
  <View style={styles.kpi}>
    <MaterialCommunityIcons name={icon} size={18} color={PRIMARY} />
    <Text style={styles.kpiValue}>{value}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </View>
);
function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} hitSlop={6}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/* ===== Styles ===== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  hero: { paddingTop: 14, paddingBottom: 28, paddingHorizontal: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroIconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", borderColor: "rgba(255,255,255,0.25)", borderWidth: 1 },
  heroBrand: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1, textAlign: "center", paddingHorizontal: 8 },
  heroSubtitle: { color: "rgba(255,255,255,0.9)", marginTop: 12, fontWeight: "700", textAlign: "center", paddingHorizontal: 12 },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 2, textAlign: "center", paddingHorizontal: 12 },
  heroDesc: { color: "rgba(255,255,255,0.9)", marginTop: 2, textAlign: "center", paddingHorizontal: 12 },

  heroBadgeOk: { marginTop: 10, alignSelf: "center", paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#D1FAE5", borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#A7F3D0" },
  heroBadgeOkText: { color: "#166534", fontWeight: "800", fontSize: 12 },

  heroBadgesRow: { flexDirection: "row", gap: 10, marginTop: -18, paddingHorizontal: 12 },

  miniBadge: { flex: 1, backgroundColor: CARD, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: BORDER, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, alignItems: "center" },
  miniIconWrap: { width: 28, height: 28, borderRadius: 10, backgroundColor: "#ECFEFF", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  miniLabel: { fontSize: 10, color: TEXT_MUTED, fontWeight: "700" },
  miniValue: { fontSize: 14, color: INK, fontWeight: "800", marginTop: 2 },

  card: { marginHorizontal: 12, marginTop: 12, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 10 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: INK },
  cardSub: { fontSize: 12, color: TEXT_MUTED, marginTop: 6 },
  emptyInfo: { fontSize: 13, color: TEXT_MUTED, marginTop: 8 },

  kpis: { flexDirection: "row", gap: 8, marginTop: 8 },
  kpi: { flex: 1, backgroundColor: "#FFFFFF", paddingVertical: 12, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: BORDER },
  kpiValue: { fontSize: 16, fontWeight: "800", color: INK, marginTop: 2 },
  kpiLabel: { fontSize: 11, color: TEXT_MUTED, marginTop: 2, textAlign: "center" },

  rowChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: PRIMARY, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#fff" },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { color: PRIMARY, fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#fff" },

  row: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: BORDER, paddingVertical: 10 },
  rowTitle: { color: INK, fontWeight: "800", fontSize: 15 },
  rowSub: { color: TEXT_MUTED, marginTop: 2, fontSize: 12 },
  rowAmount: { color: INK, fontWeight: "800", fontSize: 13 },

  badgeOk: { marginTop: 6, alignSelf: "flex-start", backgroundColor: "#D1FAE5", borderColor: "#A7F3D0", borderWidth: 1, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  badgeOkText: { color: "#166534", fontWeight: "800", fontSize: 11 },

  saldoRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: BORDER, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10, marginBottom: 2 },
  saldoNombre: { fontSize: 15, fontWeight: "700", color: INK },
  saldoLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 2 },
  saldoKV: { fontSize: 12, fontWeight: "700" },
  saldoPago: { color: "#16A34A" },
  saldoDebe: { color: "#EF4444" },
  saldoSep: { fontSize: 12, color: TEXT_MUTED, marginHorizontal: 4 },

  backBtn: { marginHorizontal: 12, marginTop: 16, marginBottom: 18, backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: SECONDARY },
  backBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
