
// ══════════════════════════════════════════════════════
// LIGHTBOX VIEWER
// ══════════════════════════════════════════════════════
let _lightboxSrc = null;
let _lightboxType = null;

function _lightboxGetExt(src, type){
  // From base64 mime
  if(src && src.startsWith('data:')){
    const mime = src.split(';')[0].split(':')[1]||'';
    const map = {'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp',
                 'video/mp4':'mp4','video/webm':'webm','video/ogg':'ogv','video/quicktime':'mov'};
    return map[mime] || (type==='video'?'mp4':'jpg');
  }
  // From URL extension
  const m = src && src.match(/\.([a-z0-9]+)(\?|$)/i);
  return m ? m[1].toLowerCase() : (type==='video'?'mp4':'jpg');
}

function openLightbox(src, type){
  if(!src) return;
  // Auto-detect type
  if(!type){
    if(src.startsWith('data:video') || src.match(/\.(mp4|webm|ogg|mov)/i)) type='video';
    else type='image';
  }
  _lightboxSrc = src;
  _lightboxType = type;
  let ov = document.getElementById('lightbox-overlay');
  if(!ov) return;
  // Move lightbox to body root để thoát stacking context của các page (overflow:hidden)
  if(ov.parentElement !== document.body){
    document.body.appendChild(ov);
  }
  const img = document.getElementById('lightbox-img');
  const vid = document.getElementById('lightbox-video');
  const saveBtn = document.getElementById('lightbox-save-btn');
  if(type==='video'){
    img.style.display='none'; img.src='';
    vid.style.display='block'; vid.src=src;
    if(saveBtn){ saveBtn.style.display='block'; saveBtn.textContent='💾 Lưu video'; }
  } else {
    vid.style.display='none'; vid.pause && vid.pause(); vid.src='';
    img.style.display='block'; img.src=src;
    if(saveBtn){ saveBtn.style.display='block'; saveBtn.textContent='💾 Lưu ảnh'; }
  }
  ov.style.display='flex';
  document.body.style.overflow='hidden';
}
function closeLightbox(){
  const ov=document.getElementById('lightbox-overlay');
  const vid=document.getElementById('lightbox-video');
  const img=document.getElementById('lightbox-img');
  if(vid){ vid.pause(); vid.src=''; }
  if(img){ img.src=''; }
  if(ov) ov.style.display='none';
  document.body.style.overflow='';
  _lightboxSrc=null; _lightboxType=null;
}
function lightboxSave(){
  if(!_lightboxSrc) return;
  const ext = _lightboxGetExt(_lightboxSrc, _lightboxType);
  const filename = (_lightboxType==='video'?'video_':'image_') + Date.now() + '.' + ext;
  const a = document.createElement('a');
  a.href = _lightboxSrc;
  a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
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

