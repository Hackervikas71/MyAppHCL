import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, VEHICLE_TYPES } from "@/src/lib/api";

type Vehicle = { id: string; vehicle_type: string; make: string; model: string; plate?: string; year?: number };

export default function Vehicles() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [vt, setVt] = useState<string>(VEHICLE_TYPES[0].key);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.listVehicles(); setVehicles(r.vehicles || []); } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onAdd() {
    if (!make.trim() || !model.trim()) { Alert.alert("Missing info", "Make and model are required."); return; }
    setAdding(true);
    try {
      const created = await api.addVehicle({ vehicle_type: vt, make: make.trim(), model: model.trim(), plate: plate.trim() });
      setVehicles((prev) => [...prev, created]);
      setMake(""); setModel(""); setPlate("");
    } catch (e: any) {
      Alert.alert("Could not add", e?.message || "Please try again");
    } finally { setAdding(false); }
  }

  async function onDelete(id: string) {
    try { await api.deleteVehicle(id); setVehicles((prev) => prev.filter((v) => v.id !== id)); } catch {}
  }

  const iconFor = (key: string) => VEHICLE_TYPES.find((v) => v.key === key)?.icon || "car";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="vehicles-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="vehicles-back-button">
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Saved Vehicles</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        >
          <Text style={styles.hint}>Add your vehicles to book breakdowns faster.</Text>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add a vehicle</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
              {VEHICLE_TYPES.map((v) => (
                <Pressable key={v.key} onPress={() => setVt(v.key)} testID={`vt-${v.key}`} style={[styles.chip, vt === v.key && styles.chipActive]}>
                  <MaterialCommunityIcons name={v.icon} size={16} color={vt === v.key ? "#fff" : colors.brand} />
                  <Text style={[styles.chipText, vt === v.key && { color: "#fff" }]}>{v.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput testID="vehicle-make-input" placeholder="Make (e.g. Honda)" placeholderTextColor={colors.textMuted} value={make} onChangeText={setMake} style={styles.input} />
            <TextInput testID="vehicle-model-input" placeholder="Model (e.g. Activa)" placeholderTextColor={colors.textMuted} value={model} onChangeText={setModel} style={styles.input} />
            <TextInput testID="vehicle-plate-input" placeholder="Plate number (optional)" placeholderTextColor={colors.textMuted} value={plate} onChangeText={setPlate} autoCapitalize="characters" style={styles.input} />
            <Pressable testID="add-vehicle-button" onPress={onAdd} disabled={adding} style={styles.addBtn}>
              {adding ? <ActivityIndicator color="#fff" /> : (
                <>
                  <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                  <Text style={styles.addBtnText}>ADD VEHICLE</Text>
                </>
              )}
            </Pressable>
          </View>

          {vehicles.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="car-off" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No saved vehicles yet</Text>
            </View>
          ) : (
            vehicles.map((v) => (
              <View key={v.id} style={styles.row} testID={`vehicle-${v.id}`}>
                <View style={styles.rowIcon}><MaterialCommunityIcons name={iconFor(v.vehicle_type)} size={22} color={colors.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{v.make} {v.model}</Text>
                  <Text style={styles.rowSub}>{v.vehicle_type.toUpperCase()}{v.plate ? ` · ${v.plate}` : ""}</Text>
                </View>
                <Pressable onPress={() => onDelete(v.id)} testID={`delete-vehicle-${v.id}`}>
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
  chip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.textDim, fontSize: 12, fontWeight: "600" },
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
