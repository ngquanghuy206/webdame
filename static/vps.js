// ═══════════════════════════════════════════════════════
//  VPS SHOP
// ═══════════════════════════════════════════════════════
let _vpsPlans=[], _vpsPendingPlan=null;
async function openVpsShop(){
  const balEl=document.getElementById('vps-shop-balance');
  if(balEl) balEl.innerHTML=IS_ADMIN?'<span style="font-weight:900;color:#ffd740">∞</span>':fmtMoney(CURRENT_BALANCE);
  // Load slot count
  try{
    const sr=await fetch('/api/slots/count',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(IS_ADMIN){const slEl=document.getElementById("vps-shop-slots");if(slEl)slEl.innerHTML="<span style=\"font-weight:900;color:#00e5ff\">∞</span>";}else if(sr.ok){const sd=await sr.json();const slEl=document.getElementById("vps-shop-slots");if(slEl)slEl.textContent=sd.total_slots+" máy ảo";}
  }catch{}
  if(!_vpsPlans.length){
    try{const r=await fetch('/api/vps-plans');if(r.ok)_vpsPlans=await r.json();}catch{}
  }
  openModal('vps-shop-modal');
  if(typeof renderHotDealShopList === 'function') renderHotDealShopList();
  setTimeout(function(){
    updateCustomPrice();
    renderComboPlans();
    switchVpsTab('day', document.getElementById('vmtab-day'));
  }, 50);
}

// ── Custom slot (máy lẻ) ──────────────────────────────
let _customSlots = 1, _customDays = 1, _currentVpsTab = 'day';
const _PRICE_PER_SLOT_DAY = 30000; // 30k / máy / ngày

function adjustCustomSlot(delta){
  _customSlots = Math.max(1, Math.min(50, _customSlots + delta));
  document.getElementById('custom-slot-val').textContent = _customSlots;
  updateCustomPrice();
}
function adjustCustomDay(delta){
  const tabMin = {day:1, week:7, month:30, year:365};
  const min = tabMin[_currentVpsTab] || 1;
  const step = _currentVpsTab==='week'?7:_currentVpsTab==='month'?30:_currentVpsTab==='year'?365:1;
  _customDays = Math.max(min, _customDays + delta * step);
  const el = document.getElementById('custom-day-val');
  if(_customDays < 7) el.textContent = _customDays + ' ngày';
  else if(_customDays < 30) el.textContent = (_customDays/7) + ' tuần';
  else if(_customDays < 365) el.textContent = Math.round(_customDays/30) + ' tháng';
  else el.textContent = Math.round(_customDays/365) + ' năm';
  updateCustomPrice();
}
function updateCustomPrice(){
  const total = _customSlots * _customDays * _PRICE_PER_SLOT_DAY;
  const el = document.getElementById('custom-price-val');
  if(el) el.textContent = fmtMoney(total);
}
async function buyCustomSlot(){
  if(!SESSION_TOKEN){showToast('❌ Chưa đăng nhập','var(--red)');return;}
  const total = _customSlots * _customDays * _PRICE_PER_SLOT_DAY;
  if(CURRENT_BALANCE < total){
    showToast('❌ Số dư không đủ. Cần: '+fmtMoney(total),'var(--red)');
    return;
  }
  // Build a virtual plan
  _vpsPendingPlan = {
    id: 'custom_'+_customSlots+'x'+_customDays+'d',
    name: _customSlots+' Máy ảo · '+_customDays+' ngày (tuỳ chọn)',
    slots: _customSlots, days: _customDays, price: total, custom: true
  };
  const canAfford = true;
  const dayLabel = _customDays<7?_customDays+' ngày':_customDays<30?(_customDays/7)+' tuần':_customDays<365?Math.round(_customDays/30)+' tháng':Math.round(_customDays/365)+' năm';
  document.getElementById('vps-confirm-content').innerHTML =
    '<div style="background:var(--glass2);border-radius:12px;padding:14px;margin-bottom:12px">'+
    '<div style="font-size:15px;font-weight:800;margin-bottom:8px">📱 Mua máy lẻ</div>'+
    '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted)">Số máy ảo</span><b style="color:var(--cyan)">'+_customSlots+' máy</b></div>'+
    '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted)">Thời hạn</span><b>'+dayLabel+'</b></div>'+
    '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted)">Đơn giá</span><b>30.000đ / máy / ngày</b></div>'+
    '<div style="height:1px;background:var(--border);margin:8px 0"></div>'+
    '<div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Tổng</span><b style="color:var(--green)">'+fmtMoney(total)+'</b></div>'+
    '<div style="display:flex;justify-content:space-between;margin-top:6px"><span style="color:var(--muted)">Số dư</span><b style="color:var(--green)">'+fmtMoney(CURRENT_BALANCE)+'</b></div></div>';
  document.getElementById('vps-confirm-err').textContent = '';
  openModal('vps-confirm-modal');
}

// ── Tab chính Ngày/Tuần/Tháng/Năm ──────────────────────
function switchVpsTab(period, btn){
  _currentVpsTab = period;
  document.querySelectorAll('.vps-main-tab').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');

  // Reset custom day to tab minimum
  const mins = {day:1, week:7, month:30, year:365};
  _customDays = mins[period] || 1;
  const el = document.getElementById('custom-day-val');
  if(el){
    if(_customDays<7) el.textContent=_customDays+' ngày';
    else if(_customDays<30) el.textContent=(_customDays/7)+' tuần';
    else if(_customDays<365) el.textContent=Math.round(_customDays/30)+' tháng';
    else el.textContent=Math.round(_customDays/365)+' năm';
  }
  updateCustomPrice();

  // Filter plans
  let plans = _vpsPlans.slice().filter(function(p){ return !p.id.startsWith('sl_s') && !p.trial; });
  const labels = {day:'📅 Gói theo ngày', week:'📆 Gói theo tuần', month:'🗓 Gói theo tháng', year:'🗃 Gói theo năm'};
  const lbl = document.getElementById('vps-tab-label');
  if(lbl) lbl.textContent = labels[period] || '';

  if(period==='day')   plans = plans.filter(function(p){return p.days<7;});
  else if(period==='week')  plans = plans.filter(function(p){return p.days>=7&&p.days<=21;});
  else if(period==='month') plans = plans.filter(function(p){return p.days>=30&&p.days<365;});
  else if(period==='year')  plans = plans.filter(function(p){return p.days>=365;});
  renderVpsPlans(plans);
}

function renderVpsPlans(plans){
  const grid = document.getElementById('vps-plans-grid');
  if(!plans.length){ grid.innerHTML='<div style="color:var(--muted);text-align:center;padding:20px;grid-column:1/-1;font-size:13px">Không có gói nào</div>'; return; }
  grid.innerHTML = '';
  plans.forEach(function(p){
    var dayLabel = p.days<7?p.days+' ngày':p.days<30?(p.days/7)+' tuần':p.days<365?Math.round(p.days/30)+' tháng':Math.round(p.days/365)+' năm';
    var priceColor = p.price===0?'var(--green)':p.popular?'var(--yellow)':'var(--blue)';
    var priceText = p.price===0?'MIỄN PHÍ':fmtMoney(p.price);
    var slots = p.slots||p.qty||1;
    var card = document.createElement('div');
    card.className = 'vps-plan-card'+(p.popular?' popular':'');
    if(p.popular){
      var badge=document.createElement('div'); badge.className='vps-popular-badge'; badge.textContent='⭐ HOT'; card.appendChild(badge);
    } else if(p.trial){
      var badge=document.createElement('div'); badge.className='vps-popular-badge'; badge.style.cssText='background:linear-gradient(135deg,#00e676,#00c853);left:10px;right:auto'; badge.textContent='FREE'; card.appendChild(badge);
    }
    var perMachine = p.price>0?'<div style="font-size:9px;color:var(--muted);margin-top:2px">'+fmtMoney(Math.round(p.price/slots))+'/máy</div>':'';
    card.innerHTML += '<div style="font-size:11px;font-weight:800;color:var(--text);margin-bottom:4px;line-height:1.4">'+p.name+'</div>'
      +'<div style="font-size:10px;color:var(--muted);margin-bottom:6px">📱 '+slots+' máy ảo · ⏱ '+dayLabel+'</div>'
      +'<div style="font-size:17px;font-weight:900;color:'+priceColor+'">'+priceText+'</div>'
      +perMachine;
    card.onclick = (function(pid){ return function(){ confirmVpsBuy(pid); }; })(p.id);
    grid.appendChild(card);
  });
}
function renderComboPlans(){
  var combos = (_vpsPlans||[]).filter(function(p){ return p.id.startsWith('sl_s') || p.trial; });
  var list = document.getElementById('vps-combo-list');
  if(!list) return;
  list.innerHTML = '';
  if(!combos.length) return;
  combos.forEach(function(p){
    var slots = p.slots||p.qty||1;
    var dayLabel = p.days<7?p.days+' ngày':p.days<30?(p.days/7)+' tuần':p.days<365?Math.round(p.days/30)+' tháng':Math.round(p.days/365)+' năm';
    var priceText = p.price===0?'MIỄN PHÍ':fmtMoney(p.price);
    var priceColor = p.price===0?'var(--green)':p.popular?'var(--yellow)':'var(--blue)';
    var perM = p.price>0?' · '+fmtMoney(Math.round(p.price/slots))+'/máy':'';
    var borderColor = p.popular?'rgba(255,193,7,.4)':p.trial?'rgba(0,230,118,.3)':'var(--border)';
    var row = document.createElement('div');
    row.style.cssText = 'background:var(--glass2);border:1.5px solid '+borderColor+';border-radius:12px;padding:12px 14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;transition:.2s';
    var hotBadge = p.popular?'<span style="background:linear-gradient(135deg,var(--yellow),var(--orange));color:#000;font-size:9px;font-weight:800;padding:2px 7px;border-radius:20px;margin-left:6px">⭐ HOT</span>':'';
    var freeBadge = p.trial?'<span style="background:linear-gradient(135deg,#00e676,#00c853);color:#000;font-size:9px;font-weight:800;padding:2px 7px;border-radius:20px;margin-left:6px">FREE</span>':'';
    row.innerHTML = '<div style="flex:1;min-width:0">'
      +'<div style="font-size:13px;font-weight:800;display:flex;align-items:center;flex-wrap:wrap;gap:2px">'+p.name+hotBadge+freeBadge+'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:3px">📱 '+slots+' máy ảo · ⏱ '+dayLabel+perM+'</div>'
      +'</div>'
      +'<div style="font-size:17px;font-weight:900;color:'+priceColor+';white-space:nowrap">'+priceText+'</div>';
    row.onmouseover = function(){ this.style.borderColor='rgba(79,158,255,.5)'; };
    row.onmouseout  = function(){ this.style.borderColor=borderColor; };
    row.onclick = (function(pid){ return function(){ confirmVpsBuy(pid); }; })(p.id);
    list.appendChild(row);
  });
}
function filterVpsPlans(filter,btn){
  // legacy - redirect to switchVpsTab
  if(filter==='bundle') { renderComboPlans(); return; }
  const tabMap = {all:'day',day:'day',week:'week',month:'month',year:'year'};
  const t = tabMap[filter]||'day';
  switchVpsTab(t, document.getElementById('vmtab-'+t));
}

function confirmVpsBuy(planId){
  const plan=_vpsPlans.find(function(p){return p.id===planId;});
  if(!plan) return;
  _vpsPendingPlan=plan;
  const canAfford=CURRENT_BALANCE>=plan.price||plan.price===0;
  const dayLabel=plan.days<30?plan.days+' ngày':plan.days<365?Math.round(plan.days/30)+' tháng':Math.round(plan.days/365)+' năm';
  const slots=plan.slots||plan.qty||1;
  const noFundMsg=canAfford?''+'':'<div style="background:rgba(255,82,82,.1);border:1px solid rgba(255,82,82,.3);border-radius:10px;padding:10px;text-align:center;color:var(--red);font-size:12px">❌ Số dư không đủ. <span onclick="closeModal(\'vps-confirm-modal\');openDepositModal()" style="text-decoration:underline;cursor:pointer">Nạp tiền ngay</span></div>';
  document.getElementById('vps-confirm-content').innerHTML='<div style="background:var(--glass2);border-radius:12px;padding:14px;margin-bottom:12px"><div style="font-size:15px;font-weight:800;margin-bottom:8px">'+plan.name+'</div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted)">Số máy ảo</span><b style="color:var(--cyan)">'+slots+' slot</b></div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted)">Mỗi máy ảo</span><b>= 1 luồng dame độc lập (Phone ảo)</b></div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted)">Thời hạn</span><b>'+dayLabel+'</b></div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted)">Giá</span><b style="color:var(--green)">'+(plan.price===0?'MIỄN PHÍ':fmtMoney(plan.price))+'</b></div><div style="height:1px;background:var(--border);margin:8px 0"></div><div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Số dư</span><b style="color:'+(canAfford?'var(--green)':'var(--red)')+'">'+fmtMoney(CURRENT_BALANCE)+'</b></div></div>'+(canAfford?'':noFundMsg);
  document.getElementById('vps-confirm-err').textContent='';
  openModal('vps-confirm-modal');
}
async function doVpsBuy(){
  if(!_vpsPendingPlan) return;
  const btn=document.querySelector('#vps-confirm-modal .btn.btn-primary');
  const err=document.getElementById('vps-confirm-err');
  if(btn){btn.disabled=true;btn.textContent='⏳ Đang xử lý...';}
  try{
    const payload=_vpsPendingPlan.custom
      ?{plan_id:_vpsPendingPlan.id,custom:true,slots:_vpsPendingPlan.slots,days:_vpsPendingPlan.days,price:_vpsPendingPlan.price,name:_vpsPendingPlan.name}
      :{plan_id:_vpsPendingPlan.id};
    const r=await fetch('/api/slots/buy',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},body:JSON.stringify(payload)});
    const d=await r.json();
    if(!r.ok) throw new Error(d.detail||'Lỗi mua');
    updateBalanceDisplay(d.new_balance);
    const balEl=document.getElementById('vps-shop-balance');
    if(balEl) balEl.textContent=fmtMoney(d.new_balance);
    closeModal('vps-confirm-modal');
    closeModal('vps-shop-modal');
    const boughtSlots=_vpsPendingPlan.slots||_vpsPendingPlan.qty||1;
    showToast('✅ Mua thành công '+boughtSlots+' máy ảo! Tổng máy ảo: '+d.total_slots,'#00e676');
    _vpsPendingPlan=null;
  }catch(ex){if(err) err.textContent='❌ '+ex.message;}
  finally{if(btn){btn.disabled=false;btn.textContent='✅ Xác nhận mua';}}
}

