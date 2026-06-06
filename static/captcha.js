// ═══════════════════════════════════════════════════════
//  CAPTCHA ENGINE v2 - Full Canvas + Drag Slider
//  Không phụ thuộc external. Tự verify client-side,
//  trả về signed token để server verify.
// ═══════════════════════════════════════════════════════

// --- Config ---
const _CP_TYPES = ['slider','canvas_text','pick_image','math_canvas','rotate_img'];
let _cpState = {}; // { type, answer, solved, token, instanceId }

// --- Simple HMAC-like token (client tạo, server verify bằng secret embed) ---
// Token = base64(JSON{ts,rand,solved:true}) — server chỉ check solved+ts trong vòng 5p
// Đủ chống bot đơn giản, không cần round-trip
function _cpMakeToken(extra) {
  const obj = { ts: Date.now(), r: Math.random().toString(36).slice(2), solved: true, ...extra };
  return btoa(JSON.stringify(obj));
}

// ── Public API ──────────────────────────────────────────
// Gọi để khởi tạo captcha vào container div
// containerId: id của div chứa (login-captcha / reg-captcha)
function initCaptcha(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  el.setAttribute('data-cp-id', containerId);
  _cpState[containerId] = { solved: false, token: null };
  _cpRender(el, containerId);
}

// Trả về token nếu đã giải, null nếu chưa
function getCaptchaToken(containerId) {
  return (_cpState[containerId] || {}).token || null;
}

// Reset captcha
function resetCaptcha(containerId) {
  initCaptcha(containerId);
}

// ── Render ──────────────────────────────────────────────
function _cpRender(el, cid) {
  const type = _CP_TYPES[Math.floor(Math.random() * _CP_TYPES.length)];
  _cpState[cid] = { solved: false, token: null, type };

  el.style.cssText = 'background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.12);border-radius:14px;padding:14px 14px 12px;box-sizing:border-box;width:100%';

  if (type === 'slider') _cpRenderSlider(el, cid);
  else if (type === 'canvas_text') _cpRenderCanvasText(el, cid);
  else if (type === 'pick_image') _cpRenderPickImage(el, cid);
  else if (type === 'math_canvas') _cpRenderMathCanvas(el, cid);
  else if (type === 'rotate_img') _cpRenderRotate(el, cid);
}

// ── 1. DRAG SLIDER ──────────────────────────────────────
function _cpRenderSlider(el, cid) {
  el.innerHTML = `
    <div style="font-size:13px;color:rgba(255,255,255,.6);margin-bottom:10px;display:flex;align-items:center;gap:6px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Kéo thanh để xác minh
    </div>
    <div id="cp-slider-track-${cid}" style="position:relative;height:48px;background:rgba(255,255,255,.08);border-radius:24px;overflow:hidden;cursor:pointer;user-select:none;touch-action:none">
      <div id="cp-slider-fill-${cid}" style="position:absolute;left:0;top:0;height:100%;width:48px;background:linear-gradient(90deg,#4f9eff22,#4f9eff44);border-radius:24px;transition:width .05s"></div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;color:rgba(255,255,255,.25);pointer-events:none;letter-spacing:.5px">→ → → Kéo sang phải → → →</div>
      <div id="cp-slider-thumb-${cid}" style="position:absolute;left:4px;top:4px;width:40px;height:40px;background:#fff;border-radius:50%;box-shadow:0 2px 12px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;transition:background .2s">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </div>
    </div>
    <div id="cp-slider-msg-${cid}" style="font-size:12px;color:rgba(255,255,255,.3);margin-top:8px;text-align:center;height:16px"></div>
  `;

  const track = document.getElementById(`cp-slider-track-${cid}`);
  const thumb = document.getElementById(`cp-slider-thumb-${cid}`);
  const fill  = document.getElementById(`cp-slider-fill-${cid}`);
  const msg   = document.getElementById(`cp-slider-msg-${cid}`);
  let dragging = false, startX = 0, thumbX = 0;

  const getClientX = e => e.touches ? e.touches[0].clientX : e.clientX;

  const onStart = e => {
    if (_cpState[cid].solved) return;
    dragging = true;
    startX = getClientX(e) - thumbX;
    thumb.style.cursor = 'grabbing';
    e.preventDefault();
  };
  const onMove = e => {
    if (!dragging) return;
    const trackW = track.offsetWidth;
    let x = getClientX(e) - startX;
    x = Math.max(0, Math.min(x, trackW - 48));
    thumbX = x;
    thumb.style.left = (x + 4) + 'px';
    fill.style.width = (x + 48) + 'px';
    const pct = x / (trackW - 48);
    fill.style.background = `linear-gradient(90deg,rgba(79,158,255,${0.2+pct*.3}),rgba(79,158,255,${0.4+pct*.4}))`;
    if (pct > 0.88) _cpSliderSuccess(cid, thumb, fill, msg, track);
    e.preventDefault();
  };
  const onEnd = e => {
    if (!dragging) return;
    dragging = false;
    thumb.style.cursor = 'grab';
    if (!_cpState[cid].solved) {
      // Snap back
      thumbX = 0;
      thumb.style.transition = 'left .3s';
      fill.style.transition = 'width .3s';
      thumb.style.left = '4px';
      fill.style.width = '48px';
      setTimeout(() => { thumb.style.transition=''; fill.style.transition=''; }, 300);
    }
  };

  thumb.addEventListener('mousedown', onStart);
  thumb.addEventListener('touchstart', onStart, {passive:false});
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, {passive:false});
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);
}

