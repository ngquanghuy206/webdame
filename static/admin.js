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
    _adminChatTabOpen = true;
    loadAdminChatThreads();
    _startAdminChatPoll();
  } else {
    _adminChatTabOpen = false;
    _stopAdminChatPoll();
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