// ═══════════════════════════════════════════════════════
//  MY VPS
// ═══════════════════════════════════════════════════════
async function openMyVps(){
  openModal('my-vps-modal');
  var list=document.getElementById('my-vps-list');
  list.innerHTML='<div style="color:var(--muted);text-align:center;padding:20px">Đang tải...</div>';
  try{
    var r=await fetch('/api/slots/my',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    var resp=await r.json();
    var vps=resp.slots||[];
    if(!vps.length){
      list.innerHTML='<div style="text-align:center;padding:30px"><div style="font-size:40px;margin-bottom:10px">🖥</div><div style="color:var(--muted)">Bạn chưa có máy ảo nào</div></div>';
      var buyBtn=document.createElement('button');
      buyBtn.className='btn btn-primary';
      buyBtn.style.cssText='margin-top:12px;padding:10px 20px';
      buyBtn.textContent='🛒 Mua ngay';
      buyBtn.onclick=function(){closeModal('my-vps-modal');openVpsShop();};
      list.querySelector('div').appendChild(buyBtn);
      return;
    }
    list.innerHTML='';
    var now=new Date();
    vps.forEach(function(v){
      var expHtml='<div style="font-size:11px;color:var(--green);margin-top:8px">⏰ Không giới hạn</div>';
      if(v.expires_at){
        try{
          var p2=v.expires_at.split(' ');var dp=p2[0].split('/');var tp=p2[1].split(':');
          var expMs=new Date(+dp[2],+dp[1]-1,+dp[0],+tp[0],+tp[1],+tp[2]).getTime();
          var diffMs=expMs-Date.now();
          var d=Math.floor(diffMs/86400000),h=Math.floor((diffMs%86400000)/3600000),m=Math.floor((diffMs%3600000)/60000);
          if(diffMs<=0){
            expHtml='<div style="font-size:11px;color:var(--red);margin-top:8px">❌ Đã hết hạn</div>';
          } else if(diffMs<3*86400000){
            expHtml='<div style="font-size:11px;color:var(--yellow);margin-top:8px">⚠️ Còn lại: '+(d>0?d+'n ':'')+h+'g '+m+'p</div>';
          } else {
            expHtml='<div style="font-size:11px;color:var(--muted);margin-top:8px">⏰ Còn lại: '+(d>0?d+' ngày ':'')+h+'g '+m+'p · <span style="color:var(--green)">✅ Hoạt động</span></div>';
          }
        }catch(e2){ expHtml='<div style="font-size:11px;color:var(--muted);margin-top:8px">⏰ Hết hạn: '+v.expires_at+'</div>'; }
      }
      var card=document.createElement('div');
      card.className='vps-my-card';
      card.innerHTML='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
        +'<div><div style="font-size:13px;font-weight:800">'+v.plan_name+'</div>'
        +'<div style="font-size:11px;color:var(--muted);margin-top:2px">📱 Máy ảo · 🆔 '+v.id+'</div></div></div>'
        +expHtml
        +'<div style="font-size:11px;color:var(--muted);margin-top:4px">📅 Mua: '+v.created+'</div>';
      list.appendChild(card);
    });
  }catch(e3){list.innerHTML='<div style="color:var(--red);text-align:center">Lỗi tải dữ liệu</div>';}
}

// ═══════════════════════════════════════════════════════
//  ACCOUNT INFO
// ═══════════════════════════════════════════════════════
async function openAccountInfo(){
  openModal('account-info-modal');
  loadAvatar();
  try{
    const r=await fetch('/api/me',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const d=await r.json();
    const tick='<span style="color:#1877f2;font-size:14px" title="Đã xác minh">✔</span>';
    document.getElementById('ai-username').innerHTML=d.username+' '+tick;
    const atEl=document.getElementById('ai-username-at');if(atEl)atEl.textContent=d.username;
    document.getElementById('ai-role').textContent=d.is_admin?'👑 Quản trị viên':'👤 Thành viên';
    document.getElementById('ai-email').textContent=d.email||'—';
    const cr=d.created||'—';
    const crEl=document.getElementById('ai-created');if(crEl)crEl.textContent=cr;
    document.getElementById('ai-balance').innerHTML=d.is_admin?'<span style="color:#ffd740;font-weight:900">∞</span>':fmtMoney(d.balance||0);
    updateBalanceDisplay(d.balance||0);
  }catch{}
  // Load slot count
  try{
    if(IS_ADMIN){
      const el=document.getElementById('ai-slots');if(el)el.innerHTML='<span style="font-weight:900;color:#00e5ff">∞</span> máy ảo';
      const badge=document.getElementById('ai-slot-badge');if(badge)badge.innerHTML='📱 <span style="font-weight:900;color:#00e5ff">∞</span> máy ảo';
    } else {
      const sr=await fetch('/api/slots/count',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
      if(sr.ok){
        const sd=await sr.json();
        const slotsTxt=sd.total_slots+' máy ảo';
        const el=document.getElementById('ai-slots');if(el)el.textContent=slotsTxt;
        const badge=document.getElementById('ai-slot-badge');if(badge)badge.textContent='📱 '+slotsTxt;
      }
    }
  }catch{}
  document.getElementById('ai-oldpw').value='';document.getElementById('ai-newpw').value='';document.getElementById('ai-newpw2').value='';
  document.getElementById('ai-pw-err').textContent='';
}
function switchHistTab(tab){
  document.getElementById('hist-tab-dep').classList.toggle('active',tab==='deposit');
  document.getElementById('hist-tab-pur').classList.toggle('active',tab==='purchase');
  loadHistTab(tab);
}
async function loadHistTab(tab){
  const list=document.getElementById('ai-hist-list');
  list.innerHTML='<div style="color:var(--muted);font-size:12px;padding:8px">Đang tải...</div>';
  try{
    const url=tab==='deposit'?'/api/deposit/history':'/api/purchase/history';
    const r=await fetch(url,{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const data=await r.json();
    if(!data.length){list.innerHTML='<div style="color:var(--muted);text-align:center;padding:16px;font-size:12px">Chưa có dữ liệu</div>';return;}
    if(tab==='deposit'){
      list.innerHTML=data.slice(0,20).map(function(d){
        const label=d.status==='pending'?'⏳ Chờ':d.status==='approved'?'✅ OK':'❌ Từ chối';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:8px;background:var(--glass2);margin-bottom:6px;font-size:12px"><div><div style="font-weight:700">'+fmtMoney(d.amount)+'</div><div style="color:var(--muted);font-size:10px">'+(d.created||'')+'</div></div><span class="dep-status-badge '+d.status+'">'+label+'</span></div>';
      }).join('');
    } else {
      list.innerHTML=data.slice(0,20).map(function(p){
        return '<div style="padding:8px 10px;border-radius:8px;background:var(--glass2);margin-bottom:6px;font-size:12px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><b>'+p.plan_name+'</b><span style="color:var(--green);font-weight:800">'+fmtMoney(p.price)+'</span></div><div style="color:var(--muted);font-size:11px">'+p.qty+' máy · Hết hạn: '+(p.expires_at||'Không giới hạn')+' · '+(p.created||'')+'</div></div>';
      }).join('');
    }
  }catch{list.innerHTML='<div style="color:var(--red);font-size:12px">Lỗi tải dữ liệu</div>';}
}
async function doChangePw(){
  const old=document.getElementById('ai-oldpw').value.trim();
  const nw=document.getElementById('ai-newpw').value.trim();
  const nw2=document.getElementById('ai-newpw2').value.trim();
  const err=document.getElementById('ai-pw-err');
  if(!old||!nw||!nw2){err.textContent='Điền đầy đủ các ô';return;}
  if(nw.length<6){err.textContent='Mật khẩu mới tối thiểu 6 ký tự';return;}
  if(nw!==nw2){err.textContent='Mật khẩu mới không khớp';return;}
  try{
    const r=await fetch('/api/change-password',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},body:JSON.stringify({old_password:old,new_password:nw})});
    const d=await r.json();
    if(!r.ok) throw new Error(d.detail||'Lỗi đổi mật khẩu');
    err.style.color='var(--green)';err.textContent='✅ Đổi mật khẩu thành công!';
    document.getElementById('ai-oldpw').value='';document.getElementById('ai-newpw').value='';document.getElementById('ai-newpw2').value='';
    setTimeout(function(){err.textContent='';err.style.color='var(--red)';},3000);
  }catch(ex){err.style.color='var(--red)';err.textContent='❌ '+ex.message;}
}

