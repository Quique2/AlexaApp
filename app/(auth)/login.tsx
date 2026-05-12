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
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radius, Colors } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function LoginScreen() {
  const { login, loginWithBiometrics, biometricAvailable, biometricEnabled, biometricEmail } = useAuth();
  const { colors, typography } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Completa todos los campos");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      // AuthNavigator in _layout.tsx handles navigation after state commits
    } catch (e: any) {
      setError(e.message ?? "Error al iniciar sesión");
      setLoading(false);
    }
  }

  async function handleBiometric() {
    setError(null);
    setBioLoading(true);
    try {
      await loginWithBiometrics();
      // AuthNavigator in _layout.tsx handles navigation after state commits
    } catch (e: any) {
      setError(e.message ?? "Error en autenticación biométrica");
      setBioLoading(false);
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
          <Text style={[typography.h2, { marginBottom: spacing.lg }]}>Iniciar sesión</Text>

          {error && (
            <View style={[styles.errorBox, { backgroundColor: colors.redBg, borderColor: colors.red + "44" }]}>
              <Ionicons name="alert-circle" size={16} color={colors.red} />
              <Text style={[typography.bodySmall, { color: colors.red, flex: 1 }]}>{error}</Text>
            </View>
          )}

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
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
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

          <Pressable
            style={[styles.btn, { backgroundColor: colors.gold }, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={[styles.btnText, { color: colors.bg }]}>Entrar</Text>
            )}
          </Pressable>

          {biometricAvailable && biometricEnabled &&
            biometricEmail && email.trim().toLowerCase() === biometricEmail && (
            <Pressable
              style={[styles.bioBtn, { borderColor: colors.gold + "66" }, bioLoading && styles.btnDisabled]}
              onPress={handleBiometric}
              disabled={bioLoading}
            >
              {bioLoading ? (
                <ActivityIndicator color={colors.gold} size="small" />
              ) : (
                <>
                  <Ionicons name="scan" size={20} color={colors.gold} />
                  <Text style={[styles.bioBtnText, { color: colors.gold }]}>Entrar con Face ID</Text>
                </>
              )}
            </Pressable>
          )}

          <View style={styles.footer}>
            <Text style={typography.bodySmall}>¿No tienes cuenta? </Text>
            <Link href="/register" asChild>
              <Pressable>
                <Text style={[typography.bodySmall, { color: colors.gold, fontWeight: "600" }]}>Regístrate</Text>
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

    bioBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingVertical: 14,
      marginTop: spacing.sm,
    },
    bioBtnText: { fontSize: 15, fontWeight: "600" },

    footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  });
}
