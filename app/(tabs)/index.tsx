import React from "react";
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
import { colors, spacing, radius, typography, shadows } from "../constants/theme";
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
  const { data: summary, isLoading, isError, refetch, isRefetching } = useDashboardSummary();
  const { data: alerts } = useInventoryAlerts();

  const redItems = alerts?.filter((a) => a.alertStatus === "RED") ?? [];
  const yellowItems = alerts?.filter((a) => a.alertStatus === "YELLOW") ?? [];

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (isError || !summary) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorTitle}>Sin conexión con la API</Text>
        <Text style={styles.errorSub}>
          Asegúrate de que el servidor esté corriendo en localhost:3000
        </Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const s = summary;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.gold}
        />
      }
    >
      {/* ── Header date ── */}
      <View style={styles.dateRow}>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString("es-MX", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </Text>
      </View>

      {/* ── Alert summary bar ── */}
      {(s.alerts.red > 0 || s.alerts.yellow > 0) && (
        <Pressable
          style={[styles.alertBar, s.alerts.red > 0 ? styles.alertBarRed : styles.alertBarYellow]}
          onPress={() => router.push("/(tabs)/inventory")}
        >
          <Text style={[styles.alertBarText, s.alerts.red > 0 ? { color: colors.red } : { color: colors.yellow }]}>
            {s.alerts.red > 0
              ? `🔴 ${s.alerts.red} materiales PEDIR YA · ${s.alerts.yellow} pedir pronto`
              : `🟡 ${s.alerts.yellow} materiales pedir pronto`}
          </Text>
          <Text style={[styles.alertBarAction, { color: s.alerts.red > 0 ? colors.red : colors.yellow }]}>
            Ver →
          </Text>
        </Pressable>
      )}

      {/* ── KPI row 1: Alerts ── */}
      <SectionHeader title="ALERTAS JIT (HOY)" action="Ver inventario" onAction={() => router.push("/(tabs)/inventory")} />
      <View style={styles.kpiRow}>
        <KPICard
          label="🔴 PEDIR YA"
          value={s.alerts.red}
          sub="materiales críticos"
          accent="red"
          onPress={() => router.push("/(tabs)/inventory")}
        />
        <KPICard
          label="🟡 PEDIR PRONTO"
          value={s.alerts.yellow}
          sub="materiales con alerta"
          accent="yellow"
          onPress={() => router.push("/(tabs)/inventory")}
        />
        <KPICard
          label="🟢 OK"
          value={s.alerts.green}
          sub="materiales en stock"
          accent="green"
        />
      </View>

      {/* ── KPI row 2: Production & Spend ── */}
      <SectionHeader title="PRODUCCIÓN & GASTO" />
      <View style={styles.kpiRow}>
        <KPICard
          label="LOTES · 7 DÍAS"
          value={s.upcoming.batches}
          sub={`${s.upcoming.plans.length} estilos planificados`}
          accent="gold"
          onPress={() => router.push("/(tabs)/production")}
        />
        <KPICard
          label="KG MALTA · 7 DÍAS"
          value={s.upcoming.maltKg.toFixed(0)}
          sub="kg necesarios"
          accent="cream"
        />
        <KPICard
          label="GASTO ESTE MES"
          value={MXN(s.monthlySpend.total)}
          sub={`${s.monthlySpend.orderCount} pedidos`}
          accent="gold"
          onPress={() => router.push("/(tabs)/orders")}
        />
      </View>

      {/* ── Critical alerts list ── */}
      {redItems.length > 0 && (
        <>
          <SectionHeader
            title="PEDIR HOY"
            action="Ver todos"
            onAction={() => router.push("/(tabs)/inventory")}
          />
          <View style={styles.alertList}>
            {redItems.slice(0, 6).map((item) => (
              <AlertItem key={item.id} item={item} />
            ))}
          </View>
        </>
      )}

      {/* ── Upcoming production ── */}
      {s.upcoming.plans.length > 0 && (
        <>
          <SectionHeader
            title="PRÓXIMA PRODUCCIÓN"
            action="Ver plan"
            onAction={() => router.push("/(tabs)/production")}
          />
          <View style={styles.prodList}>
            {s.upcoming.plans.slice(0, 4).map((plan) => (
              <View key={plan.id} style={styles.prodCard}>
                <Text style={styles.prodEmoji}>
                  {STYLE_EMOJIS[plan.style] ?? "🍺"}
                </Text>
                <View style={styles.prodInfo}>
                  <Text style={styles.prodStyle}>{plan.style}</Text>
                  <Text style={styles.prodSub}>
                    {plan.plannedBatches} lote{plan.plannedBatches > 1 ? "s" : ""} ·{" "}
                    {new Date(plan.productionDate).toLocaleDateString("es-MX", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </Text>
                </View>
                <View style={styles.prodNums}>
                  <Text style={styles.prodNumVal}>{plan.totalMaltKg}kg</Text>
                  <Text style={styles.prodNumLabel}>malta</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {redItems.length === 0 && s.alerts.yellow === 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <EmptyState icon="✅" title="Todo en orden" subtitle="No hay alertas activas. Sigue así." />
        </View>
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

function AlertItem({ item }: { item: InventoryRow }) {
  const mat = item.material!;
  const coverage =
    item.dailyConsumption > 0
      ? Math.round(item.currentStock / item.dailyConsumption)
      : 0;

  return (
    <View style={styles.alertItem}>
      <AlertBadge status={item.alertStatus} compact />
      <View style={styles.alertItemInfo}>
        <Text style={styles.alertItemName} numberOfLines={1}>{mat.name}</Text>
        <Text style={styles.alertItemSub}>
          Stock: {item.currentStock} {mat.unit} · {coverage}d cobertura
        </Text>
      </View>
      <View style={styles.alertItemRight}>
        <Text style={styles.alertItemQty}>
          {item.quantityToOrder.toFixed(1)} {mat.unit}
        </Text>
        <Text style={styles.alertItemLabel}>a pedir</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xl },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: spacing.lg },
  errorTitle: { ...typography.h3, color: colors.textPrimary, textAlign: "center", marginBottom: spacing.xs },
  errorSub: { ...typography.bodySmall, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.lg },
  retryBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold },
  retryText: { ...typography.label, color: colors.gold },

  dateRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  dateText: { ...typography.bodySmall, textTransform: "capitalize" },

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
  alertBarRed: { backgroundColor: colors.redBg, borderColor: colors.red },
  alertBarYellow: { backgroundColor: colors.yellowBg, borderColor: colors.yellow },
  alertBarText: { ...typography.bodySmall, fontWeight: "600", flex: 1 },
  alertBarAction: { ...typography.label, fontSize: 11, marginLeft: spacing.sm },

  kpiRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    flexWrap: "wrap",
  },

  alertList: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  alertItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  alertItemInfo: { flex: 1, gap: 2 },
  alertItemName: { ...typography.h4, fontSize: 13 },
  alertItemSub: { ...typography.caption },
  alertItemRight: { alignItems: "flex-end" },
  alertItemQty: { ...typography.bodySmall, fontWeight: "700", color: colors.red },
  alertItemLabel: { ...typography.caption },

  prodList: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  prodCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  prodEmoji: { fontSize: 22, width: 32, textAlign: "center" },
  prodInfo: { flex: 1, gap: 2 },
  prodStyle: { ...typography.h4, fontSize: 14 },
  prodSub: { ...typography.caption },
  prodNums: { alignItems: "flex-end" },
  prodNumVal: { ...typography.bodySmall, fontWeight: "700", color: colors.cream },
  prodNumLabel: { ...typography.caption },
});
