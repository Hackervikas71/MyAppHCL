"""Highway Mechanic Connect (HMC) - Backend API
Roadside assistance platform connecting customers with mechanics.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import math
import random
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt as pyjwt

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
STRIPE_API_KEY = os.environ['STRIPE_API_KEY']
JWT_ALGO = "HS256"
JWT_EXPIRE_DAYS = 30

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Highway Mechanic Connect")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============================================================================
# MODELS
# ============================================================================

Role = Literal["customer", "mechanic", "admin"]

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str
    role: Role = "customer"
    # Mechanic-only fields
    category: Optional[str] = None
    vehicle_types: Optional[List[str]] = None
    garage_address: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    role: str
    is_verified: bool = False
    is_online: bool = False
    category: Optional[str] = None
    rating: float = 5.0
    total_jobs: int = 0
    wallet_balance: float = 0.0
    location: Optional[dict] = None
    garage_address: Optional[str] = None

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class LocationUpdate(BaseModel):
    lat: float
    lng: float

class BookingCreate(BaseModel):
    breakdown_category: str
    vehicle_type: str
    description: Optional[str] = ""
    photo_base64: Optional[str] = None
    lat: float
    lng: float
    address: Optional[str] = ""

class BookingOut(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    mechanic_id: Optional[str] = None
    mechanic_name: Optional[str] = None
    mechanic_phone: Optional[str] = None
    breakdown_category: str
    vehicle_type: str
    description: str
    photo_base64: Optional[str] = None
    lat: float
    lng: float
    address: str
    status: str  # requested, accepted, arriving, in_progress, completed, cancelled
    price: float
    otp: Optional[str] = None
    created_at: str
    accepted_at: Optional[str] = None
    completed_at: Optional[str] = None
    mechanic_location: Optional[dict] = None
    eta_minutes: Optional[int] = None
    rating: Optional[int] = None
    review: Optional[str] = None
    payment_status: Optional[str] = None

class ChatMessageIn(BaseModel):
    text: str

class ChatMessageOut(BaseModel):
    id: str
    booking_id: str
    sender_id: str
    sender_name: str
    text: str
    created_at: str

class RatingIn(BaseModel):
    rating: int
    review: Optional[str] = ""

class AIChatIn(BaseModel):
    message: str
    session_id: Optional[str] = None

class SOSIn(BaseModel):
    lat: float
    lng: float
    message: Optional[str] = "Emergency SOS"

class NotificationOut(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    body: str
    booking_id: Optional[str] = None
    read: bool = False
    created_at: str

async def _emit_notification(user_id: str, ntype: str, title: str, body: str, booking_id: Optional[str] = None):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": ntype,
        "title": title,
        "body": body,
        "booking_id": booking_id,
        "read": False,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(doc)

# ============================================================================
# AUTH HELPERS
# ============================================================================

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except pyjwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

def require_role(*roles):
    async def _dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, f"Requires role: {roles}")
        return user
    return _dep

def user_to_out(u: dict) -> UserOut:
    return UserOut(
        id=u["id"],
        name=u["name"],
        email=u["email"],
        phone=u["phone"],
        role=u["role"],
        is_verified=u.get("is_verified", False),
        is_online=u.get("is_online", False),
        category=u.get("category"),
        rating=u.get("rating", 5.0),
        total_jobs=u.get("total_jobs", 0),
        wallet_balance=u.get("wallet_balance", 0.0),
        location=u.get("location"),
        garage_address=u.get("garage_address"),
    )

def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))

def price_for(category: str) -> float:
    base = {
        "flat_tyre": 350, "battery_dead": 500, "engine_failure": 1200,
        "overheating": 700, "brake_failure": 900, "fuel_empty": 400,
        "locked_keys": 450, "tow_required": 1500, "electrical": 600,
        "clutch_failure": 1000, "accident": 2000,
        "bike_service_home": 799, "custom": 500,
    }
    return float(base.get(category, 500))

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# ============================================================================
# AUTH ROUTES
# ============================================================================

@api.get("/")
async def root():
    return {"service": "Highway Mechanic Connect", "status": "ok"}

@api.post("/auth/register", response_model=TokenOut)
async def register(payload: UserRegister):
    existing = await db.users.find_one({"email": payload.email})
    if existing:
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "name": payload.name,
        "email": payload.email,
        "phone": payload.phone,
        "password": hash_password(payload.password),
        "role": payload.role,
        "is_verified": payload.role == "customer",  # mechanics need admin approval
        "is_online": False,
        "category": payload.category,
        "vehicle_types": payload.vehicle_types or [],
        "garage_address": payload.garage_address,
        "rating": 5.0,
        "total_jobs": 0,
        "wallet_balance": 0.0,
        "location": None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    token = create_token(uid, payload.role)
    return TokenOut(access_token=token, user=user_to_out(doc))

@api.post("/auth/login", response_model=TokenOut)
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"], user["role"])
    return TokenOut(access_token=token, user=user_to_out(user))

@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user_to_out(user)

@api.post("/auth/location")
async def update_location(loc: LocationUpdate, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"location": {"lat": loc.lat, "lng": loc.lng, "updated_at": now_iso()}}})
    return {"ok": True}

@api.post("/mechanic/toggle-online")
async def toggle_online(user: dict = Depends(require_role("mechanic"))):
    new_state = not user.get("is_online", False)
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_online": new_state}})
    return {"is_online": new_state}

# ============================================================================
# MECHANICS
# ============================================================================

@api.get("/mechanics/nearby")
async def nearby_mechanics(lat: float, lng: float, radius_km: float = 20.0, user: dict = Depends(get_current_user)):
    cursor = db.users.find({"role": "mechanic", "is_verified": True, "location": {"$ne": None}}, {"_id": 0, "password": 0})
    mechs = []
    async for m in cursor:
        loc = m.get("location") or {}
        if "lat" not in loc:
            continue
        d = haversine_km(lat, lng, loc["lat"], loc["lng"])
        if d <= radius_km:
            mechs.append({
                "id": m["id"],
                "name": m["name"],
                "category": m.get("category"),
                "rating": m.get("rating", 5.0),
                "total_jobs": m.get("total_jobs", 0),
                "is_online": m.get("is_online", False),
                "lat": loc["lat"],
                "lng": loc["lng"],
                "distance_km": round(d, 2),
                "eta_minutes": max(3, int(d * 2.5)),
            })
    mechs.sort(key=lambda x: x["distance_km"])
    return {"mechanics": mechs}

# ============================================================================
# BOOKINGS
# ============================================================================

def booking_to_out(b: dict) -> BookingOut:
    return BookingOut(
        id=b["id"],
        customer_id=b["customer_id"],
        customer_name=b.get("customer_name", ""),
        mechanic_id=b.get("mechanic_id"),
        mechanic_name=b.get("mechanic_name"),
        mechanic_phone=b.get("mechanic_phone"),
        breakdown_category=b["breakdown_category"],
        vehicle_type=b["vehicle_type"],
        description=b.get("description", ""),
        photo_base64=b.get("photo_base64"),
        lat=b["lat"],
        lng=b["lng"],
        address=b.get("address", ""),
        status=b["status"],
        price=b.get("price", 0.0),
        otp=b.get("otp"),
        created_at=b["created_at"],
        accepted_at=b.get("accepted_at"),
        completed_at=b.get("completed_at"),
        mechanic_location=b.get("mechanic_location"),
        eta_minutes=b.get("eta_minutes"),
        rating=b.get("rating"),
        review=b.get("review"),
        payment_status=b.get("payment_status"),
    )

@api.post("/bookings", response_model=BookingOut)
async def create_booking(payload: BookingCreate, user: dict = Depends(require_role("customer"))):
    bid = str(uuid.uuid4())
    otp = f"{random.randint(1000, 9999)}"
    doc = {
        "id": bid,
        "customer_id": user["id"],
        "customer_name": user["name"],
        "mechanic_id": None,
        "mechanic_name": None,
        "mechanic_phone": None,
        "breakdown_category": payload.breakdown_category,
        "vehicle_type": payload.vehicle_type,
        "description": payload.description or "",
        "photo_base64": payload.photo_base64,
        "lat": payload.lat,
        "lng": payload.lng,
        "address": payload.address or "",
        "status": "requested",
        "price": price_for(payload.breakdown_category),
        "otp": otp,
        "created_at": now_iso(),
        "mechanic_location": None,
        "eta_minutes": None,
    }
    await db.bookings.insert_one(doc)
    doc.pop("_id", None)
    # Notify all online, verified mechanics that match the vehicle or general fit
    async for m in db.users.find({"role": "mechanic", "is_verified": True, "is_online": True, "location": {"$ne": None}}, {"_id": 0, "id": 1, "location": 1}):
        loc = m.get("location") or {}
        if "lat" not in loc: continue
        d = haversine_km(payload.lat, payload.lng, loc["lat"], loc["lng"])
        if d <= 30:
            await _emit_notification(
                m["id"], "new_booking",
                f"New Job · {price_for(payload.breakdown_category):.0f}",
                f"{payload.breakdown_category.replace('_',' ').title()} · {payload.vehicle_type.upper()} · {round(d,1)} km away",
                doc["id"],
            )
    return booking_to_out(doc)

@api.get("/bookings", response_model=List[BookingOut])
async def list_bookings(user: dict = Depends(get_current_user)):
    if user["role"] == "customer":
        q = {"customer_id": user["id"]}
    elif user["role"] == "mechanic":
        q = {"$or": [{"mechanic_id": user["id"]}, {"status": "requested"}]}
    else:
        q = {}
    cursor = db.bookings.find(q, {"_id": 0}).sort("created_at", -1)
    return [booking_to_out(b) async for b in cursor]

@api.get("/bookings/{booking_id}", response_model=BookingOut)
async def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    # Simulate mechanic movement
    if b.get("status") in ("accepted", "arriving") and b.get("mechanic_location"):
        b = await _tick_mechanic_location(b)
    return booking_to_out(b)

async def _tick_mechanic_location(b: dict) -> dict:
    """Move mechanic slightly toward customer — but only if we haven't received a real update recently."""
    # If mechanic is pushing real location updates, skip the simulation
    last_real = b.get("last_real_location_at")
    if last_real:
        try:
            last_dt = datetime.fromisoformat(last_real)
            if (datetime.now(timezone.utc) - last_dt).total_seconds() < 30:
                return b
        except Exception:
            pass
    ml = b["mechanic_location"]
    tlat, tlng = b["lat"], b["lng"]
    # Move ~15% closer each poll
    new_lat = ml["lat"] + (tlat - ml["lat"]) * 0.15
    new_lng = ml["lng"] + (tlng - ml["lng"]) * 0.15
    dist = haversine_km(new_lat, new_lng, tlat, tlng)
    eta = max(1, int(dist * 2.5))
    new_status = b["status"]
    if dist < 0.05:  # arrived
        new_status = "arriving"
    await db.bookings.update_one({"id": b["id"]}, {"$set": {"mechanic_location": {"lat": new_lat, "lng": new_lng}, "eta_minutes": eta, "status": new_status}})
    b["mechanic_location"] = {"lat": new_lat, "lng": new_lng}
    b["eta_minutes"] = eta
    b["status"] = new_status
    return b

