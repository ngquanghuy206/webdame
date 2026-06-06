// ═══════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════
function switchAuthTab(tab){
  document.getElementById('auth-login-form').style.display=tab==='login'?'flex':'none';
  document.getElementById('auth-register-form').style.display=tab==='register'?'flex':'none';
  if(tab==='register'){const s1=document.getElementById('reg-step1');const s2=document.getElementById('reg-step2');if(s1)s1.style.display='block';if(s2)s2.style.display='none';}
  document.getElementById('tab-login-btn').classList.toggle('active',tab==='login');
  document.getElementById('tab-reg-btn').classList.toggle('active',tab==='register');
  // update titles
  const tl=document.getElementById('auth-title-login'),tr=document.getElementById('auth-title-register');
  const sl=document.getElementById('auth-sub-login'),sr=document.getElementById('auth-sub-register');
  if(tl)tl.style.display=tab==='login'?'':'none';
  if(tr)tr.style.display=tab==='register'?'':'none';
  if(sl)sl.style.display=tab==='login'?'':'none';
  if(sr)sr.style.display=tab==='register'?'':'none';
  if(tab==='register'){selectedOptValue=null;}
}
let _forgotEmail='',_forgotOtp='';
function openForgotModal(){
  _forgotEmail='';_forgotOtp='';
  ['forgot-step1','forgot-step2','forgot-step3'].forEach((id,i)=>document.getElementById(id).style.display=i===0?'block':'none');
  ['forgot-email','forgot-otp','forgot-newpw','forgot-confirmpw'].forEach(id=>document.getElementById(id).value='');
  ['forgot-err1','forgot-err2','forgot-err3'].forEach(id=>document.getElementById(id).textContent='');
  openModal('forgot-modal');
}
async function doForgotSend(){
  const email=document.getElementById('forgot-email').value.trim();
  const err=document.getElementById('forgot-err1');const btn=document.getElementById('forgot-btn1');
  if(!email){err.textContent='Vui lòng nhập Gmail';return;}
  if(!email.toLowerCase().endsWith('@gmail.com')){err.textContent='Chỉ chấp nhận @gmail.com';return;}
  btn.disabled=true;btn.textContent='⏳ Đang gửi...';err.textContent='';
  try{
    const r=await fetch('/api/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
    const d=await r.json();if(!r.ok)throw new Error(d.detail||'Lỗi gửi OTP');
    _forgotEmail=email;
    document.getElementById('forgot-step1').style.display='none';
    document.getElementById('forgot-step2').style.display='block';
    startOtpCountdown(300);
  }catch(e){err.textContent=e.message;}
  finally{btn.disabled=false;btn.textContent='📧 Gửi mã OTP';}
}
async function doVerifyOtp(){
  const otp=document.getElementById('forgot-otp').value.trim();
  const err=document.getElementById('forgot-err2');const btn=document.getElementById('forgot-btn2');
  if(!otp||otp.length!==6){err.textContent='OTP gồm 6 số';return;}
  btn.disabled=true;btn.textContent='⏳...';err.textContent='';
  try{
    const r=await fetch('/api/verify-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:_forgotEmail,otp})});
    const d=await r.json();if(!r.ok)throw new Error(d.detail||'OTP không đúng');
    _forgotOtp=otp;stopOtpCountdown();
    document.getElementById('forgot-step2').style.display='none';
    document.getElementById('forgot-step3').style.display='block';
  }catch(e){err.textContent=e.message;}
  finally{btn.disabled=false;btn.textContent='✅ Xác nhận OTP';}
}
async function doResetPassword(){
  const pw=document.getElementById('forgot-newpw').value.trim();
  const pw2=document.getElementById('forgot-confirmpw').value.trim();
  const err=document.getElementById('forgot-err3');const btn=document.getElementById('forgot-btn3');
  if(!pw||pw.length<6){err.textContent='Mật khẩu tối thiểu 6 ký tự';return;}
  if(pw!==pw2){err.textContent='Mật khẩu không khớp';return;}
  btn.disabled=true;btn.textContent='⏳...';err.textContent='';
  try{
    const r=await fetch('/api/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:_forgotEmail,otp:_forgotOtp,new_password:pw})});
    const d=await r.json();if(!r.ok)throw new Error(d.detail||'Lỗi đặt lại');
    closeModal('forgot-modal');showToast('✅ Đổi mật khẩu thành công! Đăng nhập lại.','#00e676');
  }catch(e){err.textContent=e.message;}
  finally{btn.disabled=false;btn.textContent='🔐 Đặt lại mật khẩu';}
}

async function doLogin(){
  const u=document.getElementById('login-user').value.trim();
  const p=document.getElementById('login-pass').value.trim();
  const err=document.getElementById('login-err');const btn=document.getElementById('login-btn');
  if(!u||!p){err.style.display='block';err.textContent='Vui lòng nhập đầy đủ';return;}
  btn.disabled=true;btn.textContent='⏳ Đang kết nối server...';err.style.display='none';
  const _loginAc=new AbortController();
  const _loginTid=setTimeout(()=>{_loginAc.abort();},20000);
  try{
    const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p}),signal:_loginAc.signal});
    clearTimeout(_loginTid);
    const d=await r.json();if(!r.ok)throw new Error(d.detail||'Sai thông tin');
    SESSION_TOKEN=d.token;CURRENT_USER=d.username;IS_ADMIN=d.is_admin||false;
    if(d.balance!==undefined) updateBalanceDisplay(d.balance);
    const store=rememberMe?localStorage:sessionStorage;
    store.setItem('zct_token',SESSION_TOKEN);store.setItem('zct_user',CURRENT_USER);
    store.setItem('zct_admin',IS_ADMIN?'1':'0');
    const maxAge=rememberMe?60*60*24*30:60*60*8;
    document.cookie=`session_token=${SESSION_TOKEN};path=/;SameSite=Lax;max-age=${maxAge}`;
    playSfx('success');showApp();
  }catch(e){
    err.style.display='block';err.textContent=e.message;playSfx('error');
  }
  finally{btn.disabled=false;btn.textContent='🔐 Đăng nhập';}
}

