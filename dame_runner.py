import uuid
"""
dame_runner.py — Playwright headless dame FB
Inject cookie theo bookmark JS từ ảnh → navigate target → auto 13 report
Hỗ trợ: screenshot tab máy ảo realtime
"""
import asyncio, json, re, time, base64
from typing import Optional

try:
    from playwright.async_api import async_playwright, Page, BrowserContext
    PLAYWRIGHT_OK = True
except ImportError:
    PLAYWRIGHT_OK = False

# Auto-install Chromium nếu chưa có
import subprocess as _sp2, sys as _sys2
try:
    _sp2.run([_sys2.executable, "-m", "playwright", "install", "chromium", "--with-deps"],
             check=False, capture_output=True, timeout=120)
except: pass

# ══════════════════════════════════════
# SESSION STATE
# ══════════════════════════════════════
class DameSession:
    def __init__(self):
        self.running   = False
        self.paused    = False
        self.stopped   = False
        self.died      = False
        self.total     = 0
        self.loops     = 0
        self.log       = ""
        self.name      = ""
        self.uid       = ""
        self.target    = ""
        self.speed     = "normal"
        self.screenshot_b64: str = ""      # ảnh base64 tab máy ảo
        self._task: Optional[asyncio.Task] = None
        self._logs: list = []
        self._page: Optional[object] = None  # giữ ref page đang chạy

    def add_log(self, msg: str):
        ts = time.strftime("%H:%M:%S")
        entry = f"[{ts}] {msg}"
        self._logs.append(entry)
        if len(self._logs) > 300:
            self._logs = self._logs[-300:]
        self.log = entry

    def pop_logs(self) -> list:
        logs = list(self._logs)
        self._logs.clear()
        return logs

DAME_SESSION = DameSession()

# ══════════════════════════════════════
# PARSE COOKIE STRING → LIST DICT cho Playwright context.add_cookies()
# ══════════════════════════════════════
def normalize_cookie_str(raw: str) -> str:
    """
    Chuẩn hoá cookie từ nhiều format khác nhau về dạng 'key=value; key2=value2'
    Hỗ trợ:
      - Header string:   key=val; key2=val2
      - Netscape/tab:    .facebook.com TRUE / FALSE 0 key value
      - JSON array:      [{"name":"key","value":"val",...}, ...]
      - JSON object:     {"key":"val", ...}
      - key=val trên nhiều dòng
    """
    raw = raw.strip()
    # ── JSON array (export từ EditThisCookie, Cookie-Editor) ──
    if raw.startswith("["):
        try:
            arr = json.loads(raw)
            parts = []
            for c in arr:
                if isinstance(c, dict):
                    n = c.get("name") or c.get("key") or ""
                    v = c.get("value", "")
                    if n:
                        parts.append(f"{n}={v}")
            return "; ".join(parts)
        except Exception:
            pass
    # ── JSON object ──
    if raw.startswith("{"):
        try:
            obj = json.loads(raw)
            return "; ".join(f"{k}={v}" for k, v in obj.items())
        except Exception:
            pass
    # ── Netscape format (từ wget/curl cookie jar) ──
    if "\t" in raw:
        parts = []
        for line in raw.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            cols = line.split("\t")
            if len(cols) >= 7:
                parts.append(f"{cols[5]}={cols[6]}")
            elif len(cols) == 6:
                parts.append(f"{cols[5]}=")
        if parts:
            return "; ".join(parts)
    # ── Chuẩn hoá newline → semicolon (copy nhiều dòng) ──
    if "\n" in raw and "=" in raw:
        raw = "; ".join(
            line.strip().rstrip(";") for line in raw.splitlines() if "=" in line.strip()
        )
    return raw


def parse_cookie_str(cookie_str: str) -> list:
    """Parse cookie từ nhiều format thành list dict cho Playwright add_cookies"""
    cookie_str = normalize_cookie_str(cookie_str)
    cookies = []
    META_KEYS = {"domain", "path", "expires", "max-age", "samesite", "secure", "httponly", "version", "comment"}
    seen = set()
    for part in cookie_str.split(";"):
        part = part.strip()
        if not part:
            continue
        if "=" not in part:
            continue
        name, _, value = part.partition("=")
        name  = name.strip()
        value = value.strip()
        # Bỏ qua meta-flags
        if not name or name.lower() in META_KEYS:
            continue
        # Bỏ trùng (giữ cái đầu tiên)
        if name in seen:
            continue
        seen.add(name)
        cookies.append({
            "name":     name,
            "value":    value,
            "domain":   ".facebook.com",
            "path":     "/",
            "secure":   True,
            "httpOnly": False,
            "sameSite": "None"
        })
    return cookies

