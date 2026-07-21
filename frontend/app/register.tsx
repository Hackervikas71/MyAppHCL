import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, saveAuth, MECHANIC_CATEGORIES } from "@/src/lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Register() {
  const router = useRouter();
  const [role, setRole] = useState<"customer" | "mechanic">("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [category, setCategory] = useState(MECHANIC_CATEGORIES[0].key);
  const [garageAddress, setGarageAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit() {
    setErr(null); setLoading(true);
    try {
      const body: any = { name, email: email.trim().toLowerCase(), phone, password, role };
      if (role === "mechanic") { body.category = category; body.garage_address = garageAddress; }
      const { access_token, user } = await api.register(body);
      await saveAuth(access_token, user);
      if (user.role === "customer") router.replace("/(customer)/home");
      else router.replace("/(mechanic)/dashboard");
    } catch (e: any) {
      setErr(e?.message?.includes("already") ? "Email already registered" : "Registration failed");
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back} testID="register-back-button">
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join HMC and get help anywhere</Text>

          <View style={styles.roleRow}>
            {(["customer", "mechanic"] as const).map((r) => (
              <Pressable key={r} testID={`role-${r}-button`} onPress={() => setRole(r)} style={[styles.roleBtn, role === r && styles.roleBtnActive]}>
                <MaterialCommunityIcons name={r === "customer" ? "account" : "wrench"} size={20} color={role === r ? "#fff" : colors.textMuted} />
                <Text style={[styles.roleText, role === r && { color: "#fff" }]}>{r === "customer" ? "I need help" : "I'm a mechanic"}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput testID="register-name-input" placeholder="Full Name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} style={styles.input} />
          <TextInput testID="register-email-input" placeholder="Email" placeholderTextColor={colors.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          <TextInput testID="register-phone-input" placeholder="Phone Number" placeholderTextColor={colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />
          <TextInput testID="register-password-input" placeholder="Password (min 6 chars)" placeholderTextColor={colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />

          {role === "mechanic" && (
            <>
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
                {MECHANIC_CATEGORIES.map((c) => (
                  <Pressable key={c.key} onPress={() => setCategory(c.key)} style={[styles.chip, category === c.key && styles.chipActive]}>
                    <Text style={[styles.chipText, category === c.key && { color: "#fff" }]}>{c.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput placeholder="Garage / Workshop Address" placeholderTextColor={colors.textMuted} value={garageAddress} onChangeText={setGarageAddress} style={styles.input} />
              <Text style={styles.note}>Mechanic accounts require admin approval before receiving jobs.</Text>
            </>
          )}

          {err && <Text style={styles.err}>{err}</Text>}

          <Pressable testID="register-submit-button" onPress={onSubmit} disabled={loading} style={styles.primary}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>CREATE ACCOUNT</Text>}
          </Pressable>
          <Pressable onPress={() => router.replace("/login")}>
            <Text style={styles.link}>Already have an account? <Text style={{ color: colors.brand, fontWeight: "700" }}>Sign In</Text></Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "900", color: colors.text, marginTop: spacing.md },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.md },
  roleRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.sm },
  roleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surface2, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  roleBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  roleText: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  input: { backgroundColor: colors.surface2, color: colors.text, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.textMuted, fontSize: 12, textTransform: "uppercase", fontWeight: "700", letterSpacing: 1, marginTop: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, height: 36, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: "600" },
  note: { color: colors.warning, fontSize: 12, marginTop: spacing.xs },
  primary: { backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center", marginTop: spacing.lg },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 1.5 },
  link: { color: colors.textDim, textAlign: "center", marginTop: spacing.md, fontSize: 14 },
  err: { color: colors.brand, textAlign: "center", fontSize: 13 },
});
