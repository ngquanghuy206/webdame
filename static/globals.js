// ═══════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════
let rememberMe    = localStorage.getItem('zct_remember') === '1';
let SESSION_TOKEN = rememberMe ? (localStorage.getItem('zct_token')||'') : (sessionStorage.getItem('zct_token')||'');
let CURRENT_USER  = rememberMe ? (localStorage.getItem('zct_user')||'')  : (sessionStorage.getItem('zct_user')||'');
let IS_ADMIN      = rememberMe ? localStorage.getItem('zct_admin')==='1' : sessionStorage.getItem('zct_admin')==='1';
if(SESSION_TOKEN){document.cookie=`session_token=${SESSION_TOKEN};path=/;SameSite=Lax;max-age=${rememberMe?60*60*24*30:60*60*8}`;}
let currentData = null, viewingHistItem = null;

// Dame state
let dameRunning = false, damePaused = false, dameStop = false;
let dameTotal = 0, dameLoops = 0, dameStartTime = null, dameTimer = null;
let dameWin = null; // cửa sổ FB mở

