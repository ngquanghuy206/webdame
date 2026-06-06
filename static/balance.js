// ═══════════════════════════════════════════════════════
//  BALANCE DISPLAY
// ═══════════════════════════════════════════════════════
let CURRENT_BALANCE = 0;
function fmtMoney(n){
  if(n>=1000000) return (n/1000000).toFixed(n%1000000===0?0:1)+'M đ';
  if(n>=1000) return (n/1000).toFixed(n%1000===0?0:1)+'K đ';
  return n.toLocaleString('vi-VN')+'đ';
}
function updateBalanceDisplay(bal){
  CURRENT_BALANCE = bal||0;
  const sb = document.getElementById('sb-balance-el');
  if(sb) sb.textContent = '💰 '+fmtMoney(CURRENT_BALANCE);
}
async function refreshBalance(){
  try{
    const r = await fetch('/api/me',{headers:{'Authorization':'Bearer '+SESSION_TOKEN}});
    if(r.ok){ const d=await r.json(); updateBalanceDisplay(d.balance||0); }
  }catch{}
}

