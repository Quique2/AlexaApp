import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, Modal,
  ScrollView, TextInput, ActivityIndicator, RefreshControl, Alert,
  KeyboardAvoidingView, Platform, SectionList, FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radius, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { SectionHeader } from "../components/SectionHeader";
import { useUsers, useCreateUser, useUpdateUser, useResetPassword } from "../hooks/useUsers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, auditApi } from "../services/api";
import type { AppUser, AuditLog, Role, BlockedEntity } from "../types";

const ROLE_LABELS: Record<Role, string> = {
  DEVELOPER: "Developer",
  SUPERVISOR: "Supervisor",
  OPERATOR: "Operador",
  TRANSPORTER: "Transportista",
};

const ROLE_COLORS: Record<Role, string> = {
  DEVELOPER: "#FF4C4C",
  SUPERVISOR: "#F0A500",
  OPERATOR: "#4DA6FF",
  TRANSPORTER: "#72C472",
};

const ASSIGNABLE_ROLES: Role[] = ["SUPERVISOR", "OPERATOR", "TRANSPORTER"];
const ALL_ROLES: Role[] = ["DEVELOPER", "SUPERVISOR", "OPERATOR", "TRANSPORTER"];

type TabKey = "equipo" | "historial";

export default function UsersScreen() {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();

  const isDeveloper = hasRole(["DEVELOPER"]);
  const isSupervisorOrAbove = hasRole(["DEVELOPER", "SUPERVISOR"]);
  const [activeTab, setActiveTab] = useState<TabKey>("equipo");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [resetting, setResetting] = useState<AppUser | null>(null);
  const [showAddBlock, setShowAddBlock] = useState(false);

  const { data: users, isLoading, refetch, isRefetching } = useUsers();
  const updateMutation = useUpdateUser();

  const { data: blocked, refetch: refetchBlocked, isRefetching: isRefetchingBlocked } = useQuery({
    queryKey: ["blocked"],
    queryFn: adminApi.listBlocked,
    enabled: isDeveloper,
  });

  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit, isRefetching: isRefetchingAudit } = useQuery({
    queryKey: ["audit"],
    queryFn: () => auditApi.list({ limit: 100 }),
    enabled: isSupervisorOrAbove && activeTab === "historial",
  });

  const unblockMutation = useMutation({
    mutationFn: (id: string) => adminApi.unblock(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blocked"] }),
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const handleToggleActive = (user: AppUser) => {
    Alert.alert(
      user.isActive ? "Desactivar usuario" : "Activar usuario",
      `¿${user.isActive ? "Desactivar" : "Activar"} a ${user.name ?? user.email}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: user.isActive ? "Desactivar" : "Activar",
          style: user.isActive ? "destructive" : "default",
          onPress: () => updateMutation.mutate({ id: user.id, data: { isActive: !user.isActive } }),
        },
      ]
    );
  };

  const handleUnblock = (entity: BlockedEntity) => {
    Alert.alert(
      "Quitar bloqueo",
      `¿Desbloquear ${entity.type === "EMAIL" ? "correo" : "IP"} "${entity.value}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Desbloquear", style: "destructive", onPress: () => unblockMutation.mutate(entity.id) },
      ]
    );
  };

  const roleOptions = isDeveloper ? ALL_ROLES : ASSIGNABLE_ROLES;

  const sections = useMemo(() => {
    const result: { title: string; data: any[]; type: "users" | "blocked" }[] = [
      { title: "EQUIPO", data: users ?? [], type: "users" },
    ];
    if (isDeveloper) {
      result.push({ title: "BLOQUEADOS", data: blocked ?? [], type: "blocked" });
    }
    return result;
  }, [users, blocked, isDeveloper]);

  if (isLoading) {
    return <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Tab switcher */}
      {isSupervisorOrAbove && (
        <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {(["equipo", "historial"] as TabKey[]).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tabItem, activeTab === tab && { borderBottomColor: colors.gold, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                typography.label,
                { color: activeTab === tab ? colors.gold : colors.textMuted, fontSize: 12 },
              ]}>
                {tab === "equipo" ? "EQUIPO" : "HISTORIAL"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {activeTab === "equipo" ? (
        <>
          <SectionList
            sections={sections}
            keyExtractor={(item, index) => item.id ?? String(index)}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching || isRefetchingBlocked}
                onRefresh={() => { refetch(); if (isDeveloper) refetchBlocked(); }}
                tintColor={colors.gold}
              />
            }
            renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
            renderItem={({ item, section }) => {
              if (section.type === "users") {
                return (
                  <UserRow
                    user={item}
                    colors={colors}
                    typography={typography}
                    onEdit={() => setEditing(item)}
                    onResetPassword={() => setResetting(item)}
                    onToggleActive={() => handleToggleActive(item)}
                  />
                );
              }
              return (
                <BlockedRow
                  entity={item}
                  colors={colors}
                  typography={typography}
                  onUnblock={() => handleUnblock(item)}
                />
              );
            }}
            renderSectionFooter={({ section }) =>
              section.data.length === 0 ? (
                section.type === "users"
                  ? <EmptyState icon="👥" title="Sin usuarios" subtitle="Crea el primer usuario del equipo" />
                  : <EmptyState icon="🚫" title="Sin bloqueos" subtitle="No hay emails ni IPs bloqueados" />
              ) : null
            }
          />

          <Pressable
            style={[styles.fab, { backgroundColor: colors.gold, shadowColor: colors.gold }]}
            onPress={() => setShowCreate(true)}
          >
            <Ionicons name="add" size={26} color={colors.bg} />
          </Pressable>

          {isDeveloper && (
            <Pressable
              style={[styles.fabSecondary, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: "#000" }]}
              onPress={() => setShowAddBlock(true)}
            >
              <Ionicons name="ban-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          )}
        </>
      ) : (
        <HistorialTab
          logs={auditData?.logs ?? []}
          isLoading={auditLoading}
          isRefetching={isRefetchingAudit}
          onRefresh={refetchAudit}
          colors={colors}
          typography={typography}
        />
      )}

      {showCreate && (
        <CreateUserModal
          roleOptions={roleOptions}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editing && (
        <EditUserModal
          user={editing}
          roleOptions={roleOptions}
          onClose={() => setEditing(null)}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
        />
      )}
      {showAddBlock && (
        <AddBlockModal onClose={() => setShowAddBlock(false)} />
      )}
    </View>
  );
}

const AUDIT_META: Record<string, { icon: string; color: (c: Colors) => string; label: (log: AuditLog) => string }> = {
  INVENTORY_STOCK_UPDATE: {
    icon: "cube-outline",
    color: (_c) => "#4DA6FF",
    label: (l) => {
      const m = l.metadata;
      return `Stock: ${m?.before ?? "?"} → ${m?.after ?? "?"} ${m?.unit ?? ""}`;
    },
  },
  PRICE_UPDATE: {
    icon: "pricetag-outline",
    color: (c) => c.gold,
    label: (l) => {
      const m = l.metadata;
      return `Precio: $${m?.before ?? "?"} → $${m?.after ?? "?"} MXN`;
    },
  },
  ORDER_CREATED: {
    icon: "cart-outline",
    color: (c) => c.green,
    label: (l) => {
      const m = l.metadata;
      return `Pedido creado: ${m?.quantity ?? "?"} ${m?.unit ?? ""}`;
    },
  },
  ORDER_RECEIVED: {
    icon: "checkmark-circle-outline",
    color: (c) => c.green,
    label: (l) => {
      const m = l.metadata;
      return `Recepción: ${m?.receivedQuantity ?? "?"} recibidos · ${m?.condition ?? ""}`;
    },
  },
  PLAN_CREATED: {
    icon: "flask-outline",
    color: (c) => c.gold,
    label: () => "Plan de producción creado",
  },
  PLAN_APPROVED: {
    icon: "shield-checkmark-outline",
    color: (c) => c.green,
    label: () => "Plan aprobado",
  },
  PLAN_REJECTED: {
    icon: "close-circle-outline",
    color: (c) => c.red,
    label: (l) => `Plan rechazado${l.metadata?.reason ? `: ${l.metadata.reason}` : ""}`,
  },
  PLAN_SIGNED_OFF: {
    icon: "ribbon-outline",
    color: (c) => c.gold,
    label: () => "Visto bueno otorgado",
  },
  PLAN_STATUS_CHANGED: {
    icon: "refresh-outline",
    color: (c) => c.textSecondary,
    label: (l) => {
      const m = l.metadata;
      const labels: Record<string, string> = { IN_PROGRESS: "En progreso", COMPLETED: "Completado", CANCELLED: "Cancelado" };
      return `Estado: ${labels[m?.after] ?? m?.after ?? "?"}`;
    },
  },
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
}

function HistorialTab({
  logs, isLoading, isRefetching, onRefresh, colors, typography,
}: {
  logs: AuditLog[];
  isLoading: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
  colors: Colors;
  typography: any;
}) {
  if (isLoading) {
    return <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />;
  }

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.gold} />
      }
      ListEmptyComponent={
        <EmptyState icon="📋" title="Sin actividad" subtitle="Los movimientos importantes aparecerán aquí" />
      }
      renderItem={({ item }) => {
        const meta = AUDIT_META[item.action];
        const iconName = (meta?.icon ?? "ellipse-outline") as any;
        const iconColor = meta ? meta.color(colors) : colors.textMuted;
        const description = meta ? meta.label(item) : item.action;
        const userName = item.user?.name ?? item.user?.email ?? "Sistema";

        return (
          <View style={[auditStyles.row, { borderBottomColor: colors.border }]}>
            <View style={[auditStyles.iconWrap, { backgroundColor: iconColor + "18" }]}>
              <Ionicons name={iconName} size={18} color={iconColor} />
            </View>
            <View style={auditStyles.content}>
              <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: "600" }]} numberOfLines={1}>
                {item.entityName ?? item.entityType}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={2}>
                {description}
              </Text>
              <View style={auditStyles.meta}>
                <Text style={[typography.label, { fontSize: 10, color: colors.textMuted }]}>{userName}</Text>
                <Text style={[typography.label, { fontSize: 10, color: colors.textMuted }]}>·</Text>
                <Text style={[typography.label, { fontSize: 10, color: colors.textMuted }]}>{formatRelativeTime(item.createdAt)}</Text>
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}

const auditStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    marginTop: 2,
  },
  content: { flex: 1, gap: 2 },
  meta: { flexDirection: "row", gap: spacing.xs, alignItems: "center", marginTop: 2 },
});

function UserRow({
  user, colors, typography, onEdit, onResetPassword, onToggleActive,
}: {
  user: AppUser;
  colors: Colors;
  typography: any;
  onEdit: () => void;
  onResetPassword: () => void;
  onToggleActive: () => void;
}) {
  const roleColor = ROLE_COLORS[user.role] ?? colors.textMuted;
  return (
    <View style={[rowStyles.row, { borderBottomColor: colors.border }, !user.isActive && { opacity: 0.5 }]}>
      <View style={[rowStyles.avatar, { backgroundColor: roleColor + "22" }]}>
        <Text style={{ fontSize: 16, color: roleColor }}>
          {(user.name ?? user.email)[0].toUpperCase()}
        </Text>
      </View>
      <View style={rowStyles.info}>
        <Text style={[typography.h4, { fontSize: 14 }]}>{user.name ?? user.email}</Text>
        {user.name ? <Text style={typography.caption}>{user.email}</Text> : null}
        <View style={[rowStyles.badge, { backgroundColor: roleColor + "22", borderColor: roleColor + "55" }]}>
          <Text style={[typography.label, { fontSize: 9, color: roleColor }]}>{ROLE_LABELS[user.role]}</Text>
        </View>
      </View>
      <View style={rowStyles.actions}>
        <Pressable onPress={onEdit} hitSlop={8}>
          <Ionicons name="pencil-outline" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={onResetPassword} hitSlop={8}>
          <Ionicons name="key-outline" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={onToggleActive} hitSlop={8}>
          <Ionicons
            name={user.isActive ? "eye-outline" : "eye-off-outline"}
            size={16}
            color={user.isActive ? colors.green : colors.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

function BlockedRow({
  entity, colors, typography, onUnblock,
}: {
  entity: BlockedEntity;
  colors: Colors;
  typography: any;
  onUnblock: () => void;
}) {
  const isEmail = entity.type === "EMAIL";
  return (
    <View style={[rowStyles.row, { borderBottomColor: colors.border }]}>
      <View style={[rowStyles.avatar, { backgroundColor: colors.redBg }]}>
        <Ionicons name={isEmail ? "mail-outline" : "globe-outline"} size={16} color={colors.red} />
      </View>
      <View style={rowStyles.info}>
        <Text style={[typography.h4, { fontSize: 14 }]}>{entity.value}</Text>
        <Text style={typography.caption}>{isEmail ? "Email" : "IP"}{entity.reason ? ` · ${entity.reason}` : ""}</Text>
      </View>
      <Pressable onPress={onUnblock} hitSlop={8}>
        <Ionicons name="close-circle-outline" size={20} color={colors.red} />
      </Pressable>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  info: { flex: 1, gap: 2 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    marginTop: 2,
  },
  actions: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
});

function CreateUserModal({ roleOptions, onClose }: { roleOptions: Role[]; onClose: () => void }) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const createMutation = useCreateUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("OPERATOR");

  const handleSave = () => {
    if (!email || !password) return Alert.alert("Error", "Email y contraseña son obligatorios");
    createMutation.mutate(
      { email, password, name: name || undefined, role },
      {
        onSuccess: onClose,
        onError: (e: any) => Alert.alert("Error", e.message),
      }
    );
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={typography.h3}>Nuevo usuario</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <FormField label="Nombre (opcional)" value={name} onChangeText={setName} colors={colors} typography={typography} />
            <FormField label="Email *" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" colors={colors} typography={typography} />
            <FormField label="Contraseña * (mín. 8 chars)" value={password} onChangeText={setPassword} secureTextEntry colors={colors} typography={typography} />

            <Text style={[typography.label, { marginBottom: spacing.xs }]}>ROL</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md }}>
              {roleOptions.map((r) => (
                <Pressable
                  key={r}
                  style={[
                    styles.roleChip,
                    { borderColor: colors.border, backgroundColor: colors.card },
                    r === role && { borderColor: ROLE_COLORS[r] },
                  ]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[typography.bodySmall, { color: r === role ? ROLE_COLORS[r] : colors.textSecondary }]}>
                    {ROLE_LABELS[r]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.gold }, createMutation.isPending && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={[typography.h4, { color: colors.bg }]}>Crear usuario</Text>
              }
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function EditUserModal({ user, roleOptions, onClose }: { user: AppUser; roleOptions: Role[]; onClose: () => void }) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const updateMutation = useUpdateUser();

  const [name, setName] = useState(user.name ?? "");
  const [role, setRole] = useState<Role>(user.role);

  const handleSave = () => {
    updateMutation.mutate(
      { id: user.id, data: { name: name || undefined, role } },
      {
        onSuccess: onClose,
        onError: (e: any) => Alert.alert("Error", e.message),
      }
    );
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={typography.h3}>Editar usuario</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={[typography.caption, { marginBottom: spacing.sm }]}>{user.email}</Text>
            <FormField label="Nombre" value={name} onChangeText={setName} colors={colors} typography={typography} />

            <Text style={[typography.label, { marginBottom: spacing.xs }]}>ROL</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md }}>
              {roleOptions.map((r) => (
                <Pressable
                  key={r}
                  style={[
                    styles.roleChip,
                    { borderColor: colors.border, backgroundColor: colors.card },
                    r === role && { borderColor: ROLE_COLORS[r] },
                  ]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[typography.bodySmall, { color: r === role ? ROLE_COLORS[r] : colors.textSecondary }]}>
                    {ROLE_LABELS[r]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.gold }, updateMutation.isPending && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={[typography.h4, { color: colors.bg }]}>Guardar cambios</Text>
              }
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const resetMutation = useResetPassword();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleReset = () => {
    if (password.length < 8) return Alert.alert("Error", "Mínimo 8 caracteres");
    if (password !== confirm) return Alert.alert("Error", "Las contraseñas no coinciden");
    resetMutation.mutate(
      { id: user.id, password },
      {
        onSuccess: () => { Alert.alert("Listo", "Contraseña actualizada"); onClose(); },
        onError: (e: any) => Alert.alert("Error", e.message),
      }
    );
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={typography.h3}>Resetear contraseña</Text>
              <Text style={typography.caption}>{user.name ?? user.email}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.formContent}>
            <FormField label="Nueva contraseña" value={password} onChangeText={setPassword} secureTextEntry colors={colors} typography={typography} />
            <FormField label="Confirmar contraseña" value={confirm} onChangeText={setConfirm} secureTextEntry colors={colors} typography={typography} />
            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.gold }, resetMutation.isPending && { opacity: 0.6 }]}
              onPress={handleReset}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={[typography.h4, { color: colors.bg }]}>Actualizar contraseña</Text>
              }
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AddBlockModal({ onClose }: { onClose: () => void }) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [type, setType] = useState<"EMAIL" | "IP">("EMAIL");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  const blockMutation = useMutation({
    mutationFn: () => adminApi.block({ type, value: value.trim(), reason: reason.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked"] });
      onClose();
    },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const handleSave = () => {
    if (!value.trim()) return Alert.alert("Error", "Ingresa un valor para bloquear");
    blockMutation.mutate();
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={typography.h3}>Bloquear email o IP</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={[typography.label, { marginBottom: spacing.xs }]}>TIPO</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
              {(["EMAIL", "IP"] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[
                    styles.roleChip,
                    { borderColor: colors.border, backgroundColor: colors.card },
                    t === type && { borderColor: colors.red },
                  ]}
                  onPress={() => setType(t)}
                >
                  <Text style={[typography.bodySmall, { color: t === type ? (colors.red) : colors.textSecondary }]}>
                    {t === "EMAIL" ? "Correo" : "IP"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <FormField
              label={type === "EMAIL" ? "Correo electrónico" : "Dirección IP"}
              value={value}
              onChangeText={setValue}
              keyboardType={type === "EMAIL" ? "email-address" : undefined}
              autoCapitalize="none"
              colors={colors}
              typography={typography}
            />
            <FormField
              label="Motivo (opcional)"
              value={reason}
              onChangeText={setReason}
              colors={colors}
              typography={typography}
            />
            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.red }, blockMutation.isPending && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={blockMutation.isPending}
            >
              {blockMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={[typography.h4, { color: "#fff" }]}>Bloquear</Text>
              }
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormField({
  label, value, onChangeText, keyboardType, autoCapitalize, secureTextEntry, colors, typography,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "email-address" | "default";
  autoCapitalize?: "none";
  secureTextEntry?: boolean;
  colors: Colors;
  typography: any;
}) {
  return (
    <View style={{ marginBottom: spacing.sm, gap: spacing.xs }}>
      <Text style={typography.label}>{label}</Text>
      <TextInput
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          color: colors.textPrimary,
          fontSize: 15,
        }}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        secureTextEntry={secureTextEntry}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    tabBar: {
      flexDirection: "row",
      borderBottomWidth: 1,
    },
    tabItem: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.sm + 2,
    },
    fab: {
      position: "absolute",
      bottom: spacing.xl,
      right: spacing.md,
      width: 56, height: 56, borderRadius: 28,
      alignItems: "center", justifyContent: "center",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
    },
    fabSecondary: {
      position: "absolute",
      bottom: spacing.xl + 64,
      right: spacing.md,
      width: 46, height: 46, borderRadius: 23,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
    },
    overlay: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
    sheet: {
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: "90%",
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      alignSelf: "center", marginTop: spacing.sm, marginBottom: spacing.md,
    },
    sheetHeader: {
      flexDirection: "row", alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    },
    formContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
    roleChip: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: radius.full, borderWidth: 1,
    },
    saveBtn: {
      borderRadius: radius.md, paddingVertical: spacing.md,
      alignItems: "center", marginTop: spacing.sm,
    },
  });
}
