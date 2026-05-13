import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { spacing, radius } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible, title, message, confirmLabel = "Confirmar",
  destructive = false, onConfirm, onCancel,
}: Props) {
  const { colors, typography } = useTheme();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[typography.h3, { marginBottom: spacing.xs }]}>{title}</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
            {message}
          </Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={onCancel}
            >
              <Text style={[typography.h4, { color: colors.textSecondary }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, {
                backgroundColor: destructive ? colors.red + "22" : colors.gold + "22",
                borderColor: destructive ? colors.red : colors.gold,
              }]}
              onPress={onConfirm}
            >
              <Text style={[typography.h4, { color: destructive ? colors.red : colors.gold }]}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  row: { flexDirection: "row", gap: spacing.sm },
  btn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
  },
});