@api.post("/bookings/{booking_id}/mechanic-location")
async def push_mechanic_location(booking_id: str, loc: LocationUpdate, user: dict = Depends(require_role("mechanic"))):
    b = await db.bookings.find_one({"id": booking_id})
    if not b or b.get("mechanic_id") != user["id"]:
        raise HTTPException(404, "Booking not found")
    if b["status"] not in ("accepted", "arriving", "in_progress"):
        return {"ok": True, "skipped": True}
    dist = haversine_km(loc.lat, loc.lng, b["lat"], b["lng"])
    eta = max(1, int(dist * 2.5))
    new_status = b["status"]
    if b["status"] == "accepted" and dist < 0.05:
        new_status = "arriving"
    upd = {
        "mechanic_location": {"lat": loc.lat, "lng": loc.lng},
        "eta_minutes": eta,
        "status": new_status,
        "last_real_location_at": now_iso(),
    }
    await db.bookings.update_one({"id": booking_id}, {"$set": upd})
    # Also keep the mechanic's profile location fresh
    await db.users.update_one({"id": user["id"]}, {"$set": {"location": {"lat": loc.lat, "lng": loc.lng, "updated_at": now_iso()}}})
    return {"ok": True, "eta_minutes": eta, "status": new_status}

@api.post("/bookings/{booking_id}/accept", response_model=BookingOut)
async def accept_booking(booking_id: str, user: dict = Depends(require_role("mechanic"))):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(404, "Booking not found")
    if b["status"] != "requested":
        raise HTTPException(400, "Booking already handled")
    loc = user.get("location") or {"lat": b["lat"] + 0.02, "lng": b["lng"] + 0.02}
    dist = haversine_km(loc["lat"], loc["lng"], b["lat"], b["lng"])
    eta = max(3, int(dist * 2.5))
    upd = {
        "mechanic_id": user["id"],
        "mechanic_name": user["name"],
        "mechanic_phone": user["phone"],
        "status": "accepted",
        "accepted_at": now_iso(),
        "mechanic_location": {"lat": loc["lat"], "lng": loc["lng"]},
        "eta_minutes": eta,
    }
    await db.bookings.update_one({"id": booking_id}, {"$set": upd})
    b.update(upd)
    b.pop("_id", None)
    await _emit_notification(
        b["customer_id"], "booking_accepted",
        "Mechanic on the way",
        f"{user['name']} accepted your request · ETA {eta} min",
        booking_id,
    )
    return booking_to_out(b)

