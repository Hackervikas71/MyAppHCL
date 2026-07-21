import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api } from "@/src/lib/api";

const POLL_INTERVAL = 2000;
const MAX_ATTEMPTS = 6;

export default function PaymentSuccess() {
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"polling" | "paid" | "failed" | "expired">("polling");
  const [attempts, setAttempts] = useState(0);
  const [bookingId, setBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (!session_id) { setStatus("failed"); return; }
    let cancelled = false;
    let n = 0;

    async function poll() {
      if (cancelled) return;
      try {
        const s = await api.checkoutStatus(String(session_id));
        setBookingId(s.booking_id);
        if (s.payment_status === "paid") { setStatus("paid"); return; }
        if (s.status === "expired") { setStatus("expired"); return; }
      } catch {}
      n++;
      setAttempts(n);
      if (n >= MAX_ATTEMPTS) { setStatus("failed"); return; }
      setTimeout(poll, POLL_INTERVAL);
    }
    poll();
    return () => { cancelled = true; };
  }, [session_id]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="payment-success">
      <View style={styles.center}>
        {status === "polling" && (
          <>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.title}>Confirming Payment…</Text>
            <Text style={styles.sub}>Please wait ({attempts}/{MAX_ATTEMPTS})</Text>
          </>
        )}
        {status === "paid" && (
          <>
            <View style={[styles.icon, { backgroundColor: "rgba(52,199,89,0.15)", borderColor: colors.success }]}>
              <MaterialCommunityIcons name="check-decagram" size={64} color={colors.success} />
            </View>
            <Text style={[styles.title, { color: colors.success }]}>Payment Successful</Text>
            <Text style={styles.sub}>Thanks for using HMC. An invoice has been generated.</Text>
          </>
        )}
        {(status === "failed" || status === "expired") && (
          <>
            <View style={[styles.icon, { backgroundColor: colors.brandDim, borderColor: colors.brand }]}>
              <MaterialCommunityIcons name="alert-circle" size={64} color={colors.brand} />
            </View>
            <Text style={[styles.title, { color: colors.brand }]}>Payment {status === "expired" ? "Expired" : "Not Confirmed"}</Text>
            <Text style={styles.sub}>Please retry from your booking screen.</Text>
          </>
        )}

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl }}>
          {bookingId && (
            <Pressable
              testID="go-booking-button"
              onPress={() => router.replace(`/(customer)/booking/${bookingId}`)}
              style={[styles.btn, { backgroundColor: colors.brand }]}
            >
              <Text style={styles.btnText}>VIEW BOOKING</Text>
            </Pressable>
          )}
          <Pressable
            testID="go-home-button"
            onPress={() => router.replace("/(customer)/home")}
            style={[styles.btn, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }]}
          >
            <Text style={[styles.btnText, { color: colors.text }]}>HOME</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  icon: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center", borderWidth: 2, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  sub: { color: colors.textMuted, fontSize: 14, textAlign: "center", maxWidth: 280, lineHeight: 20 },
  btn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  btnText: { color: "#fff", fontWeight: "900", letterSpacing: 1 },
});
