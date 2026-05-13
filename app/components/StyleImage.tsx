import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";

const STYLE_EMOJIS: Record<string, string> = {
  "Löndon": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Whïte": "🌾",
  "Kölsh": "🇩🇪",
  "Mëxican IPA": "🌶️",
  "Monterrëy Stout": "⚫",
  "Edición especial": "✨",
};

interface StyleImageProps {
  name: string;
  imageUri?: string | null;
  size?: number;
  borderRadius?: number;
}

export function StyleImage({ name, imageUri, size = 40, borderRadius }: StyleImageProps) {
  const { colors } = useTheme();
  const br = borderRadius ?? size / 2;

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={{ width: size, height: size, borderRadius: br }}
        resizeMode="cover"
      />
    );
  }

  const emoji = STYLE_EMOJIS[name];
  const fontSize = size * 0.45;

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius: br,
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      {emoji ? (
        <Text style={{ fontSize, lineHeight: size * 0.55 }}>{emoji}</Text>
      ) : (
        <Text style={{ fontSize, fontWeight: "700", color: colors.gold, lineHeight: size * 0.55 }}>
          {name.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
});