@api.post("/bookings/{booking_id}/start", response_model=BookingOut)
async def start_work(booking_id: str, user: dict = Depends(require_role("mechanic"))):
    b = await db.bookings.find_one({"id": booking_id})
    if not b or b.get("mechanic_id") != user["id"]:
        raise HTTPException(404, "Booking not found")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "in_progress"}})
    b["status"] = "in_progress"
    b.pop("_id", None)
    await _emit_notification(
        b["customer_id"], "work_started",
        "Work started",
        f"{user['name']} has started the repair. OTP: {b.get('otp','')}",
        booking_id,
    )
    return booking_to_out(b)

class CompleteIn(BaseModel):
    otp: str

@api.post("/bookings/{booking_id}/complete", response_model=BookingOut)
async def complete_booking(booking_id: str, payload: CompleteIn, user: dict = Depends(require_role("mechanic"))):
    b = await db.bookings.find_one({"id": booking_id})
    if not b or b.get("mechanic_id") != user["id"]:
        raise HTTPException(404, "Booking not found")
    if b.get("otp") != payload.otp:
        raise HTTPException(400, "Invalid OTP")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "completed", "completed_at": now_iso()}})
    # Credit mechanic wallet
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance": b["price"] * 0.85, "total_jobs": 1}})
    b["status"] = "completed"
    b["completed_at"] = now_iso()
    b.pop("_id", None)
    await _emit_notification(
        b["customer_id"], "completed",
        "Service completed",
        f"Please pay ₹{b['price']:.0f} and rate {user['name']}.",
        booking_id,
    )
    return booking_to_out(b)

