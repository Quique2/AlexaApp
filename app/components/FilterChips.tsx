import React, { useMemo } from "react";
import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { spacing, radius, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";

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
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
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
            <Text
              style={[
                typography.bodySmall,
                styles.text,
                active && { color: colors.gold, fontWeight: "600" as const },
              ]}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    scroll: { flexGrow: 0, flexShrink: 0 },
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
    text: { fontWeight: "500" as const },
  });
}
