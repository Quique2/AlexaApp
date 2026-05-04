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
import { spacing, radius, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
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
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [search, setSearch] = useState("");
  const [alertFilter, setAlertFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState<IRow | null>(null);

  const params = useMemo(
    () => ({ alert: alertFilter || undefined, type: typeFilter || undefined }),
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
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.searchRow}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar material..." />
      </View>

      <FilterChips chips={ALERT_FILTERS} selected={alertFilter} onSelect={setAlertFilter} />
      <FilterChips chips={TYPE_FILTERS} selected={typeFilter} onSelect={setTypeFilter} />

      <Text style={[typography.caption, styles.count]}>{filtered.length} materiales</Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <InventoryRow item={item} onPress={handlePress} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />
        }
        ListEmptyComponent={
          <EmptyState icon="🔍" title="Sin resultados" subtitle="Intenta con otro filtro o búsqueda" />
        }
      />

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

interface EditModalProps {
  item: IRow;
  onClose: () => void;
  onSave: (data: { currentStock: number; dailyConsumption: number; notes?: string }) => void;
  saving: boolean;
}

function EditModal({ item, onClose, onSave, saving }: EditModalProps) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.h3, { marginBottom: spacing.xs }]} numberOfLines={2}>
                {mat.name}
              </Text>
              <AlertBadge status={item.alertStatus} />
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView>
            {coverage !== null && (
              <View style={[styles.coveragePill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={typography.bodySmall}>
                  Cobertura actual:{" "}
                  <Text style={{ color: colors.gold }}>{coverage} días</Text>
                </Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Field label={`Stock actual (${mat.unit})`} value={stock} onChangeText={setStock} keyboardType="decimal-pad" colors={colors} typography={typography} />
              <Field label={`Consumo diario planado (${mat.unit}/día)`} value={consumption} onChangeText={setConsumption} keyboardType="decimal-pad" colors={colors} typography={typography} />
              <Field label="Notas / condición" value={notes} onChangeText={setNotes} multiline colors={colors} typography={typography} />
            </View>

            <View style={styles.infoRow}>
              <InfoCell label="Precio unit." value={`$${mat.unitPrice}`} colors={colors} typography={typography} />
              <InfoCell label="Proveedor" value={mat.supplier?.name?.split(" ")[0] ?? "—"} colors={colors} typography={typography} />
              <InfoCell label="Reorden" value={`${item.reorderPointDays}d`} colors={colors} typography={typography} />
            </View>

            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.gold }, saving && styles.saveBtnDisabled]}
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
                <Text style={[typography.h4, { color: colors.bg }]}>Guardar</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label, value, onChangeText, keyboardType, multiline, colors, typography,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "decimal-pad";
  multiline?: boolean;
  colors: Colors;
  typography: any;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={typography.label}>{label}</Text>
      <TextInput
        style={[
          {
            backgroundColor: colors.card,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.textPrimary,
            fontSize: 16,
          },
          multiline && { minHeight: 72, textAlignVertical: "top" as const, paddingTop: spacing.sm },
        ]}
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

function InfoCell({ label, value, colors, typography }: { label: string; value: string; colors: Colors; typography: any }) {
  return (
    <View style={[infoCellStyles.cell, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={[typography.h4, { fontSize: 13 }]}>{value}</Text>
    </View>
  );
}

const infoCellStyles = StyleSheet.create({
  cell: { flex: 1, borderRadius: radius.md, padding: spacing.sm, alignItems: "center", gap: 2, borderWidth: 1 },
});

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    loading: { flex: 1, alignItems: "center", justifyContent: "center" },
    searchRow: { padding: spacing.md, paddingBottom: spacing.xs },
    count: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },

    overlay: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
    sheet: {
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: "85%",
      paddingBottom: spacing.xl,
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
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },

    coveragePill: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
    },

    fieldGroup: { paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.md },

    infoRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },

    saveBtn: {
      marginHorizontal: spacing.md,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    saveBtnDisabled: { opacity: 0.6 },
  });
}
