// app/GraficoGastosEvento.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import axios from "axios";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BarChart, PieChart } from "react-native-chart-kit";

/* ==================  LedgerTeal  ================== */
const PRIMARY = "#0EA5A4";
const SECONDARY = "#14B8A6";
const BG = "#F8FBFC";
const CARD = "#FFFFFF";
const INK = "#0F172A";
const TEXT = "#1F2937";
const TEXT_MUTED = "#6B7280";
const BORDER = "#E5E7EB";

/* ====== Responsive helpers ====== */
const { width: SCREEN_W } = Dimensions.get("window");
const S = Math.min(Math.max(SCREEN_W / 390, 0.85), 1.05);

const chartWidth = Math.min(SCREEN_W - 24, 560);
const chartHeight = Math.round(200 * S);

/* ==================  API  ================== */
const apiGrupo = axios.create({
  baseURL: "https://ee61hfpl8e.execute-api.us-east-1.amazonaws.com/production",
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
  validateStatus: () => true,
});
const apiGasto = axios.create({
  baseURL: "https://amzcxtvh06.execute-api.us-east-1.amazonaws.com/production",
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
  validateStatus: () => true,
});

/* ==================  Tipos  ================== */
type Grupo = {
  id: string;
  nombre: string;
  descripcion?: string;
  fecha_inicio?: string;
  fecha_cierre?: string;
  creador_id?: number;
  creador_nombre?: string;
};
type Participante = { participante_id: number; nombre?: string; email?: string };
type Gasto = {
  id: string;
  descripcion: string;
  monto: number;
  moneda: string;
  fecha?: string; // ISO
  estado: boolean;
  participante_id?: number;
  pagador_nombre?: string;
};

