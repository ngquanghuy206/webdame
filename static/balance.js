// ═══════════════════════════════════════════════════════
//  BALANCE DISPLAY
// ═══════════════════════════════════════════════════════
let CURRENT_BALANCE = 0;
function fmtMoney(n){
  return Number(n||0).toLocaleString('vi-VN') + ' VND';
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

