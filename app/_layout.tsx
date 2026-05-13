import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";

const FAVICON_DARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="9" fill="#0C0C0C"/><rect x="1.5" y="1.5" width="61" height="61" rx="7.5" fill="none" stroke="#FFFFFF" stroke-width="1.2" opacity="0.45"/><line x1="11" y1="15" x2="53" y2="15" stroke="#FFFFFF" stroke-width="0.9" opacity="0.4"/><text x="32" y="43" text-anchor="middle" font-family="Georgia,'Times New Roman',Palatino,serif" font-size="28" font-weight="700" fill="#FFFFFF" letter-spacing="-0.5">JÏT</text><line x1="11" y1="52" x2="53" y2="52" stroke="#FFFFFF" stroke-width="0.9" opacity="0.4"/></svg>`;
const FAVICON_LIGHT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="9" fill="#FFFFFF"/><rect x="1.5" y="1.5" width="61" height="61" rx="7.5" fill="none" stroke="#0C0C0C" stroke-width="1.2" opacity="0.3"/><line x1="11" y1="15" x2="53" y2="15" stroke="#0C0C0C" stroke-width="0.9" opacity="0.25"/><text x="32" y="43" text-anchor="middle" font-family="Georgia,'Times New Roman',Palatino,serif" font-size="28" font-weight="700" fill="#0C0C0C" letter-spacing="-0.5">JÏT</text><line x1="11" y1="52" x2="53" y2="52" stroke="#0C0C0C" stroke-width="0.9" opacity="0.25"/></svg>`;

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

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const svg = colorMode === "dark" ? FAVICON_DARK : FAVICON_LIGHT;
    const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    const el = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (el) el.href = uri;
  }, [colorMode]);

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
