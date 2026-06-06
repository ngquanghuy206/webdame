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

