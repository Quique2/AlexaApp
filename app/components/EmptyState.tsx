import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../constants/theme";

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = "📦", title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  icon: { fontSize: 40 },
  title: { ...typography.h4, color: colors.textSecondary, textAlign: "center" },
  subtitle: { ...typography.bodySmall, textAlign: "center", maxWidth: 260 },
});
