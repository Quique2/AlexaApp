import React, { useMemo, useState, useCallback } from "react";
import {
  View, FlatList, Text, StyleSheet, Pressable, Modal,
  ScrollView, TextInput, ActivityIndicator, RefreshControl,
  Alert, KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { spacing, radius, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { ConfirmModal } from "../components/ConfirmModal";
import { StyleImage } from "../components/StyleImage";
import { recipesApi, materialsApi, stylesApi } from "../services/api";
import { fmt } from "../utils/fmt";
import type { RecipeLine, Material } from "../types";

const MATERIAL_TYPE_LABELS: Record<string, string> = {
  LUPULO: "Lúpulo", MALTA: "Malta", YEAST: "Levadura", ADJUNTO: "Adjunto", OTRO: "Otro",
};
const TYPE_COLORS: Record<string, string> = {
  LUPULO: "#22c55e", MALTA: "#f59e0b", YEAST: "#8b5cf6", ADJUNTO: "#06b6d4", OTRO: "#94a3b8",
};

async function pickImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
    base64: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.base64) return `data:image/jpeg;base64,${asset.base64}`;
  return asset.uri;
}

export default function RecipesScreen() {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { hasRole } = useAuth();
  const qc = useQueryClient();

  const canEdit = hasRole(["DEVELOPER", "SUPERVISOR"]);

  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showCreateStyle, setShowCreateStyle] = useState(false);
  const [editingLine, setEditingLine] = useState<RecipeLine | null>(null);
  const [editingStyle, setEditingStyle] = useState<{ name: string; imageUri: string | null } | null>(null);
  const [deleteLineTarget, setDeleteLineTarget] = useState<RecipeLine | null>(null);
  const [deleteStyleTarget, setDeleteStyleTarget] = useState<string | null>(null);

  const { data: stylesList, isLoading: stylesLoading, refetch: refetchStyles } = useQuery({
    queryKey: ["styles"],
    queryFn: stylesApi.list,
  });

  const currentStyleName = selectedStyle ?? stylesList?.[0]?.name ?? null;
  const currentStyleMeta = stylesList?.find((s) => s.name === currentStyleName) ?? null;

  const { data: lines, isLoading: linesLoading, refetch: refetchLines, isRefetching } = useQuery({
    queryKey: ["recipes", currentStyleName],
    queryFn: () => recipesApi.list(currentStyleName!),
    enabled: !!currentStyleName,
  });

  const deleteLineMutation = useMutation({
    mutationFn: (id: string) => recipesApi.delete(id),
    onSuccess: (_, id) => {
      qc.setQueryData<RecipeLine[]>(["recipes", currentStyleName], (old) =>
        Array.isArray(old) ? old.filter((l) => l.id !== id) : old
      );
      setDeleteLineTarget(null);
    },
  });

  const deleteStyleMutation = useMutation({
    mutationFn: (name: string) => stylesApi.delete(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["styles"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      setSelectedStyle(null);
      setDeleteStyleTarget(null);
    },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const refetch = useCallback(() => {
    refetchStyles();
    refetchLines();
  }, [refetchStyles, refetchLines]);

  const isLoading = stylesLoading || (linesLoading && !!currentStyleName);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Style selector strip */}
      <View style={[styles.selectorBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectorContent}>
          {stylesList?.map((s) => {
            const active = s.name === currentStyleName;
            return (
              <Pressable
                key={s.name}
                style={[styles.styleChip, { borderColor: active ? colors.gold : colors.border, backgroundColor: active ? colors.goldDim + "22" : colors.card }]}
                onPress={() => setSelectedStyle(s.name)}
              >
                <StyleImage name={s.name} imageUri={s.imageUri} size={26} />
                <Text style={[typography.bodySmall, { color: active ? colors.gold : colors.textSecondary, fontWeight: active ? "600" : "400" }]} numberOfLines={1}>
                  {s.name}
                </Text>
              </Pressable>
            );
          })}
          {canEdit && (
            <Pressable
              style={[styles.styleChip, { borderColor: colors.border, borderStyle: "dashed", backgroundColor: "transparent" }]}
              onPress={() => setShowCreateStyle(true)}
            >
              <Ionicons name="add" size={16} color={colors.textMuted} />
              <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Nuevo</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
      ) : !currentStyleName ? (
        <EmptyState icon="🍺" title="Sin productos" subtitle="Crea tu primer producto con el botón +" />
      ) : (
        <FlatList
          data={lines}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />}
          ListHeaderComponent={() => (
            <StyleHeader
              name={currentStyleName}
              imageUri={currentStyleMeta?.imageUri ?? null}
              ingredientCount={lines?.length ?? 0}
              canEdit={canEdit}
              colors={colors}
              typography={typography}
              onEditStyle={() => setEditingStyle({ name: currentStyleName, imageUri: currentStyleMeta?.imageUri ?? null })}
              onDeleteStyle={() => setDeleteStyleTarget(currentStyleName)}
              onAddIngredient={() => setShowAdd(true)}
            />
          )}
          renderItem={({ item }) => (
            <IngredientRow
              line={item}
              canEdit={canEdit}
              colors={colors}
              typography={typography}
              onEdit={() => setEditingLine(item)}
              onDelete={() => setDeleteLineTarget(item)}
            />
          )}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
              <EmptyState
                icon="📋"
                title="Sin ingredientes"
                subtitle={canEdit ? "Agrega el primer ingrediente" : "Sin receta para este estilo"}
              />
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {/* Modals */}
      {showAdd && currentStyleName && (
        <AddLineModal
          beerStyle={currentStyleName}
          existingIds={(lines ?? []).map((l) => l.materialId)}
          onClose={() => setShowAdd(false)}
        />
      )}
      {showCreateStyle && (
        <CreateStyleModal
          onClose={() => setShowCreateStyle(false)}
          onCreate={(name) => {
            qc.invalidateQueries({ queryKey: ["styles"] });
            setSelectedStyle(name);
          }}
        />
      )}
      {editingLine && (
        <EditLineModal line={editingLine} onClose={() => setEditingLine(null)} />
      )}
      {editingStyle && (
        <EditStyleModal
          currentName={editingStyle.name}
          currentImageUri={editingStyle.imageUri}
          onClose={() => setEditingStyle(null)}
          onSaved={(newName) => {
            qc.invalidateQueries({ queryKey: ["styles"] });
            qc.invalidateQueries({ queryKey: ["recipes"] });
            setSelectedStyle(newName);
            setEditingStyle(null);
          }}
        />
      )}

      <ConfirmModal
        visible={!!deleteLineTarget}
        title="Eliminar ingrediente"
        message={deleteLineTarget ? `¿Eliminar ${deleteLineTarget.material?.name ?? deleteLineTarget.materialId} de la receta?` : ""}
        confirmLabel="Eliminar"
        destructive
        onCancel={() => setDeleteLineTarget(null)}
        onConfirm={() => deleteLineTarget && deleteLineMutation.mutate(deleteLineTarget.id)}
      />
      <ConfirmModal
        visible={!!deleteStyleTarget}
        title="Eliminar producto"
        message={`¿Eliminar el producto "${deleteStyleTarget}" y todos sus ingredientes? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar todo"
        destructive
        onCancel={() => setDeleteStyleTarget(null)}
        onConfirm={() => deleteStyleTarget && deleteStyleMutation.mutate(deleteStyleTarget)}
      />
    </View>
  );
}

// ─── Style Header ─────────────────────────────────────────────────────────────

function StyleHeader({
  name, imageUri, ingredientCount, canEdit, colors, typography,
  onEditStyle, onDeleteStyle, onAddIngredient,
}: {
  name: string; imageUri: string | null; ingredientCount: number;
  canEdit: boolean; colors: Colors; typography: any;
  onEditStyle: () => void; onDeleteStyle: () => void; onAddIngredient: () => void;
}) {
  return (
    <View style={[headerStyles.wrapper, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={headerStyles.hero}>
        <StyleImage name={name} imageUri={imageUri} size={72} borderRadius={12} />
        <View style={headerStyles.info}>
          <Text style={[typography.h2, { fontSize: 20 }]}>{name}</Text>
          <Text style={[typography.caption, { marginTop: 2 }]}>
            {ingredientCount} ingrediente{ingredientCount !== 1 ? "s" : ""}
          </Text>
        </View>
        {canEdit && (
          <View style={headerStyles.actions}>
            <Pressable hitSlop={8} onPress={onEditStyle} style={[headerStyles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="pencil-outline" size={15} color={colors.textSecondary} />
            </Pressable>
            <Pressable hitSlop={8} onPress={onDeleteStyle} style={[headerStyles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
            </Pressable>
          </View>
        )}
      </View>

      {canEdit && (
        <Pressable
          onPress={onAddIngredient}
          style={[headerStyles.addBtn, { borderColor: colors.gold + "66", backgroundColor: colors.goldDim + "11" }]}
        >
          <Ionicons name="add-circle-outline" size={16} color={colors.gold} />
          <Text style={[typography.label, { color: colors.gold, fontSize: 11 }]}>AGREGAR INGREDIENTE</Text>
        </Pressable>
      )}

      <Text style={[typography.label, { color: colors.textMuted, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs, fontSize: 10 }]}>
        INGREDIENTES
      </Text>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrapper: { borderBottomWidth: 1, marginBottom: 0 },
  hero: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md },
  info: { flex: 1, gap: 2 },
  actions: { flexDirection: "row", gap: spacing.xs },
  iconBtn: { padding: 7, borderRadius: radius.sm, borderWidth: 1 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md,
    borderRadius: radius.sm, borderWidth: 1,
    alignSelf: "flex-start",
  },
});

// ─── Ingredient Row ───────────────────────────────────────────────────────────

function IngredientRow({
  line, canEdit, colors, typography, onEdit, onDelete,
}: {
  line: RecipeLine; canEdit: boolean; colors: Colors; typography: any;
  onEdit: () => void; onDelete: () => void;
}) {
  const typeColor = TYPE_COLORS[line.material?.type ?? "OTRO"] ?? "#94a3b8";
  return (
    <View style={[rowStyles.row, { borderBottomColor: colors.border }]}>
      <View style={[rowStyles.indicator, { backgroundColor: typeColor }]} />
      <View style={rowStyles.info}>
        <Text style={[typography.h4, { fontSize: 14 }]} numberOfLines={1}>
          {line.material?.name ?? line.materialId}
        </Text>
        <Text style={typography.caption}>
          {MATERIAL_TYPE_LABELS[line.material?.type ?? ""] ?? line.material?.type}
          {line.material?.brand ? ` · ${line.material.brand}` : ""}
          {line.notes ? ` · ${line.notes}` : ""}
        </Text>
      </View>
      <View style={rowStyles.right}>
        <Text style={[typography.h4, { fontSize: 14, color: colors.gold }]}>
          {fmt(line.qtyPerBatch)} {line.material?.unit}
        </Text>
        <Text style={typography.caption}>por lote</Text>
      </View>
      {canEdit && (
        <View style={rowStyles.actions}>
          <Pressable onPress={onEdit} hitSlop={8}>
            <Ionicons name="pencil-outline" size={15} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingVertical: spacing.sm + 2, paddingRight: spacing.md, gap: spacing.sm },
  indicator: { width: 3, alignSelf: "stretch", borderRadius: 2, marginLeft: spacing.md },
  info: { flex: 1, gap: 2 },
  right: { alignItems: "flex-end", marginRight: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm },
});

// ─── Edit Style Modal ─────────────────────────────────────────────────────────

function EditStyleModal({
  currentName, currentImageUri, onClose, onSaved,
}: {
  currentName: string; currentImageUri: string | null;
  onClose: () => void; onSaved: (newName: string) => void;
}) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState(currentName);
  const [imageUri, setImageUri] = useState<string | null>(currentImageUri);
  const [uploading, setUploading] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; imageUri?: string | null }) =>
      stylesApi.update(currentName, data),
    onSuccess: (result) => onSaved(result.name),
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const handlePickImage = async () => {
    setUploading(true);
    try {
      const uri = await pickImage();
      if (uri) setImageUri(uri);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return Alert.alert("Error", "El nombre no puede estar vacío");
    updateMutation.mutate({
      name: trimmed !== currentName ? trimmed : undefined,
      imageUri,
    });
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={typography.h3}>Editar producto</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            {/* Image picker */}
            <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
              <Pressable onPress={handlePickImage} disabled={uploading}>
                <View style={{ position: "relative" }}>
                  <StyleImage name={name || currentName} imageUri={imageUri} size={100} borderRadius={16} />
                  <View style={[editStyleStyles.imageOverlay, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
                    {uploading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Ionicons name="camera-outline" size={22} color="#fff" />
                    }
                  </View>
                </View>
              </Pressable>
              <Text style={[typography.caption, { marginTop: spacing.xs, color: colors.textMuted }]}>
                Toca para cambiar la imagen
              </Text>
              {imageUri && (
                <Pressable onPress={() => setImageUri(null)} style={{ marginTop: 4 }}>
                  <Text style={[typography.caption, { color: colors.red }]}>Quitar imagen</Text>
                </Pressable>
              )}
            </View>

            <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
              <Text style={typography.label}>NOMBRE DEL PRODUCTO</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
            </View>

            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.gold }, updateMutation.isPending && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={[typography.h4, { color: colors.bg }]}>Guardar cambios</Text>
              }
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const editStyleStyles = StyleSheet.create({
  imageOverlay: {
    position: "absolute", inset: 0, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
});

// ─── Add Line Modal ───────────────────────────────────────────────────────────

function AddLineModal({ beerStyle, existingIds, onClose }: {
  beerStyle: string; existingIds: string[]; onClose: () => void;
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recipes", beerStyle] }); onClose(); },
  });

  const available = (materials ?? []).filter(
    (m) => !existingIds.includes(m.id) && m.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    if (!selectedMaterial) return Alert.alert("Error", "Selecciona un material");
    if (!qty || isNaN(parseFloat(qty))) return Alert.alert("Error", "Cantidad inválida");
    createMutation.mutate({ beerStyle, materialId: selectedMaterial.id, qtyPerBatch: parseFloat(qty), notes: notes || undefined });
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={typography.h3}>Agregar ingrediente</Text>
            <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={22} color={colors.textSecondary} /></Pressable>
          </View>
          {selectedMaterial ? (
            <View style={styles.formContent}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: spacing.sm }}>
                <View style={[{ width: 4, height: 36, borderRadius: 2, backgroundColor: TYPE_COLORS[selectedMaterial.type] ?? "#94a3b8" }]} />
                <Text style={[typography.h4, { flex: 1 }]}>{selectedMaterial.name}</Text>
                <Pressable onPress={() => setSelectedMaterial(null)}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
              <View style={{ marginBottom: spacing.sm, gap: spacing.xs }}>
                <Text style={typography.label}>CANTIDAD POR LOTE ({selectedMaterial.unit})</Text>
                <TextInput style={styles.input} value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} placeholder="ej. 60" autoFocus />
              </View>
              <View style={{ marginBottom: spacing.md, gap: spacing.xs }}>
                <Text style={typography.label}>NOTAS (opcional)</Text>
                <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholderTextColor={colors.textMuted} placeholder="Mash, aroma, dry hop..." />
              </View>
              <Pressable style={[styles.saveBtn, { backgroundColor: colors.gold }, createMutation.isPending && { opacity: 0.6 }]} onPress={handleSave} disabled={createMutation.isPending}>
                {createMutation.isPending ? <ActivityIndicator color={colors.bg} /> : <Text style={[typography.h4, { color: colors.bg }]}>Agregar a receta</Text>}
              </Pressable>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.xs }}>
                <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Buscar material..." placeholderTextColor={colors.textMuted} autoFocus />
              </View>
              {isLoading ? (
                <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.lg }} />
              ) : (
                <FlatList
                  data={available}
                  keyExtractor={(m) => m.id}
                  renderItem={({ item }) => (
                    <Pressable style={[{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm }]} onPress={() => setSelectedMaterial(item)}>
                      <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: TYPE_COLORS[item.type] ?? "#94a3b8" }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.h4, { fontSize: 14 }]}>{item.name}</Text>
                        <Text style={typography.caption}>{MATERIAL_TYPE_LABELS[item.type] ?? item.type} · {item.unit}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                  )}
                  ListEmptyComponent={<View style={{ padding: spacing.lg, alignItems: "center" }}><Text style={typography.caption}>No hay materiales disponibles</Text></View>}
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

// ─── Edit Line Modal ──────────────────────────────────────────────────────────

function EditLineModal({ line, onClose }: { line: RecipeLine; onClose: () => void }) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const qc = useQueryClient();

  const [qty, setQty] = useState(String(line.qtyPerBatch));
  const [notes, setNotes] = useState(line.notes ?? "");

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { qtyPerBatch: number; notes?: string } }) =>
      recipesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recipes"] }); onClose(); },
  });

  const handleSave = () => {
    if (!qty || isNaN(parseFloat(qty))) return Alert.alert("Error", "Cantidad inválida");
    updateMutation.mutate({ id: line.id, data: { qtyPerBatch: parseFloat(qty), notes: notes || undefined } });
  };

  const typeColor = TYPE_COLORS[line.material?.type ?? "OTRO"] ?? "#94a3b8";

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: typeColor }} />
              <View>
                <Text style={typography.h3}>{line.material?.name}</Text>
                <Text style={typography.caption}>{MATERIAL_TYPE_LABELS[line.material?.type ?? ""] ?? line.material?.type} · {line.material?.unit}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={22} color={colors.textSecondary} /></Pressable>
          </View>
          <View style={styles.formContent}>
            <View style={{ marginBottom: spacing.sm, gap: spacing.xs }}>
              <Text style={typography.label}>CANTIDAD POR LOTE ({line.material?.unit})</Text>
              <TextInput style={styles.input} value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} autoFocus />
            </View>
            <View style={{ marginBottom: spacing.md, gap: spacing.xs }}>
              <Text style={typography.label}>NOTAS (opcional)</Text>
              <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholderTextColor={colors.textMuted} />
            </View>
            <Pressable style={[styles.saveBtn, { backgroundColor: colors.gold }, updateMutation.isPending && { opacity: 0.6 }]} onPress={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <ActivityIndicator color={colors.bg} /> : <Text style={[typography.h4, { color: colors.bg }]}>Guardar</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Create Style Modal ───────────────────────────────────────────────────────

function CreateStyleModal({ onClose, onCreate }: {
  onClose: () => void; onCreate: (name: string) => void;
}) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; imageUri?: string | null }) => stylesApi.upsert(data.name, data.imageUri),
    onSuccess: (result) => { onCreate(result.name); onClose(); },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const handlePickImage = async () => {
    setUploading(true);
    try { const uri = await pickImage(); if (uri) setImageUri(uri); }
    finally { setUploading(false); }
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return Alert.alert("Error", "El nombre no puede estar vacío");
    createMutation.mutate({ name: trimmed, imageUri });
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={typography.h3}>Nuevo producto</Text>
            <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={22} color={colors.textSecondary} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            {/* Image picker */}
            <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
              <Pressable onPress={handlePickImage} disabled={uploading}>
                <View style={{ position: "relative" }}>
                  <StyleImage name={name || "Nuevo"} imageUri={imageUri} size={90} borderRadius={14} />
                  <View style={[editStyleStyles.imageOverlay, { backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 14 }]}>
                    {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="camera-outline" size={22} color="#fff" />}
                  </View>
                </View>
              </Pressable>
              <Text style={[typography.caption, { marginTop: spacing.xs, color: colors.textMuted }]}>Agregar imagen (opcional)</Text>
            </View>

            <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
              <Text style={typography.label}>NOMBRE DEL PRODUCTO</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="ej. Session IPA, Amber Ale..." placeholderTextColor={colors.textMuted} autoCapitalize="words" />
            </View>
            <Pressable style={[styles.saveBtn, { backgroundColor: colors.gold }, createMutation.isPending && { opacity: 0.6 }]} onPress={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? <ActivityIndicator color={colors.bg} /> : <Text style={[typography.h4, { color: colors.bg }]}>Crear producto</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    selectorBar: { borderBottomWidth: 1 },
    selectorContent: { flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    styleChip: {
      flexDirection: "row", alignItems: "center", gap: spacing.xs,
      paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
      borderRadius: radius.full, borderWidth: 1, height: 40,
    },
    overlay: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
    sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: "88%" },
    handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: spacing.sm, marginBottom: spacing.md },
    sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    formContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
    input: {
      backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
      borderColor: colors.border, paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm, color: colors.textPrimary, fontSize: 15,
    },
    saveBtn: { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.sm },
  });
}
