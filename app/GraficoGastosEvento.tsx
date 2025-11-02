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
  TextInput,
  View,
  Animated,
  Easing,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import axios from "axios";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BarChart, PieChart } from "react-native-chart-kit";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

/* ======= PALETA LedgerTeal ======= */
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

/* ======= API ======= */
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
type Grupo = {
  id: string;
  nombre: string;
  fecha_inicio?: string;
  fecha_cierre?: string;
  creador_nombre?: string;
  descripcion?: string;
};
type Participante = { participante_id: number; nombre?: string; email?: string };
type Gasto = {
  id: string;
  descripcion: string;
  monto: number;
  moneda: string;
  fecha?: string;
  estado: boolean;
  pagador_nombre?: string;
  [k: string]: any;
};

/* ======= Helpers ======= */
const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("es-CL");
};
const money = (n?: number, cur = "CLP") =>
  `${Intl.NumberFormat("es-CL").format(Math.round(Number(n || 0)))} ${cur}`;
const fmtMiles = (n: number) => Intl.NumberFormat("es-CL").format(Math.round(n));
const parseEstado = (v: any): boolean => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  const s = String(v ?? "").trim().toLowerCase();
  if (["true", "t", "1", "pagado", "paid", "liquidado"].includes(s)) return true;
  if (["false", "f", "0", "pendiente", "unpaid", "no pagado"].includes(s)) return false;
  return false;
};

/* Descripción robusta */
function pickDescripcion(row: any): string {
  if (!row || typeof row !== "object") return "Sin descripción";
  const keys = Object.keys(row);
  const candidates = [
    "descripciongasto",
    "descripcion_gasto",
    "descripcion",
    "desc",
    "nombre_gasto",
    "nombre",
    "titulo",
    "detalle",
    "concepto",
    "observacion",
    "item",
  ];
  const norm = (s: string) => s.toLowerCase().replace(/_/g, "");
  const map = new Map(keys.map((k) => [norm(k), k]));
  for (const c of candidates) {
    const hit = map.get(norm(c));
    if (hit && row[hit] != null && String(row[hit]).trim() !== "") {
      return String(row[hit]).trim();
    }
  }
  const fuzzy = keys.find((k) => /(desc|concept|titulo|detalle|nombre)/i.test(k));
  if (fuzzy && row[fuzzy] != null && String(row[fuzzy]).trim() !== "") {
    return String(row[fuzzy]).trim();
  }
  return "Sin descripción";
}

/* Extrae nombres posibles desde un registro de gasto (detalle/split) */
function extractNamesFromGastoRow(r: any): string[] {
  if (!r || typeof r !== "object") return [];
  const names: string[] = [];
  const arrayKeys = [
    "integrantes",
    "participantes",
    "miembros",
    "detalle",
    "detalles",
    "gasto_participante",
    "gp",
    "split",
    "shares",
  ];
  const nameKeys = [
    "nombre",
    "nombre_participante",
    "participante_nombre",
    "nombres",
    "fullname",
    "display_name",
    "alias",
    "email",
  ];
  for (const ak of arrayKeys) {
    const arr = r?.[ak];
    if (Array.isArray(arr)) {
      for (const it of arr) {
        for (const nk of nameKeys) {
          if (it?.[nk]) {
            const n = String(it[nk]).trim();
            if (n) names.push(n);
            break;
          }
        }
      }
    }
  }
  return names;
}

