import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, User, logout, categoryLabel } from "@/src/lib/api";

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [mechs, setMechs] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([api.adminStats(), api.adminMechanics()]);
      setStats(s); setMechs(m);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function approve(id: string) { setBusy(id); try { await api.adminApprove(id); await load(); } finally { setBusy(null); } }
  async function reject(id: string) { setBusy(id); try { await api.adminReject(id); await load(); } finally { setBusy(null); } }
  async function doLogout() { await logout(); router.replace("/login"); }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-dashboard">
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.h1}>HMC Admin</Text>
            <Text style={styles.sub}>Command Center</Text>
          </View>
          <Pressable onPress={doLogout} style={styles.logout} testID="admin-logout"><MaterialCommunityIcons name="logout" size={20} color={colors.brand} /></Pressable>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Customers" value={stats?.customers ?? 0} icon="account-group" color={colors.brand} />
          <StatCard label="Mechanics" value={stats?.mechanics ?? 0} icon="wrench" color={colors.warning} />
          <StatCard label="Bookings" value={stats?.bookings ?? 0} icon="clipboard-list" color={colors.success} />
          <StatCard label="Revenue" value={`₹${(stats?.revenue ?? 0).toFixed(0)}`} icon="cash-multiple" color={colors.success} />
          <StatCard label="Completed" value={stats?.completed_bookings ?? 0} icon="check-circle" color={colors.brand} />
          <StatCard label="SOS Active" value={stats?.active_sos ?? 0} icon="alert-octagon" color={colors.brand} />
        </View>

        <Text style={styles.section}>Mechanics ({mechs.length}) · {stats?.pending_mechanics ?? 0} pending</Text>
        {mechs.length === 0 && !loading && <Text style={{ color: colors.textMuted, textAlign: "center" }}>No mechanics registered</Text>}
        {mechs.map((m) => (
          <View key={m.id} style={styles.mCard} testID={`admin-mech-${m.id}`}>
            <View style={styles.mHeader}>
              <View style={styles.mAvatar}><MaterialCommunityIcons name="wrench" size={20} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mName}>{m.name}</Text>
                <Text style={styles.mSub}>{categoryLabel(m.category || "general_mechanic")} · {m.email}</Text>
                <Text style={styles.mSub}>{m.phone} · ★ {m.rating} · {m.total_jobs} jobs</Text>
              </View>
              <View style={[styles.status, { backgroundColor: m.is_verified ? "rgba(52,199,89,0.15)" : "rgba(255,204,0,0.15)", borderColor: m.is_verified ? colors.success : colors.warning }]}>
                <Text style={[styles.statusTxt, { color: m.is_verified ? colors.success : colors.warning }]}>{m.is_verified ? "APPROVED" : "PENDING"}</Text>
              </View>
            </View>
            <View style={styles.mActions}>
              {!m.is_verified ? (
                <Pressable style={[styles.act, { backgroundColor: colors.success }]} onPress={() => approve(m.id)} disabled={busy === m.id} testID={`approve-${m.id}`}>
                  {busy === m.id ? <ActivityIndicator color="#fff" /> : <><MaterialCommunityIcons name="check" size={14} color="#fff" /><Text style={styles.actTxt}>APPROVE</Text></>}
                </Pressable>
              ) : (
                <Pressable style={[styles.act, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.brand }]} onPress={() => reject(m.id)} disabled={busy === m.id} testID={`reject-${m.id}`}>
                  <MaterialCommunityIcons name="close" size={14} color={colors.brand} /><Text style={[styles.actTxt, { color: colors.brand }]}>SUSPEND</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color }: any) {
  return (
    <View style={styles.stat}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.lg },
  h1: { color: colors.text, fontSize: 26, fontWeight: "900" },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  logout: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stat: { width: "31%", backgroundColor: colors.surface2, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  statLabel: { color: colors.textMuted, fontSize: 10, textTransform: "uppercase", fontWeight: "700", marginTop: 6 },
  statVal: { color: colors.text, fontSize: 18, fontWeight: "900" },
  section: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.md },
  mCard: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  mHeader: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  mAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandDim, alignItems: "center", justifyContent: "center" },
  mName: { color: colors.text, fontWeight: "800", fontSize: 14 },
  mSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  status: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  statusTxt: { fontSize: 10, fontWeight: "900" },
  mActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  act: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4, paddingVertical: spacing.sm, borderRadius: radius.md },
  actTxt: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
});
