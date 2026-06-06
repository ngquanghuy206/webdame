// ═══════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════
let rememberMe    = localStorage.getItem('zct_remember') === '1';
let SESSION_TOKEN = rememberMe ? (localStorage.getItem('zct_token')||'') : (sessionStorage.getItem('zct_token')||'');
let CURRENT_USER  = rememberMe ? (localStorage.getItem('zct_user')||'')  : (sessionStorage.getItem('zct_user')||'');
let IS_ADMIN      = rememberMe ? localStorage.getItem('zct_admin')==='1' : sessionStorage.getItem('zct_admin')==='1';
if(SESSION_TOKEN){document.cookie=`session_token=${SESSION_TOKEN};path=/;SameSite=Lax;max-age=${rememberMe?60*60*24*30:60*60*8}`;}
let currentData = null, viewingHistItem = null;

// Dame state
let dameRunning = false, damePaused = false, dameStop = false;
let dameTotal = 0, dameLoops = 0, dameStartTime = null, dameTimer = null;
let dameWin = null; // cửa sổ FB mở

// ═══════════════════════════════════════════════════════
//  CAPTCHA ENGINE
// ═══════════════════════════════════════════════════════
let captchaAnswer = null, captchaType = null;
const CAPTCHA_TYPES = ['math_add','math_sub','math_mul','pick_animal','pick_fruit','pick_color','drag_order','canvas_text','odd_one_out','emoji_count'];
function randomInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }

function generateCaptcha(){
  captchaAnswer = null;
  const type = CAPTCHA_TYPES[randomInt(0, CAPTCHA_TYPES.length-1)];
  captchaType  = type;
  const box = document.getElementById('captcha-content');
  const qEl  = document.getElementById('captcha-q');

  if(type==='math_add'||type==='math_sub'||type==='math_mul'){
    const a=randomInt(1,20),b=randomInt(1,20);
    const op=type==='math_add'?'+':type==='math_sub'?'-':'×';
    const ans=type==='math_add'?a+b:type==='math_sub'?a-b:a*b;
    captchaAnswer=String(ans);
    qEl.textContent=`🔢 Tính: ${a} ${op} ${b} = ?`;
    box.innerHTML=`<div class="captcha-input-row"><input class="captcha-input" id="cap-input" type="number" placeholder="Nhập kết quả"><button class="captcha-refresh" onclick="generateCaptcha()">🔄</button></div>`;
    return;
  }
  if(type==='canvas_text'){
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code='';for(let i=0;i<5;i++)code+=chars[randomInt(0,chars.length-1)];
    captchaAnswer=code;
    qEl.textContent='🖼 Nhập chính xác mã trong ảnh:';
    box.innerHTML=`<div class="captcha-input-row"><canvas id="cap-canvas" class="captcha-canvas" width="220" height="60"></canvas><button class="captcha-refresh" onclick="generateCaptcha()">🔄</button></div><div class="captcha-input-row" style="margin-top:8px"><input class="captcha-input" id="cap-input" type="text" maxlength="5" placeholder="5 ký tự" style="text-transform:uppercase"></div>`;
    setTimeout(()=>{
      const canvas=document.getElementById('cap-canvas');if(!canvas)return;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#1a2040';ctx.fillRect(0,0,220,60);
      for(let i=0;i<6;i++){ctx.strokeStyle=`hsl(${randomInt(0,360)},50%,50%)`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(randomInt(0,220),randomInt(0,60));ctx.lineTo(randomInt(0,220),randomInt(0,60));ctx.stroke();}
      for(let i=0;i<30;i++){ctx.fillStyle=`rgba(${randomInt(100,255)},${randomInt(100,255)},${randomInt(100,255)},0.5)`;ctx.fillRect(randomInt(0,220),randomInt(0,60),2,2);}
      const colors=['#4f9eff','#00e5ff','#ffd740','#00e676','#ff9100'];
      for(let i=0;i<code.length;i++){ctx.font=`bold ${randomInt(26,32)}px monospace`;ctx.fillStyle=colors[i%colors.length];ctx.save();ctx.translate(20+i*38,randomInt(38,46));ctx.rotate((randomInt(-15,15)*Math.PI)/180);ctx.fillText(code[i],0,0);ctx.restore();}
    },100);return;
  }
  if(type==='pick_animal'){
    const animals=[['🐶','Chó'],['🐱','Mèo'],['🐭','Chuột'],['🐰','Thỏ'],['🦊','Cáo'],['🐼','Gấu trúc'],['🐯','Hổ'],['🦁','Sư tử'],['🐸','Ếch'],['🐧','Chim cánh cụt']];
    const pick=animals[randomInt(0,animals.length-1)];captchaAnswer=pick[0];qEl.textContent=`🐾 Chọn con vật: ${pick[1]}`;
    const shuffled=[...animals].sort(()=>Math.random()-.5).slice(0,6);if(!shuffled.find(a=>a[0]===pick[0]))shuffled[0]=pick;shuffled.sort(()=>Math.random()-.5);
    box.innerHTML=`<div class="captcha-options">${shuffled.map(a=>`<div class="captcha-opt" onclick="selectOpt(this,'${a[0]}')">${a[0]} ${a[1]}</div>`).join('')}</div><button class="captcha-refresh" style="margin-top:8px;width:100%" onclick="generateCaptcha()">🔄 Đổi câu hỏi</button>`;return;
  }
  if(type==='pick_fruit'){
    const fruits=[['🍎','Táo'],['🍌','Chuối'],['🍇','Nho'],['🍊','Cam'],['🍓','Dâu'],['🍋','Chanh'],['🥝','Kiwi'],['🍑','Đào'],['🍉','Dưa hấu'],['🍍','Dứa']];
    const pick=fruits[randomInt(0,fruits.length-1)];captchaAnswer=pick[0];qEl.textContent=`🍒 Chọn loại quả: ${pick[1]}`;
    const shuffled=[...fruits].sort(()=>Math.random()-.5).slice(0,6);if(!shuffled.find(a=>a[0]===pick[0]))shuffled[0]=pick;shuffled.sort(()=>Math.random()-.5);
    box.innerHTML=`<div class="captcha-options">${shuffled.map(a=>`<div class="captcha-opt" onclick="selectOpt(this,'${a[0]}')">${a[0]} ${a[1]}</div>`).join('')}</div><button class="captcha-refresh" style="margin-top:8px;width:100%" onclick="generateCaptcha()">🔄 Đổi câu hỏi</button>`;return;
  }
  if(type==='pick_color'){
    const colors=[['🔴','Đỏ'],['🔵','Xanh dương'],['🟢','Xanh lá'],['🟡','Vàng'],['🟠','Cam'],['🟣','Tím'],['⚫','Đen'],['⚪','Trắng']];
    const pick=colors[randomInt(0,colors.length-1)];captchaAnswer=pick[0];qEl.textContent=`🎨 Chọn màu: ${pick[1]}`;
    const shuffled=[...colors].sort(()=>Math.random()-.5).slice(0,4);if(!shuffled.find(a=>a[0]===pick[0]))shuffled[0]=pick;shuffled.sort(()=>Math.random()-.5);
    box.innerHTML=`<div class="captcha-options">${shuffled.map(a=>`<div class="captcha-opt" onclick="selectOpt(this,'${a[0]}')">${a[0]} ${a[1]}</div>`).join('')}</div><button class="captcha-refresh" style="margin-top:8px;width:100%" onclick="generateCaptcha()">🔄 Đổi câu hỏi</button>`;return;
  }
  if(type==='odd_one_out'){
    const groups=[
      {q:'Tìm đồ vật KHÔNG phải phương tiện giao thông',correct:'🍎',opts:['🚗','🏍','🍎','✈️','🚢','🚲']},
      {q:'Tìm thứ KHÔNG phải con số',correct:'A',opts:['1','5','A','3','7','9']},
      {q:'Tìm thứ KHÔNG phải đồ ăn',correct:'📱',opts:['🍕','🍔','📱','🍣','🍜','🍦']},
      {q:'Tìm thứ KHÔNG phải màu sắc',correct:'🔔',opts:['🔴','🔵','🟢','🔔','🟡','🟣']},
      {q:'Tìm thứ KHÔNG phải loài hoa',correct:'🐟',opts:['🌹','🌸','🐟','🌻','🌺','🌼']},
    ];
    const g=groups[randomInt(0,groups.length-1)];captchaAnswer=g.correct;qEl.textContent='🔍 '+g.q;
    const opts=[...g.opts].sort(()=>Math.random()-.5);
    box.innerHTML=`<div class="captcha-options">${opts.map(o=>`<div class="captcha-opt" onclick="selectOpt(this,'${o}')">${o}</div>`).join('')}</div><button class="captcha-refresh" style="margin-top:8px;width:100%" onclick="generateCaptcha()">🔄 Đổi câu hỏi</button>`;return;
  }
  if(type==='emoji_count'){
    const emojis=['⭐','❤️','🔥','💎','🎯'];const em=emojis[randomInt(0,emojis.length-1)];const count=randomInt(2,8);
    captchaAnswer=String(count);qEl.textContent=`🔢 Đếm số ${em} trong hình:`;
    const noises=['🌀','💫','✨','🎪','🎭','🎨'];let items=Array(count).fill(em);
    for(let i=0;i<randomInt(3,6);i++)items.push(noises[randomInt(0,noises.length-1)]);
    items.sort(()=>Math.random()-.5);
    box.innerHTML=`<div style="font-size:22px;letter-spacing:4px;text-align:center;padding:10px 0;line-height:1.8">${items.join(' ')}</div><div class="captcha-input-row"><input class="captcha-input" id="cap-input" type="number" placeholder="Nhập số lượng" min="1"><button class="captcha-refresh" onclick="generateCaptcha()">🔄</button></div>`;return;
  }
  if(type==='drag_order'){
    const seqs=[
      {q:'Chọn số tiếp theo: 2, 4, 6, ?',items:['7','8','9','10'],answer:'8'},
      {q:'Chọn số tiếp theo: 1, 3, 5, ?',items:['6','7','8','9'],answer:'7'},
      {q:'Chọn số tiếp theo: 10, 20, 30, ?',items:['35','40','45','50'],answer:'40'},
      {q:'Chọn số tiếp theo: 5, 10, 15, ?',items:['18','20','22','25'],answer:'20'},
      {q:'Chọn số tiếp theo: 3, 6, 9, ?',items:['10','11','12','13'],answer:'12'},
    ];
    const seq=seqs[randomInt(0,seqs.length-1)];captchaAnswer=seq.answer;qEl.textContent='📊 '+seq.q;
    const opts=[...seq.items].sort(()=>Math.random()-.5);
    box.innerHTML=`<div class="captcha-options">${opts.map(o=>`<div class="captcha-opt" onclick="selectOpt(this,'${o}')">${o}</div>`).join('')}</div><button class="captcha-refresh" style="margin-top:8px;width:100%" onclick="generateCaptcha()">🔄 Đổi câu hỏi</button>`;return;
  }
  // fallback
  captchaType='math_add';const a=randomInt(1,20),b=randomInt(1,20);captchaAnswer=String(a+b);
  qEl.textContent=`🔢 Tính: ${a} + ${b} = ?`;
  box.innerHTML=`<div class="captcha-input-row"><input class="captcha-input" id="cap-input" type="number" placeholder="Nhập kết quả"><button class="captcha-refresh" onclick="generateCaptcha()">🔄</button></div>`;
}

