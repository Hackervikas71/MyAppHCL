import { Platform } from "react-native";

/**
 * Arvik — Light Theme
 * Brand orange from the logo (#FF6A00) as accent, on white surface.
 */
export const colors = {
  surface: "#FFFFFF",
  surface2: "#F5F5F7",
  surface3: "#E8E8ED",
  text: "#0A0A0A",
  textDim: "#2C2C2E",
  textMuted: "#6E6E73",
  brand: "#FF6A00",
  brandDim: "#FFF3E5",
  brandSoft: "#FFB088",
  success: "#22C55E",
  warning: "#F59E0B",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
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
