import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, Pressable, View, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "@/src/lib/theme";
import type { NotificationItem } from "@/src/hooks/use-notifications";

type Props = {
  item: NotificationItem | null;
  onPress?: (n: NotificationItem) => void;
  onDismiss?: () => void;
};

const ICON: Record<string, any> = {
  new_booking: "wrench",
  booking_accepted: "car",
  work_started: "progress-wrench",
  completed: "check-decagram",
};

/**
 * Full-width toast anchored below the status bar. Slides down when a new
 * notification arrives and auto-dismisses after 4s.
 */
export default function NotificationToast({ item, onPress, onDismiss }: Props) {
  const y = useRef(new Animated.Value(-120)).current;
  const timer = useRef<any>(null);
  const current = useRef<NotificationItem | null>(null);

  useEffect(() => {
    if (!item || item.id === current.current?.id) return;
    current.current = item;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(hide, 4000);
    return () => timer.current && clearTimeout(timer.current);
  }, [item?.id]);

  function hide() {
    Animated.timing(y, { toValue: -140, duration: 250, useNativeDriver: true }).start(() => {
      onDismiss?.();
      current.current = null;
    });
  }

  if (!item) return null;

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY: y }] }]} pointerEvents="box-none" testID="notification-toast">
      <Pressable
        onPress={() => { onPress?.(item); hide(); }}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        testID="notification-toast-body"
      >
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name={ICON[item.type] || "bell"} size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
        </View>
        <Pressable onPress={hide} hitSlop={12} testID="notification-toast-close">
          <MaterialCommunityIcons name="close" size={20} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 44, left: 0, right: 0, paddingHorizontal: spacing.md, zIndex: 999 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brand, padding: spacing.md, borderRadius: radius.md, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontWeight: "900", fontSize: 14 },
  body: { color: "rgba(255,255,255,0.9)", fontSize: 12, marginTop: 2 },
});
