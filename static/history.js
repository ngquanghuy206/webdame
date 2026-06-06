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

