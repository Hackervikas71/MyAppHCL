import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, saveAuth } from "@/src/lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { startGoogleLogin } from "@/src/lib/google-auth";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("customer@hmc.app");
  const [password, setPassword] = useState("customer123");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  async function onGoogle() {
    setErr(null); setGoogleLoading(true);
    try {
      const user = await startGoogleLogin();
      if (!user) { setGoogleLoading(false); return; } // web: page redirected; native: user cancelled
      if (user.role === "customer") router.replace("/(customer)/home");
      else if (user.role === "mechanic") router.replace("/(mechanic)/dashboard");
      else router.replace("/(admin)/dashboard");
    } catch (e: any) {
      setErr("Google sign-in failed. Please try again.");
      setGoogleLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Image source={require("@/assets/images/icon.png")} style={styles.logoImg} resizeMode="contain" />
            <Text style={styles.title}>Welcome to Arvik</Text>
            <Text style={styles.subtitle}>Help on the way — sign in to get started</Text>
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

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable testID="google-signin-button" onPress={onGoogle} disabled={googleLoading} style={({ pressed }) => [styles.google, pressed && { opacity: 0.85 }]}>
              {googleLoading ? <ActivityIndicator color={colors.text} /> : (
                <>
                  <MaterialCommunityIcons name="google" size={20} color="#EA4335" />
                  <Text style={styles.googleText}>Continue with Google</Text>
                </>
              )}
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
  logoImg: { width: 120, height: 120, marginBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: 0.5 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  form: { gap: spacing.sm },
  label: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700" },
  input: { backgroundColor: colors.surface2, color: colors.text, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  primary: { backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center", marginTop: spacing.xl },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 1.5 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  google: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.borderStrong, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  googleText: { color: colors.text, fontWeight: "700", fontSize: 15 },
  link: { color: colors.textDim, textAlign: "center", marginTop: spacing.lg, fontSize: 14 },
  err: { color: colors.brand, marginTop: spacing.sm, fontSize: 13 },
  hintBox: { marginTop: spacing.xl, backgroundColor: colors.surface2, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  hintTitle: { color: colors.warning, fontWeight: "800", marginBottom: spacing.xs, fontSize: 12, letterSpacing: 1 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