let selectedOptValue = null;
function selectOpt(el,val){
  document.querySelectorAll('#captcha-content .captcha-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected'); selectedOptValue=val;
}
function verifyCaptcha(){
  if(!captchaAnswer) return false;
  if(['math_add','math_sub','math_mul','emoji_count'].includes(captchaType)){
    const inp=document.getElementById('cap-input');return inp&&String(inp.value.trim())===captchaAnswer;
  }
  if(captchaType==='canvas_text'){const inp=document.getElementById('cap-input');return inp&&inp.value.trim().toUpperCase()===captchaAnswer;}
  return selectedOptValue===captchaAnswer;
}

// ═══════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════
function switchAuthTab(tab){
  document.getElementById('auth-login-form').style.display=tab==='login'?'flex':'none';
  document.getElementById('auth-register-form').style.display=tab==='register'?'flex':'none';
  if(tab==='register'){const s1=document.getElementById('reg-step1');const s2=document.getElementById('reg-step2');if(s1)s1.style.display='block';if(s2)s2.style.display='none';}
  document.getElementById('tab-login-btn').classList.toggle('active',tab==='login');
  document.getElementById('tab-reg-btn').classList.toggle('active',tab==='register');
  if(tab==='register'){selectedOptValue=null;generateCaptcha();}
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
  }catch(e){err.style.display='block';err.textContent=e.message;playSfx('error');}
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
  el.classList.toggle('checked',rememberMe);el.textContent=rememberMe?'✓':'';
}

function refreshSidebarVisibility(){
  // Admin-only section (Tạo Hot Deal, Tạo thông báo)
  const adminSection=document.getElementById('sb-admin-section');
  if(adminSection) adminSection.style.display=IS_ADMIN?'block':'none';
  // Admin Panel menu item
  const mgmt=document.getElementById('mgmt-menu-item');
  if(mgmt) mgmt.style.display=IS_ADMIN?'flex':'none';
  // Items ẩn với admin
  const depItem=document.getElementById('sb-deposit-item');
  if(depItem) depItem.style.display=IS_ADMIN?'none':'flex';
  const depHistItem=document.getElementById('sb-dep-hist-item');
  if(depHistItem) depHistItem.style.display=IS_ADMIN?'none':'flex';
  const purHistItem=document.getElementById('sb-pur-hist-item');
  if(purHistItem) purHistItem.style.display=IS_ADMIN?'none':'flex';
  const vpsShopItem=document.getElementById('sb-vps-shop-item');
  if(vpsShopItem) vpsShopItem.style.display=IS_ADMIN?'none':'flex';
  const myVpsItem=document.getElementById('sb-my-vps-item');
  if(myVpsItem) myVpsItem.style.display=IS_ADMIN?'none':'flex';
  // top-nap-admin-ctrl: nút Reset bảng xếp hạng, chỉ admin thấy (xử lý riêng qua openTopNapModal)
}

