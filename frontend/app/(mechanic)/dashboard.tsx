import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, loadUser, User, Booking, categoryLabel } from "@/src/lib/api";
import { useLiveLocation } from "@/src/hooks/use-live-location";
import { useNotifications } from "@/src/hooks/use-notifications";
import NotificationToast from "@/src/components/NotificationToast";

export default function MechanicDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const { perm } = useLiveLocation(true);
  const { latest, unread } = useNotifications(true);
  const [toast, setToast] = useState<any>(null);
  useEffect(() => { if (latest && latest.id !== toast?.id) setToast(latest); }, [latest]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, list] = await Promise.all([api.me().catch(() => null), api.listBookings().catch(() => [])]);
      const finalU = u ?? (await loadUser());
      setUser(finalU);
      setOnline(finalU?.is_online ?? false);
      setBookings(list);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [load]));

  async function toggleOnline() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const res = await api.toggleOnline();
    setOnline(res.is_online);
  }

  async function accept(bid: string) {
    setBusy(true);
    try { await api.acceptBooking(bid); await load(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push(`/(mechanic)/job/${bid}` as any);
    } catch {} finally { setBusy(false); }
  }

  const pending = bookings.filter((b) => b.status === "requested");
  const active = bookings.filter((b) => ["accepted", "arriving", "in_progress"].includes(b.status) && b.mechanic_id === user?.id);
  const todayEarnings = bookings.filter((b) => b.status === "completed" && b.mechanic_id === user?.id).reduce((s, b) => s + b.price * 0.85, 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="mechanic-dashboard">
      <NotificationToast
        item={toast}
        onDismiss={() => setToast(null)}
        onPress={(n) => n.booking_id && router.push(`/(mechanic)/job/${n.booking_id}` as any)}
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.hi}>Hello,</Text>
            <Text style={styles.name}>{user?.name?.split(" ")[0] ?? "Mechanic"}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Pressable testID="mechanic-bell-button" onPress={() => router.push("/notifications")} style={styles.bellBtn}>
              <MaterialCommunityIcons name="bell" size={20} color={colors.text} />
              {unread > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text></View>
              )}
            </Pressable>
            <View style={styles.toggleWrap}>
              <Text style={[styles.toggleLabel, { color: online ? colors.success : colors.textMuted }]}>{online ? "ONLINE" : "OFFLINE"}</Text>
              <Switch testID="online-toggle" value={online} onValueChange={toggleOnline} trackColor={{ true: colors.success, false: colors.surface3 }} thumbColor="#fff" />
            </View>
          </View>
        </View>

        {!user?.is_verified && (
          <View style={styles.warn}>
            <MaterialCommunityIcons name="alert" size={20} color={colors.warning} />
            <Text style={styles.warnText}>{`Account pending admin approval. You won't receive jobs yet.`}</Text>
          </View>
        )}

        {(perm === "denied" || perm === "blocked") && (
          <View style={styles.warn}>
            <MaterialCommunityIcons name="map-marker-off" size={20} color={colors.warning} />
            <Text style={styles.warnText}>Location off — enable GPS so customers can see you live.</Text>
          </View>
        )}

        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <MaterialCommunityIcons name="cash-multiple" size={20} color={colors.success} />
            <Text style={styles.metricLabel}>Earnings</Text>
            <Text style={styles.metricVal}>₹{todayEarnings.toFixed(0)}</Text>
          </View>
          <View style={styles.metric}>
            <MaterialCommunityIcons name="check-circle" size={20} color={colors.brand} />
            <Text style={styles.metricLabel}>Jobs Done</Text>
            <Text style={styles.metricVal}>{user?.total_jobs ?? 0}</Text>
          </View>
          <View style={styles.metric}>
            <MaterialCommunityIcons name="star" size={20} color={colors.warning} />
            <Text style={styles.metricLabel}>Rating</Text>
            <Text style={styles.metricVal}>{user?.rating?.toFixed(1) ?? "5.0"}</Text>
          </View>
        </View>

        {active.length > 0 && (
          <View>
            <Text style={styles.section}>Active Jobs</Text>
            {active.map((b) => (
              <Pressable key={b.id} testID={`active-job-${b.id}`} onPress={() => router.push(`/(mechanic)/job/${b.id}` as any)} style={[styles.jobCard, { borderColor: colors.brand }]}>
                <View style={styles.jobHeader}>
                  <MaterialCommunityIcons name="wrench" size={20} color={colors.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobTitle}>{categoryLabel(b.breakdown_category)}</Text>
                    <Text style={styles.jobSub}>{b.customer_name} · {b.vehicle_type.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.jobPrice}>₹{b.price}</Text>
                </View>
                <View style={styles.jobFoot}>
                  <View style={styles.statusChip}><Text style={styles.statusChipText}>{b.status}</Text></View>
                  <Text style={styles.jobEta}>ETA {b.eta_minutes ?? "-"} min</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View>
          <Text style={styles.section}>Incoming Requests ({pending.length})</Text>
          {pending.length === 0 && (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="tools" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>{online ? "Waiting for jobs..." : "Go online to receive jobs"}</Text>
            </View>
          )}
          {pending.map((b) => (
            <View key={b.id} style={styles.jobCard} testID={`pending-job-${b.id}`}>
              <View style={styles.jobHeader}>
                <View style={styles.jobIcon}>
                  <MaterialCommunityIcons name="alert-circle" size={20} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobTitle}>{categoryLabel(b.breakdown_category)}</Text>
                  <Text style={styles.jobSub}>{b.customer_name} · {b.vehicle_type.toUpperCase()}</Text>
                  {b.description ? <Text style={styles.jobDesc}>{`"${b.description}"`}</Text> : null}
                </View>
                <Text style={styles.jobPrice}>₹{b.price}</Text>
              </View>
              <View style={styles.actionRow}>
                <Pressable style={[styles.actBtn, { backgroundColor: colors.brand }]} onPress={() => accept(b.id)} disabled={busy} testID={`accept-${b.id}`}>
                  {busy ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <MaterialCommunityIcons name="check" size={16} color="#fff" />
                      <Text style={styles.actText}>ACCEPT</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hi: { color: colors.textMuted, fontSize: 14 },
  name: { color: colors.text, fontSize: 24, fontWeight: "900" },
  toggleWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, position: "relative" },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.brand, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  toggleLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  warn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(245,158,11,0.12)", padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warning },
  warnText: { color: "#7A4A00", fontSize: 12, flex: 1, fontWeight: "600" },
  metricRow: { flexDirection: "row", gap: spacing.sm },
  metric: { flex: 1, backgroundColor: colors.surface2, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  metricLabel: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase", fontWeight: "700" },
  metricVal: { color: colors.text, fontSize: 22, fontWeight: "900" },
  section: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: spacing.md },
  jobCard: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  jobHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  jobIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandDim, alignItems: "center", justifyContent: "center" },
  jobTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  jobSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  jobDesc: { color: colors.textDim, fontSize: 12, fontStyle: "italic", marginTop: 4 },
  jobPrice: { color: colors.brand, fontSize: 16, fontWeight: "900" },
  jobFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md, alignItems: "center" },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandDim, borderWidth: 1, borderColor: colors.brand },
  statusChipText: { color: colors.brand, fontWeight: "800", fontSize: 11, textTransform: "uppercase" },
  jobEta: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: spacing.xs },
  actText: { color: "#fff", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  empty: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 13 },
});
