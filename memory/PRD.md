# Arvik — PRD

## Overview
Arvik ("Help on the way") is an Uber-like roadside assistance mobile app that connects stranded drivers with nearby verified mechanics on national highways. Built with Expo (React Native), FastAPI + MongoDB. Custom orange/black identity with a wrench-and-road-inside-a-droplet logo.

## Roles
- **Customer** – request help, live-track mechanic, chat, pay (Cash MVP), rate.
- **Mechanic** – toggle online/offline, accept jobs, navigate, complete via OTP, view earnings.
- **Admin** – dashboard stats, approve/suspend mechanics.

## Core Flows (implemented)

### Auth
- Custom JWT auth (bcrypt hashed passwords, HS256, 30-day exp).
- Role-based route protection on backend & role-based redirect on frontend.
- Auto-seeded demo accounts on startup (see `test_credentials.md`).

### Customer
- **Home**: Leaflet dark map (OpenStreetMap tiles via WebView/iframe), YOU marker, nearby mechanic markers with ETA labels, floating SOS button, bottom sheet with nearby mechanic cards.
- **Booking flow (modal)**: 12 breakdown categories → 6 vehicle types → optional note → submit → tracking screen.
- **Live tracking**: mechanic marker moves ~15% closer to customer every backend poll (simulated); shows ETA, OTP, chat/call/cancel actions; auto-open rating modal on completion.
- **AI Assistant (tab)**: chat interface calling `POST /api/ai/chat-sync` — Emergent LLM (OpenAI gpt-5.4-mini) via `emergentintegrations` library with roadside-assistance system prompt.
- **Wallet**: balance, payment methods, transaction history.
- **Profile**: stats, menu items, logout.
- **SOS**: one-tap emergency alert + tel: links to Highway Patrol (1033), Ambulance (108), Police (100), Fire (101), HMC Support.

### Mechanic
- **Dashboard**: online/offline switch, earnings/jobs/rating metrics, active jobs, incoming requests with ACCEPT.
- **Job screen**: map with both markers, customer details, Start Work → Complete with 4-digit OTP entered by mechanic (customer sees OTP on tracking screen).
- **Jobs list & Earnings** (85% payout, 15% platform fee).

### Admin
- Stats grid: customers, mechanics, bookings, revenue, completed, active SOS.
- Mechanic table with APPROVE/SUSPEND actions; pending mechanics filtered visually.

## Data model (MongoDB collections)
- `users` (customer/mechanic/admin, includes location, wallet_balance, is_verified, is_online, rating, total_jobs, category, garage_address)
- `bookings` (status: requested→accepted→arriving→in_progress→completed/cancelled, price, otp, rating, mechanic_location)
- `chats` (per-booking messages)
- `sos` (active alerts)

## Backend endpoints
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/location`, `/api/mechanic/toggle-online`
- Mechanics: `/api/mechanics/nearby?lat=&lng=&radius_km=`
- Bookings: `POST /api/bookings`, `GET /api/bookings`, `GET /api/bookings/{id}` (auto-simulates mechanic movement), `POST /accept | /start | /complete | /cancel | /rate`
- Chat: `GET|POST /api/bookings/{id}/messages`
- AI: `POST /api/ai/chat-sync`, streaming variant `POST /api/ai/chat`
- SOS: `POST /api/sos`
- Admin: `GET /api/admin/stats`, `GET /api/admin/mechanics`, `POST /api/admin/mechanics/{id}/approve|reject`

## Integrations
- **Emergent LLM key** (OpenAI gpt-5.4-mini via `emergentintegrations`) for the AI assistant.
- **Emergent-managed Google Sign-In** — `POST /api/auth/session` exchanges a one-time `session_id` (returned by `https://auth.emergentagent.com`) for a 7-day `session_token` via Emergent's `demobackend.../oauth/session-data` endpoint. Backend upserts the user by email (new users default to `role: "customer"`, existing users keep their role). Tokens stored in `expo-secure-store` on native / `localStorage` on web. `get_current_user` dependency accepts BOTH new `session_token` and legacy JWT (so custom email/password auth still works). `POST /api/auth/logout` deletes the session row and the app clears storage.
- **Payments**: **Stripe test-mode** via `emergentintegrations.payments.stripe.checkout`. Two flows:
  - **Booking payment**: on a completed booking, PAY button → Stripe hosted checkout → success/cancel redirect → status polled and `booking.payment_status = "paid"`.
  - **Wallet top-up**: on the Wallet screen, ADD MONEY button opens a bottom sheet with preset amounts (₹100/500/1000/2000/5000). Selecting one creates a `wallet_topup` Stripe session; on payment success the backend idempotently credits `users.wallet_balance`. Test card: `4242 4242 4242 4242`.
- **Profile picture**: `POST /api/auth/picture` stores base64 (validated data URL, <2.5MB) on `users.picture`; profile screen has a tappable avatar with `expo-image-picker`.
- **Emergency contacts & Saved vehicles**: CRUD on `users.emergency_contacts` and `users.vehicles` arrays via `/api/profile/contacts` and `/api/profile/vehicles` endpoints, backed by dedicated settings screens.
- **Support & Privacy**: static screens with tap-to-call/email/WhatsApp links.
- **Real GPS**: **`expo-location`** integrated on BOTH customer and mechanic apps, all samples routed through the **LocationBatcher** singleton (`/app/frontend/src/lib/location-batcher.ts`) — coalesces samples with a 25m/60s threshold, flushes every 10s, keeps failed sends queued for retry on the next tick (survives spotty highway coverage / dead zones without spamming the API on reconnect). Only the latest queued sample is sent — stale points never leak out. A tiny "Syncing…/Offline · will retry" pill (testID `location-sync-indicator`) is shown on customer home while items are pending.
- **Breakdown photo end-to-end**: customer attaches via `expo-image-picker` (camera or library) → stored on the booking as base64 → mechanic sees a thumbnail row on the job screen with tap-to-enlarge full-screen zoomable modal.
- **Push notifications**: NOT integrated (out of MVP scope).

## Tech
- Frontend: Expo SDK 54, expo-router v6, react-native-webview (Leaflet dark tiles), @react-native-async-storage/async-storage, expo-haptics, safe-area-context.
- Backend: FastAPI 0.110, motor 3.3, bcrypt, PyJWT, emergentintegrations.

## Known limitations / next steps
- Real GPS via `expo-location` (needs permission handling).
- Realtime updates via WebSocket instead of polling.
- Stripe test-mode integration for card / UPI payments.
- Photo upload (camera + base64) already scaffolded in booking payload but no UI picker yet.
- Push notifications via Emergent-managed push (requires production build).
- Multi-language support (i18n).
