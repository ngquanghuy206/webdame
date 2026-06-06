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