let _regOtpTimer=null;
function _stopRegOtpTimer(){if(_regOtpTimer)clearInterval(_regOtpTimer);}
function _startRegOtpTimer(){
  _stopRegOtpTimer();
  let remaining=300;
  const label=document.getElementById('reg-otp-timer-val');
  const bar=document.getElementById('reg-otp-bar-fill');
  function tick(){
    const m=Math.floor(remaining/60),s=remaining%60;
    if(label)label.textContent=m+':'+(s<10?'0':'')+s;
    if(bar)bar.style.width=(remaining/300*100)+'%';
    if(remaining<=0){_stopRegOtpTimer();if(label){label.textContent='Hết hạn!';label.style.color='var(--red)';}return;}
    remaining--;
  }
  tick();_regOtpTimer=setInterval(tick,1000);
}

async function doRegisterSendOtp(){
  const u=document.getElementById('reg-user').value.trim();
  const p=document.getElementById('reg-pass').value.trim();
  const em=document.getElementById('reg-email').value.trim();
  const err=document.getElementById('reg-err');const btn=document.getElementById('reg-btn');
  if(!u||!p||!em){err.style.display='block';err.textContent='Vui lòng nhập đầy đủ';return;}
  if(u.length<6||p.length<6){err.style.display='block';err.textContent='Username & mật khẩu tối thiểu 6 ký tự';return;}
  if(!em.toLowerCase().endsWith('@gmail.com')){err.style.display='block';err.textContent='Chỉ chấp nhận @gmail.com';return;}
  if(!verifyCaptcha()){err.style.display='block';err.textContent='❌ CAPTCHA sai! Thử lại.';generateCaptcha();return;}
  btn.disabled=true;btn.textContent='⏳ Đang gửi OTP...';err.style.display='none';
  try{
    const r=await fetch('/api/register/send-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p,email:em})});
    const d=await r.json();if(!r.ok)throw new Error(d.detail||'Lỗi gửi OTP');
    document.getElementById('reg-step1').style.display='none';
    document.getElementById('reg-step2').style.display='block';
    _startRegOtpTimer();
    showToast('📨 OTP đã gửi về Gmail!','#4f9eff');
  }catch(e){err.style.display='block';err.textContent=e.message;}
  finally{btn.disabled=false;btn.textContent='📧 Gửi mã OTP xác minh';}
}

async function doRegisterVerify(){
  const u=document.getElementById('reg-user').value.trim();
  const p=document.getElementById('reg-pass').value.trim();
  const em=document.getElementById('reg-email').value.trim();
  const otp=document.getElementById('reg-otp').value.trim();
  const err=document.getElementById('reg-err');const btn=document.getElementById('reg-otp-btn');
  if(!otp||otp.length!==6){err.style.display='block';err.textContent='Nhập đủ 6 số OTP';return;}
  btn.disabled=true;btn.textContent='⏳ Đang xác minh...';err.style.display='none';
  try{
    const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p,email:em,otp})});
    const d=await r.json();if(!r.ok)throw new Error(d.detail||'Lỗi đăng ký');
    _stopRegOtpTimer();
    showToast('✅ Đăng ký thành công!','#00e676');switchAuthTab('login');
  }catch(e){err.style.display='block';err.textContent=e.message;}
  finally{btn.disabled=false;btn.textContent='✅ Xác minh & Đăng ký';}
}

