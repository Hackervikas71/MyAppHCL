"""HMC Backend API Tests - Auth, Bookings, AI, SOS, Admin"""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://mechanic-connect-116.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

CUST = {"email": "customer@hmc.app", "password": "customer123"}
MECH = {"email": "mechanic1@hmc.app", "password": "ravi123"}
ADMIN = {"email": "admin@hmc.app", "password": "admin123"}

session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

# Shared state across tests
state = {}


def _login(creds):
    r = session.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "user" in data
    return data


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- AUTH ----------------
class TestAuth:
    def test_root(self):
        r = session.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_login_customer(self):
        d = _login(CUST)
        state["cust_token"] = d["access_token"]
        state["cust_id"] = d["user"]["id"]
        assert d["user"]["role"] == "customer"

    def test_login_mechanic(self):
        d = _login(MECH)
        state["mech_token"] = d["access_token"]
        state["mech_id"] = d["user"]["id"]
        assert d["user"]["role"] == "mechanic"

    def test_login_admin(self):
        d = _login(ADMIN)
        state["admin_token"] = d["access_token"]
        assert d["user"]["role"] == "admin"

    def test_login_invalid(self):
        r = session.post(f"{API}/auth/login", json={"email": "x@x.com", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me(self):
        r = session.get(f"{API}/auth/me", headers=_hdr(state["cust_token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == CUST["email"]

    def test_register_customer(self):
        email = f"TEST_cust_{uuid.uuid4().hex[:8]}@hmc.app"
        payload = {"name": "TEST Cust", "email": email, "phone": "9000000001", "password": "pass123", "role": "customer"}
        r = session.post(f"{API}/auth/register", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["user"]["email"] == email
        assert j["user"]["is_verified"] is True

    def test_register_mechanic(self):
        email = f"TEST_mech_{uuid.uuid4().hex[:8]}@hmc.app"
        payload = {"name": "TEST Mech", "email": email, "phone": "9000000002", "password": "pass123", "role": "mechanic", "category": "general_mechanic"}
        r = session.post(f"{API}/auth/register", json=payload, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["is_verified"] is False  # mechanic pending approval

    def test_register_duplicate(self):
        r = session.post(f"{API}/auth/register", json={"name": "dup", "email": CUST["email"], "phone": "1", "password": "x", "role": "customer"}, timeout=15)
        assert r.status_code == 400


# ---------------- MECHANICS ----------------
class TestMechanics:
    def test_nearby(self):
        r = session.get(f"{API}/mechanics/nearby?lat=19.076&lng=72.8777&radius_km=20", headers=_hdr(state["cust_token"]), timeout=15)
        assert r.status_code == 200
        mechs = r.json().get("mechanics", [])
        assert len(mechs) >= 5, f"Expected >=5 mechanics, got {len(mechs)}"
        assert all("lat" in m and "lng" in m and "distance_km" in m for m in mechs)


# ---------------- BOOKING FLOW ----------------
class TestBookingFlow:
    def test_create_booking(self):
        payload = {"breakdown_category": "flat_tyre", "vehicle_type": "car", "description": "TEST tyre puncture", "lat": 19.076, "lng": 72.8777, "address": "TEST Highway"}
        r = session.post(f"{API}/bookings", json=payload, headers=_hdr(state["cust_token"]), timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["status"] == "requested"
        assert b["breakdown_category"] == "flat_tyre"
        assert b["price"] == 350.0
        assert b.get("otp") and len(b["otp"]) == 4
        state["booking_id"] = b["id"]
        state["otp"] = b["otp"]

    def test_list_bookings(self):
        r = session.get(f"{API}/bookings", headers=_hdr(state["cust_token"]), timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert any(b["id"] == state["booking_id"] for b in arr)

    def test_mechanic_accept(self):
        r = session.post(f"{API}/bookings/{state['booking_id']}/accept", headers=_hdr(state["mech_token"]), timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["status"] == "accepted"
        assert b["mechanic_id"] == state["mech_id"]

    def test_mechanic_start(self):
        r = session.post(f"{API}/bookings/{state['booking_id']}/start", headers=_hdr(state["mech_token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "in_progress"

    def test_get_booking_returns_otp_to_customer(self):
        r = session.get(f"{API}/bookings/{state['booking_id']}", headers=_hdr(state["cust_token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["otp"] == state["otp"]

    def test_complete_wrong_otp(self):
        r = session.post(f"{API}/bookings/{state['booking_id']}/complete", json={"otp": "0000"}, headers=_hdr(state["mech_token"]), timeout=15)
        # If seeded otp coincidentally 0000 skip
        if state["otp"] != "0000":
            assert r.status_code == 400

    def test_complete_correct_otp(self):
        r = session.post(f"{API}/bookings/{state['booking_id']}/complete", json={"otp": state["otp"]}, headers=_hdr(state["mech_token"]), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "completed"

    def test_rate_booking(self):
        r = session.post(f"{API}/bookings/{state['booking_id']}/rate", json={"rating": 5, "review": "TEST great"}, headers=_hdr(state["cust_token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["rating"] == 5


# ---------------- AI ----------------
class TestAI:
    def test_ai_chat_sync(self):
        r = session.post(f"{API}/ai/chat-sync", json={"message": "battery seems dead, what should I do?"}, headers=_hdr(state["cust_token"]), timeout=90)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "reply" in j and len(j["reply"]) > 10
        assert "session_id" in j


# ---------------- SOS ----------------
class TestSOS:
    def test_sos(self):
        r = session.post(f"{API}/sos", json={"lat": 19.076, "lng": 72.8777, "message": "TEST SOS"}, headers=_hdr(state["cust_token"]), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["ok"] is True
        assert len(j["helplines"]) >= 3


# ---------------- ADMIN ----------------
class TestAdmin:
    def test_admin_stats(self):
        r = session.get(f"{API}/admin/stats", headers=_hdr(state["admin_token"]), timeout=15)
        assert r.status_code == 200
        j = r.json()
        for k in ["customers", "mechanics", "bookings", "completed_bookings", "revenue"]:
            assert k in j

    def test_admin_list_mechanics(self):
        r = session.get(f"{API}/admin/mechanics", headers=_hdr(state["admin_token"]), timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 5
        state["some_mech_id"] = arr[0]["id"]

    def test_admin_approve_mechanic(self):
        r = session.post(f"{API}/admin/mechanics/{state['some_mech_id']}/approve", headers=_hdr(state["admin_token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_admin_stats_forbidden_for_customer(self):
        r = session.get(f"{API}/admin/stats", headers=_hdr(state["cust_token"]), timeout=15)
        assert r.status_code == 403
