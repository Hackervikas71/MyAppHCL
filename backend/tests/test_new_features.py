"""HMC New Feature Tests - Live Location + Stripe Payments"""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://mechanic-connect-116.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"
ORIGIN = BASE_URL

CUST = {"email": "customer@hmc.app", "password": "customer123"}
MECH = {"email": "mechanic1@hmc.app", "password": "ravi123"}

session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

state = {}


def _login(creds):
    r = session.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _hdr(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


# ---------------- LOCATION ----------------
class TestLiveLocation:
    def test_login_and_update_location(self):
        d = _login(CUST)
        state["cust_token"] = d["access_token"]
        state["cust_id"] = d["user"]["id"]
        r = session.post(
            f"{API}/auth/location",
            json={"lat": 19.0800, "lng": 72.8800},
            headers=_hdr(state["cust_token"]),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_me_reflects_updated_location(self):
        r = session.get(f"{API}/auth/me", headers=_hdr(state["cust_token"]), timeout=15)
        assert r.status_code == 200
        me = r.json()
        # location field may exist on user model
        loc = me.get("location")
        assert loc is not None, "location should be persisted after /auth/location"
        assert abs(loc["lat"] - 19.08) < 0.01
        assert abs(loc["lng"] - 72.88) < 0.01

    def test_location_requires_auth(self):
        r = session.post(f"{API}/auth/location", json={"lat": 1, "lng": 2}, timeout=15)
        assert r.status_code in (401, 403)


# ---------------- STRIPE PAYMENTS ----------------
class TestStripeCheckout:
    """Full flow: create booking → accept → start → complete → checkout session → status."""

    def test_setup_completed_booking(self):
        # Login customer + mechanic
        c = _login(CUST)
        m = _login(MECH)
        state["cust_token"] = c["access_token"]
        state["mech_token"] = m["access_token"]

        # Create booking
        payload = {"breakdown_category": "flat_tyre", "vehicle_type": "car",
                   "description": "TEST stripe", "lat": 19.076, "lng": 72.8777,
                   "address": "TEST"}
        r = session.post(f"{API}/bookings", json=payload,
                         headers=_hdr(state["cust_token"]), timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        state["booking_id"] = b["id"]
        state["otp"] = b["otp"]
        state["price"] = b["price"]

        # Accept, start, complete
        r = session.post(f"{API}/bookings/{b['id']}/accept",
                        headers=_hdr(state["mech_token"]), timeout=15)
        assert r.status_code == 200
        r = session.post(f"{API}/bookings/{b['id']}/start",
                        headers=_hdr(state["mech_token"]), timeout=15)
        assert r.status_code == 200
        r = session.post(f"{API}/bookings/{b['id']}/complete",
                        json={"otp": state["otp"]},
                        headers=_hdr(state["mech_token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "completed"

    def test_create_checkout_session(self):
        payload = {"booking_id": state["booking_id"], "origin_url": ORIGIN}
        r = session.post(f"{API}/payments/checkout/session", json=payload,
                        headers=_hdr(state["cust_token"]), timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "url" in j and "session_id" in j
        assert j["url"].startswith("https://checkout.stripe.com"), f"URL prefix: {j['url'][:60]}"
        assert isinstance(j["session_id"], str) and len(j["session_id"]) > 5
        state["session_id"] = j["session_id"]
        state["checkout_url"] = j["url"]

    def test_checkout_status_unpaid(self):
        r = session.get(f"{API}/payments/checkout/status/{state['session_id']}",
                       headers=_hdr(state["cust_token"]), timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ["payment_status", "status", "amount_total", "currency", "booking_id"]:
            assert k in j, f"missing key {k}"
        # Unpaid: should NOT be 'paid' yet (initiated/open/unpaid)
        assert j["payment_status"] != "paid"
        assert j["booking_id"] == state["booking_id"]
        assert j["currency"] == "inr"
        # amount_total may be in paisa (int) or ₹ float; just verify present
        assert j["amount_total"] is not None

    def test_create_checkout_requires_customer_role(self):
        # Mechanic cannot create checkout
        payload = {"booking_id": state["booking_id"], "origin_url": ORIGIN}
        r = session.post(f"{API}/payments/checkout/session", json=payload,
                        headers=_hdr(state["mech_token"]), timeout=15)
        assert r.status_code == 403

    def test_create_checkout_invalid_booking(self):
        payload = {"booking_id": "nonexistent-" + uuid.uuid4().hex, "origin_url": ORIGIN}
        r = session.post(f"{API}/payments/checkout/session", json=payload,
                        headers=_hdr(state["cust_token"]), timeout=15)
        assert r.status_code == 404

    def test_status_unknown_session(self):
        r = session.get(f"{API}/payments/checkout/status/sess_unknown_xyz",
                       headers=_hdr(state["cust_token"]), timeout=15)
        assert r.status_code == 404
