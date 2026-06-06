// ══════════════════════════════════════════════════════
// CHAT WITH ADMIN — 2-WAY REAL-TIME
// ══════════════════════════════════════════════════════
let _chatOpen = false, _chatImgData = null;
let _chatLastId = null, _chatPollTimer = null;
let _chatMessages = []; // in-memory cache

const ADMIN_NAME = 'Nguyễn Hoàng Khánh Nam';
const ADMIN_AVATAR_EMOJI = '👑';
const ADMIN_VIP_BADGE = '<span style="background:linear-gradient(135deg,#ffd740,#ff9800);color:#000;font-size:9px;font-weight:900;padding:2px 6px;border-radius:20px;letter-spacing:.5px;margin-left:4px">VIP</span>';

function _userInitial(name){ return (name||'?')[0].toUpperCase(); }

function _getAdminAvatarHtml(size){
  size = size||32;
  try{
    // Try to get admin avatar from localStorage (stored as zct_avatar_ADMINUSERNAME)
    // We don't know the exact admin username from client, check IS_ADMIN or stored key
    const keys=Object.keys(localStorage);
    for(const k of keys){
      if(k.startsWith('zct_avatar_')){
        const user=k.replace('zct_avatar_','');
        // Check if this is admin by trying - just use first avatar found if IS_ADMIN
        const src=localStorage.getItem(k);
        if(src && IS_ADMIN){
          return `<img src="${src}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,215,64,.4)" alt="">`;
        }
      }
    }
  }catch(e){}
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#ffd740,#ff9800);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.5)}px;flex-shrink:0">👑</div>`;
}

function _getUserAvatarHtml(username, size){
  size = size||32;
  try{
    const src=localStorage.getItem('zct_avatar_'+username)||localStorage.getItem('zct_avatar_'+(CURRENT_USER||''));
    if(src && username===(CURRENT_USER||'')){
      return `<img src="${src}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(79,158,255,.3)" alt="">`;
    }
  }catch(e){}
  const initial=_userInitial(username);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#4f9eff,#7c4dff);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.45)}px;font-weight:700;color:#fff;flex-shrink:0">${initial}</div>`;
}

// ══════════════════════════════════════════════════════
// INBOX PAGE — giống chototmmo
// ══════════════════════════════════════════════════════
function openInboxPage(){
  if(IS_ADMIN){
    openAdminInboxPage();
    return;
  }
  const page = document.getElementById('inbox-page');
  if(page){ page.style.display='flex'; document.body.style.overflow='hidden'; }
  const d1=document.getElementById('chat-unread-dot');if(d1)d1.style.display='none';
  const d2=document.getElementById('chat-unread-dot-welcome');if(d2)d2.style.display='none';
  loadInboxThreads();
}
function closeInboxPage(){
  const page = document.getElementById('inbox-page');
  if(page){ page.style.display='none'; }
  const tp = document.getElementById('chat-thread-page');
  if(tp){ tp.style.display='none'; }
  document.body.style.overflow='';
}
function openChatThreadPage(){
  const page = document.getElementById('chat-thread-page');
  if(page){ page.style.display='flex'; }
  _chatOpen=true;
  _chatLastId=null; _chatMessages=[];
  _loadChatMessages(true);
  _startChatPoll();
}
function closeChatThreadPage(){
  _chatOpen=false; _stopChatPoll();
  const page = document.getElementById('chat-thread-page');
  if(page){ page.style.display='none'; }
}

