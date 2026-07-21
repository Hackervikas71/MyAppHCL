import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, Modal, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, Booking, categoryLabel } from "@/src/lib/api";
import MapView from "@/src/components/MapView";

export default function MechanicJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [otp, setOtp] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<any>(null);

  const load = useCallback(async () => {
    try { setBooking(await api.getBooking(String(id))); } catch {}
  }, [id]);

  useEffect(() => { load(); timer.current = setInterval(load, 4000); return () => clearInterval(timer.current); }, [load]);

  async function start() {
    setBusy(true);
    try { await api.startBooking(String(id)); await load(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } finally { setBusy(false); }
  }
  async function complete() {
    setBusy(true);
    try {
      await api.completeBooking(String(id), otp);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOtpOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert("Invalid OTP", "Please ask customer for the correct 4-digit code.");
    } finally { setBusy(false); }
  }

  if (!booking) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  const markers = [
    { lat: booking.lat, lng: booking.lng, label: "USER", color: colors.warning },
    ...(booking.mechanic_location ? [{ lat: booking.mechanic_location.lat, lng: booking.mechanic_location.lng, label: "YOU", you: true }] : []),
  ];

  return (
    <View style={styles.root} testID="mechanic-job">
      <View style={styles.map}><MapView center={booking.mechanic_location || { lat: booking.lat, lng: booking.lng }} markers={markers} height="100%" /></View>

      <SafeAreaView edges={["top"]} style={styles.top} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} style={styles.back} testID="job-back-button"><MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} /></Pressable>
      </SafeAreaView>

      <View style={styles.card}>
        <View style={styles.grab} />
        <View style={styles.custRow}>
          <View style={styles.avatar}><MaterialCommunityIcons name="account" size={26} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cName}>{booking.customer_name}</Text>
            <Text style={styles.cSub}>{categoryLabel(booking.breakdown_category)} · {booking.vehicle_type.toUpperCase()}</Text>
          </View>
          <Text style={styles.price}>₹{booking.price}</Text>
        </View>

        {booking.description ? <Text style={styles.desc}>{`"${booking.description}"`}</Text> : null}

        <View style={styles.grid}>
          <View style={styles.gc}><Text style={styles.gL}>Status</Text><Text style={styles.gV}>{booking.status.replace("_", " ")}</Text></View>
          <View style={styles.gc}><Text style={styles.gL}>ETA</Text><Text style={styles.gV}>{booking.eta_minutes ?? "--"} min</Text></View>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.actBtn} onPress={() => router.push(`/(customer)/chat/${booking.id}` as any)}>
            <MaterialCommunityIcons name="chat" size={18} color={colors.brand} /><Text style={styles.actText}>Chat</Text>
          </Pressable>
          {booking.status === "accepted" && (
            <Pressable style={[styles.actBtn, { backgroundColor: colors.brand, borderColor: colors.brand }]} onPress={start} disabled={busy} testID="start-work-button">
              {busy ? <ActivityIndicator color="#fff" /> : (<><MaterialCommunityIcons name="play" size={18} color="#fff" /><Text style={[styles.actText, { color: "#fff" }]}>Start Work</Text></>)}
            </Pressable>
          )}
          {booking.status === "arriving" && (
            <Pressable style={[styles.actBtn, { backgroundColor: colors.brand, borderColor: colors.brand }]} onPress={start} disabled={busy} testID="arrived-button">
              <MaterialCommunityIcons name="play" size={18} color="#fff" /><Text style={[styles.actText, { color: "#fff" }]}>Start Work</Text>
            </Pressable>
          )}
          {booking.status === "in_progress" && (
            <Pressable style={[styles.actBtn, { backgroundColor: colors.success, borderColor: colors.success }]} onPress={() => setOtpOpen(true)} testID="complete-button">
              <MaterialCommunityIcons name="check" size={18} color="#fff" /><Text style={[styles.actText, { color: "#fff" }]}>Complete</Text>
            </Pressable>
          )}
          {booking.status === "completed" && <View style={styles.done}><MaterialCommunityIcons name="check-decagram" size={22} color={colors.success} /><Text style={{ color: colors.success, fontWeight: "800" }}>Completed</Text></View>}
        </View>
      </View>

      <Modal visible={otpOpen} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.otpCard}>
            <Text style={styles.otpTitle}>Enter Completion OTP</Text>
            <Text style={styles.otpSub}>Ask the customer for the 4-digit code</Text>
            <TextInput
              testID="otp-input"
              value={otp}
              onChangeText={setOtp}
              placeholder="0000"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              style={styles.otpInput}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable onPress={() => setOtpOpen(false)} style={[styles.otpBtn, { backgroundColor: colors.surface }]}><Text style={{ color: colors.text, fontWeight: "700" }}>Cancel</Text></Pressable>
              <Pressable onPress={complete} disabled={busy || otp.length !== 4} style={[styles.otpBtn, { backgroundColor: colors.brand }]} testID="confirm-complete-button">
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>CONFIRM</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  map: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  top: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: spacing.lg },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border },
  card: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  custRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  cName: { color: colors.text, fontSize: 15, fontWeight: "800" },
  cSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  price: { color: colors.brand, fontSize: 18, fontWeight: "900" },
  desc: { color: colors.textDim, fontStyle: "italic", fontSize: 13, marginTop: spacing.md, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  grid: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  gc: { flex: 1, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  gL: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase", fontWeight: "700" },
  gV: { color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 2, textTransform: "capitalize" },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actBtn: { flex: 1, backgroundColor: colors.surface, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.xs, borderWidth: 1, borderColor: colors.border },
  actText: { color: colors.text, fontWeight: "800", fontSize: 13 },
  done: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  overlay: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: "rgba(0,0,0,0.7)" },
  otpCard: { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  otpTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  otpSub: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  otpInput: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.lg, fontSize: 28, textAlign: "center", letterSpacing: 12, marginVertical: spacing.lg, borderWidth: 1, borderColor: colors.border, fontWeight: "900" },
  otpBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" },
});
