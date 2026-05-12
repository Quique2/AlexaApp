import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";

// Handles auth-based navigation via useEffect so it fires AFTER state is committed,
// preventing the tab layout from rendering with a stale (null) user role.
function AuthNavigator() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading || segments.length === 0) return;
    const inAuth = segments[0] === "(auth)";
    const inTabs = segments[0] === "(tabs)";
    if (user && inAuth) {
      router.replace("/(tabs)/dashboard");
    } else if (!user && inTabs) {
      router.replace("/(auth)/login");
    }
  }, [user, isLoading, segments]);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 20_000,
    },
  },
});

function ThemedStack() {
  const { colors, colorMode } = useTheme();
  return (
    <>
      <StatusBar style={colorMode === "dark" ? "light" : "dark"} backgroundColor={colors.bg} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AuthNavigator />
          <ThemedStack />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