function showApp(){
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app-screen').style.display='none';
  document.getElementById('welcome-screen').style.display='block';
  const badge=document.getElementById('user-badge-el');
  if(badge)badge.innerHTML=(IS_ADMIN?'👑 ':'👤 ')+CURRENT_USER+' <span style="color:#1877f2;font-size:12px" title="Đã xác minh">✔</span>';
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
  if(sbBal){
    sbBal.style.display='block';
    if(IS_ADMIN) sbBal.innerHTML='💰 <span style="color:#ffd740;font-weight:900">∞</span> · 📱 <span style="color:#00e5ff;font-weight:900">∞</span> máy';
  }
  // Welcome greeting
  const titleEl=document.querySelector('#welcome-screen .welcome-title');
  if(titleEl) titleEl.textContent=(IS_ADMIN?'👑 Chào Admin ':'👋 Chào ') + CURRENT_USER + '!';
  startClock();loadHistory();
  if(!IS_ADMIN) refreshBalance();
  // Apply all sidebar visibility rules (tập trung tại refreshSidebarVisibility)
  refreshSidebarVisibility();
  // Load hot deals + notifications
  setTimeout(()=>{
    if(typeof loadHotDeals === 'function') loadHotDeals();
    if(typeof loadNotifications === 'function') loadNotifications();
    // Show main notification popup if content exists
    setTimeout(async ()=>{
      try {
        const rn = await fetch('/api/notifications',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
        const nd = await rn.json();
        if(nd.main && nd.main.text && nd.main.text.trim()) openMainNotifModal();
      } catch(e){}
    }, 800);
  }, 300);
  // Poll unread chat count for admin badge
  if(IS_ADMIN){
    // Poll unread badge mỗi 15s
    setInterval(()=>{ loadAdminInboxThreads && loadAdminInboxThreads(); }, 15000);
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

// ═══════════════════════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════════════════════
let histData=[],histPage=0;const HIST_PER_PAGE=8;
async function loadHistory(){
  try{
    const r=await fetch('/api/history',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(r.ok){histData=await r.json();renderHistBadge();}
  }catch{}
}
function renderHistBadge(){
  const b=document.getElementById('hist-badge');
  if(b&&histData.length){b.style.display='flex';b.textContent=histData.length>99?'99+':histData.length;}
}
function openHistory(){
  histPage=0;renderHistList();openModal('history-modal');
}
function renderHistList(){
  const count=document.getElementById('hist-count');
  const list=document.getElementById('hist-list');
  const pages=document.getElementById('hist-pages');
  if(count)count.textContent=`(${histData.length})`;
  if(!histData.length){if(list)list.innerHTML='<div class="hist-empty">📭 Chưa có lịch sử</div>';return;}
  const start=histPage*HIST_PER_PAGE;
  const chunk=histData.slice(start,start+HIST_PER_PAGE);
  if(list)list.innerHTML=chunk.map((h,i)=>`
    <div class="hist-item" onclick="openHistDetail(${start+i})">
      <div class="hist-head"><span class="hist-name">${h.acc_name||h.name||'(ẩn)'}</span><span class="hist-time">${h.time||''}</span></div>
      <div class="hist-phone">Target: ${h.target_name||'?'} · UID: ${h.acc_uid||h.uid||'?'}</div>
      <div class="hist-actions">
        <div class="hist-btn" onclick="event.stopPropagation();copyHistCookie(${start+i},this)">📋 Copy</div>
        <div class="hist-btn dl" onclick="event.stopPropagation();downloadHist(${start+i})">⬇️ Tải</div>
      </div>
    </div>`).join('');
  const totalPages=Math.ceil(histData.length/HIST_PER_PAGE);
  if(pages)pages.innerHTML=Array.from({length:totalPages},(_,i)=>`<button class="page-btn${i===histPage?' active':''}" onclick="histPage=${i};renderHistList()">${i+1}</button>`).join('');
}
function openHistDetail(idx){
  viewingHistItem=histData[idx];
  const c=document.getElementById('hist-detail-content');
  if(c)c.innerHTML=`<div class="info-row"><div class="info-label">Cookie</div><div class="info-value" style="white-space:pre-wrap">${viewingHistItem.cookie||'(trống)'}</div></div>`;
  openModal('hist-detail-modal');
}
function copyHistDetailCookie(btn){
  if(!viewingHistItem)return;
  navigator.clipboard.writeText(viewingHistItem.cookie||'').then(()=>{btn.textContent='✅ Đã copy!';setTimeout(()=>btn.textContent='📋 Copy Cookie',2000);});
}
function downloadHistDetail(){
  if(!viewingHistItem)return;
  const a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(viewingHistItem.cookie||'');
  a.download=`cookie_${viewingHistItem.name||'fb'}_${Date.now()}.txt`;a.click();
}
function copyHistCookie(idx,btn){
  navigator.clipboard.writeText(histData[idx].cookie||'').then(()=>{btn.textContent='✅';setTimeout(()=>btn.textContent='📋 Copy',2000);});
}
function downloadHist(idx){
  const h=histData[idx];const a=document.createElement('a');
  a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(h.cookie||'');
  a.download=`cookie_${h.name||'fb'}_${Date.now()}.txt`;a.click();
}

// ═══════════════════════════════════════════════════════
//  BALANCE DISPLAY
// ═══════════════════════════════════════════════════════
let CURRENT_BALANCE = 0;
function fmtMoney(n){
  return Number(n||0).toLocaleString('vi-VN') + ' VND';
}
function updateBalanceDisplay(bal){
  if(IS_ADMIN){ // admin always shows ∞
    const sb=document.getElementById('sb-balance-el');
    if(sb) sb.innerHTML='💰 <span style="color:#ffd740;font-weight:900">∞</span> · 📱 <span style="color:#00e5ff;font-weight:900">∞</span> máy';
    return;
  }
  CURRENT_BALANCE = bal||0;
  const sb = document.getElementById('sb-balance-el');
  if(sb) sb.textContent = '💰 '+fmtMoney(CURRENT_BALANCE);
}
async function refreshBalance(){
  try{
    const r = await fetch('/api/me',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(r.ok){ const d=await r.json(); updateBalanceDisplay(d.balance||0); }
  }catch{}
}

// ═══════════════════════════════════════════════════════
//  ADMIN MANAGEMENT
// ═══════════════════════════════════════════════════════
let mgmtData=[],mgmtPage=0;const MGMT_PER_PAGE=10;
let _mgmtTab = 'users';

async function openMgmt(){
  openModal('mgmt-modal');
  switchMgmtTab('users');
}

function switchMgmtTab(tab){
  _mgmtTab = tab;
  ['users','balance','deposits','chat'].forEach(t=>{
    const tabEl=document.getElementById('mtab-'+t);
    const panEl=document.getElementById('mgmt-panel-'+t);
    if(tabEl) tabEl.classList.toggle('active',t===tab);
    if(panEl) panEl.style.display = t===tab?'block':'none';
  });
  if(tab==='users') loadMgmtUsers();
  if(tab==='deposits') loadAdminDeposits();
  if(tab==='chat'){
    // Redirect sang full-screen inbox page
    closeModal('mgmt-modal');
    openAdminInboxPage();
    return;
  }
}

async function loadMgmtUsers(){
  try{
    const r=await fetch('/api/admin/users',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(r.ok) mgmtData=await r.json();
  }catch{}
  mgmtPage=0; renderMgmtList();
}

function renderMgmtList(){
  const count=document.getElementById('mgmt-count');
  const list=document.getElementById('mgmt-list');
  const pages=document.getElementById('mgmt-pages');
  if(count) count.textContent='('+mgmtData.length+' tài khoản)';
  const start=mgmtPage*MGMT_PER_PAGE;
  const chunk=mgmtData.slice(start,start+MGMT_PER_PAGE);
  if(list){
    var rows=chunk.map(function(u,i){
      var now=new Date();
      var slotCount=(u.slots||[]).filter(function(s){
        if(!s.expires_at) return true;
        try{
          var p=s.expires_at.split(' ');var dp=p[0].split('/');var tp=(p[1]||'0:0:0').split(':');
          return new Date(+dp[2],+dp[1]-1,+dp[0],+tp[0],+tp[1],+tp[2])>now;
        }catch(e){return true;}
      }).length;
      var ac=u.active!==false;
      return '<tr>'
        +'<td>'+(start+i+1)+'</td>'
        +'<td><b>'+u.username+'</b></td>'
        +'<td style="color:var(--muted);font-size:11px">'+(u.email||'—')+'</td>'
        +'<td style="color:var(--green);font-weight:700">'+fmtMoney(u.balance||0)+'</td>'
        +'<td style="color:var(--cyan);font-weight:700">'+slotCount+'</td>'
        +'<td><span class="u-active '+(ac?'yes':'no')+'">'+(ac?'OK':'🔒')+'</span></td>'
        +'<td>'
          +'<button class="u-action mgmt-toggle-btn">'+(ac?'🔒':'🔓')+'</button>'
          +'<button class="u-action del mgmt-del-btn">🗑</button>'
        +'</td>'
        +'</tr>';
    }).join('');
    list.innerHTML='<table class="user-table"><thead><tr><th>#</th><th>Username</th><th>Email</th><th>Số dư</th><th>Slot</th><th>TT</th><th>Act</th></tr></thead><tbody>'+rows+'</tbody></table>';
    list.querySelectorAll('tr').forEach(function(tr,i){
      if(i===0||!chunk[i-1]) return;
      var u=chunk[i-1];
      var toggleBtn=tr.querySelector('.mgmt-toggle-btn');
      var delBtn=tr.querySelector('.mgmt-del-btn');
      if(toggleBtn) toggleBtn.onclick=function(){ doToggleUser(u.username, u.active!==false); };
      if(delBtn) delBtn.onclick=function(){ doDeleteUser(u.username); };
    });
  }
  const totalPages=Math.ceil(mgmtData.length/MGMT_PER_PAGE);
  if(pages) pages.innerHTML=Array.from({length:totalPages},function(_,i){
    return '<button class="page-btn'+(i===mgmtPage?' active':'')+'" onclick="mgmtPage='+i+';renderMgmtList()">'+(i+1)+'</button>';
  }).join('');
}
function doToggleUser(username, currentActive){
  fetch('/api/admin/toggle-user',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},body:JSON.stringify({username:username,active:!currentActive})}).then(function(){loadMgmtUsers();});
}
function doDeleteUser(username){
  if(!confirm('Xóa tài khoản "'+username+'"?')) return;
  fetch('/api/admin/delete-user',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},body:JSON.stringify({username:username})}).then(function(){loadMgmtUsers();});
}
async function toggleUserActive(username,currentActive){
  await fetch('/api/admin/toggle-user',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},body:JSON.stringify({username,active:!currentActive})});
  loadMgmtUsers();
}
async function deleteUser(username){
  if(!confirm('Xóa tài khoản "'+username+'"?')) return;
  await fetch('/api/admin/delete-user',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},body:JSON.stringify({username})});
  loadMgmtUsers();
}

function openCreateUserModal(){
  ['cu-user','cu-pass','cu-email'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('cu-err').textContent='';
  openModal('create-user-modal');
}
async function doCreateUser(){
  const u=document.getElementById('cu-user').value.trim();
  const p=document.getElementById('cu-pass').value.trim();
  const e=document.getElementById('cu-email').value.trim();
  const err=document.getElementById('cu-err');
  if(!u||!p||!e){err.textContent='Điền đầy đủ thông tin';return;}
  try{
    const r=await fetch('/api/admin/create-user',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},body:JSON.stringify({username:u,password:p,email:e})});
    const d=await r.json();
    if(!r.ok) throw new Error(d.detail||'Lỗi tạo tài khoản');
    showToast('✅ Tạo tài khoản thành công! Đã cấp 1 máy ảo miễn phí.','#00e676');
    closeModal('create-user-modal'); loadMgmtUsers();
  }catch(ex){err.textContent=ex.message;}
}

async function adminAddBalance(){
  const u=document.getElementById('bal-add-user').value.trim();
  const a=parseInt(document.getElementById('bal-add-amt').value)||0;
  const msg=document.getElementById('bal-add-msg');
  if(!u||!a){msg.style.color='var(--red)';msg.textContent='Điền đầy đủ thông tin';return;}
  try{
    const r=await fetch('/api/admin/add-balance',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},body:JSON.stringify({username:u,amount:a})});
    const d=await r.json();
    if(!r.ok) throw new Error(d.detail||'Lỗi');
    msg.style.color='var(--green)';msg.textContent='✅ Cộng thành công! Số dư mới: '+fmtMoney(d.new_balance);
    document.getElementById('bal-add-amt').value='';
    loadMgmtUsers();
  }catch(ex){msg.style.color='var(--red)';msg.textContent='❌ '+ex.message;}
}
async function adminSubBalance(){
  const u=document.getElementById('bal-sub-user').value.trim();
  const a=parseInt(document.getElementById('bal-sub-amt').value)||0;
  const msg=document.getElementById('bal-sub-msg');
  if(!u||!a){msg.style.color='var(--red)';msg.textContent='Điền đầy đủ thông tin';return;}
  try{
    const r=await fetch('/api/admin/sub-balance',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},body:JSON.stringify({username:u,amount:a})});
    const d=await r.json();
    if(!r.ok) throw new Error(d.detail||'Lỗi');
    msg.style.color='var(--green)';msg.textContent='✅ Trừ thành công! Số dư mới: '+fmtMoney(d.new_balance);
    document.getElementById('bal-sub-amt').value='';
    loadMgmtUsers();
  }catch(ex){msg.style.color='var(--red)';msg.textContent='❌ '+ex.message;}
}

