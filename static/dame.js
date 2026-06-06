// ═══════════════════════════════════════════════════════
//  DAME STATE
// ═══════════════════════════════════════════════════════
let _cookieStr   = '', _accName = '', _accUid = '';
let _targetUrl   = '', _targetName = '', _targetUid = '';

function hideBox(id){ const el=document.getElementById(id); if(el) el.style.display='none'; }
function showBox(id){ const el=document.getElementById(id); if(el) el.style.display='block'; }

// ── CẬP NHẬT PROGRESS BAR BƯỚC ──
function setActiveStep(n){
  for(let i=1;i<=3;i++){
    const el=document.getElementById('step-bar-'+i);
    if(!el) continue;
    if(i===n){
      el.style.background='linear-gradient(135deg,var(--blue2),var(--purple))';
      el.style.color='#fff';
    } else if(i<n){
      el.style.background='rgba(0,230,118,.15)';
      el.style.color='var(--green)';
    } else {
      el.style.background='none';
      el.style.color='var(--muted)';
    }
  }
  ['step1','step2','step3'].forEach((id,idx)=>{
    const el=document.getElementById(id);
    if(el) el.style.display=(idx+1===n)?'block':'none';
  });
}

// ── RESET VỀ BƯỚC ──
function resetToStep1(){
  _cookieStr=''; _accName=''; _accUid='';
  _targetUrl=''; _targetName=''; _targetUid='';
  hideBox('cookie-verify-box');
  const ta=document.getElementById('fb-cookie-input');
  if(ta) ta.value='';
  document.getElementById('step1-err').style.display='none';
  setActiveStep(1);
}
function resetToStep2(){
  _targetUrl=''; _targetName=''; _targetUid='';
  const inp=document.getElementById('fb-target-input');
  if(inp) inp.value='';
  hideBox('target-verify-box');
  document.getElementById('step2-err').style.display='none';
  setActiveStep(2);
}

// ── BƯỚC 1: XÁC NHẬN COOKIE ──

