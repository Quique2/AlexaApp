import React, { useState } from "react";
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { colors, spacing, radius, typography } from "../constants/theme";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { useProductionPlans, useCreateProductionPlan, useDeleteProductionPlan } from "../hooks/useProduction";
import { recipesApi } from "../services/api";
import type { ProductionPlan, GenerateOrdersPreview } from "../types";

const STYLES = ["Löndon", "Whïte", "Kölsh", "Mëxican IPA", "Monterrëy Stout", "Edición especial"];

const STYLE_EMOJIS: Record<string, string> = {
  "Löndon": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Whïte": "🌾",
  "Kölsh": "🇩🇪",
  "Mëxican IPA": "🌶️",
  "Monterrëy Stout": "⚫",
  "Edición especial": "✨",
};

const MXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function daysFromNow(iso: string) {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "HOY";
  if (diff === 1) return "MAÑANA";
  if (diff < 0) return `hace ${Math.abs(diff)}d`;
  return `en ${diff}d`;
}

export default function ProductionScreen() {
  const [showForm, setShowForm] = useState(false);
  const [previewPlan, setPreviewPlan] = useState<ProductionPlan | null>(null);

  const { data: plans, isLoading, refetch, isRefetching } = useProductionPlans();
  const deleteMutation = useDeleteProductionPlan();

  const handleDelete = (plan: ProductionPlan) => {
    Alert.alert(
      "Eliminar plan",
      `¿Eliminar el lote de ${plan.style} del ${formatDate(plan.productionDate)}?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => deleteMutation.mutate(plan.id) },
      ]
    );
  };

  const weeklyMalt = plans?.reduce((a, p) => a + p.totalMaltKg, 0) ?? 0;
  const weeklyBatches = plans?.reduce((a, p) => a + p.plannedBatches, 0) ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <SummaryCard label="Lotes totales" value={weeklyBatches} />
        <SummaryCard label="Kg malta" value={weeklyMalt.toFixed(0)} />
        <SummaryCard label="Estilos" value={[...new Set(plans?.map((p) => p.style) ?? [])].length} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(p) => p.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />
          }
          ListHeaderComponent={() => <SectionHeader title="PLAN DE PRODUCCIÓN" />}
          renderItem={({ item }) => (
            <PlanCard
              plan={item}
              onDelete={handleDelete}
              onGenerateOrders={() => setPreviewPlan(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState icon="🗓️" title="Sin plan de producción" subtitle="Agrega lotes para ver el plan semanal" />
          }
        />
      )}

      <Pressable style={styles.fab} onPress={() => setShowForm(true)}>
        <Ionicons name="add" size={26} color={colors.bg} />
      </Pressable>

      {showForm && <PlanForm onClose={() => setShowForm(false)} />}

      {previewPlan && (
        <GenerateOrdersModal
          plan={previewPlan}
          onClose={() => setPreviewPlan(null)}
        />
      )}
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function PlanCard({
  plan,
  onDelete,
  onGenerateOrders,
}: {
  plan: ProductionPlan;
  onDelete: (p: ProductionPlan) => void;
  onGenerateOrders: () => void;
}) {
  const days = daysFromNow(plan.productionDate);
  const isToday = days === "HOY" || days === "MAÑANA";
  const isOrdered = !!plan.orderedAt;

  return (
    <View style={[styles.planCard, isToday && styles.planCardHighlight]}>
      <View style={styles.planLeft}>
        <Text style={styles.planEmoji}>{STYLE_EMOJIS[plan.style] ?? "🍺"}</Text>
        <View style={{ gap: 2 }}>
          <Text style={styles.planStyle}>{plan.style}</Text>
          <Text style={styles.planDate}>{formatDate(plan.productionDate)}</Text>
        </View>
      </View>
      <View style={styles.planMid}>
        <Text style={styles.planBatches}>{plan.plannedBatches} lote{plan.plannedBatches > 1 ? "s" : ""}</Text>
        <Text style={styles.planKg}>{plan.totalMaltKg}kg malta</Text>
      </View>
      <View style={styles.planRight}>
        <View style={[styles.daysBadge, isToday && styles.daysBadgeActive]}>
          <Text style={[styles.daysText, isToday && { color: colors.gold }]}>{days}</Text>
        </View>
        <View style={styles.planActions}>
          {isOrdered ? (
            <View style={styles.orderedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={colors.green} />
              <Text style={styles.orderedText}>PEDIDO</Text>
            </View>
          ) : (
            <Pressable onPress={onGenerateOrders} hitSlop={8} style={styles.orderBtn}>
              <Ionicons name="cart-outline" size={14} color={colors.gold} />
            </Pressable>
          )}
          <Pressable onPress={() => onDelete(plan)} hitSlop={8}>
            <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Generate Orders Modal ────────────────────────────────────────────────────
function GenerateOrdersModal({ plan, onClose }: { plan: ProductionPlan; onClose: () => void }) {
  const [preview, setPreview] = useState<GenerateOrdersPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  React.useEffect(() => {
    recipesApi.previewOrders(plan.id)
      .then(setPreview)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [plan.id]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const result = await recipesApi.confirmOrders(plan.id);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      Alert.alert(
        "✅ Pedidos generados",
        `${result.created.length} pedido(s) creado(s). ${result.skipped} material(es) con stock suficiente.`,
        [{ text: "Ver pedidos", onPress: onClose }]
      );
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setConfirming(false);
    }
  };

  const ordersNeeded = preview?.preview.filter((p) => p.willOrder) ?? [];
  const stockOk = preview?.preview.filter((p) => !p.willOrder) ?? [];

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>
                {STYLE_EMOJIS[plan.style] ?? "🍺"} {plan.style}
              </Text>
              <Text style={typography.caption}>
                {plan.plannedBatches} lote{plan.plannedBatches > 1 ? "s" : ""} · {formatDate(plan.productionDate)}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {loading && (
            <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
              <ActivityIndicator color={colors.gold} />
              <Text style={[typography.caption, { marginTop: spacing.sm }]}>Calculando necesidades...</Text>
            </View>
          )}

          {error && (
            <View style={{ padding: spacing.md }}>
              <Text style={{ color: colors.red, ...typography.bodySmall }}>{error}</Text>
            </View>
          )}

          {preview && !loading && (
            <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxl }}>
              {/* Materials to order */}
              {ordersNeeded.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>PEDIR ({ordersNeeded.length} materiales)</Text>
                  <View style={styles.previewList}>
                    {ordersNeeded.map((item) => (
                      <View key={item.materialId} style={styles.previewRow}>
                        <View style={styles.previewLeft}>
                          <Text style={styles.previewName}>{item.materialName}</Text>
                          <Text style={styles.previewSub}>
                            {item.supplierName ?? "Sin proveedor"} · Stock: {item.currentStock}{item.unit}
                          </Text>
                        </View>
                        <View style={styles.previewRight}>
                          <Text style={styles.previewQty}>
                            {item.shortfall.toFixed(2)} {item.unit}
                          </Text>
                          <Text style={styles.previewCost}>{MXN(item.estimatedCost)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Stock OK */}
              {stockOk.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
                    STOCK SUFICIENTE ({stockOk.length})
                  </Text>
                  <View style={styles.previewList}>
                    {stockOk.map((item) => (
                      <View key={item.materialId} style={[styles.previewRow, { opacity: 0.5 }]}>
                        <View style={styles.previewLeft}>
                          <Text style={styles.previewName}>{item.materialName}</Text>
                          <Text style={styles.previewSub}>
                            Stock: {item.currentStock} {item.unit} · Necesita: {item.needed.toFixed(2)} {item.unit}
                          </Text>
                        </View>
                        <Ionicons name="checkmark-circle" size={18} color={colors.green} />
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Total */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Costo estimado total</Text>
                <Text style={styles.totalValue}>{MXN(preview.totalEstimatedCost)}</Text>
              </View>

              {ordersNeeded.length === 0 ? (
                <View style={styles.allGoodBox}>
                  <Text style={styles.allGoodText}>✅ Stock suficiente para todos los ingredientes</Text>
                </View>
              ) : (
                <Pressable
                  style={[styles.confirmBtn, confirming && styles.saveBtnDisabled]}
                  onPress={handleConfirm}
                  disabled={confirming}
                >
                  {confirming ? (
                    <ActivityIndicator color={colors.bg} />
                  ) : (
                    <Text style={styles.confirmBtnText}>
                      Crear {ordersNeeded.length} pedido{ordersNeeded.length > 1 ? "s" : ""}
                    </Text>
                  )}
                </Pressable>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Plan Form ───────────────────────────────────────────────────────────────
function PlanForm({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateProductionPlan();

  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [batches, setBatches] = useState("1");
  const [maltPer, setMaltPer] = useState("60");
  const [hopPer, setHopPer] = useState("0.5");
  const [yeastPer, setYeastPer] = useState("500");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    createMutation.mutate(
      {
        productionDate: date,
        style: selectedStyle,
        plannedBatches: parseInt(batches) || 1,
        maltKgPerBatch: parseFloat(maltPer) || 0,
        hopKgPerBatch: parseFloat(hopPer) || 0,
        yeastGPerBatch: parseFloat(yeastPer) || 0,
        notes: notes || null,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Nuevo lote</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={styles.formLabel}>ESTILO</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: "row", gap: spacing.xs }}>
                {STYLES.map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.styleChip, s === selectedStyle && styles.styleChipActive]}
                    onPress={() => setSelectedStyle(s)}
                  >
                    <Text style={[styles.styleChipText, s === selectedStyle && { color: colors.gold }]}>
                      {STYLE_EMOJIS[s]} {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <FormField label="Fecha de producción (AAAA-MM-DD)" value={date} onChangeText={setDate} />
            <FormField label="Lotes planeados" value={batches} onChangeText={setBatches} keyboardType="number-pad" />
            <FormField label="Kg malta por lote" value={maltPer} onChangeText={setMaltPer} keyboardType="decimal-pad" />
            <FormField label="Kg lúpulo por lote" value={hopPer} onChangeText={setHopPer} keyboardType="decimal-pad" />
            <FormField label="Levadura por lote (g)" value={yeastPer} onChangeText={setYeastPer} keyboardType="decimal-pad" />
            <FormField label="Notas" value={notes} onChangeText={setNotes} />

            <View style={styles.preview}>
              <Text style={styles.previewText}>
                Total: {((parseFloat(maltPer) || 0) * (parseInt(batches) || 1)).toFixed(1)}kg malta ·{" "}
                {((parseFloat(hopPer) || 0) * (parseInt(batches) || 1)).toFixed(2)}kg lúpulo
              </Text>
            </View>

            <Pressable
              style={[styles.saveBtn, createMutation.isPending && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.saveBtnText}>Agregar al plan</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormField({
  label, value, onChangeText, keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "number-pad" | "decimal-pad";
}) {
  return (
    <View style={{ marginBottom: spacing.sm, gap: spacing.xs }}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.formInput}
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

  summaryRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  summaryCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.md,
    padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border,
  },
  summaryValue: { fontSize: 22, fontWeight: "700", color: colors.gold, letterSpacing: -0.5 },
  summaryLabel: { ...typography.caption, marginTop: 2 },

  planCard: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm,
  },
  planCardHighlight: { backgroundColor: colors.surface },
  planLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  planEmoji: { fontSize: 22, width: 30 },
  planStyle: { ...typography.h4, fontSize: 14 },
  planDate: { ...typography.caption },
  planMid: { alignItems: "flex-end", marginRight: spacing.sm },
  planBatches: { ...typography.bodySmall, fontWeight: "600", color: colors.textPrimary },
  planKg: { ...typography.caption },
  planRight: { alignItems: "flex-end", gap: spacing.xs },
  planActions: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  orderBtn: {
    padding: 4, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.goldDim,
  },
  orderedBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.greenBg,
    borderWidth: 1, borderColor: colors.green,
  },
  orderedText: { ...typography.label, fontSize: 8, color: colors.green },
  daysBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.full, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  daysBadgeActive: { borderColor: colors.gold, backgroundColor: colors.goldDim + "33" },
  daysText: { ...typography.label, fontSize: 9, color: colors.textMuted },

  fab: {
    position: "absolute", bottom: spacing.xl, right: spacing.md,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.gold,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },

  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    maxHeight: "90%", paddingBottom: spacing.xl,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: "center", marginTop: spacing.sm, marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  sheetTitle: { ...typography.h3, marginBottom: 2 },

  sectionLabel: { ...typography.label, marginBottom: spacing.xs, marginTop: spacing.sm },
  previewList: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  previewRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  previewLeft: { flex: 1, gap: 2 },
  previewName: { ...typography.h4, fontSize: 13 },
  previewSub: { ...typography.caption },
  previewRight: { alignItems: "flex-end" },
  previewQty: { ...typography.bodySmall, fontWeight: "700", color: colors.gold },
  previewCost: { ...typography.caption, color: colors.textSecondary },

  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: spacing.md, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  totalLabel: { ...typography.label },
  totalValue: { ...typography.h3, color: colors.gold },

  allGoodBox: {
    backgroundColor: colors.greenBg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.green,
    padding: spacing.md, marginTop: spacing.md, alignItems: "center",
  },
  allGoodText: { ...typography.bodySmall, color: colors.green, fontWeight: "600" },

  confirmBtn: {
    backgroundColor: colors.gold, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.lg,
  },
  saveBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { ...typography.h4, color: colors.bg },

  formContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  formLabel: { ...typography.label, marginBottom: 4 },
  formInput: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.textPrimary, fontSize: 15,
  },
  styleChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  styleChipActive: { borderColor: colors.gold },
  styleChipText: { ...typography.bodySmall, color: colors.textSecondary },

  preview: {
    backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, marginTop: spacing.xs,
  },
  previewText: { ...typography.bodySmall, color: colors.cream },

  saveBtn: {
    backgroundColor: colors.gold, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: "center",
  },
  saveBtnText: { ...typography.h4, color: colors.bg },
});
