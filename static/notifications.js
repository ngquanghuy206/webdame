// ═══════════════════════════════════════════════
//  NOTIFICATIONS & TOP NẠP MODULE
// ═══════════════════════════════════════════════

let _notifData = { main: {text:'',image:'',updated:''}, sub: [] };
let _bellDropOpen = false;

// ── LOAD & INIT ──────────────────────────────────────────
async function loadNotifications() {
  try {
    const r = await fetch('/api/notifications',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    _notifData = await r.json();
  } catch(e){ _notifData = {main:{text:'',image:'',updated:''},sub:[]}; }
  updateBellBadge();
}

function updateBellBadge() {
  const badge = document.getElementById('bell-badge');
  const cnt = (_notifData.sub||[]).length;
  if(badge) {
    badge.style.display = cnt > 0 ? '' : 'none';
    badge.textContent = cnt > 9 ? '9+' : cnt;
  }
}

// ── BELL DROPDOWN ─────────────────────────────────────────
function toggleBellDrop() {
  const drop = document.getElementById('bell-dropdown');
  if(!drop) return;
  _bellDropOpen = !_bellDropOpen;
  if(_bellDropOpen) {
    renderBellDrop();
    drop.style.display = '';
    requestAnimationFrame(()=>{ drop.style.opacity='1'; drop.style.transform='translateY(0)'; });
    document.addEventListener('click', closeBellOnOutside, {once:true});
  } else {
    closeBellDrop();
  }
}

function closeBellDrop() {
  const drop = document.getElementById('bell-dropdown');
  if(!drop) return;
  _bellDropOpen = false;
  drop.style.opacity = '0';
  drop.style.transform = 'translateY(-8px)';
  setTimeout(()=>{ drop.style.display='none'; }, 200);
}

function closeBellOnOutside(e) {
  const drop = document.getElementById('bell-dropdown');
  const btn  = document.getElementById('bell-btn');
  if(drop && !drop.contains(e.target) && btn && !btn.contains(e.target)) {
    closeBellDrop();
  }
}

function renderBellDrop() {
  const drop = document.getElementById('bell-dropdown');
  if(!drop) return;
  const subs = (_notifData.sub||[]).slice(0, 20);
  drop.innerHTML = `
    <div style="padding:12px 14px 8px;font-size:12px;font-weight:800;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <span>🔔 Thông báo</span>
      <span style="font-size:10px;color:var(--muted)">${subs.length} tin</span>
    </div>
    <div style="overflow-y:auto;max-height:320px">
      ${subs.length ? subs.map(s => `
        <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer" onmouseenter="this.style.background='var(--glass2)'" onmouseleave="this.style.background=''">
          <div style="font-size:12px;line-height:1.5;white-space:pre-line">${escHtml(s.text)}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:3px">${s.time}</div>
        </div>
      `).join('') : '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Không có thông báo mới</div>'}
    </div>
    <div style="padding:10px 14px">
      <button onclick="openMainNotifModal();closeBellDrop()" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:10px;background:var(--glass2);color:var(--text);font-size:12px;cursor:pointer;font-weight:700">📢 Xem thông báo chính</button>
    </div>
  `;
}

function escHtml(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── MAIN NOTIFICATION MODAL ───────────────────────────────
function parseNotifColors(text) {
  // Convert [color]text[/color] tags to styled spans
  // Supported: [red] [blue] [green] [yellow] [orange] [purple] [cyan] [bold] [big]
  const COLOR_MAP = {
    red:'#e53935', blue:'#1e88e5', green:'#43a047', yellow:'#f9a825',
    orange:'#fb8c00', purple:'#8e24aa', cyan:'#00acc1', pink:'#e91e63',
    gold:'#ffc107', white:'#ffffff'
  };
  let html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/
/g,'<br>');
  // Color tags
  Object.entries(COLOR_MAP).forEach(([tag, color]) => {
    const re = new RegExp('\\['+tag+'\\]([\\s\\S]*?)\\[/'+tag+'\\]','gi');
    html = html.replace(re, `<span style="color:${color};font-weight:700">$1</span>`);
  });
  // Special tags
  html = html.replace(/\[bold\]([\s\S]*?)\[\/bold\]/gi, '<b>$1</b>');
  html = html.replace(/\[big\]([\s\S]*?)\[\/big\]/gi, '<span style="font-size:20px;font-weight:900">$1</span>');
  html = html.replace(/\[small\]([\s\S]*?)\[\/small\]/gi, '<span style="font-size:13px;color:rgba(0,0,0,.5)">$1</span>');
  return html;
}

// Đóng modal thông báo + snooze 6h nếu user tích "Không nhắc lại"
function dismissMainNotif() {
  const cb = document.getElementById('notif-no-remind');
  if(cb && cb.checked) {
    const until = Date.now() + 6 * 60 * 60 * 1000; // 6 tiếng
    localStorage.setItem('notif_snooze_until', String(until));
  }
  closeModal('main-notif-modal');
}

function openMainNotifModal() {
  const cb = document.getElementById('notif-no-remind');
  if(cb) cb.checked = false; // reset mỗi lần mở
  const m = _notifData.main || {};
  const textEl = document.getElementById('main-notif-text');
  const imgEl  = document.getElementById('main-notif-img');
  if(textEl) { textEl.innerHTML = parseNotifColors(m.text||''); }
  if(imgEl){ imgEl.src = m.image||''; imgEl.style.display = m.image ? '' : 'none'; }
  openModal('main-notif-modal');

}

// ── ADMIN: NOTIFICATIONS ──────────────────────────────────
function openAdminNotifModal() {
  const el = document.getElementById('anotif-main-text');
  if(el && _notifData.main) el.value = _notifData.main.text||'';
  const imgEl = document.getElementById('anotif-main-img');
  if(imgEl && _notifData.main) imgEl.value = _notifData.main.image||'';
  renderAdminSubList();
  openModal('admin-notif-modal');
}

async function adminSaveMainNotif() {
  const text = document.getElementById('anotif-main-text').value;
  const image = _notifImgBase64 || document.getElementById('anotif-main-img').value.trim();
  const btn  = document.getElementById('anotif-save-btn');
  btn.disabled=true; btn.textContent='Đang lưu...';
  try {
    const r = await fetch('/api/admin/notifications/main',{
      method:'POST', headers:{'Authorization':'Bearer '+SESSION_TOKEN,'Content-Type':'application/json'},
      body: JSON.stringify({text, image})
    });
    const d = await r.json();
    if(d.ok){ showToast('✅ Đã cập nhật thông báo!','#00c882'); await loadNotifications(); }
  } catch(e){ showToast('❌ Lỗi','#ff5050'); }
  finally{ btn.disabled=false; btn.textContent='💾 Lưu thông báo'; }
}

async function adminSendSubNotif() {
  const text = (document.getElementById('anotif-sub-text').value||'').trim();
  if(!text){ showToast('Nhập nội dung thông báo!','#ff9800'); return; }
  const btn = document.getElementById('anotif-sub-btn');
  btn.disabled=true; btn.textContent='Đang gửi...';
  try {
    const r = await fetch('/api/admin/notifications/sub',{
      method:'POST', headers:{'Authorization':'Bearer '+SESSION_TOKEN,'Content-Type':'application/json'},
      body: JSON.stringify({text})
    });
    const d = await r.json();
    if(d.ok){
      showToast('✅ Đã gửi thông báo!','#00c882');
      document.getElementById('anotif-sub-text').value='';
      await loadNotifications();
      renderAdminSubList();
      // Ring bell animation
      document.querySelectorAll('.bell-icon').forEach(el => {
        el.style.animation='bellRing 0.5s ease';
        setTimeout(()=>{ el.style.animation=''; }, 600);
      });
    }
  } catch(e){ showToast('❌ Lỗi','#ff5050'); }
  finally{ btn.disabled=false; btn.textContent='🔔 Gửi thông báo'; }
}

function renderAdminSubList() {
  const list = document.getElementById('anotif-sub-list');
  if(!list) return;
  const subs = _notifData.sub||[];
  if(!subs.length){ list.innerHTML='<div style="color:var(--muted);text-align:center;padding:10px;font-size:12px">Chưa có thông báo nào</div>'; return; }
  list.innerHTML = subs.slice(0,20).map(s=>`
    <div style="background:var(--glass2);border-radius:10px;padding:8px 10px;margin-bottom:6px;display:flex;gap:8px;align-items:flex-start">
      <div style="flex:1">
        <div style="font-size:12px;white-space:pre-line">${escHtml(s.text)}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${s.time}</div>
      </div>
      <button onclick="adminDeleteSubNotif('${s.id}')" style="border:none;background:none;color:#ff5050;cursor:pointer;font-size:14px;padding:0 2px">🗑</button>
    </div>
  `).join('');
}

async function adminDeleteSubNotif(id) {
  await fetch(`/api/admin/notifications/sub/${id}`,{method:'DELETE',headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
  await loadNotifications();
  renderAdminSubList();
  showToast('✅ Đã xóa thông báo','#00c882');
}

// ── TOP NẠP LEADERBOARD ───────────────────────────────────
async function openTopNapModal() {
  openModal('top-nap-modal');
  // Nút reset chỉ hiện với admin
  const adminCtrl = document.getElementById('top-nap-admin-ctrl');
  if(adminCtrl) adminCtrl.style.display = IS_ADMIN ? 'block' : 'none';
  const list = document.getElementById('top-nap-list');
  if(list) list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Đang tải...</div>';
  try {
    const r = await fetch('/api/top-nap',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const data = await r.json();
    renderTopNap(data);
  } catch(e){ if(list) list.innerHTML='<div style="color:#ff5050;text-align:center;padding:20px">Lỗi tải dữ liệu</div>'; }
}

function renderTopNap(data) {
  const list = document.getElementById('top-nap-list');
  const monthEl = document.getElementById('top-nap-month');
  if(!list) return;

  const entries = data.entries||[];
  const month = data.month||'';
  if(monthEl) {
    const [y,m] = (month||'').split('-');
    monthEl.textContent = m && y ? `Tháng ${m}/${y}` : 'Tháng hiện tại';
  }

  const MEDALS = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  const PRIZES = [
    '🎁 Phần quà đặc biệt + 500.000 VND',
    '🎁 Phần quà + 200.000 VND',
    '🎁 Phần quà + 100.000 VND',
    '🎁 Voucher 50.000 VND',
    '🎁 Voucher 20.000 VND',
  ];

  if(!entries.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px;font-size:14px">📭 Chưa có dữ liệu nạp tháng này</div>';
    return;
  }

  list.innerHTML = entries.slice(0,5).map((e,i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:${i===0?'linear-gradient(135deg,rgba(255,215,0,.12),rgba(255,165,0,.08))':i===1?'linear-gradient(135deg,rgba(192,192,192,.1),rgba(150,150,150,.06))':i===2?'linear-gradient(135deg,rgba(205,127,50,.1),rgba(160,90,30,.06))':'var(--glass2)'};border-radius:14px;margin-bottom:8px;border:1px solid ${i===0?'rgba(255,215,0,.3)':i===1?'rgba(192,192,192,.2)':i===2?'rgba(205,127,50,.2)':'var(--border)'};position:relative;overflow:hidden">
      <div style="font-size:28px;flex-shrink:0">${MEDALS[i]||'⭐'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(e.username)}</div>
        <div style="font-size:12px;color:${i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':'var(--muted)'};font-weight:700">${fmtVND(e.total)}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:1px">${PRIZES[i]||''}</div>
      </div>
      <div style="font-size:22px;font-weight:900;color:var(--muted);opacity:.15;position:absolute;right:12px;font-family:monospace">#${i+1}</div>
    </div>
  `).join('') + (entries.length>5?`<div style="text-align:center;color:var(--muted);font-size:12px;padding:8px">+${entries.length-5} người khác</div>`:'');
}

async function adminResetTopNap() {
  if(!confirm('Reset bảng xếp hạng tháng này?')) return;
  await fetch('/api/admin/top-nap/reset',{method:'POST',headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
  showToast('✅ Đã reset bảng xếp hạng','#00c882');
  openTopNapModal();
}

// ── ADMIN: IMAGE UPLOAD FOR NOTIF ────────────────────────
let _notifImgBase64 = '';

function handleNotifImg(input) {
  if(!input.files||!input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    _notifImgBase64 = e.target.result;
    const preview = document.getElementById('anotif-img-preview');
    const thumb = document.getElementById('anotif-img-thumb');
    const drop = document.getElementById('anotif-img-drop');
    if(thumb) thumb.src = e.target.result;
    if(preview) preview.style.display = 'block';
    if(drop) drop.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function clearNotifImg() {
  _notifImgBase64 = '';
  const input = document.getElementById('anotif-img-file');
  if(input) input.value = '';
  const preview = document.getElementById('anotif-img-preview');
  const drop = document.getElementById('anotif-img-drop');
  if(preview) preview.style.display = 'none';
  if(drop) drop.style.display = 'block';
}
