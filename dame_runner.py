import uuid
"""
dame_runner.py — Playwright headless dame FB
Inject cookie theo bookmark JS từ ảnh → navigate target → auto 13 report
Hỗ trợ: screenshot tab máy ảo realtime
"""
import asyncio, json, re, time, base64
from typing import Optional
try: import httpx; HAS_HTTPX = True
except: HAS_HTTPX = False

try:
    from playwright.async_api import async_playwright, Page, BrowserContext
    PLAYWRIGHT_OK = True
except ImportError:
    PLAYWRIGHT_OK = False

# Auto-install Chromium nếu chưa có
import subprocess as _sp2, sys as _sys2, threading as _threading

def _install_playwright_bg():
    try:
        _sp2.run([_sys2.executable, "-m", "playwright", "install", "chromium", "--with-deps"],
                 check=False, capture_output=True, timeout=300)
    except: pass

_threading.Thread(target=_install_playwright_bg, daemon=True).start()

# ══════════════════════════════════════
# SESSION STATE
# ══════════════════════════════════════
class DameSession:
    def __init__(self):
        self.running   = False
        self.paused    = False
        self.stopped   = False
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
    if not PLAYWRIGHT_OK:
        return {"ok": False, "name": "", "uid": "", "error": "Playwright chưa cài"}
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"]
            )
            ctx = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            # Inject cookie qua context TRƯỚC khi mở trang (bypass httpOnly restriction)
            parsed_cookies = parse_cookie_str(cookie_str)
            if parsed_cookies:
                await ctx.add_cookies(parsed_cookies)
            page = await ctx.new_page()
            await page.goto("https://www.facebook.com", wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(2.5)

            url = page.url
            if "login" in url or "checkpoint" in url:
                # Thử fallback JS inject nếu ctx.add_cookies chưa đủ
                await page.evaluate(build_inject_js(cookie_str))
                await page.reload(wait_until="domcontentloaded", timeout=25000)
                await asyncio.sleep(2)
                url = page.url
                if "login" in url or "checkpoint" in url:
                    await browser.close()
                    return {"ok": False, "name": "", "uid": "", "error": "Cookie die hoặc checkpoint"}

            # Lấy tên + UID qua GraphQL
            result = await page.evaluate("""
                async () => {
                    try {
                        const r = await fetch('https://www.facebook.com/api/graphql/', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                            body: 'variables=%7B%7D&doc_id=3919904814718296'
                        });
                        const t = await r.text();
                        const m = t.match(/"name":"([^"]+)"/);
                        const u = t.match(/"id":"(\\d{10,})"/);
                        return {name: m?m[1]:'', uid: u?u[1]:''};
                    } catch(e) { return {name:'',uid:''}; }
                }
            """)

            # Fallback DOM
            if not result.get("name"):
                try:
                    el = await page.query_selector('[aria-label*="account" i], [aria-label*="tài khoản" i]')
                    if el:
                        lbl = (await el.get_attribute("aria-label") or "")
                        result["name"] = lbl.replace("Tài khoản của ","").replace("account","").strip()
                except: pass

            # Fallback title
            if not result.get("name"):
                title = await page.title()
                if title and "Facebook" not in title:
                    result["name"] = title.split("–")[0].split("|")[0].strip()

            # Fallback c_user từ cookie
            if not result.get("uid"):
                try:
                    cookies = await ctx.cookies()
                    c_user = next((c["value"] for c in cookies if c["name"]=="c_user"), "")
                    if c_user: result["uid"] = c_user
                except: pass

            await browser.close()
            return {"ok": True, "name": result.get("name",""), "uid": result.get("uid","")}
    except Exception as e:
        return {"ok": False, "name": "", "uid": "", "error": str(e)[:200]}

# ══════════════════════════════════════
# LẤY TÊN TARGET
# ══════════════════════════════════════
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
# REPORT FLOW — 13 loại
# ══════════════════════════════════════
REPORT_FLOW = [
    ("Violent · Terrorism",        ["Violent or graphic content","Bạo lực hoặc nội dung đồ họa"], ["Terrorism","Khủng bố"]),
    ("Violent · Calling violence", ["Violent or graphic content","Bạo lực hoặc nội dung đồ họa"], ["Calling for violence","Kêu gọi bạo lực"]),
    ("Violent · Organized crime",  ["Violent or graphic content","Bạo lực hoặc nội dung đồ họa"], ["Organized crime","Tội phạm có tổ chức"]),
    ("Suicide · Eating disorder",  ["Suicide or self-injury","Tự tử hoặc tự làm hại bản thân"],   ["Eating disorder","Rối loạn ăn uống"]),
    ("Scam · Fraud",               ["Scam, fraud or false news","Lừa đảo, gian lận hoặc tin giả"], ["Fraud or scam","Lừa đảo hoặc gian lận"]),
    ("Scam · Spam",                ["Scam, fraud or false news","Lừa đảo, gian lận hoặc tin giả"], ["Spam","Tin rác"]),
    ("Fake · Not real person",     ["Fake account","Tài khoản giả mạo"],                           ["Not a real person","Không phải người thật"]),
    ("Bullying · Harassment",      ["Bullying or harassment","Bắt nạt hoặc quấy rối"],             ["Me","Tôi"]),
    ("Adult · Prostitution",       ["Adult content","Nội dung người lớn"],                         ["Prostitution","Mại dâm"]),
    ("Physical abuse",             ["Violence","Bạo lực"],                                         ["Physical abuse","Bạo hành thể chất"]),
    ("Credible threat",            ["Violent or graphic content","Bạo lực hoặc nội dung đồ họa"], ["Credible threat","Đe dọa đáng tin cậy"]),
    ("Something else",             ["Something else","Điều gì đó khác"],                           []),
    ("Harassment · Other",         ["Bullying or harassment","Bắt nạt hoặc quấy rối"],             ["Someone else","Người khác"]),
]

async def find_and_click(page: Page, texts: list, timeout_ms: int = 5000) -> bool:
    deadline = time.time() + timeout_ms / 1000
    sels = ['button','div[role="button"]','a[role="button"]','span[role="button"]',
            'div[role="menuitem"]','li[role="menuitem"]','div[tabindex="0"]']
    while time.time() < deadline:
        for sel in sels:
            try:
                for el in await page.query_selector_all(sel):
                    try:
                        if not await el.is_visible(): continue
                        txt = (await el.inner_text()).strip().lower()
                        for kw in texts:
                            if kw.lower() in txt:
                                await el.scroll_into_view_if_needed()
                                await el.click()
                                return True
                    except: continue
            except: continue
        await asyncio.sleep(0.15)
    return False

async def click_3dot_menu(page: Page) -> bool:
    for lbl in ["Profile settings see more options","More options","More","See more"]:
        try:
            el = await page.query_selector(f'[aria-label="{lbl}"]')
            if el and await el.is_visible():
                await el.click(); return True
        except: pass
    try:
        for el in await page.query_selector_all('div[aria-haspopup="menu"]'):
            try:
                if await el.is_visible():
                    await el.click(); return True
            except: pass
    except: pass
    return False

async def do_one_report(page: Page, report: tuple, speed: str) -> bool:
    c = cfg(speed)
    rname, first_texts, second_texts = report
    DAME_SESSION.add_log(f"▶ {rname}")

    await click_3dot_menu(page)
    await asyncio.sleep(c["click"] / 1000)

    ok = await find_and_click(page, ["Report profile","Báo cáo trang cá nhân","Báo cáo","Report"], 5000)
    if not ok:
        DAME_SESSION.add_log(f"⚠ Bỏ qua {rname} (không tìm được nút Report)")
        return False
    await asyncio.sleep(c["action"] / 1000)

    await find_and_click(page, ["Something about this profile","Có gì đó về trang cá nhân này"], 2500)
    await asyncio.sleep(c["click"] / 1000)

    if first_texts:
        await find_and_click(page, first_texts, 5000)
        await asyncio.sleep(c["action"] / 1000)

    if second_texts:
        await find_and_click(page, second_texts, 5000)
        await asyncio.sleep(c["action"] / 1000)

    for btns in [["Submit","Gửi","Gửi báo cáo"],["Next","Tiếp","Tiếp tục"],["Done","Xong","Close","Đóng"]]:
        await find_and_click(page, btns, 4000)
        await asyncio.sleep(c["done"] / 1000)

    DAME_SESSION.total += 1
    DAME_SESSION.add_log(f"✅ {rname} ✓ · tổng: {DAME_SESSION.total}")
    return True

# ══════════════════════════════════════
# MAIN DAME LOOP
# ══════════════════════════════════════
async def _dame_loop(cookie_str: str, target_url: str, speed: str):
    if not PLAYWRIGHT_OK:
        DAME_SESSION.add_log("❌ Playwright chưa cài!")
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
            page = await ctx.new_page()
            DAME_SESSION._page = page  # lưu ref để screenshot

            # Bắt đầu vòng chụp screenshot nền
            screenshot_task = asyncio.create_task(_screenshot_loop())

            # Inject cookie
            DAME_SESSION.add_log("🍪 Inject cookie...")
            parsed_cookies = parse_cookie_str(cookie_str)
            if parsed_cookies:
                await ctx.add_cookies(parsed_cookies)
            await page.goto("https://www.facebook.com", wait_until="domcontentloaded", timeout=25000)
            # JS inject fallback để đảm bảo
            await page.evaluate(build_inject_js(cookie_str))
            await page.reload(wait_until="domcontentloaded", timeout=25000)
            await asyncio.sleep(2.5)

            if "login" in page.url or "checkpoint" in page.url:
                DAME_SESSION.add_log("❌ Cookie die / checkpoint!")
                DAME_SESSION.stopped = True; DAME_SESSION.running = False
                screenshot_task.cancel()
                await browser.close(); return

            DAME_SESSION.add_log("✅ Login OK · Đang mở target...")
            await page.goto(target_url, wait_until="domcontentloaded", timeout=25000)
            await asyncio.sleep(2.5)

            if "login" in page.url:
                DAME_SESSION.add_log("❌ Không mở được target!")
                DAME_SESSION.stopped = True; DAME_SESSION.running = False
                screenshot_task.cancel()
                await browser.close(); return

            DAME_SESSION.add_log(f"🎯 Target OK: {page.url}")
            c = cfg(speed)
            loop_n = 0

            while not DAME_SESSION.stopped:
                loop_n += 1
                DAME_SESSION.loops = loop_n
                DAME_SESSION.add_log(f"━━━ Vòng {loop_n} ━━━")

                for report in REPORT_FLOW:
                    if DAME_SESSION.stopped: break
                    while DAME_SESSION.paused and not DAME_SESSION.stopped:
                        await asyncio.sleep(0.5)
                    if DAME_SESSION.stopped: break

                    try:
                        await page.goto(target_url, wait_until="domcontentloaded", timeout=20000)
                        await asyncio.sleep(1.2)
                    except: pass

                    try:
                        await do_one_report(page, report, speed)
                    except Exception as e:
                        DAME_SESSION.add_log(f"⚠ {report[0]}: {str(e)[:60]}")

                    await asyncio.sleep(c["inter"] / 1000)

                if not DAME_SESSION.stopped:
                    DAME_SESSION.add_log(f"🔄 Xong vòng {loop_n} · Tổng: {DAME_SESSION.total} báo cáo")
                    await asyncio.sleep(c["loop"] / 1000)

            screenshot_task.cancel()
            await browser.close()
            DAME_SESSION.add_log(f"⏹ Kết thúc · Tổng: {DAME_SESSION.total} báo cáo")

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
        "total":    DAME_SESSION.total,
        "loops":    DAME_SESSION.loops,
        "log":      DAME_SESSION.log,
        "logs":     DAME_SESSION.pop_logs(),
        "name":     DAME_SESSION.name,
        "uid":      DAME_SESSION.uid,
    }