// Keep legacy doRegister alias
function doRegister(){doRegisterSendOtp();}

function handleAvatarChange(input){
  if(!input.files||!input.files[0])return;
  const file=input.files[0];
  const reader=new FileReader();
  reader.onload=function(e){
    const img=document.getElementById('ai-avatar-img');
    const icon=document.getElementById('ai-avatar-icon');
    const sbAv=document.getElementById('sb-avatar-el');
    if(img){img.src=e.target.result;img.style.display='block';}
    if(icon)icon.style.display='none';
    // Save to localStorage for persistence
    try{localStorage.setItem('zct_avatar_'+CURRENT_USER,e.target.result);}catch(ex){}
    // Update sidebar avatar
    if(sbAv){sbAv.innerHTML='<img src="'+e.target.result+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';}
    // Lưu avatar lên server để người khác thấy
    fetch('/api/user/avatar',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
      body:JSON.stringify({avatar:e.target.result})
    }).catch(()=>{});
    showToast('✅ Đã cập nhật ảnh đại diện','#00e676');
  };
  reader.readAsDataURL(file);
}

function loadAvatar(){
  try{
    const saved=localStorage.getItem('zct_avatar_'+CURRENT_USER);
    if(!saved)return;
    const img=document.getElementById('ai-avatar-img');
    const icon=document.getElementById('ai-avatar-icon');
    const sbAv=document.getElementById('sb-avatar-el');
    if(img){img.src=saved;img.style.display='block';}
    if(icon)icon.style.display='none';
    if(sbAv){sbAv.innerHTML='<img src="'+saved+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';}
  }catch(ex){}
}

function openDepositHistoryModal(){
  openModal('deposit-hist-standalone-modal');
  loadDepositHistoryStandalone();
}
function openPurchaseHistoryModal(){
  openModal('purchase-hist-standalone-modal');
  loadPurchaseHistoryStandalone();
}
async function loadDepositHistoryStandalone(){
  const list=document.getElementById('dep-hist-standalone-list');
  if(!list)return;
  list.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px">⏳ Đang tải...</div>';
  try{
    const r=await fetch('/api/deposit/history',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const data=await r.json();
    if(!data.length){list.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px">📭 Chưa có lịch sử nạp</div>';return;}
    list.innerHTML=data.map(d=>{
      const statusColor=d.status==='approved'?'var(--green)':d.status==='rejected'?'var(--red)':'var(--yellow)';
      const statusText=d.status==='approved'?'✅ Thành công':d.status==='rejected'?'❌ Từ chối':'⏳ Chờ duyệt';
      return `<div style="background:var(--glass2);border-radius:12px;padding:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <b style="font-size:14px;color:var(--green)">${`${(d.amount||0).toLocaleString()}đ`}</b>
          <span style="font-size:12px;color:\${statusColor}">\${statusText}</span>
        </div>
        <div style="font-size:11px;color:var(--muted)">\${d.order_id} · \${d.created}</div>
      </div>`;
    }).join('');
  }catch(ex){list.innerHTML='<div style="color:var(--red);text-align:center">Lỗi tải dữ liệu</div>';}
}
async function loadPurchaseHistoryStandalone(){
  const list=document.getElementById('pur-hist-standalone-list');
  if(!list)return;
  list.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px">⏳ Đang tải...</div>';
  try{
    const r=await fetch('/api/purchase/history',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const data=await r.json();
    if(!data.length){list.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px">📭 Chưa có lịch sử mua</div>';return;}
    list.innerHTML=data.map(d=>`<div style="background:var(--glass2);border-radius:12px;padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <b style="font-size:13px" id="pur-id-disp">\${d.id||'#dzixmode?????'}</b>
        <span style="font-size:12px;color:var(--cyan)">\${d.qty} máy ảo</span>
      </div>
      <div style="font-size:12px;margin-bottom:4px">\${d.plan_name}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted)">
        <span>\${(d.price||0).toLocaleString()}đ</span>
        <span>Hết hạn: \${d.expires_at}</span>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">\${d.created}</div>
    </div>`).join('');
  }catch(ex){list.innerHTML='<div style="color:var(--red);text-align:center">Lỗi tải dữ liệu</div>';}
}

function toggleRemember(){
  rememberMe=!rememberMe;
  localStorage.setItem('zct_remember',rememberMe?'1':'0');
  const el=document.getElementById('remember-check');
  el.classList.toggle('checked',rememberMe);
  el.classList.toggle('remember-check-new',true);
  el.textContent=rememberMe?'✓':'';
}

function showApp(){
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app-screen').style.display='none';
  document.getElementById('welcome-screen').style.display='block';
  const badge=document.getElementById('user-badge-el');
  if(badge)badge.innerHTML=(IS_ADMIN?'👑 ':'👤 ')+CURRENT_USER+' <span style="color:#1877f2;font-size:12px" title="Đã xác minh">✔</span>';
  const adminSection=document.getElementById('sb-admin-section');
  if(adminSection)adminSection.style.display=IS_ADMIN?'block':'none';
  const mgmt=document.getElementById('mgmt-menu-item');
  if(mgmt)mgmt.style.display=IS_ADMIN?'flex':'none';
  // Hide deposit/vps items for admin
  const depItem=document.getElementById('sb-deposit-item');
  if(depItem)depItem.style.display=IS_ADMIN?'none':'flex';
  const depHistItem=document.getElementById('sb-dep-hist-item');
  if(depHistItem)depHistItem.style.display=IS_ADMIN?'none':'flex';
  const purHistItem=document.getElementById('sb-pur-hist-item');
  if(purHistItem)purHistItem.style.display=IS_ADMIN?'none':'flex';
  const vpsShopItem=document.getElementById('sb-vps-shop-item');
  if(vpsShopItem)vpsShopItem.style.display=IS_ADMIN?'none':'flex';
  const myVpsItem=document.getElementById('sb-my-vps-item');
  if(myVpsItem)myVpsItem.style.display=IS_ADMIN?'none':'flex';
  // Sidebar user info
  const sbName=document.getElementById('sb-name-el');
  if(sbName)sbName.innerHTML=CURRENT_USER+' <span style="color:#1877f2;font-size:12px" title="Đã xác minh">✔</span>';
  const sbRole=document.getElementById('sb-role-el');
  if(sbRole)sbRole.textContent=IS_ADMIN?'👑 Admin':'Thành viên';
  const sbAv=document.getElementById('sb-avatar-el');
  if(sbAv){
    const letter=(CURRENT_USER||'?')[0].toUpperCase();
    sbAv.innerHTML=`<span style="font-size:15px;font-weight:800;color:#fff">${IS_ADMIN?'👑':letter}</span>`;
  }
  if(!IS_ADMIN)setTimeout(loadAvatar,100);
  const sbBal=document.getElementById('sb-balance-el');
  if(sbBal)sbBal.style.display=IS_ADMIN?'none':'block';
  // Welcome greeting
  const titleEl=document.querySelector('#welcome-screen .welcome-title');
  if(titleEl) titleEl.textContent=(IS_ADMIN?'👑 Chào Admin ':'👋 Chào ') + CURRENT_USER + '!';
  startClock();loadHistory();
  if(!IS_ADMIN) refreshBalance();
  // Poll unread chat count for admin badge
  if(IS_ADMIN){
    loadAdminChatThreads();
    setInterval(loadAdminChatThreads, 15000);
  }
}

function closeWelcome(){
  document.getElementById('welcome-screen').style.display='none';
  document.getElementById('app-screen').style.display='block';
}
function goHome(){
  // Đóng tất cả modal nếu có
  document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
  // Về welcome-screen (sảnh chính)
  document.getElementById('app-screen').style.display='none';
  document.getElementById('welcome-screen').style.display='block';
  // Active state sidebar
  document.getElementById('sb-home-item').classList.add('active');
}
function welcomeCreateServer(){
  openCreateServerModal();
}
function welcomeServerList(){
  openServerListModal();
}

function doLogout(){
  const _tok=SESSION_TOKEN;
  SESSION_TOKEN='';CURRENT_USER='';IS_ADMIN=false;
  ['zct_token','zct_user','zct_admin'].forEach(k=>{localStorage.removeItem(k);sessionStorage.removeItem(k);});
  document.cookie='session_token=;path=/;max-age=0';
  stopDame();
  document.getElementById('app-screen').style.display='none';
  document.getElementById('welcome-screen').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  if(_tok) fetch('/api/logout',{method:'POST',headers:{'Authorization':'Bearer '+_tok}}).catch(()=>{});
}