/* ======= COMPONENTE PRINCIPAL ======= */
export default function GraficoGastosEvento() {
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre?: string }>();

  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [extraNombresDetalle, setExtraNombresDetalle] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<"all" | "pagado" | "pendiente">("all");

  /* Animaciones */
  const saldosOpacity = useRef(new Animated.Value(0)).current;
  const resumenOpacity = useRef(new Animated.Value(0)).current;
  const runFade = useCallback(() => {
    const anim = (v: Animated.Value) =>
      Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    saldosOpacity.setValue(0);
    resumenOpacity.setValue(0);
    Animated.stagger(120, [anim(resumenOpacity), anim(saldosOpacity)]).start();
  }, [saldosOpacity, resumenOpacity]);

  /* FETCH DATA */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const _t = Date.now();

      // Grupo
      const gRes = await apiGrupo.get("/grupo", { params: { grupoId: id, _t } });
      const g = gRes.data || {};
      setGrupo({
        id: String(id),
        nombre: g.nombre ?? nombre ?? "Evento",
        fecha_inicio: g.fecha_inicio,
        fecha_cierre: g.fecha_cierre,
        creador_nombre: g.creador_nombre ?? "—",
        descripcion: g.descripcion ?? "Salida",
      });

      // Participantes (acepta varias formas de respuesta)
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
      } catch {
        parr = [];
      }
      setParticipantes(
        (Array.isArray(parr) ? parr : []).map((p: any, i: number) => ({
          participante_id:
            Number(p.participante_id ?? p.id_participante ?? p.id ?? p.usuario_id ?? i),
          nombre: String(p.nombre ?? p.nombre_participante ?? p.participante_nombre ?? p.alias ?? p.email ?? `Participante ${i + 1}`).trim(),
          email: p?.email,
        }))
      );

      // Gastos
      const gastosRes = await apiGasto.get("/gastos", { params: { grupoId: id, _t } });
      const arr: any[] = gastosRes.data?.resultados ?? gastosRes.data ?? [];
      const gastosMap = arr.map((r: any, i: number) => ({
        id: String(r.id ?? r.gasto_id ?? r.uuid ?? i),
        descripcion: pickDescripcion(r),
        monto: Number(r.monto ?? r.total ?? r.valor ?? r.precio ?? 0),
        moneda: r.moneda ?? r.divisa ?? "CLP",
        fecha: r.fecha ?? r.fecha_registro ?? r.created_at ?? undefined,
        estado: parseEstado(r.estado ?? r.pagado ?? r.is_paid ?? r.estado_pago),
        pagador_nombre:
          r.pagador_nombre ??
          r.nombre_pagador ??
          r.pagador ??
          r.participante_nombre ??
          r.nombre_participante ??
          r.autor ??
          "—",
        ...r,
      }));
      setGastos(gastosMap);

      // ===== Fallback estilo DetalleGasto: /gasto-detalle por cada gasto =====
      // Si la API de participantes vino vacía o incompleta (<2) recogemos nombres desde los detalles.
      let namesFromDetalles: string[] = [];
      try {
        const toQuery = gastosMap.slice(0, 12); // evitar spam si hay muchos
        const results = await Promise.allSettled(
          toQuery.map((g) =>
            apiGasto.get("/gasto-detalle", { params: { gastoId: g.id, _t } })
          )
        );
        for (const r of results) {
          if (r.status === "fulfilled") {
            const integ =
              r.value?.data?.integrantes ??
              r.value?.data?.participantes ??
              r.value?.data?.detalle ??
              [];
            if (Array.isArray(integ)) {
              integ.forEach((p: any) => {
                const n =
                  p?.nombre ??
                  p?.nombre_participante ??
                  p?.participante_nombre ??
                  p?.alias ??
                  p?.email;
                if (n) namesFromDetalles.push(String(n).trim());
              });
            }
          }
        }
      } catch {
        // ignore
      }
      // También intenta extraer nombres si vinieron embebidos en el propio gasto
      gastosMap.forEach((r) => {
        extractNamesFromGastoRow(r).forEach((n) => namesFromDetalles.push(n));
      });
      setExtraNombresDetalle(namesFromDetalles);
      // ===== fin fallback =====
    } catch {
      Alert.alert("Error", "No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      runFade();
    }
  }, [id, nombre, runFade]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("reparte:gasto:actualizado", fetchData);
    return () => sub.remove();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  /* ======= FILTROS ======= */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return gastos.filter(
      (g) =>
        (estado === "all" ||
          (estado === "pagado" && g.estado) ||
          (estado === "pendiente" && !g.estado)) &&
        (q === "" ||
          g.descripcion.toLowerCase().includes(q) ||
          (g.pagador_nombre || "").toLowerCase().includes(q))
    );
  }, [gastos, estado, search]);

  const totalEvento = gastos.reduce((a, g) => a + g.monto, 0);
  const totalFiltrado = filtered.reduce((a, g) => a + g.monto, 0);

  /* ======= GRÁFICOS ======= */
  const topPagadores = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((g) => {
      const key = g.pagador_nombre || "—";
      map.set(key, (map.get(key) ?? 0) + g.monto);
    });
    return Array.from(map.entries())
      .map(([nombre, monto]) => ({ nombre, monto }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 5);
  }, [filtered]);

  const barData = {
    labels: topPagadores.map((x) =>
      x.nombre.length > 12 ? x.nombre.slice(0, 12) + "…" : x.nombre
    ),
    datasets: [{ data: topPagadores.map((x) => x.monto) }],
  };

  const pagado = filtered.filter((x) => x.estado).reduce((a, g) => a + g.monto, 0);
  const pendiente = filtered.filter((x) => !x.estado).reduce((a, g) => a + g.monto, 0);

  const pieData = [
    { name: "Pagado", population: pagado, color: "#10B981", legendFontColor: TEXT_MUTED, legendFontSize: Math.round(11 * S) },
    { name: "Pendiente", population: pendiente, color: "#F59E0B", legendFontColor: TEXT_MUTED, legendFontSize: Math.round(11 * S) },
  ];

  /* ======= SALDOS (solo pendientes) ======= */
  const listaNombres: string[] = useMemo(() => {
    const set = new Set<string>();

    // 1) Participantes del grupo
    participantes.forEach((p) => {
      const n = (p?.nombre || p?.email || "—").toString().trim();
      if (n) set.add(n);
    });

    // 2) Pagadores presentes en los gastos
    gastos.forEach((g) => {
      const n = (g?.pagador_nombre || "—").toString().trim();
      if (n) set.add(n);
    });

    // 3) Nombres obtenidos por fallback de /gasto-detalle o embebidos en el gasto
    extraNombresDetalle.forEach((n) => {
      const v = String(n).trim();
      if (v) set.add(v);
    });

    // 4) Creador
    if (grupo?.creador_nombre) {
      const n = String(grupo.creador_nombre).trim();
      if (n) set.add(n);
    }

    const arr = Array.from(set);
    return arr.length > 0 ? arr : ["—"];
  }, [participantes, gastos, extraNombresDetalle, grupo?.creador_nombre]);

  const gastosBase = useMemo(() => gastos.filter((g) => !g.estado), [gastos]);

  type Saldo = { nombre: string; pago: number; debe: number; saldo: number };
  const saldos: Saldo[] = useMemo(() => {
    const N = listaNombres.length;
    if (N <= 0) return [];
    const map = new Map<string, Saldo>();
    listaNombres.forEach((n) => map.set(n, { nombre: n, pago: 0, debe: 0, saldo: 0 }));

    gastosBase.forEach((g) => {
      const pagador = (g.pagador_nombre || "—").trim();
      const cuota = N > 0 ? g.monto / N : 0;

      const sPag = map.get(pagador);
      if (sPag) sPag.pago += g.monto;

      listaNombres.forEach((n) => {
        if (n === pagador) return;
        const s = map.get(n)!;
        s.debe += cuota;
      });
    });

    map.forEach((s) => (s.saldo = Math.round(s.pago - s.debe)));
    return Array.from(map.values());
  }, [listaNombres, gastosBase]);

  /* ======= UI ======= */
  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ color: TEXT_MUTED, marginTop: 8 }}>Cargando dashboard…</Text>
      </View>
    );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      {/* ======= HERO TEAL ======= */}
      <LinearGradient
        colors={[SECONDARY, PRIMARY_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTopRow}>
          <Pressable onPress={() => router.back()} style={styles.heroIconBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
          </Pressable>

          <Text style={styles.heroBrand} numberOfLines={1} ellipsizeMode="tail">
            Reparte+
          </Text>

          <Pressable onPress={fetchData} style={styles.heroIconBtn} hitSlop={8}>
            <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
          </Pressable>
        </View>

        <Text style={styles.heroSubtitle} numberOfLines={1} ellipsizeMode="tail">
          Dashboard del Evento
        </Text>

        <Text style={styles.heroTitle} numberOfLines={1} ellipsizeMode="tail">
          {grupo?.nombre ?? "Evento"}
        </Text>

        {!!grupo?.descripcion && (
          <Text style={styles.heroDesc} numberOfLines={1} ellipsizeMode="tail">
            {grupo.descripcion}
          </Text>
        )}
      </LinearGradient>

      {/* ======= BADGES ======= */}
      <View style={styles.heroBadgesRow}>
        <MiniBadge icon="account" label="CREADOR" value={grupo?.creador_nombre || "—"} />
        <MiniBadge icon="calendar-start" label="INICIO" value={fmtDate(grupo?.fecha_inicio)} />
        <MiniBadge icon="calendar-end" label="TÉRMINO" value={fmtDate(grupo?.fecha_cierre)} />
      </View>

      {/* ======= RESUMEN (KPI) ======= */}
      <Animated.View style={[styles.card, { opacity: resumenOpacity }]}>
        <Text style={styles.cardTitle}>Resumen</Text>
        <View style={styles.kpis}>
          <Kpi label="Total del evento" value={money(totalEvento)} icon="cash-multiple" />
          <Kpi label="Gastos filtrados" value={`${filtered.length}`} icon="filter-variant" />
          <Kpi label="Monto filtrado" value={money(totalFiltrado)} icon="chart-donut" />
        </View>
      </Animated.View>

      {/* ======= CONTROLES ======= */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Controles</Text>

        <View style={styles.rowChips}>
          <Chip label="Pagados" active={estado === "pagado"} onPress={() => setEstado("pagado")} />
          <Chip label="Pendientes" active={estado === "pendiente"} onPress={() => setEstado("pendiente")} />
        </View>
      </View>

      {/* ======= GRÁFICAS ======= */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gráficas</Text>

        <Text style={styles.cardSub}>Gastos Evento</Text>
        {barData.datasets[0].data.length > 0 ? (
          <BarChart
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
          />
        ) : (
          <Text style={styles.emptyInfo}>No hay datos suficientes.</Text>
        )}

        <Text style={[styles.cardSub, { marginTop: 12 }]}>Monto por estado</Text>
        {pagado + pendiente > 0 ? (
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

      {/* ======= SALDOS (fade-in) ======= */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Saldos del grupo</Text>

        <Animated.View style={{ opacity: saldosOpacity }}>
          {saldos.length === 0 ? (
            <Text style={styles.emptyInfo}>No hay gastos pendientes 🎉</Text>
          ) : (
            saldos.map((s, i) => (
              <View
                key={s.nombre}
                style={[
                  styles.saldoRow,
                  { backgroundColor: i % 2 === 0 ? "#F9FAFB" : "#FFFFFF" },
                ]}
              >
                <MaterialCommunityIcons
                  name="account-circle"
                  size={24}
                  color={PRIMARY}
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.saldoNombre}>{s.nombre}</Text>
                  <View style={styles.saldoLine}>
                    <Text style={[styles.saldoKV, styles.saldoPago]}>
                      Pagó: {money(s.pago)}
                    </Text>
                    <Text style={styles.saldoSep}> • </Text>
                    <Text style={[styles.saldoKV, styles.saldoDebe]}>
                      Debe: {money(s.debe)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </Animated.View>
      </View>

      {/* ======= LISTA DE GASTOS ======= */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gastos Evento</Text>
        {filtered.map((g) => (
          <View key={g.id} style={styles.row}>
            <MaterialCommunityIcons
              name={g.estado ? "check-circle" : "clock-outline"}
              size={18}
              color={g.estado ? "#16A34A" : "#F59E0B"}
              style={{ marginRight: 8 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{g.descripcion}</Text>
              <Text style={styles.rowSub}>
                Pagador: {g.pagador_nombre} {g.fecha ? `• Fecha: ${fmtDate(g.fecha)}` : ""}
              </Text>
            </View>
            <Text style={styles.rowAmount}>{money(g.monto)}</Text>
          </View>
        ))}
      </View>

      {/* ======= Volver ======= */}
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
        <Text style={styles.backBtnText}>Volver al grupo</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ======= Componentes UI ======= */
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

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
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

  /* HERO */
  hero: {
    paddingTop: 14,
    paddingBottom: 28,
    paddingHorizontal: 12,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderColor: "rgba(255,255,255,0.25)",
    borderWidth: 1,
  },
  heroBrand: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.9)",
    marginTop: 12,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  heroDesc: {
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
    textAlign: "center",
    paddingHorizontal: 12,
  },

  heroBadgesRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: -18,
    paddingHorizontal: 12,
  },

  miniBadge: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    alignItems: "center",
  },
  miniIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "#ECFEFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  miniLabel: { fontSize: 10, color: TEXT_MUTED, fontWeight: "700" },
  miniValue: { fontSize: 14, color: INK, fontWeight: "800", marginTop: 2 },

  /* Cards comunes */
  card: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: INK },
  cardSub: { fontSize: 12, color: TEXT_MUTED, marginTop: 6 },
  emptyInfo: { fontSize: 13, color: TEXT_MUTED, marginTop: 8 },

  /* KPIs */
  kpis: { flexDirection: "row", gap: 8, marginTop: 8 },
  kpi: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  kpiValue: { fontSize: 16, fontWeight: "800", color: INK, marginTop: 2 },
  kpiLabel: { fontSize: 11, color: TEXT_MUTED, marginTop: 2, textAlign: "center" },

  /* Controles */
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  input: { flex: 1, color: INK, paddingVertical: 2, fontSize: 13 },
  rowChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { color: PRIMARY, fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#fff" },

  /* Lista gastos */
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingVertical: 10,
  },
  rowTitle: { color: INK, fontWeight: "800", fontSize: 15 },
  rowSub: { color: TEXT_MUTED, marginTop: 2, fontSize: 12 },
  rowAmount: { color: INK, fontWeight: "800", fontSize: 13 },

  /* Saldos */
  saldoRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 2,
  },
  saldoNombre: { fontSize: 15, fontWeight: "700", color: INK },
  saldoLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 2 },
  saldoKV: { fontSize: 12, fontWeight: "700" },
  saldoPago: { color: "#16A34A" },
  saldoDebe: { color: "#EF4444" },
  saldoSep: { fontSize: 12, color: TEXT_MUTED, marginHorizontal: 4 },

  /* Back button */
  backBtn: {
    marginHorizontal: 12,
    marginTop: 16,
    marginBottom: 18,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: SECONDARY,
  },
  backBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
