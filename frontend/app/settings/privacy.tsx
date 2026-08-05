import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";

export default function Privacy() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="privacy-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="privacy-back-button">
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Privacy & Terms</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}>
        <Section title="1. Data we collect">
          Location (only while the app is open and used for matching mechanics), email, phone, name, profile picture (optional), booking details, and any photos you attach to a service request.
        </Section>
        <Section title="2. How we use your data">
          To connect you with nearby verified mechanics, dispatch emergency help when you press SOS, process payments securely through Stripe, and improve the service. We never sell your data.
        </Section>
        <Section title="3. Location sharing">
          Your live location is shared only with your assigned mechanic while a job is active, and with Arvik support / your emergency contacts if you press SOS.
        </Section>
        <Section title="4. Payments">
          Card and UPI payments are processed by Stripe. Arvik does not store your card details.
        </Section>
        <Section title="5. Your rights">
          You can delete your account at any time by contacting support@arvik.app. All personal data will be erased within 30 days.
        </Section>
        <Section title="6. Contact">
          Questions? Reach us at support@arvik.app or via the Support screen in-app.
        </Section>
        <Text style={styles.footer}>Version 1.0 · Effective {new Date().toLocaleDateString()}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  card: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.text, fontWeight: "800", fontSize: 14, marginBottom: spacing.xs },
  cardBody: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
  footer: { color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: spacing.lg },
});
