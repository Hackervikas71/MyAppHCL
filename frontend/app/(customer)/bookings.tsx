import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, Booking, categoryLabel } from "@/src/lib/api";

const STATUS_META: Record<string, { color: string; label: string; icon: any }> = {
  requested: { color: colors.warning, label: "Finding Mechanic", icon: "magnify" },
  accepted: { color: colors.brand, label: "Mechanic Assigned", icon: "wrench" },
  arriving: { color: colors.brand, label: "Arriving", icon: "car" },
  in_progress: { color: colors.success, label: "In Progress", icon: "progress-wrench" },
  completed: { color: colors.success, label: "Completed", icon: "check-circle" },
  cancelled: { color: colors.textMuted, label: "Cancelled", icon: "close-circle" },
};

export default function Bookings() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setBookings(await api.listBookings()); } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="customer-bookings">
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
        <Text style={styles.subtitle}>{bookings.length} total</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        {bookings.length === 0 && !loading && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No bookings yet</Text>
            <Text style={styles.emptySub}>Your service history will appear here</Text>
          </View>
        )}
        {bookings.map((b) => {
          const meta = STATUS_META[b.status] || STATUS_META.requested;
          return (
            <Pressable
              key={b.id}
              testID={`booking-item-${b.id}`}
              onPress={() => router.push(`/(customer)/booking/${b.id}`)}
              style={styles.card}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: meta.color + "22", borderColor: meta.color }]}>
                  <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{categoryLabel(b.breakdown_category)}</Text>
                  <Text style={styles.cardSub}>{b.vehicle_type.toUpperCase()} · {new Date(b.created_at).toLocaleString()}</Text>
                </View>
                <Text style={styles.price}>₹{b.price}</Text>
              </View>
              <View style={styles.footer}>
                <View style={[styles.chip, { borderColor: meta.color }]}>
                  <Text style={[styles.chipTxt, { color: meta.color }]}>{meta.label}</Text>
                </View>
                {b.mechanic_name && <Text style={styles.mechTxt}>· {b.mechanic_name}</Text>}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { color: colors.text, fontSize: 26, fontWeight: "900" },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  card: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBox: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  cardSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  price: { color: colors.text, fontWeight: "900", fontSize: 16 },
  footer: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  chipTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  mechTxt: { color: colors.textMuted, fontSize: 12 },
  empty: { alignItems: "center", padding: spacing.xxl, marginTop: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.text, fontWeight: "700", fontSize: 16 },
  emptySub: { color: colors.textMuted, fontSize: 13 },
});
