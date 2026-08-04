import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing } from "@/src/lib/theme";
import { loadUser } from "@/src/lib/api";
import { consumeWebCallbackIfAny } from "@/src/lib/google-auth";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Web-only: pick up ?session_id / #session_id from the OAuth callback URL first.
      const oauthUser = await consumeWebCallbackIfAny();
      const u = oauthUser ?? (await loadUser());
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
      <Image source={require("@/assets/images/icon.png")} style={styles.logo} resizeMode="contain" />
      <Text style={styles.brand}>ARVIK</Text>
      <Text style={styles.sub}>Help on the way</Text>
      <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  logo: { width: 180, height: 180, marginBottom: spacing.md },
  brand: { fontSize: 34, fontWeight: "900", color: colors.text, letterSpacing: 4 },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm, letterSpacing: 2, textTransform: "uppercase" },
});
