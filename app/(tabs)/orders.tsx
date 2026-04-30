import React, { useState } from "react";
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../constants/theme";
import { EmptyState } from "../components/EmptyState";
import { useOrders, useUpdateOrder } from "../hooks/useOrders";
import { receptionsApi, ordersApi } from "../services/api";
import { useQueryClient } from "@tanstack/react-query";
import type { Order, OrderStatus } from "../types";

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "Todos", value: "" },
  { label: "Pendientes", value: "PENDING" },
  { label: "En tránsito", value: "IN_TRANSIT" },
  { label: "Recibidos", value: "RECEIVED_COMPLETE" },
  { label: "Cancelados", value: "CANCELLED" },
];

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; icon: string }> = {
  PENDING:           { label: "Pendiente",       color: colors.yellow, bg: colors.yellowBg,          icon: "time-outline" },
  IN_TRANSIT:        { label: "En tránsito",      color: colors.gold,   bg: colors.goldDim + "44",   icon: "airplane-outline" },
  RECEIVED_COMPLETE: { label: "Recibido",         color: colors.green,  bg: colors.greenBg,          icon: "checkmark-circle-outline" },
  RECEIVED_PARTIAL:  { label: "Parc. recibido",   color: colors.yellow, bg: colors.yellowBg,         icon: "alert-circle-outline" },
  CANCELLED:         { label: "Cancelado",        color: colors.none,   bg: colors.noneBg,           icon: "close-circle-outline" },
};

const MXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

function estimatedCost(order: Order): number {
  if (order.totalPaid != null) return order.totalPaid;
  return order.orderedQuantity * (order.material?.unitPrice ?? 0);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "2-digit" });
}

function daysUntil(iso: string | null | undefined) {
  if (!iso) return null;
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `${Math.abs(diff)}d de retraso`, color: colors.red };
  if (diff === 0) return { label: "Llega hoy", color: colors.green };
  if (diff === 1) return { label: "Llega mañana", color: colors.gold };
  return { label: `En ${diff}d`, color: colors.textSecondary };
}

