// ─── Color palettes ───────────────────────────────────────────────────────────
export const darkColors = {
  bg: "#0C0C0C",
  surface: "#181818",
  card: "#222222",
  border: "#2E2E2E",
  borderLight: "#3A3A3A",
  gold: "#C9A84C",
  goldLight: "#E2C47A",
  goldDim: "#8C7232",
  cream: "#F2EBD9",
  textPrimary: "#F2EBD9",
  textSecondary: "#9A9A9A",
  textMuted: "#555555",
  red: "#E53935",
  redBg: "#2D1010",
  yellow: "#F9A825",
  yellowBg: "#2D2410",
  green: "#43A047",
  greenBg: "#102D12",
  none: "#555555",
  noneBg: "#1E1E1E",
  white: "#FFFFFF",
  black: "#000000",
} as const;

export const lightColors = {
  bg: "#F5F1EA",
  surface: "#FFFFFF",
  card: "#EDE9E0",
  border: "#D0C9B8",
  borderLight: "#BEB8A8",
  gold: "#A87B1E",
  goldLight: "#C9A84C",
  goldDim: "#8C6410",
  cream: "#3D2E1A",
  textPrimary: "#1A1410",
  textSecondary: "#5A5040",
  textMuted: "#938870",
  red: "#C62828",
  redBg: "#FDECEA",
  yellow: "#E65100",
  yellowBg: "#FFF3E0",
  green: "#2E7D32",
  greenBg: "#E8F5E9",
  none: "#938870",
  noneBg: "#EDE9E0",
  white: "#FFFFFF",
  black: "#000000",
} as const;

export type Colors = { [K in keyof typeof darkColors]: string };

// ─── Typography factory ───────────────────────────────────────────────────────
const FONT_SCALES = { small: 0.85, normal: 1, large: 1.2 } as const;
export type FontSize = keyof typeof FONT_SCALES;

export function makeTypography(fontSize: FontSize, c: Colors) {
  const s = FONT_SCALES[fontSize];
  return {
    h1: { fontSize: Math.round(28 * s), fontWeight: "700" as const, letterSpacing: -0.5, color: c.textPrimary },
    h2: { fontSize: Math.round(22 * s), fontWeight: "700" as const, letterSpacing: -0.3, color: c.textPrimary },
    h3: { fontSize: Math.round(18 * s), fontWeight: "600" as const, color: c.textPrimary },
    h4: { fontSize: Math.round(15 * s), fontWeight: "600" as const, color: c.textPrimary },
    body: { fontSize: Math.round(15 * s), fontWeight: "400" as const, color: c.textPrimary },
    bodySmall: { fontSize: Math.round(13 * s), fontWeight: "400" as const, color: c.textSecondary },
    caption: { fontSize: Math.round(11 * s), fontWeight: "400" as const, color: c.textMuted },
    label: { fontSize: Math.round(11 * s), fontWeight: "700" as const, letterSpacing: 1.2, color: c.textMuted, textTransform: "uppercase" as const },
    mono: { fontSize: Math.round(13 * s), fontFamily: "monospace" as const, color: c.textPrimary },
  };
}

export type Typography = ReturnType<typeof makeTypography>;

// ─── Legacy default exports (dark theme) ─────────────────────────────────────
export const colors = darkColors;
export const typography = makeTypography("normal", darkColors);

// ─── Static tokens (unchanged by theme) ──────────────────────────────────────
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

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
