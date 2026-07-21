import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";

export default function PaymentCancel() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="payment-cancel">
      <View style={styles.center}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name="cancel" size={64} color={colors.warning} />
        </View>
        <Text style={styles.title}>Payment Cancelled</Text>
        <Text style={styles.sub}>No charges were made. You can retry payment from your booking.</Text>
        <Pressable testID="cancel-back-button" onPress={() => router.replace("/(customer)/bookings")} style={styles.btn}>
          <Text style={styles.btnText}>BACK TO BOOKINGS</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  icon: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.warning, backgroundColor: "rgba(255,204,0,0.1)" },
  title: { color: colors.text, fontSize: 24, fontWeight: "900", marginTop: spacing.md },
  sub: { color: colors.textMuted, fontSize: 14, textAlign: "center", maxWidth: 280, lineHeight: 20 },
  btn: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.xl },
  btnText: { color: "#fff", fontWeight: "900", letterSpacing: 1 },
});
