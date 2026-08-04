"""
Iteration 6 backend tests
- Change A: location endpoints still respond 200 (unchanged)
- Change D: bike_service_home category -> 799
- Regression: booking lifecycle (create -> accept -> start -> complete -> rate),
  Stripe checkout, mechanic-location endpoint, notifications
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mechanic-connect-116.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER = {"email": "customer@hmc.app", "password": "customer123"}
MECH1 = {"email": "mechanic1@hmc.app", "password": "ravi123"}
ADMIN = {"email": "admin@hmc.app", "password": "admin123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def cust_h():
    return _login(CUSTOMER)


@pytest.fixture(scope="module")
def mech_h():
    h = _login(MECH1)
    # ensure online
    requests.post(f"{API}/auth/toggle-online", headers=h, timeout=15)
    me = requests.get(f"{API}/auth/me", headers=h, timeout=15).json()
    if not me.get("is_online"):
        requests.post(f"{API}/auth/toggle-online", headers=h, timeout=15)
    return h


@pytest.fixture(scope="module")
def admin_h():
    return _login(ADMIN)


# ---------- Change A: location endpoints still work ----------

class TestLocationEndpoints:
    def test_auth_location_200(self, cust_h):
        r = requests.post(f"{API}/auth/location", headers=cust_h,
                          json={"lat": 19.076, "lng": 72.877}, timeout=15)
        assert r.status_code == 200, r.text

    def test_mechanic_updates_own_location_200(self, mech_h):
        r = requests.post(f"{API}/auth/location", headers=mech_h,
                          json={"lat": 19.077, "lng": 72.878}, timeout=15)
        assert r.status_code == 200, r.text


# ---------- Change D: bike_service_home price = 799 ----------

class TestBikeServiceCategory:
    def test_create_booking_bike_service_home_returns_price_799(self, cust_h):
        payload = {
            "breakdown_category": "bike_service_home",
            "vehicle_type": "bike",
            "description": "TEST_iter6 bike service at home",
            "lat": 19.076, "lng": 72.877,
            "address": "TEST Andheri",
        }
        r = requests.post(f"{API}/bookings", headers=cust_h, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["breakdown_category"] == "bike_service_home"
        assert j["price"] == 799.0, f"expected 799.0 got {j['price']}"
        # cleanup
        try:
            requests.post(f"{API}/bookings/{j['id']}/cancel", headers=cust_h, timeout=10)
        except Exception:
            pass


# ---------- Regression: full lifecycle ----------

class TestBookingLifecycleRegression:
    def test_full_lifecycle(self, cust_h, mech_h):
        # create
        payload = {
            "breakdown_category": "flat_tyre",
            "vehicle_type": "car",
            "description": "TEST_iter6 lifecycle",
            "lat": 19.076, "lng": 72.877,
            "address": "TEST",
        }
        r = requests.post(f"{API}/bookings", headers=cust_h, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        booking = r.json()
        bid = booking["id"]
        assert booking["status"] in ("pending", "requested")

        # accept
        r2 = requests.post(f"{API}/bookings/{bid}/accept", headers=mech_h, timeout=15)
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "accepted"

        # start (returns OTP)
        r3 = requests.post(f"{API}/bookings/{bid}/start", headers=mech_h, timeout=15)
        assert r3.status_code == 200, r3.text
        started = r3.json()
        assert started["status"] == "in_progress"
        otp = started.get("otp")
        assert otp and len(str(otp)) >= 4

        # mechanic-location endpoint still 200 (Change A verification)
        rloc = requests.post(f"{API}/bookings/{bid}/mechanic-location",
                             headers=mech_h, json={"lat": 19.078, "lng": 72.879}, timeout=15)
        assert rloc.status_code == 200, rloc.text

        # complete with OTP
        r4 = requests.post(f"{API}/bookings/{bid}/complete", headers=mech_h,
                           json={"otp": str(otp)}, timeout=15)
        assert r4.status_code == 200, r4.text
        assert r4.json()["status"] == "completed"

        # rate
        r5 = requests.post(f"{API}/bookings/{bid}/rate", headers=cust_h,
                          json={"rating": 5, "review": "TEST_iter6 great"}, timeout=15)
        assert r5.status_code == 200, r5.text

        # verify persistence via GET
        rget = requests.get(f"{API}/bookings/{bid}", headers=cust_h, timeout=15)
        assert rget.status_code == 200
        j = rget.json()
        assert j["status"] == "completed"
        assert j.get("rating") == 5


# ---------- Regression: Stripe ----------

class TestStripeRegression:
    def test_checkout_session_url(self, cust_h):
        # create quick booking to pay for
        payload = {
            "breakdown_category": "flat_tyre",
            "vehicle_type": "car",
            "description": "TEST_iter6 stripe",
            "lat": 19.076, "lng": 72.877,
            "address": "TEST",
        }
        b = requests.post(f"{API}/bookings", headers=cust_h, json=payload, timeout=15).json()
        r = requests.post(f"{API}/payments/checkout/session", headers=cust_h,
                          json={"booking_id": b["id"], "origin_url": "https://example.com"}, timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("url", "").startswith("http")
        assert j.get("session_id")
        # cleanup
        try:
            requests.post(f"{API}/bookings/{b['id']}/cancel", headers=cust_h, timeout=10)
        except Exception:
            pass


# ---------- Regression: Notifications ----------

class TestNotificationsRegression:
    def test_bell_returns_list(self, cust_h):
        r = requests.get(f"{API}/notifications", headers=cust_h, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_unread_count(self, cust_h):
        r = requests.get(f"{API}/notifications/unread-count", headers=cust_h, timeout=15)
        assert r.status_code == 200
        assert "count" in r.json()

    def test_401_when_unauth(self):
        r = requests.get(f"{API}/notifications", timeout=15)
        assert r.status_code in (401, 403)