// ── SUBMIT OTP FB LOGIN ──
async function submitOTP(session_id, otp_code){
  const resEl=document.getElementById('pass-login-result');
  const scImg=document.getElementById('pass-login-sc');
  const scBox=document.getElementById('pass-login-scbox');
  if(!resEl)return;
  resEl.innerHTML = '<div style="color:var(--blue)">⏳ Đang xác minh OTP...</div>';
  try{
    const r = await fetch('/api/fb-login-pass/otp',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
      body: JSON.stringify({session_id, otp_code, _token: SESSION_TOKEN})
    });
    const {job_id} = await r.json();
    for(let i=0;i<40;i++){
      await new Promise(r=>setTimeout(r,3000));
      const pr = await fetch('/api/fb-login-pass/poll/'+job_id,{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
      const pd = await pr.json();
      if(pd.status==='done'||pd.status==='error'){
        const d = pd.result;
        if(d.screenshot_b64 && scImg && scBox){ scImg.src='data:image/jpeg;base64,'+d.screenshot_b64; scBox.style.display='block'; }
        if(d.status==='success'){
          resEl.style.color='#2ecc71';
          resEl.innerHTML='✅ Đăng nhập thành công! Cookie đã được lưu.';
          window._fbCookieFromLogin = d.cookie;
        } else if(d.status==='2fa'){
          resEl.innerHTML=`<div style="color:var(--blue)">🔐 ${d.message}</div>
            <input id="otp-input" type="text" inputmode="numeric" maxlength="8" placeholder="Nhập lại OTP..." style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:#fff;font-size:16px;margin:8px 0"/>
            <button onclick="submitOTP('${d.session_id}',document.getElementById('otp-input').value)" style="width:100%;padding:11px;border-radius:10px;background:linear-gradient(135deg,#4f9eff,#9b59b6);color:#fff;font-weight:700;border:none;cursor:pointer">✅ Xác nhận OTP</button>`;
        } else {
          resEl.style.color='#e74c3c';
          resEl.innerHTML=d.message;
        }
        break;
      }
    }
  }catch(e){ const errEl=document.getElementById('pass-login-err'); if(errEl){errEl.style.display='block';errEl.textContent='Lỗi: '+e.message;} }
}

// ── LOGIN MODE SWITCH ──
function detectCookieFormat(val){
  const hint = document.getElementById('cookie-format-hint');
  if(!hint) return;
  val = val.trim();
  if(!val){ hint.textContent=''; return; }
  if(val.startsWith('[')){
    hint.textContent='✅ Phát hiện: JSON array (Cookie-Editor)';
  } else if(val.startsWith('{')){
    hint.textContent='✅ Phát hiện: JSON object';
  } else if(val.includes('	')){
    hint.textContent='✅ Phát hiện: Netscape format';
  } else if(val.includes('c_user=') || val.includes('datr=') || val.includes('xs=')){
    const keys = (val.match(/\w+=\S*/g)||[]).length;
    hint.textContent=`✅ Phát hiện: Header string (~${keys} cookie)`;
  } else {
    hint.textContent='⚠️ Không rõ format — thử xác nhận xem sao';
  }
}

async function pasteCookie(){
  try{
    const t=await navigator.clipboard.readText();
    document.getElementById('fb-cookie-input').value=t;
    detectCookieFormat(t);
  }
  catch{ showToast('Ctrl+V để dán thủ công','#ff9100'); }
}

function stepVerifyCookie(){
  const cookie = document.getElementById('fb-cookie-input').value.trim();
  const box    = document.getElementById('cookie-verify-box');
  const err    = document.getElementById('step1-err');
  err.style.display='none';

  if(!cookie){ err.style.display='block'; err.textContent='⚠️ Chưa nhập cookie!'; return; }

  // Lấy uid từ c_user nếu có
  let uid = '';
  const m = cookie.match(/c_user[=:]\s*["']?(\d+)/);
  if(m) uid = m[1];

  _cookieStr = cookie;
  _accUid    = uid;
  _accName   = document.getElementById('tab-name-input').value.trim() || (uid ? 'UID ' + uid : 'Cookie ' + cookie.substring(0,8) + '...');

  showBox('cookie-verify-box');
  box.style.background='rgba(0,230,118,.08)';
  box.style.border='1px solid rgba(0,230,118,.25)';
  box.style.color='var(--green)';
  box.innerHTML=`<div style="display:flex;align-items:center;gap:10px">
      <div style="font-size:26px">🍪</div>
      <div>
        <div style="font-weight:700;font-size:14px">${_accName}</div>
        <div style="font-size:11px;margin-top:2px">✅ Cookie hợp lệ!</div>
      </div>
    </div>`;
  playSfx('success');
  setTimeout(()=>{
    document.getElementById('acc-confirmed-name').textContent = _accName;
    setActiveStep(2);
  }, 900);
}

// ── BƯỚC 2: XÁC NHẬN TARGET ──
async function stepVerifyTarget(){
  let target = document.getElementById('fb-target-input').value.trim();
  const err  = document.getElementById('step2-err');
  const btn  = document.getElementById('btn-verify-target');
  err.style.display='none';

  if(!target){ err.style.display='block'; err.textContent='⚠️ Chưa nhập link target!'; return; }

  // Chuẩn hóa URL
  if(target.match(/^\d{6,}$/)) target = 'https://www.facebook.com/profile.php?id='+target;
  else if(!target.startsWith('http')) target = 'https://www.facebook.com/'+target;
  _targetUrl = target;
  _targetName = document.getElementById('victim-name-input').value.trim() || target;

  playSfx('success');
  document.getElementById('sum-tab-name').textContent    = _accName;
  document.getElementById('sum-acc-name').textContent    = _accName;
  document.getElementById('sum-target-name').textContent = _targetName;
  document.getElementById('sum-target-url').textContent  = _targetUrl;
  setActiveStep(3);
}

// ── BƯỚC 3: BẮT ĐẦU DAME ──
async function startDame(){
  const speed = document.getElementById('speed-select').value;
  const err   = document.getElementById('step3-err');
  const btn   = document.getElementById('btn-start-dame');
  err.style.display='none';
  btn.disabled=true; btn.textContent='⏳ Đang khởi động...';

  try{
    const r = await fetch('/api/dame/start',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
      body: JSON.stringify({
        cookie: _cookieStr, target_url: _targetUrl, speed,
        acc_name: _accName, acc_uid: _accUid, target_name: _targetName
      })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.detail||'Lỗi khởi động');

    dameRunning=true; damePaused=false; dameStop=false;
    dameTotal=0; dameLoops=0; dameStartTime=Date.now();

    // Cập nhật tab trạng thái
    document.getElementById('run-acc-info').style.display='block';
    document.getElementById('run-acc-name').textContent    = _accName;
    document.getElementById('run-victim-name').textContent = '👤 '+_targetName;
    document.getElementById('run-target-url').textContent  = '🔗 '+_targetUrl;
    document.getElementById('run-dot').className='dot active';
    document.getElementById('run-status-text').textContent='🐬 Đang dame '+_targetName+'...';

    switchMainTab('run');
    addLog('🚀 Bắt đầu dame: '+_targetName);
    addLog('👤 Cookie: '+_accName+' | UID: '+(_accUid||'?'));

    startDameStatusPolling();

    updateRunUI();
    playSfx('success');
    showToast('🐬 Dame đang chạy...','#9b59b6');

  } catch(e){
    err.style.display='block';
    err.textContent='❌ '+e.message;
    playSfx('error');
  } finally {
    btn.disabled=false;
    btn.textContent='🐬 Bắt đầu Dame';
  }
}

function addLog(msg){
  const el=document.getElementById('run-log'); if(!el) return;
  const ts=new Date().toLocaleTimeString('vi-VN');
  el.innerHTML+=`<div><span style="color:var(--muted)">[${ts}]</span> ${msg}</div>`;
  el.scrollTop=el.scrollHeight;
}

function updateRunUI(){
  document.getElementById('run-total').textContent=dameTotal;
  document.getElementById('run-loops').textContent=dameLoops;
  if(dameStartTime){
    const s=Math.floor((Date.now()-dameStartTime)/1000);
    const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;
    document.getElementById('run-uptime').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  }
  const pause=document.getElementById('btn-pause');
  const resume=document.getElementById('btn-resume');
  const stop=document.getElementById('btn-stop');
  if(pause)  pause.style.display  = dameRunning&&!damePaused?'flex':'none';
  if(resume) resume.style.display = dameRunning&&damePaused?'flex':'none';
  if(stop)   stop.style.display   = dameRunning?'flex':'none';
}

function togglePause(){
  damePaused=!damePaused;
  fetch('/api/dame/'+(damePaused?'pause':'resume'),{method:'POST',headers:{'Authorization':'Bearer '+SESSION_TOKEN}}).catch(()=>{});
  document.getElementById('run-status-text').textContent=damePaused?'⏸️ Tạm dừng':'🐬 Đang dame '+_targetName+'...';
  addLog(damePaused?'⏸ Tạm dừng':'▶ Tiếp tục');
  updateRunUI();
}

function stopDame(){
  dameStop=true; dameRunning=false;
  if(dameTimer) clearInterval(dameTimer);
  fetch('/api/dame/stop',{method:'POST',headers:{'Authorization':'Bearer '+SESSION_TOKEN}}).catch(()=>{});
  document.getElementById('run-dot').className='dot';
  document.getElementById('run-status-text').textContent='⏹️ Đã dừng · Tổng: '+dameTotal+' báo cáo';
  addLog('⏹ Dừng · tổng '+dameTotal);
  updateRunUI();
}

function switchMainTab(tab){
  document.getElementById('main-tab-input').style.display = tab==='input'?'block':'none';
  document.getElementById('main-tab-run').style.display   = tab==='run'?'block':'none';
  document.getElementById('tab-input-btn').classList.toggle('active',tab==='input');
  document.getElementById('tab-run-btn').classList.toggle('active',tab==='run');
  if(tab==='run' && SESSION_TOKEN) {
    loadServerRail();
    // Hiện inline screenshot nếu đang chạy
    refreshInlineScreenshot();
  }
}

