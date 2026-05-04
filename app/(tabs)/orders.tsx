import React, { useMemo, useState } from "react";
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
import { spacing, radius, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
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

function daysUntil(iso: string | null | undefined, colors: Colors) {
  if (!iso) return null;
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `${Math.abs(diff)}d de retraso`, color: colors.red };
  if (diff === 0) return { label: "Llega hoy", color: colors.green };
  if (diff === 1) return { label: "Llega mañana", color: colors.gold };
  return { label: `En ${diff}d`, color: colors.textSecondary };
}

export default function OrdersScreen() {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [statusFilter, setStatusFilter] = useState("");
  const [receiveOrder, setReceiveOrder] = useState<Order | null>(null);

  const params = statusFilter ? { status: statusFilter } : undefined;
  const { data: orders, isLoading, refetch, isRefetching } = useOrders(params);
  const updateMutation = useUpdateOrder();

  const advanceStatus = (order: Order) => {
    const next: Partial<Record<OrderStatus, OrderStatus>> = { PENDING: "IN_TRANSIT" };
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
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryValue, { color: colors.gold }]}>{MXN(totalCost)}</Text>
          <Text style={typography.caption}>Costo total</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardSmall, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryValue, { color: colors.yellow, fontSize: 20 }]}>{pendingCount}</Text>
          <Text style={typography.caption}>Pendientes</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardSmall, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryValue, { color: colors.gold, fontSize: 20 }]}>{transitCount}</Text>
          <Text style={typography.caption}>En tránsito</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[
              styles.filterTab,
              { borderColor: colors.border, backgroundColor: colors.card },
              statusFilter === f.value && { borderColor: colors.gold, backgroundColor: colors.goldDim + "33" },
            ]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text
              style={[
                typography.label,
                { fontSize: 10, color: colors.textMuted },
                statusFilter === f.value && { color: colors.gold },
              ]}
            >
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
          <OrderCard order={item} onAdvance={advanceStatus} advancing={updateMutation.isPending} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="📋"
            title="Sin pedidos"
            subtitle={
              statusFilter
                ? "No hay pedidos con este estado"
                : "Genera pedidos desde la pantalla de Producción"
            }
          />
        }
      />

      {receiveOrder && (
        <ReceiveModal order={receiveOrder} onClose={() => setReceiveOrder(null)} />
      )}
    </View>
  );
}