def build_inject_js(cookie_str: str) -> str:
    """Fallback JS inject - chỉ dùng cho non-httpOnly cookies"""
    escaped = json.dumps(cookie_str)
    return f"""
(function() {{
    var cookieStr = {escaped};
    document.cookie.split(";").forEach(function(c) {{
        document.cookie = c.replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString()
            + ";path=/;domain=.facebook.com");
    }});
    var cookies = cookieStr.split(';');
    cookies.forEach(function(cookie) {{
        cookie = cookie.trim();
        if (cookie) {{
            if (!cookie.includes('domain=')) cookie += '; domain=.facebook.com';
            if (!cookie.includes('path='))   cookie += '; path=/';
            document.cookie = cookie;
        }}
    }});
    return 'OK';
}})();
"""

# ══════════════════════════════════════
# SPEED CONFIG
# ══════════════════════════════════════
SPEED_CONFIG = {
    "fast":   {"click": 100, "action": 200, "done": 80,  "loop": 500,  "inter": 150},
    "normal": {"click": 200, "action": 400, "done": 150, "loop": 900,  "inter": 350},
    "slow":   {"click": 350, "action": 700, "done": 250, "loop": 1500, "inter": 650},
}
def cfg(speed): return SPEED_CONFIG.get(speed, SPEED_CONFIG["normal"])

# ══════════════════════════════════════
# CHỤP SCREENSHOT TAB MÁY ẢO
# ══════════════════════════════════════
async def _take_screenshot():
    try:
        page = DAME_SESSION._page
        if page and not page.is_closed():
            data = await page.screenshot(type="jpeg", quality=60, full_page=False)
            DAME_SESSION.screenshot_b64 = base64.b64encode(data).decode()
    except:
        pass

async def _screenshot_loop():
    while DAME_SESSION.running and not DAME_SESSION.stopped:
        await _take_screenshot()
        await asyncio.sleep(2)  # chụp mỗi 2s

# ══════════════════════════════════════
# VERIFY COOKIE
# ══════════════════════════════════════
async def verify_fb_cookie(cookie_str: str) -> dict:
    """
    Không dùng Playwright nữa — check nhanh format cookie.
    Việc check sống/chết thực sự sẽ diễn ra khi bắt đầu dame (log sẽ báo).
    """
    try:
        parsed = parse_cookie_str(cookie_str)
        if not parsed:
            return {"ok": False, "name": "", "uid": "", "error": "Cookie sai format hoặc rỗng"}
        
        # Lấy c_user để hiển thị UID
        uid = ""
        name = ""
        for c in parsed:
            if c.get("name") == "c_user":
                uid = str(c.get("value", ""))
            if c.get("name") == "xs" and not uid:
                pass  # xs exists = likely valid session

        if not uid:
            # Thử parse từ string thô
            import re
            m = re.search(r"c_user[=:]\s*[\"']?(\d+)", cookie_str)
            if m:
                uid = m.group(1)

        if not uid:
            return {"ok": False, "name": "", "uid": "", "error": "Không tìm thấy c_user trong cookie. Kiểm tra lại cookie."}

        name = f"UID {uid}"
        return {"ok": True, "name": name, "uid": uid}
    except Exception as e:
        return {"ok": False, "name": "", "uid": "", "error": str(e)[:200]}


