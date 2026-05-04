import { Link, Stack } from "expo-router";
import { View, Text } from "react-native";
import { spacing } from "./constants/theme";
import { useTheme } from "./context/ThemeContext";

export default function NotFound() {
  const { colors, typography } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: "Página no encontrada" }} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, gap: spacing.md }}>
        <Text style={[typography.h1, { color: colors.gold }]}>404</Text>
        <Text style={typography.bodySmall}>Pantalla no encontrada</Text>
        <Link href="/">
          <Text style={[typography.body, { color: colors.gold }]}>Volver al Dashboard</Text>
        </Link>
      </View>
    </>
  );
}
