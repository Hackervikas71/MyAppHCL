import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, loadUser, User } from "@/src/lib/api";

type Msg = { id: string; sender_id: string; sender_name: string; text: string; created_at: string };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    const m = await api.getMessages(String(id)).catch(() => []);
    setMsgs(m as any);
  }, [id]);

  useEffect(() => { (async () => { setMe(await loadUser()); await load(); })(); }, []);
  useEffect(() => {
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const msg = await api.sendMessage(String(id), text.trim());
      setMsgs((prev) => [...prev, msg]);
      setText("");
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally { setSending(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="chat-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="chat-back-button">
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hName}>Booking Chat</Text>
          <Text style={styles.hSub}>Live communication</Text>
        </View>
        <MaterialCommunityIcons name="phone" size={22} color={colors.brand} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => {
            const mine = item.sender_id === me?.id;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.other]}>
                {!mine && <Text style={styles.sender}>{item.sender_name}</Text>}
                <Text style={mine ? styles.textMine : styles.textOther}>{item.text}</Text>
                <Text style={styles.time}>{new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Start the conversation…</Text>}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputRow}>
          <TextInput
            testID="chat-input"
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            style={styles.input}
            multiline
          />
          <Pressable testID="chat-send-button" onPress={send} disabled={sending} style={styles.sendBtn}>
            {sending ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="send" size={20} color="#fff" />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface2 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  hName: { color: colors.text, fontWeight: "800", fontSize: 15 },
  hSub: { color: colors.textMuted, fontSize: 12 },
  bubble: { maxWidth: "78%", padding: spacing.md, borderRadius: radius.md },
  mine: { alignSelf: "flex-end", backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  other: { alignSelf: "flex-start", backgroundColor: colors.surface2, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  sender: { color: colors.brandSoft, fontSize: 11, fontWeight: "800", marginBottom: 2 },
  textMine: { color: "#fff", fontSize: 14 },
  textOther: { color: colors.text, fontSize: 14 },
  time: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 4, textAlign: "right" },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: spacing.xxl },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface2 },
  input: { flex: 1, backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, maxHeight: 100, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
