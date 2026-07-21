import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, User, loadUser, Booking, categoryLabel } from "@/src/lib/api";

export default function Wallet() {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, list] = await Promise.all([api.me().catch(() => null), api.listBookings().catch(() => [])]);
      if (u) setUser(u);
      else setUser(await loadUser());
      setBookings(list.filter((b) => b.status === "completed"));
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalSpent = bookings.reduce((s, b) => s + b.price, 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="customer-wallet">
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        <Text style={styles.h1}>Wallet</Text>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>₹{user?.wallet_balance?.toFixed(2) ?? "0.00"}</Text>
          <View style={styles.balanceMeta}>
            <View style={styles.miniStat}>
              <MaterialCommunityIcons name="cash-multiple" size={14} color={colors.warning} />
              <Text style={styles.miniStatLabel}>Total Spent</Text>
              <Text style={styles.miniStatVal}>₹{totalSpent.toFixed(0)}</Text>
            </View>
            <View style={styles.miniStat}>
              <MaterialCommunityIcons name="clipboard-check" size={14} color={colors.success} />
              <Text style={styles.miniStatLabel}>Rides</Text>
              <Text style={styles.miniStatVal}>{bookings.length}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.section}>Payment Methods</Text>
        <View style={styles.methodsRow}>
          {[
            { label: "UPI", icon: "qrcode-scan" as const },
            { label: "Card", icon: "credit-card-outline" as const },
            { label: "Cash", icon: "cash" as const },
            { label: "Wallet", icon: "wallet-outline" as const },
          ].map((m) => (
            <View key={m.label} style={styles.methodCard} testID={`payment-method-${m.label.toLowerCase()}`}>
              <MaterialCommunityIcons name={m.icon} size={22} color={colors.brand} />
              <Text style={styles.methodText}>{m.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>Recent Transactions</Text>
        {bookings.length === 0 && (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: spacing.xl }}>No transactions yet</Text>
        )}
        {bookings.slice(0, 20).map((b) => (
          <View key={b.id} style={styles.txn} testID={`txn-${b.id}`}>
            <View style={styles.txnIcon}>
              <MaterialCommunityIcons name="arrow-up-right" size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.txnTitle}>{categoryLabel(b.breakdown_category)}</Text>
              <Text style={styles.txnSub}>{new Date(b.created_at).toLocaleDateString()} · {b.mechanic_name || "—"}</Text>
            </View>
            <Text style={styles.txnAmt}>-₹{b.price}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  h1: { color: colors.text, fontSize: 26, fontWeight: "900", marginBottom: spacing.lg },
  balanceCard: { backgroundColor: colors.brandDim, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.brand },
  balanceLabel: { color: colors.brandSoft, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  balanceValue: { color: "#fff", fontSize: 40, fontWeight: "900", marginTop: spacing.xs },
  balanceMeta: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  miniStat: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: radius.md, padding: spacing.md, gap: 2 },
  miniStatLabel: { color: colors.textMuted, fontSize: 11 },
  miniStatVal: { color: "#fff", fontWeight: "800", fontSize: 15 },
  section: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.md },
  methodsRow: { flexDirection: "row", gap: spacing.sm },
  methodCard: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  methodText: { color: colors.textDim, fontSize: 12, fontWeight: "600" },
  txn: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface2, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  txnIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandDim, alignItems: "center", justifyContent: "center" },
  txnTitle: { color: colors.text, fontWeight: "700", fontSize: 14 },
  txnSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  txnAmt: { color: colors.brand, fontWeight: "900", fontSize: 15 },
});
