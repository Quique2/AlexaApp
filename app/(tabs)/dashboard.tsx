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
import { KPICard } from "../components/KPICard";
import { AlertBadge } from "../components/AlertBadge";
import { SectionHeader } from "../components/SectionHeader";
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

  const redItems = alerts?.filter((a) => a.alertStatus === "RED") ?? [];
  const yellowItems = alerts?.filter((a) => a.alertStatus === "YELLOW") ?? [];

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (isError || !summary) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <Text style={[typography.h3, { textAlign: "center", marginBottom: spacing.xs }]}>
          Sin conexión con la API
        </Text>
        <Text style={[typography.bodySmall, { textAlign: "center", marginBottom: spacing.lg }]}>
          Asegúrate de que el servidor esté corriendo en localhost:3000
        </Text>
        <Pressable onPress={() => refetch()} style={[styles.retryBtn, { borderColor: colors.gold }]}>
          <Text style={[typography.label, { color: colors.gold }]}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const s = summary;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />
      }
    >
      <View style={styles.dateRow}>
        <Text style={typography.bodySmall}>
          {new Date().toLocaleDateString("es-MX", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </Text>
      </View>

      {(s.alerts.red > 0 || s.alerts.yellow > 0) && (
        <Pressable
          style={[
            styles.alertBar,
            s.alerts.red > 0
              ? { backgroundColor: colors.redBg, borderColor: colors.red }
              : { backgroundColor: colors.yellowBg, borderColor: colors.yellow },
          ]}
          onPress={() => router.push("/inventory")}
        >
          <Text
            style={[
              typography.bodySmall,
              { fontWeight: "600", flex: 1, color: s.alerts.red > 0 ? colors.red : colors.yellow },
            ]}
          >
            {s.alerts.red > 0
              ? `🔴 ${s.alerts.red} materiales PEDIR YA · ${s.alerts.yellow} pedir pronto`
              : `🟡 ${s.alerts.yellow} materiales pedir pronto`}
            {s.alerts.critical > 0 ? ` · ⚠ ${s.alerts.critical} críticos JIT` : ""}
          </Text>
          <Text style={[typography.label, { color: s.alerts.red > 0 ? colors.red : colors.yellow }]}>
            Ver →
          </Text>
        </Pressable>
      )}

      <SectionHeader title="ALERTAS JIT (HOY)" action="Ver inventario" onAction={() => router.push("/inventory")} />
      <View style={styles.kpiRow}>
        <KPICard label="🔴 PEDIR YA" value={s.alerts.red} sub="materiales críticos" accent="red" onPress={() => router.push("/inventory")} />
        <KPICard label="🟡 PEDIR PRONTO" value={s.alerts.yellow} sub="materiales con alerta" accent="yellow" onPress={() => router.push("/inventory")} />
        <KPICard label="🟢 OK" value={s.alerts.green} sub="materiales en stock" accent="green" />
      </View>
      {s.alerts.critical > 0 && (
        <Pressable
          style={[styles.criticalBar, { backgroundColor: colors.redBg, borderColor: colors.red }]}
          onPress={() => router.push("/inventory")}
        >
          <Text style={[typography.bodySmall, { fontWeight: "700", color: colors.red, flex: 1 }]}>
            ⚠ {s.alerts.critical} material{s.alerts.critical > 1 ? "es" : ""} crítico{s.alerts.critical > 1 ? "s" : ""} para producción pendiente
          </Text>
          <Text style={[typography.label, { color: colors.red }]}>Ver →</Text>
        </Pressable>
      )}

      <SectionHeader title="PRODUCCIÓN & GASTO" />
      <View style={styles.kpiRow}>
        <KPICard label="LOTES · 7 DÍAS" value={s.upcoming.batches} sub={`${s.upcoming.plans.length} estilos planificados`} accent="gold" onPress={() => router.push("/production")} />
        <KPICard label="KG MALTA · 7 DÍAS" value={s.upcoming.maltKg.toFixed(0)} sub="kg necesarios" accent="cream" />
        <KPICard label="GASTO ESTE MES" value={MXN(s.monthlySpend.total)} sub={`${s.monthlySpend.orderCount} pedidos`} accent="gold" onPress={() => router.push("/orders")} />
      </View>

      {redItems.length > 0 && (
        <>
          <SectionHeader title="PEDIR HOY" action="Ver todos" onAction={() => router.push("/inventory")} />
          <View style={[styles.alertList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {redItems.slice(0, 6).map((item) => (
              <AlertItem key={item.id} item={item} />
            ))}
          </View>
        </>
      )}

      {s.upcoming.plans.length > 0 && (
        <>
          <SectionHeader title="PRÓXIMA PRODUCCIÓN" action="Ver plan" onAction={() => router.push("/production")} />
          <View style={[styles.prodList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {s.upcoming.plans.slice(0, 4).map((plan) => (
              <ProdCard key={plan.id} plan={plan} colors={colors} typography={typography} borderColor={colors.border} />
            ))}
          </View>
        </>
      )}

      {redItems.length === 0 && yellowItems.length === 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <EmptyState icon="✅" title="Todo en orden" subtitle="No hay alertas activas. Sigue así." />
        </View>
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

function AlertItem({ item }: { item: InventoryRow }) {
  const { colors, typography } = useTheme();
  const mat = item.material!;
  const coverage =
    item.dailyConsumption > 0
      ? Math.round(item.currentStock / item.dailyConsumption)
      : 0;

  return (
    <View style={[alertItemStyles.row, { borderBottomColor: colors.border }]}>
      <AlertBadge status={item.alertStatus} compact />
      <View style={alertItemStyles.info}>
        <Text style={[typography.h4, { fontSize: 13 }]} numberOfLines={1}>{mat.name}</Text>
        <Text style={typography.caption}>
          Stock: {item.currentStock} {mat.unit} · {coverage}d cobertura
        </Text>
      </View>
      <View style={alertItemStyles.right}>
        <Text style={[typography.bodySmall, { fontWeight: "700", color: colors.red }]}>
          {item.quantityToOrder.toFixed(1)} {mat.unit}
        </Text>
        <Text style={typography.caption}>a pedir</Text>
      </View>
    </View>
  );
}

const alertItemStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
  },
  info: { flex: 1, gap: 2 },
  right: { alignItems: "flex-end" },
});

function ProdCard({
  plan,
  colors,
  typography,
  borderColor,
}: {
  plan: any;
  colors: Colors;
  typography: any;
  borderColor: string;
}) {
  return (
    <View style={[prodCardStyles.card, { borderBottomColor: borderColor }]}>
      <Text style={prodCardStyles.emoji}>{STYLE_EMOJIS[plan.style] ?? "🍺"}</Text>
      <View style={prodCardStyles.info}>
        <Text style={[typography.h4, { fontSize: 14 }]}>{plan.style}</Text>
        <Text style={typography.caption}>
          {plan.plannedBatches} lote{plan.plannedBatches > 1 ? "s" : ""} ·{" "}
          {new Date(plan.productionDate).toLocaleDateString("es-MX", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </Text>
      </View>
      <View style={prodCardStyles.nums}>
        <Text style={[typography.bodySmall, { fontWeight: "700", color: colors.cream }]}>
          {plan.totalMaltKg}kg
        </Text>
        <Text style={typography.caption}>malta</Text>
      </View>
    </View>
  );
}

const prodCardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
  },
  emoji: { fontSize: 22, width: 32, textAlign: "center" },
  info: { flex: 1, gap: 2 },
  nums: { alignItems: "flex-end" },
});

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: { paddingBottom: spacing.xl },
    loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
    retryBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    dateRow: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    alertBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginHorizontal: spacing.md,
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    criticalBar: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    kpiRow: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      flexWrap: "wrap",
    },
    alertList: {
      marginHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: "hidden",
    },
    prodList: {
      marginHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: "hidden",
    },
  });
}
