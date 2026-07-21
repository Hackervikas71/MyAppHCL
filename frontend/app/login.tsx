import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, saveAuth } from "@/src/lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("customer@hmc.app");
  const [password, setPassword] = useState("customer123");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onLogin() {
    setErr(null); setLoading(true);
    try {
      const { access_token, user } = await api.login(email.trim().toLowerCase(), password);
      await saveAuth(access_token, user);
      if (user.role === "customer") router.replace("/(customer)/home");
      else if (user.role === "mechanic") router.replace("/(mechanic)/dashboard");
      else router.replace("/(admin)/dashboard");
    } catch (e: any) {
      setErr("Invalid email or password");
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <MaterialCommunityIcons name="tow-truck" size={40} color={colors.brand} />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to get roadside help fast</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="login-email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
            />
            {err && <Text style={styles.err}>{err}</Text>}
            <Pressable testID="login-submit-button" onPress={onLogin} disabled={loading} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>SIGN IN</Text>}
            </Pressable>
            <Pressable testID="go-to-register-button" onPress={() => router.push("/register")}>
              <Text style={styles.link}>New here? <Text style={{ color: colors.brand, fontWeight: "700" }}>Create Account</Text></Text>
            </Pressable>
          </View>

          <View style={styles.hintBox}>
            <Text style={styles.hintTitle}>Try Demo</Text>
            <Text style={styles.hint}>Customer: customer@hmc.app / customer123</Text>
            <Text style={styles.hint}>Mechanic: mechanic1@hmc.app / ravi123</Text>
            <Text style={styles.hint}>Admin: admin@hmc.app / admin123</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.xl, flexGrow: 1 },
  header: { alignItems: "center", marginTop: spacing.xxl, marginBottom: spacing.xxl },
  logoBox: { width: 84, height: 84, borderRadius: 20, backgroundColor: colors.brandDim, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.brand },
  title: { fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: 0.5 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  form: { gap: spacing.sm },
  label: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700" },
  input: { backgroundColor: colors.surface2, color: colors.text, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  primary: { backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center", marginTop: spacing.xl },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 1.5 },
  link: { color: colors.textDim, textAlign: "center", marginTop: spacing.lg, fontSize: 14 },
  err: { color: colors.brand, marginTop: spacing.sm, fontSize: 13 },
  hintBox: { marginTop: spacing.xl, backgroundColor: colors.surface2, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  hintTitle: { color: colors.warning, fontWeight: "800", marginBottom: spacing.xs, fontSize: 12, letterSpacing: 1 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
