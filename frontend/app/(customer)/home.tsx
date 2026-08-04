import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, Modal, Image } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { colors, spacing, radius } from "@/src/lib/theme";
import { api, BREAKDOWN_CATEGORIES, VEHICLE_TYPES, loadUser, Mechanic, User } from "@/src/lib/api";
import MapView from "@/src/components/MapView";
import { useLiveLocation } from "@/src/hooks/use-live-location";
import { useNotifications } from "@/src/hooks/use-notifications";
import NotificationToast from "@/src/components/NotificationToast";
import { useLocationBatcherStats } from "@/src/hooks/use-location-batcher-stats";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const { loc, perm } = useLiveLocation(true);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBook, setShowBook] = useState(false);
  const [step, setStep] = useState<"category" | "vehicle" | "photo" | "confirm">("category");
  const [category, setCategory] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { latest, unread } = useNotifications(true);
  const [toast, setToast] = useState<any>(null);
  useEffect(() => { if (latest && latest.id !== toast?.id) setToast(latest); }, [latest]);
  const batcher = useLocationBatcherStats();

  const load = useCallback(async () => {
    setLoading(true);
    const u = await loadUser();
    setUser(u);
    try {
      const { mechanics } = await api.nearbyMechanics(loc.lat, loc.lng, 20);
      setMechanics(mechanics);
    } catch {}
    setLoading(false);
  }, [loc.lat, loc.lng]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markers = useMemo(() => [
    { lat: loc.lat, lng: loc.lng, label: "YOU", you: true },
    ...mechanics.map((m) => ({ lat: m.lat, lng: m.lng, label: `${m.eta_minutes}min` })),
  ], [loc, mechanics]);

  function openBooking() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep("category"); setCategory(null); setVehicle(null); setPhoto(null); setNote("");
    setShowBook(true);
  }

  async function pickPhoto(from: "camera" | "library") {
    try {
      let perm: any;
      if (from === "camera") perm = await ImagePicker.requestCameraPermissionsAsync();
      else perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true, allowsEditing: true, aspect: [4, 3] };
      const res = from === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!res.canceled && res.assets?.[0]?.base64) {
        setPhoto(`data:image/jpeg;base64,${res.assets[0].base64}`);
        Haptics.selectionAsync();
      }
    } catch {}
  }

  async function submitBooking() {
    if (!category || !vehicle) return;
    setSubmitting(true);
    try {
      const b = await api.createBooking({
        breakdown_category: category, vehicle_type: vehicle, description: note,
        photo_base64: photo,
        lat: loc.lat, lng: loc.lng, address: "Current location",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowBook(false);
      router.push(`/(customer)/booking/${b.id}`);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setSubmitting(false); }
  }

  return (
    <View style={styles.root} testID="customer-home">
      {/* Map fills the top */}
      <View style={styles.mapWrap}>
        <MapView center={loc} markers={markers} zoom={14} height="100%" />
      </View>

      {/* Top pill */}
      <SafeAreaView edges={["top"]} style={styles.topOverlay} pointerEvents="box-none">
        <Pressable testID="profile-pill" onPress={() => router.push("/(customer)/profile")} style={styles.pill}>
          <MaterialCommunityIcons name="account-circle" size={22} color={colors.brand} />
          <Text style={styles.pillText}>{user?.name ?? "Guest"}</Text>
        </Pressable>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Pressable testID="bell-button" onPress={() => router.push("/notifications")} style={[styles.pill, styles.bellPill]}>
            <MaterialCommunityIcons name="bell" size={18} color={colors.text} />
            {unread > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text></View>
            )}
          </Pressable>
          <View style={styles.pill}>
            <MaterialCommunityIcons name="wallet" size={18} color={colors.warning} />
            <Text style={styles.pillText}>₹{user?.wallet_balance?.toFixed(0) ?? 0}</Text>
          </View>
        </View>
      </SafeAreaView>

      <NotificationToast
        item={toast}
        onDismiss={() => setToast(null)}
        onPress={(n) => n.booking_id && router.push(`/(customer)/booking/${n.booking_id}`)}
      />

      {(perm === "denied" || perm === "blocked") && (
        <SafeAreaView edges={["top"]} style={styles.permWrap} pointerEvents="box-none">
          <View style={styles.permBanner}>
            <MaterialCommunityIcons name="map-marker-off" size={16} color="#7A4A00" />
            <Text style={styles.permText}>Location off — using default area. Enable in Settings for accurate matches.</Text>
          </View>
        </SafeAreaView>
      )}

      {(batcher.profilePending || batcher.bookingsPending > 0) && (
        <View style={styles.syncPill} testID="location-sync-indicator" pointerEvents="none">
          <View style={[styles.syncDot, { backgroundColor: batcher.online ? colors.warning : colors.brand }]} />
          <Text style={styles.syncText}>{batcher.online ? "Syncing…" : "Offline · will retry"}</Text>
        </View>
      )}

      {/* SOS floating button (compact) */}
      <Pressable
        testID="sos-button"
        onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); router.push("/(customer)/sos"); }}
        style={styles.sosBtn}
      >
        <MaterialCommunityIcons name="alert-octagon" size={18} color="#fff" />
        <Text style={styles.sosText}>SOS</Text>
      </Pressable>

      {/* Bottom Sheet */}
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.sheetHeaderRow}>
          <View>
            <Text style={styles.sheetTitle}>Need Roadside Help?</Text>
            <Text style={styles.sheetSub}>{loading ? "Locating mechanics…" : `${mechanics.length} verified mechanics nearby`}</Text>
          </View>
          <Pressable testID="request-assistance-button" onPress={openBooking} style={styles.requestBtn}>
            <MaterialCommunityIcons name="wrench" size={16} color="#fff" />
            <Text style={styles.requestText}>REQUEST</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mechRow}>
          {loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginLeft: spacing.lg }} />
          ) : mechanics.length === 0 ? (
            <Text style={styles.emptyMech}>No mechanics in your area right now.</Text>
          ) : (
            mechanics.slice(0, 8).map((m) => (
              <View key={m.id} style={styles.mechCard} testID={`mechanic-card-${m.id}`}>
                <View style={styles.mechAvatar}>
                  <MaterialCommunityIcons name="wrench" size={22} color={colors.brand} />
                </View>
                <Text style={styles.mechName} numberOfLines={1}>{m.name}</Text>
                <Text style={styles.mechCat} numberOfLines={1}>{m.category?.replace(/_/g, " ")}</Text>
                <View style={styles.mechStats}>
                  <MaterialCommunityIcons name="star" size={12} color={colors.warning} />
                  <Text style={styles.mechStat}>{m.rating}</Text>
                  <Text style={styles.mechDot}>·</Text>
                  <Text style={styles.mechStat}>{m.distance_km} km</Text>
                </View>
                <Text style={styles.mechEta}>{m.eta_minutes} min</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* Booking modal */}
      <Modal visible={showBook} animationType="slide" transparent onRequestClose={() => setShowBook(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {step === "category" ? "What's the issue?" : step === "vehicle" ? "Vehicle Type" : step === "photo" ? "Add a Photo" : "Confirm Request"}
              </Text>
              <Pressable onPress={() => setShowBook(false)} testID="close-booking-modal"><MaterialCommunityIcons name="close" size={24} color={colors.textMuted} /></Pressable>
            </View>

            {step === "category" && (
              <ScrollView contentContainerStyle={styles.grid}>
                {BREAKDOWN_CATEGORIES.map((c) => (
                  <Pressable
                    key={c.key}
                    testID={`breakdown-${c.key}`}
                    onPress={() => { Haptics.selectionAsync(); setCategory(c.key); setStep("vehicle"); }}
                    style={[styles.catCard, category === c.key && styles.catCardActive]}
                  >
                    <MaterialCommunityIcons name={c.icon} size={30} color={category === c.key ? "#fff" : colors.brand} />
                    <Text style={[styles.catLabel, category === c.key && { color: "#fff" }]}>{c.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {step === "vehicle" && (
              <ScrollView contentContainerStyle={styles.grid}>
                {VEHICLE_TYPES.map((v) => (
                  <Pressable
                    key={v.key}
                    testID={`vehicle-${v.key}`}
                    onPress={() => { Haptics.selectionAsync(); setVehicle(v.key); setStep("photo"); }}
                    style={[styles.catCard, vehicle === v.key && styles.catCardActive]}
                  >
                    <MaterialCommunityIcons name={v.icon} size={32} color={vehicle === v.key ? "#fff" : colors.brand} />
                    <Text style={[styles.catLabel, vehicle === v.key && { color: "#fff" }]}>{v.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {step === "photo" && (
              <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
                <Text style={styles.photoHint}>Optional but recommended — helps mechanics diagnose faster and quote accurately.</Text>
                {photo ? (
                  <View style={styles.photoPreview}>
                    <Image source={{ uri: photo }} style={styles.photoImg} />
                    <Pressable onPress={() => setPhoto(null)} style={styles.photoRemove} testID="remove-photo-button">
                      <MaterialCommunityIcons name="close" size={16} color="#fff" />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.photoActions}>
                    <Pressable testID="pick-camera-button" onPress={() => pickPhoto("camera")} style={styles.photoBtn}>
                      <MaterialCommunityIcons name="camera" size={26} color={colors.brand} />
                      <Text style={styles.photoBtnText}>Take Photo</Text>
                    </Pressable>
                    <Pressable testID="pick-library-button" onPress={() => pickPhoto("library")} style={styles.photoBtn}>
                      <MaterialCommunityIcons name="image-multiple" size={26} color={colors.brand} />
                      <Text style={styles.photoBtnText}>From Library</Text>
                    </Pressable>
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable onPress={() => setStep("vehicle")} style={[styles.stepBtn, { backgroundColor: colors.surface }]} testID="photo-back-button">
                    <Text style={{ color: colors.text, fontWeight: "700" }}>BACK</Text>
                  </Pressable>
                  <Pressable onPress={() => setStep("confirm")} style={[styles.stepBtn, { backgroundColor: colors.brand }]} testID="photo-continue-button">
                    <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 1 }}>{photo ? "CONTINUE" : "SKIP"}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}

            {step === "confirm" && (
              <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Issue</Text>
                  <Text style={styles.summaryVal}>{BREAKDOWN_CATEGORIES.find(c => c.key === category)?.label}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Vehicle</Text>
                  <Text style={styles.summaryVal}>{VEHICLE_TYPES.find(v => v.key === vehicle)?.label}</Text>
                </View>
                <TextInput
                  testID="booking-note-input"
                  placeholder="Add a note (optional)"
                  placeholderTextColor={colors.textMuted}
                  value={note}
                  onChangeText={setNote}
                  style={styles.noteInput}
                  multiline
                />
                <Pressable testID="submit-booking-button" onPress={submitBooking} disabled={submitting} style={styles.confirmBtn}>
                  {submitting ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <MaterialCommunityIcons name="wrench" size={18} color="#fff" />
                      <Text style={styles.confirmText}>FIND MECHANIC NOW</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  mapWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  topOverlay: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  permWrap: { position: "absolute", top: 60, left: 0, right: 0, paddingHorizontal: spacing.lg },
  pill: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface2, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  bellPill: { paddingHorizontal: spacing.md, position: "relative" },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.brand, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  pillText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  sosBtn: { position: "absolute", right: spacing.lg, bottom: 320, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.brand, shadowColor: colors.brand, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  sosText: { color: "#fff", fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface2, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  sheetSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  requestBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill },
  requestText: { color: "#fff", fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  mechRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.md, minHeight: 140 },
  emptyMech: { color: colors.textMuted, fontSize: 13, padding: spacing.md },
  mechCard: { width: 140, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  mechAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandDim, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  mechName: { color: colors.text, fontWeight: "700", fontSize: 13 },
  mechCat: { color: colors.textMuted, fontSize: 11, marginTop: 2, textTransform: "capitalize" },
  mechStats: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.sm },
  mechStat: { color: colors.textDim, fontSize: 11, fontWeight: "600" },
  mechDot: { color: colors.textMuted, fontSize: 11 },
  mechEta: { color: colors.brand, fontWeight: "800", fontSize: 13, marginTop: spacing.xs },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: spacing.sm, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: spacing.md, gap: spacing.sm },
  catCard: { width: "31%", aspectRatio: 1, backgroundColor: colors.surface, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, gap: spacing.xs, padding: spacing.sm },
  catCardActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  catLabel: { color: colors.textDim, fontSize: 11, fontWeight: "700", textAlign: "center" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  summaryLabel: { color: colors.textMuted, fontSize: 13 },
  summaryVal: { color: colors.text, fontWeight: "700", fontSize: 14 },
  noteInput: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  confirmBtn: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  confirmText: { color: "#fff", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  photoHint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  photoActions: { flexDirection: "row", gap: spacing.md },
  photoBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, gap: spacing.sm, minHeight: 120 },
  photoBtnText: { color: colors.textDim, fontWeight: "700", fontSize: 13 },
  photoPreview: { borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border, position: "relative" },
  photoImg: { width: "100%", height: 200 },
  photoRemove: { position: "absolute", top: spacing.sm, right: spacing.sm, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  stepBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" },
  permBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.warning, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, marginTop: spacing.sm },
  permText: { color: "#7A4A00", fontSize: 11, fontWeight: "700", flex: 1 },
  syncPill: { position: "absolute", top: 108, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.surface2, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  syncDot: { width: 6, height: 6, borderRadius: 3 },
  syncText: { color: colors.textDim, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
});
