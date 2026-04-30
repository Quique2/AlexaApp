import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  Modal,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography, shadows } from "../constants/theme";
import { SearchBar } from "../components/SearchBar";
import { FilterChips } from "../components/FilterChips";
import { InventoryRow } from "../components/InventoryRow";
import { AlertBadge } from "../components/AlertBadge";
import { EmptyState } from "../components/EmptyState";
import { useInventory, useUpdateInventory } from "../hooks/useInventory";
import type { InventoryRow as IRow } from "../types";

const ALERT_FILTERS = [
  { label: "Todos", value: "" },
  { label: "🔴 Pedir ya", value: "RED" },
  { label: "🟡 Pedir pronto", value: "YELLOW" },
  { label: "🟢 OK", value: "GREEN" },
];

const TYPE_FILTERS = [
  { label: "Todos", value: "" },
  { label: "Lúpulo", value: "LUPULO" },
  { label: "Malta", value: "MALTA" },
  { label: "Levadura", value: "YEAST" },
  { label: "Adjunto", value: "ADJUNTO" },
  { label: "Otro", value: "OTRO" },
];

export default function InventoryScreen() {
  const [search, setSearch] = useState("");
  const [alertFilter, setAlertFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState<IRow | null>(null);

  const params = useMemo(
    () => ({
      alert: alertFilter || undefined,
      type: typeFilter || undefined,
    }),
    [alertFilter, typeFilter]
  );

  const { data, isLoading, refetch, isRefetching } = useInventory(params);
  const updateMutation = useUpdateInventory();

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((r) => r.material?.name.toLowerCase().includes(q));
  }, [data, search]);

  const handlePress = useCallback((item: IRow) => setSelected(item), []);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchRow}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar material..." />
      </View>

      {/* Alert filter */}
      <FilterChips chips={ALERT_FILTERS} selected={alertFilter} onSelect={setAlertFilter} />

      {/* Type filter */}
      <FilterChips chips={TYPE_FILTERS} selected={typeFilter} onSelect={setTypeFilter} />

      {/* Count */}
      <Text style={styles.count}>{filtered.length} materiales</Text>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <InventoryRow item={item} onPress={handlePress} />}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="🔍"
            title="Sin resultados"
            subtitle="Intenta con otro filtro o búsqueda"
          />
        }
      />

      {/* Edit modal */}
      {selected && (
        <EditModal
          item={selected}
          onClose={() => setSelected(null)}
          onSave={(data) => {
            updateMutation.mutate(
              { materialId: selected.materialId, data },
              { onSuccess: () => setSelected(null) }
            );
          }}
          saving={updateMutation.isPending}
        />
      )}
    </View>
  );
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────
interface EditModalProps {
  item: IRow;
  onClose: () => void;
  onSave: (data: { currentStock: number; dailyConsumption: number; notes?: string }) => void;
  saving: boolean;
}

function EditModal({ item, onClose, onSave, saving }: EditModalProps) {
  const mat = item.material!;
  const [stock, setStock] = useState(String(item.currentStock));
  const [consumption, setConsumption] = useState(String(item.dailyConsumption));
  const [notes, setNotes] = useState(item.notes ?? "");

  const coverage =
    parseFloat(consumption) > 0
      ? Math.round(parseFloat(stock) / parseFloat(consumption))
      : null;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle} numberOfLines={2}>{mat.name}</Text>
              <AlertBadge status={item.alertStatus} />
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView>
            {/* Coverage preview */}
            {coverage !== null && (
              <View style={styles.coveragePill}>
                <Text style={styles.coverageText}>
                  Cobertura actual: <Text style={{ color: colors.gold }}>{coverage} días</Text>
                </Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Field
                label={`Stock actual (${mat.unit})`}
                value={stock}
                onChangeText={setStock}
                keyboardType="decimal-pad"
              />
              <Field
                label={`Consumo diario planado (${mat.unit}/día)`}
                value={consumption}
                onChangeText={setConsumption}
                keyboardType="decimal-pad"
              />
              <Field
                label="Notas / condición"
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>

            {/* Material info */}
            <View style={styles.infoRow}>
              <InfoCell label="Precio unit." value={`$${mat.unitPrice}`} />
              <InfoCell label="Proveedor" value={mat.supplier?.name?.split(" ")[0] ?? "—"} />
              <InfoCell label="Reorden" value={`${item.reorderPointDays}d`} />
            </View>

            <Pressable
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={() =>
                onSave({
                  currentStock: parseFloat(stock) || 0,
                  dailyConsumption: parseFloat(consumption) || 0,
                  notes: notes || undefined,
                })
              }
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Guardar</Text>
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
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "decimal-pad";
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoCellLabel}>{label}</Text>
      <Text style={styles.infoCellValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  searchRow: { padding: spacing.md, paddingBottom: spacing.xs },
  count: { ...typography.caption, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },

  // Modal
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "85%",
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  sheetTitle: { ...typography.h3, marginBottom: spacing.xs },

  coveragePill: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coverageText: { ...typography.bodySmall },

  fieldGroup: { paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.label },
  fieldInput: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 16,
  },
  fieldInputMulti: { minHeight: 72, textAlignVertical: "top", paddingTop: spacing.sm },

  infoRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  infoCell: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  infoCellLabel: { ...typography.caption },
  infoCellValue: { ...typography.h4, fontSize: 13 },

  saveBtn: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...typography.h4, color: colors.bg },
});