@api.post("/bookings/{booking_id}/cancel", response_model=BookingOut)
async def cancel_booking(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(404, "Booking not found")
    if user["role"] == "customer" and b["customer_id"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "cancelled"}})
    b["status"] = "cancelled"
    b.pop("_id", None)
    return booking_to_out(b)

@api.post("/bookings/{booking_id}/rate", response_model=BookingOut)
async def rate_booking(booking_id: str, payload: RatingIn, user: dict = Depends(require_role("customer"))):
    b = await db.bookings.find_one({"id": booking_id})
    if not b or b["customer_id"] != user["id"]:
        raise HTTPException(404, "Booking not found")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"rating": payload.rating, "review": payload.review or ""}})
    if b.get("mechanic_id"):
        # Recompute mechanic avg rating
        agg = db.bookings.aggregate([
            {"$match": {"mechanic_id": b["mechanic_id"], "rating": {"$ne": None}}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}}},
        ])
        async for row in agg:
            await db.users.update_one({"id": b["mechanic_id"]}, {"$set": {"rating": round(row["avg"], 2)}})
    b["rating"] = payload.rating
    b["review"] = payload.review or ""
    b.pop("_id", None)
    return booking_to_out(b)

# ============================================================================
# CHAT
# ============================================================================

@api.get("/bookings/{booking_id}/messages", response_model=List[ChatMessageOut])
async def get_messages(booking_id: str, user: dict = Depends(get_current_user)):
    cursor = db.chats.find({"booking_id": booking_id}, {"_id": 0}).sort("created_at", 1)
    return [ChatMessageOut(**m) async for m in cursor]

