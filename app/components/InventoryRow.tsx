import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { spacing, radius, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { AlertBadge } from "./AlertBadge";
import type { InventoryRow as IRow } from "../types";

interface InventoryRowProps {
  item: IRow;
  onPress?: (item: IRow) => void;
}

const TYPE_LABELS: Record<string, string> = {
  LUPULO: "Lúpulo",
  MALTA: "Malta",
  YEAST: "Levadura",
  ADJUNTO: "Adjunto",
  OTRO: "Otro",
};

export function InventoryRow({ item, onPress }: InventoryRowProps) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const mat = item.material!;
  const coverage =
    item.dailyConsumption > 0
      ? Math.round(item.currentStock / item.dailyConsumption)
      : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => onPress?.(item)}
    >
      <View style={styles.left}>
        <AlertBadge status={item.alertStatus} compact />
      </View>

      <View style={styles.center}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={[typography.h4, { fontSize: 14 }]} numberOfLines={1}>
            {mat.name}
          </Text>
          {item.isCritical && (
            <View style={[styles.criticalBadge, { backgroundColor: colors.red + "22", borderColor: colors.red + "66" }]}>
              <Text style={{ fontSize: 8, fontWeight: "700", color: colors.red }}>CRÍTICO</Text>
            </View>
          )}
        </View>
        <Text style={typography.caption}>
          {TYPE_LABELS[mat.type] ?? mat.type}
          {mat.brand ? ` · ${mat.brand}` : ""}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={[typography.bodySmall, { fontWeight: "600", color: colors.textPrimary }]}>
          {item.currentStock > 0 ? `${item.currentStock} ${mat.unit}` : "Sin stock"}
        </Text>
        {coverage !== null && (
          <Text style={typography.caption}>{coverage}d cobertura</Text>
        )}
        {(item.reservedStock ?? 0) > 0 && (
          <Text style={[typography.caption, { color: colors.gold }]}>
            {item.reservedStock} reservado
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    pressed: { backgroundColor: colors.surface },
    left: { width: 32, alignItems: "center" },
    center: { flex: 1, gap: 2 },
    right: { alignItems: "flex-end", gap: 2 },
    criticalBadge: {
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: radius.sm,
      borderWidth: 1,
    },
  });
}
