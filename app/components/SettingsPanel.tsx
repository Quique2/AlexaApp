import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  ActivityIndicator, Alert, Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { spacing, radius, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { settingsApi } from "../services/api";
import type { SettingDef, SettingsMap } from "../types";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { label: string; icon: string; comingSoon?: boolean }> = {
  general:       { label: "General",       icon: "settings-outline" },
  dashboard:     { label: "Dashboard",     icon: "grid-outline" },
  inventory:     { label: "Inventario",    icon: "cube-outline" },
  production:    { label: "Producción",    icon: "flask-outline" },
  jit:           { label: "JIT",           icon: "timer-outline" },
  orders:        { label: "Pedidos",       icon: "cart-outline" },
  recipes:       { label: "Recetas",       icon: "list-outline" },
  audit:         { label: "Auditoría",     icon: "document-text-outline" },
  security:      { label: "Seguridad",     icon: "shield-outline" },
  notifications: { label: "Notificaciones", icon: "notifications-outline", comingSoon: true },
};

const CATEGORY_ORDER = ["general","dashboard","inventory","production","jit","orders","recipes","audit","security","notifications"];

// ─── SettingRow ───────────────────────────────────────────────────────────────

function SettingRow({
  setting, canEdit, onSave, colors, typography,
}: {
  setting: SettingDef;
  canEdit: boolean;
  onSave: (key: string, value: string) => void;
  colors: Colors;
  typography: any;
}) {
  const [localValue, setLocalValue] = useState(setting.value);
  const [dirty, setDirty] = useState(false);

  const handleChange = (v: string) => { setLocalValue(v); setDirty(v !== setting.value); };

  const handleSave = () => {
    if (!dirty) return;
    onSave(setting.key, localValue);
    setDirty(false);
  };

  const isRestricted = setting.editableByRole === "DEVELOPER" && !canEdit;

  return (
    <View style={[rowStyles.container, { borderBottomColor: colors.border }]}>
      <View style={rowStyles.header}>
        <View style={rowStyles.labelRow}>
          <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: "600" }]}>
            {setting.label}
          </Text>
          {setting.editableByRole === "DEVELOPER" && (
            <View style={[rowStyles.badge, { backgroundColor: colors.red + "22", borderColor: colors.red + "44" }]}>
              <Text style={[typography.label, { fontSize: 8, color: colors.red }]}>DEV</Text>
            </View>
          )}
        </View>
        {setting.description && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {setting.description}
          </Text>
        )}
      </View>

      <View style={rowStyles.control}>
        {setting.valueType === "boolean" ? (
          <Switch
            value={localValue === "true"}
            onValueChange={(v) => {
              const s = String(v);
              setLocalValue(s);
              onSave(setting.key, s);
            }}
            disabled={!canEdit || isRestricted}
            trackColor={{ false: colors.border, true: colors.gold }}
            thumbColor={localValue === "true" ? colors.bg : colors.textMuted}
          />
        ) : setting.valueType === "select" && setting.options ? (
          <View style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {setting.options.map((opt) => (
              <Pressable
                key={opt}
                style={[
                  rowStyles.optChip,
                  { borderColor: localValue === opt ? colors.gold : colors.border,
                    backgroundColor: localValue === opt ? colors.gold + "22" : colors.card },
                ]}
                onPress={() => {
                  if (!canEdit || isRestricted) return;
                  setLocalValue(opt);
                  onSave(setting.key, opt);
                }}
                disabled={!canEdit || isRestricted}
              >
                <Text style={[typography.label, { fontSize: 10, color: localValue === opt ? colors.gold : colors.textSecondary }]}>
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <TextInput
              style={[
                rowStyles.input,
                { backgroundColor: colors.card, borderColor: dirty ? colors.gold : colors.border, color: colors.textPrimary },
              ]}
              value={localValue}
              onChangeText={handleChange}
              editable={canEdit && !isRestricted}
              keyboardType={setting.valueType === "number" ? "numeric" : "default"}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              onBlur={handleSave}
              placeholderTextColor={colors.textMuted}
            />
            {dirty && canEdit && (
              <Pressable onPress={handleSave} style={[rowStyles.saveBtn, { backgroundColor: colors.gold }]} hitSlop={6}>
                <Ionicons name="checkmark" size={14} color={colors.bg} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {isRestricted && (
        <Text style={[typography.label, { fontSize: 9, color: colors.textMuted, marginTop: 2 }]}>
          Solo editable por DEVELOPER
        </Text>
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1 },
  header: { marginBottom: spacing.xs },
  labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  badge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: radius.full, borderWidth: 1 },
  control: { alignItems: "flex-end" },
  input: {
    borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    fontSize: 14, minWidth: 80, textAlign: "right",
  },
  saveBtn: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  optChip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
});

// ─── CategoryPanel ────────────────────────────────────────────────────────────

function CategoryPanel({
  category, settings, isDeveloper, onSave, colors, typography,
}: {
  category: string;
  settings: SettingDef[];
  isDeveloper: boolean;
  onSave: (cat: string, key: string, value: string) => void;
  colors: Colors;
  typography: any;
}) {
  const meta = CATEGORY_LABELS[category];
  if (meta?.comingSoon) {
    return (
      <View style={{ padding: spacing.lg, alignItems: "center" }}>
        <Ionicons name="notifications-outline" size={32} color={colors.textMuted} />
        <Text style={[typography.h4, { color: colors.textMuted, marginTop: spacing.sm }]}>Próximamente</Text>
        <Text style={[typography.caption, { textAlign: "center", marginTop: spacing.xs }]}>
          Las notificaciones se configurarán en una versión futura.
        </Text>
      </View>
    );
  }

  if (category === "jit") {
    return (
      <View>
        {settings.map((s) => (
          <SettingRow
            key={s.key}
            setting={s}
            canEdit={isDeveloper || s.editableByRole === "SUPERVISOR"}
            onSave={(k, v) => onSave(category, k, v)}
            colors={colors}
            typography={typography}
          />
        ))}
      </View>
    );
  }

  return (
    <View>
      {settings.map((s) => (
        <SettingRow
          key={s.key}
          setting={s}
          canEdit={isDeveloper || s.editableByRole === "SUPERVISOR"}
          onSave={(k, v) => onSave(category, k, v)}
          colors={colors}
          typography={typography}
        />
      ))}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsPanel() {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isDeveloper = hasRole(["DEVELOPER"]);

  const [activeCategory, setActiveCategory] = useState("general");

  const { data, isLoading, isError } = useQuery<SettingsMap>({
    queryKey: ["settings"],
    queryFn: settingsApi.all,
  });

  const mutation = useMutation({
    mutationFn: ({ category, key, value }: { category: string; key: string; value: string }) =>
      settingsApi.update(category, key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: any) => Alert.alert("Error", e.message ?? "No se pudo guardar el ajuste"),
  });

  const handleSave = (category: string, key: string, value: string) => {
    mutation.mutate({ category, key, value });
  };

  if (isLoading) return <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />;
  if (isError) return (
    <View style={{ padding: spacing.lg, alignItems: "center" }}>
      <Text style={[typography.bodySmall, { color: colors.red }]}>Error cargando ajustes</Text>
    </View>
  );

  const activeSettings = data?.[activeCategory] ?? [];

  return (
    <View style={styles.container}>
      {/* Category tabs (horizontal scroll) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.xs, paddingVertical: spacing.xs }}
      >
        {CATEGORY_ORDER.map((cat) => {
          const meta = CATEGORY_LABELS[cat];
          if (!meta) return null;
          const active = activeCategory === cat;
          return (
            <Pressable
              key={cat}
              style={[
                styles.catChip,
                {
                  borderColor: active ? colors.gold : colors.border,
                  backgroundColor: active ? colors.gold + "18" : colors.card,
                },
              ]}
              onPress={() => setActiveCategory(cat)}
            >
              <Ionicons name={meta.icon as any} size={12} color={active ? colors.gold : colors.textMuted} />
              <Text style={[typography.label, { fontSize: 11, color: active ? colors.gold : colors.textSecondary }]}>
                {meta.label}
              </Text>
              {meta.comingSoon && (
                <View style={[styles.soonBadge, { backgroundColor: colors.textMuted + "44" }]}>
                  <Text style={{ fontSize: 7, color: colors.textMuted }}>PRONTO</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Settings list */}
      <ScrollView>
        <CategoryPanel
          category={activeCategory}
          settings={activeSettings}
          isDeveloper={isDeveloper}
          onSave={handleSave}
          colors={colors}
          typography={typography}
        />

        {/* Category note */}
        <View style={{ padding: spacing.md, gap: spacing.xs }}>
          {["security","dashboard","inventory"].includes(activeCategory) && (
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}>
              Los ajustes de esta sección se guardan pero aún no afectan el comportamiento de la app. Se conectarán en versiones futuras.
            </Text>
          )}
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {mutation.isPending && (
        <View style={[styles.savingBanner, { backgroundColor: colors.gold + "22" }]}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={[typography.label, { fontSize: 11, color: colors.gold }]}>Guardando...</Text>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    tabBar: { borderBottomWidth: 1, flexGrow: 0 },
    catChip: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs,
      borderRadius: radius.full, borderWidth: 1,
    },
    soonBadge: {
      paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3, marginLeft: 2,
    },
    savingBanner: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: spacing.xs, paddingVertical: spacing.xs,
    },
  });
}
