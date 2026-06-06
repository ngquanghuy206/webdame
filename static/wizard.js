// ── Server Wizard State ──
let _svWizardStep = 0;
let _svCookieStr = '', _svAccName = '', _svTargetUrl = '', _svVictimName = '';

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
}

function openCreateServerModal(){
  closeModal('intro-modal');
  svSetStep(0);
  // Reset fields
  ['sv-name','sv-cookie','sv-target','sv-victim-name','sv-tab-name'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  ['sv-cookie-hint','sv-cookie-result','sv-err1','sv-err2','sv-err3'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.style.display='none'; el.textContent=''; }
  });
  _svCookieStr=''; _svAccName=''; _svTargetUrl=''; _svVictimName='';
  openModal('create-server-modal');
}

function svWizardNext(step){
  if(step===0){
    // Validate tên (optional, bỏ qua nếu trống)
    svSetStep(1);
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
    svSetStep(2);
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
  playSfx('success');
  svSetStep(3);
}

async function _svSaveServer(){
  const name=document.getElementById('sv-name').value.trim()||('Máy chủ · '+_svVictimName.substring(0,20));
  const speed=document.getElementById('sv-speed').value;
  const r=await fetch('/api/servers',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
    body:JSON.stringify({name,cookie:_svCookieStr,target_url:_svTargetUrl,speed,acc_name:_svAccName,acc_uid:'',target_name:_svVictimName})});
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

