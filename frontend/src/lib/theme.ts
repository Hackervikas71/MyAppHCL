import { Platform } from "react-native";

export const colors = {
  surface: "#121212",
  surface2: "#1E1E1E",
  surface3: "#2C2C2E",
  text: "#F5F5F5",
  textDim: "#E0E0E0",
  textMuted: "#98989D",
  brand: "#FF3B30",
  brandDim: "#4A110D",
  brandSoft: "#FF6961",
  success: "#34C759",
  warning: "#FFCC00",
  border: "#2C2C2E",
  borderStrong: "#3A3A3C",
  onBrand: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const font = {
  display: Platform.select({ ios: "System", android: "sans-serif-medium", default: "System" }) as string,
  text: Platform.select({ ios: "System", android: "sans-serif", default: "System" }) as string,
};
