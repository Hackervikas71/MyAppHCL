import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, User, loadUser, logout } from "@/src/lib/api";

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      const u = await api.me().catch(() => null);
      setUser(u ?? (await loadUser()));
    })();
  }, []));

  async function doLogout() {
    await logout();
    router.replace("/login");
  }

  const items: { label: string; icon: any; testID: string; onPress?: () => void }[] = [
    { label: "Emergency Contacts", icon: "phone-alert", testID: "menu-emergency" },
    { label: "Saved Vehicles", icon: "car-multiple", testID: "menu-vehicles" },
    { label: "Notifications", icon: "bell-outline", testID: "menu-notifications" },
    { label: "Support", icon: "headset", testID: "menu-support" },
    { label: "Privacy & Terms", icon: "shield-check-outline", testID: "menu-privacy" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="customer-profile">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Text style={styles.h1}>Profile</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account" size={44} color={colors.brand} />
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.email}>{user?.phone}</Text>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="check-decagram" size={14} color={colors.success} />
            <Text style={styles.badgeText}>Verified</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{user?.total_jobs ?? 0}</Text>
            <Text style={styles.statLabel}>Services</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{user?.rating?.toFixed(1) ?? "5.0"}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>₹{user?.wallet_balance?.toFixed(0) ?? 0}</Text>
            <Text style={styles.statLabel}>Wallet</Text>
          </View>
        </View>

        <View style={styles.menu}>
          {items.map((it) => (
            <Pressable key={it.label} testID={it.testID} onPress={it.onPress} style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}>
              <MaterialCommunityIcons name={it.icon} size={20} color={colors.brand} />
              <Text style={styles.menuText}>{it.label}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <Pressable testID="logout-button" onPress={doLogout} style={styles.logout}>
          <MaterialCommunityIcons name="logout" size={18} color={colors.brand} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  h1: { color: colors.text, fontSize: 26, fontWeight: "900", marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.brandDim, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.brand },
  name: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: spacing.md },
  email: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  badge: { marginTop: spacing.md, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(52,199,89,0.15)", paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { color: colors.success, fontSize: 11, fontWeight: "700" },
  statRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  stat: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  statVal: { color: colors.text, fontSize: 20, fontWeight: "900" },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  menu: { marginTop: spacing.xl, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuText: { color: colors.text, fontSize: 14, flex: 1, fontWeight: "600" },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xl, paddingVertical: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand },
  logoutText: { color: colors.brand, fontWeight: "800", fontSize: 14, letterSpacing: 1 },
});
