import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, Booking, User, loadUser, categoryLabel } from "@/src/lib/api";

export default function Earnings() {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, list] = await Promise.all([api.me().catch(() => null), api.listBookings()]);
      setUser(u ?? (await loadUser()));
      setBookings(list.filter((b) => b.status === "completed" && b.mechanic_id === u?.id));
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const gross = bookings.reduce((s, b) => s + b.price, 0);
  const net = gross * 0.85;
  const commission = gross - net;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="mechanic-earnings">
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        <Text style={styles.title}>Earnings</Text>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Wallet Balance</Text>
          <Text style={styles.heroVal}>₹{user?.wallet_balance?.toFixed(2) ?? "0.00"}</Text>
          <View style={styles.rowSplit}>
            <View style={{ flex: 1 }}><Text style={styles.subLabel}>Gross Earned</Text><Text style={styles.subVal}>₹{gross.toFixed(0)}</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.subLabel}>Platform Fee</Text><Text style={styles.subVal}>₹{commission.toFixed(0)}</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.subLabel}>Net Payout</Text><Text style={[styles.subVal, { color: colors.success }]}>₹{net.toFixed(0)}</Text></View>
          </View>
        </View>

        <Text style={styles.section}>Completed Jobs ({bookings.length})</Text>
        {bookings.length === 0 && <Text style={{ color: colors.textMuted, textAlign: "center", padding: spacing.lg }}>No completed jobs yet</Text>}
        {bookings.map((b) => (
          <View key={b.id} style={styles.txn} testID={`earn-txn-${b.id}`}>
            <View style={styles.txIcon}><MaterialCommunityIcons name="cash-plus" size={20} color={colors.success} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.txT}>{categoryLabel(b.breakdown_category)}</Text>
              <Text style={styles.txS}>{new Date(b.completed_at || b.created_at).toLocaleString()} · {b.customer_name}</Text>
            </View>
            <Text style={styles.txAmt}>+₹{(b.price * 0.85).toFixed(0)}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 26, fontWeight: "900", marginBottom: spacing.lg },
  hero: { backgroundColor: colors.brand, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.brand },
  heroLabel: { color: "rgba(255,255,255,0.85)", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  heroVal: { color: "#fff", fontSize: 40, fontWeight: "900", marginTop: spacing.xs },
  rowSplit: { flexDirection: "row", marginTop: spacing.md, gap: spacing.sm },
  subLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11 },
  subVal: { color: "#fff", fontWeight: "800", fontSize: 14, marginTop: 2 },
  section: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.md },
  txn: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface2, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  txIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(52,199,89,0.15)", alignItems: "center", justifyContent: "center" },
  txT: { color: colors.text, fontWeight: "700", fontSize: 14 },
  txS: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  txAmt: { color: colors.success, fontWeight: "900", fontSize: 15 },
});
