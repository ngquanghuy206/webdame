// ══════════════════════════════════════════════════════
// POSTS SYSTEM
// ══════════════════════════════════════════════════════
const EMOJI_LIST = ['❤️','😂','😮','😢','😡','👍'];
let _postPage = 0, _postsCache = [], _postsTotalApproved = 0;
let _activePostId = null, _commentMediaData = null;
let _createPostMedia = []; // {type, data, name}
let _postsTabActive = 'feed';

function openPostsFeed(){
  const page = document.getElementById('posts-feed-page');
  if(page){ page.style.display='flex'; document.body.style.overflow='hidden'; }
  // Show pending tab for admin
  const pendingTab = document.getElementById('posts-tab-pending');
  if(pendingTab) pendingTab.style.display = IS_ADMIN ? 'inline-flex' : 'none';
  switchPostsTab('feed');
}

function closePostsFeedPage(){
  const page = document.getElementById('posts-feed-page');
  if(page){ page.style.display='none'; document.body.style.overflow=''; }
}

function switchPostsTab(tab){
  _postsTabActive = tab;
  const feedBtn = document.getElementById('posts-tab-feed');
  const pendBtn = document.getElementById('posts-tab-pending');
  if(feedBtn){
    feedBtn.style.background = tab==='feed' ? 'linear-gradient(135deg,#ff50a0,#ff9800)' : 'transparent';
    feedBtn.style.color = tab==='feed' ? '#fff' : 'var(--muted)';
    feedBtn.style.border = tab==='feed' ? 'none' : '1px solid var(--border)';
  }
  if(pendBtn){
    pendBtn.style.background = tab==='pending' ? 'linear-gradient(135deg,#ffd740,#ff9800)' : 'transparent';
    pendBtn.style.color = tab==='pending' ? '#000' : 'var(--muted)';
    pendBtn.style.border = tab==='pending' ? 'none' : '1px solid var(--border)';
  }
  if(tab==='feed'){ _postPage=0; _postsCache=[]; loadPostsFeed(true); }
  else loadPendingPosts();
}

