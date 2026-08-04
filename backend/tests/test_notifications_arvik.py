"""Tests for in-app notifications + Arvik rebrand (Iteration 5)."""
import os
import pytest
import requests
import time

BASE_URL = os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/')
CUSTOMER = {"email": "customer@hmc.app", "password": "customer123"}
MECH1 = {"email": "mechanic1@hmc.app", "password": "ravi123"}
MECH2 = {"email": "mechanic2@hmc.app", "password": "suresh123"}

# Mumbai coords
LAT, LNG = 19.076, 72.8777


def login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"], r.json()["user"]


def hdr(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- Notifications end-to-end flow ----------

class TestNotificationsFlow:
    def test_full_lifecycle_and_endpoints(self):
        # login all
        ct, cust = login(CUSTOMER)
        m1t, m1 = login(MECH1)

        # ensure mechanic1 is online & near Mumbai
        requests.post(f"{BASE_URL}/api/auth/location", json={"lat": 19.080, "lng": 72.880}, headers=hdr(m1t))
        # ensure online — toggle if not
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=hdr(m1t)).json()
        if not me.get("is_online"):
            requests.post(f"{BASE_URL}/api/mechanic/toggle-online", headers=hdr(m1t))

        # mark existing as read for a clean count
        requests.post(f"{BASE_URL}/api/notifications/mark-read", headers=hdr(m1t))
        requests.post(f"{BASE_URL}/api/notifications/mark-read", headers=hdr(ct))

        # 1) Customer creates booking → mechanic1 gets new_booking notif
        booking_payload = {
            "breakdown_category": "flat_tyre",
            "vehicle_type": "car",
            "description": "TEST_notif flow",
            "lat": LAT, "lng": LNG, "address": "Mumbai TEST"
        }
        r = requests.post(f"{BASE_URL}/api/bookings", json=booking_payload, headers=hdr(ct))
        assert r.status_code == 200, r.text
        booking = r.json()
        bid = booking["id"]

        time.sleep(0.4)
        c = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=hdr(m1t)).json()
        assert c["count"] >= 1, f"expected new_booking notif, got count={c}"

        m1_notifs = requests.get(f"{BASE_URL}/api/notifications", headers=hdr(m1t)).json()
        nb = [n for n in m1_notifs if n["type"] == "new_booking" and n.get("booking_id") == bid]
        assert nb, "mechanic1 did not receive new_booking notification"
        assert nb[0]["read"] is False

        # 2) Mechanic accepts → customer gets booking_accepted with ETA & name
        r = requests.post(f"{BASE_URL}/api/bookings/{bid}/accept", headers=hdr(m1t))
        assert r.status_code == 200, r.text
        time.sleep(0.3)
        cn = requests.get(f"{BASE_URL}/api/notifications", headers=hdr(ct)).json()
        acc = [n for n in cn if n["type"] == "booking_accepted" and n["booking_id"] == bid]
        assert acc, "customer did not get booking_accepted"
        assert "ETA" in acc[0]["body"]
        assert m1["name"] in acc[0]["body"]

        # 3) Mechanic starts → customer gets work_started w/ OTP
        r = requests.post(f"{BASE_URL}/api/bookings/{bid}/start", headers=hdr(m1t))
        assert r.status_code == 200, r.text
        otp = r.json()["otp"]
        time.sleep(0.3)
        cn = requests.get(f"{BASE_URL}/api/notifications", headers=hdr(ct)).json()
        ws = [n for n in cn if n["type"] == "work_started" and n["booking_id"] == bid]
        assert ws, "customer did not get work_started"
        assert otp in ws[0]["body"], f"OTP {otp} not in body: {ws[0]['body']}"

        # 4) Mechanic completes with correct OTP → customer gets completed
        r = requests.post(f"{BASE_URL}/api/bookings/{bid}/complete", json={"otp": otp}, headers=hdr(m1t))
        assert r.status_code == 200, r.text
        time.sleep(0.3)
        cn = requests.get(f"{BASE_URL}/api/notifications", headers=hdr(ct)).json()
        comp = [n for n in cn if n["type"] == "completed" and n["booking_id"] == bid]
        assert comp, "customer did not get completed"

        # 5) mark-all-read → unread count = 0
        r = requests.post(f"{BASE_URL}/api/notifications/mark-read", headers=hdr(ct))
        assert r.status_code == 200
        c = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=hdr(ct)).json()
        assert c["count"] == 0

        # 6) POST /notifications/{id}/read marks single as read
        # Create one more unread by creating another booking then only accept
        r2 = requests.post(f"{BASE_URL}/api/bookings", json=booking_payload, headers=hdr(ct))
        bid2 = r2.json()["id"]
        requests.post(f"{BASE_URL}/api/bookings/{bid2}/accept", headers=hdr(m1t))
        time.sleep(0.3)
        cn = requests.get(f"{BASE_URL}/api/notifications", headers=hdr(ct)).json()
        target = next(n for n in cn if n["booking_id"] == bid2 and n["type"] == "booking_accepted")
        assert target["read"] is False
        r = requests.post(f"{BASE_URL}/api/notifications/{target['id']}/read", headers=hdr(ct))
        assert r.status_code == 200
        cn2 = requests.get(f"{BASE_URL}/api/notifications", headers=hdr(ct)).json()
        after = next(n for n in cn2 if n["id"] == target["id"])
        assert after["read"] is True
        # cleanup bid2
        requests.post(f"{BASE_URL}/api/bookings/{bid2}/cancel", headers=hdr(m1t))

    # 7) Unauthenticated request returns 401
    def test_unauth_401(self):
        for path in ["/api/notifications", "/api/notifications/unread-count"]:
            r = requests.get(f"{BASE_URL}{path}")
            assert r.status_code == 401, f"{path} expected 401 got {r.status_code}"
        r = requests.post(f"{BASE_URL}/api/notifications/mark-read")
        assert r.status_code == 401
        r = requests.post(f"{BASE_URL}/api/notifications/xyz/read")
        assert r.status_code == 401

    # 8) Offline mechanic should NOT get new_booking
    def test_offline_mechanic_no_notif(self):
        ct, _ = login(CUSTOMER)
        m1t, m1 = login(MECH1)
        # Ensure mech1 online first, then toggle off
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=hdr(m1t)).json()
        if not me.get("is_online"):
            requests.post(f"{BASE_URL}/api/mechanic/toggle-online", headers=hdr(m1t))
        # Now go offline
        r = requests.post(f"{BASE_URL}/api/mechanic/toggle-online", headers=hdr(m1t))
        assert r.json()["is_online"] is False

        # snapshot count before
        before = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=hdr(m1t)).json()["count"]

        # Customer creates a booking
        booking_payload = {
            "breakdown_category": "battery_dead",
            "vehicle_type": "car",
            "description": "TEST_offline",
            "lat": LAT, "lng": LNG, "address": "Mumbai TEST offline"
        }
        r = requests.post(f"{BASE_URL}/api/bookings", json=booking_payload, headers=hdr(ct))
        assert r.status_code == 200
        bid = r.json()["id"]
        time.sleep(0.4)

        after = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=hdr(m1t)).json()["count"]
        assert after == before, f"offline mechanic received a notif! before={before} after={after}"

        # Restore mech1 online for other tests
        requests.post(f"{BASE_URL}/api/mechanic/toggle-online", headers=hdr(m1t))
        # But other online mechanics may have received it — that's fine
        # cancel the booking to clean up
        requests.post(f"{BASE_URL}/api/bookings/{bid}/cancel", headers=hdr(ct))


