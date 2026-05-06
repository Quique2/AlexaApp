import React, { useMemo, useState } from "react";
import {
  View, FlatList, Text, StyleSheet, Pressable, Modal,
  ScrollView, TextInput, ActivityIndicator, RefreshControl, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { spacing, radius, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { SectionHeader } from "../components/SectionHeader";
import { recipesApi, materialsApi } from "../services/api";
import type { RecipeLine, Material } from "../types";

const STYLES = ["Löndon", "Whïte", "Kölsh", "Mëxican IPA", "Monterrëy Stout", "Edición especial"];

const STYLE_EMOJIS: Record<string, string> = {
  "Löndon": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Whïte": "🌾",
  "Kölsh": "🇩🇪",
  "Mëxican IPA": "🌶️",
  "Monterrëy Stout": "⚫",
  "Edición especial": "✨",
};

export default function RecipesScreen() {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { hasRole } = useAuth();
  const qc = useQueryClient();

  const canEdit = hasRole(["DEVELOPER", "SUPERVISOR"]);
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<RecipeLine | null>(null);

  const { data: lines, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["recipes", selectedStyle],
    queryFn: () => recipesApi.list(selectedStyle),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recipesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes", selectedStyle] }),
  });

  const handleDelete = (line: RecipeLine) => {
    Alert.alert(
      "Eliminar ingrediente",
      `¿Eliminar ${line.material?.name ?? line.materialId} de la receta?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => deleteMutation.mutate(line.id) },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.styleScroll}>
        <View style={{ flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          {STYLES.map((s) => (
            <Pressable
              key={s}
              style={[
                styles.styleChip,
                { borderColor: colors.border, backgroundColor: colors.card },
                s === selectedStyle && { borderColor: colors.gold, backgroundColor: colors.goldDim + "22" },
              ]}
              onPress={() => setSelectedStyle(s)}
            >
              <Text style={[
                typography.bodySmall,
                { color: s === selectedStyle ? colors.gold : colors.textSecondary },
              ]}>
                {STYLE_EMOJIS[s]} {s}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <SectionHeader title={`RECETA — ${selectedStyle.toUpperCase()}`} />

      {isLoading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={lines}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />}
          renderItem={({ item }) => (
            <RecipeLineRow
              line={item}
              canEdit={canEdit}
              colors={colors}
              typography={typography}
              onEdit={() => setEditing(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="Sin ingredientes"
              subtitle={canEdit ? "Agrega ingredientes a esta receta" : "Sin receta para este estilo"}
            />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {canEdit && (
        <Pressable
          style={[styles.fab, { backgroundColor: colors.gold, shadowColor: colors.gold }]}
          onPress={() => setShowAdd(true)}
        >
          <Ionicons name="add" size={26} color={colors.bg} />
        </Pressable>
      )}

      {showAdd && (
        <AddLineModal
          beerStyle={selectedStyle}
          existingIds={(lines ?? []).map((l) => l.materialId)}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editing && (
        <EditLineModal
          line={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}

function RecipeLineRow({
  line, canEdit, colors, typography, onEdit, onDelete,
}: {
  line: RecipeLine;
  canEdit: boolean;
  colors: Colors;
  typography: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[lineStyles.row, { borderBottomColor: colors.border }]}>
      <View style={lineStyles.info}>
        <Text style={[typography.h4, { fontSize: 14 }]}>
          {line.material?.name ?? line.materialId}
        </Text>
        <Text style={typography.caption}>
          {line.material?.type} · {line.material?.brand ?? "—"}
        </Text>
        {line.notes ? <Text style={[typography.caption, { color: colors.textSecondary }]}>{line.notes}</Text> : null}
      </View>
      <View style={lineStyles.right}>
        <Text style={[typography.h4, { fontSize: 14, color: colors.gold }]}>
          {line.qtyPerBatch} {line.material?.unit}
        </Text>
        <Text style={typography.caption}>por lote</Text>
      </View>
      {canEdit && (
        <View style={lineStyles.actions}>
          <Pressable onPress={onEdit} hitSlop={8}>
            <Ionicons name="pencil-outline" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const lineStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  info: { flex: 1, gap: 2 },
  right: { alignItems: "flex-end", marginRight: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
});

function AddLineModal({
  beerStyle, existingIds, onClose,
}: {
  beerStyle: string;
  existingIds: string[];
  onClose: () => void;
}) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const qc = useQueryClient();

  const { data: materials, isLoading } = useQuery({
    queryKey: ["materials"],
    queryFn: () => materialsApi.list(),
  });

  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  const createMutation = useMutation({
    mutationFn: recipesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes", beerStyle] });
      onClose();
    },
  });

  const available = (materials ?? []).filter(
    (m) => !existingIds.includes(m.id) && m.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    if (!selectedMaterial) return Alert.alert("Error", "Selecciona un material");
    if (!qty || isNaN(parseFloat(qty))) return Alert.alert("Error", "Cantidad inválida");
    createMutation.mutate({
      beerStyle,
      materialId: selectedMaterial.id,
      qtyPerBatch: parseFloat(qty),
      notes: notes || undefined,
    });
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={typography.h3}>Agregar ingrediente</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {selectedMaterial ? (
            <View style={styles.formContent}>
              <View style={[{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: spacing.sm }]}>
                <Text style={[typography.h4, { flex: 1 }]}>{selectedMaterial.name}</Text>
                <Pressable onPress={() => setSelectedMaterial(null)}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
              <View style={{ marginBottom: spacing.sm, gap: spacing.xs }}>
                <Text style={typography.label}>CANTIDAD POR LOTE ({selectedMaterial.unit})</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
                    borderColor: colors.border, paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm, color: colors.textPrimary, fontSize: 15,
                  }}
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textMuted}
                  placeholder={`ej. 60`}
                />
              </View>
              <View style={{ marginBottom: spacing.md, gap: spacing.xs }}>
                <Text style={typography.label}>NOTAS</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
                    borderColor: colors.border, paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm, color: colors.textPrimary, fontSize: 15,
                  }}
                  value={notes}
                  onChangeText={setNotes}
                  placeholderTextColor={colors.textMuted}
                  placeholder="Opcional"
                />
              </View>
              <Pressable
                style={[styles.saveBtn, { backgroundColor: colors.gold }, createMutation.isPending && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending
                  ? <ActivityIndicator color={colors.bg} />
                  : <Text style={[typography.h4, { color: colors.bg }]}>Agregar a receta</Text>
                }
              </Pressable>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.xs }}>
                <TextInput
                  style={{
                    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
                    borderColor: colors.border, paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm, color: colors.textPrimary, fontSize: 15,
                  }}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar material..."
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              {isLoading ? (
                <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.lg }} />
              ) : (
                <FlatList
                  data={available}
                  keyExtractor={(m) => m.id}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm }]}
                      onPress={() => setSelectedMaterial(item)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.h4, { fontSize: 14 }]}>{item.name}</Text>
                        <Text style={typography.caption}>{item.type} · {item.unit}</Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={20} color={colors.gold} />
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <View style={{ padding: spacing.lg, alignItems: "center" }}>
                      <Text style={typography.caption}>No hay materiales disponibles</Text>
                    </View>
                  }
                  contentContainerStyle={{ paddingBottom: spacing.xxl }}
                />
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function EditLineModal({ line, onClose }: { line: RecipeLine; onClose: () => void }) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const qc = useQueryClient();

  const [qty, setQty] = useState(String(line.qtyPerBatch));
  const [notes, setNotes] = useState(line.notes ?? "");

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { qtyPerBatch: number; notes?: string } }) =>
      recipesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      onClose();
    },
  });

  const handleSave = () => {
    if (!qty || isNaN(parseFloat(qty))) return Alert.alert("Error", "Cantidad inválida");
    updateMutation.mutate({
      id: line.id,
      data: { qtyPerBatch: parseFloat(qty), notes: notes || undefined },
    });
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={typography.h3}>{line.material?.name}</Text>
              <Text style={typography.caption}>{line.material?.type} · {line.material?.unit}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.formContent}>
            <View style={{ marginBottom: spacing.sm, gap: spacing.xs }}>
              <Text style={typography.label}>CANTIDAD POR LOTE ({line.material?.unit})</Text>
              <TextInput
                style={{
                  backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
                  borderColor: colors.border, paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm, color: colors.textPrimary, fontSize: 15,
                }}
                value={qty}
                onChangeText={setQty}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={{ marginBottom: spacing.md, gap: spacing.xs }}>
              <Text style={typography.label}>NOTAS</Text>
              <TextInput
                style={{
                  backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
                  borderColor: colors.border, paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm, color: colors.textPrimary, fontSize: 15,
                }}
                value={notes}
                onChangeText={setNotes}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.gold }, updateMutation.isPending && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={[typography.h4, { color: colors.bg }]}>Guardar</Text>
              }
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    styleScroll: { maxHeight: 56 },
    styleChip: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: radius.full, borderWidth: 1,
    },
    fab: {
      position: "absolute", bottom: spacing.xl, right: spacing.md,
      width: 56, height: 56, borderRadius: 28,
      alignItems: "center", justifyContent: "center",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
    },
    overlay: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
    sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: "85%" },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      alignSelf: "center", marginTop: spacing.sm, marginBottom: spacing.md,
    },
    sheetHeader: {
      flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
      paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    },
    formContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
    saveBtn: {
      borderRadius: radius.md, paddingVertical: spacing.md,
      alignItems: "center", marginTop: spacing.sm,
    },
  });
}
