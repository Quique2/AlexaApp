import React, { useMemo } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { spacing, radius, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { EmptyState } from "../components/EmptyState";
import { useDashboardSummary } from "../hooks/useDashboard";
import { useInventoryAlerts } from "../hooks/useInventory";
import type { InventoryRow } from "../types";

const MXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

const STYLE_EMOJIS: Record<string, string> = {
  "Löndon": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Whïte": "🌾",
  "Kölsh": "🇩🇪",
  "Mëxican IPA": "🌶️",
  "Monterrëy Stout": "⚫",
  "Edición especial": "✨",
};

export default function DashboardScreen() {
  const router = useRouter();
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: summary, isLoading, isError, refetch, isRefetching } = useDashboardSummary();
  const { data: alerts } = useInventoryAlerts();

  const urgentItems = alerts?.filter(
    (a) => a.alertStatus === "CRITICAL" || a.alertStatus === "RED"
  ) ?? [];

  if (isLoading) {
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
  const hasUrgent = s.alerts.critical > 0 || s.alerts.red > 0;
  const hasWarning = s.alerts.yellow > 0;
  const headline = hasUrgent
    ? "Requiere atención"
    : hasWarning
    ? "Hay materiales con margen"
    : s.alerts.ok > 0
    ? "Producción reservada"
    : "Todo en orden";

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />
      }
    >
      {/* ── Header ────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={[typography.caption, { textTransform: "capitalize", letterSpacing: 0 }]}>
          {new Date().toLocaleDateString("es-MX", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </Text>
        <Text style={[typography.h2, { marginTop: 2 }]}>{headline}</Text>
      </View>

      {/* ── Alert strip ───────────────────────────────────── */}
      <Pressable
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
      </Pressable>

      {/* ── KPI grid ──────────────────────────────────────── */}
      <View style={styles.kpiRow}>
        <KPITile
          label="Lotes · 7 días"
          value={String(s.upcoming.batches)}
          sub={`${s.upcoming.plans.length} estilo${s.upcoming.plans.length !== 1 ? "s" : ""} planificados`}
          accentColor={colors.gold}
          onPress={() => router.push("/production")}
          colors={colors}
          typography={typography}
        />
        <KPITile
          label="Malta · 7 días"
          value={`${s.upcoming.maltKg.toFixed(0)} kg`}
          sub="total próxima producción"
          accentColor={colors.cream}
          colors={colors}
          typography={typography}
        />
      </View>

      <Pressable
        style={[styles.spendCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push("/orders")}
      >
        <View>
          <Text style={[typography.label, { fontSize: 10, marginBottom: 4 }]}>GASTO DEL MES</Text>
          <Text style={[typography.h2, { color: colors.gold, letterSpacing: -0.5 }]}>
            {MXN(s.monthlySpend.total)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>
            {s.monthlySpend.orderCount}
          </Text>
          <Text style={typography.caption}>pedidos este mes</Text>
        </View>
      </Pressable>

      {/* ── Upcoming plans ────────────────────────────────── */}
      {s.upcoming.plans.length > 0 && (
        <>
          <SectionRow
            title="PRÓXIMA PRODUCCIÓN"
            action="VER PLAN"
            onAction={() => router.push("/production")}
            colors={colors}
            typography={typography}
          />
          <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {s.upcoming.plans.slice(0, 4).map((plan, i) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                colors={colors}
                typography={typography}
                isLast={i === Math.min(s.upcoming.plans.length, 4) - 1}
              />
            ))}
          </View>
        </>
      )}

      {/* ── Urgent items ──────────────────────────────────── */}
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
            {urgentItems.slice(0, 5).map((item, i) => (
              <UrgentItem
                key={item.id}
                item={item}
                colors={colors}
                typography={typography}
                isLast={i === Math.min(urgentItems.length, 5) - 1}
              />
            ))}
          </View>
        </>
      )}

      {!hasUrgent && !hasWarning && urgentItems.length === 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <EmptyState icon="✅" title="Todo en orden" subtitle="No hay alertas activas." />
        </View>
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

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
      <Text style={[typography.label, { fontSize: 10, marginBottom: spacing.sm }]}>{label}</Text>
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
      <Text style={[typography.label, { fontSize: 11, color: titleColor ?? colors.textMuted }]}>
        {title}
      </Text>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
});

// ─── PlanRow ──────────────────────────────────────────────────────────────────

function PlanRow({
  plan, colors, typography, isLast,
}: {
  plan: any; colors: Colors; typography: any; isLast: boolean;
}) {
  const date = new Date(plan.productionDate).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return (
    <View style={[rowStyles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={{ fontSize: 20, width: 32, textAlign: "center" }}>
        {STYLE_EMOJIS[plan.style] ?? "🍺"}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={[typography.h4, { fontSize: 13 }]} numberOfLines={1}>{plan.style}</Text>
        <Text style={typography.caption}>
          {plan.plannedBatches} lote{plan.plannedBatches > 1 ? "s" : ""} · {date}
        </Text>
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

function UrgentItem({
  item, colors, typography, isLast,
}: {
  item: InventoryRow; colors: Colors; typography: any; isLast: boolean;
}) {
  const mat = item.material!;
  const isCritical = item.alertStatus === "CRITICAL";
  const dotColor = isCritical ? colors.red : colors.yellow;
  return (
    <View style={[rowStyles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor, marginHorizontal: 4 }} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.h4, { fontSize: 13 }]} numberOfLines={1}>{mat.name}</Text>
        <Text style={typography.caption}>
          {item.currentStock} {mat.unit} · {isCritical ? "Sin pedido activo" : "Pedido llega tarde"}
        </Text>
      </View>
      <View
        style={[
          urgentStyles.tag,
          {
            borderColor: dotColor,
            backgroundColor: isCritical ? colors.redBg : colors.yellowBg,
          },
        ]}
      >
        <Text style={[typography.label, { fontSize: 8, color: dotColor }]}>
          {isCritical ? "CRÍTICO" : "URGENTE"}
        </Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
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
    retryBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    header: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    alertStrip: {
      marginHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: "row",
      overflow: "hidden",
      marginBottom: spacing.md,
    },
    stripDiv: { width: 1 },
    kpiRow: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    spendCard: {
      marginHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    list: {
      marginHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: "hidden",
    },
  });
}
