import * as Storage from "@/src/lib/secure-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "arvik_token";
const USER_KEY = "arvik_user";

export type Role = "customer" | "mechanic" | "admin";

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  is_verified: boolean;
  is_online?: boolean;
  category?: string | null;
  rating: number;
  total_jobs: number;
  wallet_balance: number;
  location?: { lat: number; lng: number } | null;
  garage_address?: string | null;
  picture?: string | null;
  google_linked?: boolean;
};

export type Booking = {
  id: string;
  customer_id: string;
  customer_name: string;
  mechanic_id?: string | null;
  mechanic_name?: string | null;
  mechanic_phone?: string | null;
  breakdown_category: string;
  vehicle_type: string;
  description: string;
  photo_base64?: string | null;
  lat: number;
  lng: number;
  address: string;
  status: string;
  price: number;
  otp?: string | null;
  created_at: string;
  accepted_at?: string | null;
  completed_at?: string | null;
  mechanic_location?: { lat: number; lng: number } | null;
  eta_minutes?: number | null;
  rating?: number | null;
  review?: string | null;
  payment_status?: string | null;
};

export type Mechanic = {
  id: string;
  name: string;
  category?: string | null;
  rating: number;
  total_jobs: number;
  is_online: boolean;
  lat: number;
  lng: number;
  distance_km: number;
  eta_minutes: number;
};

async function getToken(): Promise<string | null> {
  return Storage.getItem(TOKEN_KEY);
}

export async function saveAuth(token: string, user: User) {
  await Storage.setItem(TOKEN_KEY, token);
  await Storage.setItem(USER_KEY, JSON.stringify(user));
}

export async function loadUser(): Promise<User | null> {
  const s = await Storage.getItem(USER_KEY);
  return s ? JSON.parse(s) : null;
}

export async function logout() {
  try { await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: await authHeaders() }); } catch {}
  await Storage.removeItem(TOKEN_KEY);
  await Storage.removeItem(USER_KEY);
}

async function authHeaders(): Promise<Record<string, string>> {
  const t = await getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  register: (body: any) => req<{ access_token: string; user: User }>(`/auth/register`, { method: "POST", body: JSON.stringify(body) }),
  login: (email: string, password: string) => req<{ access_token: string; user: User }>(`/auth/login`, { method: "POST", body: JSON.stringify({ email, password }) }),
  exchangeGoogleSession: (session_id: string) =>
    req<{ access_token: string; user: User }>(`/auth/session`, { method: "POST", body: JSON.stringify({ session_id }) }),
  me: () => req<User>(`/auth/me`),
  updateLocation: (lat: number, lng: number) => req(`/auth/location`, { method: "POST", body: JSON.stringify({ lat, lng }) }),
  toggleOnline: () => req<{ is_online: boolean }>(`/mechanic/toggle-online`, { method: "POST" }),

  nearbyMechanics: (lat: number, lng: number, radius = 20) =>
    req<{ mechanics: Mechanic[] }>(`/mechanics/nearby?lat=${lat}&lng=${lng}&radius_km=${radius}`),

  createBooking: (body: any) => req<Booking>(`/bookings`, { method: "POST", body: JSON.stringify(body) }),
  listBookings: () => req<Booking[]>(`/bookings`),
  getBooking: (id: string) => req<Booking>(`/bookings/${id}`),
  acceptBooking: (id: string) => req<Booking>(`/bookings/${id}/accept`, { method: "POST" }),
  startBooking: (id: string) => req<Booking>(`/bookings/${id}/start`, { method: "POST" }),
  completeBooking: (id: string, otp: string) => req<Booking>(`/bookings/${id}/complete`, { method: "POST", body: JSON.stringify({ otp }) }),
  cancelBooking: (id: string) => req<Booking>(`/bookings/${id}/cancel`, { method: "POST" }),
  rateBooking: (id: string, rating: number, review: string) =>
    req<Booking>(`/bookings/${id}/rate`, { method: "POST", body: JSON.stringify({ rating, review }) }),

  pushMechanicLocation: (booking_id: string, lat: number, lng: number) =>
    req<{ ok: boolean; eta_minutes?: number; status?: string; skipped?: boolean }>(`/bookings/${booking_id}/mechanic-location`, { method: "POST", body: JSON.stringify({ lat, lng }) }),

  getMessages: (id: string) => req<any[]>(`/bookings/${id}/messages`),
  sendMessage: (id: string, text: string) => req<any>(`/bookings/${id}/messages`, { method: "POST", body: JSON.stringify({ text }) }),

  aiChat: (message: string, session_id?: string) => req<{ reply: string; session_id: string }>(`/ai/chat-sync`, { method: "POST", body: JSON.stringify({ message, session_id }) }),

  sos: (lat: number, lng: number, message?: string) => req<any>(`/sos`, { method: "POST", body: JSON.stringify({ lat, lng, message }) }),

  listNotifications: () => req<any[]>(`/notifications`),
  unreadCount: () => req<{ count: number }>(`/notifications/unread-count`),
  markAllRead: () => req<{ ok: boolean }>(`/notifications/mark-read`, { method: "POST" }),
  markRead: (id: string) => req<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST" }),

  createCheckout: (booking_id: string, origin_url: string) =>
    req<{ url: string; session_id: string }>(`/payments/checkout/session`, { method: "POST", body: JSON.stringify({ booking_id, origin_url }) }),
  walletTopUp: (amount: number, origin_url: string) =>
    req<{ url: string; session_id: string }>(`/wallet/topup`, { method: "POST", body: JSON.stringify({ amount, origin_url }) }),
  checkoutStatus: (session_id: string) =>
    req<{ payment_status: string; status: string; amount_total: number; currency: string; booking_id?: string | null; kind?: string }>(`/payments/checkout/status/${session_id}`),

  updatePicture: (picture_base64: string) => req<User>(`/auth/picture`, { method: "POST", body: JSON.stringify({ picture_base64 }) }),

  listContacts: () => req<{ contacts: any[] }>(`/profile/contacts`),
  addContact: (body: { name: string; phone: string; relation?: string }) =>
    req<any>(`/profile/contacts`, { method: "POST", body: JSON.stringify(body) }),
  deleteContact: (id: string) => req(`/profile/contacts/${id}`, { method: "DELETE" }),

  listVehicles: () => req<{ vehicles: any[] }>(`/profile/vehicles`),
  addVehicle: (body: { vehicle_type: string; make: string; model: string; plate?: string; year?: number }) =>
    req<any>(`/profile/vehicles`, { method: "POST", body: JSON.stringify(body) }),
  deleteVehicle: (id: string) => req(`/profile/vehicles/${id}`, { method: "DELETE" }),

  adminStats: () => req<any>(`/admin/stats`),
  adminMechanics: () => req<User[]>(`/admin/mechanics`),
  adminApprove: (id: string) => req(`/admin/mechanics/${id}/approve`, { method: "POST" }),
  adminReject: (id: string) => req(`/admin/mechanics/${id}/reject`, { method: "POST" }),
};

