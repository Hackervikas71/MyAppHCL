import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing } from "@/src/lib/theme";
import { loadUser } from "@/src/lib/api";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const u = await loadUser();
      setTimeout(() => {
        if (!u) router.replace("/login");
        else if (u.role === "customer") router.replace("/(customer)/home");
        else if (u.role === "mechanic") router.replace("/(mechanic)/dashboard");
        else router.replace("/(admin)/dashboard");
      }, 700);
    })();
  }, []);

  return (
    <View style={styles.container} testID="splash-screen">
      <View style={styles.logoWrap}>
        <MaterialCommunityIcons name="tow-truck" size={64} color={colors.brand} />
      </View>
      <Text style={styles.brand}>HIGHWAY MECHANIC</Text>
      <Text style={styles.sub}>Connect · Repair · Roll</Text>
      <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  logoWrap: { width: 100, height: 100, borderRadius: 24, backgroundColor: colors.brandDim, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.brand },
  brand: { fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: 2 },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm, letterSpacing: 1 },
});
