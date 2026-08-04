import { api } from "@/src/lib/api";

/**
 * LocationBatcher — coalesces GPS samples for spotty highway coverage.
 *
 * - Only flushes when the mechanic/customer has moved >25m OR every 60s.
 * - If a POST fails (offline / packet loss), the sample stays queued and is
 *   retried on the next flush tick (~10s).
 * - Multiple queued samples collapse to the latest — we never send stale
 *   coordinates just because they piled up during a dead zone.
 */

const DIST_THRESHOLD_M = 25;
const TIME_THRESHOLD_MS = 60_000;
const FLUSH_INTERVAL_MS = 10_000;

type Sample = { lat: number; lng: number; at: number };

function haversineM(a: Sample, b: Sample): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

class LocationBatcherImpl {
  private profile: Sample | null = null;
  private profileSent: Sample | null = null;
  private bookings = new Map<string, Sample>();
  private bookingsSent = new Map<string, Sample>();
  private timer: any = null;
  private lastFlushOk: boolean = true;
  private listeners = new Set<() => void>();

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  enqueueProfile(lat: number, lng: number) {
    this.profile = { lat, lng, at: Date.now() };
    this.notify();
  }
  enqueueBooking(bookingId: string, lat: number, lng: number) {
    this.bookings.set(bookingId, { lat, lng, at: Date.now() });
    this.notify();
  }

  private shouldSend(prev: Sample | null | undefined, next: Sample): boolean {
    if (!prev) return true;
    if (Date.now() - prev.at > TIME_THRESHOLD_MS) return true;
    return haversineM(prev, next) > DIST_THRESHOLD_M;
  }

  async flush() {
    // Profile
    if (this.profile) {
      const s = this.profile;
      if (this.shouldSend(this.profileSent, s)) {
        try {
          await api.updateLocation(s.lat, s.lng);
          this.profileSent = s;
          this.profile = null;
          this.lastFlushOk = true;
        } catch {
          this.lastFlushOk = false;
        }
      } else {
        this.profile = null;
      }
    }
    // Booking-scoped mechanic locations
    for (const [bid, sample] of Array.from(this.bookings.entries())) {
      const prev = this.bookingsSent.get(bid);
      if (this.shouldSend(prev, sample)) {
        try {
          await api.pushMechanicLocation(bid, sample.lat, sample.lng);
          this.bookingsSent.set(bid, sample);
          this.bookings.delete(bid);
          this.lastFlushOk = true;
        } catch {
          this.lastFlushOk = false;
        }
      } else {
        this.bookings.delete(bid);
      }
    }
    this.notify();
  }

  stats() {
    return {
      profilePending: this.profile !== null,
      bookingsPending: this.bookings.size,
      online: this.lastFlushOk,
    };
  }

  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }
  private notify() { this.listeners.forEach((cb) => { try { cb(); } catch {} }); }

  /** Test helper: reset all state. */
  __reset() {
    this.profile = null; this.profileSent = null;
    this.bookings.clear(); this.bookingsSent.clear();
    this.lastFlushOk = true;
  }
}

export const LocationBatcher = new LocationBatcherImpl();
LocationBatcher.start();
