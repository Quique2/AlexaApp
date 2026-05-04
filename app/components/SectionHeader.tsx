import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { spacing } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={typography.label}>{title}</Text>
      {action && (
        <Pressable onPress={onAction}>
          <Text style={[typography.label, { color: colors.gold }]}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
});
