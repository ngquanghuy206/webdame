// ═══════════════════════════════════════════════
//  HOT DEAL MODULE
// ═══════════════════════════════════════════════

let _hotDeals = [];
let _hotDealCountdownTimers = {};

// Format VND
function fmtVND(n) {
  return Number(n).toLocaleString('vi-VN') + ' VND';
}

// Parse duration string → seconds
function parseDurLabel(s) {
  s = (s||'').toLowerCase().trim();
  if(s.endsWith('y')) return { val: parseInt(s), unit: 'năm' };
  if(s.endsWith('m')) return { val: parseInt(s), unit: 'tháng' };
  if(s.endsWith('d')) return { val: parseInt(s), unit: 'ngày' };
  if(s.endsWith('h')) return { val: parseInt(s), unit: 'giờ' };
  return { val: 1, unit: 'ngày' };
}

function durToLabel(s) {
  const r = parseDurLabel(s);
  return r.val + ' ' + r.unit;
}

// Countdown display
function formatCountdown(secsLeft) {
  if(secsLeft <= 0) return 'Đã hết hạn';
  const d = Math.floor(secsLeft / 86400);
  const h = Math.floor((secsLeft % 86400) / 3600);
  const m = Math.floor((secsLeft % 3600) / 60);
  const s = secsLeft % 60;
  if(d > 0) return `${d}n ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// Clear all countdown timers
function clearHotDealTimers() {
  Object.values(_hotDealCountdownTimers).forEach(clearInterval);
  _hotDealCountdownTimers = {};
}

// Load deals from API
async function loadHotDeals() {
  try {
    const r = await fetch('/api/hot-deals', { headers: { 'Authorization': 'Bearer ' + SESSION_TOKEN } });
    _hotDeals = await r.json();
  } catch(e) { _hotDeals = []; }
  renderHotDealCarousel();
  renderHotDealShopList();
}

// ── CAROUSEL (trang chủ) ──────────────────────────────────
function renderHotDealCarousel() {
  clearHotDealTimers();
  const wrap = document.getElementById('hot-deal-carousel-wrap');
  if(!wrap) return;

  const now = Math.floor(Date.now()/1000);
  const active = _hotDeals.filter(d => d.expires_at > now && d.qty_left > 0);

  if(!active.length) {
    wrap.innerHTML = '';
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = '';
  wrap.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">🔥 DEAL HOT HÔM NAY</div>
    <div style="position:relative">
      <div id="hd-carousel-track" style="display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;scrollbar-width:none">
        ${active.map(d => renderDealCard(d)).join('')}
      </div>
    </div>
  `;

  // Start countdowns
  active.forEach(deal => {
    const el = document.getElementById('hd-cd-' + deal.id);
    if(!el) return;
    const tid = setInterval(() => {
      const left = deal.expires_at - Math.floor(Date.now()/1000);
      if(left <= 0) { el.textContent = 'Hết hạn'; clearInterval(tid); loadHotDeals(); return; }
      el.textContent = formatCountdown(left);
    }, 1000);
    _hotDealCountdownTimers[deal.id] = tid;
    el.textContent = formatCountdown(deal.expires_at - Math.floor(Date.now()/1000));
  });
}

function renderDealCard(deal) {
  const pct = deal.orig_price > 0 ? Math.round((1 - deal.price/deal.orig_price)*100) : 0;
  const imgHtml = deal.image_url
    ? `<img src="${deal.image_url}" style="width:100%;height:140px;object-fit:cover;border-radius:12px;margin-bottom:10px">`
    : `<div style="width:100%;height:80px;background:linear-gradient(135deg,rgba(255,100,0,.15),rgba(255,50,0,.1));border-radius:12px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;font-size:36px">🔥</div>`;
  return `
    <div style="flex-shrink:0;width:220px;scroll-snap-align:start;background:linear-gradient(135deg,rgba(255,80,0,.08),rgba(255,160,0,.05));border:1.5px solid rgba(255,120,0,.3);border-radius:16px;padding:12px;position:relative">
      ${pct>0?`<div style="position:absolute;top:8px;right:8px;background:#ff3d00;color:#fff;font-size:11px;font-weight:800;padding:3px 8px;border-radius:20px">-${pct}%</div>`:''}
      ${imgHtml}
      <div style="font-size:12px;font-weight:800;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${deal.title}</div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:6px">📱 ${deal.slots} máy ảo · ⏱ ${durToLabel(deal.duration)}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        ${deal.orig_price>0?`<span style="font-size:10px;color:var(--muted);text-decoration:line-through">${fmtVND(deal.orig_price)}</span>`:''}
        <span style="font-size:15px;font-weight:900;color:#ff8c00">${fmtVND(deal.price)}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:10px;color:var(--muted)">Còn <b style="color:#ff8c00">${deal.qty_left}</b>/${deal.qty_total} lượt</div>
        <div style="font-size:10px;background:rgba(0,0,0,.3);padding:2px 6px;border-radius:6px;font-family:monospace" id="hd-cd-${deal.id}">--:--:--</div>
      </div>
      <button onclick="buyHotDeal('${deal.id}')" style="width:100%;padding:8px;border:none;border-radius:10px;background:linear-gradient(135deg,#ff6d00,#ff3d00);color:#fff;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 3px 10px rgba(255,80,0,.4)">Xem ngay →</button>
    </div>
  `;
}