@api.post("/bookings/{booking_id}/messages", response_model=ChatMessageOut)
async def send_message(booking_id: str, payload: ChatMessageIn, user: dict = Depends(get_current_user)):
    msg = {
        "id": str(uuid.uuid4()),
        "booking_id": booking_id,
        "sender_id": user["id"],
        "sender_name": user["name"],
        "text": payload.text,
        "created_at": now_iso(),
    }
    await db.chats.insert_one(msg)
    msg.pop("_id", None)
    return ChatMessageOut(**msg)

# ============================================================================
# AI ASSISTANT (Emergent LLM streaming)
# ============================================================================

AI_SYSTEM = """You are HMC AI, an expert roadside assistance assistant for stranded drivers.
- Diagnose vehicle breakdowns from user descriptions.
- Give quick safety advice (pull over safely, hazard lights, warning triangle).
- Estimate approximate repair cost in INR when possible.
- Recommend the right mechanic category (Tyre Specialist, Battery Specialist, Tow Truck, EV Technician, General Mechanic).
- Keep responses concise (max 4 short paragraphs). Use simple language.
- If user is in danger, immediately advise them to press the SOS button in the app."""

@api.post("/ai/chat")
async def ai_chat(payload: AIChatIn, user: dict = Depends(get_current_user)):
    session_id = payload.session_id or f"{user['id']}-{uuid.uuid4()}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=AI_SYSTEM,
    ).with_model("openai", "gpt-5.4-mini")

    async def event_gen():
        try:
            async for ev in chat.stream_message(UserMessage(text=payload.message)):
                if isinstance(ev, TextDelta):
                    yield f"data: {ev.content}\n\n"
                elif isinstance(ev, StreamDone):
                    yield "data: [DONE]\n\n"
                    break
        except Exception as e:
            logger.exception("AI error")
            yield f"data: [ERROR: {str(e)}]\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@api.post("/ai/chat-sync")
async def ai_chat_sync(payload: AIChatIn, user: dict = Depends(get_current_user)):
    """Non-streaming fallback for simple clients."""
    session_id = payload.session_id or f"{user['id']}-{uuid.uuid4()}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=AI_SYSTEM,
    ).with_model("openai", "gpt-5.4-mini")
    text = ""
    try:
        async for ev in chat.stream_message(UserMessage(text=payload.message)):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        raise HTTPException(500, f"AI error: {e}")
    return {"reply": text, "session_id": session_id}

# ============================================================================
# NOTIFICATIONS (in-app)
# ============================================================================

@api.get("/notifications", response_model=List[NotificationOut])
async def list_notifications(user: dict = Depends(get_current_user), limit: int = 50):
    cursor = db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [NotificationOut(**n) async for n in cursor]

