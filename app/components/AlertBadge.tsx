import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { radius, spacing } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import type { AlertStatus } from "../types";

interface AlertBadgeProps {
  status: AlertStatus;
  compact?: boolean;
}

export function AlertBadge({ status, compact = false }: AlertBadgeProps) {
  const { colors, typography } = useTheme();

  const config = useMemo(() => ({
    RED:    { label: "PEDIR YA",    color: colors.red,    bg: colors.redBg,    emoji: "🔴" },
    YELLOW: { label: "PEDIR PRONTO", color: colors.yellow, bg: colors.yellowBg, emoji: "🟡" },
    GREEN:  { label: "OK",          color: colors.green,  bg: colors.greenBg,  emoji: "🟢" },
    NONE:   { label: "SIN CONSUMO", color: colors.none,   bg: colors.noneBg,   emoji: "—" },
  }), [colors]);

  const cfg = config[status];

  if (compact) {
    return (
      <View style={[styles.compact, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
        <Text style={styles.compactText}>{cfg.emoji}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
      <Text style={[typography.label, styles.text, { color: cfg.color }]}>
        {cfg.emoji} {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: { fontSize: 10 },
  compact: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  compactText: { fontSize: 12 },
});