// ── SHOP LIST (trong cửa hàng VPS) ───────────────────────
function renderHotDealShopList() {
  const wrap = document.getElementById('hot-deal-shop-section');
  if(!wrap) return;
  const now = Math.floor(Date.now()/1000);
  const active = _hotDeals.filter(d => d.expires_at > now && d.qty_left > 0);
  if(!active.length) { wrap.style.display='none'; return; }
  wrap.style.display='';
  wrap.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:#ff8c00;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;display:flex;align-items:center;gap:6px">🔥 Hot Deal đặc biệt</div>
    ${active.map(d => {
      const pct = d.orig_price>0?Math.round((1-d.price/d.orig_price)*100):0;
      return `<div style="background:linear-gradient(135deg,rgba(255,80,0,.1),rgba(255,160,0,.06));border:1.5px solid rgba(255,120,0,.35);border-radius:14px;padding:12px;margin-bottom:10px;display:flex;align-items:center;gap:12px">
        ${d.image_url?`<img src="${d.image_url}" style="width:60px;height:60px;object-fit:cover;border-radius:10px;flex-shrink:0">`:`<div style="width:60px;height:60px;border-radius:10px;background:rgba(255,100,0,.15);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">🔥</div>`}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:800;margin-bottom:2px">${d.title}${pct>0?` <span style="background:#ff3d00;color:#fff;font-size:10px;padding:1px 5px;border-radius:10px">-${pct}%</span>`:''}</div>
          <div style="font-size:10px;color:var(--muted)">📱 ${d.slots} máy · ⏱ ${durToLabel(d.duration)} · Còn ${d.qty_left}/${d.qty_total}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
            ${d.orig_price>0?`<span style="font-size:10px;color:var(--muted);text-decoration:line-through">${fmtVND(d.orig_price)}</span>`:''}
            <span style="font-size:14px;font-weight:900;color:#ff8c00">${fmtVND(d.price)}</span>
          </div>
        </div>
        <button onclick="buyHotDeal('${d.id}')" style="padding:8px 14px;border:none;border-radius:10px;background:linear-gradient(135deg,#ff6d00,#ff3d00);color:#fff;font-size:12px;font-weight:800;cursor:pointer;flex-shrink:0">Mua</button>
      </div>`;
    }).join('')}
  `;
}

// ── BUY ──────────────────────────────────────────────────
async function buyHotDeal(dealId) {
  const deal = _hotDeals.find(d => d.id === dealId);
  if(!deal) return;

  const pct = deal.orig_price>0?Math.round((1-deal.price/deal.orig_price)*100):0;
  const confirmed = await showHotDealConfirm(deal, pct);
  if(!confirmed) return;

  try {
    const r = await fetch(`/api/hot-deals/${dealId}/buy`, {
      method:'POST',
      headers:{'Authorization':'Bearer '+SESSION_TOKEN,'Content-Type':'application/json'}
    });
    const d = await r.json();
    if(!r.ok) { showToast('❌ ' + (d.detail||'Lỗi mua deal'), '#ff5050'); return; }
    showToast('✅ Mua deal thành công! Máy ảo đã được thêm.', '#00c882');
    loadHotDeals();
    if(typeof refreshBalance === 'function') refreshBalance();
  } catch(e) { showToast('❌ Lỗi kết nối', '#ff5050'); }
}

function showHotDealConfirm(deal, pct) {
  return new Promise(resolve => {
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    m.innerHTML = `
      <div style="background:var(--bg2);border-radius:20px;padding:24px;max-width:320px;width:100%;text-align:center;border:1px solid rgba(255,120,0,.3)">
        <div style="font-size:36px;margin-bottom:10px">🔥</div>
        <div style="font-weight:800;font-size:16px;margin-bottom:6px">${deal.title}</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:12px">📱 ${deal.slots} máy ảo · ⏱ ${durToLabel(deal.duration)}</div>
        ${pct>0?`<div style="font-size:12px;color:var(--muted);text-decoration:line-through;margin-bottom:4px">${fmtVND(deal.orig_price)}</div>`:''}
        <div style="font-size:22px;font-weight:900;color:#ff8c00;margin-bottom:16px">${fmtVND(deal.price)}</div>
        <div style="display:flex;gap:10px">
          <button id="hd-cancel" style="flex:1;padding:11px;border:1px solid var(--border);border-radius:12px;background:var(--glass2);color:var(--text);font-size:14px;font-weight:700;cursor:pointer">Hủy</button>
          <button id="hd-confirm" style="flex:1;padding:11px;border:none;border-radius:12px;background:linear-gradient(135deg,#ff6d00,#ff3d00);color:#fff;font-size:14px;font-weight:800;cursor:pointer">✅ Mua ngay</button>
        </div>
      </div>
    `;
    document.body.appendChild(m);
    m.querySelector('#hd-cancel').onclick = () => { document.body.removeChild(m); resolve(false); };
    m.querySelector('#hd-confirm').onclick = () => { document.body.removeChild(m); resolve(true); };
  });
}

// ── ADMIN: CREATE DEAL ────────────────────────────────────
function openAdminHotDealModal() {
  const m = document.getElementById('admin-hotdeal-modal');
  if(m) { openModal('admin-hotdeal-modal'); loadAdminHotDealList(); }
}

async function adminCreateHotDeal() {
  const title   = document.getElementById('ahd-title').value.trim();
  const slots   = parseInt(document.getElementById('ahd-slots').value)||1;
  const duration= document.getElementById('ahd-duration').value.trim()||'1d';
  const qty     = parseInt(document.getElementById('ahd-qty').value)||1;
  const price   = parseInt((document.getElementById('ahd-price').value||'0').replace(/[^0-9]/g,''));
  const orig    = parseInt((document.getElementById('ahd-orig').value||'0').replace(/[^0-9]/g,''));
  const expires = document.getElementById('ahd-expires').value.trim()||'24h';
  const img_url = document.getElementById('ahd-imgurl').value.trim();
  const btn     = document.getElementById('ahd-create-btn');
  const err     = document.getElementById('ahd-err');

  if(!title){ err.textContent='Nhập tiêu đề!'; return; }
  if(price<=0){ err.textContent='Nhập giá hợp lệ!'; return; }
  err.textContent='';
  btn.disabled=true; btn.textContent='Đang tạo...';

  try {
    const r = await fetch('/api/admin/hot-deals', {
      method:'POST',
      headers:{'Authorization':'Bearer '+SESSION_TOKEN,'Content-Type':'application/json'},
      body: JSON.stringify({title,slots,duration,qty,price,orig_price:orig,expires,image_url:img_url})
    });
    const d = await r.json();
    if(!r.ok){ err.textContent = d.detail||'Lỗi tạo deal'; return; }
    showToast('✅ Đã tạo Hot Deal!','#00c882');
    ['ahd-title','ahd-slots','ahd-qty','ahd-price','ahd-orig','ahd-duration','ahd-expires','ahd-imgurl'].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.value = '';
    });
    loadAdminHotDealList();
    loadHotDeals();
  } catch(e){ err.textContent='Lỗi kết nối'; }
  finally{ btn.disabled=false; btn.textContent='🔥 Tạo Hot Deal'; }
}

async function loadAdminHotDealList() {
  const list = document.getElementById('admin-hotdeal-list');
  if(!list) return;
  try {
    const r = await fetch('/api/hot-deals',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const deals = await r.json();
    if(!deals.length){ list.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px">Chưa có deal nào</div>'; return; }
    const now = Math.floor(Date.now()/1000);
    list.innerHTML = deals.map(d => `
      <div style="background:var(--glass2);border:1px solid var(--border);border-radius:12px;padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:800">${d.title}</div>
          <div style="font-size:10px;color:var(--muted)">📱${d.slots} máy · ⏱${durToLabel(d.duration)} · ${fmtVND(d.price)} · ${d.qty_left}/${d.qty_total} còn lại</div>
          <div style="font-size:10px;color:${d.expires_at>now?'#00c882':'#ff5050'}">${d.expires_at>now?'⏳ '+formatCountdown(d.expires_at-now):'⛔ Hết hạn'}</div>
        </div>
        <button onclick="adminDeleteHotDeal('${d.id}')" style="padding:6px 10px;border:none;border-radius:8px;background:rgba(255,80,80,.15);color:#ff5050;font-size:12px;font-weight:700;cursor:pointer">🗑</button>
      </div>
    `).join('');
  } catch(e){ list.innerHTML='<div style="color:#ff5050">Lỗi tải</div>'; }
}

async function adminDeleteHotDeal(id) {
  if(!confirm('Xóa deal này?')) return;
  await fetch(`/api/admin/hot-deals/${id}`,{method:'DELETE',headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
  showToast('✅ Đã xóa deal','#00c882');
  loadAdminHotDealList(); loadHotDeals();
}