export default function OrdersScreen() {
  const [statusFilter, setStatusFilter] = useState("");
  const [receiveOrder, setReceiveOrder] = useState<Order | null>(null);

  const params = statusFilter ? { status: statusFilter } : undefined;
  const { data: orders, isLoading, refetch, isRefetching } = useOrders(params);
  const updateMutation = useUpdateOrder();

  const advanceStatus = (order: Order) => {
    const next: Partial<Record<OrderStatus, OrderStatus>> = {
      PENDING: "IN_TRANSIT",
    };
    const nextStatus = next[order.status];
    if (nextStatus) {
      updateMutation.mutate({ id: order.id, data: { status: nextStatus } });
    } else if (order.status === "IN_TRANSIT") {
      setReceiveOrder(order);
    }
  };

  const totalCost = orders?.reduce((a, o) => a + estimatedCost(o), 0) ?? 0;
  const pendingCount = orders?.filter((o) => o.status === "PENDING").length ?? 0;
  const transitCount = orders?.filter((o) => o.status === "IN_TRANSIT").length ?? 0;

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Summary bar ── */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{MXN(totalCost)}</Text>
          <Text style={styles.summaryLabel}>Costo total</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardSmall]}>
          <Text style={[styles.summaryValue, { color: colors.yellow, fontSize: 20 }]}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pendientes</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardSmall]}>
          <Text style={[styles.summaryValue, { color: colors.gold, fontSize: 20 }]}>{transitCount}</Text>
          <Text style={styles.summaryLabel}>En tránsito</Text>
        </View>
      </View>

      {/* ── Filter tabs ── */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[styles.filterTab, statusFilter === f.value && styles.filterTabActive]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text style={[styles.filterTabText, statusFilter === f.value && styles.filterTabTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onAdvance={advanceStatus}
            advancing={updateMutation.isPending}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="📋"
            title="Sin pedidos"
            subtitle={statusFilter ? "No hay pedidos con este estado" : "Genera pedidos desde la pantalla de Producción"}
          />
        }
      />

      {receiveOrder && (
        <ReceiveModal order={receiveOrder} onClose={() => setReceiveOrder(null)} />
      )}
    </View>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({
  order,
  onAdvance,
  advancing,
}: {
  order: Order;
  onAdvance: (o: Order) => void;
  advancing: boolean;
}) {
  const cfg = STATUS_CONFIG[order.status];
  const arrival = daysUntil(order.estimatedArrivalDate);
  const canAdvance = order.status === "PENDING" || order.status === "IN_TRANSIT";
  const cost = estimatedCost(order);
  const isEstimated = order.totalPaid == null;

  return (
    <View style={styles.card}>
      {/* Top row: material + status */}
      <View style={styles.cardTop}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardMaterial} numberOfLines={1}>
            {order.material?.name ?? "—"}
          </Text>
          <Text style={styles.cardFolio}>{order.folio}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
          <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
          <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Meta grid */}
      <View style={styles.metaGrid}>
        <MetaCell label="Proveedor" value={order.supplier?.name?.split("(")[0].trim() ?? "—"} />
        <MetaCell
          label="Cantidad"
          value={`${order.orderedQuantity} ${order.material?.unit ?? ""}`}
        />
        <MetaCell
          label={isEstimated ? "Costo est." : "Costo final"}
          value={MXN(cost)}
          valueColor={isEstimated ? colors.textSecondary : colors.cream}
        />
        <MetaCell label="Pedido" value={formatDate(order.orderDate)} />
      </View>

      {/* Arrival chip */}
      {arrival && order.status !== "RECEIVED_COMPLETE" && order.status !== "CANCELLED" && (
        <View style={styles.arrivalChip}>
          <Ionicons name="calendar-outline" size={11} color={arrival.color} />
          <Text style={[styles.arrivalText, { color: arrival.color }]}>
            {arrival.label} · {formatDate(order.estimatedArrivalDate)}
          </Text>
        </View>
      )}

      {/* Action */}
      {canAdvance && (
        <Pressable
          style={[
            styles.advanceBtn,
            order.status === "IN_TRANSIT" && styles.advanceBtnReceive,
            advancing && { opacity: 0.5 },
          ]}
          onPress={() => onAdvance(order)}
          disabled={advancing}
        >
          {order.status === "PENDING" ? (
            <>
              <Ionicons name="airplane-outline" size={13} color={colors.gold} />
              <Text style={styles.advanceBtnText}>Marcar en tránsito</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={13} color={colors.bg} />
              <Text style={[styles.advanceBtnText, { color: colors.bg }]}>Marcar recibido</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

function MetaCell({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, valueColor ? { color: valueColor } : {}]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ─── Receive Modal ────────────────────────────────────────────────────────────
function ReceiveModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [qty, setQty] = useState(String(order.orderedQuantity));
  const [cost, setCost] = useState(
    order.totalPaid != null
      ? String(order.totalPaid)
      : String(Math.round(order.orderedQuantity * (order.material?.unitPrice ?? 0)))
  );
  const [receivedBy, setReceivedBy] = useState("");
  const [batchLot, setBatchLot] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const handleReceive = async () => {
    setLoading(true);
    try {
      await receptionsApi.create({
        receptionDate: new Date().toISOString(),
        orderId: order.id,
        receivedQuantity: parseFloat(qty) || order.orderedQuantity,
        condition: "GOOD",
        isConforming: true,
        batchLot: batchLot || null,
        receivedBy: receivedBy || null,
        notes: null,
      });

      if (cost) {
        await ordersApi.update(order.id, { totalPaid: parseFloat(cost) || null });
      }

      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });

      Alert.alert(
        "✅ Recepción registrada",
        `${qty} ${order.material?.unit ?? ""} de ${order.material?.name} agregados al inventario.`,
        [{ text: "OK", onPress: onClose }]
      );
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Registrar recepción</Text>
              <Text style={typography.caption}>{order.material?.name}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <Field
              label={`Cantidad recibida (${order.material?.unit ?? "unidad"})`}
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
            />
            <Field
              label="Costo final ($MXN)"
              value={cost}
              onChangeText={setCost}
              keyboardType="decimal-pad"
            />
            <Field label="Recibido por" value={receivedBy} onChangeText={setReceivedBy} />
            <Field label="Lote / folio proveedor" value={batchLot} onChangeText={setBatchLot} />

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                El stock se actualizará automáticamente al confirmar.
              </Text>
            </View>

            <Pressable
              style={[styles.confirmBtn, loading && { opacity: 0.6 }]}
              onPress={handleReceive}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.confirmBtnText}>Confirmar recepción</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "decimal-pad" | "number-pad";
}) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? "default"}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  listContent: { paddingBottom: spacing.xxl },

  // Summary
  summaryRow: {
    flexDirection: "row", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs,
  },
  summaryCard: {
    flex: 2, backgroundColor: colors.card, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  summaryCardSmall: { flex: 1 },
  summaryValue: { fontSize: 18, fontWeight: "700", color: colors.gold, letterSpacing: -0.5 },
  summaryLabel: { ...typography.caption, marginTop: 2 },

  // Filter tabs
  filterRow: {
    flexDirection: "row", flexWrap: "wrap", gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.card,
  },
  filterTabActive: { borderColor: colors.gold, backgroundColor: colors.goldDim + "33" },
  filterTabText: { ...typography.label, fontSize: 10, color: colors.textMuted },
  filterTabTextActive: { color: colors.gold },

  // Card
  card: {
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: spacing.sm,
  },
  cardTop: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between", gap: spacing.sm,
  },
  cardTitleBlock: { flex: 1, gap: 2 },
  cardMaterial: { ...typography.h4, fontSize: 14 },
  cardFolio: { ...typography.caption, fontFamily: "monospace" },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.full, borderWidth: 1,
  },
  statusPillText: { ...typography.label, fontSize: 9 },

  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metaCell: { minWidth: 80, flex: 1 },
  metaLabel: { ...typography.caption },
  metaValue: { ...typography.bodySmall, fontWeight: "600", color: colors.textPrimary, marginTop: 1 },

  arrivalChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start",
  },
  arrivalText: { ...typography.caption },

  advanceBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.gold + "88",
    backgroundColor: colors.surface,
  },
  advanceBtnReceive: {
    backgroundColor: colors.gold, borderColor: colors.gold,
  },
  advanceBtnText: { ...typography.label, fontSize: 10, color: colors.gold },

  // Receive modal
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    maxHeight: "85%",
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: "center", marginTop: spacing.sm, marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  sheetTitle: { ...typography.h3, marginBottom: 2 },
  sheetContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },

  fieldLabel: { ...typography.label, marginBottom: 4 },
  fieldInput: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.textPrimary, fontSize: 15, marginBottom: 0,
  },

  infoBox: {
    backgroundColor: colors.greenBg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.green,
    padding: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.sm,
  },
  infoText: { ...typography.caption, color: colors.green },

  confirmBtn: {
    backgroundColor: colors.gold, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.xs,
  },
  confirmBtnText: { ...typography.h4, color: colors.bg },
});
