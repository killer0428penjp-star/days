/* js/study.js */

// --- 変数定義 ---
let startTime, elapsedTime = 0, timerInterval, isRunning = false, lapCount = 0;
let appMode = 'stopwatch';
let isAnalog = false;
let countdownBase = 0;
let totalStudyTime = 0; 
let isStudyPhase = true; 

const DB_SESSIONS_KEY = 'zenfocus_sessions_v4'; // DBキー
let currentSessionStart = null;
let statsMode = 'week'; 
let statsDate = new Date(); 

// --- データ保存ロジック ---
function loadSessions() {
    return JSON.parse(localStorage.getItem(DB_SESSIONS_KEY)) || [];
}

function saveSession(start, end, mode) {
    if (!start || !end || end <= start) return;
    const sessions = loadSessions();
    sessions.push({ start: Number(start), end: Number(end), mode });
    localStorage.setItem(DB_SESSIONS_KEY, JSON.stringify(sessions));
}

// --- タイマー制御 ---
function update() {
    const now = Date.now();
    const delta = now - startTime;

    if (appMode === 'stopwatch') {
        elapsedTime = delta;
    } else if (appMode === 'timer' || appMode === 'study') {
        elapsedTime = countdownBase - delta;
        
        if (appMode === 'study' && isStudyPhase) {
            const sessionDur = now - currentSessionStart;
            const totalDisplay = document.getElementById('total-study-display');
            if (totalDisplay) totalDisplay.innerText = timeToString(totalStudyTime + sessionDur);
        }
        
        if (elapsedTime <= 0) {
            elapsedTime = 0;
            if (appMode === 'study') {
                handleSessionEnd(); 
                if (isStudyPhase) {
                    alert("集中終了！5分休憩に入ります。");
                    prepareBreakPhase();
                } else {
                    alert("休憩終了！25分集中を始めます。");
                    prepareStudyPhase();
                }
                handleSessionStart(); 
                startTime = Date.now();
            } else {
                handleSessionEnd();
                handleStartStop(); 
                alert("Time Up!");
            }
        }
    }

    const displayEl = document.getElementById('display');
    if (displayEl) displayEl.innerText = timeToString(elapsedTime);
    
    const mainHand = document.getElementById('main-hand');
    if(mainHand) {
        const deg = (elapsedTime / 60000) * 360;
        mainHand.style.transform = `rotate(${deg}deg)`;
    }
}

function handleSessionStart() {
    if (appMode === 'study' && !isStudyPhase) {
        currentSessionStart = null;
    } else {
        currentSessionStart = Date.now();
    }
}

function handleSessionEnd() {
    if (currentSessionStart) {
        const now = Date.now();
        saveSession(currentSessionStart, now, appMode);
        totalStudyTime += (now - currentSessionStart); 
        currentSessionStart = null;
    }
}

function handleStartStop() {
    if (!isRunning) {
        if (appMode === 'timer' && elapsedTime === 0) {
            const h = parseInt(document.getElementById('in-h')?.value || 0);
            const m = parseInt(document.getElementById('in-m')?.value || 0);
            const s = parseInt(document.getElementById('in-s')?.value || 0);
            elapsedTime = (h * 3600 + m * 60 + s) * 1000;
            if (elapsedTime <= 0) return;
        }
        startTime = Date.now();
        if (appMode === 'stopwatch') startTime -= elapsedTime;
        else countdownBase = elapsedTime;
        
        handleSessionStart(); 
        timerInterval = setInterval(update, 100);
        isRunning = true;
        
        document.getElementById('timer-inputs')?.classList.add('hidden');
        document.getElementById('display')?.classList.remove('hidden');
    } else {
        handleSessionEnd(); 
        clearInterval(timerInterval);
        isRunning = false;
    }
    updateUI();
}

