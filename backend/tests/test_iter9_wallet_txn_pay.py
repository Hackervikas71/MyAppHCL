"""Iteration 9 — Wallet transactions feed + Pay-from-wallet flow (Arvik)."""
import os
import uuid
import time
import pytest
import requests
from pymongo import MongoClient

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or "https://mechanic-connect-116.preview.emergentagent.com"
API = f"{BASE}/api"

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "hmc_database"

CUSTOMER = {"email": "customer@hmc.app", "password": "customer123"}
MECH1 = {"email": "mechanic1@hmc.app", "password": "ravi123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def db():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture(scope="module")
def customer_ctx(db):
    """Reset the seeded customer wallet to 500 before running the module."""
    tok, u = _login(CUSTOMER)
    db.users.update_one({"id": u["id"]}, {"$set": {"wallet_balance": 500.0}})
    # cleanup previous test topups
    db.payments.delete_many({"user_id": u["id"], "kind": "wallet_topup", "amount": 1000, "status": "paid"})
    return {"token": tok, "user": u}


@pytest.fixture(scope="module")
def mech_ctx():
    tok, u = _login(MECH1)
    return {"token": tok, "user": u}


def _create_booking(tok, category, lat=19.075, lng=72.877):
    body = {
        "breakdown_category": category,
        "vehicle_type": "car",
        "description": f"TEST_iter9 {category}",
        "lat": lat, "lng": lng, "address": "TEST_iter9",
        "urgency": "normal",
    }
    r = requests.post(f"{API}/bookings", headers=_h(tok), json=body, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()


def _complete_flow(customer_tok, mech_tok, booking):
    bid = booking["id"]
    # accept
    r = requests.post(f"{API}/bookings/{bid}/accept", headers=_h(mech_tok), timeout=30)
    assert r.status_code == 200, r.text
    # start
    r = requests.post(f"{API}/bookings/{bid}/start", headers=_h(mech_tok), timeout=30)
    assert r.status_code == 200, r.text
    # fetch OTP as customer
    r = requests.get(f"{API}/bookings/{bid}", headers=_h(customer_tok), timeout=30)
    assert r.status_code == 200
    otp = r.json()["otp"]
    # complete
    r = requests.post(f"{API}/bookings/{bid}/complete", headers=_h(mech_tok), json={"otp": otp}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------------------
# TEST 1 & 2: pay-wallet happy path + balance + wallet_transactions debit row
# ---------------------------------------------------------------------------
class TestPayFromWalletHappyPath:
    def test_full_flow_pay_from_wallet(self, customer_ctx, mech_ctx, db):
        c_tok = customer_ctx["token"]
        m_tok = mech_ctx["token"]

        # Fresh reset
        db.users.update_one({"id": customer_ctx["user"]["id"]}, {"$set": {"wallet_balance": 500.0}})

        b = _create_booking(c_tok, "flat_tyre")
        assert b["price"] == 350, f"flat_tyre should be ₹350, got {b['price']}"
        completed = _complete_flow(c_tok, m_tok, b)
        assert completed["status"] == "completed"

        # pay from wallet
        r = requests.post(f"{API}/bookings/{b['id']}/pay-wallet", headers=_h(c_tok), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["payment_status"] == "paid"

        # balance should be 150
        r = requests.get(f"{API}/auth/me", headers=_h(c_tok), timeout=30)
        assert r.status_code == 200
        assert r.json()["wallet_balance"] == 150.0, r.json()

        # wallet_transactions has booking_wallet debit ₹350
        r = requests.get(f"{API}/wallet/transactions", headers=_h(c_tok), timeout=30)
        assert r.status_code == 200
        txns = r.json()["transactions"]
        match = [t for t in txns if t["kind"] == "booking_wallet" and t["amount"] == 350 and t["direction"] == "debit"]
        assert match, f"No booking_wallet debit of 350 found. Got: {[(t['kind'], t['amount']) for t in txns]}"
        assert "flat" in match[0]["label"].lower() or "tyre" in match[0]["label"].lower()

    def test_already_paid_returns_400(self, customer_ctx, mech_ctx, db):
        # use booking from previous test — find latest paid flat_tyre
        b_doc = db.bookings.find_one(
            {"customer_id": customer_ctx["user"]["id"], "breakdown_category": "flat_tyre", "payment_status": "paid"},
            sort=[("created_at", -1)],
        )
        assert b_doc, "Previous test booking not found"
        r = requests.post(f"{API}/bookings/{b_doc['id']}/pay-wallet", headers=_h(customer_ctx["token"]), timeout=30)
        assert r.status_code == 400
        assert "already paid" in r.text.lower(), r.text


# ---------------------------------------------------------------------------
# TEST 3: booking not completed
# ---------------------------------------------------------------------------
class TestPayWalletValidation:
    def test_pay_wallet_on_accepted_booking_400(self, customer_ctx, mech_ctx):
        c_tok = customer_ctx["token"]
        b = _create_booking(c_tok, "flat_tyre")
        # accept only
        r = requests.post(f"{API}/bookings/{b['id']}/accept", headers=_h(mech_ctx["token"]), timeout=30)
        assert r.status_code == 200

        r = requests.post(f"{API}/bookings/{b['id']}/pay-wallet", headers=_h(c_tok), timeout=30)
        assert r.status_code == 400
        assert "completed" in r.text.lower(), r.text

    def test_insufficient_balance_400(self, customer_ctx, mech_ctx, db):
        c_tok = customer_ctx["token"]
        m_tok = mech_ctx["token"]
        # Balance is 150 (left over from test 1). Create engine_failure (₹1200).
        b = _create_booking(c_tok, "engine_failure")
        assert b["price"] == 1200
        _complete_flow(c_tok, m_tok, b)

        me = requests.get(f"{API}/auth/me", headers=_h(c_tok), timeout=30).json()
        bal_before = me["wallet_balance"]

        r = requests.post(f"{API}/bookings/{b['id']}/pay-wallet", headers=_h(c_tok), timeout=30)
        assert r.status_code == 400
        assert "insufficient" in r.text.lower(), r.text

        me2 = requests.get(f"{API}/auth/me", headers=_h(c_tok), timeout=30).json()
        assert me2["wallet_balance"] == bal_before, "Balance must be untouched on failure"


# ---------------------------------------------------------------------------
# TEST 4: authz — 404 for other customer, 403 for mechanic, 401/403 for anon
# ---------------------------------------------------------------------------
class TestPayWalletAuth:
    def test_404_when_not_owner(self, customer_ctx, mech_ctx, db):
        # Create another customer directly
        other_email = f"TEST_other_{uuid.uuid4().hex[:8]}@hmc.app"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST_other", "email": other_email, "phone": "9990000001",
            "password": "otherpass1", "role": "customer",
        }, timeout=30)
        assert r.status_code in (200, 201), r.text
        other_tok = r.json()["access_token"]

        # Use one of customer's existing bookings
        b_doc = db.bookings.find_one({"customer_id": customer_ctx["user"]["id"]}, sort=[("created_at", -1)])
        assert b_doc
        r = requests.post(f"{API}/bookings/{b_doc['id']}/pay-wallet", headers=_h(other_tok), timeout=30)
        assert r.status_code == 404, r.text

        db.users.delete_one({"email": other_email})

    def test_403_for_mechanic(self, customer_ctx, mech_ctx, db):
        b_doc = db.bookings.find_one({"customer_id": customer_ctx["user"]["id"]}, sort=[("created_at", -1)])
        r = requests.post(f"{API}/bookings/{b_doc['id']}/pay-wallet", headers=_h(mech_ctx["token"]), timeout=30)
        assert r.status_code == 403, r.text

    def test_unauth_401_or_403(self, db, customer_ctx):
        b_doc = db.bookings.find_one({"customer_id": customer_ctx["user"]["id"]}, sort=[("created_at", -1)])
        r = requests.post(f"{API}/bookings/{b_doc['id']}/pay-wallet", timeout=30)
        assert r.status_code in (401, 403), r.text


# ---------------------------------------------------------------------------
# TEST 5: wallet_transactions credit row from topup
# ---------------------------------------------------------------------------
class TestWalletTransactionsCredit:
    def test_inserted_topup_shows_as_credit(self, customer_ctx, db):
        c_tok = customer_ctx["token"]
        uid = customer_ctx["user"]["id"]
        # Insert fake topup row directly
        fake_pid = f"TEST_topup_{uuid.uuid4().hex[:8]}"
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        db.payments.insert_one({
            "id": fake_pid,
            "kind": "wallet_topup",
            "user_id": uid,
            "amount": 1000,
            "currency": "inr",
            "status": "paid",
            "paid_at": now,
            "created_at": now,
        })
        try:
            r = requests.get(f"{API}/wallet/transactions", headers=_h(c_tok), timeout=30)
            assert r.status_code == 200
            txns = r.json()["transactions"]
            match = [t for t in txns if t["id"] == fake_pid]
            assert match, f"Inserted topup not found in feed: {txns}"
            t = match[0]
            assert t["kind"] == "topup"
            assert t["direction"] == "credit"
            assert t["amount"] == 1000
            assert "top" in t["label"].lower()

            # sort: first txn should be newest — since we just inserted, it should be at or near top
            # (allow some flexibility because other tests may have added rows with later timestamps)
            ats = [x.get("at") or "" for x in txns]
            assert ats == sorted(ats, reverse=True), "transactions not sorted newest-first"
        finally:
            db.payments.delete_one({"id": fake_pid})

    def test_transactions_unauth_403(self):
        r = requests.get(f"{API}/wallet/transactions", timeout=30)
        assert r.status_code in (401, 403)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
