import React, { useMemo, useState } from "react";
import {
  View, FlatList, Text, StyleSheet, Pressable, Modal,
  ScrollView, TextInput, Platform, KeyboardAvoidingView,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { spacing, radius, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { ConfirmModal } from "../components/ConfirmModal";
import {
  useProductionPlans,
  usePendingProduction,
  useCreateProductionPlan,
  useDeleteProductionPlan,
  useApproveProductionPlan,
  useRejectProductionPlan,
  useSignOffProductionPlan,
} from "../hooks/useProduction";
import { recipesApi } from "../services/api";
import { fmt } from "../utils/fmt";
import type { ProductionPlan, GenerateOrdersPreview } from "../types";

const STYLES = ["Löndon", "Whïte", "Kölsh", "Mëxican IPA", "Monterrëy Stout", "Edición especial"];
const STYLE_EMOJIS: Record<string, string> = {
  "Löndon": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Whïte": "🌾", "Kölsh": "🇩🇪",
  "Mëxican IPA": "🌶️", "Monterrëy Stout": "⚫", "Edición especial": "✨",
};
const MXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
}
function daysFromNow(iso: string) {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "HOY";
  if (diff === 1) return "MAÑANA";
  if (diff < 0) return `hace ${Math.abs(diff)}d`;
  return `en ${diff}d`;
}

function allRequirementsOk(plan: ProductionPlan): boolean {
  if (!plan.requirements || plan.requirements.length === 0) return false;
  return plan.requirements.every((r) => r.missingQuantity === 0);
}

export default function ProductionScreen() {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { hasRole } = useAuth();

  const canApprove = hasRole(["DEVELOPER", "SUPERVISOR"]);

  const [showForm, setShowForm] = useState(false);
  const [previewPlan, setPreviewPlan] = useState<ProductionPlan | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ProductionPlan | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductionPlan | null>(null);
  const [approveTarget, setApproveTarget] = useState<ProductionPlan | null>(null);

  const { data: plans, isLoading, refetch, isRefetching } = useProductionPlans();
  const { data: pendingPlans } = usePendingProduction();
  const deleteMutation = useDeleteProductionPlan();
  const approveMutation = useApproveProductionPlan();

  const approvedPlans = (plans ?? []).filter((p) => p.approvalStatus === "APPROVED");
  // Active: everything that hasn't finished (COMPLETED) or been cancelled
  const activePlans = (plans ?? []).filter(
    (p) => p.productionStatus !== "COMPLETED" && p.productionStatus !== "CANCELLED"
  );
  // Historial: only once production is done or cancelled
  const signedOffPlans = (plans ?? []).filter(
    (p) => p.productionStatus === "COMPLETED" || p.productionStatus === "CANCELLED"
  );

  const weeklyMalt = approvedPlans.reduce((a, p) => a + p.totalMaltKg, 0);
  const weeklyBatches = approvedPlans.reduce((a, p) => a + p.plannedBatches, 0);

  const handleDelete = (plan: ProductionPlan) => setDeleteTarget(plan);
  const handleApprove = (plan: ProductionPlan) => setApproveTarget(plan);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.summaryRow}>
        <SummaryCard label="Lotes aprobados" value={weeklyBatches} colors={colors} typography={typography} />
        <SummaryCard label="Kg malta" value={weeklyMalt.toFixed(0)} colors={colors} typography={typography} />
        <SummaryCard label="Estilos" value={[...new Set(approvedPlans.map((p) => p.style))].length} colors={colors} typography={typography} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={showHistory ? signedOffPlans : activePlans}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />}
          ListHeaderComponent={() => (
            <>
              {canApprove && (pendingPlans?.length ?? 0) > 0 && (
                <View style={[styles.pendingSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.pendingHeader}>
                    <View style={[styles.pendingDot, { backgroundColor: colors.gold }]} />
                    <Text style={[typography.label, { color: colors.gold }]}>
                      PENDIENTES DE APROBACIÓN ({pendingPlans!.length})
                    </Text>
                  </View>
                  {pendingPlans!.map((plan) => (
                    <PendingPlanRow
                      key={plan.id}
                      plan={plan}
                      colors={colors}
                      typography={typography}
                      onApprove={() => handleApprove(plan)}
                      onReject={() => setRejectTarget(plan)}
                    />
                  ))}
                </View>
              )}
              <View style={styles.planHeader}>
                <Text style={[typography.label, { color: colors.textSecondary }]}>PLAN DE PRODUCCIÓN</Text>
                {signedOffPlans.length > 0 && (
                  <Pressable onPress={() => setShowHistory((v) => !v)} hitSlop={8}>
                    <Text style={[typography.label, { color: colors.gold }]}>
                      {showHistory ? "← Activos" : `Historial (${signedOffPlans.length})`}
                    </Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
          renderItem={({ item }) => (
            <PlanCard
              plan={item}
              canApprove={canApprove}
              onDelete={showHistory ? undefined : handleDelete}
              onOpenModal={() => setPreviewPlan(item)}
              onApprove={() => handleApprove(item)}
              onReject={() => setRejectTarget(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState icon="🗓️" title="Sin plan de producción" subtitle="Agrega lotes para ver el plan semanal" />
          }
        />
      )}

      <Pressable
        style={[styles.fab, { backgroundColor: colors.gold, shadowColor: colors.gold }]}
        onPress={() => setShowForm(true)}
      >
        <Ionicons name="add" size={26} color={colors.bg} />
      </Pressable>

      {showForm && <PlanForm onClose={() => setShowForm(false)} />}
      {previewPlan && (
        <GenerateOrdersModal
          plan={previewPlan}
          onClose={() => setPreviewPlan(null)}
        />
      )}
      {rejectTarget && (
        <RejectModal plan={rejectTarget} onClose={() => setRejectTarget(null)} />
      )}

      <ConfirmModal
        visible={!!deleteTarget}
        title="Eliminar plan"
        message={deleteTarget ? `¿Eliminar el lote de ${deleteTarget.style} del ${formatDate(deleteTarget.productionDate)}?` : ""}
        confirmLabel="Eliminar"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
            onError: (e: any) => { setDeleteTarget(null); Alert.alert("Error", e.message); },
          });
        }}
      />

      <ConfirmModal
        visible={!!approveTarget}
        title="Aprobar plan"
        message={approveTarget ? `¿Aprobar ${approveTarget.style} — ${approveTarget.plannedBatches} lote(s)?` : ""}
        confirmLabel="Aprobar"
        onCancel={() => setApproveTarget(null)}
        onConfirm={() => {
          if (!approveTarget) return;
          approveMutation.mutate(approveTarget.id, {
            onSuccess: () => setApproveTarget(null),
            onError: (e: any) => { setApproveTarget(null); Alert.alert("Error", e.message); },
          });
        }}
      />
    </View>
  );
}

