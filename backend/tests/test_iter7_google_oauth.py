"""Iteration 7 — Emergent Google OAuth + dual-token auth regression.

Tests:
  A. Contract of POST /api/auth/session (garbage id -> 401; missing field -> 422).
  B. Legacy email/password login still works, /api/auth/me works with JWT under new storage semantics.
  C. Full booking lifecycle regression (customer -> mechanic accept/start/complete/rate).
  D. Notifications inbox + unread count still work.
  E. Stripe checkout URL still generated.
  F. POST /api/auth/logout returns 200 (and is a no-op for a bare JWT token).
  G. MongoDB indexes on user_sessions exist (session_token unique + expires_at TTL).
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

# ----------------------- fixtures ----------------------- #

@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "customer@hmc.app", "password": "customer123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]

@pytest.fixture(scope="module")
def mechanic_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "mechanic1@hmc.app", "password": "ravi123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "admin@hmc.app", "password": "admin123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def hdr(tok): return {"Authorization": f"Bearer {tok}"}

# ----------------------- A. Emergent OAuth contract ----------------------- #

class TestGoogleSessionContract:
    def test_bogus_session_id_returns_401(self):
        r = requests.post(f"{BASE_URL}/api/auth/session",
                          json={"session_id": f"TEST_bogus_{uuid.uuid4().hex}"}, timeout=20)
        assert r.status_code == 401, f"Expected 401 for bogus session_id, got {r.status_code}: {r.text}"

    def test_missing_field_returns_422(self):
        # Sending {session_token: ...} (wrong key) -> should be 422 missing field
        r = requests.post(f"{BASE_URL}/api/auth/session",
                          json={"session_token": "whatever"}, timeout=15)
        assert r.status_code == 422, f"Expected 422 for missing session_id, got {r.status_code}: {r.text}"

    def test_empty_body_returns_422(self):
        r = requests.post(f"{BASE_URL}/api/auth/session", json={}, timeout=15)
        assert r.status_code == 422

# ----------------------- B. Legacy JWT still works ----------------------- #

class TestLegacyAuth:
    def test_customer_login_returns_jwt_and_user(self, customer_token):
        assert customer_token and len(customer_token) > 20

    def test_me_with_legacy_jwt(self, customer_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=hdr(customer_token), timeout=15)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == "customer@hmc.app"
        assert u["role"] == "customer"
        # New optional fields must be present in the response model
        assert "picture" in u
        assert "google_linked" in u
        assert u["google_linked"] is False

    def test_me_with_bad_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": "Bearer not-a-real-token"}, timeout=15)
        assert r.status_code == 401

    def test_mechanic_login(self, mechanic_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=hdr(mechanic_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "mechanic"

    def test_admin_login(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=hdr(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

# ----------------------- C. Booking lifecycle regression ----------------------- #

class TestBookingLifecycle:
    def test_full_lifecycle(self, customer_token, mechanic_token):
        # create
        r = requests.post(f"{BASE_URL}/api/bookings", headers=hdr(customer_token), json={
            "breakdown_category": "flat_tyre", "vehicle_type": "car",
            "description": "TEST_iter7", "lat": 19.076, "lng": 72.8777, "address": "Mumbai TEST",
        }, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        bid = b["id"]
        assert b["status"] == "requested"
        assert b["price"] == 350.0

        # accept
        r = requests.post(f"{BASE_URL}/api/bookings/{bid}/accept", headers=hdr(mechanic_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "accepted"

        # start
        r = requests.post(f"{BASE_URL}/api/bookings/{bid}/start", headers=hdr(mechanic_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "in_progress"

        # otp for completion
        r = requests.get(f"{BASE_URL}/api/bookings/{bid}", headers=hdr(customer_token), timeout=15)
        otp = r.json()["otp"]
        assert otp

        # complete
        r = requests.post(f"{BASE_URL}/api/bookings/{bid}/complete",
                         headers=hdr(mechanic_token), json={"otp": otp}, timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "completed"

        # rate
        r = requests.post(f"{BASE_URL}/api/bookings/{bid}/rate",
                         headers=hdr(customer_token), json={"rating": 5, "review": "TEST_iter7"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["rating"] == 5

        # GET verify persistence
        r = requests.get(f"{BASE_URL}/api/bookings/{bid}", headers=hdr(customer_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "completed"
        assert r.json()["rating"] == 5

# ----------------------- D. Notifications ----------------------- #

class TestNotifications:
    def test_inbox(self, customer_token):
        r = requests.get(f"{BASE_URL}/api/notifications", headers=hdr(customer_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_unread_count(self, customer_token):
        r = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=hdr(customer_token), timeout=15)
        assert r.status_code == 200
        assert "count" in r.json()
        assert isinstance(r.json()["count"], int)

    def test_unauthenticated_401(self):
        r = requests.get(f"{BASE_URL}/api/notifications", timeout=15)
        assert r.status_code == 401

# ----------------------- E. Stripe checkout ----------------------- #

class TestStripe:
    def test_create_checkout_session(self, customer_token):
        # create a booking to pay for
        rb = requests.post(f"{BASE_URL}/api/bookings", headers=hdr(customer_token), json={
            "breakdown_category": "battery_dead", "vehicle_type": "car",
            "description": "TEST_iter7_stripe", "lat": 19.076, "lng": 72.8777, "address": "TEST",
        }, timeout=15)
        assert rb.status_code == 200
        bid = rb.json()["id"]

        r = requests.post(f"{BASE_URL}/api/payments/checkout/session",
                         headers=hdr(customer_token),
                         json={"booking_id": bid, "origin_url": BASE_URL}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("url", "").startswith("https://")
        assert body.get("session_id")

# ----------------------- F. Logout ----------------------- #

class TestLogout:
    def test_logout_with_legacy_jwt_is_noop_200(self, customer_token):
        r = requests.post(f"{BASE_URL}/api/auth/logout", headers=hdr(customer_token), timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # Confirm legacy JWT still works after "logout" (session store had nothing to delete)
        r2 = requests.get(f"{BASE_URL}/api/auth/me", headers=hdr(customer_token), timeout=15)
        assert r2.status_code == 200

    def test_logout_without_auth_still_200(self):
        r = requests.post(f"{BASE_URL}/api/auth/logout", timeout=15)
        assert r.status_code == 200

# ----------------------- G. Mongo indexes ----------------------- #

class TestMongoIndexes:
    def test_user_sessions_indexes(self):
        try:
            from pymongo import MongoClient
        except ImportError:
            pytest.skip("pymongo not available")
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "hmc_database")
        c = MongoClient(mongo_url, serverSelectionTimeoutMS=3000)
        try:
            idx = c[db_name].user_sessions.index_information()
        except Exception as e:
            pytest.skip(f"Cannot inspect Mongo directly: {e}")
        # session_token must be unique
        st = [v for k, v in idx.items() if any(f[0] == "session_token" for f in v.get("key", []))]
        assert st, f"session_token index missing: {list(idx.keys())}"
        assert any(v.get("unique") for v in st), "session_token index not unique"
        # expires_at TTL
        exp = [v for k, v in idx.items() if any(f[0] == "expires_at" for f in v.get("key", []))]
        assert exp, "expires_at TTL index missing"
        assert any("expireAfterSeconds" in v for v in exp), "expires_at index has no TTL"

    def test_users_email_unique(self):
        try:
            from pymongo import MongoClient
        except ImportError:
            pytest.skip("pymongo not available")
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "hmc_database")
        c = MongoClient(mongo_url, serverSelectionTimeoutMS=3000)
        try:
            idx = c[db_name].users.index_information()
        except Exception as e:
            pytest.skip(f"Cannot inspect Mongo directly: {e}")
        em = [v for k, v in idx.items() if any(f[0] == "email" for f in v.get("key", []))]
        assert em and any(v.get("unique") for v in em), f"users.email unique missing: {idx}"
