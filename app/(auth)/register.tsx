import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radius, Colors } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function RegisterScreen() {
  const { register } = useAuth();
  const { colors, typography } = useTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  async function handleRegister() {
    if (!email.trim() || !password) {
      setError("Email y contraseña son obligatorios");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password, name.trim() || undefined);
      // AuthNavigator in _layout.tsx handles navigation after state commits
    } catch (e: any) {
      setError(e.message ?? "Error al crear la cuenta");
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>🍺</Text>
          <Text style={[styles.brand, { color: colors.gold }]}>Rrëy</Text>
          <Text style={[typography.bodySmall, { marginTop: 4 }]}>Cervecería · Sistema de gestión</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[typography.h2, { marginBottom: spacing.lg }]}>Crear cuenta</Text>

          {error && (
            <View style={[styles.errorBox, { backgroundColor: colors.redBg, borderColor: colors.red + "44" }]}>
              <Ionicons name="alert-circle" size={16} color={colors.red} />
              <Text style={[typography.bodySmall, { color: colors.red, flex: 1 }]}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={typography.label}>Nombre (opcional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }]}
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={typography.label}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }]}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={typography.label}>Contraseña</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex, { backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                returnKeyType="next"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={typography.label}>Confirmar contraseña</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary },
                confirm.length > 0 && confirm !== password && { borderColor: colors.red },
              ]}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repite la contraseña"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
          </View>

          <Pressable
            style={[styles.btn, { backgroundColor: colors.gold }, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={[styles.btnText, { color: colors.bg }]}>Crear cuenta</Text>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={typography.bodySmall}>¿Ya tienes cuenta? </Text>
            <Link href="/login" asChild>
              <Pressable>
                <Text style={[typography.bodySmall, { color: colors.gold, fontWeight: "600" }]}>Inicia sesión</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: {
      flexGrow: 1,
      justifyContent: "center",
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    header: { alignItems: "center", marginBottom: spacing.xl },
    logo: { fontSize: 52 },
    brand: { fontSize: 36, fontWeight: "800", letterSpacing: -1, marginTop: spacing.xs },

    card: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
    },

    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.md,
      borderWidth: 1,
    },

    field: { marginBottom: spacing.md },
    input: {
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      fontSize: 16,
    },
    inputRow: { flexDirection: "row", alignItems: "center" },
    inputFlex: { flex: 1 },
    eyeBtn: { position: "absolute", right: spacing.md, padding: 4 },

    btn: {
      borderRadius: radius.md,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: spacing.xs,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { fontSize: 16, fontWeight: "700" },

    footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  });
}