async def get_target_name(cookie_str: str, target_url: str) -> dict:
    if not PLAYWRIGHT_OK:
        return {"ok": False, "name": "Không xác định", "uid": ""}
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"]
            )
            ctx = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            parsed_cookies = parse_cookie_str(cookie_str)
            if parsed_cookies:
                await ctx.add_cookies(parsed_cookies)
            page = await ctx.new_page()
            await page.goto(target_url, wait_until="domcontentloaded", timeout=25000)
            await asyncio.sleep(2.5)

            name = ""
            uid  = ""

            # Lấy tên từ h1
            try:
                h1 = await page.query_selector("h1")
                if h1: name = (await h1.inner_text()).strip()
            except: pass

            # Fallback title
            if not name:
                title = await page.title()
                name = title.split("|")[0].split("–")[0].strip()
                if "Facebook" in name: name = ""

            # UID từ URL
            m = re.search(r'profile\.php\?id=(\d+)', page.url)
            if m: uid = m.group(1)

            # UID từ source
            if not uid:
                try:
                    content = await page.content()
                    for pattern in [r'"userID":"(\d+)"', r'"ownerID":"(\d+)"', r'"actorID":"(\d+)"']:
                        m2 = re.search(pattern, content)
                        if m2: uid = m2.group(1); break
                except: pass

            await browser.close()
            return {"ok": True, "name": name or "Không xác định", "uid": uid}
    except Exception as e:
        return {"ok": False, "name": "Lỗi lấy tên", "uid": "", "error": str(e)[:200]}

# ══════════════════════════════════════
# DAME SCRIPT JS (inject vào browser)
# ══════════════════════════════════════
import os as _os

def _load_dame_script() -> str:
    """Đọc script JS từ file dame_script.js"""
    paths = [
        _os.path.join(_os.path.dirname(__file__), "static", "dame_script.js"),
        _os.path.join(_os.path.dirname(__file__), "dame_script.js"),
    ]
    for p in paths:
        if _os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                return f.read()
    return ""

# ══════════════════════════════════════
# MAIN DAME LOOP — inject JS
# ══════════════════════════════════════
async def _dame_loop(cookie_str: str, target_url: str, speed: str):
    if not PLAYWRIGHT_OK:
        DAME_SESSION.add_log("❌ Playwright chưa cài!")
        DAME_SESSION.stopped = True; DAME_SESSION.running = False
        return

    dame_js = _load_dame_script()
    if not dame_js:
        DAME_SESSION.add_log("❌ Không tìm thấy dame_script.js!")
        DAME_SESSION.stopped = True; DAME_SESSION.running = False
        return

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
                      "--disable-blink-features=AutomationControlled",
                      "--window-size=1280,800"]
            )
            ctx: BrowserContext = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800}
            )

            # ── Inject script tự động vào mọi trang facebook ──
            await ctx.add_init_script(dame_js)

            page = await ctx.new_page()
            DAME_SESSION._page = page

            # Bắt đầu vòng chụp screenshot nền
            screenshot_task = asyncio.create_task(_screenshot_loop())

            # Inject cookie
            DAME_SESSION.add_log("🍪 Inject cookie...")
            parsed_cookies = parse_cookie_str(cookie_str)
            if parsed_cookies:
                await ctx.add_cookies(parsed_cookies)

            # Mở thẳng trang nạn nhân (tránh FB detect session lạ từ homepage)
            DAME_SESSION.add_log("🎯 Mở trang target...")
            await page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
            await page.evaluate(build_inject_js(cookie_str))
            await asyncio.sleep(2)

            # Check cookie sống/chết ngay trên trang target
            cur_url = page.url
            if "login" in cur_url or "checkpoint" in cur_url:
                DAME_SESSION.add_log("❌ Cookie die / bị checkpoint!")
                DAME_SESSION.stopped = True; DAME_SESSION.running = False
                screenshot_task.cancel()
                await browser.close(); return

            # Check popup login dialog (soft-block)
            try:
                popup = await page.query_selector("input[name='email'], [role='dialog'] input[type='password'], form[data-testid='royal_login_form']")
                if popup:
                    DAME_SESSION.add_log("❌ Cookie bị soft-block (popup đăng nhập xuất hiện)!")
                    DAME_SESSION.stopped = True; DAME_SESSION.running = False
                    screenshot_task.cancel()
                    await browser.close(); return
            except: pass

            DAME_SESSION.add_log("✅ Cookie sống · Đang chạy dame tự động...")

            # ── Vòng lặp chính: chỉ detect die, reload nếu cần ──
            die_keywords = [
                "sorry, something went wrong",
                "there's a technical problem",
                "we're working on getting it fixed",
                "something went wrong",
                "this content isn't available",
                "this page isn't available",
            ]

            while not DAME_SESSION.stopped:
                while DAME_SESSION.paused and not DAME_SESSION.stopped:
                    await asyncio.sleep(0.5)
                if DAME_SESSION.stopped: break

                await asyncio.sleep(5)

                try:
                    # Detect die
                    body_text = (await page.inner_text("body")).lower()
                    if any(k in body_text for k in die_keywords):
                        DAME_SESSION.add_log("💀 Phát hiện ACC DIE!")
                        # Chụp ảnh die
                        die_sc = await page.screenshot(type="jpeg", quality=80, full_page=False)
                        DAME_SESSION.screenshot_b64 = base64.b64encode(die_sc).decode()
                        DAME_SESSION.died = True
                        DAME_SESSION.running = False
                        DAME_SESSION.stopped = True
                        DAME_SESSION.add_log("📸 Đã chụp ảnh die · Dừng")
                        break

                    # Cập nhật total từ script nếu có
                    try:
                        total = await page.evaluate("window._dameTotal || 0")
                        if total: DAME_SESSION.total = int(total)
                        loops = await page.evaluate("window._dameLoops || 0")
                        if loops: DAME_SESSION.loops = int(loops)
                    except: pass

                    # Nếu trang bị redirect ra khỏi target → reload
                    if target_url.split("?")[0] not in page.url and "facebook.com" in page.url:
                        DAME_SESSION.add_log("🔄 Reload về target...")
                        await page.goto(target_url, wait_until="domcontentloaded", timeout=20000)
                        await asyncio.sleep(2)

                except Exception as e:
                    DAME_SESSION.add_log(f"⚠ Loop: {str(e)[:80]}")

            screenshot_task.cancel()
            await browser.close()
            if DAME_SESSION.died:
                DAME_SESSION.add_log(f"💀 Kết thúc — ACC DIE · Tổng: {DAME_SESSION.total}")
            else:
                DAME_SESSION.add_log(f"⏹ Kết thúc · Tổng: {DAME_SESSION.total}")

    except Exception as e:
        DAME_SESSION.add_log(f"❌ Lỗi: {str(e)[:120]}")
    finally:
        DAME_SESSION.running = False
        DAME_SESSION.stopped = True
        DAME_SESSION._page   = None

