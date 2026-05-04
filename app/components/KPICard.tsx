import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { spacing, radius, shadows, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: keyof Colors;
  onPress?: () => void;
}

export function KPICard({ label, value, sub, accent, onPress }: KPICardProps) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const accentColor = accent ? colors[accent] as string : colors.gold;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text style={typography.label}>{label}</Text>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      {sub && <Text style={typography.caption}>{sub}</Text>}
    </Pressable>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
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
    pressed: { opacity: 0.75 },
    value: {
      fontSize: 26,
      fontWeight: "700",
      letterSpacing: -0.5,
      marginTop: spacing.xs,
      marginBottom: 2,
    },
  });
}