async function loadPostsFeed(reset=false){
  if(reset){ _postPage=0; _postsCache=[]; }
  const el = document.getElementById('posts-feed-content');
  if(reset && el) el.innerHTML='<div style="text-align:center;color:var(--muted);padding:40px 0">⏳ Đang tải...</div>';
  try{
    const r = await fetch(`/api/posts?page=${_postPage}`, {headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const d = await r.json();
    _postsCache = reset ? d.posts : [..._postsCache, ...d.posts];
    _postsTotalApproved = d.total;
    renderPostsFeed();
    const moreRow = document.getElementById('posts-load-more-row');
    if(moreRow) moreRow.style.display = d.has_more ? 'block' : 'none';
  }catch(e){
    if(el) el.innerHTML='<div style="text-align:center;color:#ff5050;padding:30px">❌ Lỗi tải bài đăng</div>';
  }
}

async function loadMorePosts(){
  _postPage++;
  await loadPostsFeed(false);
}

function renderPostsFeed(){
  const el = document.getElementById('posts-feed-content');
  if(!el) return;
  if(!_postsCache.length){
    el.innerHTML='<div style="text-align:center;color:var(--muted);padding:50px 20px"><div style="font-size:48px;margin-bottom:12px">📭</div><div style="font-size:14px">Chưa có bài đăng nào</div><div style="font-size:12px;margin-top:6px">Hãy là người đầu tiên đăng bài!</div></div>';
    return;
  }
  el.style.display='block';
  el.innerHTML = _postsCache.map(p => renderPostCard(p)).join('<div style="height:8px;background:var(--glass2)"></div>');
}

function renderPostCard(p, inFeed=true){
  const isAdmin = p.is_admin || (p.author === 'knammelbel206');
  const authorDisplay = isAdmin
    ? `<span style="font-weight:800;color:#ffd740">${p.author}</span><span style="background:linear-gradient(135deg,#ffd740,#ff9800);color:#000;font-size:9px;font-weight:900;padding:2px 7px;border-radius:20px;margin-left:5px">VIP</span>`
    : `<span style="font-weight:700">${p.author}</span>`;
  const avatarLetter = (p.author||'?')[0].toUpperCase();
  const avatarBg = isAdmin ? 'linear-gradient(135deg,#ffd740,#ff9800)' : 'linear-gradient(135deg,#4f9eff,#7c4dff)';

  // Reactions summary
  const totalReacts = Object.values(p.reactions||{}).reduce((a,b)=>a+b.length,0);
  const topEmojis = Object.entries(p.reactions||{}).filter(([,u])=>u.length>0).sort((a,b)=>b[1].length-a[1].length).slice(0,3).map(([e])=>e).join('');
  const myReact = Object.entries(p.reactions||{}).find(([,u])=>u.includes(CURRENT_USER))?.[0]||null;

  // Media
  let mediaHtml = '';
  if(p.media && p.media.length){
    const imgs = p.media.filter(m=>m.type==='image');
    const vids = p.media.filter(m=>m.type==='video');
    const files = p.media.filter(m=>m.type==='file');
    if(imgs.length===1){
      mediaHtml += `<img src="${imgs[0].data}" style="width:100%;max-height:360px;object-fit:cover;border-radius:12px;margin-top:10px;cursor:pointer" onclick="openLightbox(this.src)">`;
    } else if(imgs.length>1){
      const grid = imgs.length===2?'1fr 1fr':'1fr 1fr 1fr';
      mediaHtml += `<div style="display:grid;grid-template-columns:${grid};gap:4px;margin-top:10px;border-radius:12px;overflow:hidden">${imgs.slice(0,6).map((m,i)=>`<img src="${m.data}" style="width:100%;height:120px;object-fit:cover;cursor:pointer${i===5&&imgs.length>6?';filter:brightness(.5)':''}" onclick="openLightbox(this.src)">`).join('')}</div>`;
    }
    vids.forEach(m=>{ mediaHtml += `<div style="position:relative;margin-top:8px;cursor:pointer;border-radius:12px;overflow:hidden" onclick="openLightbox('${m.data}','video')"><video style="width:100%;max-height:300px;border-radius:12px;display:block;pointer-events:none"><source src="${m.data}">Video không hỗ trợ</video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25)"><div style="width:56px;height:56px;border-radius:50%;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font-size:26px">▶</div></div></div>`; });
    files.forEach(m=>{ mediaHtml += `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--glass2);border-radius:10px;margin-top:6px;cursor:pointer" onclick="downloadBase64('${m.data}','${m.name}')"><span style="font-size:20px">📎</span><span style="font-size:13px;color:var(--blue);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.name||'file'}</span><span style="font-size:11px;color:var(--muted);flex-shrink:0">💾 Tải về</span></div>`; });
  }

  const commentCount = (p.comments||[]).length;
  const adminActions = IS_ADMIN ? `<button onclick="event.stopPropagation();adminDeletePost('${p.id}')" style="background:none;border:none;cursor:pointer;color:#ff5050;font-size:12px;padding:4px 8px;border-radius:8px;hover:background:rgba(255,80,80,.1)">🗑 Xóa</button>` : '';

  // inFeed=true: Facebook flat style (no border/radius); inFeed=false: trong view-post-modal, dùng card nhẹ
  const cardStyle = inFeed
    ? `background:var(--bg);padding:12px 16px 0;`
    : `background:var(--glass);border:1px solid var(--border);border-radius:14px;padding:14px 14px 10px;overflow:hidden;`;
  const actionBarStyle = inFeed
    ? `border-top:1px solid var(--border);margin-top:8px;`
    : `border-top:1px solid var(--border);margin-top:8px;`;

  return `<div style="${cardStyle}" id="post-card-${p.id}">
    <!-- Author row -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      ${(p.author_avatar) ? `<img src="${p.author_avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid ${isAdmin?'rgba(255,215,64,.5)':'rgba(79,158,255,.3)'}" alt="">` : `<div style="width:40px;height:40px;border-radius:50%;background:${avatarBg};display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:#fff;flex-shrink:0">${isAdmin?'👑':avatarLetter}</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:14px">${authorDisplay}</div>
        <div style="font-size:11px;color:var(--muted)">${p.created||''}</div>
      </div>
      ${adminActions}
    </div>
    <!-- Text -->
    ${p.text?`<div style="font-size:14px;line-height:1.55;white-space:pre-wrap;word-break:break-word;margin-bottom:4px">${escapeHtml(p.text)}</div>`:''}
    <!-- Media -->
    ${mediaHtml}
    <!-- Reaction summary bar -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:6px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)">
      <span>${topEmojis?`<span>${topEmojis}</span> `:''}${totalReacts>0?totalReacts+' lượt thích':''}</span>
      <span onclick="openViewPost('${p.id}')" style="cursor:pointer">${commentCount} bình luận</span>
    </div>
    <!-- Action buttons -->
    <div style="display:flex;gap:0;${actionBarStyle}">
      <div style="flex:1;position:relative">
        <button onclick="toggleReactPicker('${p.id}',event)" style="width:100%;padding:7px;background:none;border:none;cursor:pointer;font-size:13px;font-weight:700;color:${myReact?'#ff50a0':'var(--muted)'};border-radius:10px;display:flex;align-items:center;justify-content:center;gap:5px">
          ${myReact||'👍'} ${myReact?'Đã thích':'Thích'}
        </button>
        <div id="react-picker-${p.id}" style="display:none;position:absolute;bottom:110%;left:0;background:var(--glass);border:1px solid var(--border);border-radius:40px;padding:6px 10px;gap:6px;box-shadow:0 4px 20px rgba(0,0,0,.4);z-index:100;white-space:nowrap">
          ${EMOJI_LIST.map(e=>`<span onclick="event.stopPropagation();reactPost('${p.id}','${e}')" style="font-size:22px;cursor:pointer;transition:.15s;display:inline-block" onmouseover="this.style.transform='scale(1.35)'" onmouseout="this.style.transform='scale(1)'">${e}</span>`).join('')}
        </div>
      </div>
      <button onclick="openViewPost('${p.id}')" style="flex:1;padding:7px;background:none;border:none;cursor:pointer;font-size:13px;font-weight:700;color:var(--muted);border-radius:10px;display:flex;align-items:center;justify-content:center;gap:5px">
        💬 Bình luận
      </button>
    </div>
    ${inFeed?'<div style="height:12px"></div>':''}
  </div>`;
}

function toggleReactPicker(postId, event){
  if(event) event.stopPropagation(); // Chặn bubble lên document → tránh tự đóng ngay
  const picker = document.getElementById('react-picker-'+postId);
  if(!picker) return;
  const showing = picker.style.display === 'flex';
  document.querySelectorAll('[id^="react-picker-"]').forEach(el=>el.style.display='none');
  if(!showing) picker.style.display = 'flex';
}
document.addEventListener('click', (e)=>{
  if(!e.target.closest('[id^="react-picker-"]')) // Chỉ đóng khi click ra ngoài
    document.querySelectorAll('[id^="react-picker-"]').forEach(el=>el.style.display='none');
});

async function reactPost(postId, emoji){
  document.querySelectorAll('[id^="react-picker-"]').forEach(el=>el.style.display='none');
  try{
    await fetch(`/api/posts/${postId}/react`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
      body:JSON.stringify({emoji})
    });
    // Update reaction tại chỗ, không reload cả feed
    const cached = _postsCache.find(p=>p.id===postId);
    if(cached){
      // Toggle: nếu đã react emoji này thì bỏ, ngược lại thêm vào
      if(!cached.reactions) cached.reactions={};
      // Xóa user khỏi tất cả emoji cũ
      Object.keys(cached.reactions).forEach(e=>{
        cached.reactions[e] = (cached.reactions[e]||[]).filter(u=>u!==CURRENT_USER);
      });
      // Nếu emoji khác với emoji cũ thì thêm mới
      const hadEmoji = Object.entries(cached.reactions).find(([,u])=>u.includes(CURRENT_USER))?.[0];
      if(hadEmoji !== emoji){
        if(!cached.reactions[emoji]) cached.reactions[emoji]=[];
        cached.reactions[emoji].push(CURRENT_USER);
      }
      // Re-render chỉ card đó
      const card = document.getElementById('post-card-'+postId);
      if(card){
        const newCard = document.createElement('div');
        newCard.innerHTML = renderPostCard(cached, true);
        const newEl = newCard.firstElementChild;
        card.replaceWith(newEl);
      }
    } else {
      // Không có cache thì mới reload
      if(_postsTabActive==='feed'){ _postPage=0; _postsCache=[]; await loadPostsFeed(true); }
    }
    if(_activePostId===postId) openViewPost(postId);
  }catch{}
}

async function adminDeletePost(postId){
  if(!confirm('Xóa bài viết này?')) return;
  try{
    await fetch(`/api/admin/posts/${postId}`,{method:'DELETE',headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const card = document.getElementById('post-card-'+postId);
    if(card) card.remove();
    _postsCache = _postsCache.filter(p=>p.id!==postId);
    showToast('🗑 Đã xóa bài viết','#ff5050');
  }catch{}
}

// ── Pending posts (admin) ──
async function loadPendingPosts(){
  const el = document.getElementById('posts-feed-content');
  if(el) el.innerHTML='<div style="text-align:center;color:var(--muted);padding:30px">⏳ Đang tải...</div>';
  const moreRow = document.getElementById('posts-load-more-row');
  if(moreRow) moreRow.style.display='none';
  try{
    const r = await fetch('/api/admin/posts/pending',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    const posts = await r.json();
    const badge = document.getElementById('posts-pending-count');
    if(badge) badge.textContent = posts.length || '';
    if(!posts.length){ if(el) el.innerHTML='<div style="text-align:center;color:var(--muted);padding:40px">✅ Không có bài chờ duyệt</div>'; return; }
    if(el) el.innerHTML = posts.map(p=>`
      <div style="background:var(--glass);border:1px solid rgba(255,215,64,.25);border-radius:18px;padding:14px" id="pend-${p.id}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#4f9eff,#7c4dff);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff">${p.author[0].toUpperCase()}</div>
          <div><div style="font-size:13px;font-weight:700">${p.author}</div><div style="font-size:11px;color:var(--muted)">${p.created}</div></div>
        </div>
        ${p.text?`<div style="font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;margin-bottom:10px">${escapeHtml(p.text)}</div>`:''}
        ${p.media&&p.media.length?`<div style="font-size:12px;color:var(--muted);margin-bottom:8px">📎 ${p.media.length} file đính kèm</div>`:''}
        <div style="display:flex;gap:8px">
          <button onclick="reviewPost('${p.id}','approve')" style="flex:1;padding:8px;border-radius:10px;border:none;cursor:pointer;font-size:13px;font-weight:800;background:linear-gradient(135deg,#00c853,#00e676);color:#000">✅ Duyệt</button>
          <button onclick="reviewPost('${p.id}','reject')" style="flex:1;padding:8px;border-radius:10px;border:none;cursor:pointer;font-size:13px;font-weight:800;background:linear-gradient(135deg,#c62828,#ff5252);color:#fff">❌ Từ chối</button>
        </div>
      </div>`).join('');
  }catch{}
}

async function reviewPost(postId, action){
  try{
    await fetch('/api/admin/posts/review',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
      body:JSON.stringify({id:postId, action})
    });
    const el = document.getElementById('pend-'+postId);
    if(el){ el.style.opacity='.4'; el.style.pointerEvents='none'; }
    showToast(action==='approve'?'✅ Đã duyệt bài':'❌ Đã từ chối','#4f9eff');
    setTimeout(loadPendingPosts, 600);
  }catch{}
}

// ── Create Post ──
function openCreatePost(){
  _createPostMedia = [];
  const ta = document.getElementById('create-post-text');
  if(ta) ta.value='';
  const prev = document.getElementById('create-post-media-preview');
  if(prev) prev.innerHTML='';
  const err = document.getElementById('create-post-err');
  if(err) err.textContent='';
  const unEl = document.getElementById('create-post-username');
  if(unEl) unEl.textContent = CURRENT_USER;
  const avEl = document.getElementById('create-post-avatar');
  if(avEl){ avEl.textContent = IS_ADMIN ? '👑' : (CURRENT_USER||'?')[0].toUpperCase(); }
  openModal('create-post-modal');
}

function handlePostMediaAdd(input){
  if(!input.files) return;
  const maxSize = 8*1024*1024; // 8MB
  Array.from(input.files).forEach(file=>{
    if(_createPostMedia.length >= 5){ showToast('Tối đa 5 file','#ff9800'); return; }
    if(file.size > maxSize){ showToast('File quá lớn (>8MB)','#ff5050'); return; }
    const reader = new FileReader();
    reader.onload = e=>{
      const type = file.type.startsWith('video') ? 'video' : 'image';
      _createPostMedia.push({type, data:e.target.result, name:file.name});
      renderCreatePostMediaPreview();
    };
    reader.readAsDataURL(file);
  });
  input.value='';
}
function handlePostFileAdd(input){
  if(!input.files) return;
  const maxSize = 10*1024*1024;
  Array.from(input.files).forEach(file=>{
    if(_createPostMedia.length >= 5){ showToast('Tối đa 5 file','#ff9800'); return; }
    if(file.size > maxSize){ showToast('File quá lớn (>10MB)','#ff5050'); return; }
    const reader = new FileReader();
    reader.onload = e=>{
      _createPostMedia.push({type:'file', data:e.target.result, name:file.name});
      renderCreatePostMediaPreview();
    };
    reader.readAsDataURL(file);
  });
  input.value='';
}

function renderCreatePostMediaPreview(){
  const el = document.getElementById('create-post-media-preview');
  if(!el) return;
  el.innerHTML = _createPostMedia.map((m,i)=>{
    const thumb = m.type==='image'
      ? `<img src="${m.data}" style="width:70px;height:70px;object-fit:cover;border-radius:10px">`
      : m.type==='video'
        ? `<div style="width:70px;height:70px;background:#111;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:24px">🎬</div>`
        : `<div style="width:70px;height:70px;background:var(--glass2);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:20px;gap:2px"><span>📎</span><span style="font-size:8px;color:var(--muted);overflow:hidden;width:60px;text-align:center;white-space:nowrap;text-overflow:ellipsis">${m.name||'file'}</span></div>`;
    return `<div style="position:relative;flex-shrink:0">${thumb}<button onclick="_createPostMedia.splice(${i},1);renderCreatePostMediaPreview()" style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:#ff5050;border:none;color:#fff;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:700">×</button></div>`;
  }).join('');
}