# ══════════════════════════════════════
# PUBLIC API
# ══════════════════════════════════════
async def start_dame(cookie_str, target_url, speed="normal", name="", uid="", target_name=""):
    global DAME_SESSION
    DAME_SESSION = DameSession()
    DAME_SESSION.running = True
    DAME_SESSION.speed   = speed
    DAME_SESSION.name    = name
    DAME_SESSION.uid     = uid
    DAME_SESSION.target  = target_url
    DAME_SESSION._task   = asyncio.create_task(_dame_loop(cookie_str, target_url, speed))
    DAME_SESSION.add_log(f"🚀 Bắt đầu · Cookie: {name} · Target: {target_name or target_url}")

def pause_dame():
    DAME_SESSION.paused = True
    DAME_SESSION.add_log("⏸ Tạm dừng")

def resume_dame():
    DAME_SESSION.paused = False
    DAME_SESSION.add_log("▶ Tiếp tục")

def stop_dame():
    DAME_SESSION.stopped = True
    DAME_SESSION.paused  = False
    DAME_SESSION.running = False
    DAME_SESSION.add_log("⏹ Dừng")

def get_status() -> dict:
    return {
        "running":  DAME_SESSION.running,
        "paused":   DAME_SESSION.paused,
        "stopped":  DAME_SESSION.stopped,
        "died":     DAME_SESSION.died,
        "total":    DAME_SESSION.total,
        "loops":    DAME_SESSION.loops,
        "log":      DAME_SESSION.log,
        "logs":     DAME_SESSION.pop_logs(),
        "name":     DAME_SESSION.name,
        "uid":      DAME_SESSION.uid,
        "die_screenshot": DAME_SESSION.screenshot_b64 if DAME_SESSION.died else "",
    }

def get_screenshot() -> str:
    """Trả về ảnh JPEG base64 của tab máy ảo, hoặc '' nếu chưa có"""
    return DAME_SESSION.screenshot_b64

# ══════════════════════════════════════
# LOGIN FACEBOOK BẰNG EMAIL + MẬT KHẨU
# ══════════════════════════════════════

# ── Browser session store (giữ browser đang mở cho 2FA/checkpoint) ──
_browser_sessions = {}  # session_id -> {"browser": ..., "page": ..., "ctx": ...}
_captcha_sessions = {}  # cap_id -> {"status": "solving/done/error", "msg": "", "screenshot_b64": "", "result": {}}