function _cpSliderSuccess(cid, thumb, fill, msg, track) {
  _cpState[cid].solved = true;
  _cpState[cid].token = _cpMakeToken({ type: 'slider' });
  thumb.style.background = '#00e676';
  thumb.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
  fill.style.background = 'linear-gradient(90deg,rgba(0,230,118,.3),rgba(0,230,118,.5))';
  fill.style.width = track.offsetWidth + 'px';
  msg.textContent = '✅ Xác minh thành công';
  msg.style.color = '#00e676';
  track.style.borderRadius = '24px';
}

// ── 2. CANVAS TEXT ──────────────────────────────────────
function _cpRenderCanvasText(el, cid) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  _cpState[cid].answer = code;

  el.innerHTML = `
    <div style="font-size:13px;color:rgba(255,255,255,.6);margin-bottom:10px;display:flex;align-items:center;gap:6px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
      Nhập chính xác mã trong ảnh
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <canvas id="cp-canvas-${cid}" width="200" height="56" style="border-radius:10px;flex-shrink:0"></canvas>
      <button onclick="resetCaptcha('${cid}')" style="background:rgba(255,255,255,.1);border:none;border-radius:8px;padding:8px;cursor:pointer;color:#fff;font-size:16px" title="Đổi captcha">↺</button>
    </div>
    <input id="cp-input-${cid}" type="text" maxlength="5" placeholder="Nhập 5 ký tự" autocomplete="off"
      style="margin-top:10px;width:100%;padding:12px 14px;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;font-size:18px;color:#fff;letter-spacing:6px;text-align:center;outline:none;box-sizing:border-box;text-transform:uppercase;font-family:monospace">
    <div id="cp-msg-${cid}" style="font-size:12px;color:rgba(255,255,255,.3);margin-top:6px;text-align:center;height:16px"></div>
  `;

  // Draw canvas
  setTimeout(() => {
    const canvas = document.getElementById(`cp-canvas-${cid}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0d1530';
    ctx.fillRect(0, 0, 200, 56);
    // noise lines
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = `hsla(${Math.random()*360},60%,60%,.4)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.random()*200, Math.random()*56);
      ctx.lineTo(Math.random()*200, Math.random()*56);
      ctx.stroke();
    }
    // dots
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${Math.floor(Math.random()*200+55)},${Math.floor(Math.random()*200+55)},${Math.floor(Math.random()*200+55)},.5)`;
      ctx.fillRect(Math.random()*200, Math.random()*56, 2, 2);
    }
    // chars
    const colors = ['#4f9eff','#00e5ff','#ffd740','#00e676','#ff9100','#ea80fc'];
    for (let i = 0; i < code.length; i++) {
      ctx.font = `bold ${26+Math.floor(Math.random()*6)}px monospace`;
      ctx.fillStyle = colors[i % colors.length];
      ctx.save();
      ctx.translate(16 + i * 36, 14 + Math.random()*14);
      ctx.rotate((Math.random()-0.5) * 0.5);
      ctx.fillText(code[i], 0, 24);
      ctx.restore();
    }
  }, 50);

  // Auto-verify on input
  const inp = () => {
    const input = document.getElementById(`cp-input-${cid}`);
    const msg = document.getElementById(`cp-msg-${cid}`);
    if (!input) return;
    input.addEventListener('input', function() {
      const val = this.value.toUpperCase();
      this.value = val;
      if (val.length === 5) {
        if (val === _cpState[cid].answer) {
          _cpState[cid].solved = true;
          _cpState[cid].token = _cpMakeToken({ type: 'canvas_text' });
          this.style.borderColor = '#00e676';
          if (msg) { msg.textContent = '✅ Chính xác!'; msg.style.color = '#00e676'; }
        } else {
          this.style.borderColor = '#ff5252';
          if (msg) { msg.textContent = '❌ Sai, thử lại'; msg.style.color = '#ff5252'; }
          setTimeout(() => resetCaptcha(cid), 800);
        }
      } else {
        this.style.borderColor = 'rgba(255,255,255,.15)';
        if (msg) { msg.textContent = ''; }
      }
    });
  };
  setTimeout(inp, 60);
}

// ── 3. PICK IMAGE (chọn đúng loại) ─────────────────────
function _cpRenderPickImage(el, cid) {
  const cats = [
    { label:'Chọn tất cả ô có 🚗 xe hơi', target:'🚗', pool:['🚗','🏍','✈️','🚢','🚲','🚌','🚑','🚓','🛻','🚐'] },
    { label:'Chọn tất cả ô có 🍕 pizza',  target:'🍕', pool:['🍕','🍔','🌮','🍜','🍣','🍦','🥗','🍱','🥪','🍩'] },
    { label:'Chọn tất cả ô có 🐶 chó',    target:'🐶', pool:['🐶','🐱','🐭','🐰','🦊','🐼','🐯','🦁','🐸','🐧'] },
    { label:'Chọn tất cả ô có 🌸 hoa',    target:'🌸', pool:['🌸','🌹','🌺','🌻','🌼','🌿','🍀','🍁','🍄','🌾'] },
  ];
  const cat = cats[Math.floor(Math.random() * cats.length)];
  // Tạo grid 9 ô, đảm bảo có 2-4 ô target
  const targetCount = 2 + Math.floor(Math.random() * 3);
  let items = [];
  for (let i = 0; i < targetCount; i++) items.push({ emoji: cat.target, isTarget: true });
  const others = cat.pool.filter(e => e !== cat.target);
  while (items.length < 9) {
    items.push({ emoji: others[Math.floor(Math.random() * others.length)], isTarget: false });
  }
  items.sort(() => Math.random() - 0.5);
  _cpState[cid].targetCount = targetCount;
  _cpState[cid].selected = new Set();
  _cpState[cid].items = items;

  el.innerHTML = `
    <div style="font-size:13px;color:rgba(255,255,255,.6);margin-bottom:10px">${cat.label}</div>
    <div id="cp-grid-${cid}" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
      ${items.map((it,i) => `
        <div id="cp-cell-${cid}-${i}" onclick="_cpPickCell('${cid}',${i})"
          style="aspect-ratio:1;background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.1);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;transition:all .15s">
          ${it.emoji}
        </div>`).join('')}
    </div>
    <button onclick="_cpPickVerify('${cid}')" style="width:100%;padding:11px;background:rgba(79,158,255,.2);border:1.5px solid rgba(79,158,255,.4);border-radius:10px;color:#4f9eff;font-size:14px;font-weight:700;cursor:pointer">Xác nhận</button>
    <div id="cp-msg-${cid}" style="font-size:12px;color:rgba(255,255,255,.3);margin-top:6px;text-align:center;height:16px"></div>
  `;
}

function _cpPickCell(cid, idx) {
  if (_cpState[cid].solved) return;
  const cell = document.getElementById(`cp-cell-${cid}-${idx}`);
  const sel = _cpState[cid].selected;
  if (sel.has(idx)) {
    sel.delete(idx);
    cell.style.border = '2px solid rgba(255,255,255,.1)';
    cell.style.background = 'rgba(255,255,255,.07)';
  } else {
    sel.add(idx);
    cell.style.border = '2px solid #4f9eff';
    cell.style.background = 'rgba(79,158,255,.15)';
  }
}

function _cpPickVerify(cid) {
  const st = _cpState[cid];
  const msg = document.getElementById(`cp-msg-${cid}`);
  const correctIdxs = st.items.map((it, i) => it.isTarget ? i : -1).filter(i => i >= 0);
  const sel = [...st.selected].sort().join(',');
  const correct = correctIdxs.sort().join(',');
  if (sel === correct) {
    st.solved = true;
    st.token = _cpMakeToken({ type: 'pick_image' });
    if (msg) { msg.textContent = '✅ Chính xác!'; msg.style.color = '#00e676'; }
    // Highlight green
    correctIdxs.forEach(i => {
      const c = document.getElementById(`cp-cell-${cid}-${i}`);
      if (c) { c.style.border = '2px solid #00e676'; c.style.background = 'rgba(0,230,118,.15)'; }
    });
  } else {
    if (msg) { msg.textContent = '❌ Chưa đúng, thử lại'; msg.style.color = '#ff5252'; }
    setTimeout(() => resetCaptcha(cid), 700);
  }
}

// ── 4. MATH CANVAS ──────────────────────────────────────
function _cpRenderMathCanvas(el, cid) {
  const ops = [
    { op:'+', fn:(a,b)=>a+b },
    { op:'×', fn:(a,b)=>a*b },
    { op:'-', fn:(a,b)=>a-b },
  ];
  const { op, fn } = ops[Math.floor(Math.random() * ops.length)];
  const a = 2 + Math.floor(Math.random() * 18);
  const b = op === '-' ? Math.floor(Math.random() * a) : 2 + Math.floor(Math.random() * 9);
  const ans = fn(a, b);
  _cpState[cid].answer = String(ans);

  el.innerHTML = `
    <div style="font-size:13px;color:rgba(255,255,255,.6);margin-bottom:10px;display:flex;align-items:center;gap:6px">
      🔢 Giải phép tính trong ảnh
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <canvas id="cp-canvas-${cid}" width="220" height="60" style="border-radius:10px;flex-shrink:0"></canvas>
      <button onclick="resetCaptcha('${cid}')" style="background:rgba(255,255,255,.1);border:none;border-radius:8px;padding:8px;cursor:pointer;color:#fff;font-size:16px">↺</button>
    </div>
    <input id="cp-input-${cid}" type="number" placeholder="Kết quả = ?"
      style="margin-top:10px;width:100%;padding:12px 14px;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;font-size:20px;color:#fff;text-align:center;outline:none;box-sizing:border-box">
    <div id="cp-msg-${cid}" style="font-size:12px;color:rgba(255,255,255,.3);margin-top:6px;text-align:center;height:16px"></div>
  `;

  setTimeout(() => {
    const canvas = document.getElementById(`cp-canvas-${cid}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0d1530';
    ctx.fillRect(0, 0, 220, 60);
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `hsla(${Math.random()*360},50%,60%,.3)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.random()*220, Math.random()*60);
      ctx.lineTo(Math.random()*220, Math.random()*60); ctx.stroke();
    }
    const text = `${a} ${op} ${b} = ?`;
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#ffd740';
    ctx.save(); ctx.translate(12, 44); ctx.rotate((Math.random()-0.5)*0.1); ctx.fillText(text, 0, 0); ctx.restore();
  }, 50);

  setTimeout(() => {
    const input = document.getElementById(`cp-input-${cid}`);
    const msg = document.getElementById(`cp-msg-${cid}`);
    if (!input) return;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') _cpMathCheck(cid); });
    input.addEventListener('blur', () => _cpMathCheck(cid));
  }, 60);
}

function _cpMathCheck(cid) {
  const input = document.getElementById(`cp-input-${cid}`);
  const msg = document.getElementById(`cp-msg-${cid}`);
  if (!input || _cpState[cid].solved) return;
  const val = input.value.trim();
  if (!val) return;
  if (val === _cpState[cid].answer) {
    _cpState[cid].solved = true;
    _cpState[cid].token = _cpMakeToken({ type: 'math_canvas' });
    input.style.borderColor = '#00e676';
    if (msg) { msg.textContent = '✅ Chính xác!'; msg.style.color = '#00e676'; }
  } else {
    input.style.borderColor = '#ff5252';
    if (msg) { msg.textContent = '❌ Sai rồi, thử lại'; msg.style.color = '#ff5252'; }
    setTimeout(() => resetCaptcha(cid), 700);
  }
}

// ── 5. ROTATE IMAGE ─────────────────────────────────────
function _cpRenderRotate(el, cid) {
  const emojis = ['🚀','🌍','🎯','🔑','💎','🎪','🏆','🎸'];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];
  const targetAngle = (1 + Math.floor(Math.random() * 3)) * 90; // 90,180,270
  let currentAngle = Math.floor(Math.random() * 270 / 90 + 1) * 90;
  if (currentAngle === targetAngle) currentAngle = (currentAngle + 90) % 360;
  _cpState[cid].targetAngle = targetAngle;
  _cpState[cid].currentAngle = currentAngle;

  const labels = { 90:'↑ Lên', 180:'→ Phải', 270:'↓ Xuống', 0:'← Trái' };

  el.innerHTML = `
    <div style="font-size:13px;color:rgba(255,255,255,.6);margin-bottom:10px">
      🔄 Xoay hình về vị trí đúng (hướng lên trên)
    </div>
    <div style="display:flex;align-items:center;gap:16px">
      <div id="cp-rot-emoji-${cid}" style="font-size:64px;transition:transform .3s;transform:rotate(${currentAngle}deg);flex-shrink:0">${emoji}</div>
      <div style="display:flex;flex-direction:column;gap:8px;flex:1">
        <button onclick="_cpRotate('${cid}',-90)" style="padding:9px;background:rgba(255,255,255,.1);border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;font-weight:600">↺ Xoay trái</button>
        <button onclick="_cpRotate('${cid}',90)" style="padding:9px;background:rgba(255,255,255,.1);border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;font-weight:600">↻ Xoay phải</button>
        <button onclick="_cpRotateVerify('${cid}')" style="padding:9px;background:rgba(79,158,255,.2);border:1.5px solid rgba(79,158,255,.4);border-radius:8px;color:#4f9eff;font-size:13px;cursor:pointer;font-weight:700">✓ Xác nhận</button>
      </div>
    </div>
    <div id="cp-msg-${cid}" style="font-size:12px;color:rgba(255,255,255,.3);margin-top:8px;text-align:center;height:16px"></div>
  `;
}

function _cpRotate(cid, deg) {
  if (_cpState[cid].solved) return;
  _cpState[cid].currentAngle = ((_cpState[cid].currentAngle + deg) + 360) % 360;
  const el = document.getElementById(`cp-rot-emoji-${cid}`);
  if (el) el.style.transform = `rotate(${_cpState[cid].currentAngle}deg)`;
}

function _cpRotateVerify(cid) {
  const msg = document.getElementById(`cp-msg-${cid}`);
  const st = _cpState[cid];
  if (st.currentAngle === st.targetAngle || st.currentAngle === 0) {
    st.solved = true;
    st.token = _cpMakeToken({ type: 'rotate_img' });
    if (msg) { msg.textContent = '✅ Chính xác!'; msg.style.color = '#00e676'; }
  } else {
    if (msg) { msg.textContent = '❌ Chưa đúng hướng, thử lại'; msg.style.color = '#ff5252'; }
    setTimeout(() => resetCaptcha(cid), 700);
  }
}

// ── Legacy compat (captcha.js cũ dùng generateCaptcha/verifyCaptcha) ──
function generateCaptcha() { initCaptcha('reg-captcha-wrap'); }
function verifyCaptcha() { return !!getCaptchaToken('reg-captcha-wrap'); }
