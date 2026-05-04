import { Alert, Pressable } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import { useAuth } from "../context/AuthContext";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, focused }: { name: IoniconName; focused: boolean }) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IoniconName)}
      size={22}
      color={focused ? colors.gold : colors.textMuted}
    />
  );
}

function HeaderRight() {
  const { logout, biometricAvailable, biometricEnabled, enableBiometrics, disableBiometrics } =
    useAuth();

  function handleMenu() {
    const bioAction = biometricAvailable
      ? biometricEnabled
        ? {
            text: "Desactivar Face ID",
            onPress: () => disableBiometrics(),
          }
        : {
            text: "Activar Face ID",
            onPress: () =>
              enableBiometrics().catch((e) =>
                Alert.alert("Error", e.message)
              ),
          }
      : null;

    const options: any[] = [
      ...(bioAction ? [bioAction] : []),
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: () =>
          Alert.alert("Cerrar sesión", "¿Seguro que quieres salir?", [
            { text: "Cancelar", style: "cancel" },
            { text: "Salir", style: "destructive", onPress: logout },
          ]),
      },
      { text: "Cancelar", style: "cancel" },
    ];

    Alert.alert("Cuenta", "", options);
  }

  return (
    <Pressable onPress={handleMenu} style={{ paddingHorizontal: 16 }} hitSlop={8}>
      <Ionicons name="person-circle-outline" size={26} color={colors.textSecondary} />
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        headerRight: () => <HeaderRight />,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" as const, marginBottom: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => <TabIcon name="grid" focused={focused} />,
          headerTitle: "Rrëy",
          headerTitleStyle: {
            fontSize: 24,
            fontWeight: "700",
            letterSpacing: -0.5,
            color: colors.textPrimary,
          },
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventario",
          tabBarIcon: ({ focused }) => <TabIcon name="cube" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="production"
        options={{
          title: "Producción",
          tabBarIcon: ({ focused }) => <TabIcon name="flask" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Pedidos",
          tabBarIcon: ({ focused }) => <TabIcon name="receipt" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
