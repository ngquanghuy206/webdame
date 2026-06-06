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