function handleReset() {
    handleSessionEnd(); 
    clearInterval(timerInterval);
    isRunning = false;
    elapsedTime = 0;
    lapCount = 0;

    if (appMode === 'study') {
        totalStudyTime = 0;
        const totalDisp = document.getElementById('total-study-display');
        if (totalDisp) totalDisp.innerText = "00:00:00";
        prepareStudyPhase();
    } else {
        const displayEl = document.getElementById('display');
        if (displayEl) displayEl.innerText = "00:00:00";
    }

    const mainHand = document.getElementById('main-hand');
    if(mainHand) mainHand.style.transform = `rotate(0deg)`;
    
    const lapList = document.getElementById('lap-list');
    if(lapList) lapList.innerHTML = '';
    
    const lapContainer = document.getElementById('lap-container');
    if(lapContainer) lapContainer.style.opacity = "0";

    if (appMode === 'timer') {
        document.getElementById('timer-inputs')?.classList.remove('hidden');
        document.getElementById('display')?.classList.add('hidden');
    }
    updateUI();
}

// --- 統計UIロジック ---
function toggleStats() {
    const modal = document.getElementById('stats-modal');
    if (!modal) return;
    if (modal.classList.contains('hidden')) {
        statsDate = new Date(); 
        renderStats();
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

function switchStatsMode(mode) {
    statsMode = mode;
    const tabWeek = document.getElementById('stats-tab-week');
    const tabDay = document.getElementById('stats-tab-day');
    
    if(tabWeek) {
        tabWeek.className = mode === 'week' 
            ? "flex-1 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-900 transition-all"
            : "flex-1 py-2 text-xs font-bold rounded-lg text-slate-400 transition-all";
    }
    if(tabDay) {
        tabDay.className = mode === 'day' 
            ? "flex-1 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-900 transition-all"
            : "flex-1 py-2 text-xs font-bold rounded-lg text-slate-400 transition-all";
    }
    
    document.getElementById('chart-week')?.classList.toggle('hidden', mode !== 'week');
    document.getElementById('chart-day')?.classList.toggle('hidden', mode !== 'day');
    
    renderStats();
}

function moveStatsDate(direction) {
    if (statsMode === 'week') {
        statsDate.setDate(statsDate.getDate() + (direction * 7));
    } else {
        statsDate.setDate(statsDate.getDate() + direction);
    }
    renderStats();
}

function renderStats() {
    const sessions = loadSessions();
    if (statsMode === 'week') {
        renderWeekChart(sessions);
    } else {
        renderDayChart(sessions);
    }
}

function getColor(mode) {
    if (mode === 'study') return 'bg-blue-600';
    if (mode === 'timer') return 'bg-sky-400';
    return 'bg-slate-400'; 
}

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay(); 
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

// --- グラフ描画: 週間 ---
function renderWeekChart(sessions) {
    const startOfWeek = getStartOfWeek(statsDate);
    startOfWeek.setHours(0,0,0,0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const endDisp = new Date(endOfWeek);
    endDisp.setDate(endDisp.getDate() - 1);
    
    const dateLabel = document.getElementById('stats-date-label');
    if(dateLabel) dateLabel.innerText = `${startOfWeek.getMonth()+1}/${startOfWeek.getDate()} - ${endDisp.getMonth()+1}/${endDisp.getDate()}`;

    const dailyTotals = Array(7).fill(null).map(() => ({ total: 0, study: 0, timer: 0, stopwatch: 0 }));
    let weekTotalMs = 0;

    sessions.forEach(s => {
        const sStart = Number(s.start);
        const sEnd = Number(s.end);
        if (sStart >= startOfWeek.getTime() && sStart < endOfWeek.getTime()) {
            const dateObj = new Date(sStart);
            let dayIdx = dateObj.getDay() - 1; 
            if (dayIdx === -1) dayIdx = 6;     

            const duration = sEnd - sStart;
            if (dailyTotals[dayIdx]) {
                dailyTotals[dayIdx].total += duration;
                const modeKey = ['study', 'timer', 'stopwatch'].includes(s.mode) ? s.mode : 'stopwatch';
                dailyTotals[dayIdx][modeKey] += duration;
                weekTotalMs += duration;
            }
        }
    });

    const totalLabel = document.getElementById('stats-total-label');
    if(totalLabel) totalLabel.innerText = `Total: ${formatTimeShort(weekTotalMs)}`;
    
    const container = document.getElementById('chart-week');
    if(!container) return;
    container.innerHTML = '';
    
    const maxValMs = Math.max(...dailyTotals.map(d => d.total), 0); 
    let maxHours = Math.ceil(maxValMs / 3600000); 
    if (maxHours < 1) maxHours = 1; 
    const maxChartMs = maxHours * 3600000;

    const wrapper = document.createElement('div');
    wrapper.className = "relative w-full h-full flex pl-8";

    const grid = document.createElement('div');
    grid.className = "absolute inset-0 left-8 flex flex-col-reverse justify-between pointer-events-none border-b border-slate-200";
    for (let i = 0; i <= maxHours; i++) {
        const line = document.createElement('div');
        line.className = i === 0 ? "w-full relative" : "w-full border-t border-slate-100 relative";
        line.innerHTML = `<span class="absolute -left-8 -top-2 w-6 text-right text-[9px] text-slate-400 mono font-bold">${i}h</span>`;
        grid.appendChild(line);
    }
    wrapper.appendChild(grid);

    const barsContainer = document.createElement('div');
    barsContainer.className = "flex-1 flex items-end justify-between gap-1 z-10 pb-[1px]";
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    dailyTotals.forEach((d, i) => {
        const heightPercent = maxChartMs > 0 ? (d.total / maxChartMs) * 100 : 0;
        const pStudy = d.total ? (d.study / d.total) * 100 : 0;
        const pTimer = d.total ? (d.timer / d.total) * 100 : 0;
        const pStop = d.total ? (d.stopwatch / d.total) * 100 : 0;

        const barHtml = `
            <div class="flex flex-col items-center flex-1 h-full justify-end group cursor-pointer relative" title="${formatTimeShort(d.total)}">
                <div class="w-full max-w-[20px] bg-slate-50 rounded-t-sm overflow-hidden flex flex-col-reverse relative chart-bar border border-slate-100 group-hover:bg-slate-100" 
                     style="height: ${heightPercent}%">
                    <div class="bg-blue-600 w-full" style="height: ${pStudy}%"></div>
                    <div class="bg-sky-400 w-full" style="height: ${pTimer}%"></div>
                    <div class="bg-slate-400 w-full" style="height: ${pStop}%"></div>
                </div>
                <span class="text-[9px] font-bold text-slate-400 mt-1">${days[i]}</span>
            </div>
        `;
        barsContainer.innerHTML += barHtml;
    });

    wrapper.appendChild(barsContainer);
    container.appendChild(wrapper);
}

// --- グラフ描画: 1日詳細 ---
function renderDayChart(sessions) {
    const startOfDay = new Date(statsDate);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const daysStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dateLabel = document.getElementById('stats-date-label');
    if(dateLabel) dateLabel.innerText = `${startOfDay.getMonth()+1}/${startOfDay.getDate()} (${daysStr[startOfDay.getDay()]})`;

    const gridContainer = document.getElementById('day-grid');
    if(gridContainer) {
        gridContainer.innerHTML = '';
        for (let i = 0; i <= 24; i++) {
            const div = document.createElement('div');
            const isMajor = i % 3 === 0; 
            
            div.className = `h-full w-px ${isMajor ? 'bg-slate-200' : 'bg-slate-100'} relative flex flex-col justify-end overflow-visible`;
            
            if (isMajor) {
                div.innerHTML = `<span class="absolute bottom-[-20px] -translate-x-1/2 text-[9px] text-slate-400 mono font-bold">${i}h</span>`;
            } else {
                div.innerHTML = `<div class="absolute bottom-0 h-1 w-px bg-slate-200"></div>`;
            }
            gridContainer.appendChild(div);
        }
    }

    const track = document.getElementById('day-timeline-track');
    if(track) track.innerHTML = '';
    let dayTotalMs = 0;

    sessions.forEach(s => {
        const sStart = Number(s.start);
        const sEnd = Number(s.end);
        if (sStart >= startOfDay.getTime() && sStart < endOfDay.getTime()) {
            const dateObj = new Date(sStart);
            const durationMs = sEnd - sStart;
            dayTotalMs += durationMs;

            const startMinutes = dateObj.getHours() * 60 + dateObj.getMinutes();
            const durationMinutes = durationMs / 1000 / 60;
            
            const leftP = (startMinutes / 1440) * 100;
            const widthP = (durationMinutes / 1440) * 100;

            const div = document.createElement('div');
            const modeLabel = s.mode === 'study' ? '勉強' : s.mode === 'timer' ? 'タイマー' : '計測';
            div.className = `timeline-block ${getColor(s.mode)}`;
            div.style.left = `${leftP}%`;
            div.style.width = `${Math.max(widthP, 0.4)}%`; 
            div.title = `${modeLabel}: ${formatTimeShort(durationMs)} (${dateObj.getHours()}:${dateObj.getMinutes().toString().padStart(2, '0')})`;
            if(track) track.appendChild(div);
        }
    });
    
    const totalLabel = document.getElementById('stats-total-label');
    if(totalLabel) totalLabel.innerText = `Total: ${formatTimeShort(dayTotalMs)}`;
}

// --- 共通ユーティリティ ---
function formatTimeShort(ms) {
    if (!ms) return "0m";
    const min = Math.floor(ms / 60000);
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function changeMode(newMode) {
    if (newMode === appMode) return;
    if (isRunning) {
        if (!confirm("計測中ですが、モードを切り替えますか？")) return;
        handleStartStop(); 
    }
    appMode = newMode;
    handleReset(); // ※handleReset内でstudy判定と初期化・色変更が走ります
    
    document.querySelectorAll('#study-screen nav button').forEach(b => b.classList.remove('tab-active', 'text-slate-900'));
    const btn = document.getElementById('btn-' + newMode);
    if(btn) btn.classList.add('tab-active');
    
    document.getElementById('total-study-container')?.classList.toggle('hidden', newMode !== 'study');
    document.getElementById('lap-btn')?.classList.toggle('opacity-50', newMode === 'study');

    if (newMode === 'timer') {
        document.getElementById('timer-inputs')?.classList.remove('hidden');
        document.getElementById('display')?.classList.add('hidden');
    } else if (newMode !== 'study') {
        document.getElementById('timer-inputs')?.classList.add('hidden');
        document.getElementById('display')?.classList.remove('hidden');
    }
}

function prepareStudyPhase() {
    isStudyPhase = true;
    elapsedTime = 25 * 60 * 1000;
    countdownBase = elapsedTime;
    
    const displayEl = document.getElementById('display');
    if(displayEl) {
        displayEl.innerText = timeToString(elapsedTime);
        displayEl.classList.remove('hidden');
    }
    document.getElementById('timer-inputs')?.classList.add('hidden');
    
    const statusLabel = document.getElementById('status-label');
    if(statusLabel) statusLabel.innerText = "Focus (25m)";
    
    // CSS変数の名前を以前の修正に合わせて '--study-accent' に変更し、study-screen要素に適用
    const studyScreen = document.getElementById('study-screen');
    if(studyScreen) studyScreen.style.setProperty('--study-accent', '#2563eb');
}

function prepareBreakPhase() {
    isStudyPhase = false;
    elapsedTime = 5 * 60 * 1000;
    countdownBase = elapsedTime;
    
    const displayEl = document.getElementById('display');
    if(displayEl) displayEl.innerText = timeToString(elapsedTime);
    
    const statusLabel = document.getElementById('status-label');
    if(statusLabel) statusLabel.innerText = "Break (5m)";
    
    // CSS変数の名前を以前の修正に合わせて '--study-accent' に変更し、study-screen要素に適用
    const studyScreen = document.getElementById('study-screen');
    if(studyScreen) studyScreen.style.setProperty('--study-accent', '#10b981');
}

function timeToString(time) {
    let totalSec = Math.floor(Math.abs(time) / 1000);
    let h = Math.floor(totalSec / 3600).toString().padStart(2, "0");
    let m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, "0");
    let s = Math.floor(totalSec % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function handleLap() {
    if (!isRunning || appMode === 'study') return;
    lapCount++;
    const lapContainer = document.getElementById('lap-container');
    if(lapContainer) lapContainer.style.opacity = "1";
    
    const div = document.createElement('div');
    div.className = "flex justify-between items-center py-2 border-b border-slate-50";
    div.innerHTML = `<span class="font-bold text-slate-300">LAP ${lapCount}</span><span class="mono text-slate-800">${timeToString(elapsedTime)}</span>`;
    
    const lapList = document.getElementById('lap-list');
    if(lapList) lapList.prepend(div);
}

function setBackground(type) {
    const container = document.getElementById('bg-container');
    const anim = document.getElementById('anim-layer');
    if(!container || !anim) return;
    
    container.style.backgroundImage = '';
    container.className = '';
    anim.innerHTML = '';
    
    if (type === 'waves') {
        container.classList.add('waves-bg');
        anim.innerHTML = '<div class="wave-obj"></div><div class="wave-obj" style="animation-delay:-5s; opacity:0.03;"></div>';
    } else if (type === 'trees') {
        container.classList.add('trees-bg');
        for(let i=0; i<8; i++) {
            const leaf = document.createElement('div');
            leaf.className = 'leaf-obj';
            leaf.style.cssText = `width:${Math.random()*40+20}px; height:${Math.random()*40+20}px; left:${Math.random()*100}%; top:${Math.random()*100}%; animation-delay:${Math.random()*5}s;`;
            anim.appendChild(leaf);
        }
    }
    toggleSettings();
}

// idが存在する場合のみイベントリスナーを登録
const bgUpload = document.getElementById('bg-upload');
if(bgUpload) {
    bgUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const container = document.getElementById('bg-container');
                const anim = document.getElementById('anim-layer');
                if(container) container.style.backgroundImage = `url(${ev.target.result})`;
                if(anim) anim.innerHTML = '';
                toggleSettings();
            };
            reader.readAsDataURL(file);
        }
    });
}

function updateUI() {
    const icon = isRunning ? 'pause' : 'play';
    const iconEl = document.getElementById('play-icon');
    
    // Lucideアイコンを安全に切り替えるための処理（古いタグを作り直す）
    if(iconEl) {
        const newIcon = document.createElement('i');
        newIcon.id = 'play-icon';
        newIcon.setAttribute('data-lucide', icon);
        iconEl.replaceWith(newIcon);
    }
    
    const startStopBtn = document.getElementById('start-stop-btn');
    if(startStopBtn) {
        startStopBtn.className = `w-20 h-20 rounded-full shadow-xl flex items-center justify-center transition-transform active:scale-90 ${isRunning ? 'bg-blue-600' : 'bg-slate-900'}`;
    }
    
    if (appMode !== 'study') {
        const statusLabel = document.getElementById('status-label');
        if(statusLabel) statusLabel.innerText = isRunning ? "Focusing" : "Paused";
    }
    
    // 画面にアイコンを描画
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleVisual() {
    isAnalog = !isAnalog;
    document.getElementById('analog-clock')?.classList.toggle('hidden', !isAnalog);
    document.getElementById('display')?.classList.toggle('text-2xl', isAnalog);
    document.getElementById('display')?.classList.toggle('text-7xl', !isAnalog);
    document.getElementById('display')?.classList.toggle('mt-4', isAnalog);
}

function toggleSettings() {
    document.getElementById('settings-modal')?.classList.toggle('hidden');
}

// アナログ時計の数字配置
const numContainer = document.getElementById('numerals-container');
if(numContainer) {
    for (let i = 1; i <= 12; i++) {
        const n = document.createElement('div');
        n.className = 'numeral'; n.innerText = i * 5;
        const angle = (i * 30) * (Math.PI / 180);
        n.style.left = `${130 + 110 * Math.sin(angle)}px`;
        n.style.top = `${130 - 110 * Math.cos(angle)}px`;
        numContainer.appendChild(n);
    }
}

const startStopBtn = document.getElementById('start-stop-btn');
if(startStopBtn) {
    startStopBtn.addEventListener('click', handleStartStop);
}