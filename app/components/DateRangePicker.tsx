import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radius, Colors } from "../constants/theme";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekday(year: number, month: number): number {
  // 0=Sun, adjust so Mon=0
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseISO(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

function buildWeeks(year: number, month: number): (number | null)[][] {
  const total = daysInMonth(year, month);
  const offset = firstWeekday(year, month);
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const WEEKDAYS = ["L","M","M","J","V","S","D"];

const TODAY = new Date();
const TODAY_ISO = toISO(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  colors: Colors;
  typography: any;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DateRangePicker({ from, to, onChange, colors, typography }: Props) {
  const initial = parseISO(from);
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [step, setStep] = useState<"from" | "to">("from");
  const [pendingFrom, setPendingFrom] = useState(from);

  const weeks = buildWeeks(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDay = (day: number) => {
    const iso = toISO(viewYear, viewMonth, day);
    if (step === "from") {
      setPendingFrom(iso);
      onChange(iso, iso);
      setStep("to");
    } else {
      let f = pendingFrom;
      let t = iso;
      if (t < f) { [f, t] = [t, f]; }
      onChange(f, t);
      setStep("from");
    }
  };

  const getDayStyle = (day: number | null): { bg: string; textColor: string; roundLeft: boolean; roundRight: boolean; isToday: boolean } => {
    const none = { bg: "transparent", textColor: colors.textPrimary, roundLeft: false, roundRight: false, isToday: false };
    if (!day) return none;
    const iso = toISO(viewYear, viewMonth, day);
    const isToday = iso === TODAY_ISO;
    const isFrom = iso === from;
    const isTo = iso === to;
    const inRange = from && to && iso > from && iso < to;
    if (isFrom || isTo) {
      return { bg: colors.gold, textColor: colors.bg, roundLeft: isFrom, roundRight: isTo, isToday };
    }
    if (inRange) {
      return { bg: colors.gold + "28", textColor: colors.textPrimary, roundLeft: false, roundRight: false, isToday };
    }
    return { bg: "transparent", textColor: isToday ? colors.gold : colors.textPrimary, roundLeft: false, roundRight: false, isToday };
  };

  const fromLabel = from ? new Date(from + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const toLabel   = to   ? new Date(to   + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Selected range display */}
      <View style={[styles.rangeRow, { borderBottomColor: colors.border }]}>
        <RangeLabel
          label="DESDE"
          value={fromLabel}
          active={step === "from"}
          colors={colors}
          typography={typography}
        />
        <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
        <RangeLabel
          label="HASTA"
          value={toLabel}
          active={step === "to"}
          colors={colors}
          typography={typography}
        />
      </View>

      {/* Month navigation */}
      <View style={styles.navRow}>
        <Pressable onPress={prevMonth} style={styles.navBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
        </Pressable>
        <Text style={[typography.h4, { fontSize: 14, textAlign: "center" }]}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={nextMonth} style={styles.navBtn} hitSlop={8}>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Weekday headers */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[typography.label, styles.weekdayCell, { color: colors.textMuted, fontSize: 10 }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            const { bg, textColor, roundLeft, roundRight, isToday } = getDayStyle(day);
            const borderRadius = roundLeft && roundRight
              ? radius.full
              : roundLeft ? { borderTopLeftRadius: radius.full, borderBottomLeftRadius: radius.full }
              : roundRight ? { borderTopRightRadius: radius.full, borderBottomRightRadius: radius.full }
              : {};
            return (
              <Pressable
                key={di}
                style={[styles.dayCell, { backgroundColor: bg }, borderRadius]}
                onPress={() => day && handleDay(day)}
                disabled={!day}
              >
                {day ? (
                  <View style={[isToday && styles.todayRing, isToday && { borderColor: colors.gold }]}>
                    <Text style={[typography.bodySmall, { fontSize: 13, color: textColor, textAlign: "center" }]}>
                      {day}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* Hint */}
      <Text style={[typography.label, { fontSize: 10, color: colors.textMuted, textAlign: "center", paddingBottom: spacing.sm, marginTop: spacing.xs }]}>
        {step === "from" ? "Toca para seleccionar fecha de inicio" : "Toca para seleccionar fecha de fin"}
      </Text>
    </View>
  );
}

function RangeLabel({ label, value, active, colors, typography }: {
  label: string; value: string; active: boolean; colors: Colors; typography: any;
}) {
  return (
    <View style={[styles.rangeLabel, active && { borderBottomColor: colors.gold, borderBottomWidth: 2 }]}>
      <Text style={[typography.label, { fontSize: 9, color: active ? colors.gold : colors.textMuted }]}>{label}</Text>
      <Text style={[typography.bodySmall, { color: active ? colors.gold : colors.textPrimary, fontWeight: active ? "700" : "400" }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  rangeLabel: {
    flex: 1, alignItems: "center", paddingBottom: 4, gap: 2,
  },
  navRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  navBtn: { padding: spacing.xs },
  weekdayRow: {
    flexDirection: "row", paddingHorizontal: spacing.xs, marginBottom: 2,
  },
  weekdayCell: {
    flex: 1, textAlign: "center", paddingVertical: 4,
  },
  weekRow: {
    flexDirection: "row", paddingHorizontal: spacing.xs,
  },
  dayCell: {
    flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center",
    marginVertical: 1,
  },
  todayRing: {
    borderRadius: radius.full, borderWidth: 1,
    width: 26, height: 26, alignItems: "center", justifyContent: "center",
  },
});
