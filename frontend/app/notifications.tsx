import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";
import { useNotifications, NotificationItem } from "@/src/hooks/use-notifications";
import { loadUser } from "@/src/lib/api";

const ICON: Record<string, any> = {
  new_booking: "wrench",
  booking_accepted: "car",
  work_started: "progress-wrench",
  completed: "check-decagram",
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { items, unread, refresh, markAllRead, markRead } = useNotifications(true);
  const [refreshing, setRefreshing] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => { loadUser().then((u) => setRole(u?.role || null)); }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  async function onRefresh() { setRefreshing(true); await refresh(); setRefreshing(false); }

  async function open(n: NotificationItem) {
    await markRead(n.id);
    if (!n.booking_id) return;
    if (role === "mechanic") router.push(`/(mechanic)/job/${n.booking_id}` as any);
    else router.push(`/(customer)/booking/${n.booking_id}` as any);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="notifications-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="notifications-back-button">
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <Pressable onPress={markAllRead} disabled={unread === 0} testID="mark-all-read-button" style={[styles.markAll, unread === 0 && { opacity: 0.4 }]}>
          <Text style={styles.markAllText}>Mark all read</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {items.length === 0 && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="bell-off-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>{`You're all caught up`}</Text>
            <Text style={styles.emptySub}>{`You'll see booking updates here`}</Text>
          </View>
        )}
        {items.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => open(n)}
            style={[styles.card, !n.read && styles.unread]}
            testID={`notification-item-${n.id}`}
          >
            <View style={[styles.iconWrap, { backgroundColor: n.read ? colors.surface3 : colors.brand }]}>
              <MaterialCommunityIcons name={ICON[n.type] || "bell"} size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cTitle} numberOfLines={1}>{n.title}</Text>
              <Text style={styles.cBody} numberOfLines={2}>{n.body}</Text>
              <Text style={styles.time}>{new Date(n.created_at).toLocaleString()}</Text>
            </View>
            {!n.read && <View style={styles.dot} />}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 20, fontWeight: "900", flex: 1 },
  markAll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand },
  markAllText: { color: colors.brand, fontSize: 12, fontWeight: "800" },
  empty: { alignItems: "center", padding: spacing.xxl, marginTop: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  emptySub: { color: colors.textMuted, fontSize: 13 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface2, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  unread: { borderColor: colors.brand },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  cTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  cBody: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  time: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
});
