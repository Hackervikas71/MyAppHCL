import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { api } from "@/src/lib/api";

export type LatLng = { lat: number; lng: number };
export type PermState = "granted" | "denied" | "blocked" | "checking" | "unsupported";

const DEFAULT: LatLng = { lat: 19.076, lng: 72.8777 };

/**
 * Requests foreground location permission, gets the current position,
 * and starts a live watcher that syncs to the backend every ~10s.
 * Falls back to DEFAULT on web where permission is denied or fails.
 */
export function useLiveLocation(sync: boolean = true) {
  const [loc, setLoc] = useState<LatLng>(DEFAULT);
  const [perm, setPerm] = useState<PermState>("checking");
  const [error, setError] = useState<string | null>(null);
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const lastSync = useRef<number>(0);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const cur = await Location.getForegroundPermissionsAsync();
        let status = cur.status;
        let canAskAgain = cur.canAskAgain;

        if (status !== "granted" && canAskAgain) {
          const req = await Location.requestForegroundPermissionsAsync();
          status = req.status;
          canAskAgain = req.canAskAgain;
        }

        if (!mounted) return;

        if (status !== "granted") {
          setPerm(canAskAgain ? "denied" : "blocked");
          return;
        }
        setPerm("granted");

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const p: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!mounted) return;
        setLoc(p);
        if (sync) { api.updateLocation(p.lat, p.lng).catch(() => {}); lastSync.current = Date.now(); }

        watcher.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 8000 },
          (u) => {
            const next = { lat: u.coords.latitude, lng: u.coords.longitude };
            setLoc(next);
            if (sync && Date.now() - lastSync.current > 10000) {
              api.updateLocation(next.lat, next.lng).catch(() => {});
              lastSync.current = Date.now();
            }
          }
        );
      } catch (e: any) {
        if (Platform.OS === "web") {
          setPerm("unsupported");
        } else {
          setPerm("denied");
          setError(String(e?.message || e));
        }
      }
    })();

    return () => {
      mounted = false;
      watcher.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { loc, perm, error };
}
