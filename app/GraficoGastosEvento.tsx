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
const PRIMARY_DARK = "#0A7E7D";
const PRIMARY_LIGHT = "#14B8A6";
const SECONDARY = "#14B8A6";
const ACCENT = "#06B6D4";
const BG = "#F1F5F9";
const CARD = "#FFFFFF";
const INK = "#0F172A";
const TEXT_MUTED = "#64748B";
const BORDER = "#E2E8F0";
const SUCCESS = "#10B981";
const WARNING = "#F59E0B";
const ERROR = "#EF4444";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const isSmallDevice = SCREEN_W < 375;
const isMediumDevice = SCREEN_W >= 375 && SCREEN_W < 768;
const isLargeDevice = SCREEN_W >= 768;

const S = Math.min(Math.max(SCREEN_W / 390, 0.85), 1.15);
const chartWidth = Math.min(SCREEN_W - (isLargeDevice ? 48 : 32), 600);
const chartHeight = Math.round(isSmallDevice ? 180 : isMediumDevice ? 220 : 240);

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

const EPS = 10;
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

  /* Animaciones mejoradas */
  const saldosOpacity = useRef(new Animated.Value(0)).current;
  const resumenOpacity = useRef(new Animated.Value(0)).current;
  const gastosOpacity = useRef(new Animated.Value(0)).current;
  const headerScale = useRef(new Animated.Value(0.95)).current;
  
  const runFade = useCallback(() => {
    const anim = (v: Animated.Value) => Animated.timing(v, { 
      toValue: 1, 
      duration: 400, 
      easing: Easing.out(Easing.cubic), 
      useNativeDriver: true 
    });
    const scaleAnim = Animated.spring(headerScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true
    });
    
    saldosOpacity.setValue(0); 
    resumenOpacity.setValue(0);
    gastosOpacity.setValue(0);
    headerScale.setValue(0.95);
    
    Animated.parallel([
      scaleAnim,
      Animated.stagger(100, [anim(resumenOpacity), anim(saldosOpacity), anim(gastosOpacity)])
    ]).start();
  }, [saldosOpacity, resumenOpacity, gastosOpacity, headerScale]);

  useFocusEffect(useCallback(() => {
    const onBack = () => { router.replace({ pathname: "/DetalleGrupo", params: { id, nombre } }); return true; };
    BackHandler.addEventListener("hardwareBackPress", onBack);
  }, [id, nombre]));

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const _t = Date.now();

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
          "concepto", "descripciongasto", "descripcion_gasto", "descripcion", "desc",
          "nombre_gasto", "nombre", "titulo", "detalle", "observacion", "item",
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

      const detResults = await Promise.allSettled(
        gastosMap.map(async (g) => {
          const tryOne = async (base: typeof apiReparto, key: string) => {
            try { const r = await base.get("/gasto-detalle", { params: { gastoId: key, _t } }); return r?.data; } catch { return null; }
          };
          const d = (await tryOne(apiReparto, g.id)) ?? null;
          const arr = d?.integrantes ?? d?.participantes ?? d?.detalle ?? (Array.isArray(d) ? d : []);
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

  type GastoCalc = { restante: number; abonadoAprox: number; deudores: string[]; cuota: number };

  const calcPorGasto: Record<string, GastoCalc> = useMemo(() => {
    const map: Record<string, GastoCalc> = {};

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

    const parseFecha = (f?: string) => {
      if (!f) return Number.MAX_SAFE_INTEGER;
      const s = String(f);
      const ymd = /^\d{4}-\d{2}-\d{2}$/.test(s);
      const d = new Date(ymd ? `${s}T00:00:00` : s);
      return isNaN(d.getTime()) ? Number.MAX_SAFE_INTEGER : d.getTime();
    };
    const ordenados = [...gastos].sort((a, b) => parseFecha(a.fecha) - parseFecha(b.fecha) || String(a.id).localeCompare(String(b.id)));

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
        const saldoRem = (k in rem) ? rem[k] : (tengoLiq ? 0 : undefined);
        const aporte = saldoRem == null ? cuota : Math.min(cuota, Math.max(0, saldoRem));
        restante += aporte;
        if (saldoRem != null) rem[k] = Math.max(0, (rem[k] ?? 0) - aporte);
      }

      const target = cuota * deudores.length;
      const abonadoAprox = Math.max(0, target - restante);
      map[g.id] = { restante: zeroish(restante) ? 0 : restante, abonadoAprox, deudores, cuota };
    }

    return map;
  }, [gastos, integrantesPorGasto, nombresGrupo, deudaPorNombre, tengoLiq, eventoSaldadoPre]);

  const totalEvento = useMemo(() => gastos.reduce((a, g) => a + g.monto, 0), [gastos]);

  const totalPendienteEvento = useMemo(() => {
    const raw = gastos.reduce((acc, g) => acc + (calcPorGasto[g.id]?.restante ?? 0), 0);
    return zeroish(raw) ? 0 : raw;
  }, [gastos, calcPorGasto]);

  const totalPagadoEvento = useMemo(
    () => Math.max(0, totalEvento - totalPendienteEvento),
    [totalEvento, totalPendienteEvento]
  );

  const eventoSaldado = eventoSaldadoPre || zeroish(totalPendienteEvento);

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
    labels: barAgg.map((x) => (x.nombre.length > (isSmallDevice ? 8 : 12) ? x.nombre.slice(0, isSmallDevice ? 8 : 12) + "…" : x.nombre)),
    datasets: [{ data: barAgg.map((x) => x.monto) }],
  };

  const pieData = [
    { name: "Pagado", population: totalPagadoEvento, color: SUCCESS, legendFontColor: TEXT_MUTED, legendFontSize: Math.round(12 * S) },
    { name: "Pendiente", population: totalPendienteEvento, color: WARNING, legendFontColor: TEXT_MUTED, legendFontSize: Math.round(12 * S) },
  ];

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
        <Text style={styles.loadingText}>Cargando dashboard…</Text>
      </View>
    );

  return (
    <ScrollView 
      style={styles.container} 
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* HERO */}
      <Animated.View style={{ transform: [{ scale: headerScale }] }}>
        <LinearGradient 
          colors={[PRIMARY_LIGHT, PRIMARY, PRIMARY_DARK]} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 1 }} 
          style={styles.hero}
        >
          <View style={styles.heroTopRow}>
            <Pressable 
              onPress={() => router.replace({ pathname: "/DetalleGrupo", params: { id, nombre } })} 
              style={styles.heroIconBtn} 
              hitSlop={12}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.heroBrand} numberOfLines={1}>Reparte+</Text>
            <Pressable onPress={onRefresh} style={styles.heroIconBtn} hitSlop={12}>
              <MaterialCommunityIcons name="refresh" size={22} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.heroSubtitle}>Dashboard del Evento</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>{grupo?.nombre ?? "Evento"}</Text>
            {!!grupo?.descripcion && <Text style={styles.heroDesc} numberOfLines={2}>{grupo.descripcion}</Text>}
          </View>
          {eventoSaldado && (
            <View style={styles.heroBadgeOk}>
              <MaterialCommunityIcons name="check-circle" size={18} color="#059669" />
              <Text style={styles.heroBadgeOkText}>Evento saldado 🎉</Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* BADGES */}
      <View style={styles.heroBadgesRow}>
        <MiniBadge icon="account" label="CREADOR" value={grupo?.creador_nombre || "—"} />
        <MiniBadge icon="calendar-start" label="INICIO" value={fmtDate(grupo?.fecha_inicio)} />
        <MiniBadge icon="calendar-end" label="TÉRMINO" value={fmtDate(grupo?.fecha_cierre)} />
      </View>

      {/* RESUMEN */}
      <Animated.View style={[styles.card, styles.cardElevated, { opacity: resumenOpacity }]}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="chart-box-outline" size={24} color={PRIMARY} />
          <Text style={styles.cardTitle}>Resumen</Text>
        </View>
        <View style={styles.kpis}>
          <Kpi label="Total del evento" value={money(totalEvento, monedaBase)} icon="cash-multiple" color={PRIMARY} />
          <Kpi label="Gastos filtrados" value={`${filtered.length}`} icon="filter-variant" color={ACCENT} />
          <Kpi
            label={estado === "pendiente" ? "Saldo pendiente" : estado === "pagado" ? "Monto pagado" : "Monto filtrado"}
            value={money(estado === "pendiente" ? totalPendienteEvento : estado === "pagado" ? totalPagadoEvento : filtered.reduce((a, g) => a + g.monto, 0), monedaBase)}
            icon="chart-donut"
            color={estado === "pendiente" ? WARNING : SUCCESS}
          />
        </View>
      </Animated.View>

      {/* CONTROLES */}
      <View style={[styles.card, styles.cardElevated]}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="tune-variant" size={24} color={PRIMARY} />
          <Text style={styles.cardTitle}>Filtros</Text>
        </View>
        <View style={styles.rowChips}>
          <Chip label="Todos" active={estado === "all"} onPress={() => setEstado("all")} icon="view-list" />
          <Chip label="Pagados" active={estado === "pagado"} onPress={() => setEstado("pagado")} icon="check-circle-outline" />
          <Chip label="Pendientes" active={estado === "pendiente"} onPress={() => setEstado("pendiente")} icon="clock-outline" />
        </View>
      </View>

      {/* GRÁFICAS */}
      <View style={[styles.card, styles.cardElevated]}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="chart-bar" size={24} color={PRIMARY} />
          <Text style={styles.cardTitle}>Análisis Visual</Text>
        </View>
        
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>
            {estado === "pagado" ? "Total del gasto por pagador" : estado === "pendiente" ? "Saldo pendiente por pagador" : "Gastos por pagador"}
          </Text>
          {barData.datasets[0].data.length > 0 ? (
            <View style={styles.chartWrapper}>
              <BarChartFixed
                width={chartWidth}
                height={chartHeight}
                data={barData}
                fromZero
                segments={4}
                yLabelsOffset={10}
                showValuesOnTopOfBars
                chartConfig={{
                  backgroundGradientFrom: CARD,
                  backgroundGradientTo: CARD,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(14,165,164,${opacity})`,
                  labelColor: () => TEXT_MUTED,
                  propsForBackgroundLines: { stroke: BORDER, strokeWidth: 1 },
                  propsForLabels: { fontSize: Math.round(11 * S) },
                }}
                formatYLabel={(val: string) => `${fmtMiles(Number(val))}`}
                style={styles.chart}
                verticalLabelRotation={0}
                yAxisLabel={""}
                yAxisSuffix={""}
              />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="chart-bar-stacked" size={48} color={BORDER} />
              <Text style={styles.emptyInfo}>No hay datos suficientes</Text>
            </View>
          )}
        </View>

        <View style={[styles.chartSection, styles.chartSectionBorder]}>
          <Text style={styles.chartTitle}>Distribución por estado</Text>
          {(totalPagadoEvento + totalPendienteEvento) > 0 ? (
            <View style={styles.chartWrapper}>
              <PieChart
                data={pieData}
                width={chartWidth}
                height={200}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="16"
                absolute
                hasLegend
                chartConfig={{ color: () => PRIMARY, labelColor: () => TEXT_MUTED }}
                style={styles.chart}
              />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="chart-pie" size={48} color={BORDER} />
              <Text style={styles.emptyInfo}>Sin montos para mostrar</Text>
            </View>
          )}
        </View>
      </View>

      {/* SALDOS */}
      <View style={[styles.card, styles.cardElevated]}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="account-cash" size={24} color={PRIMARY} />
          <Text style={styles.cardTitle}>Saldos del grupo</Text>
        </View>
        <Animated.View style={{ opacity: saldosOpacity }}>
          {saldos.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="check-all" size={48} color={SUCCESS} />
              <Text style={[styles.emptyInfo, { color: SUCCESS }]}>No hay gastos pendientes 🎉</Text>
            </View>
          ) : (
            <View style={styles.saldosContainer}>
              {saldos.map((s, i) => (
                <View key={s.nombre} style={[styles.saldoRow, i === saldos.length - 1 && styles.saldoRowLast]}>
                  <View style={styles.saldoAvatar}>
                    <MaterialCommunityIcons name="account-circle" size={28} color={PRIMARY} />
                  </View>
                  <View style={styles.saldoContent}>
                    <Text style={styles.saldoNombre} numberOfLines={1}>{s.nombre}</Text>
                    <View style={styles.saldoLine}>
                      <View style={styles.saldoItem}>
                        <MaterialCommunityIcons name="arrow-up-circle" size={14} color={SUCCESS} />
                        <Text style={[styles.saldoKV, styles.saldoPago]}>{money(s.pago, monedaBase)}</Text>
                      </View>
                      <View style={styles.saldoSep} />
                      <View style={styles.saldoItem}>
                        <MaterialCommunityIcons name="arrow-down-circle" size={14} color={ERROR} />
                        <Text style={[styles.saldoKV, styles.saldoDebe]}>{money(s.debe, monedaBase)}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={[styles.saldoBadge, s.saldo >= 0 ? styles.saldoBadgePositive : styles.saldoBadgeNegative]}>
                    <Text style={[styles.saldoValue, s.saldo >= 0 ? styles.saldoValuePositive : styles.saldoValueNegative]}>
                      {s.saldo >= 0 ? '+' : ''}{money(s.saldo, monedaBase)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </View>

      {/* GASTOS */}
      <View style={[styles.card, styles.cardElevated]}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="receipt" size={24} color={PRIMARY} />
          <Text style={styles.cardTitle}>Gastos del Evento</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{filtered.length}</Text>
          </View>
        </View>
        <Animated.View style={{ opacity: gastosOpacity }}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="receipt" size={48} color={BORDER} />
              <Text style={styles.emptyInfo}>No hay gastos en esta categoría</Text>
            </View>
          ) : (
            <View style={styles.gastosContainer}>
              {filtered.map((g, i) => {
                const c = calcPorGasto[g.id];
                const restanteCalc = c?.restante ?? 0;
                const restante = eventoSaldado ? 0 : (zeroish(restanteCalc) ? 0 : restanteCalc);
                const saldado = eventoSaldado || zeroish(restante);
                const parcial = !saldado && restante < g.monto;
                
                return (
                  <View key={g.id} style={[styles.gastoRow, i === filtered.length - 1 && styles.gastoRowLast]}>
                    <View style={[styles.gastoIconWrap, saldado ? styles.gastoIconSuccess : parcial ? styles.gastoIconWarning : styles.gastoIconPending]}>
                      <MaterialCommunityIcons
                        name={saldado ? "check-circle" : parcial ? "clock-check-outline" : "clock-outline"}
                        size={20}
                        color={saldado ? SUCCESS : parcial ? ACCENT : WARNING}
                      />
                    </View>
                    <View style={styles.gastoContent}>
                      <Text style={styles.gastoTitle} numberOfLines={2}>{g.descripcion}</Text>
                      <View style={styles.gastoMeta}>
                        <View style={styles.gastoMetaItem}>
                          <MaterialCommunityIcons name="account" size={12} color={TEXT_MUTED} />
                          <Text style={styles.gastoSub} numberOfLines={1}>{g.pagador_nombre}</Text>
                        </View>
                        {g.fecha && (
                          <>
                            <Text style={styles.gastoMetaSep}>•</Text>
                            <View style={styles.gastoMetaItem}>
                              <MaterialCommunityIcons name="calendar" size={12} color={TEXT_MUTED} />
                              <Text style={styles.gastoSub}>{fmtDate(g.fecha)}</Text>
                            </View>
                          </>
                        )}
                      </View>
                      {saldado ? (
                        <View style={styles.gastoStatusBadge}>
                          <MaterialCommunityIcons name="check" size={12} color={SUCCESS} />
                          <Text style={[styles.gastoStatusText, { color: SUCCESS }]}>Saldado</Text>
                        </View>
                      ) : parcial ? (
                        <View style={styles.gastoProgressWrap}>
                          <View style={styles.gastoProgressBar}>
                            <View style={[styles.gastoProgressFill, { width: `${((g.monto - restante) / g.monto) * 100}%` }]} />
                          </View>
                          <Text style={[styles.gastoSub, { marginTop: 4 }]}>Restante: {money(restante, monedaBase)}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.gastoSub, { marginTop: 4, color: WARNING }]}>
                          Pendiente: {money(restante, monedaBase)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.gastoAmountWrap}>
                      <Text style={styles.gastoAmount}>{money(g.monto, monedaBase)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>
      </View>

      {/* Acciones */}
      <View style={styles.actionsContainer}>
        <Pressable 
          onPress={() => router.replace({ pathname: "/PagarSaldoPendiente", params: { id, nombre } })} 
          style={[styles.actionBtn, styles.actionBtnPrimary]}
        >
          <MaterialCommunityIcons name="cash-multiple" size={22} color="#fff" />
          <Text style={styles.actionBtnText}>Ir a Pagar</Text>
        </Pressable>

        <Pressable 
          onPress={() => router.replace({ pathname: "/DetalleGrupo", params: { id, nombre } })} 
          style={[styles.actionBtn, styles.actionBtnSecondary]}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={PRIMARY} />
          <Text style={[styles.actionBtnText, { color: PRIMARY }]}>Volver al grupo</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/* ===== UI Components ===== */
const MiniBadge = ({ icon, label, value }: { icon: any; label: string; value?: string }) => (
  <View style={styles.miniBadge}>
    <View style={styles.miniIconWrap}>
      <MaterialCommunityIcons name={icon} size={18} color={PRIMARY} />
    </View>
    <Text style={styles.miniLabel}>{label}</Text>
    <Text style={styles.miniValue} numberOfLines={1}>{value || "—"}</Text>
  </View>
);

const Kpi = ({ label, value, icon, color }: { label: string; value: string; icon: any; color?: string }) => (
  <View style={styles.kpi}>
    <View style={[styles.kpiIconWrap, { backgroundColor: `${color || PRIMARY}15` }]}>
      <MaterialCommunityIcons name={icon} size={22} color={color || PRIMARY} />
    </View>
    <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
    <Text style={styles.kpiLabel} numberOfLines={2}>{label}</Text>
  </View>
);

function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: any }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} hitSlop={8}>
      {icon && <MaterialCommunityIcons name={icon} size={16} color={active ? "#fff" : PRIMARY} style={{ marginRight: 6 }} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/* ===== Styles ===== */
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: BG 
  },
  scrollContent: { 
    paddingBottom: 32 
  },
  center: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center", 
    backgroundColor: BG 
  },
  loadingText: { 
    color: TEXT_MUTED, 
    marginTop: 16, 
    fontSize: 15 * S, 
    fontWeight: "600" 
  },

  // HERO
  hero: { 
    paddingTop: isSmallDevice ? 16 : 20, 
    paddingBottom: isSmallDevice ? 32 : 40, 
    paddingHorizontal: isLargeDevice ? 24 : 16, 
    borderBottomLeftRadius: isSmallDevice ? 24 : 32, 
    borderBottomRightRadius: isSmallDevice ? 24 : 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  heroTopRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between" 
  },
  heroIconBtn: { 
    width: 42, 
    height: 42, 
    borderRadius: 14, 
    backgroundColor: "rgba(255,255,255,0.2)", 
    alignItems: "center", 
    justifyContent: "center", 
    borderColor: "rgba(255,255,255,0.3)", 
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroBrand: { 
    color: "#fff", 
    fontSize: isSmallDevice ? 18 : 20, 
    fontWeight: "900", 
    flex: 1, 
    textAlign: "center", 
    paddingHorizontal: 12,
    letterSpacing: 0.5,
  },
  heroContent: {
    marginTop: isSmallDevice ? 16 : 20,
  },
  heroSubtitle: { 
    color: "rgba(255,255,255,0.95)", 
    fontSize: isSmallDevice ? 13 : 14, 
    fontWeight: "600", 
    textAlign: "center", 
    paddingHorizontal: 16,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: { 
    color: "#fff", 
    fontSize: isSmallDevice ? 24 : isLargeDevice ? 32 : 28, 
    fontWeight: "900", 
    marginTop: 6, 
    textAlign: "center", 
    paddingHorizontal: 16,
    lineHeight: isSmallDevice ? 28 : isLargeDevice ? 38 : 34,
  },
  heroDesc: { 
    color: "rgba(255,255,255,0.9)", 
    fontSize: isSmallDevice ? 13 : 14, 
    marginTop: 6, 
    textAlign: "center", 
    paddingHorizontal: 16,
    fontWeight: "500",
  },
  heroBadgeOk: { 
    marginTop: 14, 
    alignSelf: "center", 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    backgroundColor: "#D1FAE5", 
    borderRadius: 999, 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    borderWidth: 1, 
    borderColor: "#A7F3D0",
    shadowColor: SUCCESS,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  heroBadgeOkText: { 
    color: "#059669", 
    fontWeight: "800", 
    fontSize: 13 
  },

  // BADGES
  heroBadgesRow: { 
    flexDirection: "row", 
    gap: isSmallDevice ? 8 : 12, 
    marginTop: isSmallDevice ? -20 : -24, 
    paddingHorizontal: isLargeDevice ? 24 : 16,
    flexWrap: isSmallDevice ? "wrap" : "nowrap",
  },
  miniBadge: { 
    flex: 1, 
    minWidth: isSmallDevice ? "30%" : 100,
    backgroundColor: CARD, 
    borderRadius: 16, 
    paddingVertical: 12, 
    paddingHorizontal: isSmallDevice ? 8 : 12, 
    borderWidth: 1, 
    borderColor: BORDER, 
    shadowColor: "#000", 
    shadowOpacity: 0.08, 
    shadowRadius: 8, 
    shadowOffset: { width: 0, height: 2 },
    elevation: 4, 
    alignItems: "center" 
  },
  miniIconWrap: { 
    width: 36, 
    height: 36, 
    borderRadius: 12, 
    backgroundColor: "#E0F2F1", 
    alignItems: "center", 
    justifyContent: "center", 
    marginBottom: 8 
  },
  miniLabel: { 
    fontSize: 10, 
    color: TEXT_MUTED, 
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  miniValue: { 
    fontSize: isSmallDevice ? 13 : 14, 
    color: INK, 
    fontWeight: "800", 
    marginTop: 4 
  },

  // CARD
  card: { 
    marginHorizontal: isLargeDevice ? 24 : 16, 
    marginTop: 16, 
    backgroundColor: CARD, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: BORDER, 
    padding: isSmallDevice ? 14 : isLargeDevice ? 20 : 16,
  },
  cardElevated: {
    shadowColor: "#000", 
    shadowOpacity: 0.08, 
    shadowRadius: 12, 
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  cardTitle: { 
    fontSize: isSmallDevice ? 17 : 19, 
    fontWeight: "800", 
    color: INK,
    flex: 1,
  },
  countBadge: {
    backgroundColor: `${PRIMARY}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "800",
  },

  // KPIS
  kpis: { 
    flexDirection: "row", 
    gap: isSmallDevice ? 8 : 12,
    flexWrap: isSmallDevice ? "wrap" : "nowrap",
  },
  kpi: { 
    flex: 1, 
    minWidth: isSmallDevice ? "45%" : 100,
    backgroundColor: "#FAFAFA", 
    paddingVertical: 16, 
    paddingHorizontal: 12,
    borderRadius: 16, 
    alignItems: "center", 
    borderWidth: 1, 
    borderColor: BORDER 
  },
  kpiIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  kpiValue: { 
    fontSize: isSmallDevice ? 15 : 17, 
    fontWeight: "800", 
    color: INK, 
    marginTop: 4,
    textAlign: "center",
  },
  kpiLabel: { 
    fontSize: 11, 
    color: TEXT_MUTED, 
    marginTop: 4, 
    textAlign: "center",
    fontWeight: "600",
  },

  // CHIPS
  rowChips: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 10 
  },
  chip: { 
    flexDirection: "row", 
    alignItems: "center", 
    borderWidth: 2, 
    borderColor: PRIMARY, 
    borderRadius: 999, 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    backgroundColor: "#fff" 
  },
  chipActive: { 
    backgroundColor: PRIMARY, 
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  chipText: { 
    color: PRIMARY, 
    fontWeight: "700", 
    fontSize: 13 
  },
  chipTextActive: { 
    color: "#fff" 
  },

  // CHARTS
  chartSection: {
    marginTop: 16,
  },
  chartSectionBorder: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 20,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: INK,
    marginBottom: 16,
  },
  chartWrapper: {
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: 12,
  },
  chart: {
    borderRadius: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyInfo: { 
    fontSize: 14, 
    color: TEXT_MUTED,
    fontWeight: "600",
  },

  // SALDOS
  saldosContainer: {
    marginTop: 8,
  },
  saldoRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    borderBottomWidth: 1, 
    borderBottomColor: BORDER, 
    paddingVertical: 16, 
    gap: 12,
  },
  saldoRowLast: {
    borderBottomWidth: 0,
  },
  saldoAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${PRIMARY}10`,
    alignItems: "center",
    justifyContent: "center",
  },
  saldoContent: {
    flex: 1,
  },
  saldoNombre: { 
    fontSize: 16, 
    fontWeight: "700", 
    color: INK,
    marginBottom: 6,
  },
  saldoLine: { 
    flexDirection: "row", 
    alignItems: "center", 
    flexWrap: "wrap",
    gap: 8,
  },
  saldoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  saldoKV: { 
    fontSize: 13, 
    fontWeight: "700" 
  },
  saldoPago: { 
    color: SUCCESS 
  },
  saldoDebe: { 
    color: ERROR 
  },
  saldoSep: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
  },
  saldoBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 80,
    alignItems: "center",
  },
  saldoBadgePositive: {
    backgroundColor: `${SUCCESS}15`,
  },
  saldoBadgeNegative: {
    backgroundColor: `${ERROR}15`,
  },
  saldoValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  saldoValuePositive: {
    color: SUCCESS,
  },
  saldoValueNegative: {
    color: ERROR,
  },

  // GASTOS
  gastosContainer: {
    marginTop: 8,
  },
  gastoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 16,
    gap: 12,
  },
  gastoRowLast: {
    borderBottomWidth: 0,
  },
  gastoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  gastoIconSuccess: {
    backgroundColor: `${SUCCESS}15`,
  },
  gastoIconWarning: {
    backgroundColor: `${ACCENT}15`,
  },
  gastoIconPending: {
    backgroundColor: `${WARNING}15`,
  },
  gastoContent: {
    flex: 1,
  },
  gastoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: INK,
    marginBottom: 6,
    lineHeight: 20,
  },
  gastoMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  gastoMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "45%",
  },
  gastoMetaSep: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  gastoSub: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontWeight: "600",
  },
  gastoStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: `${SUCCESS}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    marginTop: 4,
  },
  gastoStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  gastoProgressWrap: {
    marginTop: 8,
  },
  gastoProgressBar: {
    height: 6,
    backgroundColor: `${ACCENT}20`,
    borderRadius: 3,
    overflow: "hidden",
  },
  gastoProgressFill: {
    height: "100%",
    backgroundColor: ACCENT,
    borderRadius: 3,
  },
  gastoAmountWrap: {
    alignItems: "flex-end",
  },
  gastoAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: INK,
  },

  // ACTIONS
  actionsContainer: {
    marginHorizontal: isLargeDevice ? 24 : 16,
    marginTop: 24,
    gap: 12,
  },
  actionBtn: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnPrimary: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  actionBtnSecondary: {
    backgroundColor: CARD,
    borderColor: PRIMARY,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});