async function submitCreatePost(){
  const text = (document.getElementById('create-post-text')?.value||'').trim();
  const err = document.getElementById('create-post-err');
  if(!text && !_createPostMedia.length){ if(err) err.textContent='Bài viết không được để trống'; return; }
  const btn = document.getElementById('create-post-btn');
  if(btn){ btn.disabled=true; btn.textContent='Đang đăng...'; }
  try{
    const r = await fetch('/api/posts/create',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
      body:JSON.stringify({text, media:_createPostMedia})
    });
    const d = await r.json();
    closeModal('create-post-modal');
    if(d.status==='approved'){
      showToast('✅ Bài đăng đã được đăng!','#00c882');
      _postPage=0; _postsCache=[]; loadPostsFeed(true);
    } else {
      // Show pending approval notice modal
      showPendingApprovalNotice();
    }
  }catch(e){
    if(err) err.textContent = 'Lỗi: '+e.message;
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='🚀 Đăng bài'; }
  }
}

// ── View Post + Comments ──
async function openViewPost(postId){
  _activePostId = postId;
  _commentMediaData = null;
  const cm = document.getElementById('comment-media-preview');
  if(cm) cm.innerHTML='';
  const ct = document.getElementById('comment-text-input');
  if(ct) ct.value='';
  openModal('view-post-modal');
  await refreshViewPost();
}

