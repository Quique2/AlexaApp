import React, { useMemo, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, RefreshControl, TextInput, ScrollView, Alert, Share, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { spacing, radius, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { auditApi, getApiToken, getApiBaseUrl } from "../services/api";
import { useSettingNumber, useSettingBool } from "../hooks/useSettings";
import { EmptyState } from "./EmptyState";
import type { AuditChange, AuditGroupedUser, AuditLog, Role } from "../types";

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<Role, string> = {
  DEVELOPER: "Developer", SUPERVISOR: "Supervisor", OPERATOR: "Operador", TRANSPORTER: "Transportista",
};

const ROLE_COLORS: Record<Role, string> = {
  DEVELOPER: "#FF4C4C", SUPERVISOR: "#F0A500", OPERATOR: "#4DA6FF", TRANSPORTER: "#72C472",
};

const ENTITY_FILTERS = [
  { label: "Todo", value: null },
  { label: "Inventario", value: "Inventory" },
  { label: "Pedidos", value: "Order" },
  { label: "Producción", value: "ProductionPlan" },
  { label: "Recetas", value: "RecipeLine" },
  { label: "Usuarios", value: "User" },
  { label: "Admin", value: "BlockedEntity" },
];

const ACTION_ICONS: Record<string, { icon: string; color: (c: Colors) => string }> = {
  INVENTORY_STOCK_UPDATE: { icon: "cube-outline", color: (c) => "#4DA6FF" },
  PRICE_UPDATE:           { icon: "pricetag-outline", color: (c) => c.gold },
  ORDER_CREATED:          { icon: "cart-outline", color: (c) => c.green },
  ORDER_RECEIVED:         { icon: "checkmark-circle-outline", color: (c) => c.green },
  PLAN_CREATED:           { icon: "flask-outline", color: (c) => c.gold },
  PLAN_APPROVED:          { icon: "shield-checkmark-outline", color: (c) => c.green },
  PLAN_REJECTED:          { icon: "close-circle-outline", color: (c) => c.red },
  PLAN_SIGNED_OFF:        { icon: "ribbon-outline", color: (c) => c.gold },
  PLAN_STATUS_CHANGED:    { icon: "refresh-outline", color: (c) => c.textSecondary },
  RECIPE_LINE_CREATED:    { icon: "add-circle-outline", color: (c) => c.green },
  RECIPE_LINE_UPDATED:    { icon: "create-outline", color: (c) => c.gold },
  RECIPE_LINE_DELETED:    { icon: "trash-outline", color: (c) => c.red },
  USER_LOGIN:             { icon: "log-in-outline", color: (c) => "#4DA6FF" },
  USER_LOGOUT:            { icon: "log-out-outline", color: (c) => c.textSecondary },
  USER_REGISTERED:        { icon: "person-add-outline", color: (c) => c.green },
  USER_CREATED:           { icon: "person-add-outline", color: (c) => c.green },
  USER_ROLE_CHANGED:      { icon: "swap-horizontal-outline", color: (c) => c.gold },
  USER_DEACTIVATED:       { icon: "person-remove-outline", color: (c) => c.red },
  USER_ACTIVATED:         { icon: "person-outline", color: (c) => c.green },
  PASSWORD_RESET:         { icon: "key-outline", color: (c) => c.gold },
  ENTITY_BLOCKED:         { icon: "ban-outline", color: (c) => c.red },
  ENTITY_UNBLOCKED:       { icon: "checkmark-circle-outline", color: (c) => c.green },
};

function getActionMeta(action: string, colors: Colors) {
  const meta = ACTION_ICONS[action];
  return {
    icon: (meta?.icon ?? "ellipse-outline") as any,
    color: meta ? meta.color(colors) : colors.textMuted,
  };
}

// Fallback: derives changes from old metadata format for records created before the schema upgrade
function deriveChanges(log: AuditLog): AuditChange[] {
  if (Array.isArray(log.changes) && log.changes.length > 0) return log.changes as AuditChange[];
  const m = log.metadata as Record<string, any> | null;
  if (!m) return [];
  switch (log.action) {
    case "INVENTORY_STOCK_UPDATE":
      return [{ field: "currentStock", label: "Stock", oldValue: m.before, newValue: m.after, unit: m.unit }];
    case "PRICE_UPDATE":
      return [{ field: "unitPrice", label: "Precio", oldValue: m.before, newValue: m.after, unit: m.unit ?? "MXN" }];
    case "ORDER_CREATED":
      return [{ field: "orderedQuantity", label: "Cantidad", oldValue: 0, newValue: m.quantity, unit: m.unit }];
    case "ORDER_RECEIVED":
      return [
        { field: "status", label: "Estado", oldValue: m.status?.replace("RECEIVED_", "") ?? null, newValue: m.status },
        { field: "receivedQuantity", label: "Cantidad recibida", oldValue: 0, newValue: m.receivedQuantity },
      ];
    case "PLAN_STATUS_CHANGED":
      return [{ field: "productionStatus", label: "Estado producción", oldValue: m.before, newValue: m.after }];
    default:
      return [];
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChangesDisplay({ changes, colors, typography }: { changes: AuditChange[]; colors: Colors; typography: any }) {
  if (!changes.length) return null;
  return (
    <View style={{ marginTop: spacing.xs, gap: 2 }}>
      {changes.map((c, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 3 }}>
          <Text style={[typography.label, { fontSize: 10, color: colors.textMuted }]}>{c.label}:</Text>
          <Text style={[typography.label, { fontSize: 10, color: colors.textMuted, textDecorationLine: "line-through" }]}>
            {c.oldValue ?? "—"}{c.unit ? ` ${c.unit}` : ""}
          </Text>
          <Ionicons name="arrow-forward" size={9} color={colors.textMuted} />
          <Text style={[typography.label, { fontSize: 10, color: colors.textPrimary, fontWeight: "700" }]}>
            {c.newValue ?? "—"}{c.unit ? ` ${c.unit}` : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}

function AuditEntry({ log, colors, typography, compact = false }: {
  log: AuditLog;
  colors: Colors;
  typography: any;
  compact?: boolean;
}) {
  const { icon, color } = getActionMeta(log.action, colors);
  const userName = log.user?.name ?? log.user?.email ?? "Sistema";
  const changes = deriveChanges(log);
  const showIP = useSettingBool("audit", "showIPAddress", true);

  return (
    <View style={[entryStyles.row, { borderBottomColor: colors.border }]}>
      <View style={[entryStyles.iconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={entryStyles.content}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: "600", flex: 1 }]} numberOfLines={1}>
            {log.entityName ?? log.entityType}
          </Text>
          <Text style={[typography.label, { fontSize: 10, color: colors.textMuted, marginLeft: spacing.xs }]}>
            {compact ? formatRelativeTime(log.createdAt) : formatDateTime(log.createdAt)}
          </Text>
        </View>
        {log.description && (
          <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={2}>
            {log.description}
          </Text>
        )}
        {changes.length > 0 && <ChangesDisplay changes={changes} colors={colors} typography={typography} />}
        {!compact && (
          <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: 2, alignItems: "center" }}>
            {log.user && (
              <View style={[entryStyles.roleBadge, { backgroundColor: (ROLE_COLORS[log.user.role as Role] ?? colors.textMuted) + "22" }]}>
                <Text style={[typography.label, { fontSize: 9, color: ROLE_COLORS[log.user.role as Role] ?? colors.textMuted }]}>
                  {userName}
                </Text>
              </View>
            )}
            {showIP && log.ipAddress && log.ipAddress !== "unknown" && (
              <Text style={[typography.label, { fontSize: 9, color: colors.textMuted }]}>
                IP: {log.ipAddress}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const entryStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, gap: spacing.sm },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 1 },
  content: { flex: 1, gap: 2 },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full },
});

function UserActivityCard({ group, colors, typography }: {
  group: AuditGroupedUser;
  colors: Colors;
  typography: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const roleColor = group.user ? (ROLE_COLORS[group.user.role as Role] ?? colors.textMuted) : colors.textMuted;
  const userName = group.user?.name ?? group.user?.email ?? "Usuario eliminado";

  const { data, isLoading } = useQuery({
    queryKey: ["audit", "user", group.userId],
    queryFn: () => auditApi.listForUser(group.userId!, { limit: 20 }),
    enabled: expanded && !!group.userId,
  });

  return (
    <View style={[cardStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable style={cardStyles.header} onPress={() => setExpanded((v) => !v)}>
        <View style={[cardStyles.avatar, { backgroundColor: roleColor + "22" }]}>
          <Text style={{ fontSize: 15, color: roleColor }}>{userName[0]?.toUpperCase() ?? "?"}</Text>
        </View>
        <View style={cardStyles.info}>
          <Text style={[typography.h4, { fontSize: 14 }]}>{userName}</Text>
          <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
            <View style={[cardStyles.badge, { backgroundColor: roleColor + "22", borderColor: roleColor + "55" }]}>
              <Text style={[typography.label, { fontSize: 9, color: roleColor }]}>
                {group.user ? ROLE_LABELS[group.user.role as Role] : "Desconocido"}
              </Text>
            </View>
            <Text style={[typography.caption, { fontSize: 11 }]}>
              {group.count} movimiento{group.count !== 1 ? "s" : ""}
            </Text>
            {group.lastActivity && (
              <Text style={[typography.caption, { fontSize: 11, color: colors.textMuted }]}>
                · {formatRelativeTime(group.lastActivity)}
              </Text>
            )}
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>

      {expanded && (
        <View style={[cardStyles.body, { borderTopColor: colors.border }]}>
          {isLoading ? (
            <ActivityIndicator color={colors.gold} style={{ padding: spacing.md }} />
          ) : (
            (data?.logs ?? []).map((log) => (
              <AuditEntry key={log.id} log={log} colors={colors} typography={typography} compact />
            ))
          )}
          {!isLoading && (data?.logs ?? []).length === 0 && (
            <Text style={[typography.caption, { padding: spacing.md, color: colors.textMuted, textAlign: "center" }]}>
              Sin actividad registrada
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  info: { flex: 1, gap: 3 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full, borderWidth: 1, alignSelf: "flex-start" },
  body: { borderTopWidth: 1 },
});

// ─── Main component ───────────────────────────────────────────────────────────

export function AuditHistorial() {
  const { colors, typography } = useTheme();
  const { hasRole } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isPrivileged = hasRole(["DEVELOPER", "SUPERVISOR"]);
  const recentLimit = useSettingNumber("audit", "recentAuditLimit", 50);
  const excelExportEnabled = useSettingBool("audit", "enableExcelExport", true);

  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string | null>(null);
  const [searchOffset, setSearchOffset] = useState(0);

  const debouncedSearch = search.trim();

  const { data: recentData, isLoading: recentLoading, refetch: refetchRecent, isRefetching: refetchingRecent } = useQuery({
    queryKey: ["audit", "recent"],
    queryFn: auditApi.recent,
    enabled: !debouncedSearch && isPrivileged,
  });

  const { data: groupedData, isLoading: groupedLoading, refetch: refetchGrouped, isRefetching: refetchingGrouped } = useQuery({
    queryKey: ["audit", "grouped"],
    queryFn: auditApi.groupedByUser,
    enabled: !debouncedSearch && isPrivileged,
  });

  const { data: searchData, isLoading: searchLoading, refetch: refetchSearch } = useQuery({
    queryKey: ["audit", "search", debouncedSearch, entityFilter, searchOffset],
    queryFn: () => auditApi.list({
      search: debouncedSearch || undefined,
      entityType: entityFilter ?? undefined,
      limit: 50,
      offset: searchOffset,
    }),
    enabled: !!(debouncedSearch || entityFilter),
  });

  const { data: ownData, isLoading: ownLoading, refetch: refetchOwn } = useQuery({
    queryKey: ["audit", "own"],
    queryFn: () => auditApi.list({ limit: recentLimit }),
    enabled: !isPrivileged,
  });

  const handleRefresh = useCallback(() => {
    refetchRecent();
    refetchGrouped();
    if (debouncedSearch || entityFilter) refetchSearch();
    if (!isPrivileged) refetchOwn();
  }, [debouncedSearch, entityFilter, isPrivileged]);

  const handleExport = async () => {
    const fileName = `auditoria_${new Date().toISOString().split("T")[0]}.xlsx`;

    if (Platform.OS === "web") {
      try {
        const res = await auditApi.exportRaw({
          search: debouncedSearch || undefined,
          entityType: entityFilter ?? undefined,
        });
        if (!res.ok) throw new Error("Error al exportar");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        Alert.alert("Error", "No se pudo exportar la auditoría");
      }
      return;
    }

    // Mobile: download authenticated file to disk, then open share sheet.
    // Modules are loaded lazily so older installed APKs without these native
    // modules degrade gracefully instead of crashing the whole screen.
    let FileSystem: any, Sharing: any;
    try {
      FileSystem = require("expo-file-system/legacy");
      Sharing = require("expo-sharing");
    } catch {
      Alert.alert("Exportar", "Actualiza la app a la última versión para descargar en móvil.");
      return;
    }

    try {
      const qs = new URLSearchParams();
      if (debouncedSearch) qs.append("search", debouncedSearch);
      if (entityFilter) qs.append("entityType", entityFilter);
      const queryStr = qs.toString();
      const url = `${getApiBaseUrl()}/audit/export${queryStr ? `?${queryStr}` : ""}`;
      const token = getApiToken();
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      const { uri, status } = await FileSystem.downloadAsync(url, fileUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (status !== 200) throw new Error("Error al exportar");

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Exportar auditoría",
          UTI: "org.openxmlformats.spreadsheetml.sheet",
        });
      } else {
        Alert.alert("Exportar", `Archivo guardado en: ${uri}`);
      }
    } catch {
      Alert.alert("Error", "No se pudo exportar la auditoría");
    }
  };

  const isLoading = recentLoading || groupedLoading || ownLoading;
  const showSearch = !!(debouncedSearch || entityFilter);

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={[styles.searchRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={[typography.bodySmall, { flex: 1, color: colors.textPrimary, paddingVertical: 0 }]}
            placeholder="Buscar usuario, acción, ingrediente..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={(v) => { setSearch(v); setSearchOffset(0); }}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        {isPrivileged && excelExportEnabled && (
          <Pressable style={[styles.exportBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleExport}>
            <Ionicons name="download-outline" size={16} color={colors.gold} />
          </Pressable>
        )}
      </View>

      {/* Entity filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterRow, { borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.xs, paddingVertical: spacing.xs }}
      >
        {ENTITY_FILTERS.map((f) => {
          const active = entityFilter === f.value;
          return (
            <Pressable
              key={f.label}
              style={[styles.chip, { borderColor: active ? colors.gold : colors.border, backgroundColor: active ? colors.gold + "18" : colors.card }]}
              onPress={() => { setEntityFilter(active ? null : f.value); setSearchOffset(0); }}
            >
              <Text style={[typography.label, { fontSize: 11, color: active ? colors.gold : colors.textSecondary }]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading && !showSearch ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
      ) : showSearch ? (
        // Search / filter results
        <FlatList
          data={searchData?.logs ?? []}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <Text style={[typography.label, { color: colors.textMuted, fontSize: 11, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
              {searchLoading ? "Buscando..." : `${searchData?.total ?? 0} resultado${(searchData?.total ?? 0) !== 1 ? "s" : ""}`}
            </Text>
          }
          ListEmptyComponent={
            !searchLoading ? (
              <EmptyState icon="🔍" title="Sin resultados" subtitle="Intenta con otros términos de búsqueda" />
            ) : null
          }
          renderItem={({ item }) => <AuditEntry log={item} colors={colors} typography={typography} />}
          onEndReached={() => {
            if (searchData && searchOffset + 50 < searchData.total) setSearchOffset((o) => o + 50);
          }}
          onEndReachedThreshold={0.3}
        />
      ) : isPrivileged ? (
        // Default view: recent + grouped by user
        <FlatList
          data={[]}
          keyExtractor={() => ""}
          renderItem={() => null}
          refreshControl={
            <RefreshControl
              refreshing={refetchingRecent || refetchingGrouped}
              onRefresh={handleRefresh}
              tintColor={colors.gold}
            />
          }
          ListHeaderComponent={
            <>
              {/* Recent global */}
              <View style={[styles.sectionHeader, { backgroundColor: colors.bg }]}>
                <Text style={[typography.label, { color: colors.textMuted, fontSize: 11 }]}>ACTIVIDAD RECIENTE</Text>
              </View>
              {recentData && recentData.length > 0
                ? recentData.map((log) => <AuditEntry key={log.id} log={log} colors={colors} typography={typography} />)
                : <EmptyState icon="📋" title="Sin actividad" subtitle="Los movimientos aparecerán aquí" />
              }

              {/* Grouped by user */}
              <View style={[styles.sectionHeader, { backgroundColor: colors.bg }]}>
                <Text style={[typography.label, { color: colors.textMuted, fontSize: 11 }]}>ACTIVIDAD POR USUARIO</Text>
              </View>
              {groupedLoading
                ? <ActivityIndicator color={colors.gold} style={{ padding: spacing.md }} />
                : (groupedData ?? []).map((group) => (
                    <UserActivityCard key={group.userId ?? "null"} group={group} colors={colors} typography={typography} />
                  ))
              }
              {!groupedLoading && (groupedData ?? []).length === 0 && (
                <EmptyState icon="👥" title="Sin actividad por usuario" subtitle="" />
              )}
            </>
          }
        />
      ) : (
        // Own activity (OPERATOR / TRANSPORTER)
        <FlatList
          data={ownData?.logs ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.gold} />
          }
          ListHeaderComponent={
            <View style={[styles.sectionHeader, { backgroundColor: colors.bg }]}>
              <Text style={[typography.label, { color: colors.textMuted, fontSize: 11 }]}>MI ACTIVIDAD</Text>
            </View>
          }
          ListEmptyComponent={
            !ownLoading ? <EmptyState icon="📋" title="Sin actividad registrada" subtitle="" /> : null
          }
          renderItem={({ item }) => <AuditEntry log={item} colors={colors} typography={typography} />}
        />
      )}
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    searchRow: {
      flexDirection: "row", gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderBottomWidth: 1,
    },
    searchInput: {
      flex: 1, flexDirection: "row", alignItems: "center",
      gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs + 2,
      borderRadius: radius.md, borderWidth: 1,
    },
    exportBtn: {
      width: 38, height: 38, borderRadius: radius.md, borderWidth: 1,
      alignItems: "center", justifyContent: "center",
    },
    filterRow: { borderBottomWidth: 1, flexGrow: 0 },
    chip: {
      paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs,
      borderRadius: radius.full, borderWidth: 1,
    },
    sectionHeader: {
      paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs,
    },
  });
}
