import React, { useMemo, useState } from "react";
import {
  View, FlatList, Text, StyleSheet, Pressable, Modal,
  ScrollView, TextInput, ActivityIndicator, RefreshControl, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radius, Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { SectionHeader } from "../components/SectionHeader";
import { useUsers, useCreateUser, useUpdateUser, useResetPassword } from "../hooks/useUsers";
import type { AppUser, Role } from "../types";

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

export default function UsersScreen() {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { hasRole } = useAuth();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [resetting, setResetting] = useState<AppUser | null>(null);

  const { data: users, isLoading, refetch, isRefetching } = useUsers();
  const updateMutation = useUpdateUser();

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

  const roleOptions = hasRole(["DEVELOPER"]) ? ALL_ROLES : ASSIGNABLE_ROLES;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {isLoading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />}
          ListHeaderComponent={() => <SectionHeader title="EQUIPO" />}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              colors={colors}
              typography={typography}
              onEdit={() => setEditing(item)}
              onResetPassword={() => setResetting(item)}
              onToggleActive={() => handleToggleActive(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState icon="👥" title="Sin usuarios" subtitle="Crea el primer usuario del equipo" />
          }
        />
      )}

      <Pressable
        style={[styles.fab, { backgroundColor: colors.gold, shadowColor: colors.gold }]}
        onPress={() => setShowCreate(true)}
      >
        <Ionicons name="add" size={26} color={colors.bg} />
      </Pressable>

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
    </View>
  );
}

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

function FormField({
  label, value, onChangeText, keyboardType, autoCapitalize, secureTextEntry, colors, typography,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "email-address";
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
    fab: {
      position: "absolute",
      bottom: spacing.xl,
      right: spacing.md,
      width: 56, height: 56, borderRadius: 28,
      alignItems: "center", justifyContent: "center",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
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
