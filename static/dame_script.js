// ==UserScript==
// @name         🐬 DZI MEO MEO | DZI X MODE | PRO V6.2
// @namespace    http://tampermonkey.net/
// @version      6.2
// @description  Dame acc FB - Auto Report + KÍCH NÚT META AI 🦅 | DZI X MODE PRO
// @author       Nguyễn Hoàng Khánh Nam
// @match        https://www.facebook.com/*
// @match        https://m.facebook.com/*
// @match        https://touch.facebook.com/*
// @match        https://mbasic.facebook.com/*
// @match        https://web.facebook.com/*
// @match        https://*.facebook.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const ADMIN_INFO = {
        name: "Nguyễn Hoàng Khánh Nam",
        dob: "30/05/2006",
        bio: "Chuyên gia bảo mật & Auto Tool | Dame acc Facebook tự động | KÍCH NÚT META AI 🦅",
        contacts: {
            tiktok: "hkhanhnam206",
            zalo: "0993329535",
            discord: "https://discord.gg/EfxaEFpfA",
            tele: "dzimeomeo"
        }
    };

    let antiSleepEnabled = true;
    let speedMode = "fast";
    let themeMode = "dark";
    let currentMode = "dame";
    
    let totalReportsDone = 0;
    let totalLoopsCompleted = 0;
    let totalKickAttempts = 0;
    let totalKickSuccess = 0;
    
    function getDelayConfig() {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (speedMode === "fast") {
            return {
                DELAY_TIME: isMobile ? 120 : 80,
                INPUT_DELAY: isMobile ? 500 : 350,
                WAIT_FOR_ACTION: isMobile ? 250 : 150,
                DONE_DELAY: 60,
                INTER_REPORT_DELAY: 150,
                LOOP_DELAY: 400,
                SCAN_INTERVAL: 800
            };
        } else if (speedMode === "normal") {
            return {
                DELAY_TIME: isMobile ? 200 : 150,
                INPUT_DELAY: isMobile ? 700 : 500,
                WAIT_FOR_ACTION: isMobile ? 400 : 300,
                DONE_DELAY: 120,
                INTER_REPORT_DELAY: 300,
                LOOP_DELAY: 700,
                SCAN_INTERVAL: 1200
            };
        } else {
            return {
                DELAY_TIME: isMobile ? 350 : 280,
                INPUT_DELAY: isMobile ? 1200 : 900,
                WAIT_FOR_ACTION: isMobile ? 700 : 550,
                DONE_DELAY: 200,
                INTER_REPORT_DELAY: 550,
                LOOP_DELAY: 1200,
                SCAN_INTERVAL: 1800
            };
        }
    }
    
    let config = getDelayConfig();
    
    function updateConfig() {
        config = getDelayConfig();
    }
    
    function resetState() {
        if (window._dameInterval) clearInterval(window._dameInterval);
        if (window._kickInterval) clearInterval(window._kickInterval);
        if (window._titleInterval) clearInterval(window._titleInterval);
        if (window._audioLoop) {
            window._audioLoop.pause();
            window._audioLoop = null;
        }
    }
    
    function getTheme() {
        if (themeMode === "dark") {
            return {
                bg: "linear-gradient(145deg, #0A1929 0%, #0D1F2D 100%)",
                headerBg: "linear-gradient(135deg,#0B1E33,#071523)",
                textColor: "#E0F2FE",
                accentColor: "#00BFFF",
                accentColor2: "#000000",
                accentColor2Light: "#333333",
                cardBg: "rgba(0,191,255,0.05)",
                borderColor: "rgba(0,191,255,0.3)",
                statusBg: "rgba(0,0,0,0.2)",
                contactBg: "rgba(0,191,255,0.08)",
                miniBg: "linear-gradient(145deg, #0B1E33, #06121F)",
                successColor: "#00FF88",
                warningColor: "#FFA500"
            };
        } else {
            return {
                bg: "linear-gradient(145deg, #FFFFFF 0%, #F5F7FF 100%)",
                headerBg: "linear-gradient(135deg,#F0F4FF,#E8EDFF)",
                textColor: "#1A3A5A",
                accentColor: "#0077B3",
                accentColor2: "#1A1A1A",
                accentColor2Light: "#555555",
                cardBg: "rgba(0,119,179,0.06)",
                borderColor: "rgba(0,119,179,0.2)",
                statusBg: "rgba(0,0,0,0.04)",
                contactBg: "rgba(0,119,179,0.04)",
                miniBg: "linear-gradient(145deg, #E8EDFF, #D6DFF5)",
                successColor: "#00AA55",
                warningColor: "#DD8800"
            };
        }
    }
    
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    
    function normalizeText(str) {
        return (str || "").trim().toLowerCase().replace(/\s+/g, " ");
    }
    
    function isInsidePanel(el) {
        return el && el.closest && (el.closest('#fb-auto-panel') !== null || el.closest('#fb-contact-panel') !== null);
    }
    
    async function safeClick(el, showEffect = true) {
        if (!el) return false;
        try {
            el.scrollIntoView({block: "center", inline: "center", behavior: "smooth"});
            if (el.hasAttribute('aria-hidden')) el.removeAttribute('aria-hidden');
            const theme = getTheme();
            if (showEffect) {
                el.style.transition = 'all 0.08s ease';
                el.style.transform = 'scale(0.98)';
                el.style.outline = `2px solid ${currentMode === 'dame' ? theme.accentColor : theme.accentColor2}`;
                el.style.outlineOffset = '2px';
            }
            el.focus();
            
            const opts = { bubbles: true, cancelable: true, view: window };
            el.dispatchEvent(new MouseEvent('pointerdown', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            await sleep(15);
            el.dispatchEvent(new MouseEvent('pointerup', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
            
            setTimeout(() => { if(el) { el.style.transform = ''; el.style.outline = ''; } }, 80);
            return true;
        } catch(e) { return false; }
    }
    
    async function findAndClick(texts, timeout = 4000, waitAfter = 150) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const selectors = ['button', 'div[role="button"]', 'a[role="button"]', 'span[role="button"]', 'div[role="menuitem"]', 'div[tabindex="0"]'];
            const elements = document.querySelectorAll(selectors.join(','));
            for (let el of elements) {
                if (!el.offsetParent || isInsidePanel(el)) continue;
                const txt = normalizeText(el.innerText);
                for (let kw of texts) {
                    if (txt === normalizeText(kw) || txt.includes(normalizeText(kw))) {
                        await safeClick(el);
                        await sleep(waitAfter);
                        return true;
                    }
                }
            }
            await sleep(120);
        }
        return false;
    }
    
    function findMenuElement() {
        const menuTexts = ["Profile settings see more options", "更多选项", "その他のオプション", "More options"];
        for (let lbl of menuTexts) {
            let el = document.querySelector(`[aria-label="${lbl}"]`);
            if (el && el.offsetParent && !isInsidePanel(el)) return el;
        }
        let allBtns = document.querySelectorAll('div[role="button"], button');
        for (let btn of allBtns) {
            if (!btn.offsetParent || isInsidePanel(btn)) continue;
            let txt = btn.innerText || "";
            if (txt.includes('その他') || txt.includes('Other') || txt.includes('More') || txt.includes('…') || txt.includes('...')) {
                return btn.closest('div[role="button"], button') || btn;
            }
        }
        return null;
    }
    
    async function clickMenu() {
        const menu = findMenuElement();
        if (menu) {
            await safeClick(menu);
            await sleep(300);
            return true;
        }
        return false;
    }
    
    const LANG = {
        reportProfile: ["Report profile", "Báo cáo trang cá nhân", "プロフィールを報告"],
        somethingAbout: ["Something about this profile", "Có gì đó về trang cá nhân này", "このプロフィールに関すること"],
        fakeProfile: ["Fake profile", "Trang cá nhân giả mạo", "偽プロフィール"],
        notRealPerson: ["not a real person", "không phải người thật", "実在しない人物である"],
        celebrity: ["celebrity", "public figure", "Người nổi tiếng", "有名人・著名人"],
        under18: ["under 18", "dưới 18", "18歳未満"],
        physicalAbuse: ["Physical abuse", "Bạo hành thể chất", "身体的虐待"],
        violent: ["Violent", "Bạo lực", "暴力的"],
        credibleThreat: ["Credible threat", "Đe dọa đáng tin", "信頼できる脅威"],
        scamFraud: ["Scam", "fraud", "Lừa đảo", "詐欺"],
        fraudOrScam: ["Fraud or scam", "Lừa đảo hoặc gian lận", "詐欺行為"],
        spam: ["Spam", "Tin rác", "スパム"],
        somethingElse: ["Something else", "Điều gì đó khác", "その他"],
        suicideOrSelfHarm: ["Suicide or self-harm", "Tự tử hoặc tự làm hại", "自殺または自傷行為"],
        adultContent: ["Adult content", "Nội dung người lớn", "成人向け"],
        submit: ["Submit", "Gửi", "送信", "Gửi báo cáo"],
        done: ["Done", "Xong", "完了", "Close", "Đóng"],
        next: ["Next", "Tiếp", "次へ", "Tiếp tục"],
        terrorism: ["Seems like terrorism", "Có vẻ là khủng bố", "テロリズム"],
        callingForViolence: ["Calling for violence", "Kêu gọi bạo lực", "暴力を呼びかけ"],
        organizedCrime: ["Seems like organized crime", "Tội phạm có tổ chức", "組織的犯罪"],
        eatingDisorder: ["Eating disorder", "Rối loạn ăn uống", "摂食障害"],
        harassment: ["Bullying or harassment", "Bắt nạt hoặc quấy rối", "いじめ"],
        adultProstitution: ["Seems like prostitution", "Mại dâm", "売春"],
        supportKeywords: ["Nhận hỗ trợ", "nhận hỗ trợ", "Contact Support", "Get support", "Hỗ trợ", "Support", "Liên hệ hỗ trợ"]
    };
    
    const INPUT_XPATH = "//*[@aria-label=\"Facebook Page name or URL\" or @aria-label=\"Facebookページ名またはURL\"]";
    const getElementByXpath = (path) => { if (!path) return null; try { return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; } catch(e) { return null; } };
    
    async function clickMetaResult() {
        for (let retry = 4; retry > 0; retry--) {
            let options = document.querySelectorAll('div[role="listbox"] span, ul[role="listbox"] span, div[role="presentation"] span');
            for (let span of options) {
                if (!span.offsetParent || isInsidePanel(span)) continue;
                if (span.innerText.trim() === "Meta") {
                    await safeClick(span);
                    await sleep(1000);
                    return true;
                }
            }
            let imgs = document.querySelectorAll('div[role="listbox"] img');
            if (imgs.length > 0) {
                await safeClick(imgs[0]);
                await sleep(1000);
                return true;
            }
            if (retry === 2 || retry === 1) {
                let inp = getElementByXpath(INPUT_XPATH);
                if (inp) {
                    inp.focus();
                    inp.value = "Meta ";
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    await sleep(1500);
                }
            }
            await sleep(500);
        }
        return false;
    }
    
    async function findAndClickSomethingElse() {
        let all = document.querySelectorAll('div[role="button"], button, span');
        for (let el of all) {
            if (!el.offsetParent || isInsidePanel(el)) continue;
            let txt = normalizeText(el.innerText);
            for (let k of LANG.somethingElse) {
                if (txt === normalizeText(k) || txt.includes(normalizeText(k))) {
                    await safeClick(el);
                    await sleep(300);
                    return true;
                }
            }
        }
        return false;
    }
    
    const reportTypes = [
        { name: "Violent - Terrorism", steps: [
            { type: "menu" }, { type: "click", texts: LANG.reportProfile }, { type: "optional", texts: LANG.somethingAbout },
            { type: "click", texts: LANG.violent }, { type: "click", texts: LANG.terrorism },
            { type: "action", texts: LANG.submit }, { type: "action", texts: LANG.next }, { type: "done", texts: LANG.done }
        ] },
        { name: "Violent - Calling for violence", steps: [
            { type: "menu" }, { type: "click", texts: LANG.reportProfile }, { type: "optional", texts: LANG.somethingAbout },
            { type: "click", texts: LANG.violent }, { type: "click", texts: LANG.callingForViolence },
            { type: "action", texts: LANG.submit }, { type: "action", texts: LANG.next }, { type: "done", texts: LANG.done }
        ] },
        { name: "Violent - Organized crime", steps: [
            { type: "menu" }, { type: "click", texts: LANG.reportProfile }, { type: "optional", texts: LANG.somethingAbout },
            { type: "click", texts: LANG.violent }, { type: "click", texts: LANG.organizedCrime },
            { type: "action", texts: LANG.submit }, { type: "action", texts: LANG.next }, { type: "done", texts: LANG.done }
        ] },
        { name: "Suicide - Eating disorder", steps: [
            { type: "menu" }, { type: "click", texts: LANG.reportProfile }, { type: "optional", texts: LANG.somethingAbout },
            { type: "click", texts: LANG.suicideOrSelfHarm }, { type: "click", texts: LANG.eatingDisorder },
            { type: "action", texts: LANG.submit }, { type: "action", texts: LANG.next }, { type: "done", texts: LANG.done }
        ] },
        { name: "Scam - Fraud or scam", steps: [
            { type: "menu" }, { type: "click", texts: LANG.reportProfile }, { type: "optional", texts: LANG.somethingAbout },
            { type: "click", texts: LANG.scamFraud }, { type: "click", texts: LANG.fraudOrScam },
            { type: "action", texts: LANG.submit }, { type: "action", texts: LANG.next }, { type: "done", texts: LANG.done }
        ] },
        { name: "Scam - Spam", steps: [
            { type: "menu" }, { type: "click", texts: LANG.reportProfile }, { type: "optional", texts: LANG.somethingAbout },
            { type: "click", texts: LANG.scamFraud }, { type: "click", texts: LANG.spam }, { type: "done", texts: LANG.done }
        ] },
        { name: "Celebrity", steps: [
            { type: "menu" }, { type: "click", texts: LANG.reportProfile }, { type: "optional", texts: LANG.somethingAbout },
            { type: "click", texts: LANG.fakeProfile }, { type: "click", texts: LANG.celebrity },
            { type: "input" }, { type: "meta" },
            { type: "action", texts: LANG.next }, { type: "action", texts: LANG.submit },
            { type: "action", texts: LANG.next }, { type: "done", texts: LANG.done }
        ] },
        { name: "Fake - Not a real person", steps: [
            { type: "menu" }, { type: "click", texts: LANG.reportProfile }, { type: "optional", texts: LANG.somethingAbout },
            { type: "click", texts: LANG.fakeProfile }, { type: "click", texts: LANG.notRealPerson },
            { type: "action", texts: LANG.submit }, { type: "action", texts: LANG.next }, { type: "done", texts: LANG.done }
        ] },
        { name: "Something else", steps: [
            { type: "menu" }, { type: "click", texts: LANG.reportProfile }, { type: "optional", texts: LANG.somethingAbout },
            { type: "somethingElse" }, { type: "done", texts: LANG.done }
        ] },
        { name: "Bullying - Harassment", steps: [
            { type: "menu" }, { type: "click", texts: LANG.reportProfile }, { type: "optional", texts: LANG.somethingAbout },
            { type: "click", texts: LANG.under18 }, { type: "click", texts: LANG.harassment },
            { type: "action", texts: LANG.submit }, { type: "action", texts: LANG.next }, { type: "done", texts: LANG.done }
        ] },
        { name: "Adult - Prostitution", steps: [
            { type: "menu" }, { type: "click", texts: LANG.reportProfile }, { type: "optional", texts: LANG.somethingAbout },
            { type: "click", texts: LANG.adultContent }, { type: "click", texts: LANG.adultProstitution },
            { type: "action", texts: LANG.submit }, { type: "action", texts: LANG.next }, { type: "done", texts: LANG.done }
        ] },
        { name: "Physical abuse", steps: [
            { type: "menu" }, { type: "click", texts: LANG.reportProfile }, { type: "optional", texts: LANG.somethingAbout },
            { type: "click", texts: LANG.under18 }, { type: "click", texts: LANG.physicalAbuse },
            { type: "action", texts: LANG.submit }, { type: "action", texts: LANG.next }, { type: "done", texts: LANG.done }
        ] },
        { name: "Credible threat", steps: [
            { type: "menu" }, { type: "click", texts: LANG.reportProfile }, { type: "optional", texts: LANG.somethingAbout },
            { type: "click", texts: LANG.violent }, { type: "click", texts: LANG.credibleThreat },
            { type: "action", texts: LANG.submit }, { type: "action", texts: LANG.next }, { type: "done", texts: LANG.done }
        ] }
    ];
    
    const SILENT_AUDIO = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD//////////////////////////////////////////////////////////////////wAAADFMYXZjNTguMzUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAIAAAAASAA8AxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAATGF2YzU4LjM1LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAATGF2YzU4LjM1LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAATGF2YzU4LjM1LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAATGF2YzU4LjM1LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAATGF2YzU4LjM1LjEwMAAAAAAAAAAAAAAA';
    
    function startAntiSleep() { 
        if(!window._audioLoop){ window._audioLoop = new Audio(SILENT_AUDIO); window._audioLoop.loop = true; window._audioLoop.volume = 0.01; } 
        window._audioLoop.play().catch(()=>{}); 
        let tick=false; 
        if(window._titleInterval) clearInterval(window._titleInterval); 
        window._titleInterval = setInterval(()=>{ 
            if(currentMode === 'dame') {
                document.title = tick ? `🐬 ${totalReportsDone}` : `🐬 DZI DAME`;
            } else {
                document.title = tick ? `🦅 ${totalKickSuccess}/${totalKickAttempts}` : `🦅 KÍCH NÚT META`;
            }
            tick = !tick; 
        },2000); 
    }
    
    function stopAntiSleep() { 
        if(window._audioLoop) { window._audioLoop.pause(); window._audioLoop = null; }
        if(window._titleInterval){ clearInterval(window._titleInterval); window._titleInterval = null; document.title = "Facebook"; } 
    }
    
    let isMainPanelOpen = false;
    let isPaused = false, shouldStop = false, isRunning = false;
    let startTime = Date.now();
    let currentStepName = "";
    let currentStepProgress = 0;
    
    const bubbleStatus = document.createElement("div");
    bubbleStatus.id = "fb-bubble-status";
    
    const panel = document.createElement("div");
    panel.id = "fb-auto-panel";
    
    const miniPanel = document.createElement("div");
    miniPanel.id = "fb-mini-panel";
    
    function createBubbleStatus() {
        const theme = getTheme();
        bubbleStatus.style.cssText = `
            position: fixed;
            bottom: 120px;
            right: 20px;
            width: auto;
            min-width: 180px;
            max-width: 260px;
            background: ${currentMode === 'dame' ? 'rgba(0, 191, 255, 0.92)' : 'rgba(0, 0, 0, 0.85)'};
            backdrop-filter: blur(12px);
            border-radius: 40px;
            padding: 8px 16px;
            z-index: 999998;
            display: flex;
            align-items: center;
            gap: 10px;
            border: 1px solid ${currentMode === 'dame' ? 'rgba(0,255,255,0.5)' : 'rgba(255,255,255,0.3)'};
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            transition: all 0.2s ease;
            cursor: pointer;
            font-family: monospace;
        `;
        
        bubbleStatus.innerHTML = `
            <div style="font-size: 20px;">${currentMode === 'dame' ? '🐬' : '🦅'}</div>
            <div style="flex: 1;">
                <div style="font-size: 9px; opacity: 0.8; color: ${currentMode === 'dame' ? '#fff' : '#ccc'};">${currentMode === 'dame' ? 'DAME PRO' : 'KÍCH NÚT'}</div>
                <div style="font-size: 11px; font-weight: bold; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" id="bubbleStepText">Sẵn sàng</div>
                <div style="background: rgba(255,255,255,0.25); height: 3px; border-radius: 3px; margin-top: 4px; overflow: hidden;">
                    <div id="bubbleProgress" style="width: 0%; height: 100%; background: ${currentMode === 'dame' ? '#00FFDD' : '#FFFFFF'}; border-radius: 3px; transition: width 0.15s ease;"></div>
                </div>
            </div>
            <div style="font-size: 10px; font-weight: bold; color: white;" id="bubblePercent">0%</div>
        `;
        
        bubbleStatus.onclick = () => {
            isMainPanelOpen = true;
            panel.style.display = "block";
            miniPanel.style.display = "none";
            bubbleStatus.style.display = "none";
            renderMainPanel();
            updateUI();
        };
    }
    
    function updateBubbleStatus(stepText, percent) {
        const stepEl = document.getElementById("bubbleStepText");
        const percentEl = document.getElementById("bubblePercent");
        const progressEl = document.getElementById("bubbleProgress");
        if(stepEl) stepEl.innerText = stepText;
        if(percentEl) percentEl.innerText = Math.round(percent) + "%";
        if(progressEl) progressEl.style.width = percent + "%";
    }
    
    function applyThemeToPanel() {
        const theme = getTheme();
        panel.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 460px; max-width: 92vw;
            background: ${theme.bg};
            color: ${theme.textColor}; padding: 0; border-radius: 28px;
            z-index: 1000000; border: 1px solid ${theme.borderColor};
            font-family: 'Segoe UI', system-ui, sans-serif; font-size: 13px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.5); display: ${isMainPanelOpen ? "block" : "none"};
            cursor: default; overflow: hidden;
            transition: all 0.2s ease;
        `;
        
        miniPanel.style.cssText = `
            position: fixed; bottom: 20px; right: 20px;
            width: 65px; height: 65px;
            background: ${currentMode === 'dame' ? 'linear-gradient(145deg, #0B1E33, #06121F)' : '#1a1a1a'};
            border-radius: 20px; z-index: 999999;
            border: 2px solid ${currentMode === 'dame' ? theme.accentColor : '#ffffff'};
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            cursor: pointer; display: flex;
            flex-direction: column;
            align-items: center; justify-content: center;
            transition: all 0.2s ease;
        `;
        miniPanel.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <span style="font-size: 28px;">${currentMode === 'dame' ? '🐬' : '🦅'}</span>
                <span style="font-size: 7px; color: ${currentMode === 'dame' ? theme.accentColor : '#ffffff'}; margin-top: 2px; font-weight: bold;">${currentMode === 'dame' ? 'DZI MODE' : 'KÍCH NÚT'}</span>
            </div>
        `;
        
        if(bubbleStatus && bubbleStatus.style) {
            bubbleStatus.style.background = currentMode === 'dame' ? 'rgba(0, 191, 255, 0.92)' : 'rgba(0, 0, 0, 0.85)';
            bubbleStatus.style.border = `1px solid ${currentMode === 'dame' ? 'rgba(0,255,255,0.5)' : 'rgba(255,255,255,0.3)'}`;
            const bubbleIcon = bubbleStatus.querySelector('div:first-child');
            if(bubbleIcon) bubbleIcon.innerHTML = currentMode === 'dame' ? '🐬' : '🦅';
        }
    }
    
    function formatUptime() {
        let elapsed = Math.floor((Date.now() - startTime) / 1000);
        let h = Math.floor(elapsed / 3600);
        let m = Math.floor((elapsed % 3600) / 60);
        let s = elapsed % 60;
        return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }
    
    function renderMainPanel() {
        const theme = getTheme();
        panel.innerHTML = `
            <div style="padding:20px 22px; background:${theme.headerBg}; border-bottom:1px solid ${theme.borderColor};">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:50px; height:50px; background:linear-gradient(135deg,${currentMode === 'dame' ? '#00BFFF' : '#000000'},${currentMode === 'dame' ? '#1E3A6F' : '#333333'}); border-radius:18px; display:flex; align-items:center; justify-content:center;">
                            <span style="font-size:28px;">${currentMode === 'dame' ? '🐬' : '🦅'}</span>
                        </div>
                        <div>
                            <h3 style="margin:0; font-size:18px; font-weight:800; color:${currentMode === 'dame' ? theme.accentColor : '#ffffff'};">DZI MEO MEO</h3>
                            <p style="margin:2px 0 0; font-size:10px; color:#5A9FCF;">${currentMode === 'dame' ? 'DZI X MODE | DAME V6' : 'KÍCH NÚT META AI 🦅'}</p>
                        </div>
                    </div>
                    <button id="closeMainBtn" style="background:rgba(0,191,255,0.12); border:none; color:${theme.accentColor}; cursor:pointer; border-radius:14px; padding:6px 14px; font-size:16px;">✕</button>
                </div>
            </div>
            <div style="padding:20px 22px;">
                <div style="background:${theme.cardBg}; border-radius:20px; padding:6px; margin-bottom:20px; display:flex; gap:8px;">
                    <button id="modeDameBtn" style="flex:1; padding:12px; border:none; border-radius:16px; font-weight:bold; cursor:pointer; background:${currentMode === 'dame' ? 'linear-gradient(135deg,#00BFFF,#1E3A6F)' : 'transparent'}; color:${currentMode === 'dame' ? 'white' : theme.textColor}; border:${currentMode === 'dame' ? 'none' : `1px solid ${theme.borderColor}`};">🐬 DAME ACC</button>
                    <button id="ModeKickBtn" style="flex:1; padding:12px; border:none; border-radius:16px; font-weight:bold; cursor:pointer; background:${currentMode === 'kicknut' ? '#000000' : 'transparent'}; color:${currentMode === 'kicknut' ? 'white' : theme.textColor}; border:${currentMode === 'kicknut' ? '1px solid #ffffff' : `1px solid ${theme.borderColor}`};">🦅 KÍCH NÚT META</button>
                </div>
                
                <div style="background:${theme.cardBg}; border-radius:20px; padding:16px; margin-bottom:18px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                        <span style="font-weight:600;">🎯 TRẠNG THÁI</span>
                        <span id="currentAction" style="color:${currentMode === 'dame' ? theme.accentColor : '#ffffff'}; font-weight:600;">Chưa chạy</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <span>📊 ${currentMode === 'dame' ? 'BÁO CÁO' : 'LƯỢT KÍCH'}</span>
                        <span><span id="totalSuccess" style="font-size:24px; font-weight:800; color:${currentMode === 'dame' ? theme.accentColor : '#ffffff'};">0</span> <span style="font-size:11px;">/ Vòng <span id="loopCount">0</span></span></span>
                    </div>
                    ${currentMode === 'kicknut' ? `
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <span>🎯 THÀNH CÔNG</span>
                        <span><span id="kickSuccess" style="font-size:20px; font-weight:700; color:${theme.successColor};">0</span> / <span id="kickAttempts">0</span></span>
                    </div>
                    ` : ''}
                    <div style="display:flex; justify-content:space-between;">
                        <span>⏱️ UPTIME</span>
                        <span id="uptime" style="font-family:monospace; font-weight:600;">00:00:00</span>
                    </div>
                </div>
                
                <div style="background:${theme.cardBg}; border-radius:18px; margin-bottom:18px; overflow:hidden;">
                    <div style="padding:14px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" id="settingsHeader">
                        <span style="font-weight:700;">⚙️ CÀI ĐẶT</span>
                        <span id="settingsToggle" style="color:${theme.accentColor};">▼</span>
                    </div>
                    <div id="settingsContent" style="display:none; padding:0 16px 16px 16px;">
                        <div style="margin-bottom:12px;">
                            <div style="font-size:11px; color:#5A9FCF; margin-bottom:6px;">🚀 TỐC ĐỘ</div>
                            <select id="speedSelect" style="width:100%; padding:8px; background:rgba(0,0,0,0.2); border:1px solid ${theme.borderColor}; border-radius:12px; color:${theme.textColor};">
                                <option value="fast" ${speedMode === "fast" ? "selected" : ""}>🏎️ Nhanh (Tốc độ cao)</option>
                                <option value="normal" ${speedMode === "normal" ? "selected" : ""}>⚡ Trung bình</option>
                                <option value="slow" ${speedMode === "slow" ? "selected" : ""}>🐢 Chậm (An toàn)</option>
                            </select>
                        </div>
                        <div style="margin-bottom:12px;">
                            <div style="font-size:11px; color:#5A9FCF; margin-bottom:6px;">🎨 GIAO DIỆN</div>
                            <select id="themeSelect" style="width:100%; padding:8px; background:rgba(0,0,0,0.2); border:1px solid ${theme.borderColor}; border-radius:12px; color:${theme.textColor};">
                                <option value="dark" ${themeMode === "dark" ? "selected" : ""}>🌙 Tối (Dark mode)</option>
                                <option value="light" ${themeMode === "light" ? "selected" : ""}>☀️ Sáng (Light mode)</option>
                            </select>
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                                <input type="checkbox" id="antiSleepCheck" ${antiSleepEnabled ? "checked" : ""} style="accent-color:${currentMode === 'dame' ? '#00BFFF' : '#000000'};">
                                <span>🌙 CHỐNG NGỦ TAB</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div style="display:flex; gap:12px; margin-bottom:18px;">
                    <button id="startBtn" style="flex:1; padding:14px; background:${currentMode === 'dame' ? 'linear-gradient(90deg, #00BFFF, #0077B3)' : '#000000'}; border:none; color:white; font-weight:800; border-radius:60px; cursor:pointer; font-size:14px;">${currentMode === 'dame' ? '🐬 CHẠY DAME' : '🦅 BẮT ĐẦU KÍCH'}</button>
                    <button id="pauseBtn" style="display:none; flex:1; padding:14px; background:rgba(0,191,255,0.12); border:1px solid ${currentMode === 'dame' ? '#00BFFF' : '#ffffff'}; color:${currentMode === 'dame' ? '#00BFFF' : '#ffffff'}; font-weight:700; border-radius:60px; cursor:pointer;">⏸️ TẠM DỪNG</button>
                    <button id="stopBtn" style="display:none; flex:1; padding:14px; background:rgba(255,77,77,0.12); border:1px solid #FF6B6B; color:#FF6B6B; font-weight:700; border-radius:60px; cursor:pointer;">⏹️ DỪNG</button>
                </div>
                <div id="resumeDiv" style="display:none;">
                    <button id="resumeBtn" style="width:100%; padding:12px; background:rgba(0,191,255,0.12); border:1px solid ${currentMode === 'dame' ? '#00BFFF' : '#ffffff'}; color:${currentMode === 'dame' ? '#00BFFF' : '#ffffff'}; border-radius:60px; cursor:pointer; font-weight:600;">▶️ TIẾP TỤC</button>
                </div>
                
                <div id="logArea" style="background:rgba(0,0,0,0.3); border-radius:14px; padding:10px; margin-top:8px; max-height:100px; overflow-y:auto; font-size:10px; font-family:monospace;">
                    <div style="color:#8899AA;">✨ Sẵn sàng - Chọn chế độ và bắt đầu</div>
                </div>
            </div>
        `;
        
        document.getElementById("closeMainBtn")?.addEventListener("click", () => {
            isMainPanelOpen = false;
            panel.style.display = "none";
            miniPanel.style.display = "flex";
            bubbleStatus.style.display = "flex";
        });
        
        document.getElementById("modeDameBtn")?.addEventListener("click", () => {
            if(isRunning) { addLog("⚠️ Đang chạy, hãy dừng trước khi đổi chế độ!", "#FFA500"); return; }
            currentMode = "dame";
            applyThemeToPanel();
            createBubbleStatus();
            renderMainPanel();
            updateUI();
            updateBubbleStatus("Chế độ DAME", 0);
            addLog("🐬 Đã chuyển sang chế độ DAME ACC", "#00BFFF");
        });
        
        document.getElementById("ModeKickBtn")?.addEventListener("click", () => {
            if(isRunning) { addLog("⚠️ Đang chạy, hãy dừng trước khi đổi chế độ!", "#FFA500"); return; }
            currentMode = "kicknut";
            applyThemeToPanel();
            createBubbleStatus();
            renderMainPanel();
            updateUI();
            updateBubbleStatus("Chế độ KÍCH NÚT", 0);
            addLog("🦅 Đã chuyển sang chế độ KÍCH NÚT META AI", "#ffffff");
        });
        
        const settingsHeader = document.getElementById("settingsHeader");
        const settingsContent = document.getElementById("settingsContent");
        const settingsToggle = document.getElementById("settingsToggle");
        if(settingsHeader) {
            settingsHeader.addEventListener("click", () => {
                if(settingsContent.style.display === "none") {
                    settingsContent.style.display = "block";
                    settingsToggle.innerHTML = "▲";
                } else {
                    settingsContent.style.display = "none";
                    settingsToggle.innerHTML = "▼";
                }
            });
        }
        
        document.getElementById("speedSelect")?.addEventListener("change", (e) => {
            speedMode = e.target.value;
            updateConfig();
            addLog(`⚡ Đã chuyển tốc độ: ${speedMode === 'fast' ? 'Nhanh' : speedMode === 'normal' ? 'Trung bình' : 'Chậm'}`, "#FFA500");
        });
        
        document.getElementById("themeSelect")?.addEventListener("change", (e) => {
            themeMode = e.target.value;
            applyThemeToPanel();
            createBubbleStatus();
            renderMainPanel();
        });
        
        document.getElementById("antiSleepCheck")?.addEventListener("change", (e) => {
            antiSleepEnabled = e.target.checked;
            if(antiSleepEnabled && isRunning) startAntiSleep();
            else if(!antiSleepEnabled) stopAntiSleep();
        });
        
        document.getElementById("startBtn")?.addEventListener("click", () => {
            if(currentMode === 'dame') startDameProcess();
            else startKickNutProcess();
        });
        document.getElementById("pauseBtn")?.addEventListener("click", () => { isPaused = true; updateUI(); addLog("⏸️ Đã tạm dừng", "#FFA500"); updateBubbleStatus("TẠM DỪNG", currentStepProgress); });
        document.getElementById("stopBtn")?.addEventListener("click", () => { if(confirm("DỪNG TOÀN BỘ?")) { shouldStop = true; isPaused = false; addLog("⏹️ Đã dừng quy trình", "#FF6B6B"); } });
        document.getElementById("resumeBtn")?.addEventListener("click", () => { isPaused = false; updateUI(); addLog("▶️ Tiếp tục chạy", "#00FF88"); });
    }
    
    function addLog(msg, color = "#8899AA") {
        const logArea = document.getElementById("logArea");
        if(logArea) {
            const time = new Date().toLocaleTimeString();
            logArea.innerHTML = `<div style="color:${color}; border-left: 3px solid ${color}; padding-left: 8px; margin-bottom: 6px;">[${time}] ${msg}</div>` + logArea.innerHTML;
            if(logArea.children.length > 15) logArea.removeChild(logArea.lastChild);
        }
    }
    
    function updateUI() {
        if(!isMainPanelOpen) return;
        const startBtn = document.getElementById("startBtn");
        const pauseBtn = document.getElementById("pauseBtn");
        const stopBtn = document.getElementById("stopBtn");
        const resumeDiv = document.getElementById("resumeDiv");
        const currentAction = document.getElementById("currentAction");
        
        if(startBtn) {
            if(isRunning) {
                startBtn.style.display = "none";
                stopBtn.style.display = "block";
                if(isPaused) {
                    pauseBtn.style.display = "none";
                    resumeDiv.style.display = "block";
                } else {
                    pauseBtn.style.display = "block";
                    resumeDiv.style.display = "none";
                }
            } else {
                startBtn.style.display = "block";
                pauseBtn.style.display = "none";
                stopBtn.style.display = "none";
                resumeDiv.style.display = "none";
            }
        }
        
        const totalEl = document.getElementById("totalSuccess");
        if(totalEl) totalEl.innerText = currentMode === 'dame' ? totalReportsDone : totalKickSuccess;
        const loopEl = document.getElementById("loopCount");
        if(loopEl) loopEl.innerText = currentMode === 'dame' ? totalLoopsCompleted : totalKickAttempts;
        const uptimeEl = document.getElementById("uptime");
        if(uptimeEl) uptimeEl.innerText = formatUptime();
        
        if(currentMode === 'kicknut') {
            const kickSuccessEl = document.getElementById("kickSuccess");
            const kickAttemptsEl = document.getElementById("kickAttempts");
            if(kickSuccessEl) kickSuccessEl.innerText = totalKickSuccess;
            if(kickAttemptsEl) kickAttemptsEl.innerText = totalKickAttempts;
        }
        
        if(currentAction) {
            if(isRunning && !isPaused) currentAction.innerHTML = "🟢 ĐANG CHẠY";
            else if(isPaused) currentAction.innerHTML = "⏸️ TẠM DỪNG";
            else currentAction.innerHTML = "⚪ SẴN SÀNG";
        }
    }
    
    async function executeReport(reportConfig) {
        const steps = reportConfig.steps;
        const totalSteps = steps.length;
        for(let i = 0; i < totalSteps; i++) {
            if(shouldStop) return false;
            while(isPaused && !shouldStop) await sleep(100);
            if(shouldStop) return false;
            
            const step = steps[i];
            let stepDisplay = step.name || (step.type === "menu" ? "Mở menu" : step.type === "click" ? "Click nút" : step.type === "optional" ? "Tùy chọn" : step.type === "action" ? "Thao tác" : step.type === "done" ? "Hoàn tất" : step.type === "input" ? "Nhập Meta" : step.type === "meta" ? "Chọn Meta" : step.type === "somethingElse" ? "Something else" : "Bước");
            let percent = (i / totalSteps) * 100;
            updateBubbleStatus(`${reportConfig.name.substring(0, 20)}`, percent);
            addLog(`📌 ${reportConfig.name}: ${stepDisplay}`, "#7BACE0");
            
            if(step.type === "menu") {
                await clickMenu();
                await sleep(config.DELAY_TIME);
            }
            else if(step.type === "click") {
                await findAndClick(step.texts, 4000, config.DELAY_TIME);
            }
            else if(step.type === "optional") {
                await findAndClick(step.texts, 2000, 150);
            }
            else if(step.type === "action") {
                await findAndClick(step.texts, 5000, config.WAIT_FOR_ACTION);
            }
            else if(step.type === "done") {
                await findAndClick(step.texts, 3500, config.DONE_DELAY);
            }
            else if(step.type === "input") {
                let inp = getElementByXpath(INPUT_XPATH);
                if(inp) {
                    inp.focus();
                    inp.value = "Meta ";
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    await sleep(config.INPUT_DELAY);
                }
            }
            else if(step.type === "meta") {
                await clickMetaResult();
            }
            else if(step.type === "somethingElse") {
                await findAndClickSomethingElse();
            }
        }
        totalReportsDone++;
        updateBubbleStatus(`✅ Hoàn thành ${reportConfig.name.substring(0, 15)}`, 100);
        addLog(`✅ Hoàn thành báo cáo: ${reportConfig.name}`, "#00FF88");
        updateUI();
        return true;
    }
    
    let keepKicking = true;
    
    async function kickMetaButton() {
        addLog("🔍 Đang quét tìm nút HỖ TRỢ...", "#FFA500");
        updateBubbleStatus("Đang quét nút hỗ trợ", 30);
        
        let foundButton = false;
        let allElements = document.getElementsByTagName("*");
        
        for (let i = 0; i < allElements.length; i++) {
            let el = allElements[i];
            if (panel.contains(el) || miniPanel.contains(el) || bubbleStatus.contains(el)) continue;
            
            if (el.children.length === 0 && el.innerText) {
                let txt = el.innerText.trim();
                if (LANG.supportKeywords.some(k => txt === k || txt.includes(k))) {
                    foundButton = true;
                    el.style.border = "3px dashed #ffffff";
                    el.style.animation = "blink 0.5s infinite";
                    updateBubbleStatus("🔮 Đã tìm thấy! Đang kích...", 70);
                    addLog("🦅 Đã phát hiện nút hỗ trợ! Tiến hành kích...", "#ffffff");
                    await safeClick(el);
                    await sleep(500);
                    updateBubbleStatus("✅ KÍCH THÀNH CÔNG!", 100);
                    addLog("✅ ĐÃ KÍCH NÚT HỖ TRỢ THÀNH CÔNG!", "#00FF88");
                    totalKickSuccess++;
                    playNotificationSound();
                    return true;
                }
            }
        }
        
        if (!foundButton) {
            updateBubbleStatus("Chưa tìm thấy, thử lại...", 50);
            try {
                let resBiz = await fetch("/help/");
                if (resBiz.status === 200) {
                    let textBiz = await resBiz.text();
                    if ((textBiz.includes("contact_support") || textBiz.includes("support_case_id")) && !textBiz.includes("checkpoint")) {
                        addLog("🦅 Phát hiện qua API, kích thành công!", "#00FF88");
                        totalKickSuccess++;
                        return true;
                    }
                }
            } catch (e) {}
        }
        
        if (!foundButton) {
            addLog("❌ Chưa tìm thấy nút hỗ trợ, sẽ thử lại...", "#FF6B6B");
            updateBubbleStatus("❌ Chưa tìm thấy, thử lại", 0);
        }
        return foundButton;
    }
    
    function playNotificationSound() {
        try {
            let context = new (window.AudioContext || window.webkitAudioContext)();
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    let oscillator = context.createOscillator();
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(1200, context.currentTime);
                    oscillator.connect(context.destination);
                    oscillator.start();
                    oscillator.stop(context.currentTime + 0.2);
                }, i * 300);
            }
        } catch (e) {}
    }
    
    async function startKickNutProcess() {
        totalKickAttempts = 0;
        totalKickSuccess = 0;
        startTime = Date.now();
        shouldStop = false;
        isPaused = false;
        isRunning = true;
        keepKicking = true;
        
        if(antiSleepEnabled) startAntiSleep();
        updateUI();
        addLog("🦅 BẮT ĐẦU QUY TRÌNH KÍCH NÚT META AI...", "#ffffff");
        
        while (!shouldStop && keepKicking) {
            while(isPaused && !shouldStop) await sleep(200);
            if(shouldStop) break;
            
            totalKickAttempts++;
            updateUI();
            addLog(`🔄 Lượt kích thứ ${totalKickAttempts}`, "#7BACE0");
            
            let success = await kickMetaButton();
            
            if (success) {
                addLog(`🎉 THÀNH CÔNG! Đã kích được nút hỗ trợ!`, "#00FF88");
                updateBubbleStatus("🎉 KÍCH THÀNH CÔNG!", 100);
                const container = document.querySelector("#fb-auto-panel");
                if(container) {
                    container.style.border = "3px solid #ffffff";
                    container.style.boxShadow = "0 0 30px rgba(255,255,255,0.6)";
                    setTimeout(() => {
                        if(container) container.style.border = "";
                    }, 2000);
                }
                keepKicking = false;
                shouldStop = true;
                break;
            } else {
                addLog(`⏳ Chưa tìm thấy nút, thử lại sau ${config.SCAN_INTERVAL/1000}s...`, "#FFA500");
                updateBubbleStatus(`Thử lại lần ${totalKickAttempts + 1}`, (totalKickAttempts % 10) * 10);
                await sleep(config.SCAN_INTERVAL);
            }
        }
        
        isRunning = false;
        if(!antiSleepEnabled) stopAntiSleep();
        updateUI();
        if(totalKickSuccess > 0) {
            addLog(`✨ HOÀN TẤT! Đã kích thành công nút hỗ trợ!`, "#00FF88");
            updateBubbleStatus("✅ THÀNH CÔNG", 100);
        } else {
            addLog(`⚠️ Đã dừng sau ${totalKickAttempts} lượt, chưa tìm thấy nút hỗ trợ.`, "#FFA500");
            updateBubbleStatus("⚠️ KHÔNG TÌM THẤY", 100);
        }
    }
    
    async function startDameProcess() {
        totalReportsDone = 0;
        totalLoopsCompleted = 0;
        startTime = Date.now();
        shouldStop = false;
        isPaused = false;
        isRunning = true;
        
        if(antiSleepEnabled) startAntiSleep();
        updateUI();
        addLog("🐬 BẮT ĐẦU DAME ACC...", "#00BFFF");
        
        let loopCount = 0;
        while(!shouldStop) {
            loopCount++;
            for(let i = 0; i < reportTypes.length && !shouldStop; i++) {
                updateBubbleStatus(reportTypes[i].name.substring(0, 25), 0);
                addLog(`📋 Vòng ${loopCount} | ${reportTypes[i].name}`, "#7BACE0");
                await executeReport(reportTypes[i]);
                if(!shouldStop) await sleep(config.INTER_REPORT_DELAY);
            }
            if(!shouldStop) {
                totalLoopsCompleted = loopCount;
                updateUI();
                addLog(`✅ HOÀN THÀNH VÒNG ${loopCount} | ${formatUptime()}`, "#00FF88");
                updateBubbleStatus(`Hoàn thành vòng ${loopCount}`, 100);
                await sleep(config.LOOP_DELAY);
            }
        }
        
        isRunning = false;
        if(!antiSleepEnabled) stopAntiSleep();
        updateUI();
        addLog(`✨ DỪNG | TỔNG BÁO CÁO: ${totalReportsDone} | ${formatUptime()}`, "#FFA500");
        updateBubbleStatus("ĐÃ DỪNG", 100);
    }
    
    resetState();
    applyThemeToPanel();
    createBubbleStatus();
    renderMainPanel();
    
    document.body.appendChild(panel);
    document.body.appendChild(miniPanel);
    document.body.appendChild(bubbleStatus);
    
    miniPanel.addEventListener("click", () => {
        isMainPanelOpen = true;
        panel.style.display = "block";
        miniPanel.style.display = "none";
        bubbleStatus.style.display = "none";
        renderMainPanel();
        updateUI();
    });
    
    const styleEl = document.createElement("style");
    styleEl.innerHTML = `@keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }`;
    document.head.appendChild(styleEl);
    
    setInterval(() => { if(isRunning) updateUI(); }, 1000);
    addLog("🐬 DZI MEO MEO PRO V6.2 - Chọn chế độ và bắt đầu!", "#00BFFF");
    console.log("🐬 DZI MEO MEO | DZI X MODE | PRO V6.2");

    // Auto bắt đầu dame ngay khi vào link
    setTimeout(() => {
        try {
            currentMode = "dame";
            renderMainPanel();
            updateUI();
            const startBtn = document.getElementById("startBtn");
            if (startBtn) {
                addLog("⚡ Auto-start dame...", "#00BFFF");
                startBtn.click();
            } else {
                startDameProcess();
            }
        } catch(e) { console.log("Auto-start error:", e); }
    }, 2000);
})();