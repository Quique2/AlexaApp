import React, { useState, useMemo, useCallback } from "react";
import {
  View, FlatList, StyleSheet, Text, Modal, ScrollView, TextInput,
  Pressable, KeyboardAvoidingView, Platform, ActivityIndicator,
  RefreshControl, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { spacing, radius, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { SearchBar } from "../components/SearchBar";
import { FilterChips } from "../components/FilterChips";
import { InventoryRow } from "../components/InventoryRow";
import { AlertBadge } from "../components/AlertBadge";
import { EmptyState } from "../components/EmptyState";
import { useInventory, useUpdateInventory } from "../hooks/useInventory";
import { inventoryApi, materialsApi } from "../services/api";
import type { InventoryRow as IRow, MaterialType } from "../types";

const ALERT_FILTERS = [
  { label: "Todos", value: "" },
  { label: "🔴 Pedir ya", value: "RED" },
  { label: "🟡 Pedir pronto", value: "YELLOW" },
  { label: "🟢 OK", value: "OK_RESERVED" },
  { label: "⚠ Crítico", value: "CRITICAL" },
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
  const { hasRole } = useAuth();

  const canManage = hasRole(["DEVELOPER", "SUPERVISOR"]);

  const [search, setSearch] = useState("");
  const [alertFilter, setAlertFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState<IRow | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const handleDownloadTemplate = async () => {
    if (Platform.OS !== "web") {
      Alert.alert("Plantilla", "Descarga disponible solo en web.");
      return;
    }
    try {
      const blob = await inventoryApi.downloadTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inventario_template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const params = useMemo(
    () => ({
      // OK_RESERVED and CRITICAL are frontend-only filters — fetch all and filter client-side
      alert: alertFilter && alertFilter !== "CRITICAL" && alertFilter !== "OK_RESERVED" ? alertFilter : undefined,
      type: typeFilter || undefined,
    }),
    [alertFilter, typeFilter]
  );
  const { data, isLoading, refetch, isRefetching } = useInventory(params);
  const updateMutation = useUpdateInventory();

  const filtered = useMemo(() => {
    if (!data) return [];
    let result = data;
    if (alertFilter === "CRITICAL") result = result.filter((r) => r.isCritical);
    if (alertFilter === "OK_RESERVED") result = result.filter((r) => (r.reservedStock ?? 0) > 0);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.material?.name.toLowerCase().includes(q));
    }
    return result;
  }, [data, search, alertFilter]);

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
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />}
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
              { materialId: selected.materialId, data: { currentStock: data.currentStock, notes: data.notes } },
              { onSuccess: () => setSelected(null) }
            );
          }}
          saving={updateMutation.isPending}
        />
      )}

      {showImportModal && (
        <ImportModal onClose={() => { setShowImportModal(false); refetch(); }} />
      )}
      {showCreate && (
        <CreateMaterialModal onClose={() => { setShowCreate(false); refetch(); }} />
      )}

      {canManage && (
        <>
          {fabOpen && (
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setFabOpen(false)} />
          )}
          {fabOpen && (
            <View style={styles.miniFabs}>
              <MiniFabRow
                label="Añadir nuevo ingrediente"
                icon="leaf-outline"
                onPress={() => { setFabOpen(false); setShowCreate(true); }}
                colors={colors}
                typography={typography}
              />
              <MiniFabRow
                label="Descargar plantilla"
                icon="download-outline"
                onPress={() => { setFabOpen(false); handleDownloadTemplate(); }}
                colors={colors}
                typography={typography}
              />
              <MiniFabRow
                label="Subir archivo"
                icon="cloud-upload-outline"
                onPress={() => { setFabOpen(false); setShowImportModal(true); }}
                colors={colors}
                typography={typography}
              />
            </View>
          )}
          <Pressable
            style={[styles.fab, { backgroundColor: colors.gold, shadowColor: colors.gold }]}
            onPress={() => setFabOpen((o) => !o)}
          >
            <Ionicons name={fabOpen ? "close" : "add"} size={26} color={colors.bg} />
          </Pressable>
        </>
      )}
    </View>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ updated: number; errors: any[]; total: number } | null>(null);

  const handleImport = async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".xlsx,.xls";
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
          const res = await inventoryApi.import(file);
          setResult(res);
        } catch (err: any) {
          Alert.alert("Error", err.message);
        } finally {
          setImporting(false);
        }
      };
      input.click();
    } else {
      Alert.alert("Importar Excel", "Importación disponible solo en web.");
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={typography.h3}>Subir archivo Excel</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md }}>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              Selecciona el archivo Excel con el inventario. Los materiales se identifican por su columna "id".
            </Text>

            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.gold }, importing && { opacity: 0.6 }]}
              onPress={handleImport}
              disabled={importing}
            >
              {importing
                ? <ActivityIndicator color={colors.bg} size="small" />
                : <Ionicons name="cloud-upload-outline" size={18} color={colors.bg} />
              }
              <Text style={[typography.h4, { color: colors.bg }]}>
                {importing ? "Importando..." : "Seleccionar archivo"}
              </Text>
            </Pressable>

            {result && (
              <View style={[{ padding: spacing.md, borderRadius: radius.md, borderWidth: 1 }, { backgroundColor: colors.greenBg, borderColor: colors.green }]}>
                <Text style={[typography.h4, { color: colors.green }]}>Importación completada</Text>
                <Text style={[typography.bodySmall, { color: colors.green, marginTop: 4 }]}>
                  {result.updated} de {result.total} filas actualizadas
                </Text>
                {result.errors.length > 0 && (
                  <Text style={[typography.caption, { color: colors.gold, marginTop: 4 }]}>
                    {result.errors.length} error(es). Revisa los IDs de materiales.
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface EditModalProps {
  item: IRow;
  onClose: () => void;
  onSave: (data: { currentStock: number; notes?: string }) => void;
  saving: boolean;
}

function EditModal({ item, onClose, onSave, saving }: EditModalProps) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { hasRole } = useAuth();
  const canEditPrices = hasRole(["DEVELOPER", "SUPERVISOR"]);
  const mat = item.material!;
  const [stock, setStock] = useState(String(item.currentStock));
  const [notes, setNotes] = useState(item.notes ?? "");
  const [priceInput, setPriceInput] = useState(mat.unitPrice != null ? String(mat.unitPrice) : "");
  const [priceUnitInput, setPriceUnitInput] = useState(mat.priceUnit ?? "");
  const [savingPrice, setSavingPrice] = useState(false);

  const handleSave = async () => {
    if (canEditPrices) {
      const newPrice = parseFloat(priceInput);
      const priceChanged = !isNaN(newPrice) && (newPrice !== mat.unitPrice || priceUnitInput !== (mat.priceUnit ?? ""));
      if (priceChanged) {
        setSavingPrice(true);
        try {
          await materialsApi.updatePrice(mat.id, newPrice, priceUnitInput || undefined);
        } catch (e: any) {
          Alert.alert("Error al guardar precio", e.message);
          setSavingPrice(false);
          return;
        }
        setSavingPrice(false);
      }
    }
    onSave({
      currentStock: parseFloat(stock) || 0,
      notes: notes || undefined,
    });
  };

  const isSaving = saving || savingPrice;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.h3, { marginBottom: spacing.xs }]} numberOfLines={2}>{mat.name}</Text>
              <AlertBadge status={item.alertStatus} />
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView>
            {(item.requirements ?? []).length > 0 && (
              <View style={[styles.reservedSection, { backgroundColor: colors.greenBg, borderColor: colors.green + "66" }]}>
                <Text style={[typography.label, { color: colors.green, marginBottom: spacing.xs }]}>
                  🟢 RESERVADO PARA PRODUCCIÓN
                </Text>
                {(item.requirements ?? []).map((req) => req.productionPlan && (
                  <View key={req.id} style={styles.reservedRow}>
                    <Text style={[typography.bodySmall, { color: colors.green, flex: 1 }]}>
                      {req.productionPlan.style}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.green, fontWeight: "600" }]}>
                      {req.reservedQuantity} {mat.unit}
                    </Text>
                    <Text style={[typography.caption, { color: colors.green + "99", marginLeft: spacing.xs }]}>
                      {new Date(req.productionPlan.productionDate).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                    </Text>
                  </View>
                ))}
                <Text style={[typography.caption, { color: colors.green + "99", marginTop: spacing.xs }]}>
                  Se consumirá al llegar la fecha de producción
                </Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Field label={`Stock actual (${mat.unit})`} value={stock} onChangeText={setStock} keyboardType="decimal-pad" colors={colors} typography={typography} />
              <Field label="Notas / condición" value={notes} onChangeText={setNotes} multiline colors={colors} typography={typography} />
              {canEditPrices && (
                <>
                  <Field label="Precio unitario ($)" value={priceInput} onChangeText={setPriceInput} keyboardType="decimal-pad" colors={colors} typography={typography} />
                  <Field label="Unidad de precio (ej: kg, L, unidad)" value={priceUnitInput} onChangeText={setPriceUnitInput} colors={colors} typography={typography} />
                </>
              )}
            </View>

            {!canEditPrices && (
              <View style={styles.infoRow}>
                <InfoCell label="Precio unit." value={mat.unitPrice != null ? `$${mat.unitPrice}${mat.priceUnit ? "/" + mat.priceUnit : ""}` : "—"} colors={colors} typography={typography} />
                <InfoCell label="Proveedor" value={mat.supplier?.name?.split(" ")[0] ?? "—"} colors={colors} typography={typography} />
              </View>
            )}
            {canEditPrices && (
              <View style={styles.infoRow}>
                <InfoCell label="Proveedor" value={mat.supplier?.name?.split(" ")[0] ?? "—"} colors={colors} typography={typography} />
              </View>
            )}

            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.gold }, isSaving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving
                ? <ActivityIndicator color={colors.bg} size="small" />
                : <Text style={[typography.h4, { color: colors.bg }]}>Guardar</Text>
              }
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, value, onChangeText, keyboardType, multiline, colors, typography }: {
  label: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: "decimal-pad"; multiline?: boolean; colors: Colors; typography: any;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={typography.label}>{label}</Text>
      <TextInput
        style={[
          { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.textPrimary, fontSize: 16 },
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

const MATERIAL_TYPE_LABELS: Record<string, string> = {
  LUPULO: "Lúpulo", MALTA: "Malta", YEAST: "Levadura", ADJUNTO: "Adjunto", OTRO: "Otro",
};
const MATERIAL_TYPES: MaterialType[] = ["LUPULO", "MALTA", "YEAST", "ADJUNTO", "OTRO"];

function MiniFabRow({
  label, icon, onPress, colors, typography,
}: {
  label: string; icon: string; onPress: () => void; colors: Colors; typography: any;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <View style={{
        paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
        borderRadius: radius.md, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
      }}>
        <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>{label}</Text>
      </View>
      <Pressable
        style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
          alignItems: "center", justifyContent: "center",
          shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
        }}
        onPress={onPress}
        hitSlop={4}
      >
        <Ionicons name={icon as any} size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function CreateMaterialModal({ onClose }: { onClose: () => void }) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState<MaterialType>("OTRO");
  const [unit, setUnit] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [priceUnitVal, setPriceUnitVal] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      materialsApi.create({
        id: `mat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name: name.trim(),
        type,
        unit: unit.trim(),
        brand: brand.trim() || null,
        unitPrice: parseFloat(price) || 0,
        priceUnit: priceUnitVal.trim() || null,
        supplierId: null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["materials"] });
      onClose();
    },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const handleSave = () => {
    if (!name.trim()) return Alert.alert("Error", "El nombre es obligatorio");
    if (!unit.trim()) return Alert.alert("Error", "La unidad es obligatoria (ej: kg, L)");
    createMutation.mutate();
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={typography.h3}>Nuevo ingrediente</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm }}>
            <Field label="Nombre *" value={name} onChangeText={setName} colors={colors} typography={typography} />

            <View style={{ gap: spacing.xs }}>
              <Text style={typography.label}>TIPO *</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {MATERIAL_TYPES.map((t) => (
                  <Pressable
                    key={t}
                    style={[
                      { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1 },
                      t === type
                        ? { borderColor: colors.gold, backgroundColor: colors.goldDim + "22" }
                        : { borderColor: colors.border, backgroundColor: colors.card },
                    ]}
                    onPress={() => setType(t)}
                  >
                    <Text style={[typography.bodySmall, { color: t === type ? colors.gold : colors.textSecondary }]}>
                      {MATERIAL_TYPE_LABELS[t]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Field label="Unidad (ej: kg, L, g, unidad) *" value={unit} onChangeText={setUnit} colors={colors} typography={typography} />
            <Field label="Marca (opcional)" value={brand} onChangeText={setBrand} colors={colors} typography={typography} />
            <Field label="Precio unitario ($)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" colors={colors} typography={typography} />
            <Field label="Unidad de precio (ej: kg, L)" value={priceUnitVal} onChangeText={setPriceUnitVal} colors={colors} typography={typography} />

            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.gold }, createMutation.isPending && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending
                ? <ActivityIndicator color={colors.bg} size="small" />
                : <Text style={[typography.h4, { color: colors.bg }]}>Crear ingrediente</Text>
              }
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    loading: { flex: 1, alignItems: "center", justifyContent: "center" },
    searchRow: {
      padding: spacing.md, paddingBottom: spacing.xs,
    },
    count: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    fab: {
      position: "absolute", bottom: spacing.xl, right: spacing.md,
      width: 56, height: 56, borderRadius: 28,
      alignItems: "center", justifyContent: "center",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
    },
    miniFabs: {
      position: "absolute", bottom: spacing.xl + 68, right: spacing.md,
      gap: spacing.sm, alignItems: "flex-end",
    },
    actionBtn: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md,
      borderWidth: 1,
    },
    overlay: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
    sheet: {
      borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
      maxHeight: "85%", paddingBottom: spacing.xl,
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      alignSelf: "center", marginTop: spacing.sm, marginBottom: spacing.md,
    },
    sheetHeader: {
      flexDirection: "row", alignItems: "flex-start",
      paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm,
    },
    coveragePill: {
      marginHorizontal: spacing.md, marginBottom: spacing.sm,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.md, borderWidth: 1,
    },
    reservedSection: {
      marginHorizontal: spacing.md, marginBottom: spacing.sm,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.md, borderWidth: 1, gap: 4,
    },
    reservedRow: { flexDirection: "row", alignItems: "center" },
    fieldGroup: { paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
    infoRow: { flexDirection: "row", paddingHorizontal: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
    saveBtn: { marginHorizontal: spacing.md, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
    saveBtnDisabled: { opacity: 0.6 },
  });
}