def _cap_update(cap_id: str, msg: str, sc: str = None):
    _captcha_sessions[cap_id]["msg"] = msg
    if sc is not None:
        _captcha_sessions[cap_id]["screenshot_b64"] = sc

async def _gemini_solve_captcha(page, ctx, browser, cap_id: str):
    import base64 as _b64, re as _re, json as _json

    async def snap() -> str:
        try:
            data = await page.screenshot(type="jpeg", quality=75, full_page=False)
            return _b64.b64encode(data).decode()
        except: return ""

    def parse_json(text: str) -> dict:
        text = text.strip()
        m = _re.search(r'\{[^{}]*\}', text, _re.DOTALL)
        if m:
            try: return _json.loads(m.group())
            except: pass
        return {}

    try:
        # 1. Delay 5s cho captcha load
        _cap_update(cap_id, "⏳ Chờ CAPTCHA load (5s)...")
        await asyncio.sleep(5)
        sc = await snap()
        _cap_update(cap_id, "📸 Đang gửi Gemini phân tích...", sc)

        # 2. Gemini tìm tọa độ checkbox
        prompt1 = (
            "Day la anh chup man hinh trinh duyet dang hien captcha reCAPTCHA cua Facebook/Meta. "
            "Xac dinh xem co checkbox vuong nho 'Toi khong phai la nguoi may' / 'I am not a robot' khong. "
            "Neu co, tra ve JSON: "
            '{"has_captcha": true, "x_percent": <so 0-100>, "y_percent": <so 0-100>}'
            " voi x_percent, y_percent la toa do TRUNG TAM o vuong checkbox, "
            "tinh theo phan tram chieu rong va chieu cao anh. "
            "Neu khong thay captcha, tra ve: "
            '{"has_captcha": false}'
            ". Chi tra ve JSON, khong them gi khac."
        )
        ai1 = await _ai_analyze_screenshot(sc, prompt1)
        gemini_data = parse_json(ai1.get("text", ""))
        clicked = False

        if gemini_data.get("has_captcha"):
            x_pct = float(gemini_data.get("x_percent", 10))
            y_pct = float(gemini_data.get("y_percent", 50))
            vp = page.viewport_size or {"width": 1280, "height": 800}
            x = int(vp["width"] * x_pct / 100)
            y = int(vp["height"] * y_pct / 100)
            _cap_update(cap_id, f"🖱️ Gemini xác định checkbox tại ({x_pct:.0f}%, {y_pct:.0f}%) — đang click...", sc)
            try:
                await page.mouse.click(x, y)
                clicked = True
            except: pass

        # Fallback: selector iframe
        if not clicked:
            try:
                iframe_el = await page.query_selector("iframe[src*='recaptcha']")
                if iframe_el:
                    frame = await iframe_el.content_frame()
                    if frame:
                        cb = await frame.query_selector("#recaptcha-anchor")
                        if cb:
                            await cb.click()
                            clicked = True
            except: pass

        # Fallback: selector thô
        if not clicked:
            for sel in [".recaptcha-checkbox","[aria-label*='robot']","[aria-label*='human']","[aria-label*='not a robot']","span.recaptcha-checkbox-border"]:
                try:
                    el = await page.query_selector(sel)
                    if el:
                        await el.click()
                        clicked = True
                        break
                except: continue

        # 3. Đợi xác nhận
        _cap_update(cap_id, "✅ Đã click! Đang đợi xác nhận (5s)...")
        await asyncio.sleep(5)
        sc2 = await snap()

        prompt2 = (
            "Checkbox reCAPTCHA 'Toi khong phai la nguoi may' da duoc tich (hien dau check xanh) chua? "
            'Tra ve JSON: {"checked": true} hoac {"checked": false}. Chi JSON.'
        )
        ai2 = await _ai_analyze_screenshot(sc2, prompt2)
        check_data = parse_json(ai2.get("text", ""))
        if check_data.get("checked"):
            _cap_update(cap_id, "🎉 CAPTCHA xác nhận! Đang tiếp tục đăng nhập...", sc2)
        else:
            _cap_update(cap_id, "⚠️ Chưa chắc tích xong — vẫn thử tiếp...", sc2)

        # 4. Click nút Login
        for sel in ["[name='login']","button[type='submit']","button:has-text('Đăng nhập')","button:has-text('Log In')"]:
            try:
                await page.click(sel, timeout=2000)
                break
            except: continue

        try:
            await page.wait_for_url(lambda u: "login" not in u or "checkpoint" in u or "two_step" in u or "approvals" in u, timeout=15000)
        except: pass
        await asyncio.sleep(3)
        url = page.url
        sc3 = await snap()

        # 5. Phân tích kết quả
        if "facebook.com" in url and "login" not in url and "checkpoint" not in url and "two_step" not in url and "approvals" not in url:
            cookies = await ctx.cookies()
            c_user = next((c["value"] for c in cookies if c["name"] == "c_user"), "")
            cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in cookies if "facebook.com" in c.get("domain",""))
            _cap_update(cap_id, "✅ Đăng nhập thành công sau khi giải CAPTCHA!", sc3)
            await browser.close()
            _captcha_sessions[cap_id]["status"] = "done"
            _captcha_sessions[cap_id]["result"] = {"status": "success", "message": "✅ Đăng nhập thành công!", "uid": c_user, "name": "", "cookie": cookie_str, "screenshot_b64": sc3}
            return

        if any(k in url for k in ["two_step","two-step","2fac","approvals"]):
            try: await page.wait_for_load_state("networkidle", timeout=8000)
            except: pass
            await asyncio.sleep(2)
            sc3 = await snap()
            new_sid = str(uuid.uuid4())
            _browser_sessions[new_sid] = {"browser": browser, "page": page, "ctx": ctx}
            _captcha_sessions[cap_id]["status"] = "done"
            _captcha_sessions[cap_id]["result"] = {"status": "2fa", "message": "🔐 Nhập mã OTP:", "session_id": new_sid, "screenshot_b64": sc3}
            return

        _cap_update(cap_id, "❌ Không giải được CAPTCHA.", sc3)
        await browser.close()
        _captcha_sessions[cap_id]["status"] = "done"
        _captcha_sessions[cap_id]["result"] = {"status": "captcha_fail", "message": "❌ Không giải được CAPTCHA. Thử lại.", "screenshot_b64": sc3}

    except Exception as e:
        _captcha_sessions[cap_id]["status"] = "error"
        _captcha_sessions[cap_id]["result"] = {"status": "error", "message": f"Lỗi: {str(e)[:200]}", "screenshot_b64": ""}