async function loadAdminDeposits(){
  const list=document.getElementById('admin-deposit-list');
  if(!list) return;
  list.innerHTML='<div style="color:var(--muted);font-size:13px">Đang tải...</div>';
  try{
    const r=await fetch('/api/admin/deposits',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const deps=await r.json();
    if(!deps.length){list.innerHTML='<div style="color:var(--muted);text-align:center;padding:20px">Chưa có đơn nào</div>';return;}
    list.innerHTML='';
    deps.slice(0,50).forEach(function(dep){
      var statusLabel=dep.status==='pending'?'⏳ Chờ duyệt':dep.status==='approved'?'✅ Đã duyệt':'❌ Từ chối';
      var row=document.createElement('div');
      row.className='dep-admin-row';
      row.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
        +'<div><b>'+dep.username+'</b> <span class="dep-status-badge '+dep.status+'">'+statusLabel+'</span></div>'
        +'<div style="color:var(--green);font-weight:800">'+fmtMoney(dep.amount)+'</div></div>'
        +'<div style="color:var(--muted);margin-bottom:6px">📝 <span style="font-family:monospace">'+(dep.content||'')+'</span></div>'
        +'<div style="display:flex;justify-content:space-between;align-items:center">'
          +'<div style="color:var(--muted)">'+(dep.created||'')+'</div>'
          +(dep.status==='pending'
            ?'<div style="display:flex;gap:6px">'
              +'<button class="dep-approve-btn" style="padding:4px 10px;border-radius:6px;background:rgba(0,230,118,.2);border:1px solid rgba(0,230,118,.4);color:var(--green);font-size:11px;font-weight:700;cursor:pointer">✅ Duyệt</button>'
              +'<button class="dep-reject-btn" style="padding:4px 10px;border-radius:6px;background:rgba(255,82,82,.15);border:1px solid rgba(255,82,82,.3);color:var(--red);font-size:11px;font-weight:700;cursor:pointer">❌ Từ chối</button>'
              +'</div>'
            :'')
        +'</div>';
      if(dep.status==='pending'){
        var orderId=dep.order_id;
        row.querySelector('.dep-approve-btn').onclick=function(){adminApproveDeposit(orderId);};
        row.querySelector('.dep-reject-btn').onclick=function(){adminRejectDeposit(orderId);};
      }
      list.appendChild(row);
    });
  }catch(e){list.innerHTML='<div style="color:var(--red)">Lỗi tải dữ liệu</div>';}
}
async function adminApproveDeposit(order_id){
  if(!confirm('Duyệt đơn này?')) return;
  await fetch('/api/admin/approve-deposit',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},body:JSON.stringify({order_id})});
  showToast('✅ Đã duyệt và cộng tiền','#00e676');
  loadAdminDeposits();
}
async function adminRejectDeposit(order_id){
  if(!confirm('Từ chối đơn này?')) return;
  await fetch('/api/admin/reject-deposit',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},body:JSON.stringify({order_id})});
  showToast('❌ Đã từ chối đơn','#ff5252');
  loadAdminDeposits();
}

// ═══════════════════════════════════════════════════════
//  DEPOSIT (NẠP TIỀN)
// ═══════════════════════════════════════════════════════
let _depSelectedAmt = 0;
function openDepositModal(){
  _depSelectedAmt=0;
  document.querySelectorAll('.dep-amt-btn').forEach(function(b){b.classList.remove('selected');});
  document.getElementById('dep-custom-amt').value='';
  document.getElementById('dep-selected-display').textContent='—';
  document.getElementById('dep-err1').textContent='';
  document.getElementById('dep-step1').style.display='block';
  document.getElementById('dep-step2').style.display='none';
  openModal('deposit-modal');
}
function selectDepAmt(btn,amt){
  document.querySelectorAll('.dep-amt-btn').forEach(function(b){b.classList.remove('selected');});
  btn.classList.add('selected');
  _depSelectedAmt=amt;
  document.getElementById('dep-custom-amt').value='';
  document.getElementById('dep-selected-display').textContent=fmtMoney(amt);
  document.getElementById('dep-err1').textContent='';
}
function onDepCustomInput(val){
  document.querySelectorAll('.dep-amt-btn').forEach(function(b){b.classList.remove('selected');});
  const n=parseInt(val)||0;
  _depSelectedAmt=n;
  document.getElementById('dep-selected-display').textContent=n>0?fmtMoney(n):'—';
}
async function doCreateDeposit(){
  const err=document.getElementById('dep-err1');
  if(!_depSelectedAmt||_depSelectedAmt<20000){err.textContent='Chọn hoặc nhập số tiền tối thiểu 20.000đ';return;}
  try{
    const r=await fetch('/api/deposit/create',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},body:JSON.stringify({amount:_depSelectedAmt})});
    const d=await r.json();
    if(!r.ok) throw new Error(d.detail||'Lỗi tạo đơn');
    document.getElementById('dep-qr-img').src=d.qr_url;
    document.getElementById('dep-bank-name').textContent=d.bank_name;
    document.getElementById('dep-bank-num').textContent=d.bank_number;
    document.getElementById('dep-bank-owner').textContent=d.account_name;
    document.getElementById('dep-bank-amount').textContent=fmtMoney(d.amount);
    document.getElementById('dep-bank-content').textContent=d.content;
    document.getElementById('dep-step1').style.display='none';
    document.getElementById('dep-step2').style.display='block';
  }catch(ex){err.textContent='❌ '+ex.message;}
}
function copyDepContent(){
  const c=document.getElementById('dep-bank-content').textContent;
  navigator.clipboard.writeText(c).then(function(){showToast('✅ Đã copy nội dung CK','#00e676');}).catch(function(){});
}
function resetDepModal(){
  document.getElementById('dep-step1').style.display='block';
  document.getElementById('dep-step2').style.display='none';
  _depSelectedAmt=0;
  document.getElementById('dep-selected-display').textContent='—';
  document.querySelectorAll('.dep-amt-btn').forEach(function(b){b.classList.remove('selected');});
}

