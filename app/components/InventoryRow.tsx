import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors, spacing, radius, typography } from "../constants/theme";
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
        <Text style={styles.name} numberOfLines={1}>
          {mat.name}
        </Text>
        <Text style={styles.sub}>
          {TYPE_LABELS[mat.type] ?? mat.type}
          {mat.brand ? ` · ${mat.brand}` : ""}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.stock}>
          {item.currentStock > 0
            ? `${item.currentStock} ${mat.unit}`
            : "Sin stock"}
        </Text>
        {coverage !== null && (
          <Text style={styles.coverage}>{coverage}d cobertura</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  name: { ...typography.h4, fontSize: 14 },
  sub: { ...typography.caption },
  stock: { ...typography.bodySmall, fontWeight: "600", color: colors.textPrimary },
  coverage: { ...typography.caption },
});