export const BREAKDOWN_CATEGORIES = [
  { key: "bike_service_home", label: "Bike Service at Home", icon: "motorbike" as const },
  { key: "flat_tyre", label: "Flat Tyre", icon: "car-tire-alert" as const },
  { key: "battery_dead", label: "Battery Dead", icon: "car-battery" as const },
  { key: "engine_failure", label: "Engine Failure", icon: "engine-outline" as const },
  { key: "overheating", label: "Overheating", icon: "thermometer-high" as const },
  { key: "brake_failure", label: "Brake Issue", icon: "car-brake-alert" as const },
  { key: "fuel_empty", label: "Fuel Empty", icon: "gas-station-outline" as const },
  { key: "locked_keys", label: "Locked Keys", icon: "car-key" as const },
  { key: "tow_required", label: "Tow Truck", icon: "tow-truck" as const },
  { key: "electrical", label: "Electrical", icon: "flash-outline" as const },
  { key: "accident", label: "Accident", icon: "car-emergency" as const },
  { key: "clutch_failure", label: "Clutch", icon: "cog-outline" as const },
  { key: "custom", label: "Other Issue", icon: "wrench-outline" as const },
];

export const VEHICLE_TYPES = [
  { key: "car", label: "Car", icon: "car" as const },
  { key: "suv", label: "SUV", icon: "car-estate" as const },
  { key: "bike", label: "Bike", icon: "motorbike" as const },
  { key: "scooter", label: "Scooter", icon: "scooter" as const },
  { key: "truck", label: "Truck", icon: "truck" as const },
  { key: "ev", label: "Electric", icon: "car-electric" as const },
];

export const MECHANIC_CATEGORIES = [
  { key: "general_mechanic", label: "General Mechanic" },
  { key: "tyre_specialist", label: "Tyre Specialist" },
  { key: "battery_specialist", label: "Battery Specialist" },
  { key: "tow_truck", label: "Tow Truck Driver" },
  { key: "ev_technician", label: "EV Technician" },
  { key: "bike_mechanic", label: "Bike Mechanic" },
  { key: "truck_mechanic", label: "Truck Mechanic" },
];

export function categoryLabel(key: string) {
  return BREAKDOWN_CATEGORIES.find((c) => c.key === key)?.label
    ?? MECHANIC_CATEGORIES.find((c) => c.key === key)?.label
    ?? key.replace(/_/g, " ");
}
