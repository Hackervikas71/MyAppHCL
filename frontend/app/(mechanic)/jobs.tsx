import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, Booking, loadUser, categoryLabel } from "@/src/lib/api";

export default function MechanicJobs() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, list] = await Promise.all([loadUser(), api.listBookings()]);
      setUid(u?.id ?? null);
      setBookings(list);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const mine = bookings.filter((b) => b.mechanic_id === uid);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="mechanic-jobs">
      <View style={styles.header}><Text style={styles.title}>My Jobs</Text></View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        {mine.length === 0 && <Text style={styles.empty}>No jobs yet</Text>}
        {mine.map((b) => (
          <Pressable key={b.id} testID={`job-${b.id}`} onPress={() => router.push(`/(mechanic)/job/${b.id}` as any)} style={styles.card}>
            <View style={styles.row}>
              <MaterialCommunityIcons name="wrench" size={20} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cTitle}>{categoryLabel(b.breakdown_category)}</Text>
                <Text style={styles.cSub}>{b.customer_name} · {new Date(b.created_at).toLocaleString()}</Text>
              </View>
              <Text style={styles.price}>₹{b.price}</Text>
            </View>
            <View style={styles.footer}>
              <View style={[styles.chip, { borderColor: b.status === "completed" ? colors.success : colors.brand }]}>
                <Text style={[styles.chipText, { color: b.status === "completed" ? colors.success : colors.brand }]}>{b.status}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { padding: spacing.lg },
  title: { color: colors.text, fontSize: 26, fontWeight: "900" },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: spacing.xxl },
  card: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cTitle: { color: colors.text, fontWeight: "700", fontSize: 14 },
  cSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  price: { color: colors.brand, fontWeight: "900", fontSize: 15 },
  footer: { marginTop: spacing.md, flexDirection: "row" },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
});
