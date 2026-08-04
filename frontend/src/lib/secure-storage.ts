/**
 * Platform-safe token storage.
 *  - Native (iOS/Android): expo-secure-store (encrypted, per Emergent auth guidance).
 *  - Web: localStorage (SecureStore is a no-op on web).
 * Legacy AsyncStorage is not used here; token migration happens on next login.
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const isWeb = Platform.OS === "web";

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try { (globalThis as any).localStorage?.setItem(key, value); } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    try { return (globalThis as any).localStorage?.getItem(key) ?? null; } catch { return null; }
  }
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}

export async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    try { (globalThis as any).localStorage?.removeItem(key); } catch {}
    return;
  }
  try { await SecureStore.deleteItemAsync(key); } catch {}
}