/* ==================  Pantalla  ================== */
export default function GraficoGastosEvento() {
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre?: string }>();

  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loading, setLoading] = useState(true);

  // Controles del dashboard
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<"all" | "7d" | "30d">("all");
  const [estado, setEstado] = useState<"all" | "pagado" | "pendiente">("all");
  const [sortBy, setSortBy] = useState<"fecha" | "monto">("fecha");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [groupBy, setGroupBy] = useState<"none" | "pagador" | "fecha">("none");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  /* ====== helpers formato ====== */
  const fmtDate = (iso?: string) => {
    if (!iso) return "—";
    const d = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
    return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("es-CL");
  };
  const money = (n?: number) =>
    `${Intl.NumberFormat("es-CL").format(Math.round(Number(n || 0)))} CLP`;

  /* ====== fetch participante por id ====== */
  const fetchParticipanteById = useCallback(async (pid: number) => {
    const intents = [
      () => apiGrupo.get("/participante", { params: { participanteId: pid } }),
      () => apiGrupo.get(`/participantes/${pid}`),
    ];
    for (const req of intents) {
      try {
        const r = await req();
        if (r.status >= 200 && r.status < 300 && r.data) {
          const p = r.data?.data ?? r.data?.participante ?? r.data;
          if (Array.isArray(p) && p.length > 0) return p[0];
          return p;
        }
      } catch {}
    }
    return null;
  }, []);

  /* ====== participantes por grupo ====== */
  const fetchParticipantes = useCallback(
    async (grupoId: string) => {
      const idIntents = [
        () => apiGrupo.get("/grupo_participante", { params: { grupoId } }),
        () => apiGrupo.get("/grupo-participante", { params: { grupoId } }),
        () => apiGrupo.get(`/grupos/${grupoId}/participantes-ids`),
      ];
      let ids: number[] = [];
      for (const call of idIntents) {
        try {
          const r = await call();
          if (r.status >= 200 && r.status < 300 && r.data) {
            const rows: any[] = r.data?.data ?? r.data?.rows ?? r.data?.resultados ?? r.data;
            if (Array.isArray(rows) && rows.length > 0) {
              ids = rows
                .map((row) => Number(row.participante_id ?? row.id ?? row.user_id))
                .filter((n) => Number.isFinite(n));
              break;
            }
          }
        } catch {}
      }

      if (ids.length === 0) {
        const fallbackIntents = [
          () => apiGrupo.get("/grupo/participantes", { params: { grupoId } }),
          () => apiGrupo.get("/participantes", { params: { grupoId } }),
          () => apiGrupo.get(`/grupos/${grupoId}/participantes`),
        ];
        for (const call of fallbackIntents) {
          try {
            const r = await call();
            if (r.status >= 200 && r.status < 300 && r.data) {
              const arr: any[] =
                r.data?.data ?? r.data?.participantes ?? r.data?.resultados ?? r.data;
              if (Array.isArray(arr)) {
                return arr.map((p: any) => ({
                  participante_id: Number(p.participante_id ?? p.id ?? p.user_id ?? 0),
                  nombre: p.nombre ?? undefined,
                  email: p.email ?? undefined,
                })) as Participante[];
              }
            }
          } catch {}
        }
        return [] as Participante[];
      }

      const results = await Promise.all(
        ids.map(async (pid) => {
          const p = await fetchParticipanteById(pid);
          return { participante_id: pid, nombre: p?.nombre, email: p?.email } as Participante;
        })
      );

      const unique = new Map<number, Participante>();
      results.forEach((p) => unique.set(p.participante_id, p));
      return Array.from(unique.values());
    },
    [fetchParticipanteById]
  );

  /* ====== carga principal ====== */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // 1) Grupo
      const gRes = await apiGrupo.get("/grupo", { params: { grupoId: String(id) } });
      let creadorId: number | undefined;
      if (gRes.status >= 200 && gRes.status < 300 && gRes.data) {
        const g = gRes.data;
        creadorId = Number(g.creado_por ?? g.creador ?? undefined);
        const creadorInfo = creadorId ? await fetchParticipanteById(creadorId) : null;

        setGrupo({
          id: String(id),
          nombre: g.nombre ?? (nombre as string) ?? "Evento",
          descripcion: g.descripcion ?? "",
          fecha_inicio: g.fecha_inicio ?? "",
          fecha_cierre: g.fecha_cierre ?? "",
          creador_id: creadorId,
          creador_nombre: creadorInfo?.nombre ?? (creadorId ? `ID ${creadorId}` : "—"),
        });
      } else {
        setGrupo({
          id: String(id),
          nombre: (nombre as string) ?? "Evento",
          creador_nombre: "—",
        });
      }

      // 2) Gastos
      const gastosRes = await apiGasto.get("/gastos", { params: { grupoId: String(id) } });
      let lista: Gasto[] = [];
      if (gastosRes.status >= 200 && gastosRes.status < 300) {
        const arr: any[] =
          gastosRes.data?.resultados ?? gastosRes.data?.gastos ?? gastosRes.data ?? [];
        lista = arr.map((r: any) => ({
          id: String(r.gasto_id ?? r.id ?? r.gastoId ?? ""),
          descripcion: String(r.descripciongasto ?? r.descripcion ?? r.concepto ?? "—"),
          monto: Number(r.monto ?? 0),
          moneda: String(r.moneda ?? "CLP"),
          fecha: r.fecha_registro ?? r.fecha ?? undefined,
          estado: typeof r.estado === "boolean" ? r.estado : Boolean(r.pagado ?? false),
          participante_id: r.participante_id ? Number(r.participante_id) : undefined,
          pagador_nombre: r.pagador_nombre ?? r.nombre_pagador ?? r.pagador ?? undefined,
        }));
      }
      setGastos(lista);

      // 3) Participantes del grupo o inferidos
      let parts = await fetchParticipantes(String(id));
      if ((!parts || parts.length === 0) && lista.length > 0) {
        const idsFromGastos = Array.from(
          new Set(
            lista.map((g) => g.participante_id).filter((x): x is number => typeof x === "number")
          )
        );
        parts = await Promise.all(
          idsFromGastos.map(async (pid) => {
            const p = await fetchParticipanteById(pid);
            return { participante_id: pid, nombre: p?.nombre, email: p?.email } as Participante;
          })
        );
      }
      setParticipantes(parts);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Aviso", "No fue posible cargar todos los datos. Se mostrarán los disponibles.");
      if (!grupo)
        setGrupo({ id: String(id), nombre: (nombre as string) ?? "Evento", creador_nombre: "—" });
    } finally {
      setLoading(false);
    }
  }, [id, nombre, fetchParticipantes, fetchParticipanteById, grupo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ====== helpers de nombres ====== */
  const nombreParticipante = useCallback(
    (pid?: number) => {
      if (!pid) return "—";
      const p = participantes.find((x) => x.participante_id === pid);
      return p?.nombre || p?.email || `ID ${pid}`;
    },
    [participantes]
  );

  /* ====== filtros/orden/agrupación ====== */
  const parseISO = (iso?: string) => {
    if (!iso) return null;
    const d = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  };

  const dateLimit = useMemo(() => {
    if (range === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (range === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    }
    return null;
  }, [range]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return gastos
      .filter((g) => {
        if (estado === "pagado" && !g.estado) return false;
        if (estado === "pendiente" && g.estado) return false;
        if (dateLimit) {
          const d = parseISO(g.fecha);
          if (!d || d < dateLimit) return false;
        }
        if (q.length > 0) {
          const pagador = g.pagador_nombre || nombreParticipante(g.participante_id) || "";
          const hay =
            g.descripcion.toLowerCase().includes(q) ||
            pagador.toLowerCase().includes(q) ||
            (g.moneda || "").toLowerCase().includes(q);
          if (!hay) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "monto") {
          return (a.monto - b.monto) * (sortDir === "asc" ? 1 : -1);
        }
        const da = parseISO(a.fecha)?.getTime() ?? 0;
        const db = parseISO(b.fecha)?.getTime() ?? 0;
        return (db - da) * (sortDir === "desc" ? 1 : -1);
      });
  }, [gastos, estado, dateLimit, search, sortBy, sortDir, nombreParticipante]);

  const totalEvento = useMemo(
    () => gastos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0),
    [gastos]
  );
  const totalFiltrado = useMemo(
    () => filtered.reduce((acc, g) => acc + (Number(g.monto) || 0), 0),
    [filtered]
  );

  // Agrupación para la lista
  type ItemGroup = { key: string; title: string; total: number; items: Gasto[] };
  const grouped: ItemGroup[] = useMemo(() => {
    if (groupBy === "none")
      return [{ key: "all", title: "Todos los gastos", total: totalFiltrado, items: filtered }];
    const map = new Map<string, ItemGroup>();
    if (groupBy === "pagador") {
      filtered.forEach((g) => {
        const name = g.pagador_nombre || nombreParticipante(g.participante_id) || "—";
        const key = name;
        if (!map.has(key)) map.set(key, { key, title: name, total: 0, items: [] });
        const grp = map.get(key)!;
        grp.items.push(g);
        grp.total += Number(g.monto) || 0;
      });
    } else {
      filtered.forEach((g) => {
        const key = g.fecha ? fmtDate(g.fecha) : "Sin fecha";
        if (!map.has(key)) map.set(key, { key, title: key, total: 0, items: [] });
        const grp = map.get(key)!;
        grp.items.push(g);
        grp.total += Number(g.monto) || 0;
      });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered, groupBy, totalFiltrado, nombreParticipante]);

  const toggleExpand = (k: string) => setExpanded((prev) => ({ ...prev, [k]: !prev[k] }));

  /* ====== DATA PARA GRÁFICAS EN VIVO (según filtros) ====== */
  const topPagadores = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((g) => {
      const name = g.pagador_nombre || nombreParticipante(g.participante_id) || "—";
      map.set(name, (map.get(name) ?? 0) + (Number(g.monto) || 0));
    });
    const arr = Array.from(map.entries()).map(([nombre, monto]) => ({ nombre, monto }));
    return arr.sort((a, b) => b.monto - a.monto).slice(0, 5);
  }, [filtered, nombreParticipante]);

  const barDataTopPagadores = useMemo(
    () => ({
      labels: topPagadores.map((x) =>
        x.nombre.length > 12 ? x.nombre.slice(0, 12) + "…" : x.nombre
      ),
      datasets: [{ data: topPagadores.map((x) => Math.round(x.monto)) }],
    }),
    [topPagadores]
  );

  const totalsEstado = useMemo(() => {
    let pagado = 0,
      pendiente = 0;
    filtered.forEach((g) => (g.estado ? (pagado += g.monto) : (pendiente += g.monto)));
    return { pagado, pendiente };
  }, [filtered]);

  const pieDataEstado = useMemo(
    () => [
      {
        name: "Pagado",
        amount: Math.round(totalsEstado.pagado),
        color: "#10B981",
        legendFontColor: TEXT_MUTED,
        legendFontSize: Math.round(11 * S),
      },
      {
        name: "Pendiente",
        amount: Math.round(totalsEstado.pendiente),
        color: "#F59E0B",
        legendFontColor: TEXT_MUTED,
        legendFontSize: Math.round(11 * S),
      },
    ],
    [totalsEstado]
  );

  /* ==================  UI  ================== */
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ color: TEXT_MUTED, marginTop: 8 }}>Cargando dashboard…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Math.round(20 * S) }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>Reparte+</Text>
        <Text style={styles.pageTitle}>Dashboard del Evento</Text>
        <Text style={styles.groupName}>{grupo?.nombre ?? "Evento"}</Text>

        <View style={styles.badgesRow}>
          <InfoBadge icon="calendar-start" label="Inicio" value={fmtDate(grupo?.fecha_inicio)} />
          <InfoBadge icon="calendar-end" label="Término" value={fmtDate(grupo?.fecha_cierre)} />
          <InfoBadge icon="account" label="Creador" value={grupo?.creador_nombre || "—"} />
        </View>
      </View>

      {/* KPIs */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resumen</Text>
        <View style={styles.kpis}>
          <Kpi label="Total del evento" value={money(totalEvento)} icon="cash-multiple" />
          <Kpi label="Gastos filtrados" value={`${filtered.length}`} icon="filter-variant" />
          <Kpi label="Total filtrado" value={money(totalFiltrado)} icon="chart-donut" />
        </View>
      </View>

      {/* Controles */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Controles</Text>

        <View style={styles.searchRow}>
          <MaterialCommunityIcons name="magnify" size={18} color={TEXT_MUTED} />
          <TextInput
            placeholder="Buscar (concepto, pagador, CLP...)"
            placeholderTextColor={TEXT_MUTED}
            value={search}
            onChangeText={setSearch}
            style={styles.input}
          />
        </View>

        <View style={styles.rowChips}>
          <Chip label="Todo" active={range === "all"} onPress={() => setRange("all")} />
          <Chip label="7 días" active={range === "7d"} onPress={() => setRange("7d")} />
          <Chip label="30 días" active={range === "30d"} onPress={() => setRange("30d")} />
        </View>

        <View style={styles.rowChips}>
          <Chip label="Todos" active={estado === "all"} onPress={() => setEstado("all")} />
          <Chip label="Pagados" active={estado === "pagado"} onPress={() => setEstado("pagado")} />
          <Chip
            label="Pendientes"
            active={estado === "pendiente"}
            onPress={() => setEstado("pendiente")}
          />
        </View>

        <View style={styles.rowChips}>
          <Chip
            label={`Orden: ${sortBy === "fecha" ? "Fecha" : "Monto"}`}
            active
            onPress={() => setSortBy(sortBy === "fecha" ? "monto" : "fecha")}
            icon={sortBy === "fecha" ? "calendar-range" : "cash"}
          />
          <Chip
            label={sortDir === "desc" ? "Desc" : "Asc"}
            active
            onPress={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
            icon={sortDir === "desc" ? "arrow-down" : "arrow-up"}
          />
          <Chip
            label={`Agrupar: ${
              groupBy === "none" ? "Ninguno" : groupBy === "pagador" ? "Pagador" : "Fecha"
            }`}
            active
            onPress={() =>
              setGroupBy(groupBy === "none" ? "pagador" : groupBy === "pagador" ? "fecha" : "none")
            }
            icon="view-grid-outline"
          />
        </View>
      </View>

      {/* ===== Gráficas (según filtros actuales) ===== */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gráficas (con filtros)</Text>

        {/* Top pagadores */}
        <Text style={styles.cardSub}>Top pagadores (monto)</Text>
        {topPagadores.length > 0 ? (
          <BarChart
            width={chartWidth}
            height={chartHeight}
            data={barDataTopPagadores}
            yAxisLabel=""
            yAxisSuffix=" CLP"
            chartConfig={{
              backgroundGradientFrom: CARD,
              backgroundGradientTo: CARD,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(14,165,164,${opacity})`,
              labelColor: () => TEXT_MUTED,
              propsForDots: { r: "0" },
              propsForBackgroundLines: { stroke: BORDER },
            }}
            style={{ borderRadius: 12, alignSelf: "center", marginTop: 8 }}
            fromZero
            showBarTops={false}
          />
        ) : (
          <Text style={styles.emptyInfo}>No hay datos para este gráfico.</Text>
        )}

        {/* Pie estado */}
        <Text style={[styles.cardSub, { marginTop: 12 }]}>Monto por estado</Text>
        {totalsEstado.pagado + totalsEstado.pendiente > 0 ? (
          <PieChart
            data={pieDataEstado.map((d) => ({
              name: d.name,
              population: d.amount,
              color: d.color,
              legendFontColor: d.legendFontColor,
              legendFontSize: d.legendFontSize,
            }))}
            width={chartWidth}
            height={Math.round(180 * S)}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="16"
            absolute
            hasLegend
            chartConfig={{
              color: () => PRIMARY,
              labelColor: () => TEXT_MUTED,
            }}
            style={{ alignSelf: "center", marginTop: 8 }}
          />
        ) : (
          <Text style={styles.emptyInfo}>Sin montos para mostrar.</Text>
        )}
      </View>

      {/* ===== Lista / dashboard de gastos ===== */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gastos</Text>
        {grouped.map((grp) => {
          const isOpen = expanded[grp.key] ?? true;
          return (
            <View key={grp.key} style={styles.groupBlock}>
              {groupBy !== "none" && (
                <Pressable
                  onPress={() => toggleExpand(grp.key)}
                  style={({ pressed }) => [styles.groupHeader, pressed && { opacity: 0.85 }]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <MaterialCommunityIcons
                      name={isOpen ? "chevron-down" : "chevron-right"}
                      size={18}
                      color={INK}
                    />
                    <Text style={styles.groupTitle}>{grp.title}</Text>
                  </View>
                  <Text style={styles.groupTotal}>{money(grp.total)}</Text>
                </Pressable>
              )}

              {(isOpen ? grp.items : []).map((g) => {
                const pagador = g.pagador_nombre || nombreParticipante(g.participante_id) || "—";
                return (
                  <View key={g.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{g.descripcion}</Text>
                      <Text style={styles.rowSub}>
                        {g.estado ? "Pagado" : "Pendiente"} • {pagador}
                        {g.fecha ? ` • ${fmtDate(g.fecha)}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.rowAmount}>{money(g.monto)}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}

        {filtered.length === 0 && (
          <Text style={{ color: TEXT_MUTED, marginTop: 6 }}>
            No hay gastos con los filtros actuales.
          </Text>
        )}
      </View>

      {/* Volver */}
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}
        android_ripple={{ color: "rgba(255,255,255,0.15)" }}
      >
        <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
        <Text style={styles.backBtnText}>Volver al grupo</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ==================  UI helpers  ================== */
const InfoBadge = ({ icon, label, value }: { icon: any; label: string; value?: string }) => (
  <View style={styles.badge}>
    <MaterialCommunityIcons name={icon} size={16} color={PRIMARY} />
    <View style={{ marginLeft: Math.round(6 * S) }}>
      <Text style={styles.badgeLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.badgeValue}>{value || "—"}</Text>
    </View>
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
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.9 },
      ]}
      hitSlop={6}
    >
      {icon && (
        <MaterialCommunityIcons
          name={icon}
          size={14}
          color={active ? "#fff" : PRIMARY}
          style={{ marginRight: 4 }}
        />
      )}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/* ==================  estilos ================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: BG },

  header: {
    paddingHorizontal: Math.round(12 * S),
    paddingTop: Math.round(14 * S),
    paddingBottom: Math.round(8 * S),
  },
  appTitle: { fontSize: Math.round(18 * S), fontWeight: "800", color: INK, textAlign: "center" },
  pageTitle: {
    fontSize: Math.round(16 * S),
    fontWeight: "700",
    color: INK,
    textAlign: "center",
    marginTop: Math.round(2 * S),
  },
  groupName: {
    fontSize: Math.round(22 * S),
    fontWeight: "800",
    color: INK,
    textAlign: "center",
    marginTop: Math.round(4 * S),
  },

  badgesRow: { flexDirection: "row", gap: Math.round(8 * S), marginTop: Math.round(10 * S) },
  badge: {
    flex: 1,
    backgroundColor: CARD,
    padding: Math.round(10 * S),
    borderRadius: Math.round(14 * S),
    borderWidth: 1,
    borderColor: BORDER,
  },
  badgeLabel: { fontSize: Math.round(10 * S), color: TEXT_MUTED, fontWeight: "700", letterSpacing: 0.4 },
  badgeValue: { fontSize: Math.round(13 * S), color: TEXT, marginTop: Math.round(3 * S), fontWeight: "700" },

  card: {
    marginHorizontal: Math.round(12 * S),
    marginTop: Math.round(12 * S),
    backgroundColor: CARD,
    borderRadius: Math.round(14 * S),
    borderWidth: 1,
    borderColor: BORDER,
    padding: Math.round(10 * S),
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTitle: { fontSize: Math.round(16 * S), fontWeight: "800", color: INK },
  cardSub: { fontSize: Math.round(12 * S), color: TEXT_MUTED, marginTop: Math.round(6 * S) },
  emptyInfo: { color: TEXT_MUTED, marginTop: Math.round(8 * S), fontSize: Math.round(12 * S) },

  kpis: { flexDirection: "row", gap: Math.round(8 * S), marginTop: Math.round(8 * S) },
  kpi: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: Math.round(10 * S),
    borderRadius: Math.round(12 * S),
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  kpiValue: { fontSize: Math.round(16 * S), fontWeight: "800", color: INK, marginTop: Math.round(2 * S) },
  kpiLabel: { fontSize: Math.round(11 * S), color: TEXT_MUTED, marginTop: Math.round(2 * S), textAlign: "center" },

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
  input: { flex: 1, color: INK, paddingVertical: 2, fontSize: Math.round(13 * S) },

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
  chipText: { color: PRIMARY, fontWeight: "700", fontSize: Math.round(12 * S) },
  chipTextActive: { color: "#fff" },

  /* Lista / grupos */
  groupBlock: { marginTop: 6 },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  groupTitle: { color: INK, fontWeight: "800", fontSize: Math.round(14 * S) },
  groupTotal: { color: INK, fontWeight: "800", fontSize: Math.round(13 * S) },

  row: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingVertical: Math.round(10 * S),
  },
  rowTitle: { color: INK, fontWeight: "800", fontSize: Math.round(15 * S) },
  rowSub: { color: TEXT_MUTED, marginTop: Math.round(2 * S), fontSize: Math.round(12 * S) },
  rowAmount: { color: INK, fontWeight: "800", fontSize: Math.round(13 * S) },

  backBtn: {
    marginHorizontal: Math.round(12 * S),
    marginTop: Math.round(16 * S),
    marginBottom: Math.round(18 * S),
    backgroundColor: PRIMARY,
    borderRadius: Math.round(16 * S),
    paddingVertical: Math.round(14 * S),
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: Math.round(6 * S),
    borderWidth: 1,
    borderColor: SECONDARY,
    shadowColor: PRIMARY,
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  backBtnText: { color: "#fff", fontSize: Math.round(14 * S), fontWeight: "800" },
});
