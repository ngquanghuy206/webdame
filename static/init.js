// Khởi động nếu đã có session
(function init(){
  const el=document.getElementById('remember-check');
  if(el){el.classList.toggle('checked',rememberMe);el.textContent=rememberMe?'✓':'';}
  if(rememberMe&&CURRENT_USER){const u=document.getElementById('login-user');if(u)u.value=CURRENT_USER;}
  if(SESSION_TOKEN&&CURRENT_USER){
    // Hiện sảnh ngay — không chờ verify để tránh flash login
    const authEl=document.getElementById('auth-screen');
    if(authEl) authEl.style.display='none';
    showApp();
    // Verify ngầm — nếu token hết hạn mới kick về login
    const _ac=new AbortController(),_tid=setTimeout(()=>_ac.abort(),5000);
    fetch('/api/history',{headers:{'Authorization':'Bearer '+SESSION_TOKEN},signal:_ac.signal})
      .then(r=>{clearTimeout(_tid);if(!r.ok){SESSION_TOKEN='';CURRENT_USER='';IS_ADMIN=false;['zct_token','zct_user','zct_admin'].forEach(k=>{localStorage.removeItem(k);sessionStorage.removeItem(k);});document.getElementById('welcome-screen').style.display='none';const _as=document.getElementById('auth-screen');_as.style.display='flex';if(typeof _reinitCaptchas==='function')setTimeout(_reinitCaptchas,100);}})
      .catch(()=>{clearTimeout(_tid);});
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