async function loadInboxThreads(){
  const list = document.getElementById('inbox-thread-list');
  if(!list) return;
  list.innerHTML='<div style="text-align:center;color:var(--muted);padding:40px 0">⏳ Đang tải...</div>';
  // User chỉ có 1 thread với admin
  try{
    const r = await fetch('/api/chat/messages', {headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(!r.ok) throw new Error();
    const d = await r.json();
    const msgs = d.messages||[];
    const lastMsg = msgs.length ? msgs[msgs.length-1] : null;
    const lastText = lastMsg ? (lastMsg.text || (lastMsg.img?'[Ảnh]':'')) : 'Gửi tin nhắn cho Admin';
    const lastTime = lastMsg ? (lastMsg.time||'') : '';
    list.innerHTML = `<div onclick="openChatAdminThread()" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;border-bottom:1px solid var(--border);background:var(--bg1);transition:.15s" onmouseover="this.style.background='var(--glass)'" onmouseout="this.style.background='var(--bg1)'">
      <div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#ffd740,#ff9800);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">👑</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
          <span style="font-size:14px;font-weight:800;color:var(--text)">Nguyễn Hoàng Khánh Nam</span>
          <span style="font-size:11px;color:var(--muted);flex-shrink:0;margin-left:8px">${lastTime}</span>
        </div>
        <div style="font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lastText}</div>
      </div>
    </div>`;
  }catch{
    list.innerHTML='<div style="text-align:center;color:var(--muted);padding:40px 0">⏳ Đang tải...</div>';
  }
}

function filterInboxThreads(q){
  // Chỉ 1 thread nên filter đơn giản
  const item = document.querySelector('#inbox-thread-list > div');
  if(!item) return;
  item.style.display = q ? (item.textContent.toLowerCase().includes(q.toLowerCase())?'':'none') : '';
}

function openChatAdminThread(){
  document.getElementById('chat-thread-name').textContent='Nguyễn Hoàng Khánh Nam';
  openChatThreadPage();
}

// Legacy — giữ để không break code cũ
function openChatAdmin(){ openInboxPage(); }
function closeChatAdmin(){
  closeInboxPage();
}

function _startChatPoll(){
  _stopChatPoll();
  _chatPollTimer = setInterval(()=>{ if(_chatOpen) _loadChatMessages(false); }, 3000);
}
function _stopChatPoll(){
  if(_chatPollTimer){ clearInterval(_chatPollTimer); _chatPollTimer=null; }
}

async function _loadChatMessages(scrollToBottom){
  try{
    const since = _chatLastId ? '?since='+_chatLastId : '';
    const r = await fetch('/api/chat/messages'+since, {headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(!r.ok) return;
    const d = await r.json();
    if(!d.messages || !d.messages.length) return;
    if(_chatLastId === null){
      _chatMessages = d.messages;
    } else {
      _chatMessages = [..._chatMessages, ...d.messages];
    }
    if(_chatMessages.length) _chatLastId = _chatMessages[_chatMessages.length-1].id;
    _renderChatMessages();
    if(scrollToBottom) setTimeout(()=>{ const el=document.getElementById('chat-messages'); if(el) el.scrollTop=99999; }, 80);
  }catch{}
}

function _renderChatMessages(){
  const el = document.getElementById('chat-messages');
  if(!el) return;
  const welcome = '<div style="text-align:center;color:var(--muted);font-size:12px;padding:10px"><div style="background:var(--glass2);border-radius:12px;padding:8px 14px;display:inline-block">💬 Gửi tin nhắn cho Admin, chúng tôi sẽ phản hồi sớm nhất!</div></div>';
  if(!_chatMessages.length){ el.innerHTML=welcome; return; }

  const userAvatarSrc = (()=>{ try{ return localStorage.getItem('zct_avatar_'+CURRENT_USER)||''; }catch(e){ return ''; } })();

  const html = _chatMessages.map(m => {
    const isUser = m.from === 'user';
    const name = isUser ? (m.sender||CURRENT_USER) : ADMIN_NAME;
    const initial = _userInitial(name);
    const avatarBg = isUser ? 'linear-gradient(135deg,#4f9eff,#7c4dff)' : 'linear-gradient(135deg,#ffd740,#ff9800)';
    const avatarContent = isUser ? initial : ADMIN_AVATAR_EMOJI;

    let avatarHtml;
    if(isUser){
      avatarHtml = _getUserAvatarHtml(m.sender||CURRENT_USER, 32);
    } else {
      avatarHtml = _getAdminAvatarHtml(32);
    }

    let bodyHtml = '';
    if(m.img && m.img.length > 10){
      bodyHtml = `<img src="${m.img}" style="max-width:200px;max-height:180px;border-radius:10px;display:block;cursor:pointer;margin-bottom:${m.text?'4px':'0'}" onclick="openLightbox(this.src)">`;
    }
    if(m.text) bodyHtml += `<span style="white-space:pre-wrap;word-break:break-all;overflow-wrap:anywhere">${m.text}</span>`;

    const bubbleBg = isUser ? 'linear-gradient(135deg,#4f9eff,#7c4dff)' : 'var(--glass2)';
    const bubbleRadius = isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px';

    const nameHtml = isUser
      ? `<span style="font-size:11px;font-weight:700;color:var(--muted)">${name}</span>`
      : `<span style="font-size:11px;font-weight:700;color:#ffd740">${name}${ADMIN_VIP_BADGE}</span>`;

    if(isUser){
      return `<div style="display:flex;justify-content:flex-end;gap:8px;align-items:flex-end">
        <div style="max-width:75%">
          <div style="text-align:right;margin-bottom:2px">${nameHtml}</div>
          <div style="background:${bubbleBg};color:#fff;border-radius:${bubbleRadius};padding:10px 13px;font-size:14px">${bodyHtml}</div>
          <div style="font-size:10px;color:var(--muted);text-align:right;margin-top:3px">${m.time||''}</div>
        </div>
        ${avatarHtml}
      </div>`;
    } else {
      return `<div style="display:flex;justify-content:flex-start;gap:8px;align-items:flex-end">
        ${avatarHtml}
        <div style="max-width:75%">
          <div style="margin-bottom:2px">${nameHtml}</div>
          <div style="background:${bubbleBg};color:var(--text);border-radius:${bubbleRadius};padding:10px 13px;font-size:14px">${bodyHtml}</div>
          <div style="font-size:10px;color:var(--muted);text-align:left;margin-top:3px">${m.time||''}</div>
        </div>
      </div>`;
    }
  }).join('');

  el.innerHTML = welcome + html;
}

function chatAttachImage(input){
  if(!input.files||!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = function(e){
    _chatImgData = e.target.result;
    showToast('🖼 Ảnh đã đính kèm, bấm Gửi để gửi','#4f9eff');
    document.getElementById('chat-input-text').placeholder='[Ảnh đính kèm] Thêm chú thích...';
  };
  reader.readAsDataURL(input.files[0]);
}

async function chatSend(){
  const input = document.getElementById('chat-input-text');
  const text = (input.value||'').trim();
  if(!text && !_chatImgData) return;
  input.value = '';
  input.style.height = 'auto';
  const imgData = _chatImgData;
  _chatImgData = null;
  input.placeholder = 'Nhập tin nhắn...';
  try{
    const r = await fetch('/api/chat/send',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
      body:JSON.stringify({text, img: imgData||null})
    });
    if(r.ok){
      // reload immediately
      _chatLastId = null;
      _chatMessages = [];
      await _loadChatMessages(true);
    }
  }catch{}
}

// Auto resize textarea
document.addEventListener('DOMContentLoaded',()=>{
  const ta = document.getElementById('chat-input-text');
  if(ta) ta.addEventListener('input',function(){ this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,100)+'px'; });
  const ta2 = document.getElementById('admin-reply-text');
  if(ta2) ta2.addEventListener('input',function(){ this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,80)+'px'; });
});

// ══════════════════════════════════════════════════════
// ADMIN CHAT INBOX
// ══════════════════════════════════════════════════════
let _adminChatTarget = null;
let _adminChatPollTimer = null;

async function loadAdminChatThreads(){
  try{
    const r = await fetch('/api/admin/chat/threads',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(!r.ok) return;
    const threads = await r.json();
    const container = document.getElementById('admin-thread-items');
    if(!container) return;
    // Update unread badge
    const totalUnread = threads.reduce((a,t)=>a+(t.unread||0),0);
    const badge = document.getElementById('admin-chat-unread-badge');
    if(badge) badge.style.display = totalUnread > 0 ? 'block' : 'none';
    if(!threads.length){
      container.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:30px 16px;gap:10px;text-align:center"><div style="font-size:36px;opacity:.4">💬</div><div style="font-size:13px;font-weight:700;color:var(--muted)">Chưa có tin nhắn</div><div style="font-size:11px;color:var(--muted);opacity:.7">User gửi tin sẽ xuất hiện ở đây</div></div>';
      return;
    }
    container.innerHTML = threads.map(t => {
      const isActive = _adminChatTarget === t.username;
      const lastMsg = t.last_msg || {};
      const lastText = lastMsg.text || (lastMsg.img ? '[Ảnh]' : '...');
      const lastTime = lastMsg.time || '';
      const unread = t.unread || 0;
      return `<div onclick="adminOpenThread('${t.username}')" style="display:flex;align-items:center;gap:10px;padding:12px;cursor:pointer;border-bottom:1px solid var(--border);background:${isActive?'rgba(79,158,255,.12)':'transparent'};transition:.2s" onmouseover="this.style.background='rgba(79,158,255,.08)'" onmouseout="this.style.background='${isActive?'rgba(79,158,255,.12)':'transparent'}'">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#4f9eff,#7c4dff);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;flex-shrink:0">${_userInitial(t.username)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
            <span style="font-size:13px;font-weight:${unread>0?'800':'600'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)">${t.username}</span>
            <span style="font-size:10px;color:var(--muted);flex-shrink:0;margin-left:6px">${lastTime}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lastText}</div>
        </div>
        ${unread>0?`<div style="min-width:18px;height:18px;border-radius:9px;background:#ff4d4d;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px">${unread}</div>`:''}
      </div>`;
    }).join('');
  }catch{}
}

async function adminOpenThread(username){
  _adminChatTarget = username;
  const header = document.getElementById('admin-chat-target-name');
  if(header) header.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#4f9eff,#7c4dff);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff">${_userInitial(username)}</div> <span>${username}</span>`;
  const inputRow = document.getElementById('admin-chat-input-row');
  if(inputRow) inputRow.style.display = 'flex';
  await _loadAdminThreadMessages();
  loadAdminChatThreads(); // refresh unread counts
}

async function _loadAdminThreadMessages(){
  if(!_adminChatTarget) return;
  try{
    const r = await fetch(`/api/admin/chat/thread/${_adminChatTarget}`,{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(!r.ok) return;
    const d = await r.json();
    const msgs = d.messages || [];
    const el = document.getElementById('admin-chat-messages');
    if(!el) return;
    if(!msgs.length){ el.innerHTML='<div style="padding:14px;font-size:12px;color:var(--muted);text-align:center">Chưa có tin nhắn</div>'; return; }
    el.innerHTML = msgs.map(m => {
      const isUser = m.from === 'user';
      const name = isUser ? (m.sender||_adminChatTarget) : (m.sender||ADMIN_NAME);
      const initial = _userInitial(name);
      const avatarBg = isUser ? 'linear-gradient(135deg,#4f9eff,#7c4dff)' : 'linear-gradient(135deg,#ffd740,#ff9800)';
      const avatarContent = isUser ? initial : ADMIN_AVATAR_EMOJI;
      let bodyHtml = '';
      if(m.img && m.img.length > 10) bodyHtml += `<img src="${m.img}" style="max-width:180px;max-height:160px;border-radius:8px;display:block;cursor:pointer" onclick="openLightbox(this.src)">`;
      if(m.text) bodyHtml += `<span style="white-space:pre-wrap;word-break:break-all;overflow-wrap:anywhere">${m.text}</span>`;
      const bubbleBg = isUser ? 'linear-gradient(135deg,#4f9eff,#7c4dff)' : 'rgba(255,215,64,.12)';
      const bubbleBorder = isUser ? 'none' : '1px solid rgba(255,215,64,.3)';
      const textColor = isUser ? '#fff' : 'var(--text)';
      const dir = isUser ? 'flex-end' : 'flex-start';
      const br = isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px';
      const nameLabel = isUser
        ? `<div style="font-size:10px;color:var(--muted);text-align:right;margin-bottom:2px">${name}</div>`
        : `<div style="font-size:10px;color:#ffd740;font-weight:700;margin-bottom:2px">${name} <span style="background:linear-gradient(135deg,#ffd740,#ff9800);color:#000;font-size:8px;font-weight:900;padding:1px 5px;border-radius:20px">VIP</span></div>`;
      if(isUser){
        return `<div style="display:flex;justify-content:${dir};gap:6px;align-items:flex-end">
          <div style="max-width:78%">${nameLabel}<div style="background:${bubbleBg};border:${bubbleBorder};color:${textColor};border-radius:${br};padding:8px 11px;font-size:13px">${bodyHtml}</div><div style="font-size:10px;color:var(--muted);text-align:right;margin-top:2px">${m.time||''}</div></div>
          <div style="width:28px;height:28px;border-radius:50%;background:${avatarBg};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0">${avatarContent}</div>
        </div>`;
      } else {
        return `<div style="display:flex;justify-content:${dir};gap:6px;align-items:flex-end">
          <div style="width:28px;height:28px;border-radius:50%;background:${avatarBg};display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">${avatarContent}</div>
          <div style="max-width:78%">${nameLabel}<div style="background:${bubbleBg};border:${bubbleBorder};color:${textColor};border-radius:${br};padding:8px 11px;font-size:13px">${bodyHtml}</div><div style="font-size:10px;color:var(--muted);text-align:left;margin-top:2px">${m.time||''}</div></div>
        </div>`;
      }
    }).join('');
    el.scrollTop = 99999;
  }catch{}
}

async function adminChatReply(){
  const ta = document.getElementById('admin-reply-text');
  const text = (ta.value||'').trim();
  if(!text || !_adminChatTarget) return;
  ta.value = '';
  ta.style.height = 'auto';
  try{
    await fetch('/api/admin/chat/reply',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
      body:JSON.stringify({to:_adminChatTarget, text})
    });
    await _loadAdminThreadMessages();
    loadAdminChatThreads();
  }catch{}
}

// Poll admin inbox every 5s khi tab chat đang mở
let _adminChatTabOpen = false;
function _startAdminChatPoll(){
  if(_adminChatPollTimer) return;
  _adminChatPollTimer = setInterval(()=>{
    if(_adminChatTabOpen){
      loadAdminChatThreads();
      if(_adminChatTarget) _loadAdminThreadMessages();
    }
  }, 5000);
}
function _stopAdminChatPoll(){
  if(_adminChatPollTimer){ clearInterval(_adminChatPollTimer); _adminChatPollTimer=null; }
}

// ══════════════════════════════════════════════════════
// ADMIN INBOX — FULL SCREEN (giống user inbox)
// ══════════════════════════════════════════════════════
let _adminInboxAllThreads = []; // cache để filter

function openAdminInboxPage(){
  const page = document.getElementById('admin-inbox-page');
  if(page){ page.style.display='flex'; document.body.style.overflow='hidden'; }
  const inp = document.getElementById('admin-inbox-search');
  if(inp) inp.value='';
  _adminChatTabOpen = true;
  loadAdminInboxThreads();
  _startAdminChatPoll();
}
function closeAdminInboxPage(){
  _adminChatTabOpen = false;
  _stopAdminChatPoll();
  const page = document.getElementById('admin-inbox-page');
  if(page){ page.style.display='none'; }
  document.body.style.overflow='';
}

function openAdminChatThreadPage(username){
  _adminChatTarget = username;
  // Cập nhật header avatar + tên
  const av = document.getElementById('admin-thread-avatar');
  const nm = document.getElementById('admin-thread-username');
  const initial = _userInitial(username);
  if(av) av.textContent = initial;
  if(nm) nm.textContent = username;
  const page = document.getElementById('admin-chat-thread-page');
  if(page){ page.style.display='flex'; }
  // Load messages
  _loadAdminThreadMessagesNew();
  // Poll
  if(_adminChatPollTimer) clearInterval(_adminChatPollTimer);
  _adminChatPollTimer = setInterval(()=>{ _loadAdminThreadMessagesNew(); }, 4000);
}
function closeAdminChatThreadPage(){
  if(_adminChatPollTimer){ clearInterval(_adminChatPollTimer); _adminChatPollTimer=null; }
  const page = document.getElementById('admin-chat-thread-page');
  if(page){ page.style.display='none'; }
  // Refresh inbox unread
  loadAdminInboxThreads();
}

async function loadAdminInboxThreads(){
  try{
    const r = await fetch('/api/admin/chat/threads',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(!r.ok) return;
    const threads = await r.json();
    _adminInboxAllThreads = threads;
    // Unread badge
    const totalUnread = threads.reduce((a,t)=>a+(t.unread||0),0);
    const badge = document.getElementById('admin-chat-unread-badge');
    if(badge) badge.style.display = totalUnread>0?'block':'none';
    renderAdminInboxThreads(threads);
  }catch{}
}

function renderAdminInboxThreads(threads){
  const container = document.getElementById('admin-inbox-thread-list');
  if(!container) return;
  if(!threads.length){
    container.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;text-align:center"><div style="font-size:48px;opacity:.3">💬</div><div style="font-size:15px;font-weight:700;color:var(--muted)">Chưa có tin nhắn nào</div><div style="font-size:13px;color:var(--muted);opacity:.7">Khi user nhắn sẽ hiện ở đây</div></div>';
    return;
  }
  container.innerHTML = threads.map(t => {
    const lastMsg = t.last_msg || {};
    const lastText = lastMsg.text || (lastMsg.img ? '[Ảnh]' : '...');
    const lastTime = lastMsg.time || '';
    const unread = t.unread || 0;
    const initial = _userInitial(t.username);
    // Avatar: lấy từ localStorage nếu có (admin ko có avatar user, dùng initial)
    const avatarHtml = `<div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#4f9eff,#7c4dff);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;flex-shrink:0">${initial}</div>`;
    return `<div onclick="openAdminChatThreadPage('${t.username}')" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;border-bottom:1px solid var(--border);background:var(--bg1);transition:.15s" onmouseover="this.style.background='var(--glass)'" onmouseout="this.style.background='var(--bg1)'">
      ${avatarHtml}
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
          <span style="font-size:14px;font-weight:${unread>0?'800':'700'};color:var(--text)">${t.username}</span>
          <span style="font-size:11px;color:var(--muted);flex-shrink:0;margin-left:8px">${lastTime}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <div style="font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${lastText}</div>
          ${unread>0?`<div style="min-width:20px;height:20px;border-radius:10px;background:#ff4d4d;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 5px;flex-shrink:0">${unread}</div>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterAdminInboxThreads(q){
  const filtered = q
    ? _adminInboxAllThreads.filter(t=>t.username.toLowerCase().includes(q.toLowerCase()))
    : _adminInboxAllThreads;
  renderAdminInboxThreads(filtered);
}

async function _loadAdminThreadMessagesNew(){
  if(!_adminChatTarget) return;
  try{
    const r = await fetch(`/api/admin/chat/thread/${_adminChatTarget}`,{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(!r.ok) return;
    const d = await r.json();
    const msgs = d.messages || [];
    const el = document.getElementById('admin-thread-messages');
    if(!el) return;
    const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if(!msgs.length){
      el.innerHTML='<div style="text-align:center;color:var(--muted);padding:40px 20px;font-size:13px">Chưa có tin nhắn nào</div>';
      return;
    }
    el.innerHTML = msgs.map(m => {
      const isUser = m.from==='user';
      const name = isUser ? (m.sender||_adminChatTarget) : (m.sender||ADMIN_NAME);
      const initial = _userInitial(name);
      const avatarBg = isUser ? 'linear-gradient(135deg,#4f9eff,#7c4dff)' : 'linear-gradient(135deg,#ffd740,#ff9800)';
      const avatarContent = isUser ? initial : ADMIN_AVATAR_EMOJI;
      let bodyHtml='';
      if(m.img&&m.img.length>10) bodyHtml+=`<img src="${m.img}" style="max-width:200px;max-height:180px;border-radius:10px;display:block;cursor:pointer;margin-bottom:${m.text?'4px':'0'}" onclick="openLightbox(this.src)">`;
      if(m.text) bodyHtml+=`<span style="white-space:pre-wrap;word-break:break-all;overflow-wrap:anywhere">${m.text}</span>`;
      const bubbleBg = isUser ? 'linear-gradient(135deg,#4f9eff,#7c4dff)' : 'var(--glass2)';
      const textColor = isUser ? '#fff' : 'var(--text)';
      const br = isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px';
      const nameLabel = isUser
        ? `<div style="font-size:11px;color:var(--muted);text-align:right;margin-bottom:2px">${name}</div>`
        : `<div style="font-size:11px;color:#ffd740;font-weight:700;margin-bottom:2px">${name}${ADMIN_VIP_BADGE}</div>`;
      const avatarEl = isUser ? _getUserAvatarHtml(m.sender||_adminChatTarget, 32) : _getAdminAvatarHtml(32);
      if(isUser){
        return `<div style="display:flex;justify-content:flex-end;gap:8px;align-items:flex-end">
          <div style="max-width:75%">
            ${nameLabel}
            <div style="background:${bubbleBg};color:${textColor};border-radius:${br};padding:10px 13px;font-size:14px">${bodyHtml}</div>
            <div style="font-size:10px;color:var(--muted);text-align:right;margin-top:3px">${m.time||''}</div>
          </div>${avatarEl}</div>`;
      } else {
        return `<div style="display:flex;justify-content:flex-start;gap:8px;align-items:flex-end">
          ${avatarEl}
          <div style="max-width:75%">
            ${nameLabel}
            <div style="background:${bubbleBg};color:${textColor};border-radius:${br};padding:10px 13px;font-size:14px">${bodyHtml}</div>
            <div style="font-size:10px;color:var(--muted);text-align:left;margin-top:3px">${m.time||''}</div>
          </div></div>`;
      }
    }).join('');
    if(wasAtBottom || el.scrollTop===0) el.scrollTop=99999;
  }catch{}
}

let _adminImgData = null;
function adminAttachImage(input){
  if(!input.files||!input.files[0]) return;
  const reader=new FileReader();
  reader.onload=function(e){
    _adminImgData=e.target.result;
    showToast('🖼 Ảnh đã đính kèm, bấm Gửi','#4f9eff');
    document.getElementById('admin-reply-text2').placeholder='[Ảnh đính kèm] Thêm chú thích...';
  };
  reader.readAsDataURL(input.files[0]);
  input.value='';
}
async function adminChatReplyNew(){
  const ta = document.getElementById('admin-reply-text2');
  const text = (ta.value||'').trim();
  const imgData = _adminImgData;
  if(!text && !imgData) return;
  if(!_adminChatTarget) return;
  ta.value=''; ta.style.height='auto';
  _adminImgData=null;
  ta.placeholder='Nhập reply...';
  try{
    await fetch('/api/admin/chat/reply',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
      body:JSON.stringify({to:_adminChatTarget, text, img: imgData||null})
    });
    await _loadAdminThreadMessagesNew();
  }catch{}
}

// Auto-resize textarea
document.addEventListener('DOMContentLoaded',()=>{
  const ta3 = document.getElementById('admin-reply-text2');
  if(ta3) ta3.addEventListener('input',function(){ this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,90)+'px'; });
});
