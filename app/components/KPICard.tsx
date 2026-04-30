import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors, spacing, radius, typography, shadows } from "../constants/theme";

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: keyof typeof colors;
  onPress?: () => void;
}

export function KPICard({ label, value, sub, accent, onPress }: KPICardProps) {
  const accentColor = accent ? colors[accent] : colors.gold;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      {sub && <Text style={styles.sub}>{sub}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  sub: {
    ...typography.caption,
    marginTop: 2,
  },
});