function SummaryCard({ label, value, colors, typography }: { label: string; value: string | number; colors: Colors; typography: any }) {
  return (
    <View style={[summaryCardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: colors.gold, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={[typography.caption, { marginTop: 2 }]}>{label}</Text>
    </View>
  );
}
const summaryCardStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: "center", borderWidth: 1 },
});

function PendingPlanRow({
  plan, colors, typography, onApprove, onReject,
}: {
  plan: ProductionPlan; colors: Colors; typography: any;
  onApprove: () => void; onReject: () => void;
}) {
  return (
    <View style={[pendingStyles.row, { borderTopColor: colors.border }]}>
      <View style={pendingStyles.info}>
        <Text style={[typography.h4, { fontSize: 13 }]}>
          {STYLE_EMOJIS[plan.style] ?? "🍺"} {plan.style}
        </Text>
        <Text style={typography.caption}>
          {plan.plannedBatches} lote(s) · {formatDate(plan.productionDate)}
        </Text>
        {plan.hasMissingPrices && (
          <Text style={[typography.caption, { color: colors.gold }]}>⚠ Precios incompletos</Text>
        )}
      </View>
      <View style={pendingStyles.btns}>
        <Pressable
          style={[pendingStyles.btn, { backgroundColor: colors.greenBg, borderColor: colors.green }]}
          onPress={onApprove}
        >
          <Ionicons name="checkmark" size={14} color={colors.green} />
        </Pressable>
        <Pressable
          style={[pendingStyles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={onReject}
        >
          <Ionicons name="close" size={14} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}
const pendingStyles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: spacing.sm, borderTopWidth: 1, gap: spacing.sm,
  },
  info: { flex: 1, gap: 2 },
  btns: { flexDirection: "row", gap: spacing.xs },
  btn: {
    width: 32, height: 32, borderRadius: radius.sm,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
});

function PlanCard({
  plan, canApprove, onDelete, onOpenModal, onApprove, onReject,
}: {
  plan: ProductionPlan; canApprove: boolean;
  onDelete?: (p: ProductionPlan) => void;
  onOpenModal: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { colors, typography } = useTheme();
  const days = daysFromNow(plan.productionDate);
  const isToday = days === "HOY" || days === "MAÑANA";
  const isSignedOff = !!plan.signedOffAt;
  const ordersInProgress = !!plan.orderedAt && !plan.signedOffAt;
  const isPending = plan.approvalStatus === "PENDING";
  const isRejected = plan.approvalStatus === "REJECTED";
  const isCompleted = plan.productionStatus === "COMPLETED";
  const isCancelledProd = plan.productionStatus === "CANCELLED";
  const isInProgress = plan.productionStatus === "IN_PROGRESS";
  const canAct = plan.approvalStatus === "APPROVED" && !isSignedOff && !ordersInProgress;
  const allOk = allRequirementsOk(plan);

  return (
    <View style={[planCardStyles.card, { borderBottomColor: colors.border }, isToday && !isPending && { backgroundColor: colors.surface }]}>
      <View style={planCardStyles.left}>
        <Text style={planCardStyles.emoji}>{STYLE_EMOJIS[plan.style] ?? "🍺"}</Text>
        <View style={{ gap: 2 }}>
          <Text style={[typography.h4, { fontSize: 14 }]}>{plan.style}</Text>
          <Text style={typography.caption}>{formatDate(plan.productionDate)}</Text>
          {isPending && (
            <View style={[planCardStyles.statusBadge, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "55" }]}>
              <Text style={[typography.label, { fontSize: 8, color: colors.gold }]}>PENDIENTE APROBACIÓN</Text>
            </View>
          )}
          {isRejected && (
            <View style={[planCardStyles.statusBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[typography.label, { fontSize: 8, color: colors.textMuted }]}>RECHAZADO</Text>
            </View>
          )}
          {isInProgress && (
            <View style={[planCardStyles.statusBadge, { backgroundColor: colors.goldDim + "22", borderColor: colors.goldDim + "66" }]}>
              <Text style={[typography.label, { fontSize: 8, color: colors.gold }]}>EN PROCESO</Text>
            </View>
          )}
          {isCompleted && (
            <View style={[planCardStyles.statusBadge, { backgroundColor: colors.greenBg, borderColor: colors.green + "66" }]}>
              <Text style={[typography.label, { fontSize: 8, color: colors.green }]}>COMPLETADO</Text>
            </View>
          )}
          {isCancelledProd && (
            <View style={[planCardStyles.statusBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[typography.label, { fontSize: 8, color: colors.textMuted }]}>CANCELADO</Text>
            </View>
          )}
        </View>
      </View>
      <View style={planCardStyles.mid}>
        <Text style={[typography.bodySmall, { fontWeight: "600", color: colors.textPrimary }]}>
          {plan.plannedBatches} lote{plan.plannedBatches > 1 ? "s" : ""}
        </Text>
        <Text style={typography.caption}>{fmt(plan.totalMaltKg)}kg malta</Text>
        {plan.estimatedCost > 0 && (
          <Text style={[typography.caption, { color: plan.hasMissingPrices ? colors.gold : colors.textSecondary }]}>
            {MXN(plan.estimatedCost)}{plan.hasMissingPrices ? " ⚠" : ""}
          </Text>
        )}
      </View>
      <View style={planCardStyles.right}>
        <View style={[planCardStyles.daysBadge, { backgroundColor: colors.card, borderColor: colors.border }, isToday && { borderColor: colors.gold, backgroundColor: colors.goldDim + "33" }]}>
          <Text style={[typography.label, { fontSize: 9, color: isToday ? colors.gold : colors.textMuted }]}>{days}</Text>
        </View>
        <View style={planCardStyles.actions}>
          {isPending && canApprove ? (
            <>
              <Pressable onPress={onApprove} hitSlop={8} style={[planCardStyles.actionBtn, { borderColor: colors.green }]}>
                <Ionicons name="checkmark" size={12} color={colors.green} />
              </Pressable>
              <Pressable onPress={onReject} hitSlop={8} style={[planCardStyles.actionBtn, { borderColor: colors.border }]}>
                <Ionicons name="close" size={12} color={colors.textMuted} />
              </Pressable>
            </>
          ) : isSignedOff ? (
            <View style={[planCardStyles.signedBadge, { backgroundColor: colors.greenBg, borderColor: colors.green }]}>
              <Ionicons name="checkmark-circle" size={12} color={colors.green} />
              <Text style={[typography.label, { fontSize: 8, color: colors.green }]}>VISTO BUENO</Text>
            </View>
          ) : ordersInProgress ? (
            <View style={[planCardStyles.waitingBadge, { backgroundColor: colors.goldDim + "22", borderColor: colors.goldDim }]}>
              <Ionicons name="time-outline" size={11} color={colors.gold} />
              <Text style={[typography.label, { fontSize: 8, color: colors.gold }]}>EN ESPERA</Text>
            </View>
          ) : canAct ? (
            <Pressable
              onPress={onOpenModal}
              hitSlop={8}
              style={[
                planCardStyles.actionBtn,
                allOk
                  ? { borderColor: colors.green, backgroundColor: colors.greenBg }
                  : { borderColor: colors.goldDim },
              ]}
            >
              <Ionicons
                name={allOk ? "checkmark-circle-outline" : "cart-outline"}
                size={14}
                color={allOk ? colors.green : colors.gold}
              />
            </Pressable>
          ) : null}
          {onDelete && (
            <Pressable onPress={() => onDelete(plan)} hitSlop={8}>
              <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const planCardStyles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, gap: spacing.sm,
  },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  emoji: { fontSize: 22, width: 30 },
  mid: { alignItems: "flex-end", marginRight: spacing.sm },
  right: { alignItems: "flex-end", gap: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.xs, alignItems: "center" },
  actionBtn: { padding: 4, borderRadius: radius.sm, borderWidth: 1 },
  signedBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1,
  },
  waitingBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1,
  },
  daysBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.full, borderWidth: 1,
  },
  statusBadge: {
    alignSelf: "flex-start", paddingHorizontal: spacing.xs, paddingVertical: 2,
    borderRadius: radius.sm, borderWidth: 1, marginTop: 2,
  },
});

function RejectModal({ plan, onClose }: { plan: ProductionPlan; onClose: () => void }) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const rejectMutation = useRejectProductionPlan();
  const [reason, setReason] = useState("");

  const handleReject = () => {
    rejectMutation.mutate(
      { id: plan.id, reason: reason || undefined },
      { onSuccess: onClose, onError: (e: any) => Alert.alert("Error", e.message) }
    );
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={typography.h3}>Rechazar plan</Text>
              <Text style={typography.caption}>{plan.style} · {plan.plannedBatches} lote(s)</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm }}>
            <Text style={typography.label}>MOTIVO (opcional)</Text>
            <TextInput
              style={{
                backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
                borderColor: colors.border, paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm, color: colors.textPrimary, fontSize: 15,
                minHeight: 72, textAlignVertical: "top",
              }}
              value={reason}
              onChangeText={setReason}
              placeholder="¿Por qué se rechaza este plan?"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
            <Pressable
              style={[{ borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, rejectMutation.isPending && { opacity: 0.6 }]}
              onPress={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending
                ? <ActivityIndicator color={colors.textPrimary} />
                : <Text style={[typography.h4, { color: colors.textPrimary }]}>Confirmar rechazo</Text>
              }
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function GenerateOrdersModal({ plan, onClose }: { plan: ProductionPlan; onClose: () => void }) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [preview, setPreview] = useState<GenerateOrdersPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const signOffMutation = useSignOffProductionPlan();

  React.useEffect(() => {
    recipesApi.previewOrders(plan.id)
      .then(setPreview)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [plan.id]);

  const handleConfirmOrders = async () => {
    setConfirming(true);
    try {
      const result = await recipesApi.confirmOrders(plan.id);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["production"] });
      Alert.alert(
        "Pedidos generados",
        `${result.created.length} pedido(s) creado(s). Recibirás el visto bueno automáticamente cuando lleguen.`,
        [{ text: "Ver pedidos", onPress: onClose }]
      );
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setConfirming(false);
    }
  };

  const handleSignOff = () => {
    signOffMutation.mutate(plan.id, {
      onSuccess: () => onClose(),
      onError: (e: any) => Alert.alert("Error", e.message),
    });
  };

  const ordersNeeded = preview?.preview.filter((p) => p.willOrder) ?? [];
  const stockOk = preview?.preview.filter((p) => !p.willOrder) ?? [];

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[typography.h3, { marginBottom: 2 }]}>
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
            </View>
          )}
          {error && (
            <View style={{ padding: spacing.md }}>
              <Text style={[typography.bodySmall, { color: colors.red }]}>{error}</Text>
            </View>
          )}

          {preview && !loading && (
            <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxl }}>
              {ordersNeeded.length > 0 && (
                <>
                  <Text style={[typography.label, { marginBottom: spacing.xs, marginTop: spacing.sm }]}>
                    PEDIR ({ordersNeeded.length} materiales)
                  </Text>
                  <View style={[styles.previewList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {ordersNeeded.map((item) => (
                      <View key={item.materialId} style={[styles.previewRow, { borderBottomColor: colors.border }]}>
                        <View style={styles.previewLeft}>
                          <Text style={[typography.h4, { fontSize: 13 }]}>{item.materialName}</Text>
                          <Text style={typography.caption}>{item.supplierName ?? "Sin proveedor"} · Stock: {fmt(item.currentStock)}{item.unit}</Text>
                        </View>
                        <View style={styles.previewRight}>
                          <Text style={[typography.bodySmall, { fontWeight: "700", color: item.isCritical ? colors.red : colors.gold }]}>
                            {fmt(item.missingQuantity)} {item.unit}
                          </Text>
                          <Text style={[typography.caption, { color: colors.textSecondary }]}>{MXN(item.estimatedCost)}</Text>
                          {item.isCritical && (
                            <Text style={[typography.label, { fontSize: 8, color: colors.red }]}>⚠ CRÍTICO</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {stockOk.length > 0 && (
                <>
                  <Text style={[typography.label, { marginBottom: spacing.xs, marginTop: spacing.md }]}>
                    STOCK SUFICIENTE ({stockOk.length})
                  </Text>
                  <View style={[styles.previewList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {stockOk.map((item) => (
                      <View key={item.materialId} style={[styles.previewRow, { borderBottomColor: colors.border, opacity: 0.5 }]}>
                        <View style={styles.previewLeft}>
                          <Text style={[typography.h4, { fontSize: 13 }]}>{item.materialName}</Text>
                          <Text style={typography.caption}>Stock: {fmt(item.currentStock)} {item.unit}</Text>
                        </View>
                        <Ionicons name="checkmark-circle" size={18} color={colors.green} />
                      </View>
                    ))}
                  </View>
                </>
              )}

              <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                <Text style={typography.label}>Costo estimado total</Text>
                <Text style={[typography.h3, { color: colors.gold }]}>{MXN(preview.totalEstimatedCost)}</Text>
              </View>

              {ordersNeeded.length === 0 ? (
                <>
                  <View style={[styles.allGoodBox, { backgroundColor: colors.greenBg, borderColor: colors.green }]}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                    <Text style={[typography.bodySmall, { color: colors.green, fontWeight: "600", marginTop: 4 }]}>
                      Stock suficiente para todos los ingredientes
                    </Text>
                    <Text style={[typography.caption, { color: colors.green, marginTop: 2, textAlign: "center" }]}>
                      Da el visto bueno para reservar el stock y programar la producción.
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.confirmBtn, { backgroundColor: colors.green }, signOffMutation.isPending && { opacity: 0.6 }]}
                    onPress={handleSignOff}
                    disabled={signOffMutation.isPending}
                  >
                    {signOffMutation.isPending ? (
                      <ActivityIndicator color={colors.bg} />
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                        <Ionicons name="checkmark-circle-outline" size={18} color={colors.bg} />
                        <Text style={[typography.h4, { color: colors.bg }]}>Dar visto bueno</Text>
                      </View>
                    )}
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={[styles.confirmBtn, { backgroundColor: colors.gold }, confirming && { opacity: 0.6 }]}
                  onPress={handleConfirmOrders}
                  disabled={confirming}
                >
                  {confirming
                    ? <ActivityIndicator color={colors.bg} />
                    : <Text style={[typography.h4, { color: colors.bg }]}>Crear {ordersNeeded.length} pedido{ordersNeeded.length > 1 ? "s" : ""}</Text>
                  }
                </Pressable>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function PlanForm({ onClose }: { onClose: () => void }) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const createMutation = useCreateProductionPlan();

  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10);
  });
  const [batches, setBatches] = useState("1");
  const [maltPer, setMaltPer] = useState("60");
  const [hopPer, setHopPer] = useState("0.5");
  const [yeastPer, setYeastPer] = useState("500");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    createMutation.mutate(
      {
        productionDate: date, style: selectedStyle,
        plannedBatches: parseInt(batches) || 1,
        maltKgPerBatch: parseFloat(maltPer) || 0,
        hopKgPerBatch: parseFloat(hopPer) || 0,
        yeastGPerBatch: parseFloat(yeastPer) || 0,
        notes: notes || null,
        orderedAt: null,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: spacing.xl }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={[typography.h3, { marginBottom: 2 }]}>Nuevo lote</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={[typography.label, { marginBottom: 4 }]}>ESTILO</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: "row", gap: spacing.xs }}>
                {STYLES.map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.styleChip, { borderColor: colors.border, backgroundColor: colors.card }, s === selectedStyle && { borderColor: colors.gold }]}
                    onPress={() => setSelectedStyle(s)}
                  >
                    <Text style={[typography.bodySmall, { color: s === selectedStyle ? colors.gold : colors.textSecondary }]}>
                      {STYLE_EMOJIS[s]} {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <PlanFormField label="Fecha de producción (AAAA-MM-DD)" value={date} onChangeText={setDate} colors={colors} typography={typography} />
            <PlanFormField label="Lotes planeados" value={batches} onChangeText={setBatches} keyboardType="number-pad" colors={colors} typography={typography} />
            <PlanFormField label="Kg malta por lote" value={maltPer} onChangeText={setMaltPer} keyboardType="decimal-pad" colors={colors} typography={typography} />
            <PlanFormField label="Kg lúpulo por lote" value={hopPer} onChangeText={setHopPer} keyboardType="decimal-pad" colors={colors} typography={typography} />
            <PlanFormField label="Levadura por lote (g)" value={yeastPer} onChangeText={setYeastPer} keyboardType="decimal-pad" colors={colors} typography={typography} />
            <PlanFormField label="Notas" value={notes} onChangeText={setNotes} colors={colors} typography={typography} />

            <View style={[styles.preview, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[typography.bodySmall, { color: colors.cream }]}>
                Total: {((parseFloat(maltPer) || 0) * (parseInt(batches) || 1)).toFixed(1)}kg malta ·{" "}
                {((parseFloat(hopPer) || 0) * (parseInt(batches) || 1)).toFixed(2)}kg lúpulo
              </Text>
            </View>

            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.gold }, createMutation.isPending && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={[typography.h4, { color: colors.bg }]}>Agregar al plan</Text>
              }
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PlanFormField({ label, value, onChangeText, keyboardType, colors, typography }: {
  label: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: "number-pad" | "decimal-pad"; colors: Colors; typography: any;
}) {
  return (
    <View style={{ marginBottom: spacing.sm, gap: spacing.xs }}>
      <Text style={[typography.label, { marginBottom: 4 }]}>{label}</Text>
      <TextInput
        style={{
          backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
          borderColor: colors.border, paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm, color: colors.textPrimary, fontSize: 15,
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
    summaryRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.md },
    fab: {
      position: "absolute", bottom: spacing.xl, right: spacing.md,
      width: 56, height: 56, borderRadius: 28,
      alignItems: "center", justifyContent: "center",
      shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
    },
    pendingSection: {
      margin: spacing.md, borderRadius: radius.md, borderWidth: 1,
      padding: spacing.md, marginBottom: 0,
    },
    pendingHeader: {
      flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm,
    },
    planHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs,
    },
    pendingDot: { width: 6, height: 6, borderRadius: 3 },
    overlay: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
    sheet: {
      borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: "90%",
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      alignSelf: "center", marginTop: spacing.sm, marginBottom: spacing.md,
    },
    sheetHeader: {
      flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
      paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    },
    previewList: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
    previewRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
      borderBottomWidth: 1, gap: spacing.sm,
    },
    previewLeft: { flex: 1, gap: 2 },
    previewRight: { alignItems: "flex-end" },
    totalRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      marginTop: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1,
    },
    allGoodBox: {
      borderRadius: radius.md, borderWidth: 1, padding: spacing.md,
      marginTop: spacing.md, alignItems: "center",
    },
    confirmBtn: { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.lg },
    formContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
    styleChip: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: radius.full, borderWidth: 1,
    },
    preview: { borderRadius: radius.md, padding: spacing.md, borderWidth: 1, marginBottom: spacing.md, marginTop: spacing.xs },
    saveBtn: { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
  });
}
