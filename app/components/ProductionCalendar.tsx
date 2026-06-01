import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { spacing, radius, Colors } from "../constants/theme";
import { dashboardApi } from "../services/api";
import type { CalendarPlan, JitStatus, ProductionCalendarDay } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekday(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7; }
function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function toMonthKey(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function buildWeeks(y: number, m: number): (number | null)[][] {
  const total = daysInMonth(y, m);
  const offset = firstWeekday(y, m);
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

// ─── Status colors ────────────────────────────────────────────────────────────

function statusColor(status: JitStatus, colors: Colors): string {
  switch (status) {
    case "CRITICAL": return colors.red;
    case "RED":      return colors.red;
    case "YELLOW":   return colors.yellow;
    case "GREEN":    return colors.green;
    default:         return colors.textMuted;
  }
}

function statusLabel(status: JitStatus): string {
  switch (status) {
    case "CRITICAL": return "CRÍTICO";
    case "RED":      return "URGENTE";
    case "YELLOW":   return "CON MARGEN";
    case "GREEN":    return "OK";
    default:         return "SIN ESTADO";
  }
}

function approvalLabel(s: string): string {
  switch (s) {
    case "APPROVED": return "Aprobado";
    case "PENDING":  return "Pendiente";
    case "REJECTED": return "Rechazado";
    default: return s;
  }
}

function prodStatusLabel(s: string): string {
  switch (s) {
    case "PENDING":     return "Por iniciar";
    case "IN_PROGRESS": return "En progreso";
    case "COMPLETED":   return "Completado";
    default: return s;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DayDot({ status, hasCritical, colors }: { status: JitStatus; hasCritical: boolean; colors: Colors }) {
  if (status === "NONE") return <View style={dotStyles.placeholder} />;
  const color = statusColor(status, colors);
  return (
    <View style={[dotStyles.dot, { backgroundColor: color + (hasCritical ? "ff" : "cc") }]}>
      {hasCritical && <Ionicons name="warning" size={5} color="#fff" />}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  dot: { width: 7, height: 7, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  placeholder: { width: 7, height: 7 },
});

function PlanDetailRow({ plan, colors, typography }: { plan: CalendarPlan; colors: Colors; typography: any }) {
  const color = statusColor(plan.jitStatus, colors);
  const statusBg = color + "22";
  return (
    <View style={[detailStyles.planRow, { borderBottomColor: colors.border }]}>
      <View style={detailStyles.planLeft}>
        <Text style={[typography.h4, { fontSize: 13, color: colors.textPrimary }]} numberOfLines={1}>
          {plan.style}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {plan.batches} lote{plan.batches !== 1 ? "s" : ""} · {approvalLabel(plan.approvalStatus)} · {prodStatusLabel(plan.productionStatus)}
        </Text>
      </View>
      <View style={[detailStyles.statusBadge, { backgroundColor: statusBg, borderColor: color + "55" }]}>
        {plan.hasCritical && <Ionicons name="warning" size={9} color={color} style={{ marginRight: 2 }} />}
        <Text style={[typography.label, { fontSize: 9, color }]}>{statusLabel(plan.jitStatus)}</Text>
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  planRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, gap: spacing.sm,
  },
  planLeft: { flex: 1, gap: 2 },
  statusBadge: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.full, borderWidth: 1,
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { colors: Colors; typography: any; }

export function ProductionCalendar({ colors, typography }: Props) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<ProductionCalendarDay | null>(null);

  const monthKey = toMonthKey(viewYear, viewMonth);

  const { data, isLoading } = useQuery({
    queryKey: ["productionCalendar", monthKey],
    queryFn: () => dashboardApi.productionCalendar(monthKey),
    staleTime: 60_000,
  });

  // Build lookup: date string → day data
  const dayMap = new Map<string, ProductionCalendarDay>();
  for (const d of data?.days ?? []) dayMap.set(d.date, d);

  const weeks = buildWeeks(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  const handleDay = (day: number) => {
    const iso = toISO(viewYear, viewMonth, day);
    const dayData = dayMap.get(iso) ?? null;
    setSelectedDay((prev) => prev?.date === iso ? null : dayData);
  };

  const selectedDateLabel = selectedDay
    ? new Date(selectedDay.date + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[typography.label, { fontSize: 11, color: colors.textMuted }]}>
          CALENDARIO DE PRODUCCIÓN
        </Text>
        {isLoading && <ActivityIndicator size="small" color={colors.gold} />}
      </View>

      {/* Month navigation */}
      <View style={styles.navRow}>
        <Pressable onPress={prevMonth} style={styles.navBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
        </Pressable>
        <Text style={[typography.h4, { fontSize: 14 }]}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
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
            if (!day) return <View key={di} style={styles.dayCell} />;
            const iso = toISO(viewYear, viewMonth, day);
            const dayData = dayMap.get(iso);
            const isToday = iso === TODAY_ISO;
            const isSelected = selectedDay?.date === iso;

            return (
              <Pressable
                key={di}
                style={[
                  styles.dayCell,
                  isToday && [styles.todayCell, { borderColor: colors.gold + "60" }],
                  isSelected && { backgroundColor: colors.gold + "18" },
                ]}
                onPress={() => handleDay(day)}
              >
                <Text style={[
                  styles.dayNum,
                  { color: isToday ? colors.gold : isSelected ? colors.gold : colors.textPrimary },
                  (isToday || isSelected) && { fontWeight: "700" },
                ]}>
                  {day}
                </Text>
                {dayData ? (
                  <DayDot status={dayData.highestStatus} hasCritical={dayData.hasCritical} colors={colors} />
                ) : (
                  <View style={dotStyles.placeholder} />
                )}
                {dayData && dayData.plansCount > 1 && (
                  <View style={[styles.countBadge, { backgroundColor: colors.gold }]}>
                    <Text style={{ fontSize: 6, color: colors.bg, fontWeight: "700" }}>{dayData.plansCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={[styles.legend, { borderTopColor: colors.border }]}>
        {(["CRITICAL", "RED", "YELLOW", "GREEN"] as JitStatus[]).map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: statusColor(s, colors) }]} />
            <Text style={[typography.label, { fontSize: 9, color: colors.textMuted }]}>{statusLabel(s)}</Text>
          </View>
        ))}
      </View>

      {/* Selected day detail */}
      {selectedDay && (
        <View style={[styles.detailPanel, { borderTopColor: colors.border }]}>
          <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
            <Text style={[typography.h4, { fontSize: 13, textTransform: "capitalize" }]}>
              {selectedDateLabel}
            </Text>
            <Pressable onPress={() => setSelectedDay(null)} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
          {selectedDay.plans.length === 0 ? (
            <Text style={[typography.caption, { padding: spacing.md, color: colors.textMuted, textAlign: "center" }]}>
              Sin producción programada
            </Text>
          ) : (
            selectedDay.plans.map((plan) => (
              <PlanDetailRow key={plan.id} plan={plan} colors={colors} typography={typography} />
            ))
          )}
        </View>
      )}

      {/* Empty day tap */}
      {selectedDay === null && !isLoading && (data?.days.length ?? 0) === 0 && (
        <Text style={[typography.caption, { textAlign: "center", color: colors.textMuted, paddingVertical: spacing.sm }]}>
          Sin producción este mes
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs,
    borderBottomWidth: 1,
  },
  navRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
  },
  navBtn: { padding: spacing.xs },
  weekdayRow: { flexDirection: "row", paddingHorizontal: spacing.xs },
  weekdayCell: { flex: 1, textAlign: "center", paddingVertical: 3 },
  weekRow: { flexDirection: "row", paddingHorizontal: spacing.xs, marginBottom: 2 },
  dayCell: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: spacing.xs, gap: 2,
    borderRadius: radius.sm, position: "relative",
  },
  todayCell: { borderWidth: 1, borderRadius: radius.sm },
  dayNum: { fontSize: 12, lineHeight: 14 },
  countBadge: {
    position: "absolute", top: 0, right: 2,
    width: 10, height: 10, borderRadius: 5,
    alignItems: "center", justifyContent: "center",
  },
  legend: {
    flexDirection: "row", justifyContent: "space-around",
    borderTopWidth: 1, paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  detailPanel: { borderTopWidth: 1 },
  detailHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1,
  },
});
