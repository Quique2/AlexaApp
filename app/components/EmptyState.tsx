import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { spacing } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = "📦", title, subtitle }: EmptyStateProps) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[typography.h4, { color: colors.textSecondary, textAlign: "center" }]}>
        {title}
      </Text>
      {subtitle && (
        <Text style={[typography.bodySmall, { textAlign: "center", maxWidth: 260 }]}>
          {subtitle}
        </Text>
      )}
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
});
