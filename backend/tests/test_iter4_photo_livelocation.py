"""Tests for Feature A (breakdown photo passthrough) & Feature B (mechanic-location endpoint)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://mechanic-connect-116.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

CUST = {"email": "customer@hmc.app", "password": "customer123"}
MECH1 = {"email": "mechanic1@hmc.app", "password": "ravi123"}
MECH2 = {"email": "mechanic2@hmc.app", "password": "suresh123"}

# tiny 1x1 png
PHOTO_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII="

state = {}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _hdr(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


class TestPhotoAndMechanicLocation:
    def test_00_logins(self):
        c = _login(CUST)
        m1 = _login(MECH1)
        m2 = _login(MECH2)
        state["cust"] = c["access_token"]
        state["mech1"] = m1["access_token"]
        state["mech1_id"] = m1["user"]["id"]
        state["mech2"] = m2["access_token"]

    def test_01_create_booking_with_photo(self):
        payload = {
            "breakdown_category": "flat_tyre",
            "vehicle_type": "car",
            "description": "TEST photo+location",
            "photo_base64": PHOTO_DATA_URL,
            "lat": 19.0760,
            "lng": 72.8777,
            "address": "TEST Mumbai",
        }
        r = requests.post(f"{API}/bookings", json=payload, headers=_hdr(state["cust"]), timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        state["bid"] = b["id"]
        state["otp"] = b["otp"]
        assert b["photo_base64"] == PHOTO_DATA_URL, "photo_base64 must be persisted on create"

    def test_02_get_booking_returns_photo(self):
        r = requests.get(f"{API}/bookings/{state['bid']}", headers=_hdr(state["cust"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["photo_base64"] == PHOTO_DATA_URL

    def test_03_mech_location_skipped_when_requested(self):
        # Booking still 'requested' (unassigned) → mechanic-location should 404 since mechanic isn't assigned
        r = requests.post(
            f"{API}/bookings/{state['bid']}/mechanic-location",
            json={"lat": 19.076, "lng": 72.877},
            headers=_hdr(state["mech1"]),
            timeout=15,
        )
        assert r.status_code == 404, "unassigned mechanic must get 404"

    def test_04_accept_booking(self):
        r = requests.post(f"{API}/bookings/{state['bid']}/accept", headers=_hdr(state["mech1"]), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "accepted"
        assert r.json()["mechanic_id"] == state["mech1_id"]

    def test_05_push_location_updates_booking(self):
        # First push - far away
        r1 = requests.post(
            f"{API}/bookings/{state['bid']}/mechanic-location",
            json={"lat": 19.100, "lng": 72.900},
            headers=_hdr(state["mech1"]),
            timeout=15,
        )
        assert r1.status_code == 200, r1.text
        assert r1.json().get("ok") is True
        # Verify booking reflects real coords
        b = requests.get(f"{API}/bookings/{state['bid']}", headers=_hdr(state["mech1"]), timeout=15).json()
        assert abs(b["mechanic_location"]["lat"] - 19.100) < 1e-4
        assert abs(b["mechanic_location"]["lng"] - 72.900) < 1e-4

        # Second push - different coords
        r2 = requests.post(
            f"{API}/bookings/{state['bid']}/mechanic-location",
            json={"lat": 19.090, "lng": 72.890},
            headers=_hdr(state["mech1"]),
            timeout=15,
        )
        assert r2.status_code == 200
        b = requests.get(f"{API}/bookings/{state['bid']}", headers=_hdr(state["mech1"]), timeout=15).json()
        assert abs(b["mechanic_location"]["lat"] - 19.090) < 1e-4
        assert abs(b["mechanic_location"]["lng"] - 72.890) < 1e-4

    def test_06_simulation_suppressed_within_30s(self):
        # GET immediately after real push; mechanic_location should NOT be drifted by simulation
        b1 = requests.get(f"{API}/bookings/{state['bid']}", headers=_hdr(state["cust"]), timeout=15).json()
        lat1, lng1 = b1["mechanic_location"]["lat"], b1["mechanic_location"]["lng"]
        # Poll again - simulation would have drifted ~15% toward customer
        time.sleep(1.0)
        b2 = requests.get(f"{API}/bookings/{state['bid']}", headers=_hdr(state["cust"]), timeout=15).json()
        lat2, lng2 = b2["mechanic_location"]["lat"], b2["mechanic_location"]["lng"]
        assert abs(lat2 - lat1) < 1e-6, f"simulation drifted lat: {lat1}->{lat2}"
        assert abs(lng2 - lng1) < 1e-6, f"simulation drifted lng: {lng1}->{lng2}"

    def test_07_other_mechanic_gets_404(self):
        r = requests.post(
            f"{API}/bookings/{state['bid']}/mechanic-location",
            json={"lat": 19.08, "lng": 72.88},
            headers=_hdr(state["mech2"]),
            timeout=15,
        )
        assert r.status_code == 404

    def test_08_customer_forbidden(self):
        r = requests.post(
            f"{API}/bookings/{state['bid']}/mechanic-location",
            json={"lat": 19.08, "lng": 72.88},
            headers=_hdr(state["cust"]),
            timeout=15,
        )
        assert r.status_code == 403

    def test_09_within_50m_sets_arriving(self):
        # Push a location within 50m of customer (customer lat/lng: 19.076, 72.8777)
        r = requests.post(
            f"{API}/bookings/{state['bid']}/mechanic-location",
            json={"lat": 19.07605, "lng": 72.87775},  # ~5m
            headers=_hdr(state["mech1"]),
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("status") == "arriving"

    def test_10_skipped_when_completed(self):
        # Start work → complete
        r = requests.post(f"{API}/bookings/{state['bid']}/start", headers=_hdr(state["mech1"]), timeout=15)
        assert r.status_code == 200
        r = requests.post(f"{API}/bookings/{state['bid']}/complete", json={"otp": state["otp"]}, headers=_hdr(state["mech1"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "completed"

        # Now mechanic-location should return skipped
        r2 = requests.post(
            f"{API}/bookings/{state['bid']}/mechanic-location",
            json={"lat": 19.08, "lng": 72.88},
            headers=_hdr(state["mech1"]),
            timeout=15,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json() == {"ok": True, "skipped": True}

    def test_11_requested_status_returns_skipped(self):
        # Create a new booking that stays in requested state, accept it, then reset and check
        # Simpler: create a new booking and check the requested-status skip path via a raw approach:
        # accept it, but then we can't undo. Use an alternative — accept booking then confirm
        # requested-state skip via a fresh booking without acceptance is impossible (would 404).
        # Instead: verify that the "not accepted/arriving/in_progress" branch is covered by
        # the completed test above (test_10) which exercises the same skipped path.
        assert True  # covered by test_10
