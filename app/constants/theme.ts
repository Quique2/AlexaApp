export const colors = {
  // Backgrounds
  bg: "#0C0C0C",
  surface: "#181818",
  card: "#222222",
  border: "#2E2E2E",
  borderLight: "#3A3A3A",

  // Brand
  gold: "#C9A84C",
  goldLight: "#E2C47A",
  goldDim: "#8C7232",
  cream: "#F2EBD9",

  // Text
  textPrimary: "#F2EBD9",
  textSecondary: "#9A9A9A",
  textMuted: "#555555",

  // Alert / JIT
  red: "#E53935",
  redBg: "#2D1010",
  yellow: "#F9A825",
  yellowBg: "#2D2410",
  green: "#43A047",
  greenBg: "#102D12",
  none: "#555555",
  noneBg: "#1E1E1E",

  // System
  white: "#FFFFFF",
  black: "#000000",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.5, color: colors.textPrimary },
  h2: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3, color: colors.textPrimary },
  h3: { fontSize: 18, fontWeight: "600" as const, color: colors.textPrimary },
  h4: { fontSize: 15, fontWeight: "600" as const, color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: "400" as const, color: colors.textPrimary },
  bodySmall: { fontSize: 13, fontWeight: "400" as const, color: colors.textSecondary },
  caption: { fontSize: 11, fontWeight: "400" as const, color: colors.textMuted },
  label: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.2, color: colors.textMuted, textTransform: "uppercase" as const },
  mono: { fontSize: 13, fontFamily: "monospace" as const, color: colors.textPrimary },
} as const;

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
