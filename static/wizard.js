// ── Server Wizard State ──
let _svWizardStep = 0;
let _svCookieStr = '', _svAccName = '', _svTargetUrl = '', _svVictimName = '';
let _svSelectedSlot = null; // slot đã chọn {id, plan_name, expires_at}

// Tải danh sách slot và hiển thị ở bước 0 (chọn slot)
async function svLoadSlotList(){
  const el = document.getElementById('sv-slot-list');
  if(!el) return;
  el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:16px">⏳ Đang tải...</div>';
  try{
    const r = await fetch('/api/slots/my', {headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const d = await r.json();
    const slots = (d.slots||[]);
    if(!slots.length){
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">'
        + '<div style="font-size:32px;margin-bottom:8px">📭</div>'
        + '<div style="font-size:13px">Bạn chưa có slot nào.</div>'
        + '<div style="font-size:12px;margin-top:6px">Mua slot để bắt đầu dame!</div>'
        + '<button onclick="closeModal(\'create-server-modal\');openVpsShop()" class="btn btn-primary" style="margin-top:14px;padding:10px 24px">🛒 Mua ngay</button>'
        + '</div>';
      return;
    }
    // Lọc slot còn chỗ trống (chưa dùng hết)
    const used = d.used_slots || 0;
    const total = d.total_slots || 0;
    el.innerHTML = slots.map((s,i) => {
      let expText = '⏰ Không giới hạn';
      let expColor = 'var(--green)';
      if(s.expires_at){
        try{
          const p2=s.expires_at.split(' ');const dp=p2[0].split('/');const tp=p2[1].split(':');
          const expMs=new Date(+dp[2],+dp[1]-1,+dp[0],+tp[0],+tp[1],+tp[2]).getTime();
          const diffMs=expMs-Date.now();
          const dd=Math.floor(diffMs/86400000),hh=Math.floor((diffMs%86400000)/3600000),mm=Math.floor((diffMs%3600000)/60000);
          if(diffMs<=0){expText='❌ Đã hết hạn';expColor='var(--red)';}
          else if(diffMs<3*86400000){expText=`⚠️ Còn ${dd>0?dd+'n ':''}${hh}g ${mm}p`;expColor='var(--yellow)';}
          else{expText=`✅ Còn ${dd>0?dd+' ngày ':hh+'g '+mm+'p'}`;expColor='var(--green)';}
        }catch(e){ expText='⏰ '+s.expires_at; }
      }
      return `<div class="sv-slot-item" id="sv-slot-${s.id}" onclick="svSelectSlot('${s.id}','${(s.plan_name||'').replace(/'/g,"\'")}','${s.expires_at||''}')" style="padding:12px 14px;border-radius:12px;border:2px solid var(--border);cursor:pointer;transition:.2s;margin-bottom:8px;background:var(--glass2)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:13px;font-weight:800">${s.plan_name||'Slot'}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">🆔 ${s.id}</div>
          </div>
          <div style="font-size:11px;color:${expColor};text-align:right">${expText}</div>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    el.innerHTML = '<div style="color:var(--red);padding:16px;text-align:center">❌ Lỗi tải slot</div>';
  }
}

function svSelectSlot(id, planName, expiresAt){
  _svSelectedSlot = {id, plan_name:planName, expires_at:expiresAt};
  // Highlight selected
  document.querySelectorAll('.sv-slot-item').forEach(el=>{
    el.style.borderColor = 'var(--border)';
    el.style.background = 'var(--glass2)';
  });
  const sel = document.getElementById('sv-slot-'+id);
  if(sel){ sel.style.borderColor='var(--blue)'; sel.style.background='rgba(79,158,255,.08)'; }
  // Enable next button
  const btn = document.getElementById('sv-btn-slot-next');
  if(btn){ btn.disabled=false; btn.style.opacity='1'; }
}

function svSetStep(n){
  _svWizardStep = n;
  for(let i=0;i<=3;i++){
    const el=document.getElementById('sv-step-'+i);
    if(el) el.style.display=(i===n)?'block':'none';
    const bar=document.getElementById('sv-step-bar-'+i);
    if(bar){
      if(i===n){ bar.style.background='linear-gradient(135deg,var(--blue2),var(--purple))'; bar.style.color='#fff'; }
      else if(i<n){ bar.style.background='rgba(0,230,118,.15)'; bar.style.color='var(--green)'; }
      else { bar.style.background='none'; bar.style.color='var(--muted)'; }
    }
  }
}

function svWizardBack(currentStep){
  svSetStep(currentStep - 1);
  if(currentStep - 1 === 0){ svLoadSlotList(); }
}

function openCreateServerModal(){
  closeModal('intro-modal');
  // Reset
  ['sv-name','sv-cookie','sv-target','sv-victim-name','sv-tab-name'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  ['sv-cookie-hint','sv-cookie-result','sv-err1','sv-err2','sv-err3','sv-err-slot'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.style.display='none'; el.textContent=''; }
  });
  _svCookieStr=''; _svAccName=''; _svTargetUrl=''; _svVictimName=''; _svSelectedSlot=null;
  openModal('create-server-modal');
  svSetStep(0); // Step 0 = chọn slot
  svLoadSlotList();
}

function svWizardNext(step){
  if(step===0){
    // Step 0 = chọn slot
    if(!IS_ADMIN && !_svSelectedSlot){
      const err=document.getElementById('sv-err-slot');
      if(err){err.style.display='block';err.textContent='⚠️ Vui lòng chọn một slot để tiếp tục!';}
      return;
    }
    svSetStep(1);
  } else if(step===1){
    // Step 1 = nhập tên (optional)
    svSetStep(2);
  }
}

function svDetectCookieFormat(val){
  const hint = document.getElementById('sv-cookie-hint'); if(!hint) return;
  val = val.trim(); if(!val){ hint.textContent=''; return; }
  if(val.startsWith('[')) hint.textContent='✅ Phát hiện: JSON array (Cookie-Editor)';
  else if(val.startsWith('{')) hint.textContent='✅ Phát hiện: JSON object';
  else if(val.includes('\t')) hint.textContent='✅ Phát hiện: Netscape format';
  else if(val.includes('c_user=') || val.includes('datr=') || val.includes('xs=')){
    const keys=(val.match(/\w+=\S*/g)||[]).length;
    hint.textContent=`✅ Phát hiện: Header string (~${keys} cookie)`;
  } else hint.textContent='⚠️ Không rõ format — thử xác nhận xem sao';
}

async function svPasteCookie(){
  try{ const t=await navigator.clipboard.readText(); document.getElementById('sv-cookie').value=t; svDetectCookieFormat(t); }
  catch{ showToast('Ctrl+V để dán thủ công','#ff9100'); }
}

function svWizardCookieVerify(){
  const cookie = document.getElementById('sv-cookie').value.trim();
  const result = document.getElementById('sv-cookie-result');
  const err    = document.getElementById('sv-err1');
  err.style.display='none';
  if(!cookie){ err.style.display='block'; err.textContent='⚠️ Chưa nhập cookie!'; return; }

  // Lấy uid từ c_user nếu có, không thì dùng tên tab
  let uid = '';
  const m = cookie.match(/c_user[=:]\s*["']?(\d+)/);
  if(m) uid = m[1];

  _svCookieStr = cookie;
  const tabName = document.getElementById('sv-tab-name').value.trim();
  _svAccName = tabName || (uid ? 'UID ' + uid : 'Cookie ' + cookie.substring(0,8) + '...');

  result.style.display='block';
  result.style.background='rgba(0,230,118,.08)';
  result.style.border='1px solid rgba(0,230,118,.25)';
  result.style.color='var(--green)';
  result.innerHTML=`<div style="display:flex;align-items:center;gap:10px"><div style="font-size:22px">🍪</div><div><div style="font-weight:700">${_svAccName}</div><div style="font-size:11px;margin-top:2px">✅ Cookie hợp lệ!</div></div></div>`;
  playSfx('success');
  setTimeout(()=>{
    document.getElementById('sv-acc-name-show').textContent=_svAccName;
    svSetStep(3);
  }, 700);
}

function svWizardTargetConfirm(){
  let target=document.getElementById('sv-target').value.trim();
  const err=document.getElementById('sv-err2');
  err.style.display='none';
  if(!target){ err.style.display='block'; err.textContent='⚠️ Chưa nhập target!'; return; }
  if(target.match(/^\d{6,}$/)) target='https://www.facebook.com/profile.php?id='+target;
  else if(!target.startsWith('http')) target='https://www.facebook.com/'+target;
  _svTargetUrl=target;
  _svVictimName=document.getElementById('sv-victim-name').value.trim()||target;
  // Fill summary
  const svName=document.getElementById('sv-name').value.trim()||('Máy chủ · '+_svVictimName.substring(0,20));
  document.getElementById('sv-sum-name').textContent=svName;
  document.getElementById('sv-sum-acc').textContent=_svAccName;
  document.getElementById('sv-sum-victim').textContent=_svVictimName;
  document.getElementById('sv-sum-target').textContent=_svTargetUrl;
  const slotEl=document.getElementById('sv-sum-slot');
  if(slotEl) slotEl.textContent=_svSelectedSlot?(_svSelectedSlot.plan_name||_svSelectedSlot.id):'(Admin)';
  playSfx('success');
  svSetStep(4);
}

async function _svSaveServer(){
  const name=document.getElementById('sv-name').value.trim()||('Máy chủ · '+_svVictimName.substring(0,20));
  const speed=document.getElementById('sv-speed').value;
  const payload={name,cookie:_svCookieStr,target_url:_svTargetUrl,speed,acc_name:_svAccName,acc_uid:'',target_name:_svVictimName};
  if(_svSelectedSlot){ payload.slot_id=_svSelectedSlot.id; }
  const r=await fetch('/api/servers',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
    body:JSON.stringify(payload)});
  const d=await r.json();
  if(!r.ok) throw new Error(d.detail||'Lỗi lưu');
  return d.server;
}

async function svWizardStartAndSave(){
  const err=document.getElementById('sv-err3');
  const btn=document.getElementById('sv-btn-start');
  err.style.display='none'; btn.disabled=true; btn.textContent='⏳ Đang khởi động...';
  try{
    const server=await _svSaveServer();
    const speed=document.getElementById('sv-speed').value;
    const r=await fetch('/api/dame/start',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
      body:JSON.stringify({cookie:_svCookieStr,target_url:_svTargetUrl,speed,acc_name:_svAccName,acc_uid:'',target_name:_svVictimName,server_id:server.id})});
    const d=await r.json();
    if(!r.ok) throw new Error(d.detail||'Lỗi khởi động');
    closeModal('create-server-modal');
    showToast('🐬 Máy chủ đã khởi động!','var(--green)');
    if(!window._svLogIdx) window._svLogIdx = {};
    window._svLogIdx[server.id] = 0;
    openServerListModal();
  }catch(e){ err.style.display='block'; err.textContent='❌ '+e.message; }
  finally{ btn.disabled=false; btn.textContent='🐬 Lưu & Chạy ngay'; }
}

async function svWizardSaveOnly(){
  const err=document.getElementById('sv-err3');
  err.style.display='none';
  try{
    await _svSaveServer();
    closeModal('create-server-modal');
    showToast('💾 Đã lưu máy chủ!','var(--blue)');
    openServerListModal();
  }catch(e){ err.style.display='block'; err.textContent='❌ '+e.message; }
}

// Legacy doCreateServer — redirect to wizard
function doCreateServer(){ svWizardStartAndSave(); }

