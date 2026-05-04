import React from "react";
import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../constants/theme";

interface Chip {
  label: string;
  value: string;
}

interface FilterChipsProps {
  chips: Chip[];
  selected: string;
  onSelect: (value: string) => void;
}

export function FilterChips({ chips, selected, onSelect }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {chips.map((chip) => {
        const active = chip.value === selected;
        return (
          <Pressable
            key={chip.value}
            style={[styles.chip, active && styles.active]}
            onPress={() => onSelect(chip.value)}
          >
            <Text style={[styles.text, active && styles.activeText]}>
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  active: {
    borderColor: colors.gold,
    backgroundColor: colors.goldDim + "44",
  },
  text: { fontSize: 13, fontWeight: "500" as const, color: colors.textSecondary },
  activeText: { color: colors.gold, fontWeight: "600" as const },
});