async function refreshViewPost(){
  const el = document.getElementById('view-post-content');
  if(!el) return;
  // Get post from cache or re-fetch
  let post = _postsCache.find(p=>p.id===_activePostId);
  if(!post){
    try{
      // Tìm qua từng page thay vì ghi đè cache
      let found = false;
      for(let pg=0; pg<=5; pg++){
        const r = await fetch(`/api/posts?page=${pg}`,{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
        const d = await r.json();
        // Merge vào cache, không ghi đè
        d.posts.forEach(p=>{ if(!_postsCache.find(x=>x.id===p.id)) _postsCache.push(p); });
        post = _postsCache.find(p=>p.id===_activePostId);
        if(post || !d.has_more){ found=true; break; }
      }
    }catch{}
  }
  if(!post){ el.innerHTML='<div style="padding:20px;text-align:center;color:var(--muted)">Không tìm thấy bài viết</div>'; return; }

  const comments = post.comments||[];
  const postHtml = renderPostCard(post, false);

  const commentsHtml = comments.length
    ? comments.map(c=>{
        const isAdminCmt = c.is_admin;
        const authorDisplay = isAdminCmt
          ? `<span style="font-weight:800;color:#ffd740">${c.author}</span><span style="background:linear-gradient(135deg,#ffd740,#ff9800);color:#000;font-size:8px;font-weight:900;padding:1px 6px;border-radius:20px;margin-left:4px">VIP</span>`
          : `<span style="font-weight:700">${c.author}</span>`;
        const avatarBg = isAdminCmt ? 'linear-gradient(135deg,#ffd740,#ff9800)' : 'linear-gradient(135deg,#4f9eff,#7c4dff)';
        const avatarContent = isAdminCmt ? '👑' : c.author[0].toUpperCase();
        let mediaHtml = '';
        if(c.media&&c.media.length) c.media.forEach(m=>{
          if(m.type==='image') mediaHtml+=`<img src="${m.data}" style="max-width:200px;max-height:150px;border-radius:10px;margin-top:6px;cursor:pointer;display:block" onclick="openLightbox(this.src)">`;
          else if(m.type==='video') mediaHtml+=`<div style="position:relative;margin-top:6px;cursor:pointer;border-radius:10px;overflow:hidden;display:inline-block" onclick="openLightbox('${m.data}','video')"><video style="max-width:200px;max-height:150px;display:block;pointer-events:none"><source src="${m.data}"></video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.3)"><div style="width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font-size:18px">▶</div></div></div>`;
          else mediaHtml+=`<div style="display:inline-flex;align-items:center;gap:5px;padding:8px 12px;background:var(--glass2);border-radius:8px;margin-top:6px;cursor:pointer;font-size:12px" onclick="downloadBase64('${m.data}','${m.name}')">📎 ${m.name||'file'} <span style="color:var(--muted)">💾</span></div>`;
        });
        const adminDel = IS_ADMIN ? `<button onclick="adminDeleteComment('${post.id}','${c.id}')" style="background:none;border:none;cursor:pointer;color:#ff5050;font-size:11px;margin-left:8px">🗑</button>` : '';
        const highlight = isAdminCmt ? 'border:1px solid rgba(255,215,64,.3);background:rgba(255,215,64,.05)' : 'border:1px solid var(--border)';
        return `<div style="display:flex;gap:8px;align-items:flex-start" id="cmt-${c.id}">
          <div style="width:32px;height:32px;border-radius:50%;background:${avatarBg};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0">${avatarContent}</div>
          <div style="flex:1;min-width:0">
            <div style="background:var(--glass2);${highlight};border-radius:12px;padding:9px 12px">
              <div style="font-size:12px;margin-bottom:3px">${authorDisplay}${adminDel}</div>
              ${c.text?`<div style="font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word">${escapeHtml(c.text)}</div>`:''}
              ${mediaHtml}
            </div>
            <div style="font-size:10px;color:var(--muted);margin-top:3px;padding-left:4px">${c.time||''}</div>
          </div>
        </div>`;
      }).join('')
    : '<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px 0">Chưa có bình luận nào. Hãy là người đầu tiên!</div>';

  el.innerHTML = postHtml + '<div style="height:1px;background:var(--border);margin:4px 0"></div>' + commentsHtml;
  el.scrollTop = el.scrollHeight;
}

function handleCommentMedia(input){
  if(!input.files||!input.files[0]) return;
  const file = input.files[0];
  if(file.size > 8*1024*1024){ showToast('File quá lớn (>8MB)','#ff5050'); return; }
  const reader = new FileReader();
  reader.onload = e=>{
    const type = file.type.startsWith('video')?'video':file.type.startsWith('image')?'image':'file';
    _commentMediaData = {type, data:e.target.result, name:file.name};
    const prev = document.getElementById('comment-media-preview');
    if(prev){
      const thumb = type==='image'?`<img src="${e.target.result}" style="height:50px;border-radius:8px;cursor:pointer" onclick="openLightbox(this.src)">`:`<span style="font-size:12px;color:var(--blue)">📎 ${file.name}</span>`;
      prev.innerHTML=`<div style="display:flex;align-items:center;gap:6px">${thumb}<button onclick="_commentMediaData=null;this.parentElement.parentElement.innerHTML=''" style="background:none;border:none;color:#ff5050;cursor:pointer;font-size:16px">×</button></div>`;
    }
  };
  reader.readAsDataURL(file);
  input.value='';
}

async function submitComment(){
  const text = (document.getElementById('comment-text-input')?.value||'').trim();
  if(!text && !_commentMediaData) return;
  const ct = document.getElementById('comment-text-input');
  if(ct){ ct.value=''; ct.style.height='auto'; }
  const media = _commentMediaData ? [_commentMediaData] : [];
  _commentMediaData = null;
  const prev = document.getElementById('comment-media-preview');
  if(prev) prev.innerHTML='';
  try{
    const res = await fetch(`/api/posts/${_activePostId}/comment`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},
      body:JSON.stringify({text, media})
    });
    const rd = await res.json();
    // Chỉ update bài đang xem trong cache, không fetch lại → không ghi đè page khác
    if(rd.ok && rd.comment){
      const idx = _postsCache.findIndex(p=>p.id===_activePostId);
      if(idx !== -1){
        _postsCache[idx].comments = _postsCache[idx].comments || [];
        _postsCache[idx].comments.push(rd.comment);
      }
    }
    await refreshViewPost();
  }catch{}
}

async function adminDeleteComment(postId, commentId){
  try{
    await fetch(`/api/admin/posts/${postId}/comments/${commentId}`,{method:'DELETE',headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    // Xóa khỏi DOM ngay
    const cmt = document.getElementById('cmt-'+commentId);
    if(cmt) cmt.remove();
    // Chỉ update cache bài đang xem, không ghi đè toàn bộ
    const idx = _postsCache.findIndex(p=>p.id===postId);
    if(idx !== -1){
      _postsCache[idx].comments = (_postsCache[idx].comments||[]).filter(c=>c.id!==commentId);
    }
  }catch{}
}

function escapeHtml(t){ return (t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function downloadBase64(data, name){
  const a = document.createElement('a');
  a.href = data; a.download = name||'file'; a.click();
}

// Auto-resize comment textarea
document.addEventListener('DOMContentLoaded',()=>{
  const cta = document.getElementById('comment-text-input');
  if(cta) cta.addEventListener('input',function(){ this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,80)+'px'; });
  const cpta = document.getElementById('create-post-text');
  if(cpta) cpta.addEventListener('input',function(){ this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,240)+'px'; });
});

function showPendingApprovalNotice(){
  openModal('pending-approval-modal');
}