def get_screenshot() -> str:
    """Trả về ảnh JPEG base64 của tab máy ảo, hoặc '' nếu chưa có"""
    return DAME_SESSION.screenshot_b64

# ══════════════════════════════════════
# LOGIN FACEBOOK BẰNG EMAIL + MẬT KHẨU
# ══════════════════════════════════════

# ── Browser session store (giữ browser đang mở cho 2FA/checkpoint) ──
_browser_sessions = {}  # session_id -> {"browser": ..., "page": ..., "ctx": ...}

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

# ── Captcha session store ──
_captcha_sessions = {}  # cap_id -> {"status":"solving/done/error","msg":"...","screenshot_b64":"...","result":{}}

def _cap_update(cap_id: str, msg: str, sc: str = None):
    """Cập nhật message + ảnh realtime cho frontend poll."""
    _captcha_sessions[cap_id]["msg"] = msg
    if sc is not None:
        _captcha_sessions[cap_id]["screenshot_b64"] = sc


async def _gemini_solve_captcha(page, ctx, browser, cap_id: str):
    """
    Flow giải captcha step-by-step:
    1. Đợi 7s captcha load xong
    2. Chụp → gửi Gemini tìm tọa độ checkbox
    3. Click checkbox → đợi 7s → Gemini xác nhận đã tích
    4. Click Login → xử lý success / 2fa / fail
    """
    import base64
    import re as _re
    import json as _json

    async def snap() -> str:
        try:
            data = await page.screenshot(type="jpeg", quality=75, full_page=False)
            return base64.b64encode(data).decode()
        except:
            return ""

    def parse_json(text: str) -> dict:
        text = text.strip()
        m = _re.search(r'\{[^{}]*\}', text, _re.DOTALL)
        if m:
            try:
                return _json.loads(m.group())
            except:
                pass
        return {}

    try:
        # ── 1. Chờ captcha load (5s delay bắt buộc trước khi giải) ──
        _cap_update(cap_id, "⏳ Đang chờ CAPTCHA load xong...")
        await asyncio.sleep(5)
        sc = await snap()
        _cap_update(cap_id, "📸 Đã chụp ảnh — đang gửi Gemini phân tích...", sc)

        # ── 2. Gemini tìm checkbox ──
        prompt1 = (
            "Day la anh chup man hinh trinh duyet dang hien captcha reCAPTCHA cua Facebook/Meta. "
            "Xac dinh xem co checkbox vuong nho 'Toi khong phai la nguoi may' / 'I am not a robot' khong. "
            "Neu co, tra ve JSON: "
            + '{"has_captcha": true, "x_percent": <so 0-100>, "y_percent": <so 0-100>}'
            + " voi x_percent, y_percent la toa do TRUNG TAM o vuong checkbox, "
            "tinh theo phan tram chieu rong va chieu cao anh. "
            "Neu khong thay captcha, tra ve: "
            + '{"has_captcha": false}'
            + ". Chi tra ve JSON, khong them gi khac."
        )
        ai1 = await _ai_analyze_screenshot(sc, prompt1)
        gemini_data = parse_json(ai1.get("text", ""))

        clicked = False

        if gemini_data.get("has_captcha"):
            x_pct = float(gemini_data.get("x_percent", 10))
            y_pct = float(gemini_data.get("y_percent", 50))
            vp = page.viewport_size or {"width": 1280, "height": 800}
            x = int(vp["width"]  * x_pct / 100)
            y = int(vp["height"] * y_pct / 100)
            _cap_update(cap_id, f"🖱️ Gemini xác định checkbox tại ({x_pct:.0f}%, {y_pct:.0f}%) — đang click...", sc)
            try:
                await page.mouse.click(x, y)
                clicked = True
            except:
                pass

        # Fallback: selector iframe reCAPTCHA
        if not clicked:
            _cap_update(cap_id, "🔍 Thử selector trực tiếp vào iframe reCAPTCHA...", sc)
            try:
                iframe_el = await page.query_selector("iframe[src*='recaptcha']")
                if iframe_el:
                    frame = await iframe_el.content_frame()
                    if frame:
                        cb = await frame.query_selector("#recaptcha-anchor")
                        if cb:
                            await cb.click()
                            clicked = True
            except:
                pass

        # Fallback: selector thô
        if not clicked:
            for sel in [
                ".recaptcha-checkbox",
                "[aria-label*='robot']",
                "[aria-label*='human']",
                "[aria-label*='not a robot']",
                "span.recaptcha-checkbox-border",
            ]:
                try:
                    el = await page.query_selector(sel)
                    if el:
                        await el.click()
                        clicked = True
                        break
                except:
                    continue

        # ── 3. Đợi xác nhận sau click ──
        _cap_update(cap_id, "✅ Đã click checkbox! Đang đợi CAPTCHA xác nhận... (7s)")
        await asyncio.sleep(7)
        sc2 = await snap()

        prompt2 = (
            "Checkbox reCAPTCHA 'Toi khong phai la nguoi may' da duoc tich (hien dau check xanh / animation) chua? "
            + 'Tra ve JSON: {"checked": true} hoac {"checked": false}. Chi JSON.'
        )
        ai2 = await _ai_analyze_screenshot(sc2, prompt2)
        check_data = parse_json(ai2.get("text", ""))

        if check_data.get("checked"):
            _cap_update(cap_id, "🎉 CAPTCHA xác nhận thành công! Đang tiếp tục đăng nhập...", sc2)
        else:
            _cap_update(cap_id, "⚠️ Chưa chắc đã tích xong — vẫn thử tiếp tục đăng nhập...", sc2)

        # ── 4. Click nút Login ──
        for sel in [
            "[name='login']",
            "button[type='submit']",
            "button:has-text('Đăng nhập')",
            "button:has-text('Log In')",
        ]:
            try:
                await page.click(sel, timeout=2000)
                break
            except:
                continue

        try:
            await page.wait_for_url(
                lambda u: "login" not in u or "checkpoint" in u or "two_step" in u or "approvals" in u,
                timeout=15000,
            )
        except:
            pass
        await asyncio.sleep(4)

        url = page.url
        sc3 = await snap()

        # ── 5. Phân tích kết quả ──

        # Thành công
        if (
            "facebook.com" in url
            and "login" not in url
            and "checkpoint" not in url
            and "two_step" not in url
            and "2fac" not in url
            and "approvals" not in url
        ):
            cookies = await ctx.cookies()
            c_user = next((c["value"] for c in cookies if c["name"] == "c_user"), "")
            cookie_str = "; ".join(
                f"{c['name']}={c['value']}"
                for c in cookies
                if "facebook.com" in c.get("domain", "")
            )
            _cap_update(cap_id, "✅ Đăng nhập thành công sau khi giải CAPTCHA!", sc3)
            await browser.close()
            _captcha_sessions[cap_id]["status"] = "done"
            _captcha_sessions[cap_id]["result"] = {
                "status": "success",
                "message": "✅ Đăng nhập thành công! (CAPTCHA đã giải xong)",
                "uid": c_user,
                "name": "",
                "cookie": cookie_str,
                "screenshot_b64": sc3,
            }
            return

        # 2FA sau captcha
        if any(k in url for k in ["two_step", "two-step", "2fac", "approvals"]):
            try:
                await page.wait_for_load_state("networkidle", timeout=8000)
            except:
                pass
            await asyncio.sleep(3)
            sc3 = await snap()

            prompt3 = (
                "Day la man hinh xac minh 2 buoc (2FA) cua Facebook. "
                "Xac dinh loai phuong thuc 2FA dang hien. "
                "Cac loai co the co: "
                "1) 'authenticator_app' - nhap ma 6 so tu app Authenticator (Google/Microsoft Authenticator), "
                "2) 'sms_whatsapp' - nhan ma qua SMS hoac WhatsApp, "
                "3) 'facebook_notification' - xac nhan qua thong bao Facebook tren thiet bi khac, "
                "4) 'email_code' - nhan ma qua email/Gmail. "
                "Neu co nhieu nut lua chon tren trang, liet ke tat ca cac loai co the chon. "
                'Tra ve JSON: {"primary_type": "<loai chinh dang hien>", "available_types": ["<loai1>","<loai2>",...], "desc": "<mo ta ngan tieng Viet>"}. '
                "Chi JSON."
            )
            ai3 = await _ai_analyze_screenshot(sc3, prompt3)
            tfa_data = parse_json(ai3.get("text", ""))
            if not tfa_data.get("primary_type"):
                tfa_data = {"primary_type": "sms_whatsapp", "available_types": ["authenticator_app","sms_whatsapp","facebook_notification","email_code"], "desc": "Chọn phương thức xác minh 2 bước"}

            tfa_desc = tfa_data.get("desc", "Chọn phương thức xác minh")
            available = tfa_data.get("available_types") or ["authenticator_app","sms_whatsapp","facebook_notification","email_code"]
            _cap_update(cap_id, f"🔐 Cần xác minh 2 bước: {tfa_desc}", sc3)

            new_sid = str(uuid.uuid4())
            _browser_sessions[new_sid] = {"browser": browser, "page": page, "ctx": ctx}
            _captcha_sessions[cap_id]["status"] = "done"
            _captcha_sessions[cap_id]["result"] = {
                "status": "2fa",
                "message": f"🔐 {tfa_desc}",
                "tfa_type": tfa_data.get("primary_type", "sms_whatsapp"),
                "tfa_options": available,
                "session_id": new_sid,
                "screenshot_b64": sc3,
            }
            return

        # Thất bại
        _cap_update(cap_id, "❌ Không giải được CAPTCHA.", sc3)
        await browser.close()
        _captcha_sessions[cap_id]["status"] = "done"
        _captcha_sessions[cap_id]["result"] = {
            "status": "captcha_fail",
            "message": "❌ Không giải được CAPTCHA. Vui lòng thử lại.",
            "screenshot_b64": sc3,
        }

    except Exception as e:
        _captcha_sessions[cap_id]["status"] = "error"
        _captcha_sessions[cap_id]["result"] = {
            "status": "error",
            "message": f"Lỗi giải captcha: {str(e)[:200]}",
            "screenshot_b64": "",
        }


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

            await asyncio.sleep(9)   # đợi FB xử lý OTP & redirect xong
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

            # ── Xử lý CAPTCHA nếu vẫn còn ở trang login ──
            if "login" in url and "two_step" not in url and "approvals" not in url and "checkpoint" not in url:
                page_text_cap = ""
                try: page_text_cap = (await page.inner_text("body")).lower()
                except: pass
                has_cap = any(k in page_text_cap for k in ["captcha","robot","xác minh bảo mật","security check","i'm not a robot","không phải là người máy","nguoi may"])
                if has_cap:
                    cap_id = str(uuid.uuid4())
                    _captcha_sessions[cap_id] = {"status": "solving", "result": None, "msg": ""}
                    sc_now = await snap()
                    _captcha_sessions[cap_id]["screenshot_b64"] = sc_now
                    asyncio.create_task(_gemini_solve_captcha(page, ctx, browser, cap_id))
                    return {"status": "captcha_solving", "cap_id": cap_id,
                            "message": "🤖 Đang giải CAPTCHA bằng AI...", "screenshot_b64": sc_now}
                # Không có captcha → sai pass / bị khoá
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
                try:
                    await page.wait_for_load_state("networkidle", timeout=8000)
                except: pass
                await asyncio.sleep(2)
                sc = await snap()

                # Hỏi Gemini loại 2FA
                prompt_tfa = (
                    "Day la man hinh xac minh 2 buoc (2FA) cua Facebook. "
                    "Xac dinh loai phuong thuc 2FA dang hien. "
                    "Cac loai: 1)'authenticator_app' ma 6 so tu Authenticator app, "
                    "2)'sms_whatsapp' ma qua SMS/WhatsApp, "
                    "3)'facebook_notification' xac nhan qua thiet bi khac, "
                    "4)'email_code' ma qua email. "
                    "Neu co nhieu lua chon, liet ke tat ca. "
                    'JSON: {"primary_type":"<loai>","available_types":["<loai1>",...],"desc":"<mo ta ngan tieng Viet>"}. Chi JSON.'
                )
                ai_tfa = await _ai_analyze_screenshot(sc, prompt_tfa)
                tfa_data = {}
                try:
                    import re as _re2, json as _json2
                    txt = ai_tfa.get("text","")
                    m = _re2.search(r'\{[^{}]*\}', txt, _re2.DOTALL)
                    if m: tfa_data = _json2.loads(m.group())
                except: pass
                if not tfa_data.get("primary_type"):
                    tfa_data = {"primary_type": "sms_whatsapp", "available_types": ["authenticator_app","sms_whatsapp","facebook_notification","email_code"], "desc": "Nhập mã xác minh 2 bước"}

                new_sid = str(uuid.uuid4())
                _browser_sessions[new_sid] = {"browser": browser, "page": page, "ctx": ctx}
                return {
                    "status": "2fa",
                    "message": f"🔐 {tfa_data.get('desc','Nhập mã xác minh 2 bước')}",
                    "tfa_type": tfa_data.get("primary_type","sms_whatsapp"),
                    "tfa_options": tfa_data.get("available_types", ["authenticator_app","sms_whatsapp","facebook_notification","email_code"]),
                    "session_id": new_sid,
                    "screenshot_b64": sc
                }

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
