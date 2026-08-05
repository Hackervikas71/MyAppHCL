"""Iteration 8 backend tests:
- Wallet top-up via Stripe (presets only, roles gated)
- Profile picture upload validation
- Emergency contacts CRUD (users.emergency_contacts)
- Saved vehicles CRUD (users.vehicles)
- Booking payment regression (kind='booking' in status endpoint)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"
API = f"{BASE_URL}/api"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    j = r.json()
    return j.get("access_token") or j.get("token")


@pytest.fixture(scope="module")
def customer_token():
    return _login("customer@hmc.app", "customer123")


@pytest.fixture(scope="module")
def mechanic_token():
    return _login("mechanic1@hmc.app", "ravi123")


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------------- Wallet top-up ---------------------- #
class TestWalletTopUp:
    def test_topup_valid_preset_500(self, customer_token):
        r = requests.post(f"{API}/wallet/topup", headers=_h(customer_token),
                          json={"amount": 500, "origin_url": "https://mechanic-connect-116.preview.emergentagent.com"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and data["url"].startswith("https://checkout.stripe.com"), data
        assert "session_id" in data and data["session_id"]

    def test_topup_invalid_amount_750(self, customer_token):
        r = requests.post(f"{API}/wallet/topup", headers=_h(customer_token),
                          json={"amount": 750, "origin_url": "https://x.example"}, timeout=15)
        assert r.status_code == 400, r.text

    def test_topup_unauthenticated(self):
        r = requests.post(f"{API}/wallet/topup", json={"amount": 500, "origin_url": "https://x"}, timeout=15)
        assert r.status_code in (401, 403), r.status_code

    def test_topup_non_customer_403(self, mechanic_token):
        r = requests.post(f"{API}/wallet/topup", headers=_h(mechanic_token),
                          json={"amount": 500, "origin_url": "https://x"}, timeout=15)
        assert r.status_code == 403, r.text


# ---------------------- Profile picture ---------------------- #
class TestPicture:
    def test_valid_png_data_url(self, customer_token):
        tiny_png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        r = requests.post(f"{API}/auth/picture", headers=_h(customer_token),
                          json={"picture_base64": tiny_png}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("picture") == tiny_png
        assert data.get("email") == "customer@hmc.app"

    def test_invalid_prefix_400(self, customer_token):
        r = requests.post(f"{API}/auth/picture", headers=_h(customer_token),
                          json={"picture_base64": "notadataurl"}, timeout=15)
        assert r.status_code == 400, r.text

    def test_oversize_400(self, customer_token):
        big = "data:image/png;base64," + ("A" * 2_600_000)
        r = requests.post(f"{API}/auth/picture", headers=_h(customer_token),
                          json={"picture_base64": big}, timeout=30)
        assert r.status_code == 400, r.status_code


# ---------------------- Emergency contacts ---------------------- #
class TestContacts:
    _created_id = None

    def test_add_and_get(self, customer_token):
        r = requests.post(f"{API}/profile/contacts", headers=_h(customer_token),
                          json={"name": "TEST_Wife", "phone": "9876500000", "relation": "Spouse"}, timeout=15)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["name"] == "TEST_Wife" and c["phone"] == "9876500000" and c["relation"] == "Spouse"
        assert "id" in c and c["id"]
        TestContacts._created_id = c["id"]

        g = requests.get(f"{API}/profile/contacts", headers=_h(customer_token), timeout=15)
        assert g.status_code == 200
        ids = [x["id"] for x in g.json().get("contacts", [])]
        assert c["id"] in ids

    def test_missing_name_400(self, customer_token):
        r = requests.post(f"{API}/profile/contacts", headers=_h(customer_token),
                          json={"name": "  ", "phone": "9876500000"}, timeout=15)
        assert r.status_code == 400, r.text

    def test_delete_persists(self, customer_token):
        cid = TestContacts._created_id
        assert cid, "create test must run first"
        d = requests.delete(f"{API}/profile/contacts/{cid}", headers=_h(customer_token), timeout=15)
        assert d.status_code == 200
        g = requests.get(f"{API}/profile/contacts", headers=_h(customer_token), timeout=15)
        ids = [x["id"] for x in g.json().get("contacts", [])]
        assert cid not in ids


# ---------------------- Saved vehicles ---------------------- #
class TestVehicles:
    _created_id = None

    def test_add_and_get(self, customer_token):
        r = requests.post(f"{API}/profile/vehicles", headers=_h(customer_token),
                          json={"vehicle_type": "bike", "make": "TEST_Honda", "model": "Activa", "plate": "mh01ab1234"}, timeout=15)
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["vehicle_type"] == "bike" and v["make"] == "TEST_Honda" and v["model"] == "Activa"
        assert v["plate"] == "MH01AB1234"  # uppercased
        TestVehicles._created_id = v["id"]

        g = requests.get(f"{API}/profile/vehicles", headers=_h(customer_token), timeout=15)
        assert g.status_code == 200
        ids = [x["id"] for x in g.json().get("vehicles", [])]
        assert v["id"] in ids

    def test_missing_make_400(self, customer_token):
        r = requests.post(f"{API}/profile/vehicles", headers=_h(customer_token),
                          json={"vehicle_type": "bike", "make": "  ", "model": "Activa"}, timeout=15)
        assert r.status_code == 400, r.text

    def test_delete_persists(self, customer_token):
        vid = TestVehicles._created_id
        assert vid, "create test must run first"
        d = requests.delete(f"{API}/profile/vehicles/{vid}", headers=_h(customer_token), timeout=15)
        assert d.status_code == 200
        g = requests.get(f"{API}/profile/vehicles", headers=_h(customer_token), timeout=15)
        ids = [x["id"] for x in g.json().get("vehicles", [])]
        assert vid not in ids


# ---------------------- Booking payment regression ---------------------- #
class TestBookingPaymentRegression:
    def test_full_booking_checkout_kind(self, customer_token):
        # create a booking
        body = {
            "category": "roadside", "breakdown_category": "flat_tyre",
            "vehicle_type": "car",
            "description": "TEST_iter8 booking regression",
            "lat": 19.07, "lng": 72.87, "address": "TEST",
            "urgency": "normal",
        }
        r = requests.post(f"{API}/bookings", headers=_h(customer_token), json=body, timeout=15)
        assert r.status_code == 200, r.text
        booking = r.json()
        bid = booking["id"]

        # start checkout
        c = requests.post(f"{API}/payments/checkout/session", headers=_h(customer_token),
                          json={"booking_id": bid, "origin_url": "https://x.example"}, timeout=30)
        assert c.status_code == 200, c.text
        cj = c.json()
        assert cj["url"].startswith("https://checkout.stripe.com")
        sid = cj["session_id"]

        # status endpoint returns kind=booking
        s = requests.get(f"{API}/payments/checkout/status/{sid}", headers=_h(customer_token), timeout=30)
        assert s.status_code == 200, s.text
        sj = s.json()
        assert sj.get("kind") == "booking"
        assert sj.get("booking_id") == bid
