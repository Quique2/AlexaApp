import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Switch,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, ColorMode } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { spacing, radius } from "../constants/theme";
import type { FontSize } from "../constants/theme";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const FONT_SIZE_OPTIONS: { value: FontSize; label: string; size: number }[] = [
  { value: "small", label: "Pequeña", size: 13 },
  { value: "normal", label: "Normal", size: 16 },
  { value: "large", label: "Grande", size: 20 },
];

const MODE_OPTIONS: { value: ColorMode; label: string; icon: "moon" | "sunny" }[] = [
  { value: "dark", label: "Oscuro", icon: "moon" },
  { value: "light", label: "Claro", icon: "sunny" },
];

export function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { colorMode, fontSize, colors, typography, setColorMode, setFontSize } = useTheme();
  const { logout, biometricAvailable, biometricEnabled, enableBiometrics, disableBiometrics } = useAuth();

  async function handleLogout() {
    if (Platform.OS === "web") {
      // Alert.alert is unreliable on web after a Modal closes; use native confirm
      if (!window.confirm("¿Seguro que quieres salir?")) return;
      onClose();
      await logout();
      return;
    }
    onClose();
    Alert.alert("Cerrar sesión", "¿Seguro que quieres salir?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }

  function handleBioToggle(val: boolean) {
    if (val) {
      enableBiometrics().catch((e) => Alert.alert("Error", e.message));
    } else {
      disableBiometrics().catch(() => {});
    }
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={[typography.h3, { flex: 1 }]}>Ajustes</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* ── Appearance ── */}
        <View style={[styles.section, { borderTopColor: colors.border }]}>
          <Text style={typography.label}>APARIENCIA</Text>
          <View style={styles.optionRow}>
            {MODE_OPTIONS.map(({ value, label, icon }) => {
              const active = colorMode === value;
              return (
                <Pressable
                  key={value}
                  style={[
                    styles.optionBtn,
                    {
                      borderColor: active ? colors.gold : colors.border,
                      backgroundColor: active ? colors.goldDim + "33" : colors.card,
                    },
                  ]}
                  onPress={() => setColorMode(value)}
                >
                  <Ionicons
                    name={icon}
                    size={18}
                    color={active ? colors.gold : colors.textSecondary}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: active ? colors.gold : colors.textSecondary,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Font size ── */}
        <View style={[styles.section, { borderTopColor: colors.border }]}>
          <Text style={typography.label}>TAMAÑO DE LETRA</Text>
          <View style={styles.optionRow}>
            {FONT_SIZE_OPTIONS.map(({ value, label, size }) => {
              const active = fontSize === value;
              return (
                <Pressable
                  key={value}
                  style={[
                    styles.optionBtn,
                    {
                      flex: 1,
                      borderColor: active ? colors.gold : colors.border,
                      backgroundColor: active ? colors.goldDim + "33" : colors.card,
                    },
                  ]}
                  onPress={() => setFontSize(value)}
                >
                  <Text
                    style={{
                      fontSize: size,
                      fontWeight: "700",
                      color: active ? colors.gold : colors.textSecondary,
                    }}
                  >
                    A
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "500",
                      color: active ? colors.gold : colors.textSecondary,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Biometrics ── */}
        {biometricAvailable && (
          <View style={[styles.section, { borderTopColor: colors.border }]}>
            <Text style={[typography.label, { marginBottom: spacing.sm }]}>SEGURIDAD</Text>
            <View
              style={[
                styles.rowItem,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name={biometricEnabled ? "scan" : "scan-outline"}
                size={20}
                color={biometricEnabled ? colors.gold : colors.textSecondary}
              />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "500",
                  color: colors.textPrimary,
                  flex: 1,
                  marginLeft: spacing.sm,
                }}
              >
                Face ID / Biometría
              </Text>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBioToggle}
                trackColor={{ false: colors.border, true: colors.goldDim }}
                thumbColor={biometricEnabled ? colors.gold : colors.textSecondary}
              />
            </View>
          </View>
        )}

        {/* ── Logout ── */}
        <View style={[styles.section, { borderTopColor: colors.border }]}>
          <Pressable
            style={[
              styles.logoutBtn,
              { borderColor: colors.red + "55", backgroundColor: colors.redBg },
            ]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.red} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: colors.red,
                marginLeft: spacing.sm,
              }}
            >
              Cerrar sesión
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    paddingBottom: 44,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  optionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
});
