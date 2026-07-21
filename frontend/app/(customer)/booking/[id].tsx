import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert, TextInput, Modal, Image, Platform, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, Booking, categoryLabel } from "@/src/lib/api";
import MapView from "@/src/components/MapView";

export default function Tracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [paying, setPaying] = useState(false);
  const timer = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const b = await api.getBooking(String(id));
      setBooking(b);
      setLoading(false);
    } catch {}
  }, [id]);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 3500);
    return () => clearInterval(timer.current);
  }, [load]);

  useEffect(() => {
    if (booking?.status === "completed" && !booking.rating) setRateOpen(true);
  }, [booking?.status]);

  async function cancelBooking() {
    Alert.alert("Cancel booking?", "You'll lose your assigned mechanic.", [
      { text: "No", style: "cancel" },
      { text: "Yes", style: "destructive", onPress: async () => {
        await api.cancelBooking(String(id)); await load();
      }},
    ]);
  }

  async function submitRating() {
    await api.rateBooking(String(id), rating, review);
    setRateOpen(false);
    await load();
  }

  if (loading || !booking) {
    return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;
  }

  const markers = [
    { lat: booking.lat, lng: booking.lng, label: "YOU", you: true },
    ...(booking.mechanic_location ? [{ lat: booking.mechanic_location.lat, lng: booking.mechanic_location.lng, label: "MECH" }] : []),
  ];
  const route = booking.mechanic_location ? [booking.mechanic_location, { lat: booking.lat, lng: booking.lng }] : undefined;

  const statusMap: Record<string, string> = {
    requested: "Finding a mechanic near you...",
    accepted: "Mechanic is on the way",
    arriving: "Mechanic arriving now",
    in_progress: "Repair in progress",
    completed: "Service completed",
    cancelled: "Booking cancelled",
  };

  return (
    <View style={styles.root} testID="booking-tracking">
      <View style={styles.mapWrap}>
        <MapView center={booking.mechanic_location || { lat: booking.lat, lng: booking.lng }} markers={markers} route={route} zoom={14} height="100%" />
      </View>

      <SafeAreaView edges={["top"]} style={styles.topOverlay} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="tracking-back-button">
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{statusMap[booking.status]}</Text>
        </View>
      </SafeAreaView>

      <View style={styles.bottomCard}>
        <View style={styles.grabber} />

        {booking.status === "requested" ? (
          <View style={{ alignItems: "center", padding: spacing.lg }}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={styles.searchText}>Notifying nearby mechanics…</Text>
            <Text style={styles.searchSub}>{categoryLabel(booking.breakdown_category)} · ₹{booking.price}</Text>
            <Pressable onPress={cancelBooking} style={styles.cancelBtn} testID="cancel-request-button">
              <Text style={styles.cancelText}>Cancel Request</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.mechRow}>
              <View style={styles.mechAvatar}>
                <MaterialCommunityIcons name="wrench" size={26} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mechName}>{booking.mechanic_name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <MaterialCommunityIcons name="star" size={12} color={colors.warning} />
                  <Text style={styles.mechRating}>4.8 · Verified</Text>
                </View>
              </View>
              <View style={styles.etaBox}>
                <Text style={styles.etaVal}>{booking.eta_minutes ?? "--"}</Text>
                <Text style={styles.etaLabel}>MIN</Text>
              </View>
            </View>

            <View style={styles.metaGrid}>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Issue</Text>
                <Text style={styles.metaVal} numberOfLines={1}>{categoryLabel(booking.breakdown_category)}</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Vehicle</Text>
                <Text style={styles.metaVal}>{booking.vehicle_type.toUpperCase()}</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Price</Text>
                <Text style={styles.metaVal}>₹{booking.price}</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>OTP</Text>
                <Text style={[styles.metaVal, { color: colors.warning }]}>{booking.otp}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable style={styles.actionBtn} onPress={() => router.push(`/(customer)/chat/${booking.id}`)} testID="chat-mechanic-button">
                <MaterialCommunityIcons name="chat-processing" size={20} color={colors.brand} />
                <Text style={styles.actionText}>Chat</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} testID="call-mechanic-button">
                <MaterialCommunityIcons name="phone" size={20} color={colors.brand} />
                <Text style={styles.actionText}>Call</Text>
              </Pressable>
              {booking.status !== "completed" && booking.status !== "cancelled" && (
                <Pressable style={[styles.actionBtn, { backgroundColor: colors.brand, borderColor: colors.brand }]} onPress={cancelBooking} testID="cancel-active-button">
                  <MaterialCommunityIcons name="close" size={20} color="#fff" />
                  <Text style={[styles.actionText, { color: "#fff" }]}>Cancel</Text>
                </Pressable>
              )}
            </View>

            {booking.status === "completed" && (
              <View style={styles.completeBox}>
                <MaterialCommunityIcons name="check-decagram" size={28} color={colors.success} />
                <Text style={styles.completeText}>Service Completed</Text>
                <Text style={styles.completeSub}>Total: ₹{booking.price}</Text>
                {booking.payment_status === "paid" ? (
                  <View style={styles.paidBadge}>
                    <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
                    <Text style={styles.paidText}>PAID</Text>
                  </View>
                ) : (
                  <Pressable testID="pay-now-button" onPress={payNow} disabled={paying} style={styles.payBtn}>
                    {paying ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <MaterialCommunityIcons name="credit-card-outline" size={18} color="#fff" />
                        <Text style={styles.payText}>PAY ₹{booking.price} · UPI / CARD</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
      </View>

      {/* Rating modal */}
      <Modal visible={rateOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.rateTitle}>Rate your Mechanic</Text>
            <Text style={styles.rateSub}>{booking.mechanic_name}</Text>
            <View style={styles.stars}>
              {[1,2,3,4,5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} testID={`star-${n}`}>
                  <MaterialCommunityIcons name={n <= rating ? "star" : "star-outline"} size={40} color={colors.warning} />
                </Pressable>
              ))}
            </View>
            <TextInput
              testID="review-input"
              placeholder="Leave a review (optional)"
              placeholderTextColor={colors.textMuted}
              value={review}
              onChangeText={setReview}
              style={styles.reviewInput}
              multiline
            />
            <Pressable testID="submit-rating-button" onPress={submitRating} style={styles.rateBtn}>
              <Text style={styles.rateBtnText}>SUBMIT</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  mapWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  topOverlay: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border },
  statusPill: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface2, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  statusText: { color: colors.text, fontSize: 12, fontWeight: "700", flex: 1 },
  bottomCard: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: spacing.sm, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  searchText: { color: colors.text, fontSize: 15, fontWeight: "700", marginTop: spacing.md },
  searchSub: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  cancelBtn: { marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.brand, borderRadius: radius.pill },
  cancelText: { color: colors.brand, fontWeight: "800" },
  mechRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, gap: spacing.md },
  mechAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  mechName: { color: colors.text, fontSize: 16, fontWeight: "800" },
  mechRating: { color: colors.textMuted, fontSize: 12 },
  etaBox: { alignItems: "center", backgroundColor: colors.brandDim, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.brand },
  etaVal: { color: colors.brand, fontSize: 22, fontWeight: "900" },
  etaLabel: { color: colors.brandSoft, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", padding: spacing.lg, gap: spacing.sm },
  metaCell: { width: "48%", backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  metaLabel: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase", fontWeight: "700" },
  metaVal: { color: colors.text, fontWeight: "800", fontSize: 14, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg },
  actionBtn: { flex: 1, backgroundColor: colors.surface, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.xs, borderWidth: 1, borderColor: colors.border },
  actionText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  completeBox: { alignItems: "center", padding: spacing.lg, gap: 4 },
  completeText: { color: colors.success, fontWeight: "800", fontSize: 15 },
  completeSub: { color: colors.textMuted, fontSize: 13 },
  payBtn: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.md },
  payText: { color: "#fff", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  paidBadge: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: "rgba(52,199,89,0.15)", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, marginTop: spacing.md, borderWidth: 1, borderColor: colors.success },
  paidText: { color: colors.success, fontWeight: "900", letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: spacing.lg },
  modalCard: { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  rateTitle: { color: colors.text, fontSize: 22, fontWeight: "900" },
  rateSub: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  stars: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.lg },
  reviewInput: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, width: "100%", minHeight: 60, borderWidth: 1, borderColor: colors.border, textAlignVertical: "top" },
  rateBtn: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, marginTop: spacing.lg, alignItems: "center" },
  rateBtnText: { color: "#fff", fontWeight: "900", letterSpacing: 1 },
});
