import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, loadUser } from "@/src/lib/api";

const HELPLINES = [
  { name: "Highway Patrol", number: "1033", icon: "car-emergency" as const },
  { name: "Ambulance", number: "108", icon: "ambulance" as const },
  { name: "Police", number: "100", icon: "police-badge" as const },
  { name: "Fire", number: "101", icon: "fire-truck" as const },
  { name: "HMC 24/7 Support", number: "18000000462", icon: "headset" as const },
];

export default function SOS() {
  const router = useRouter();
  const [triggered, setTriggered] = useState(false);
  const [busy, setBusy] = useState(false);

  async function trigger() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setBusy(true);
    try {
      const u = await loadUser();
      await api.sos(u?.location?.lat ?? 19.076, u?.location?.lng ?? 72.8777, "Emergency SOS from HMC app");
      setTriggered(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {} finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="sos-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="sos-back-button">
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Emergency SOS</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={styles.card}>
          <MaterialCommunityIcons name="alert-octagon" size={64} color="#fff" />
          <Text style={styles.big}>{triggered ? "Help is on the way" : "Press to alert help"}</Text>
          <Text style={styles.desc}>
            {triggered
              ? "Your location and details have been shared with emergency services and Arvik support."
              : "This will share your live location with emergency contacts and highway support."}
          </Text>

          {!triggered ? (
            <Pressable testID="trigger-sos-button" onPress={trigger} disabled={busy} style={styles.bigBtn}>
              {busy ? <ActivityIndicator color={colors.brand} /> : (
                <>
                  <MaterialCommunityIcons name="alert-octagon" size={30} color={colors.brand} />
                  <Text style={styles.bigBtnText}>TRIGGER SOS</Text>
                </>
              )}
            </Pressable>
          ) : (
            <View style={styles.triggeredBox}>
              <MaterialCommunityIcons name="check-decagram" size={22} color="#fff" />
              <Text style={styles.triggeredText}>SOS Broadcast Active</Text>
            </View>
          )}
        </View>

        <Text style={styles.section}>Emergency Helplines</Text>
        {HELPLINES.map((h) => (
          <Pressable
            key={h.number}
            testID={`helpline-${h.number}`}
            style={styles.helpline}
            onPress={() => Linking.openURL(`tel:${h.number}`).catch(() => {})}
          >
            <View style={styles.helpIcon}>
              <MaterialCommunityIcons name={h.icon} size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hName}>{h.name}</Text>
              <Text style={styles.hNum}>{h.number}</Text>
            </View>
            <MaterialCommunityIcons name="phone" size={22} color={colors.success} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  card: { backgroundColor: colors.brand, padding: spacing.xl, borderRadius: radius.lg, alignItems: "center", borderWidth: 1, borderColor: colors.brand, gap: spacing.md },
  big: { color: "#fff", fontSize: 22, fontWeight: "900" },
  desc: { color: "rgba(255,255,255,0.85)", fontSize: 13, textAlign: "center", lineHeight: 18 },
  bigBtn: { backgroundColor: "#fff", paddingHorizontal: spacing.xxl, paddingVertical: spacing.lg, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  bigBtnText: { color: colors.brand, fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  triggeredBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  triggeredText: { color: "#fff", fontWeight: "800" },
  section: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: spacing.md },
  helpline: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface2, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  helpIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandDim, alignItems: "center", justifyContent: "center" },
  hName: { color: colors.text, fontWeight: "700", fontSize: 15 },
  hNum: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
