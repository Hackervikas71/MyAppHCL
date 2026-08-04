/**
 * Emergent-managed Google sign-in helper for Expo (native + web).
 * Flow:
 *   1. Compute a platform-specific redirect URL.
 *   2. Open Emergent's hosted auth at auth.emergentagent.com?redirect=<redirect_url>.
 *   3. Extract session_id from the URL fragment (`#session_id=...`).
 *   4. Exchange it with our backend for a 7-day session_token.
 *
 * IMPORTANT: `session_id` is one-time-use. We guard against double-submits.
 */
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { api, saveAuth, User } from "@/src/lib/api";

WebBrowser.maybeCompleteAuthSession();

const usedSessionIds = new Set<string>();

function getRedirectUrl(): string {
  if (Platform.OS === "web") {
    // Must be a real route in our router. Root '/' is index.tsx which processes the session_id.
    return (globalThis as any).window?.location?.origin + "/";
  }
  return Linking.createURL("");
}

function extractSessionId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Exchange a session_id for a session_token and persist the user.
 * Idempotent: returns null if the id was already spent.
 */
export async function exchangeSessionId(sessionId: string): Promise<User | null> {
  if (usedSessionIds.has(sessionId)) return null;
  usedSessionIds.add(sessionId);
  const { access_token, user } = await api.exchangeGoogleSession(sessionId);
  await saveAuth(access_token, user);
  return user;
}

/**
 * Kick off Google login. On native it opens WebBrowser and waits for the deep link.
 * On web it hard-redirects to Emergent's hosted auth. The web callback is handled
 * by app/index.tsx on cold start.
 */
export async function startGoogleLogin(): Promise<User | null> {
  const redirectUrl = getRedirectUrl();
  const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

  if (Platform.OS === "web") {
    (globalThis as any).window.location.href = authUrl;
    return null; // Page will reload; index.tsx handles the return with session_id in URL.
  }

  // Native path — buffer any deep link that arrives during the flow.
  let bufferedUrl: string | null = null;
  const sub = Linking.addEventListener("url", (ev) => { bufferedUrl = ev.url; });

  try {
    const result: any = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    // Try result.url first, then the buffered deep link, then getInitialURL.
    const candidate =
      (typeof result?.url === "string" && result.url) ||
      bufferedUrl ||
      (await Linking.getInitialURL());
    const sessionId = extractSessionId(candidate);
    if (!sessionId) return null; // user cancelled or no callback landed
    return await exchangeSessionId(sessionId);
  } finally {
    sub.remove();
  }
}

/** Called on web cold-start to consume ?session_id / #session_id if present. */
export async function consumeWebCallbackIfAny(): Promise<User | null> {
  if (Platform.OS !== "web") return null;
  const w: any = (globalThis as any).window;
  if (!w?.location) return null;
  const raw = (w.location.search || "") + " " + (w.location.hash || "");
  const sessionId = extractSessionId(raw);
  if (!sessionId) return null;
  try {
    const user = await exchangeSessionId(sessionId);
    // Strip only session_id from the URL, preserve everything else.
    try {
      const url = new URL(w.location.href);
      url.searchParams.delete("session_id");
      let hash = url.hash;
      hash = hash.replace(/[?#&]session_id=[^&#]+/g, "").replace(/^#&/, "#").replace(/^#$/, "");
      const clean = url.origin + url.pathname + (url.search || "") + hash;
      w.history.replaceState(w.history.state, "", clean);
    } catch {}
    return user;
  } catch {
    return null;
  }
}
