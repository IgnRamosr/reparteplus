// app/GraficoGastosEvento.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Animated,
  Easing,
  BackHandler,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import axios from "axios";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BarChart as RNCKBarChart, PieChart } from "react-native-chart-kit";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

/* ======= TS fix ======= */
type BarChartPropsFix = React.ComponentProps<typeof RNCKBarChart> & { formatYLabel?: (val: string) => string };
const BarChartFixed = RNCKBarChart as unknown as React.ComponentType<BarChartPropsFix>;

/* ======= PALETA ======= */
const PRIMARY = "#0EA5A4";
const PRIMARY_DARK = "#0A8E8C";
const SECONDARY = "#14B8A6";
const BG = "#F8FBFC";
const CARD = "#FFFFFF";
const INK = "#0F172A";
const TEXT_MUTED = "#6B7280";
const BORDER = "#E5E7EB";

/* ======= Layout ======= */
const { width: SCREEN_W } = Dimensions.get("window");
const S = Math.min(Math.max(SCREEN_W / 390, 0.85), 1.05);
const chartWidth = Math.min(SCREEN_W - 24, 560);
const chartHeight = Math.round(200 * S);

/* ======= APIs ======= */
const apiGrupo = axios.create({
  baseURL: "https://ee61hfpl8e.execute-api.us-east-1.amazonaws.com/production",
  timeout: 20000,
  headers: { "Cache-Control": "no-cache" },
});
const apiGasto = axios.create({
  baseURL: "https://amzcxtvh06.execute-api.us-east-1.amazonaws.com/production",
  timeout: 20000,
  headers: { "Cache-Control": "no-cache" },
});

/* ======= Tipos ======= */
type Grupo = { id: string; nombre: string; fecha_inicio?: string; fecha_cierre?: string; creador_nombre?: string; descripcion?: string };
type Participante = { participante_id: number; nombre?: string; email?: string };
type Gasto = {
  id: string;
  descripcion: string;
  monto: number;
  moneda: string;
  fecha?: string;
  pagador_nombre?: string;
  /** calculados */
  pagado_total: number;
  restante: number;
  estado: boolean; // true si restante <= 0
  [k: string]: any;
};

/* ======= Helpers ======= */
const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("es-CL");
};
const money = (n?: number, cur = "CLP") => `${Intl.NumberFormat("es-CL").format(Math.round(Number(n || 0)))} ${cur}`;
const fmtMiles = (n: number) => Intl.NumberFormat("es-CL").format(Math.round(n));

/* descripcion robusta */
function pickDescripcion(row: any): string {
  if (!row || typeof row !== "object") return "Sin descripción";
  const keys = Object.keys(row);
  const candidates = ["descripciongasto","descripcion_gasto","descripcion","desc","nombre_gasto","nombre","titulo","detalle","concepto","observacion","item"];
  const norm = (s: string) => s.toLowerCase().replace(/_/g, "");
  const map = new Map(keys.map((k) => [norm(k), k]));
  for (const c of candidates) {
    const hit = map.get(norm(c));
    if (hit && row[hit] != null && String(row[hit]).trim() !== "") return String(row[hit]).trim();
  }
  const fuzzy = keys.find((k) => /(desc|concept|titulo|detalle|nombre)/i.test(k));
  if (fuzzy && row[fuzzy] != null && String(row[fuzzy]).trim() !== "") return String(row[fuzzy]).trim();
  return "Sin descripción";
}

/* extrae nombres desde detalle */
function extractNamesFromGastoRow(r: any): string[] {
  if (!r || typeof r !== "object") return [];
  const names: string[] = [];
  const arrayKeys = ["integrantes","participantes","miembros","detalle","detalles","gasto_participante","gp","split","shares"];
  const nameKeys = ["nombre","nombre_participante","participante_nombre","nombres","fullname","display_name","alias","email"];
  for (const ak of arrayKeys) {
    const arr = r?.[ak];
    if (Array.isArray(arr)) {
      for (const it of arr) {
        for (const nk of nameKeys) {
          if (it?.[nk]) { const n = String(it[nk]).trim(); if (n) names.push(n); break; }
        }
      }
    }
  }
  return names;
}

