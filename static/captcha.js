// ═══════════════════════════════════════════════════════
//  CAPTCHA ENGINE
// ═══════════════════════════════════════════════════════
let captchaAnswer = null, captchaType = null;
const CAPTCHA_TYPES = ['math_add','math_sub','math_mul','pick_animal','pick_fruit','pick_color','drag_order','canvas_text','odd_one_out','emoji_count'];
function randomInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }

function generateCaptcha(){
  captchaAnswer = null;
  const type = CAPTCHA_TYPES[randomInt(0, CAPTCHA_TYPES.length-1)];
  captchaType  = type;
  const box = document.getElementById('captcha-content');
  const qEl  = document.getElementById('captcha-q');

  if(type==='math_add'||type==='math_sub'||type==='math_mul'){
    const a=randomInt(1,20),b=randomInt(1,20);
    const op=type==='math_add'?'+':type==='math_sub'?'-':'×';
    const ans=type==='math_add'?a+b:type==='math_sub'?a-b:a*b;
    captchaAnswer=String(ans);
    qEl.textContent=`🔢 Tính: ${a} ${op} ${b} = ?`;
    box.innerHTML=`<div class="captcha-input-row"><input class="captcha-input" id="cap-input" type="number" placeholder="Nhập kết quả"><button class="captcha-refresh" onclick="generateCaptcha()">🔄</button></div>`;
    return;
  }
  if(type==='canvas_text'){
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code='';for(let i=0;i<5;i++)code+=chars[randomInt(0,chars.length-1)];
    captchaAnswer=code;
    qEl.textContent='🖼 Nhập chính xác mã trong ảnh:';
    box.innerHTML=`<div class="captcha-input-row"><canvas id="cap-canvas" class="captcha-canvas" width="220" height="60"></canvas><button class="captcha-refresh" onclick="generateCaptcha()">🔄</button></div><div class="captcha-input-row" style="margin-top:8px"><input class="captcha-input" id="cap-input" type="text" maxlength="5" placeholder="5 ký tự" style="text-transform:uppercase"></div>`;
    setTimeout(()=>{
      const canvas=document.getElementById('cap-canvas');if(!canvas)return;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#1a2040';ctx.fillRect(0,0,220,60);
      for(let i=0;i<6;i++){ctx.strokeStyle=`hsl(${randomInt(0,360)},50%,50%)`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(randomInt(0,220),randomInt(0,60));ctx.lineTo(randomInt(0,220),randomInt(0,60));ctx.stroke();}
      for(let i=0;i<30;i++){ctx.fillStyle=`rgba(${randomInt(100,255)},${randomInt(100,255)},${randomInt(100,255)},0.5)`;ctx.fillRect(randomInt(0,220),randomInt(0,60),2,2);}
      const colors=['#4f9eff','#00e5ff','#ffd740','#00e676','#ff9100'];
      for(let i=0;i<code.length;i++){ctx.font=`bold ${randomInt(26,32)}px monospace`;ctx.fillStyle=colors[i%colors.length];ctx.save();ctx.translate(20+i*38,randomInt(38,46));ctx.rotate((randomInt(-15,15)*Math.PI)/180);ctx.fillText(code[i],0,0);ctx.restore();}
    },100);return;
  }
  if(type==='pick_animal'){
    const animals=[['🐶','Chó'],['🐱','Mèo'],['🐭','Chuột'],['🐰','Thỏ'],['🦊','Cáo'],['🐼','Gấu trúc'],['🐯','Hổ'],['🦁','Sư tử'],['🐸','Ếch'],['🐧','Chim cánh cụt']];
    const pick=animals[randomInt(0,animals.length-1)];captchaAnswer=pick[0];qEl.textContent=`🐾 Chọn con vật: ${pick[1]}`;
    const shuffled=[...animals].sort(()=>Math.random()-.5).slice(0,6);if(!shuffled.find(a=>a[0]===pick[0]))shuffled[0]=pick;shuffled.sort(()=>Math.random()-.5);
    box.innerHTML=`<div class="captcha-options">${shuffled.map(a=>`<div class="captcha-opt" onclick="selectOpt(this,'${a[0]}')">${a[0]} ${a[1]}</div>`).join('')}</div><button class="captcha-refresh" style="margin-top:8px;width:100%" onclick="generateCaptcha()">🔄 Đổi câu hỏi</button>`;return;
  }
  if(type==='pick_fruit'){
    const fruits=[['🍎','Táo'],['🍌','Chuối'],['🍇','Nho'],['🍊','Cam'],['🍓','Dâu'],['🍋','Chanh'],['🥝','Kiwi'],['🍑','Đào'],['🍉','Dưa hấu'],['🍍','Dứa']];
    const pick=fruits[randomInt(0,fruits.length-1)];captchaAnswer=pick[0];qEl.textContent=`🍒 Chọn loại quả: ${pick[1]}`;
    const shuffled=[...fruits].sort(()=>Math.random()-.5).slice(0,6);if(!shuffled.find(a=>a[0]===pick[0]))shuffled[0]=pick;shuffled.sort(()=>Math.random()-.5);
    box.innerHTML=`<div class="captcha-options">${shuffled.map(a=>`<div class="captcha-opt" onclick="selectOpt(this,'${a[0]}')">${a[0]} ${a[1]}</div>`).join('')}</div><button class="captcha-refresh" style="margin-top:8px;width:100%" onclick="generateCaptcha()">🔄 Đổi câu hỏi</button>`;return;
  }
  if(type==='pick_color'){
    const colors=[['🔴','Đỏ'],['🔵','Xanh dương'],['🟢','Xanh lá'],['🟡','Vàng'],['🟠','Cam'],['🟣','Tím'],['⚫','Đen'],['⚪','Trắng']];
    const pick=colors[randomInt(0,colors.length-1)];captchaAnswer=pick[0];qEl.textContent=`🎨 Chọn màu: ${pick[1]}`;
    const shuffled=[...colors].sort(()=>Math.random()-.5).slice(0,4);if(!shuffled.find(a=>a[0]===pick[0]))shuffled[0]=pick;shuffled.sort(()=>Math.random()-.5);
    box.innerHTML=`<div class="captcha-options">${shuffled.map(a=>`<div class="captcha-opt" onclick="selectOpt(this,'${a[0]}')">${a[0]} ${a[1]}</div>`).join('')}</div><button class="captcha-refresh" style="margin-top:8px;width:100%" onclick="generateCaptcha()">🔄 Đổi câu hỏi</button>`;return;
  }
  if(type==='odd_one_out'){
    const groups=[
      {q:'Tìm đồ vật KHÔNG phải phương tiện giao thông',correct:'🍎',opts:['🚗','🏍','🍎','✈️','🚢','🚲']},
      {q:'Tìm thứ KHÔNG phải con số',correct:'A',opts:['1','5','A','3','7','9']},
      {q:'Tìm thứ KHÔNG phải đồ ăn',correct:'📱',opts:['🍕','🍔','📱','🍣','🍜','🍦']},
      {q:'Tìm thứ KHÔNG phải màu sắc',correct:'🔔',opts:['🔴','🔵','🟢','🔔','🟡','🟣']},
      {q:'Tìm thứ KHÔNG phải loài hoa',correct:'🐟',opts:['🌹','🌸','🐟','🌻','🌺','🌼']},
    ];
    const g=groups[randomInt(0,groups.length-1)];captchaAnswer=g.correct;qEl.textContent='🔍 '+g.q;
    const opts=[...g.opts].sort(()=>Math.random()-.5);
    box.innerHTML=`<div class="captcha-options">${opts.map(o=>`<div class="captcha-opt" onclick="selectOpt(this,'${o}')">${o}</div>`).join('')}</div><button class="captcha-refresh" style="margin-top:8px;width:100%" onclick="generateCaptcha()">🔄 Đổi câu hỏi</button>`;return;
  }
  if(type==='emoji_count'){
    const emojis=['⭐','❤️','🔥','💎','🎯'];const em=emojis[randomInt(0,emojis.length-1)];const count=randomInt(2,8);
    captchaAnswer=String(count);qEl.textContent=`🔢 Đếm số ${em} trong hình:`;
    const noises=['🌀','💫','✨','🎪','🎭','🎨'];let items=Array(count).fill(em);
    for(let i=0;i<randomInt(3,6);i++)items.push(noises[randomInt(0,noises.length-1)]);
    items.sort(()=>Math.random()-.5);
    box.innerHTML=`<div style="font-size:22px;letter-spacing:4px;text-align:center;padding:10px 0;line-height:1.8">${items.join(' ')}</div><div class="captcha-input-row"><input class="captcha-input" id="cap-input" type="number" placeholder="Nhập số lượng" min="1"><button class="captcha-refresh" onclick="generateCaptcha()">🔄</button></div>`;return;
  }
  if(type==='drag_order'){
    const seqs=[
      {q:'Chọn số tiếp theo: 2, 4, 6, ?',items:['7','8','9','10'],answer:'8'},
      {q:'Chọn số tiếp theo: 1, 3, 5, ?',items:['6','7','8','9'],answer:'7'},
      {q:'Chọn số tiếp theo: 10, 20, 30, ?',items:['35','40','45','50'],answer:'40'},
      {q:'Chọn số tiếp theo: 5, 10, 15, ?',items:['18','20','22','25'],answer:'20'},
      {q:'Chọn số tiếp theo: 3, 6, 9, ?',items:['10','11','12','13'],answer:'12'},
    ];
    const seq=seqs[randomInt(0,seqs.length-1)];captchaAnswer=seq.answer;qEl.textContent='📊 '+seq.q;
    const opts=[...seq.items].sort(()=>Math.random()-.5);
    box.innerHTML=`<div class="captcha-options">${opts.map(o=>`<div class="captcha-opt" onclick="selectOpt(this,'${o}')">${o}</div>`).join('')}</div><button class="captcha-refresh" style="margin-top:8px;width:100%" onclick="generateCaptcha()">🔄 Đổi câu hỏi</button>`;return;
  }
  // fallback
  captchaType='math_add';const a=randomInt(1,20),b=randomInt(1,20);captchaAnswer=String(a+b);
  qEl.textContent=`🔢 Tính: ${a} + ${b} = ?`;
  box.innerHTML=`<div class="captcha-input-row"><input class="captcha-input" id="cap-input" type="number" placeholder="Nhập kết quả"><button class="captcha-refresh" onclick="generateCaptcha()">🔄</button></div>`;
}

let selectedOptValue = null;
function selectOpt(el,val){
  document.querySelectorAll('#captcha-content .captcha-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected'); selectedOptValue=val;
}
function verifyCaptcha(){
  if(!captchaAnswer) return false;
  if(['math_add','math_sub','math_mul','emoji_count'].includes(captchaType)){
    const inp=document.getElementById('cap-input');return inp&&String(inp.value.trim())===captchaAnswer;
  }
  if(captchaType==='canvas_text'){const inp=document.getElementById('cap-input');return inp&&inp.value.trim().toUpperCase()===captchaAnswer;}
  return selectedOptValue===captchaAnswer;
}

