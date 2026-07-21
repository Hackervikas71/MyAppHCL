import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, User, loadUser, logout, categoryLabel } from "@/src/lib/api";

export default function MechanicProfile() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => setUser((await api.me().catch(() => null)) ?? (await loadUser())))();
  }, []));

  async function doLogout() { await logout(); router.replace("/login"); }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="mechanic-profile">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Text style={styles.h1}>Profile</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="wrench" size={40} color={colors.brand} />
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.cat}>{categoryLabel(user?.category || "general_mechanic")}</Text>
          <View style={[styles.badge, { backgroundColor: user?.is_verified ? "rgba(52,199,89,0.15)" : "rgba(255,204,0,0.15)" }]}>
            <MaterialCommunityIcons name={user?.is_verified ? "check-decagram" : "clock"} size={14} color={user?.is_verified ? colors.success : colors.warning} />
            <Text style={[styles.badgeText, { color: user?.is_verified ? colors.success : colors.warning }]}>{user?.is_verified ? "Verified" : "Pending Approval"}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{user?.total_jobs ?? 0}</Text>
            <Text style={styles.statLabel}>Jobs</Text>
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

        <View style={styles.info}>
          <View style={styles.infoRow}><Text style={styles.iL}>Email</Text><Text style={styles.iV}>{user?.email}</Text></View>
          <View style={styles.infoRow}><Text style={styles.iL}>Phone</Text><Text style={styles.iV}>{user?.phone}</Text></View>
          <View style={styles.infoRow}><Text style={styles.iL}>Garage</Text><Text style={styles.iV} numberOfLines={2}>{user?.garage_address || "—"}</Text></View>
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
  cat: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  badge: { marginTop: spacing.md, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: "700" },
  row: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  stat: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  statVal: { color: colors.text, fontSize: 20, fontWeight: "900" },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  info: { marginTop: spacing.lg, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  infoRow: { flexDirection: "row", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  iL: { color: colors.textMuted, fontSize: 13, width: 80 },
  iV: { color: colors.text, fontSize: 13, flex: 1, fontWeight: "600" },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xl, paddingVertical: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand },
  logoutText: { color: colors.brand, fontWeight: "800", letterSpacing: 1 },
});
