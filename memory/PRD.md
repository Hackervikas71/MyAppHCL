# Highway Mechanic Connect (HMC) — PRD

## Overview
An Uber-like roadside assistance mobile app that connects stranded drivers with nearby verified mechanics on national highways. Built with Expo (React Native), FastAPI + MongoDB.

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
- **Payments**: **Stripe test-mode** via `emergentintegrations.payments.stripe.checkout` — customer taps PAY on a completed booking → Stripe Checkout Session created → hosted checkout on web or `expo-web-browser` on native → success/cancel redirect to `/payment-success` or `/payment-cancel` → status polled and `booking.payment_status = "paid"` marked. Test card: `4242 4242 4242 4242`.
- **Real GPS**: **`expo-location`** integrated — customer app requests foreground permission, watches position (25m / 8s), syncs to backend `POST /api/auth/location` every 10s. On web where permission is denied, a warning banner is shown and default Mumbai (19.076, 72.8777) is used. Mechanic movement toward customer remains simulated (backend polling-based).
- **Camera / Photos**: **`expo-image-picker`** in booking flow — customer can take a photo or pick from library; base64 attached to booking payload. Permissions declared in `app.json` for iOS/Android.
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