@api.get("/notifications/unread-count")
async def unread_count(user: dict = Depends(get_current_user)):
    n = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"count": n}

@api.post("/notifications/mark-read")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}

@api.post("/notifications/{notif_id}/read")
async def mark_one_read(notif_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": notif_id, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}

# ============================================================================
# SOS
# ============================================================================

@api.post("/sos")
async def sos(payload: SOSIn, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_phone": user["phone"],
        "lat": payload.lat,
        "lng": payload.lng,
        "message": payload.message,
        "created_at": now_iso(),
        "status": "active",
    }
    await db.sos.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "sos_id": doc["id"], "helplines": [
        {"name": "Highway Patrol", "number": "1033"},
        {"name": "Ambulance", "number": "108"},
        {"name": "Police", "number": "100"},
        {"name": "HMC Support", "number": "1800-000-HMC"},
    ]}

# ============================================================================
# ADMIN
# ============================================================================

@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_role("admin"))):
    total_users = await db.users.count_documents({"role": "customer"})
    total_mechanics = await db.users.count_documents({"role": "mechanic"})
    pending_mechanics = await db.users.count_documents({"role": "mechanic", "is_verified": False})
    total_bookings = await db.bookings.count_documents({})
    completed = await db.bookings.count_documents({"status": "completed"})
    active_sos = await db.sos.count_documents({"status": "active"})
    revenue_agg = db.bookings.aggregate([
        {"$match": {"status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$price"}}},
    ])
    total_revenue = 0.0
    async for r in revenue_agg:
        total_revenue = r["total"]
    return {
        "customers": total_users,
        "mechanics": total_mechanics,
        "pending_mechanics": pending_mechanics,
        "bookings": total_bookings,
        "completed_bookings": completed,
        "active_sos": active_sos,
        "revenue": total_revenue,
    }

@api.get("/admin/mechanics")
async def admin_list_mechanics(user: dict = Depends(require_role("admin"))):
    cursor = db.users.find({"role": "mechanic"}, {"_id": 0, "password": 0}).sort("created_at", -1)
    return [m async for m in cursor]

@api.post("/admin/mechanics/{mech_id}/approve")
async def admin_approve(mech_id: str, user: dict = Depends(require_role("admin"))):
    await db.users.update_one({"id": mech_id, "role": "mechanic"}, {"$set": {"is_verified": True}})
    return {"ok": True}

@api.post("/admin/mechanics/{mech_id}/reject")
async def admin_reject(mech_id: str, user: dict = Depends(require_role("admin"))):
    await db.users.update_one({"id": mech_id, "role": "mechanic"}, {"$set": {"is_verified": False}})
    return {"ok": True}

# ============================================================================
# PAYMENTS (Stripe test mode via Emergent proxy)
# ============================================================================

class CheckoutCreateIn(BaseModel):
    booking_id: str
    origin_url: str  # frontend base URL, e.g. https://mechanic-connect-116.preview.emergentagent.com

_ALLOWED_AMOUNT_RANGE = (10.0, 100000.0)  # INR safety bounds

@api.post("/payments/checkout/session")
async def create_checkout(payload: CheckoutCreateIn, user: dict = Depends(require_role("customer"))):
    booking = await db.bookings.find_one({"id": payload.booking_id, "customer_id": user["id"]})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.get("payment_status") == "paid":
        raise HTTPException(400, "Already paid")
    amount = float(booking["price"])
    if not (_ALLOWED_AMOUNT_RANGE[0] <= amount <= _ALLOWED_AMOUNT_RANGE[1]):
        raise HTTPException(400, "Invalid amount")

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/payment-cancel"

    checkout = StripeCheckout(api_key=STRIPE_API_KEY)
    req = CheckoutSessionRequest(
        amount=amount,
        currency="inr",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"booking_id": payload.booking_id, "customer_id": user["id"]},
    )
    session = await checkout.create_checkout_session(req)
    await db.payments.insert_one({
        "id": str(uuid.uuid4()),
        "booking_id": payload.booking_id,
        "customer_id": user["id"],
        "session_id": session.session_id,
        "amount": amount,
        "currency": "inr",
        "status": "initiated",
        "created_at": now_iso(),
    })
    return {"url": session.url, "session_id": session.session_id}

