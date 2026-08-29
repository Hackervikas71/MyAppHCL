import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Modal, ActivityIndicator, Platform, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, User, loadUser, WalletTxn } from "@/src/lib/api";

const TOPUP_AMOUNTS = [100, 500, 1000, 2000, 5000];

export default function Wallet() {
  const [user, setUser] = useState<User | null>(null);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpBusy, setTopUpBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, t] = await Promise.all([api.me().catch(() => null), api.walletTransactions().catch(() => ({ transactions: [] as WalletTxn[] }))]);
      if (u) setUser(u); else setUser(await loadUser());
      setTxns(t.transactions || []);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function topUp(amount: number) {
    setTopUpBusy(true);
    try {
      const origin = (typeof window !== "undefined" && (window as any).location?.origin)
        || process.env.EXPO_PUBLIC_BACKEND_URL
        || "";
      const { url } = await api.walletTopUp(amount, origin);
      setTopUpOpen(false);
      if (Platform.OS === "web") (window as any).location.href = url;
      else { await WebBrowser.openBrowserAsync(url); setTimeout(load, 1500); }
    } catch (e: any) {
      Alert.alert("Top-up failed", e?.message || "Could not start checkout");
    } finally { setTopUpBusy(false); }
  }

  const totalSpent = txns.filter((t) => t.direction === "debit").reduce((s, t) => s + t.amount, 0);
  const totalRides = txns.filter((t) => t.kind !== "topup").length;

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
          <Pressable testID="add-money-button" onPress={() => setTopUpOpen(true)} style={styles.addMoneyBtn}>
            <MaterialCommunityIcons name="plus-circle" size={18} color={colors.brand} />
            <Text style={styles.addMoneyText}>ADD MONEY</Text>
          </Pressable>
          <View style={styles.balanceMeta}>
            <View style={styles.miniStat}>
              <MaterialCommunityIcons name="cash-multiple" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.miniStatLabel}>Total Spent</Text>
              <Text style={styles.miniStatVal}>₹{totalSpent.toFixed(0)}</Text>
            </View>
            <View style={styles.miniStat}>
              <MaterialCommunityIcons name="clipboard-check" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.miniStatLabel}>Rides</Text>
              <Text style={styles.miniStatVal}>{totalRides}</Text>
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
        {txns.length === 0 && (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: spacing.xl }} testID="no-transactions">No transactions yet</Text>
        )}
        {txns.slice(0, 30).map((t) => {
          const isCredit = t.direction === "credit";
          return (
            <View key={t.id} style={styles.txn} testID={`txn-${t.id}`}>
              <View style={[styles.txnIcon, { backgroundColor: isCredit ? "rgba(46,204,113,0.15)" : "rgba(255,140,0,0.15)" }]}>
                <MaterialCommunityIcons
                  name={isCredit ? "arrow-down-left" : "arrow-up-right"}
                  size={18}
                  color={isCredit ? "#2ecc71" : "#ff8c00"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnTitle}>{t.label}</Text>
                <Text style={styles.txnSub}>{t.at ? new Date(t.at).toLocaleDateString() : ""} · {t.sub}</Text>
              </View>
              <Text style={[styles.txnAmt, { color: isCredit ? "#2ecc71" : "#ff8c00" }]} testID={`txn-amt-${t.id}`}>
                {isCredit ? "+" : "−"}₹{t.amount.toFixed(0)}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={topUpOpen} transparent animationType="slide" onRequestClose={() => setTopUpOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add Money</Text>
              <Pressable onPress={() => setTopUpOpen(false)} testID="close-topup-modal"><MaterialCommunityIcons name="close" size={24} color={colors.textMuted} /></Pressable>
            </View>
            <Text style={styles.sheetSub}>Choose an amount to add to your wallet</Text>
            <View style={styles.amountGrid}>
              {TOPUP_AMOUNTS.map((a) => (
                <Pressable
                  key={a}
                  testID={`topup-amount-${a}`}
                  onPress={() => topUp(a)}
                  disabled={topUpBusy}
                  style={({ pressed }) => [styles.amountCard, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.amountText}>₹{a.toLocaleString()}</Text>
                </Pressable>
              ))}
            </View>
            {topUpBusy && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.brand} />}
            <Text style={styles.note}>{`You'll be redirected to a secure Stripe checkout. Use test card 4242 4242 4242 4242.`}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  h1: { color: colors.text, fontSize: 26, fontWeight: "900", marginBottom: spacing.lg },
  balanceCard: { backgroundColor: colors.brand, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.brand },
  balanceLabel: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  balanceValue: { color: "#fff", fontSize: 40, fontWeight: "900", marginTop: spacing.xs },
  addMoneyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, backgroundColor: "#fff", paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  addMoneyText: { color: colors.brand, fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  balanceMeta: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  miniStat: { flex: 1, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: radius.md, padding: spacing.md, gap: 2 },
  miniStatLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11 },
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

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  sheetSub: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: spacing.md },
  amountGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  amountCard: { width: "31%", backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: "center" },
  amountText: { color: colors.text, fontSize: 18, fontWeight: "900" },
  note: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md, textAlign: "center" },
});
