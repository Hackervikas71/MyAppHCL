import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { LocationBatcher } from "@/src/lib/location-batcher";

export type LatLng = { lat: number; lng: number };
export type PermState = "granted" | "denied" | "blocked" | "checking" | "unsupported";

const DEFAULT: LatLng = { lat: 19.076, lng: 72.8777 };

/**
 * Requests foreground location permission, gets the current position, and
 * pushes every sample into the LocationBatcher (which handles rate-limiting,
 * distance-thresholding, and retry-on-failure).
 *
 * @param syncProfile  when true, samples are enqueued for `/api/auth/location`.
 * @param bookingId    when set, samples are also enqueued for
 *                     `/api/bookings/{id}/mechanic-location` (mechanic-side).
 */
export function useLiveLocation(syncProfile: boolean = true, bookingId?: string) {
  const [loc, setLoc] = useState<LatLng>(DEFAULT);
  const [perm, setPerm] = useState<PermState>("checking");
  const [error, setError] = useState<string | null>(null);
  const watcher = useRef<Location.LocationSubscription | null>(null);

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
        if (syncProfile) LocationBatcher.enqueueProfile(p.lat, p.lng);
        if (bookingId) LocationBatcher.enqueueBooking(bookingId, p.lat, p.lng);

        watcher.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 8000 },
          (u) => {
            const next = { lat: u.coords.latitude, lng: u.coords.longitude };
            setLoc(next);
            if (syncProfile) LocationBatcher.enqueueProfile(next.lat, next.lng);
            if (bookingId) LocationBatcher.enqueueBooking(bookingId, next.lat, next.lng);
          }
        );
      } catch (e: any) {
        if (Platform.OS === "web") setPerm("unsupported");
        else { setPerm("denied"); setError(String(e?.message || e)); }
      }
    })();

    return () => {
      mounted = false;
      watcher.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, syncProfile]);

  return { loc, perm, error };
}
