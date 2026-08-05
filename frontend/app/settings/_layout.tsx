import { Stack } from "expo-router";
import { colors } from "@/src/lib/theme";

export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, animation: "slide_from_right" }} />;
}
