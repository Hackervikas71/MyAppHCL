import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api } from "@/src/lib/api";

type Msg = { id: string; text: string; role: "user" | "assistant" };

const QUICK = [
  "My car won't start",
  "Battery seems dead",
  "Flat tyre, no spare",
  "Overheating engine",
  "Estimate tow cost",
];

export default function AIAssistant() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: "welcome", role: "assistant", text: "Hi! I'm HMC AI. Describe your vehicle issue and I'll help you diagnose it and suggest the right mechanic." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const listRef = useRef<FlatList>(null);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", text: text.trim() };
    setMsgs((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const res = await api.aiChat(text.trim(), sessionId);
      setSessionId(res.session_id);
      setMsgs((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", text: res.reply }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { id: `err-${Date.now()}`, role: "assistant", text: "Sorry, I couldn't reach the assistant. Please try again." }]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="ai-assistant-screen">
      <View style={styles.header}>
        <View style={styles.aiIcon}>
          <MaterialCommunityIcons name="robot-happy" size={26} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.hName}>HMC AI Assistant</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={styles.onlineDot} />
            <Text style={styles.hSub}>Powered by GPT · Online</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={80}>
        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl }}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === "user" ? styles.mine : styles.ai]} testID={`ai-msg-${item.role}`}>
              <Text style={item.role === "user" ? styles.textMine : styles.textAI}>{item.text}</Text>
            </View>
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {msgs.length <= 1 && (
          <View style={styles.quickWrap}>
            <Text style={styles.quickLabel}>Try asking:</Text>
            <View style={styles.quickRow}>
              {QUICK.map((q) => (
                <Pressable key={q} testID={`quick-${q.slice(0,10)}`} onPress={() => send(q)} style={styles.quickChip}>
                  <Text style={styles.quickText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            testID="ai-input"
            placeholder="Describe your issue..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            style={styles.input}
            multiline
          />
          <Pressable testID="ai-send-button" onPress={() => send(input)} disabled={busy} style={styles.sendBtn}>
            {busy ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="send" size={20} color="#fff" />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface2 },
  aiIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  hName: { color: colors.text, fontWeight: "800", fontSize: 16 },
  hSub: { color: colors.textMuted, fontSize: 12 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  bubble: { maxWidth: "88%", padding: spacing.md, borderRadius: radius.md },
  mine: { alignSelf: "flex-end", backgroundColor: colors.brand },
  ai: { alignSelf: "flex-start", backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  textMine: { color: "#fff", fontSize: 14 },
  textAI: { color: colors.text, fontSize: 14, lineHeight: 20 },
  quickWrap: { padding: spacing.lg, paddingTop: 0 },
  quickLabel: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm, fontWeight: "700" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  quickChip: { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  quickText: { color: colors.textDim, fontSize: 12, fontWeight: "600" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface2 },
  input: { flex: 1, backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, maxHeight: 100, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
