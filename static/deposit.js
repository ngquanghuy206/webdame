// ═══════════════════════════════════════════════════════
//  DEPOSIT (NẠP TIỀN)
// ═══════════════════════════════════════════════════════
let _depSelectedAmt = 0;
function openDepositModal(){
  _depSelectedAmt=0;
  document.querySelectorAll('.dep-amt-btn').forEach(function(b){b.classList.remove('selected');});
  document.getElementById('dep-custom-amt').value='';
  document.getElementById('dep-selected-display').textContent='—';
  document.getElementById('dep-err1').textContent='';
  document.getElementById('dep-step1').style.display='block';
  document.getElementById('dep-step2').style.display='none';
  openModal('deposit-modal');
}
function selectDepAmt(btn,amt){
  document.querySelectorAll('.dep-amt-btn').forEach(function(b){b.classList.remove('selected');});
  btn.classList.add('selected');
  _depSelectedAmt=amt;
  document.getElementById('dep-custom-amt').value='';
  document.getElementById('dep-selected-display').textContent=fmtMoney(amt);
  document.getElementById('dep-err1').textContent='';
}
function onDepCustomInput(val){
  document.querySelectorAll('.dep-amt-btn').forEach(function(b){b.classList.remove('selected');});
  const n=parseInt(val)||0;
  _depSelectedAmt=n;
  document.getElementById('dep-selected-display').textContent=n>0?fmtMoney(n):'—';
}
async function doCreateDeposit(){
  const err=document.getElementById('dep-err1');
  if(!_depSelectedAmt||_depSelectedAmt<20000){err.textContent='Chọn hoặc nhập số tiền tối thiểu 20.000đ';return;}
  try{
    const r=await fetch('/api/deposit/create',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION_TOKEN},body:JSON.stringify({amount:_depSelectedAmt})});
    const d=await r.json();
    if(!r.ok) throw new Error(d.detail||'Lỗi tạo đơn');
    document.getElementById('dep-qr-img').src=d.qr_url;
    document.getElementById('dep-bank-name').textContent=d.bank_name;
    document.getElementById('dep-bank-num').textContent=d.bank_number;
    document.getElementById('dep-bank-owner').textContent=d.account_name;
    document.getElementById('dep-bank-amount').textContent=fmtMoney(d.amount);
    document.getElementById('dep-bank-content').textContent=d.content;
    document.getElementById('dep-step1').style.display='none';
    document.getElementById('dep-step2').style.display='block';
  }catch(ex){err.textContent='❌ '+ex.message;}
}
function copyDepContent(){
  const c=document.getElementById('dep-bank-content').textContent;
  navigator.clipboard.writeText(c).then(function(){showToast('✅ Đã copy nội dung CK','#00e676');}).catch(function(){});
}
function resetDepModal(){
  document.getElementById('dep-step1').style.display='block';
  document.getElementById('dep-step2').style.display='none';
  _depSelectedAmt=0;
  document.getElementById('dep-selected-display').textContent='—';
  document.querySelectorAll('.dep-amt-btn').forEach(function(b){b.classList.remove('selected');});
}

