import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";

const FAQ = [
  { q: "How do I request a mechanic?", a: "Tap REQUEST on the home map, pick a breakdown category, choose your vehicle, optionally attach a photo, and confirm. A nearby mechanic will accept within minutes." },
  { q: "How is the price calculated?", a: "Each breakdown category has a base fare. The mechanic can add parts costs at the end of the job. You'll see the total before you pay." },
  { q: "Can I pay via UPI?", a: "Yes — we accept UPI, cards, and cash. Digital payments go through a secure Stripe test-mode checkout." },
  { q: "What happens if I press SOS?", a: "Your live location is broadcast to Arvik support and your saved emergency contacts. You'll also see one-tap dial buttons for Highway Patrol, Ambulance, Police and Fire." },
];

export default function Support() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="support-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="support-back-button">
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Support</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}>
        <View style={styles.hero}>
          <MaterialCommunityIcons name="headset" size={40} color="#fff" />
          <Text style={styles.heroTitle}>{"We're here 24/7"}</Text>
          <Text style={styles.heroSub}>Reach out any time — average response under 3 minutes.</Text>
        </View>

        <View style={styles.methodRow}>
          <Pressable testID="support-call-button" onPress={() => Linking.openURL("tel:1800000462").catch(() => {})} style={styles.methodBtn}>
            <MaterialCommunityIcons name="phone" size={26} color={colors.brand} />
            <Text style={styles.methodLabel}>Call</Text>
            <Text style={styles.methodValue}>1800-000-462</Text>
          </Pressable>
          <Pressable testID="support-email-button" onPress={() => Linking.openURL("mailto:support@arvik.app").catch(() => {})} style={styles.methodBtn}>
            <MaterialCommunityIcons name="email-outline" size={26} color={colors.brand} />
            <Text style={styles.methodLabel}>Email</Text>
            <Text style={styles.methodValue}>support@arvik.app</Text>
          </Pressable>
          <Pressable testID="support-whatsapp-button" onPress={() => Linking.openURL("https://wa.me/919999999999").catch(() => {})} style={styles.methodBtn}>
            <MaterialCommunityIcons name="whatsapp" size={26} color={colors.brand} />
            <Text style={styles.methodLabel}>WhatsApp</Text>
            <Text style={styles.methodValue}>+91 99999 99999</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Frequently Asked</Text>
        {FAQ.map((f, i) => (
          <View key={i} style={styles.faqCard} testID={`faq-${i}`}>
            <Text style={styles.faqQ}>{f.q}</Text>
            <Text style={styles.faqA}>{f.a}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  hero: { backgroundColor: colors.brand, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 13, textAlign: "center" },
  methodRow: { flexDirection: "row", gap: spacing.sm },
  methodBtn: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.border },
  methodLabel: { color: colors.text, fontWeight: "800", fontSize: 13, marginTop: 4 },
  methodValue: { color: colors.textMuted, fontSize: 11, textAlign: "center" },
  section: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: spacing.lg, marginBottom: spacing.xs },
  faqCard: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  faqQ: { color: colors.text, fontWeight: "800", fontSize: 14 },
  faqA: { color: colors.textDim, fontSize: 13, marginTop: spacing.xs, lineHeight: 18 },
});