# ---------- Regression smoke ----------

class TestRegression:
    def test_login_all_roles(self):
        for creds in [{"email": "admin@hmc.app", "password": "admin123"}, CUSTOMER, MECH1]:
            t, u = login(creds)
            assert u["email"] == creds["email"]

    def test_booking_full_lifecycle_and_rate(self):
        ct, _ = login(CUSTOMER)
        m1t, _ = login(MECH1)
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=hdr(m1t)).json()
        if not me.get("is_online"):
            requests.post(f"{BASE_URL}/api/mechanic/toggle-online", headers=hdr(m1t))
        r = requests.post(f"{BASE_URL}/api/bookings", json={
            "breakdown_category": "flat_tyre", "vehicle_type": "car",
            "description": "TEST_regression", "lat": LAT, "lng": LNG, "address": "TEST"
        }, headers=hdr(ct))
        bid = r.json()["id"]
        assert requests.post(f"{BASE_URL}/api/bookings/{bid}/accept", headers=hdr(m1t)).status_code == 200
        s = requests.post(f"{BASE_URL}/api/bookings/{bid}/start", headers=hdr(m1t))
        assert s.status_code == 200
        otp = s.json()["otp"]
        assert requests.post(f"{BASE_URL}/api/bookings/{bid}/complete", json={"otp": otp}, headers=hdr(m1t)).status_code == 200
        # rate
        rr = requests.post(f"{BASE_URL}/api/bookings/{bid}/rate", json={"rating": 5, "review": "TEST_ok"}, headers=hdr(ct))
        assert rr.status_code == 200

    def test_stripe_checkout_url(self):
        ct, _ = login(CUSTOMER)
        m1t, _ = login(MECH1)
        r = requests.post(f"{BASE_URL}/api/bookings", json={
            "breakdown_category": "flat_tyre", "vehicle_type": "car",
            "description": "TEST_stripe", "lat": LAT, "lng": LNG, "address": "TEST"
        }, headers=hdr(ct))
        bid = r.json()["id"]
        cs = requests.post(f"{BASE_URL}/api/payments/checkout/session", json={
            "booking_id": bid,
            "origin_url": BASE_URL,
        }, headers=hdr(ct))
        assert cs.status_code == 200, cs.text
        data = cs.json()
        assert data["url"].startswith("http")
        assert data["session_id"]
        # cleanup
        requests.post(f"{BASE_URL}/api/bookings/{bid}/cancel", headers=hdr(ct))

    def test_mechanic_location_endpoint_200(self):
        ct, _ = login(CUSTOMER)
        m1t, _ = login(MECH1)
        r = requests.post(f"{BASE_URL}/api/bookings", json={
            "breakdown_category": "flat_tyre", "vehicle_type": "car",
            "description": "TEST_loc", "lat": LAT, "lng": LNG, "address": "TEST"
        }, headers=hdr(ct))
        bid = r.json()["id"]
        requests.post(f"{BASE_URL}/api/bookings/{bid}/accept", headers=hdr(m1t))
        lr = requests.post(f"{BASE_URL}/api/bookings/{bid}/mechanic-location",
                           json={"lat": 19.078, "lng": 72.879}, headers=hdr(m1t))
        assert lr.status_code == 200
        requests.post(f"{BASE_URL}/api/bookings/{bid}/cancel", headers=hdr(ct))

    def test_photo_attachment_persists(self):
        ct, _ = login(CUSTOMER)
        tiny_png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        r = requests.post(f"{BASE_URL}/api/bookings", json={
            "breakdown_category": "flat_tyre", "vehicle_type": "car",
            "description": "TEST_photo", "photo_base64": tiny_png_b64,
            "lat": LAT, "lng": LNG, "address": "TEST"
        }, headers=hdr(ct))
        assert r.status_code == 200
        bid = r.json()["id"]
        g = requests.get(f"{BASE_URL}/api/bookings/{bid}", headers=hdr(ct)).json()
        assert g.get("photo_base64") == tiny_png_b64
        requests.post(f"{BASE_URL}/api/bookings/{bid}/cancel", headers=hdr(ct))