@api.get("/payments/checkout/status/{session_id}")
async def checkout_status(session_id: str, user: dict = Depends(get_current_user)):
    payment = await db.payments.find_one({"session_id": session_id}, {"_id": 0})
    if not payment:
        raise HTTPException(404, "Session not found")
    # If we've already marked paid, return immediately (idempotent)
    checkout = StripeCheckout(api_key=STRIPE_API_KEY)
    status = await checkout.get_checkout_status(session_id)
    new_status = "paid" if status.payment_status == "paid" else status.status
    if payment.get("status") != "paid" and status.payment_status == "paid":
        await db.payments.update_one({"session_id": session_id}, {"$set": {"status": "paid", "paid_at": now_iso()}})
        await db.bookings.update_one({"id": payment["booking_id"]}, {"$set": {"payment_status": "paid"}})
    return {
        "session_id": session_id,
        "payment_status": status.payment_status,
        "status": new_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "booking_id": payment["booking_id"],
    }

# ============================================================================
# SEED DATA
# ============================================================================

async def seed_data():
    # Create admin if not exists
    if not await db.users.find_one({"role": "admin"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "HMC Admin",
            "email": "admin@hmc.app",
            "phone": "9999999999",
            "password": hash_password("admin123"),
            "role": "admin",
            "is_verified": True,
            "is_online": True,
            "rating": 5.0, "total_jobs": 0, "wallet_balance": 0.0,
            "location": None, "created_at": now_iso(),
        })
        logger.info("Seeded admin: admin@hmc.app / admin123")

    # Seed test customer
    if not await db.users.find_one({"email": "customer@hmc.app"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Test Customer",
            "email": "customer@hmc.app",
            "phone": "9876543210",
            "password": hash_password("customer123"),
            "role": "customer",
            "is_verified": True, "is_online": False,
            "rating": 5.0, "total_jobs": 0, "wallet_balance": 500.0,
            "location": {"lat": 19.076, "lng": 72.8777},
            "created_at": now_iso(),
        })
        logger.info("Seeded customer: customer@hmc.app / customer123")

    # Seed mechanics around Mumbai (default) area
    mechanic_seeds = [
        ("Ravi Kumar", "mechanic1@hmc.app", "ravi123", "general_mechanic", 19.080, 72.880),
        ("Suresh Tyres", "mechanic2@hmc.app", "suresh123", "tyre_specialist", 19.072, 72.870),
        ("Amit Battery Pro", "mechanic3@hmc.app", "amit123", "battery_specialist", 19.085, 72.885),
        ("Mahesh Tow Truck", "mechanic4@hmc.app", "mahesh123", "tow_truck", 19.065, 72.875),
        ("EV Tech Rajesh", "mechanic5@hmc.app", "rajesh123", "ev_technician", 19.090, 72.865),
    ]
    for name, email, pw, cat, lat, lng in mechanic_seeds:
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "name": name,
                "email": email,
                "phone": f"98{random.randint(10000000, 99999999)}",
                "password": hash_password(pw),
                "role": "mechanic",
                "is_verified": True,
                "is_online": True,
                "category": cat,
                "vehicle_types": ["car", "suv", "truck", "bike"],
                "garage_address": "Highway Service Point, Mumbai",
                "rating": round(4 + random.random(), 2),
                "total_jobs": random.randint(20, 200),
                "wallet_balance": float(random.randint(500, 5000)),
                "location": {"lat": lat, "lng": lng, "updated_at": now_iso()},
                "created_at": now_iso(),
            })
    logger.info("Seed complete.")

@app.on_event("startup")
async def on_startup():
    await seed_data()

@app.on_event("shutdown")
async def on_shutdown():
    client.close()

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
