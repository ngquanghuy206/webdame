// ═══════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function toggleMenu(){
  const sb=document.getElementById('main-sidebar');
  const ov=document.getElementById('sidebar-overlay');
  if(sb.classList.contains('open')){closeMenu();}
  else{sb.classList.add('open');ov.classList.add('open');}
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