// ═══════════════════════════════════════════════════════
//  VPS SHOP
// ═══════════════════════════════════════════════════════
let _vpsPlans=[], _vpsPendingPlan=null;
async function openVpsShop(){
  const balEl=document.getElementById('vps-shop-balance');
  if(balEl) balEl.textContent=fmtMoney(CURRENT_BALANCE);
  // Load slot count
  try{
    const sr=await fetch('/api/slots/count',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(sr.ok){const sd=await sr.json();const slEl=document.getElementById('vps-shop-slots');if(slEl)slEl.textContent=sd.total_slots+' máy ảo';}
  }catch{}
  if(!_vpsPlans.length){
    try{const r=await fetch('/api/vps-plans');if(r.ok)_vpsPlans=await r.json();}catch{}
  }
  openModal('vps-shop-modal');
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
    // Format created date shorter
    const cr=d.created||'—';
    const crEl=document.getElementById('ai-created');if(crEl)crEl.textContent=cr;
    document.getElementById('ai-balance').textContent=fmtMoney(d.balance||0);
    updateBalanceDisplay(d.balance||0);
  }catch{}
  // Load slot count
  try{
    const sr=await fetch('/api/slots/count',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(sr.ok){
      const sd=await sr.json();
      const slotsTxt=sd.total_slots+' máy ảo';
      const el=document.getElementById('ai-slots');if(el)el.textContent=slotsTxt;
      const badge=document.getElementById('ai-slot-badge');if(badge)badge.textContent='📱 '+slotsTxt;
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

// ═══════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function toggleMenu(){
  const sb=document.getElementById('main-sidebar');
  const ov=document.getElementById('sidebar-overlay');
  if(sb.classList.contains('open')){closeMenu();}
  else{
    sb.classList.add('open');ov.classList.add('open');
    // Refresh toàn bộ visibility mỗi lần mở sidebar
    refreshSidebarVisibility();
  }
}
function closeMenu(){
  document.getElementById('main-sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ── Admin clock realtime ──
function startAdminClock(){
  function tick(){
    const el=document.getElementById('admin-clock');
    if(!el) return;
    const now=new Date();
    const d=now.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});
    const t=now.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    el.textContent=`📅 ${d}  ⏰ ${t}`;
  }
  tick();
  setInterval(tick, 1000);
}
startAdminClock();

// ── Intro modal ──
function openIntroModal(){ openModal('intro-modal'); }

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

// ── Server List modal ──
async function openServerListModal(){
  openModal('server-list-modal');
  await loadServerList();
}

async function loadServerList(){
  const body = document.getElementById('server-list-body');
  body.innerHTML='<div style="text-align:center;color:var(--muted);padding:30px;font-size:13px">⏳ Đang tải...</div>';
  try{
    const r = await fetch('/api/servers',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const list = await r.json();
    if(!list.length){
      body.innerHTML=`<div style="text-align:center;padding:40px 20px">
        <div style="font-size:48px;margin-bottom:12px">📭</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">Chưa có máy chủ nào</div>
        <div style="font-size:12px;color:var(--muted)">Nhấn <b>+ Tạo mới</b> để thêm máy chủ đầu tiên.</div>
      </div>`;
      return;
    }
    // Lưu lại _svLogIdx trước khi rebuild để không mất offset
    const savedIdx = window._svLogIdx ? Object.assign({}, window._svLogIdx) : {};
    body.innerHTML = '<div class="sv-rail">' + list.map(sv => buildServerCard2(sv)).join('') + '</div>';
    list.forEach(sv => renderSv2Expire(sv.id, sv.expires_at||null));
    // Restore idx - không reset về 0 nếu đã có data
    if(!window._svLogIdx) window._svLogIdx = {};
    Object.assign(window._svLogIdx, savedIdx);
    list.forEach(sv => fetchCardScreenshot2(sv.id));
  }catch(e){
    body.innerHTML='<div style="color:var(--red);padding:16px;text-align:center">❌ Lỗi tải danh sách</div>';
  }
}

function buildServerCard(sv){ return buildServerCard2(sv); }

function renderSv2Expire(svId, expiresAt){
  const el = document.getElementById('sv2-expire-' + svId);
  if(!el) return;
  if(!expiresAt){ el.innerHTML = '<span class="sv2-expire-tag" style="background:rgba(0,230,118,.12);color:var(--green);border:1px solid rgba(0,230,118,.2)">⏰ Không giới hạn</span>'; return; }
  // Parse expires_at "DD/MM/YYYY HH:MM:SS"
  try {
    const parts = expiresAt.split(' ');
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    const expDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1])-1, parseInt(dateParts[0]),
      parseInt(timeParts[0]), parseInt(timeParts[1]), parseInt(timeParts[2]));
    function updateExpire(){
      const now = Date.now();
      const diff = expDate.getTime() - now;
      if(!document.getElementById('sv2-expire-' + svId)) return;
      if(diff <= 0){
        el.innerHTML = '<span class="sv2-expire-tag" style="background:rgba(255,82,82,.15);color:var(--red);border:1px solid rgba(255,82,82,.3)">❌ Đã hết hạn</span>';
        return;
      }
      const d = Math.floor(diff/86400000);
      const h = Math.floor((diff%86400000)/3600000);
      const m = Math.floor((diff%3600000)/60000);
      const s = Math.floor((diff%60000)/1000);
      let color = 'var(--green)'; let bg = 'rgba(0,230,118,.12)'; let border = 'rgba(0,230,118,.2)';
      if(diff < 86400000){ color='var(--red)'; bg='rgba(255,82,82,.12)'; border='rgba(255,82,82,.3)'; }
      else if(diff < 3*86400000){ color='var(--yellow)'; bg='rgba(255,193,7,.12)'; border='rgba(255,193,7,.3)'; }
      const label = d>0 ? d+'n '+h+'g '+m+'p' : h>0 ? h+'g '+m+'p '+s+'s' : m+'p '+s+'s';
      el.innerHTML = '<span class="sv2-expire-tag" style="background:'+bg+';color:'+color+';border:1px solid '+border+'">⏱ Còn lại: '+label+'</span>';
      setTimeout(updateExpire, 1000);
    }
    updateExpire();
  } catch(e) { el.innerHTML = ''; }
}

function buildServerCard2(sv){
  const sLabel = {ready:'Sẵn sàng',running:'Đang chạy',stopped:'Đã dừng',paused:'Tạm dừng'};
  const st = sv.status||'ready';
  const dotColor = st==='running'?'var(--green)':st==='paused'?'#ffc800':'#555';
  const rawDate = sv.created_at || sv.created || sv.created_time || sv.createdAt || null;
  const created = rawDate ? (String(rawDate).includes('T') ? String(rawDate).replace('T',' ').substring(0,16) : String(rawDate).substring(0,16)) : 'Chưa rõ';
  return `
  <div class="sv2-card ${st}" id="svcard2-${sv.id}" onclick="event.stopPropagation();openDetailModal('${sv.id}')" style="cursor:pointer">
    <!-- Tên tab nổi bật + Countdown hạn -->
    <div style="padding:8px 9px 4px;display:flex;flex-direction:column;gap:2px">
      <div style="display:flex;align-items:center;gap:5px">
        <div style="width:6px;height:6px;border-radius:50%;background:${dotColor};flex-shrink:0;${st==='running'?'box-shadow:0 0 5px var(--green)':''}"></div>
        <div style="font-size:12px;font-weight:900;color:#fff;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.2px">${sv.name||'Máy ảo'}</div>
        <span id="sv2-badge-${sv.id}" style="padding:2px 6px;border-radius:20px;font-size:7px;font-weight:700;${st==='running'?'background:rgba(0,230,118,.15);color:var(--green);border:1px solid rgba(0,230,118,.3)':st==='paused'?'background:rgba(255,200,0,.15);color:#ffc800;border:1px solid rgba(255,200,0,.3)':'background:rgba(255,255,255,.07);color:var(--muted);border:1px solid rgba(255,255,255,.1)'}">${sLabel[st]||st}</span>
      </div>
      <div id="sv2-expire-${sv.id}" style="padding-left:11px"></div>
    </div>
    <!-- Screenshot -->
    <div id="sv2-ph-${sv.id}" class="sv2-screenshot-ph"><div style="font-size:16px;opacity:.2">🖥</div></div>
    <img id="sv2-img-${sv.id}" class="sv2-screenshot" style="display:none" alt="ss"/>
    <!-- Thông tin -->
    <div style="padding:4px 9px 4px;display:flex;flex-direction:column">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05)">
        <span style="font-size:7px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Acc</span>
        <span class="sv2-meta-val" style="font-size:9px;font-weight:700;color:#c9d8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%">${sv.acc_name||'?'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05)">
        <span style="font-size:7px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Nạn nhân</span>
        <span class="sv2-meta-val" style="font-size:9px;font-weight:700;color:#c9d8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%">${sv.target_name||'?'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05)">
        <span style="font-size:7px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Tạo lúc</span>
        <span class="sv2-meta-val" style="font-size:9px;font-weight:600;color:#c9d8f0">${created}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0">
        <span style="font-size:7px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Uptime</span>
        <span style="font-size:9px;font-weight:700;color:var(--cyan);font-family:monospace" id="sv2-uptime-${sv.id}">--:--:--</span>
      </div>
    </div>
    <!-- Nút Xem ngay -->
    <div style="padding:0 8px 8px" onclick="event.stopPropagation();openDetailModal('${sv.id}')">
      <div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:7px;border-radius:9px;background:rgba(79,158,255,.08);border:1px solid rgba(79,158,255,.2);font-size:11px;font-weight:700;color:var(--blue)">
        Xem ngay
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>
  </div>`;
}

async function fetchCardScreenshot2(svId){
  try{
    if(!window._svLogIdx) window._svLogIdx = {};
    const since = window._svLogIdx[svId] || 0;
    const sr = await fetch('/api/dame/status?server_id='+svId+'&since='+since,{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(!sr.ok) return;
    const sd = await sr.json();
    const sLabel = {ready:'Sẵn sàng',running:'Đang chạy',stopped:'Đã dừng',paused:'Tạm dừng'};
    const st     = sd.running?'running':sd.paused?'paused':'stopped';
    const stEl   = document.getElementById('sv2-badge-'+svId);
    const dotEl  = document.getElementById('sv2-dot-'+svId);
    const totEl  = document.getElementById('sv2-total-'+svId);
    const loopsEl= document.getElementById('sv2-loops-'+svId);
    const logEl  = document.getElementById('sv2-log-'+svId);
    if(stEl){ stEl.textContent=sLabel[st]||st; stEl.className='sv2-status-badge '+st; }
    if(dotEl) dotEl.className='sv2-status-dot '+st;
    if(totEl) totEl.textContent=sd.total||0;
    if(loopsEl) loopsEl.textContent=sd.loops||0;
    // Uptime
    const uptimeEl = document.getElementById('sv2-uptime-'+svId);
    const progEl   = document.getElementById('sv2-prog-'+svId);
    if(uptimeEl){
      if((sd.running||sd.paused) && sd.start_time){
        if(!window._svStart) window._svStart={};
        window._svStart[svId] = sd.start_time*1000;
        const secs = Math.floor((Date.now() - window._svStart[svId])/1000);
        const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;
        uptimeEl.textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        if(progEl){ const pct=Math.min((secs%60)/60*100,100); progEl.style.width=pct+'%'; }
      } else {
        uptimeEl.textContent='--:--:--';
        if(progEl) progEl.style.width='0%';
      }
    }
    if(logEl){
      if(sd.logs && sd.logs.length){
        if(since===0) logEl.innerHTML='';
        sd.logs.forEach(line => {
          const div = document.createElement('div');
          div.style.cssText='border-left:2px solid rgba(79,158,255,.4);padding-left:6px;margin-bottom:3px;line-height:1.55';
          div.textContent = line;
          logEl.appendChild(div);
        });
        logEl.scrollTop = logEl.scrollHeight;
        window._svLogIdx[svId] = sd.log_count || (since + sd.logs.length);
      } else if(since===0){
        // Đầu tiên fetch nhưng không có log → hiện trạng thái
        const stTxt={running:'🟢 Đang khởi động — chờ log...',paused:'⏸ Tạm dừng',stopped:'⏹ Chưa chạy'};
        logEl.innerHTML='<div style="color:var(--muted)">'+( stTxt[st]||'✅ Sẵn sàng')+'</div>';
      }
    }
    // Sync detail modal nếu đang mở cho server này
    if(window._detailOpenId === svId) _syncDetailModal(svId, sd);
    if(sd.running||sd.screenshot_b64){
      const r=await fetch('/api/dame/screenshot?server_id='+svId,{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
      if(!r.ok) return;
      const d=await r.json();
      if(d.screenshot_b64){
        const img=document.getElementById('sv2-img-'+svId);
        const ph=document.getElementById('sv2-ph-'+svId);
        if(img){img.src='data:image/jpeg;base64,'+d.screenshot_b64;img.style.display='block';}
        if(ph) ph.style.display='none';
      }
    }
  }catch(e){}
}

async function serverAction(action, svId, cookie, targetUrl, speed, accName, accUid, targetName){
  const tok = SESSION_TOKEN;
  if(action==='start'){
    await fetch('/api/dame/start',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({cookie,target_url:targetUrl,speed,acc_name:accName,acc_uid:accUid,target_name:targetName,server_id:svId})});
    showToast('▶ Đã khởi động máy chủ '+svId,'var(--green)');
  } else if(action==='pause'){
    await fetch('/api/dame/pause',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({server_id:svId})});
  } else if(action==='resume'){
    await fetch('/api/dame/resume',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({server_id:svId})});
  } else if(action==='stop'){
    if(!confirm('Dừng máy chủ này?')) return;
    await fetch('/api/dame/stop',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({server_id:svId})});
    showToast('⏹ Đã dừng máy chủ','var(--red)');
  }
  await loadServerList();
  await loadServerRail();
}

async function openServerScreenshot(svId){
  // Mở modal screenshot của server cụ thể
  openModal('screenshot-modal');
  const img = document.getElementById('ss-img');
  const ph  = document.getElementById('ss-placeholder');
  const r = await fetch('/api/dame/screenshot?server_id='+svId,{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
  const d = await r.json();
  if(d.screenshot_b64 && img){
    img.src='data:image/jpeg;base64,'+d.screenshot_b64;
    img.style.display='block';
    if(ph) ph.style.display='none';
  }
}

async function fetchCardScreenshot(svId){
  try {
    // Lấy status live
    const sr = await fetch('/api/dame/status?server_id='+svId,{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(!sr.ok) return;
    const sd = await sr.json();

    // Update live info bar
    const sLabel = {ready:'Sẵn sàng',running:'Đang chạy',stopped:'Đã dừng',paused:'Tạm dừng'};
    const stEl   = document.getElementById('svcard-status-'+svId);
    const totEl  = document.getElementById('svcard-total-'+svId);
    const logEl  = document.getElementById('svcard-log-'+svId);
    if(stEl) stEl.textContent = sd.running ? 'Đang chạy' : (sd.paused ? 'Tạm dừng' : 'Đã dừng');
    if(totEl) totEl.textContent = (sd.total||0) + ' báo cáo';
    if(logEl && sd.log) logEl.textContent = sd.log;

    // Lấy screenshot nếu đang chạy
    if(sd.running || sd.screenshot_b64){
      const r = await fetch('/api/dame/screenshot?server_id='+svId,{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
      if(!r.ok) return;
      const d = await r.json();
      if(d.screenshot_b64){
        const img = document.getElementById('svcard-img-'+svId);
        const ph  = document.getElementById('svcard-ph-'+svId);
        if(img){ img.src='data:image/jpeg;base64,'+d.screenshot_b64; img.style.display='block'; }
        if(ph)  ph.style.display='none';
      }
    }
  } catch(e){}
}


async function refreshInlineScreenshot(){
  const wrap = document.getElementById('sv-inline-wrap');
  try{
    const r = await fetch('/api/dame/status',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const d = await r.json();
    const isRunning = d.is_running;
    if(wrap) wrap.style.display = isRunning ? 'block' : 'none';
    if(!isRunning) return;

    // Update inline screenshot
    const sr = await fetch('/api/dame/screenshot',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(!sr.ok) return;
    const sd = await sr.json();
    const img = document.getElementById('sv-inline-img');
    const ph  = document.getElementById('sv-inline-ph');
    const dot = document.getElementById('sv-inline-dot');
    const lbl = document.getElementById('sv-inline-label');
    const url = document.getElementById('sv-inline-urlbar');
    if(sd.screenshot_b64){
      if(img){ img.src='data:image/jpeg;base64,'+sd.screenshot_b64; img.style.display='block'; }
      if(ph) ph.style.display='none';
    }
    if(dot){ dot.style.background='var(--green)'; dot.style.animation='pulse-dot 1.2s infinite'; }
    if(lbl) lbl.textContent='🔴 LIVE';
    if(url && d.current_url) url.textContent=d.current_url;
  }catch(e){
    if(wrap) wrap.style.display='none';
  }
}
async function loadServerRail(){
  const rail = document.getElementById('sv-status-rail');
  if(!rail) return;
  try{
    const r = await fetch('/api/servers',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const list = await r.json();
    if(!list.length){
      rail.innerHTML='<div class="sv-empty" style="font-size:12px">📭 Chưa có máy chủ nào.<br><small>Nhấn <b>+ Tạo mới</b> ở menu.</small></div>';
      return;
    }
    // Chỉ rebuild HTML nếu số lượng server thay đổi (tránh flicker)
    const existingCards = rail.querySelectorAll('.sv2-card').length;
    if(existingCards !== list.length){
      rail.innerHTML = list.map(sv => buildServerCard2(sv)).join('');
      list.forEach(sv => renderSv2Expire(sv.id, sv.expires_at||null));
    }
    // Luôn update live data
    list.forEach(sv => fetchCardScreenshot2(sv.id));
  }catch(e){}
}


async function startServerDame(id, cookie, targetUrl, speed, accName, accUid, targetName){
  closeModal('server-list-modal');
  // Điền vào form chính và khởi động dame
  _cookieStr   = cookie;
  _accName     = accName;
  _accUid      = accUid;
  _targetUrl   = targetUrl;
  _targetName  = targetName;
  showToast('🚀 Đang khởi động máy chủ...','var(--blue)');
  // Update status
  await fetch(`/api/servers/${id}/status`,{
    method:'PATCH',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
    body: JSON.stringify({status:'running'})
  }).catch(()=>{});
  // Start dame
  try{
    const r = await fetch('/api/dame/start',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
      body: JSON.stringify({cookie, target_url: targetUrl, speed, acc_name: accName, acc_uid: accUid, target_name: targetName})
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.detail||'Lỗi khởi động');
    dameRunning=true; damePaused=false; dameStop=false;
    dameTotal=0; dameLoops=0; dameStartTime=Date.now();
    document.getElementById('run-acc-name').textContent    = accName;
    document.getElementById('run-victim-name').textContent = '👤 '+targetName;
    document.getElementById('run-target-url').textContent  = '🔗 '+targetUrl;
    document.getElementById('run-dot').className='dot active';
    document.getElementById('run-status-text').textContent='🐬 Đang dame '+targetName+'...';
    document.getElementById('run-acc-info').style.display='block';
    switchMainTab('run');
    addLog('🚀 Máy chủ khởi động: '+targetName);
    addLog('👤 Cookie: '+accName+' | UID: '+(accUid||'?'));
    startDameStatusPolling();
  }catch(e){
    showToast('❌ '+e.message,'var(--red)');
    await fetch(`/api/servers/${id}/status`,{
      method:'PATCH',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
      body: JSON.stringify({status:'ready'})
    }).catch(()=>{});
  }
}

function startDameStatusPolling(){
  if(dameTimer) clearInterval(dameTimer);
  dameTimer = setInterval(async()=>{
    if(dameStop){ clearInterval(dameTimer); return; }
    try{
      const rs = await fetch('/api/dame/status',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
      const ds = await rs.json();
      if(ds.logs && ds.logs.length) ds.logs.forEach(l=>addLog(l));
      dameTotal = ds.total || dameTotal;
      dameLoops = ds.loops || dameLoops;
      const prog=document.getElementById('run-progress');
      if(prog) prog.style.width=((dameTotal%13)/13*100)+'%';
      updateRunUI();
      if(ds.died){
        dameRunning=false; clearInterval(dameTimer);
        document.getElementById('run-dot').className='dot';
        document.getElementById('run-dot').style.background='#ff4444';
        document.getElementById('run-status-text').textContent='💀 ACC ĐÃ DIE!';
        document.getElementById('run-status-text').style.color='#ff4444';
        const dieBadge=document.getElementById('die-badge');
        if(dieBadge) dieBadge.style.display='block';
        if(ds.die_screenshot){
          const dieImg=document.getElementById('die-screenshot');
          if(dieImg){dieImg.src='data:image/jpeg;base64,'+ds.die_screenshot;dieImg.style.display='block';}
        }
        addLog('💀 ACC DIE · Dừng dame');
        showToast('💀 ACC DIE!','#ff4444');
        playSfx('error');
      } else if(ds.stopped){
        dameRunning=false; clearInterval(dameTimer);
        document.getElementById('run-dot').className='dot ok';
        document.getElementById('run-status-text').textContent='✅ Hoàn thành · '+dameTotal+' báo cáo đã gửi';
        addLog('✅ Done · tổng '+dameTotal+' báo cáo');
        showToast('✅ Dame xong! Tổng: '+dameTotal+' báo cáo','#00e676');
      }
    } catch{}
  }, 2000);
}

async function deleteServer(id){
  if(!confirm('Xóa máy chủ này?')) return;
  await fetch(`/api/servers/${id}`,{
    method:'DELETE',
    headers:{'Authorization':'Bearer '+SESSION_TOKEN}
  });
  await loadServerList();
  showToast('🗑 Đã xóa máy chủ','var(--muted)');
}

// ─── SERVER DETAIL MODAL ───────────────────────────────
window._detailOpenId = null;
window._detailStartTime = null;
window._detailLogStore = {}; // svId → log lines array

async function openDetailModal(svId){
  window._detailOpenId = svId;
  if(!window._detailLogStore[svId]) window._detailLogStore[svId] = [];
  // Fill static info from API
  try{
    const svr = await fetch('/api/servers',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(svr.ok){
      const svList = await svr.json();
      const sv = svList.find(s=>s.id===svId || s.id===parseInt(svId));
      if(sv){
        const detName = document.getElementById('det-name');
        if(detName) detName.textContent = sv.name || ('Máy ảo ' + svId);
        if(document.getElementById('det-acc'))     document.getElementById('det-acc').textContent     = sv.acc_name    || '?';
        if(document.getElementById('det-victim'))  document.getElementById('det-victim').textContent  = sv.target_name || '?';
        if(document.getElementById('det-speed'))   document.getElementById('det-speed').textContent   = sv.speed       || '?';
        const rawDate = sv.created_at || sv.created || sv.created_time || sv.createdAt || null;
        const created = rawDate ? (String(rawDate).includes('T') ? String(rawDate).replace('T',' ').substring(0,16) : String(rawDate).substring(0,16)) : '?';
        if(document.getElementById('det-created')) document.getElementById('det-created').textContent = created;
      }
    }
  }catch(e){}
  // Also try to fill from card as fallback
  const card = document.getElementById('svcard2-'+svId);
  if(card){
    const badge = document.getElementById('sv2-badge-'+svId);
    const dot   = document.getElementById('sv2-dot-'+svId);
    const detBadge = document.getElementById('det-badge');
    const detDot   = document.getElementById('det-dot');
    if(badge && detBadge){ detBadge.textContent=badge.textContent; detBadge.className=badge.className; }
    if(dot && detDot){ detDot.className=dot.className; }
    const detName = document.getElementById('det-name');
    if(detName && detName.textContent===''){
      const metas = card.querySelectorAll('.sv2-meta-val');
      if(metas[1] && !document.getElementById('det-victim').textContent) document.getElementById('det-victim').textContent=metas[1].textContent;
      if(metas[0] && !document.getElementById('det-acc').textContent)    document.getElementById('det-acc').textContent=metas[0].textContent;
      if(metas[2] && !document.getElementById('det-created').textContent)document.getElementById('det-created').textContent=metas[2].textContent;
      detName.textContent = ('Máy ảo ' + svId);
    }
  }
  // Fetch fresh status với since=0 để lấy toàn bộ log
  try{
    const since = 0; // Detail modal luôn lấy full log từ đầu
    const r = await fetch('/api/dame/status?server_id='+svId+'&since='+since,{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const sd = await r.json();
    _syncDetailModal(svId, sd, 0, true);
    if(sd.running) window._detailStartTime = Date.now();
    // Screenshot
    if(sd.running || sd.screenshot_b64){
      const sr = await fetch('/api/dame/screenshot?server_id='+svId,{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
      const scd = await sr.json();
      if(scd.screenshot_b64){
        const img=document.getElementById('det-scr-img'), ph=document.getElementById('det-scr-ph');
        if(img){img.src='data:image/jpeg;base64,'+scd.screenshot_b64;img.style.display='block';}
        if(ph) ph.style.display='none';
      }
    }
  }catch(e){}
  document.getElementById('sv-detail-modal').style.display='flex';
}

async function reStartServerFromDetail(svId){
  try{
    const r=await fetch('/api/servers',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const list=await r.json();
    const sv=list.find(function(s){return s.id===svId||s.id===parseInt(svId);});
    if(!sv){showToast('Không tìm thấy thông tin máy chủ','var(--red)');return;}
    await serverAction('start',svId,sv.cookie||'',sv.target_url||'',sv.speed||'normal',sv.acc_name||'',sv.acc_uid||'',sv.target_name||'');
  }catch(e){showToast('Lỗi: '+e.message,'var(--red)');}
}
function _syncDetailModal(svId, sd, _unused, fullReset){
  if(window._detailOpenId !== svId) return;
  const sLabel={ready:'Sẵn sàng',running:'Đang chạy',stopped:'Đã dừng',paused:'Tạm dừng'};
  const st = sd.running?'running':sd.paused?'paused':'stopped';
  const badge=document.getElementById('det-badge'), dot=document.getElementById('det-dot');
  if(badge){badge.textContent=sLabel[st]||st; badge.className='sv2-status-badge '+st;}
  if(dot) dot.className='sv2-status-dot '+st;
  const totEl=document.getElementById('det-total'), loopEl=document.getElementById('det-loops');
  if(totEl) totEl.textContent=sd.total||0;
  if(loopEl) loopEl.textContent=sd.loops||0;
  // Actions
  const actDiv=document.getElementById('det-actions');
  if(actDiv){
    actDiv.innerHTML=`
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${!sd.running&&!sd.paused?`<button class="sv2-btn play" style="flex:1" onclick="reStartServerFromDetail('${svId}')">▶ Chạy ngay</button>`:''}
        ${sd.running?`<button class="sv2-btn pause" style="flex:1" onclick="serverAction('pause','${svId}')">⏸ Tạm dừng</button>`:''}
        ${sd.paused?`<button class="sv2-btn resume" style="flex:1" onclick="serverAction('resume','${svId}')">▶ Tiếp tục</button>`:''}
        ${sd.running||sd.paused?`<button class="sv2-btn stop" style="flex:1" onclick="serverAction('stop','${svId}')">⏹ Dừng hẳn</button>`:''}
      </div>`;
  }
  // Logs — append new lines (sd.logs đã là delta từ since)
  const logEl=document.getElementById('det-log');
  if(logEl){
    if(fullReset) logEl.innerHTML='';
    if(sd.logs && sd.logs.length){
      sd.logs.forEach(line => {
        const div=document.createElement('div');
        div.style.cssText='border-left:2px solid rgba(79,158,255,.35);padding-left:7px;margin-bottom:3px;line-height:1.6';
        div.textContent=line;
        logEl.appendChild(div);
      });
      logEl.scrollTop=logEl.scrollHeight;
    } else if(fullReset){
      logEl.innerHTML=`<div style="color:var(--muted)">${st==='stopped'?'⏹ Chưa chạy — chưa có log':st==='running'?'🟢 Đang chạy — chờ log...':'✅ Sẵn sàng'}</div>`;
    }
  }
}

function closeDetailModal(){
  document.getElementById('sv-detail-modal').style.display='none';
  window._detailOpenId=null;
  window._detailStartTime=null;
}

function clearDetLog(){
  const el=document.getElementById('det-log');
  if(el) el.innerHTML='<div style="color:var(--muted)">🗑 Đã xóa log</div>';
  if(window._detailOpenId && window._svLogIdx) window._svLogIdx[window._detailOpenId]=0;
}
// ──────────────────────────────────────────────────────
document.addEventListener('click',e=>{if(!sfxOn)return;const el=e.target.closest('button,.btn,.support-btn,.sb-item,.sb-toggle-row,.sb-logout,.hist-btn,.tab,.page-btn,.captcha-opt,.auth-tab');if(el)playSfx('click');});

let _theme='dark';
function toggleTheme(){
  _theme=_theme==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',_theme);
  const lbl=document.getElementById('theme-label');const tog=document.getElementById('theme-toggle');
  if(lbl)lbl.textContent=_theme==='dark'?'🌙 Chế độ tối':'☀️ Chế độ sáng';
  if(tog)tog.classList.toggle('on',_theme==='dark');
}
let musicOn=false;
const bgMusic=document.getElementById('bg-music');
function toggleMusic(){
  musicOn=!musicOn;document.getElementById('music-toggle').classList.toggle('on',musicOn);
  if(musicOn)bgMusic.play().catch(()=>{});else bgMusic.pause();
}
let sfxOn=true;
function toggleSfx(){sfxOn=!sfxOn;document.getElementById('sfx-toggle').classList.toggle('on',sfxOn);if(sfxOn)playSfx('click');}
function playSfx(type){
  if(!sfxOn)return;
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    if(type==='click'){osc.frequency.setValueAtTime(880,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(440,ctx.currentTime+.08);gain.gain.setValueAtTime(.15,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.12);osc.start(ctx.currentTime);osc.stop(ctx.currentTime+.12);}
    else if(type==='success'){[523,659,784,1047].forEach((f,i)=>{const o2=ctx.createOscillator(),g2=ctx.createGain();o2.connect(g2);g2.connect(ctx.destination);o2.frequency.value=f;g2.gain.setValueAtTime(.12,ctx.currentTime+i*.1);g2.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.1+.15);o2.start(ctx.currentTime+i*.1);o2.stop(ctx.currentTime+i*.1+.15);});}
    else if(type==='error'){osc.frequency.setValueAtTime(300,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(150,ctx.currentTime+.2);gain.gain.setValueAtTime(.15,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.2);osc.start(ctx.currentTime);osc.stop(ctx.currentTime+.2);}
  }catch{}
}
// sfx click handled above

function togglePw(inputId, btn){
  const inp = document.getElementById(inputId);
  if(!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  const eyeOn  = btn.querySelector('.eye-icon');
  const eyeOff = btn.querySelector('.eye-off-icon');
  if(eyeOn)  eyeOn.style.display  = show ? 'none'  : 'block';
  if(eyeOff) eyeOff.style.display = show ? 'block' : 'none';
  btn.classList.toggle('active', show);
}

function showToast(msg,bg='#4f9eff'){
  const t=document.createElement('div');t.className='toast';t.textContent=msg;t.style.background=bg;
  document.body.appendChild(t);setTimeout(()=>t.remove(),3000);
}
function startClock(){
  setInterval(()=>{
    // Tick uptime cho tất cả card đang chạy
    if(window._svStart){
      Object.keys(window._svStart).forEach(svId=>{
        const el=document.getElementById('sv2-uptime-'+svId);
        const pg=document.getElementById('sv2-prog-'+svId);
        if(!el) return;
        const secs=Math.floor((Date.now()-window._svStart[svId])/1000);
        const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;
        el.textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        if(pg){ pg.style.width=Math.min((secs%60)/60*100,100)+'%'; }
      });
    }
    const t=new Date().toLocaleTimeString('vi-VN');
    const el=document.getElementById('clock');if(el)el.textContent=t;
    const el2=document.getElementById('clock-welcome');if(el2)el2.textContent=t;
    // Update detail modal uptime nếu đang mở
    if(window._detailOpenId && window._detailStartTime){
      const s=Math.floor((Date.now()-window._detailStartTime)/1000);
      const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;
      const el3=document.getElementById('det-uptime');
      if(el3) el3.textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    }
  },1000);
}

// Khởi động nếu đã có session
(function init(){
  const el=document.getElementById('remember-check');
  if(el){el.classList.toggle('checked',rememberMe);el.textContent=rememberMe?'✓':'';}
  if(rememberMe&&CURRENT_USER){const u=document.getElementById('login-user');if(u)u.value=CURRENT_USER;}
  if(SESSION_TOKEN&&CURRENT_USER){
    const _ac=new AbortController(),_tid=setTimeout(()=>_ac.abort(),5000);
    // Verify session + re-fetch IS_ADMIN from server để đảm bảo đúng
    fetch('/api/me',{headers:{'Authorization':'Bearer '+SESSION_TOKEN},signal:_ac.signal})
      .then(async r=>{
        clearTimeout(_tid);
        if(r.ok){
          try{ const d=await r.json(); IS_ADMIN=d.is_admin||false; CURRENT_USER=d.username||CURRENT_USER; }catch(e){}
          showApp();
        } else {
          SESSION_TOKEN='';CURRENT_USER='';IS_ADMIN=false;
          ['zct_token','zct_user','zct_admin'].forEach(k=>{localStorage.removeItem(k);sessionStorage.removeItem(k);});
        }
      })
      .catch(()=>{
        clearTimeout(_tid);
        // fallback: dùng /api/history nếu /api/me không có
        // Re-read IS_ADMIN từ storage để đảm bảo đúng
        IS_ADMIN = rememberMe ? localStorage.getItem('zct_admin')==='1' : sessionStorage.getItem('zct_admin')==='1';
        fetch('/api/history',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}})
          .then(r2=>{ if(r2.ok)showApp(); else{SESSION_TOKEN='';CURRENT_USER='';IS_ADMIN=false;['zct_token','zct_user','zct_admin'].forEach(k=>{localStorage.removeItem(k);sessionStorage.removeItem(k);});} })
          .catch(()=>{SESSION_TOKEN='';CURRENT_USER='';IS_ADMIN=false;['zct_token','zct_user','zct_admin'].forEach(k=>{localStorage.removeItem(k);sessionStorage.removeItem(k);});});
      });
  }
  setActiveStep(1);
  setInterval(()=>{if(dameRunning)updateRunUI();},1000);

  // Auto refresh server rail + inline screenshot mỗi 4s khi ở tab run
  setInterval(()=>{
    const runTab = document.getElementById('main-tab-run');
    if(runTab && runTab.style.display!=='none' && SESSION_TOKEN){
      refreshInlineScreenshot();
      loadServerRail();
    }
  }, 4000);
})();

// Countdown timers (dùng cho forgot password)
let qrCountdownTimer=null,otpCountdownTimer=null;
function startOtpCountdown(seconds){
  clearInterval(otpCountdownTimer);
  const label=document.getElementById('otp-timer-val');const bar=document.getElementById('otp-bar-fill');
  if(!label)return;const total=seconds;let remaining=seconds;
  function tick(){
    const pct=(remaining/total)*100;const m=Math.floor(remaining/60);const s=remaining%60;
    label.textContent=m+':'+String(s).padStart(2,'0');bar.style.width=pct+'%';
    if(pct>50){bar.style.background='var(--blue)';label.style.color='var(--blue)';}
    else if(pct>20){bar.style.background='var(--yellow)';label.style.color='var(--yellow)';}
    else{bar.style.background='var(--red)';label.style.color='var(--red)';}
    if(remaining<=0){clearInterval(otpCountdownTimer);label.textContent='Hết hạn!';label.style.color='var(--red)';bar.style.width='0%';}
    remaining--;
  }
  tick();otpCountdownTimer=setInterval(tick,1000);
}
function stopOtpCountdown(){clearInterval(otpCountdownTimer);}

// ═══════════════════════════════════════════════════════
//  SCREENSHOT TAB MÁY ẢO
// ═══════════════════════════════════════════════════════
let _ssTimer = null;

function openScreenshotModal(){
  openModal('screenshot-modal');
  refreshScreenshot();
  _ssTimer = setInterval(refreshScreenshot, 2500);
}

function closeScreenshotModal(){
  closeModal('screenshot-modal');
  if(_ssTimer){ clearInterval(_ssTimer); _ssTimer=null; }
}

async function refreshScreenshot(){
  try{
    const r  = await fetch('/api/dame/screenshot',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const d  = await r.json();
    const b64 = d.screenshot;
    const img = document.getElementById('ss-img');
    const ph  = document.getElementById('ss-placeholder');
    const dot = document.getElementById('ss-live-dot');
    const lbl = document.getElementById('ss-live-label');
    const ttl = document.getElementById('ss-total-label');

    if(ttl) ttl.textContent = dameTotal+' báo cáo';

    if(b64){
      if(img){ img.src='data:image/jpeg;base64,'+b64; img.style.display='block'; }
      if(ph)  ph.style.display='none';
      if(dot) dot.style.background='var(--green)';
      if(lbl) lbl.textContent='LIVE';
      // Cập nhật URL bar
      const urlBar = document.getElementById('ss-url-bar');
      if(urlBar && _targetUrl) urlBar.textContent = _targetUrl;
    } else {
      if(dot) dot.style.background='var(--red)';
      if(lbl) lbl.textContent=dameRunning?'Đang khởi động...':'Chưa chạy';
    }
  } catch(e){
    const lbl=document.getElementById('ss-live-label');
    if(lbl) lbl.textContent='Lỗi kết nối';
  }
}

document.addEventListener('keydown', e=>{
  if(e.key==='Escape'){
    const m=document.getElementById('screenshot-modal');
    if(m && m.classList.contains('open')) closeScreenshotModal();
  }
  if(e.key==='Enter'){
    const authScr=document.getElementById('auth-screen');
    if(authScr&&authScr.style.display!=='none'){
      // Kiểm tra tab đang active
      const regForm=document.getElementById('auth-register-form');
      const regStep2=document.getElementById('reg-step2');
      if(regForm&&regForm.style.display!=='none'){
        // Đang ở tab đăng ký
        if(regStep2&&regStep2.style.display!=='none') doRegisterVerify();
        else doRegisterSendOtp();
      } else {
        doLogin();
      }
    }
  }
});

