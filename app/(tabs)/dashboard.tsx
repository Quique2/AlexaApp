import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  ScrollView, View, Text, StyleSheet, RefreshControl,
  Pressable, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { spacing, radius, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { EmptyState } from "../components/EmptyState";
import { DateRangePicker } from "../components/DateRangePicker";
import { ProductionCalendar } from "../components/ProductionCalendar";
import { useDashboardSummary } from "../hooks/useDashboard";
import { useSettingBool, useSettingNumber, useSetting } from "../hooks/useSettings";
import { useInventoryAlerts } from "../hooks/useInventory";
import { stylesApi } from "../services/api";
import { StyleImage } from "../components/StyleImage";
import type { InventoryRow } from "../types";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function todayISO(): string {
  return toISO(new Date());
}

function addDays(from: string, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function thisMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = toISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return { from, to };
}

function rangeLabel(preset: string, from: string, to: string): string {
  if (preset === "7d")    return "7 días";
  if (preset === "15d")   return "15 días";
  if (preset === "30d")   return "30 días";
  if (preset === "month") return "este mes";
  const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1;
  return `${days} días`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { key: "7d",    label: "7D" },
  { key: "15d",   label: "15D" },
  { key: "30d",   label: "30D" },
  { key: "month", label: "MES" },
  { key: "custom", label: "✎" },
] as const;

type Preset = typeof DATE_PRESETS[number]["key"];

const MATERIAL_TYPES = [
  { label: "Malta",    value: "MALTA" },
  { label: "Lúpulo",  value: "LUPULO" },
  { label: "Levadura", value: "YEAST" },
  { label: "Adjuntos", value: "ADJUNTO" },
  { label: "Otros",    value: "OTRO" },
];

const MATERIAL_LABELS: Record<string, string> = {
  MALTA: "Malta", LUPULO: "Lúpulo", YEAST: "Levadura", ADJUNTO: "Adjuntos", OTRO: "Otros",
};

const MATERIAL_UNITS: Record<string, string> = {
  MALTA: "kg", LUPULO: "kg", YEAST: "g", ADJUNTO: "kg", OTRO: "u",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Settings
  const defaultDays    = useSettingNumber("general",   "defaultDashboardDays",   7);
  const currency       = useSetting("general",         "currency",               "MXN");
  const showCalendar   = useSettingBool("dashboard",   "showProductionCalendar", true);
  const showSpend      = useSettingBool("dashboard",   "showSpendCard",          true);
  const showJITStrip   = useSettingBool("dashboard",   "showJITStrip",           true);
  const plansLimit     = useSettingNumber("dashboard", "upcomingPlansLimit",      4);
  const urgentLimit    = useSettingNumber("dashboard", "urgentItemsLimit",        5);

  const fmtCurrency = useCallback(
    (n: number) => n.toLocaleString("es-MX", { style: "currency", currency, maximumFractionDigits: 0 }),
    [currency]
  );

  const today = todayISO();
  const [preset, setPreset] = useState<Preset>("7d");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 7));
  const [materialType, setMaterialType] = useState("MALTA");
  const settingsInitialized = useRef(false);

  // Apply defaultDashboardDays setting once on first load
  useEffect(() => {
    if (settingsInitialized.current) return;
    settingsInitialized.current = true;
    if (defaultDays === 7) return; // already the default
    const p: Preset = defaultDays === 15 ? "15d" : defaultDays === 30 ? "30d" : "7d";
    setPreset(p);
    setFrom(today);
    setTo(addDays(today, defaultDays));
  }, [defaultDays]);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p === "7d")    { setFrom(today); setTo(addDays(today, 7)); }
    if (p === "15d")   { setFrom(today); setTo(addDays(today, 15)); }
    if (p === "30d")   { setFrom(today); setTo(addDays(today, 30)); }
    if (p === "month") { const r = thisMonthRange(); setFrom(r.from); setTo(r.to); }
  };

  const { data: summary, isLoading, isError, refetch, isRefetching } =
    useDashboardSummary({ from, to, materialType });
  const { data: alerts } = useInventoryAlerts();

  const urgentItems = alerts?.filter(
    (a) => a.alertStatus === "CRITICAL" || a.alertStatus === "RED"
  ) ?? [];

  if (isLoading && !summary) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (isError || !summary) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[typography.h3, { textAlign: "center", marginBottom: spacing.xs }]}>
          Sin conexión con la API
        </Text>
        <Text style={[typography.bodySmall, { textAlign: "center", marginBottom: spacing.lg }]}>
          Asegúrate de que el servidor esté corriendo
        </Text>
        <Pressable onPress={() => refetch()} style={[styles.retryBtn, { borderColor: colors.gold }]}>
          <Text style={[typography.label, { color: colors.gold }]}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const s = summary;
  const hasUrgent  = s.alerts.critical > 0 || s.alerts.red > 0;
  const hasWarning = s.alerts.yellow > 0;
  const headline   = hasUrgent ? "Requiere atención"
    : hasWarning ? "Hay materiales con margen"
    : s.alerts.ok > 0 ? "Producción reservada"
    : "Todo en orden";

  const label = rangeLabel(preset, from, to);
  const matLabel = MATERIAL_LABELS[materialType] ?? materialType;
  const matUnit  = MATERIAL_UNITS[materialType] ?? "kg";

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />
      }
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[typography.caption, { textTransform: "capitalize", letterSpacing: 0 }]}>
          {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
        </Text>
        <Text style={[typography.h2, { marginTop: 2 }]}>{headline}</Text>
      </View>

      {/* ── Date preset chips ── */}
      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {DATE_PRESETS.map((p) => {
          const active = preset === p.key;
          return (
            <Pressable
              key={p.key}
              style={[
                styles.chip,
                { borderColor: active ? colors.gold : colors.border, backgroundColor: active ? colors.gold + "22" : colors.card },
              ]}
              onPress={() => applyPreset(p.key)}
            >
              <Text style={[typography.label, { fontSize: 11, color: active ? colors.gold : colors.textSecondary }]}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Custom calendar ── */}
      {preset === "custom" && (
        <DateRangePicker
          from={from}
          to={to}
          onChange={(f, t) => { setFrom(f); setTo(t); }}
          colors={colors}
          typography={typography}
        />
      )}

      {/* ── Material type selector ── */}
      <View style={[styles.materialRow, { borderBottomColor: colors.border }]}>
        <Text style={[typography.label, { fontSize: 10, color: colors.textMuted, marginRight: spacing.xs }]}>
          MATERIAL:
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
          {MATERIAL_TYPES.map((m) => {
            const active = materialType === m.value;
            return (
              <Pressable
                key={m.value}
                style={[
                  styles.chip,
                  { borderColor: active ? colors.cream : colors.border, backgroundColor: active ? colors.cream + "22" : colors.card },
                ]}
                onPress={() => setMaterialType(m.value)}
              >
                <Text style={[typography.label, { fontSize: 11, color: active ? colors.cream : colors.textSecondary }]}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Alert strip (global JIT status) ── */}
      {showJITStrip && <Pressable
        style={[styles.alertStrip, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push("/inventory")}
      >
        <StripCell value={s.alerts.critical} label="CRÍTICO"    activeColor={colors.red}    activeBg={colors.redBg}    colors={colors} typography={typography} />
        <View style={[styles.stripDiv, { backgroundColor: colors.border }]} />
        <StripCell value={s.alerts.red}      label="URGENTE"    activeColor={colors.red}    activeBg={colors.redBg}    colors={colors} typography={typography} />
        <View style={[styles.stripDiv, { backgroundColor: colors.border }]} />
        <StripCell value={s.alerts.yellow}   label="CON MARGEN" activeColor={colors.yellow} activeBg={colors.yellowBg} colors={colors} typography={typography} />
        <View style={[styles.stripDiv, { backgroundColor: colors.border }]} />
        <StripCell value={s.alerts.ok}       label="VISTO BUENO" activeColor={colors.green} activeBg={colors.greenBg}  colors={colors} typography={typography} />
      </Pressable>}

      {/* ── KPI tiles ── */}
      <View style={styles.kpiRow}>
        <KPITile
          label={`Lotes · ${label}`}
          value={String(s.upcoming.batches)}
          sub={`${s.upcoming.plans.length} estilo${s.upcoming.plans.length !== 1 ? "s" : ""} planificados`}
          accentColor={colors.gold}
          onPress={() => router.push("/production")}
          colors={colors}
          typography={typography}
        />
        <KPITile
          label={`${matLabel} · ${label}`}
          value={`${s.upcoming.materialKg.toFixed(1)} ${matUnit}`}
          sub="total próxima producción"
          accentColor={colors.cream}
          colors={colors}
          typography={typography}
        />
      </View>

      {/* ── Spend card ── */}
      {showSpend && <Pressable
        style={[styles.spendCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push("/orders")}
      >
        <View>
          <Text style={[typography.label, { fontSize: 10, marginBottom: 4 }]}>GASTO DEL MES</Text>
          <Text style={[typography.h2, { color: colors.gold, letterSpacing: -0.5 }]}>
            {fmtCurrency(s.monthlySpend.total)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>{s.monthlySpend.orderCount}</Text>
          <Text style={typography.caption}>pedidos este mes</Text>
        </View>
      </Pressable>}

      {/* ── Production calendar ── */}
      {showCalendar && <>
        <SectionRow
          title="CALENDARIO DE PRODUCCIÓN"
          colors={colors}
          typography={typography}
        />
        <ProductionCalendar colors={colors} typography={typography} />
      </>}

      {/* ── Upcoming plans ── */}
      {s.upcoming.plans.length > 0 && (
        <>
          <SectionRow
            title={`PRODUCCIÓN · ${label.toUpperCase()}`}
            action="VER PLAN"
            onAction={() => router.push("/production")}
            colors={colors}
            typography={typography}
          />
          <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {s.upcoming.plans.slice(0, plansLimit).map((plan, i) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                colors={colors}
                typography={typography}
                isLast={i === Math.min(s.upcoming.plans.length, plansLimit) - 1}
              />
            ))}
          </View>
        </>
      )}

      {/* ── Urgent items ── */}
      {urgentItems.length > 0 && (
        <>
          <SectionRow
            title="PEDIR HOY"
            titleColor={colors.red}
            action="VER TODOS"
            onAction={() => router.push("/inventory")}
            colors={colors}
            typography={typography}
          />
          <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {urgentItems.slice(0, urgentLimit).map((item, i) => (
              <UrgentItem
                key={item.id}
                item={item}
                colors={colors}
                typography={typography}
                isLast={i === Math.min(urgentItems.length, urgentLimit) - 1}
              />
            ))}
          </View>
        </>
      )}

      {s.upcoming.plans.length === 0 && !hasUrgent && !hasWarning && (
        <View style={{ marginTop: spacing.xl }}>
          <EmptyState icon="✅" title="Todo en orden" subtitle={`Sin producción en los próximos ${label}.`} />
        </View>
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

// ─── DateInput ────────────────────────────────────────────────────────────────

// ─── StripCell ────────────────────────────────────────────────────────────────

function StripCell({
  value, label, activeColor, activeBg, colors, typography,
}: {
  value: number; label: string; activeColor: string; activeBg: string;
  colors: Colors; typography: any;
}) {
  const active = value > 0;
  return (
    <View style={[stripStyles.cell, active && { backgroundColor: activeBg }]}>
      <Text style={{ fontSize: 22, fontWeight: "700", lineHeight: 26, color: active ? activeColor : colors.textMuted }}>
        {value}
      </Text>
      <Text style={[typography.label, { fontSize: 8, marginTop: 2, color: active ? activeColor : colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}
const stripStyles = StyleSheet.create({
  cell: { flex: 1, alignItems: "center", paddingVertical: 14 },
});

// ─── KPITile ──────────────────────────────────────────────────────────────────

function KPITile({
  label, value, sub, accentColor, onPress, colors, typography,
}: {
  label: string; value: string; sub: string; accentColor: string;
  onPress?: () => void; colors: Colors; typography: any;
}) {
  return (
    <Pressable
      style={[tileStyles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[tileStyles.accent, { backgroundColor: accentColor }]} />
      <Text style={[typography.label, { fontSize: 10, marginBottom: spacing.sm }]} numberOfLines={1}>{label}</Text>
      <Text style={[typography.h2, { lineHeight: 26 }]}>{value}</Text>
      <Text style={[typography.caption, { marginTop: 2 }]}>{sub}</Text>
    </Pressable>
  );
}
const tileStyles = StyleSheet.create({
  tile: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, overflow: "hidden" },
  accent: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
});

// ─── SectionRow ───────────────────────────────────────────────────────────────

function SectionRow({
  title, titleColor, action, onAction, colors, typography,
}: {
  title: string; titleColor?: string; action?: string; onAction?: () => void;
  colors: Colors; typography: any;
}) {
  return (
    <View style={sectionStyles.row}>
      <Text style={[typography.label, { fontSize: 11, color: titleColor ?? colors.textMuted }]}>{title}</Text>
      {action && (
        <Pressable onPress={onAction}>
          <Text style={[typography.label, { fontSize: 11, color: colors.gold }]}>{action} →</Text>
        </Pressable>
      )}
    </View>
  );
}
const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs,
  },
});

// ─── PlanRow ──────────────────────────────────────────────────────────────────

function PlanRow({ plan, colors, typography, isLast }: { plan: any; colors: Colors; typography: any; isLast: boolean }) {
  const { data: stylesData } = useQuery({ queryKey: ["styles"], queryFn: stylesApi.list });
  const imageUri = stylesData?.find((s) => s.name === plan.style)?.imageUri ?? null;
  const date = new Date(plan.productionDate).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
  return (
    <View style={[rowStyles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <StyleImage name={plan.style} imageUri={imageUri} size={28} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.h4, { fontSize: 13 }]} numberOfLines={1}>{plan.style}</Text>
        <Text style={typography.caption}>{plan.plannedBatches} lote{plan.plannedBatches > 1 ? "s" : ""} · {date}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[typography.bodySmall, { fontWeight: "700", color: colors.cream }]}>
          {plan.totalMaltKg} kg
        </Text>
        <Text style={typography.caption}>malta</Text>
      </View>
    </View>
  );
}

// ─── UrgentItem ───────────────────────────────────────────────────────────────

function UrgentItem({ item, colors, typography, isLast }: { item: InventoryRow; colors: Colors; typography: any; isLast: boolean }) {
  const mat = item.material!;
  const isCritical = item.alertStatus === "CRITICAL";
  const dotColor = isCritical ? colors.red : colors.yellow;
  return (
    <View style={[rowStyles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor, marginHorizontal: 4 }} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.h4, { fontSize: 13 }]} numberOfLines={1}>{mat.name}</Text>
        <Text style={typography.caption}>{item.currentStock} {mat.unit} · {isCritical ? "Sin pedido activo" : "Pedido llega tarde"}</Text>
      </View>
      <View style={[urgentStyles.tag, { borderColor: dotColor, backgroundColor: isCritical ? colors.redBg : colors.yellowBg }]}>
        <Text style={[typography.label, { fontSize: 8, color: dotColor }]}>{isCritical ? "CRÍTICO" : "URGENTE"}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
});
const urgentStyles = StyleSheet.create({
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1 },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: { paddingBottom: spacing.xl },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
    retryBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
    header: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm },
    filterRow: {
      flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm, borderBottomWidth: 1,
    },
    materialRow: {
      flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm, borderBottomWidth: 1, marginBottom: spacing.md,
    },
    chip: {
      paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs,
      borderRadius: radius.full, borderWidth: 1,
    },
    alertStrip: {
      marginHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1,
      flexDirection: "row", overflow: "hidden", marginBottom: spacing.md,
    },
    stripDiv: { width: 1 },
    kpiRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
    spendCard: {
      marginHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1,
      padding: spacing.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    },
    list: { marginHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  });
}
