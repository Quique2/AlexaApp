import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { darkColors, lightColors, makeTypography, Colors, FontSize, Typography } from "../constants/theme";

const THEME_MODE_KEY = "rrey_color_mode";
const FONT_SIZE_KEY = "rrey_font_size";

export type ColorMode = "dark" | "light";

const store = {
  get: (key: string) =>
    Platform.OS === "web"
      ? Promise.resolve(localStorage.getItem(key))
      : SecureStore.getItemAsync(key),
  set: (key: string, value: string) =>
    Platform.OS === "web"
      ? Promise.resolve(void localStorage.setItem(key, value))
      : SecureStore.setItemAsync(key, value),
};

interface ThemeContextType {
  colorMode: ColorMode;
  fontSize: FontSize;
  colors: Colors;
  typography: Typography;
  setColorMode: (mode: ColorMode) => void;
  setFontSize: (size: FontSize) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>("dark");
  const [fontSize, setFontSizeState] = useState<FontSize>("normal");

  useEffect(() => {
    async function load() {
      const [mode, size] = await Promise.all([
        store.get(THEME_MODE_KEY),
        store.get(FONT_SIZE_KEY),
      ]);
      if (mode === "light" || mode === "dark") setColorModeState(mode);
      if (size === "small" || size === "normal" || size === "large") setFontSizeState(size as FontSize);
    }
    load();
  }, []);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
    store.set(THEME_MODE_KEY, mode).catch(() => {});
  }, []);

  const setFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size);
    store.set(FONT_SIZE_KEY, size).catch(() => {});
  }, []);

  const colors: Colors = colorMode === "dark" ? darkColors : lightColors;
  const typography = useMemo(() => makeTypography(fontSize, colors), [fontSize, colors]);

  const value = useMemo(
    () => ({ colorMode, fontSize, colors, typography, setColorMode, setFontSize }),
    [colorMode, fontSize, colors, typography, setColorMode, setFontSize]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