/* obtiene monto pagado desde estructuras variadas */
const num = (v: any) => (v == null || v === "" || isNaN(Number(v)) ? 0 : Number(v));
function getPagoAmount(obj: any): number {
  if (!obj || typeof obj !== "object") return 0;
  const cands = ["monto_pago","monto_pagado","abono","pago","amount","valor","total","monto"];
  for (const k of cands) if (obj[k] != null) return num(obj[k]);
  return 0;
}
function sumPagosFromDetalle(det: any): number {
  // intenta encontrar arrays de pagos dentro del detalle
  if (!det || typeof det !== "object") return 0;
  let s = 0;
  const keys = ["pagos","abonos","payments","historial_pagos","historial","movimientos","transactions"];
  for (const k of keys) {
    const arr = det[k];
    if (Array.isArray(arr)) arr.forEach((p) => (s += getPagoAmount(p)));
  }
  // a veces el pago viene “flat”
  return s || getPagoAmount(det);
}

/* ======= COMPONENTE ======= */
export default function GraficoGastosEvento() {
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre?: string }>();

  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [extraNombresDetalle, setExtraNombresDetalle] = useState<string[]>([]);
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

  useFocusEffect(
    useCallback(() => {
      const onBack = () => { router.replace({ pathname: "/DetalleGrupo", params: { id, nombre } }); return true; };
      BackHandler.addEventListener("hardwareBackPress", onBack);
    }, [id, nombre])
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const _t = Date.now();

      // Grupo
      const gRes = await apiGrupo.get("/grupo", { params: { grupoId: id, _t } });
      const g = gRes.data || {};
      setGrupo({ id: String(id), nombre: g.nombre ?? nombre ?? "Evento", fecha_inicio: g.fecha_inicio, fecha_cierre: g.fecha_cierre, creador_nombre: g.creador_nombre ?? "—", descripcion: g.descripcion ?? "Salida" });

      // Participantes
      let parr: any[] = [];
      const tryFetch = async (paramName: string) => {
        const pRes = await apiGrupo.get("/grupo/participantes", { params: { [paramName]: id, _t } });
        return pRes?.data?.participantes ?? pRes?.data?.resultados ?? pRes?.data?.rows ?? pRes?.data ?? [];
      };
      try {
        parr = await tryFetch("grupoId");
        if (!Array.isArray(parr) || parr.length === 0) parr = await tryFetch("groupId");
        if (!Array.isArray(parr) || parr.length === 0) parr = await tryFetch("id_grupo");
        if (!Array.isArray(parr) || parr.length === 0) parr = await tryFetch("id");
      } catch { parr = []; }
      setParticipantes(
        (Array.isArray(parr) ? parr : []).map((p: any, i: number) => ({
          participante_id: Number(p.participante_id ?? p.id_participante ?? p.id ?? p.usuario_id ?? i),
          nombre: String(p.nombre ?? p.nombre_participante ?? p.participante_nombre ?? p.alias ?? p.email ?? `Participante ${i + 1}`).trim(),
          email: p?.email,
        }))
      );

      // Gastos base
      const gastosRes = await apiGasto.get("/gastos", { params: { grupoId: id, _t } });
      const arr: any[] = gastosRes.data?.resultados ?? gastosRes.data ?? [];

      // === Mapa de pagos (grupo) ===
      const pagosMap = new Map<string, number>();
      // 1) intento endpoint agregado por grupo
      try {
        const pRes = await apiGasto.get("/pagos", { params: { grupoId: id, _t } });
        const pagos = pRes?.data?.resultados ?? pRes?.data?.rows ?? pRes?.data ?? [];
        if (Array.isArray(pagos)) {
          for (const p of pagos) {
            const gid = String(p.gasto_id ?? p.id_gasto ?? p.gasto ?? p.id ?? "");
            if (!gid) continue;
            const acumPre = pagosMap.get(gid) ?? 0;
            pagosMap.set(gid, acumPre + getPagoAmount(p));
          }
        }
      } catch { /* opcional */ }

      // 2) fallback por gasto (gasto-pagos/pagos/gasto-detalle)
      const toQuery = arr.slice(0, 20); // limita llamadas
      const results = await Promise.allSettled(
        toQuery.map(async (row: any) => {
          const gid = String(row.id ?? row.gasto_id ?? row.uuid ?? "");
          if (!gid) return;
          // a) /gasto-pagos
          try {
            const r1 = await apiGasto.get("/gasto-pagos", { params: { gastoId: gid, _t } });
            const pagos = r1?.data?.pagos ?? r1?.data?.rows ?? r1?.data ?? [];
            if (Array.isArray(pagos) && pagos.length) {
              let s = 0; pagos.forEach((p: any) => (s += getPagoAmount(p)));
              pagosMap.set(gid, (pagosMap.get(gid) ?? 0) + s); return;
            }
          } catch {}
          // b) /pagos con gastoId
          try {
            const r2 = await apiGasto.get("/pagos", { params: { gastoId: gid, _t } });
            const pagos = r2?.data?.pagos ?? r2?.data?.resultados ?? r2?.data ?? [];
            if (Array.isArray(pagos) && pagos.length) {
              let s = 0; pagos.forEach((p: any) => (s += getPagoAmount(p)));
              pagosMap.set(gid, (pagosMap.get(gid) ?? 0) + s); return;
            }
          } catch {}
          // c) /gasto-detalle (buscar abonos dentro)
          try {
            const r3 = await apiGasto.get("/gasto-detalle", { params: { gastoId: gid, _t } });
            const d = r3?.data;
            let s = 0;
            if (Array.isArray(d)) d.forEach((x) => (s += sumPagosFromDetalle(x)));
            else if (d && typeof d === "object") {
              // si viene por integrante
              const arrs = d.detalle ?? d.integrantes ?? d.participantes ?? [];
              if (Array.isArray(arrs)) arrs.forEach((x: any) => (s += sumPagosFromDetalle(x)));
              else s += sumPagosFromDetalle(d);
            }
            if (s > 0) pagosMap.set(gid, (pagosMap.get(gid) ?? 0) + s);
          } catch {}
        })
      );
      void results; // lint

      // Mapeo de gastos con pagos
      const gastosMap: Gasto[] = arr.map((r: any, i: number) => {
        const gid = String(r.id ?? r.gasto_id ?? r.uuid ?? i);
        const total = num(r.monto ?? r.total ?? r.valor ?? r.precio ?? 0);
        const pagado_total =
          num(pagosMap.get(gid)) ||
          num(r.pagado_total ?? r.total_pagado ?? r.abonado ?? r.pagos ?? 0);
        const restante = Math.max(0, total - pagado_total);
        const pagador =
          r.pagador_nombre ?? r.nombre_pagador ?? r.pagador ?? r.participante_nombre ?? r.nombre_participante ?? r.autor ?? "—";
        return {
          id: gid,
          descripcion: pickDescripcion(r),
          monto: total,
          moneda: r.moneda ?? r.divisa ?? "CLP",
          fecha: r.fecha ?? r.fecha_registro ?? r.created_at ?? undefined,
          pagador_nombre: pagador,
          pagado_total,
          restante,
          estado: restante <= 0.0001,
          ...r,
        };
      });

      setGastos(gastosMap);

      // nombres extra desde detalle (para saldos si no hay participantes)
      let namesFromDetalles: string[] = [];
      try {
        const results2 = await Promise.allSettled(
          gastosMap.slice(0, 12).map((g) => apiGasto.get("/gasto-detalle", { params: { gastoId: g.id, _t } }))
        );
        for (const r of results2) {
          if (r.status === "fulfilled") {
            const integ = r.value?.data?.integrantes ?? r.value?.data?.participantes ?? r.value?.data?.detalle ?? [];
            if (Array.isArray(integ)) integ.forEach((p: any) => {
              const n = p?.nombre ?? p?.nombre_participante ?? p?.participante_nombre ?? p?.alias ?? p?.email;
              if (n) namesFromDetalles.push(String(n).trim());
            });
          }
        }
      } catch {}
      gastosMap.forEach((r) => extractNamesFromGastoRow(r).forEach((n) => namesFromDetalles.push(n)));
      setExtraNombresDetalle(namesFromDetalles);
    } catch {
      Alert.alert("Error", "No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      runFade();
    }
  }, [id, nombre, runFade]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("reparte:gasto:actualizado", fetchData);
    const sub2 = DeviceEventEmitter.addListener("reparte:pago:registrado", fetchData);
    return () => { sub.remove(); sub2.remove(); };
  }, [fetchData]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  /* ======= FILTROS ======= */
  const filtered = useMemo(() => {
    return gastos.filter((g) => (estado === "all" || (estado === "pagado" && g.estado) || (estado === "pendiente" && !g.estado)));
  }, [gastos, estado]);

  const totalEvento = gastos.reduce((a, g) => a + g.monto, 0);
  const totalFiltrado = filtered.reduce((a, g) => a + g.monto, 0);

  /* ======= GRÁFICOS ======= */
  const topPagadores = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((g) => {
      const key = g.pagador_nombre || "—";
      map.set(key, (map.get(key) ?? 0) + g.monto);
    });
    return Array.from(map.entries()).map(([nombre, monto]) => ({ nombre, monto })).sort((a, b) => b.monto - a.monto).slice(0, 5);
  }, [filtered]);

  const barData = { labels: topPagadores.map((x) => (x.nombre.length > 12 ? x.nombre.slice(0, 12) + "…" : x.nombre)), datasets: [{ data: topPagadores.map((x) => x.monto) }] };

  const totalPagadoAcum = filtered.reduce((a, g) => a + Math.min(g.monto, g.pagado_total), 0);
  const totalPendienteAcum = filtered.reduce((a, g) => a + g.restante, 0);
  const pieData = [
    { name: "Pagado", population: totalPagadoAcum, color: "#10B981", legendFontColor: TEXT_MUTED, legendFontSize: Math.round(11 * S) },
    { name: "Pendiente", population: totalPendienteAcum, color: "#F59E0B", legendFontColor: TEXT_MUTED, legendFontSize: Math.round(11 * S) },
  ];

  /* ======= SALDOS (usa SOLO restante) ======= */
  const listaNombres: string[] = useMemo(() => {
    const set = new Set<string>();
    participantes.forEach((p) => { const n = (p?.nombre || p?.email || "—").toString().trim(); if (n) set.add(n); });
    gastos.forEach((g) => { const n = (g?.pagador_nombre || "—").toString().trim(); if (n) set.add(n); });
    extraNombresDetalle.forEach((n) => { const v = String(n).trim(); if (v) set.add(v); });
    if (grupo?.creador_nombre) { const n = String(grupo.creador_nombre).trim(); if (n) set.add(n); }
    const arr = Array.from(set);
    return arr.length > 0 ? arr : ["—"];
  }, [participantes, gastos, extraNombresDetalle, grupo?.creador_nombre]);

  const gastosPendientes = useMemo(() => gastos.filter((g) => g.restante > 0), [gastos]);

  type Saldo = { nombre: string; pago: number; debe: number; saldo: number };
  const saldos: Saldo[] = useMemo(() => {
    const N = listaNombres.length;
    if (N <= 0) return [];
    const map = new Map<string, Saldo>();
    listaNombres.forEach((n) => map.set(n, { nombre: n, pago: 0, debe: 0, saldo: 0 }));

    gastosPendientes.forEach((g) => {
      const pagador = (g.pagador_nombre || "—").trim();
      const N2 = Math.max(N - 1, 1); // excluye al pagador
      const cuota = g.restante / N2;

      // lo que el pagador aún tiene por recuperar
      const sPag = map.get(pagador);
      if (sPag) sPag.pago += g.restante;

      // lo que cada NO pagador debe de ese restante
      listaNombres.forEach((n) => {
        if (n === pagador) return;
        const s = map.get(n)!;
        s.debe += cuota;
      });
    });

    map.forEach((s) => (s.saldo = Math.round(s.pago - s.debe)));
    return Array.from(map.values());
  }, [listaNombres, gastosPendientes]);

  /* ======= UI ======= */
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
          <Pressable onPress={fetchData} style={styles.heroIconBtn} hitSlop={8}>
            <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.heroSubtitle}>Dashboard del Evento</Text>
        <Text style={styles.heroTitle} numberOfLines={1}>{grupo?.nombre ?? "Evento"}</Text>
        {!!grupo?.descripcion && <Text style={styles.heroDesc} numberOfLines={1}>{grupo.descripcion}</Text>}
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
          <Kpi label="Total del evento" value={money(totalEvento)} icon="cash-multiple" />
          <Kpi label="Gastos filtrados" value={`${filtered.length}`} icon="filter-variant" />
          <Kpi label="Monto filtrado" value={money(totalFiltrado)} icon="chart-donut" />
        </View>
      </Animated.View>

      {/* CONTROLES */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Controles</Text>
        <View style={styles.rowChips}>
          <Chip label="Pagados" active={estado === "pagado"} onPress={() => setEstado("pagado")} />
          <Chip label="Pendientes" active={estado === "pendiente"} onPress={() => setEstado("pendiente")} />
        </View>
      </View>

      {/* GRÁFICAS */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gráficas</Text>
        <Text style={styles.cardSub}>Gastos Evento</Text>
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
            formatYLabel={(val: string) => `${fmtMiles(Number(val))} CLP`}
            style={{ borderRadius: 12, alignSelf: "center", marginTop: 8 }}
            verticalLabelRotation={0}
            yAxisLabel={""}
            yAxisSuffix={""}
          />
        ) : (
          <Text style={styles.emptyInfo}>No hay datos suficientes.</Text>
        )}

        <Text style={[styles.cardSub, { marginTop: 12 }]}>Monto por estado</Text>
        {totalPagadoAcum + totalPendienteAcum > 0 ? (
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
                    <Text style={[styles.saldoKV, styles.saldoPago]}>Pagó: {money(s.pago)}</Text>
                    <Text style={styles.saldoSep}> • </Text>
                    <Text style={[styles.saldoKV, styles.saldoDebe]}>Debe: {money(s.debe)}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </Animated.View>
      </View>

      {/* LISTA DE GASTOS */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gastos Evento</Text>
        {filtered.map((g) => (
          <View key={g.id} style={styles.row}>
            <MaterialCommunityIcons
              name={g.estado ? "check-circle" : g.restante < g.monto ? "progress-clock" : "clock-outline"}
              size={18}
              color={g.estado ? "#16A34A" : g.restante < g.monto ? "#0EA5A4" : "#F59E0B"}
              style={{ marginRight: 8 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{g.descripcion}</Text>
              <Text style={styles.rowSub}>
                Pagador: {g.pagador_nombre} {g.fecha ? `• Fecha: ${fmtDate(g.fecha)}` : ""}
              </Text>
              {!g.estado && g.restante < g.monto && (
                <Text style={[styles.rowSub, { marginTop: 2 }]}>
                  Restante: {money(g.restante)} (pagado {money(g.pagado_total)})
                </Text>
              )}
              {g.estado && (
                <Text style={[styles.rowSub, { marginTop: 2, color: "#16A34A", fontWeight: "700" }]}>
                  Saldado
                </Text>
              )}
            </View>
            <Text style={styles.rowAmount}>{money(g.monto)}</Text>
          </View>
        ))}
      </View>

          {/* Pagar saldo pendiente */}
      <Pressable onPress={() => router.replace({ pathname: "/PagarSaldoPendiente", params: { id, nombre } })} style={styles.backBtn}>
        <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
        <Text style={styles.backBtnText}>Ir a Pagar</Text>
      </Pressable>

      {/* Volver */}
      <Pressable onPress={() => router.replace({ pathname: "/DetalleGrupo", params: { id, nombre } })} style={styles.backBtn}>
        <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
        <Text style={styles.backBtnText}>Volver al grupo</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ======= UI bits ======= */
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

/* ======= Estilos ======= */
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