async def _ai_analyze_screenshot(screenshot_b64: str, instruction: str) -> dict:
    """Gửi ảnh cho Gemini AI phân tích."""
    import httpx
    GEMINI_KEY = "AIzaSyBQ.Ab8RN6LtUjxQV2RbjFEaFrtpNSA9ES2WEpEZ4ptXOnMBqzX0kg"
    try:
        resp = await httpx.AsyncClient(timeout=30).post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_KEY}",
            headers={"content-type": "application/json"},
            json={
                "contents": [{
                    "parts": [
                        {"inline_data": {"mime_type": "image/jpeg", "data": screenshot_b64}},
                        {"text": instruction}
                    ]
                }]
            }
        )
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return {"ok": True, "text": text}
    except Exception as e:
        return {"ok": False, "text": str(e)}

async def fb_login_by_pass(email: str, password: str, session_id: str = None, otp_code: str = None) -> dict:
    """
    Login Facebook bằng email/pass.
    - session_id + otp_code: tiếp tục session đang chờ 2FA
    """
    import base64

    # ── Tiếp tục session 2FA ──
    if session_id and otp_code and session_id in _browser_sessions:
        sess = _browser_sessions[session_id]
        page = sess["page"]
        browser = sess["browser"]
        ctx = sess["ctx"]
        try:
            async def snap2():
                try:
                    data = await page.screenshot(type="jpeg", quality=70, full_page=False)
                    return base64.b64encode(data).decode()
                except: return ""

            # Tìm ô nhập OTP và điền
            otp_selectors = [
                "input[name='approvals_code']",
                "input[name='otp']",
                "input[type='tel']",
                "input[autocomplete='one-time-code']",
                "input[maxlength='6']",
                "#approvals_code",
            ]
            filled = False
            for sel in otp_selectors:
                try:
                    await page.wait_for_selector(sel, timeout=3000)
                    await page.fill(sel, otp_code, timeout=3000)
                    filled = True
                    break
                except: continue

            if not filled:
                sc = await snap2()
                return {"status": "error", "message": "Không tìm thấy ô nhập OTP", "screenshot_b64": sc}

            # Submit
            for sel in ["button[type='submit']", "input[type='submit']", "button:has-text('Tiếp tục')", "button:has-text('Submit')"]:
                try:
                    await page.click(sel, timeout=3000)
                    break
                except: continue

            await asyncio.sleep(4)
            url = page.url
            sc = await snap2()

            # Xử lý kết quả sau OTP
            if "login" not in url and "two_step" not in url and "2fac" not in url and "approvals" not in url:
                cookies = await ctx.cookies()
                c_user = next((c["value"] for c in cookies if c["name"] == "c_user"), "")
                cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in cookies if "facebook.com" in c.get("domain",""))
                del _browser_sessions[session_id]
                await browser.close()
                return {"status": "success", "message": "✅ Đăng nhập thành công!", "uid": c_user, "name": "", "cookie": cookie_str, "screenshot_b64": sc}
            else:
                return {"status": "2fa", "message": "🔐 Mã OTP không đúng hoặc cần nhập lại.", "session_id": session_id, "screenshot_b64": sc}
        except Exception as e:
            return {"status": "error", "message": f"Lỗi OTP: {str(e)}", "screenshot_b64": ""}

    if not PLAYWRIGHT_OK:
        return {"status": "error", "message": "Playwright chưa cài", "screenshot_b64": ""}
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"]
            )
            ctx = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800},
                locale="vi-VN"
            )
            page = await ctx.new_page()

            async def snap(label="") -> str:
                try:
                    data = await page.screenshot(type="jpeg", quality=70, full_page=False)
                    return base64.b64encode(data).decode()
                except: return ""

            # ── 1. Mở trang login ──
            await page.goto("https://www.facebook.com/login", wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(1.5)

            # ── 2. Nhập email + pass ──
            try:
                await page.wait_for_load_state("networkidle", timeout=15000)
                await asyncio.sleep(1)

                email_selectors = ["#email","input[name='email']","input[type='email']","input[placeholder*='mail']","input[placeholder*='số']","input[placeholder*='phone']"]
                email_filled = False
                for sel in email_selectors:
                    try:
                        await page.wait_for_selector(sel, timeout=5000)
                        await page.fill(sel, email, timeout=5000)
                        email_filled = True
                        break
                    except: continue
                if not email_filled:
                    raise Exception("Không tìm thấy ô email")
                await asyncio.sleep(0.4)

                for sel in ["#pass","input[name='pass']","input[type='password']","input[placeholder='Mật khẩu']","input[placeholder='Password']","input[placeholder*='khẩu']"]:
                    try:
                        await page.fill(sel, password, timeout=3000)
                        break
                    except: continue
                await asyncio.sleep(0.4)

                login_clicked = False
                for sel in ["[name='login']","button[type='submit']","[data-testid='royal_login_button']","button:has-text('Đăng nhập')","input[value='Log In']","input[value='Đăng nhập']"]:
                    try:
                        await page.wait_for_selector(sel, timeout=2000)
                        await page.click(sel, timeout=3000)
                        login_clicked = True
                        break
                    except: continue
                if not login_clicked:
                    await page.keyboard.press("Enter")

            except Exception as e:
                sc = await snap()
                await browser.close()
                return {"status": "error", "message": f"Không tìm thấy form login: {e}", "screenshot_b64": sc}

            # Chờ sau khi click login
            try:
                await page.wait_for_url(lambda u: "login" not in u or "checkpoint" in u or "two_step" in u or "approvals" in u, timeout=12000)
            except: pass
            await asyncio.sleep(2)
            url = page.url
            sc = await snap()

            # ── Xử lý CAPTCHA nếu vẫn còn ở login ──
            if "login" in url and "two_step" not in url and "approvals" not in url and "checkpoint" not in url:
                page_text_c = ""
                try: page_text_c = (await page.inner_text("body")).lower()
                except: pass
                if any(k in page_text_c for k in ["captcha","robot","xác minh bảo mật","security check","i'm not a robot","không phải là người máy","nguoi may"]):
                    cap_id = str(uuid.uuid4())
                    _captcha_sessions[cap_id] = {"status": "solving", "result": None, "msg": "⏳ Đang khởi động...", "screenshot_b64": sc}
                    asyncio.create_task(_gemini_solve_captcha(page, ctx, browser, cap_id))
                    return {"status": "captcha_solving", "cap_id": cap_id, "message": "🤖 Đang giải CAPTCHA bằng Gemini AI...", "screenshot_b64": sc}
                await browser.close()
                return {"status": "wrong_pass", "message": "❌ Sai thông tin đăng nhập hoặc tài khoản bị khoá tạm.", "screenshot_b64": sc}

            # ── 3. Phân tích trạng thái ──

            # Thành công
            if ("facebook.com" in url and "login" not in url and
                "checkpoint" not in url and "two_step" not in url and
                "two-step" not in url and "2fac" not in url and "approvals" not in url):
                try:
                    res = await page.evaluate("""
                        async () => {
                            try {
                                const r = await fetch('https://www.facebook.com/api/graphql/', {
                                    method: 'POST',
                                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                                    body: 'variables=%7B%7D&doc_id=3919904814718296'
                                });
                                const t = await r.text();
                                const m = t.match(/"name":"([^"]+)"/);
                                const u = t.match(/"id":"(\d{10,})"/);
                                return {name: m?m[1]:'', uid: u?u[1]:''};
                            } catch(e) { return {name:'',uid:''}; }
                        }
                    """)
                except: res = {"name": "", "uid": ""}

                if not res.get("name"):
                    try:
                        title = await page.title()
                        if title and "Facebook" not in title:
                            res["name"] = title.split("–")[0].split("|")[0].strip()
                    except: pass

                cookies = await ctx.cookies()
                c_user = next((c["value"] for c in cookies if c["name"] == "c_user"), "")
                if not res.get("uid") and c_user: res["uid"] = c_user
                cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in cookies if "facebook.com" in c.get("domain",""))
                await browser.close()
                return {"status": "success", "message": "✅ Đăng nhập thành công!", "name": res.get("name",""), "uid": res.get("uid",""), "cookie": cookie_str, "screenshot_b64": sc}

            # 2FA / OTP - Lưu session lại chờ OTP
            if any(k in url for k in ["two_step","two-step","2fac","approvals"]):
                # Chờ trang 2FA load xong rồi chụp
                try:
                    await page.wait_for_load_state("networkidle", timeout=8000)
                except: pass
                await asyncio.sleep(2)
                sc = await snap()  # Chụp lại sau khi load xong
                new_sid = str(uuid.uuid4())
                _browser_sessions[new_sid] = {"browser": browser, "page": page, "ctx": ctx}
                return {"status": "2fa", "message": "🔐 Tài khoản bật xác minh 2 bước. Nhập mã OTP:", "session_id": new_sid, "screenshot_b64": sc}

            # Checkpoint - Gemini AI phân tích
            if "checkpoint" in url or "confirm" in url:
                page_text = await page.inner_text("body")
                if any(k in page_text.lower() for k in ["disabled","vô hiệu hóa","suspended"]):
                    await browser.close()
                    return {"status": "disabled", "message": "🚫 Tài khoản bị vô hiệu hoá.", "screenshot_b64": sc}
                ai_result = await _ai_analyze_screenshot(sc,
                    "Đây là ảnh chụp màn hình trang Facebook checkpoint. "
                    "Mô tả ngắn gọn Facebook đang yêu cầu gì (xác minh SĐT, email, ảnh ID, nhận dạng bạn bè...). "
                    "Trả lời tiếng Việt, tối đa 2 câu."
                )
                ai_msg = ai_result.get("text", "Tài khoản bị checkpoint.")
                await browser.close()
                return {"status": "checkpoint", "message": f"⚠️ Checkpoint: {ai_msg}", "screenshot_b64": sc}

            # Bị vô hiệu hoá
            page_text = await page.inner_text("body")
            if any(k in page_text.lower() for k in ["disabled","vô hiệu hóa","your account has been"]):
                await browser.close()
                return {"status": "disabled", "message": "🚫 Tài khoản bị Facebook vô hiệu hoá.", "screenshot_b64": sc}

            await browser.close()
            return {"status": "unknown", "message": f"❓ Không xác định trạng thái. URL: {url}", "screenshot_b64": sc}

    except Exception as e:
        return {"status": "error", "message": f"Lỗi: {str(e)[:300]}", "screenshot_b64": ""}