function OrderCard({
  order,
  onAdvance,
  advancing,
}: {
  order: Order;
  onAdvance: (o: Order) => void;
  advancing: boolean;
}) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const statusConfig = useMemo(() => ({
    PENDING:           { label: "Pendiente",     color: colors.yellow, bg: colors.yellowBg, icon: "time-outline" },
    IN_TRANSIT:        { label: "En tránsito",    color: colors.gold,   bg: colors.goldDim + "44", icon: "airplane-outline" },
    RECEIVED_COMPLETE: { label: "Recibido",       color: colors.green,  bg: colors.greenBg, icon: "checkmark-circle-outline" },
    RECEIVED_PARTIAL:  { label: "Parc. recibido", color: colors.yellow, bg: colors.yellowBg, icon: "alert-circle-outline" },
    CANCELLED:         { label: "Cancelado",      color: colors.none,   bg: colors.noneBg,  icon: "close-circle-outline" },
  }), [colors]);

  const cfg = statusConfig[order.status];
  const arrival = daysUntil(order.estimatedArrivalDate, colors);
  const canAdvance = order.status === "PENDING" || order.status === "IN_TRANSIT";
  const cost = estimatedCost(order);
  const isEstimated = order.totalPaid == null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleBlock}>
          <Text style={[typography.h4, { fontSize: 14 }]} numberOfLines={1}>
            {order.material?.name ?? "—"}
          </Text>
          <Text style={[typography.caption, { fontFamily: "monospace" }]}>{order.folio}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
          <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
          <Text style={[typography.label, { fontSize: 9, color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={styles.metaGrid}>
        <MetaCell label="Proveedor" value={order.supplier?.name?.split("(")[0].trim() ?? "—"} typography={typography} colors={colors} />
        <MetaCell label="Cantidad" value={`${order.orderedQuantity} ${order.material?.unit ?? ""}`} typography={typography} colors={colors} />
        <MetaCell
          label={isEstimated ? "Costo est." : "Costo final"}
          value={MXN(cost)}
          valueColor={isEstimated ? colors.textSecondary : colors.cream}
          typography={typography}
          colors={colors}
        />
        <MetaCell label="Pedido" value={formatDate(order.orderDate)} typography={typography} colors={colors} />
      </View>

      {arrival && order.status !== "RECEIVED_COMPLETE" && order.status !== "CANCELLED" && (
        <View style={styles.arrivalChip}>
          <Ionicons name="calendar-outline" size={11} color={arrival.color} />
          <Text style={[typography.caption, { color: arrival.color }]}>
            {arrival.label} · {formatDate(order.estimatedArrivalDate)}
          </Text>
        </View>
      )}

      {canAdvance && (
        <Pressable
          style={[
            styles.advanceBtn,
            { borderColor: colors.gold + "88", backgroundColor: colors.surface },
            order.status === "IN_TRANSIT" && { backgroundColor: colors.gold, borderColor: colors.gold },
            advancing && { opacity: 0.5 },
          ]}
          onPress={() => onAdvance(order)}
          disabled={advancing}
        >
          {order.status === "PENDING" ? (
            <>
              <Ionicons name="airplane-outline" size={13} color={colors.gold} />
              <Text style={[typography.label, { fontSize: 10, color: colors.gold }]}>Marcar en tránsito</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={13} color={colors.bg} />
              <Text style={[typography.label, { fontSize: 10, color: colors.bg }]}>Marcar recibido</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

function MetaCell({
  label, value, valueColor, typography, colors,
}: {
  label: string;
  value: string;
  valueColor?: string;
  typography: any;
  colors: Colors;
}) {
  return (
    <View style={metaCellStyles.cell}>
      <Text style={typography.caption}>{label}</Text>
      <Text
        style={[typography.bodySmall, { fontWeight: "600", color: valueColor ?? colors.textPrimary, marginTop: 1 }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const metaCellStyles = StyleSheet.create({
  cell: { minWidth: 80, flex: 1 },
});

function ReceiveModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[typography.h3, { marginBottom: 2 }]}>Registrar recepción</Text>
              <Text style={typography.caption}>{order.material?.name}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <ReceiveField label={`Cantidad recibida (${order.material?.unit ?? "unidad"})`} value={qty} onChangeText={setQty} keyboardType="decimal-pad" colors={colors} typography={typography} />
            <ReceiveField label="Costo final ($MXN)" value={cost} onChangeText={setCost} keyboardType="decimal-pad" colors={colors} typography={typography} />
            <ReceiveField label="Recibido por" value={receivedBy} onChangeText={setReceivedBy} colors={colors} typography={typography} />
            <ReceiveField label="Lote / folio proveedor" value={batchLot} onChangeText={setBatchLot} colors={colors} typography={typography} />

            <View style={[styles.infoBox, { backgroundColor: colors.greenBg, borderColor: colors.green }]}>
              <Text style={[typography.caption, { color: colors.green }]}>
                El stock se actualizará automáticamente al confirmar.
              </Text>
            </View>

            <Pressable
              style={[styles.confirmBtn, { backgroundColor: colors.gold }, loading && { opacity: 0.6 }]}
              onPress={handleReceive}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={[typography.h4, { color: colors.bg }]}>Confirmar recepción</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ReceiveField({
  label, value, onChangeText, keyboardType, colors, typography,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "decimal-pad" | "number-pad";
  colors: Colors;
  typography: any;
}) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={[typography.label, { marginBottom: 4 }]}>{label}</Text>
      <TextInput
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          color: colors.textPrimary,
          fontSize: 15,
        }}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? "default"}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    loading: { flex: 1, alignItems: "center", justifyContent: "center" },
    listContent: { paddingBottom: spacing.xxl },

    summaryRow: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    summaryCard: {
      flex: 2,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
    },
    summaryCardSmall: { flex: 1 },
    summaryValue: { fontSize: 18, fontWeight: "700", letterSpacing: -0.5 },

    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    filterTab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      borderWidth: 1,
    },

    card: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.sm,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    cardTitleBlock: { flex: 1, gap: 2 },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    arrivalChip: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
    advanceBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      alignSelf: "flex-start",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.sm,
      borderWidth: 1,
    },

    overlay: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
    sheet: {
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: "85%",
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      alignSelf: "center",
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    sheetContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },

    infoBox: {
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.sm,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    confirmBtn: {
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      marginTop: spacing.xs,
    },
  });
}
