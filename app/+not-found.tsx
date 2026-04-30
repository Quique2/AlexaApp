import { Link, Stack } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing } from "./constants/theme";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: "Página no encontrada" }} />
      <View style={styles.container}>
        <Text style={styles.title}>404</Text>
        <Text style={styles.sub}>Pantalla no encontrada</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Volver al Dashboard</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, gap: spacing.md },
  title: { ...typography.h1, color: colors.gold },
  sub: { ...typography.bodySmall },
  link: {},
  linkText: { ...typography.body, color: colors.gold },
});
