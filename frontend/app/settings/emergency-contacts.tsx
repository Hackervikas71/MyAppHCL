import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api } from "@/src/lib/api";

type Contact = { id: string; name: string; phone: string; relation?: string };

export default function EmergencyContacts() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.listContacts(); setContacts(r.contacts || []); } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onAdd() {
    if (!name.trim() || !phone.trim()) { Alert.alert("Missing info", "Name and phone are required."); return; }
    setAdding(true);
    try {
      const created = await api.addContact({ name: name.trim(), phone: phone.trim(), relation: relation.trim() });
      setContacts((prev) => [...prev, created]);
      setName(""); setPhone(""); setRelation("");
    } catch (e: any) {
      Alert.alert("Could not add", e?.message || "Please try again");
    } finally { setAdding(false); }
  }

  async function onDelete(id: string) {
    try { await api.deleteContact(id); setContacts((prev) => prev.filter((c) => c.id !== id)); } catch {}
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="emergency-contacts-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="emergency-back-button">
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Emergency Contacts</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        >
          <Text style={styles.hint}>These people will be alerted when you press SOS.</Text>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add a contact</Text>
            <TextInput testID="contact-name-input" placeholder="Full name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} style={styles.input} />
            <TextInput testID="contact-phone-input" placeholder="Phone number" placeholderTextColor={colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />
            <TextInput testID="contact-relation-input" placeholder="Relation (e.g. Spouse, Friend)" placeholderTextColor={colors.textMuted} value={relation} onChangeText={setRelation} style={styles.input} />
            <Pressable testID="add-contact-button" onPress={onAdd} disabled={adding} style={styles.addBtn}>
              {adding ? <ActivityIndicator color="#fff" /> : (
                <>
                  <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                  <Text style={styles.addBtnText}>ADD CONTACT</Text>
                </>
              )}
            </Pressable>
          </View>

          {contacts.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="phone-off" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No emergency contacts yet</Text>
            </View>
          ) : (
            contacts.map((c) => (
              <View key={c.id} style={styles.row} testID={`contact-${c.id}`}>
                <View style={styles.rowIcon}><MaterialCommunityIcons name="account" size={22} color={colors.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{c.name}</Text>
                  <Text style={styles.rowSub}>{c.phone}{c.relation ? ` · ${c.relation}` : ""}</Text>
                </View>
                <Pressable onPress={() => onDelete(c.id)} testID={`delete-contact-${c.id}`}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.brand} />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  hint: { color: colors.textMuted, fontSize: 13 },
  formCard: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  formTitle: { color: colors.text, fontWeight: "800", fontSize: 15, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, backgroundColor: colors.brand, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.sm },
  addBtnText: { color: "#fff", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface2, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandDim, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.text, fontWeight: "700", fontSize: 14 },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
