import React, { useState } from "react";
import { Pressable } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { SettingsModal } from "../components/SettingsModal";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, focused, color }: { name: IoniconName; focused: boolean; color: string }) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IoniconName)}
      size={22}
      color={color}
    />
  );
}

function HeaderRight() {
  const { colors } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setSettingsOpen(true)}
        style={{ paddingHorizontal: 16 }}
        hitSlop={8}
      >
        <Ionicons name="person-circle-outline" size={26} color={colors.textSecondary} />
      </Pressable>
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();

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
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="grid" focused={focused} color={color} />
          ),
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
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="cube" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="production"
        options={{
          title: "Producción",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="flask" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Pedidos",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="receipt" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
