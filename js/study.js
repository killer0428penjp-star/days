/* js/study.js */

// --- 状態管理変数 ---
let mode = 'stopwatch'; // 'stopwatch', 'timer', 'study'
let isRunning = false;
let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;
let timerDuration = 0; // タイマー設定時間（ミリ秒）

// 勉強時間記録用（ローカルストレージに保存する想定）
let studyStats = JSON.parse(localStorage.getItem('studyStats')) || {
    total: 0,
    week: [0, 0, 0, 0, 0, 0, 0], // 日〜土の勉強時間
    today: 0
};

// --- DOM要素の取得 ---
const display = document.getElementById('display');
const mainHand = document.getElementById('main-hand');
const startStopBtn = document.getElementById('start-stop-btn');
const playIcon = document.getElementById('play-icon');
const digitalContainer = document.getElementById('digital-container');
const analogClock = document.getElementById('analog-clock');
const timerInputs = document.getElementById('timer-inputs');
const totalStudyContainer = document.getElementById('total-study-container');
const totalStudyDisplay = document.getElementById('total-study-display');
const statusLabel = document.getElementById('status-label');

// --- 初期化処理 ---
function initStudyApp() {
    updateDisplay(0);
    renderStats();
    
    // アイコンの初期化（Lucideが読み込まれている場合）
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// --- メインループ (10msごとに更新) ---
function tick() {
    const now = Date.now();
    
    if (mode === 'timer') {
        // タイマーモード（カウントダウン）
        const remaining = startTime + timerDuration - now;
        if (remaining <= 0) {
            stopTimer();
            updateDisplay(0);
            alert("Time's up!");
            return;
        }
        updateDisplay(remaining);
        updateClockHands(remaining);
    } else {
        // ストップウォッチ & 勉強モード（カウントアップ）
        const currentElapsed = now - startTime + elapsedTime;
        updateDisplay(currentElapsed);
        updateClockHands(currentElapsed);
        
        // 勉強モードなら合計時間も更新表示（保存は停止時）
        if (mode === 'study') {
            const sessionTime = now - startTime;
            // 表示だけ更新
            const totalSeconds = Math.floor((studyStats.total + sessionTime) / 1000);
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            totalStudyDisplay.textContent = 
                `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
    }
}

// --- 操作関数 ---

// スタート・ストップ切り替え
window.toggleTimer = function() { // HTMLのonclickから呼ぶためwindowに登録
    if (isRunning) {
        stopTimer();
    } else {
        startTimer();
    }
};

// ボタンクリックイベントのリスナー登録（HTMLのonclickを上書きしないように）
startStopBtn.addEventListener('click', window.toggleTimer);


function startTimer() {
    if (mode === 'timer' && elapsedTime === 0 && !isRunning) {
        // タイマーの初期設定値を読み込む
        const h = parseInt(document.getElementById('in-h').value) || 0;
        const m = parseInt(document.getElementById('in-m').value) || 0;
        const s = parseInt(document.getElementById('in-s').value) || 0;
        timerDuration = (h * 3600 + m * 60 + s) * 1000;
        
        if (timerDuration === 0) {
            alert("時間を設定してください");
            return;
        }
    }

    isRunning = true;
    startTime = Date.now();
    
    // アイコンを一時停止に変更
    playIcon.setAttribute('data-lucide', 'pause');
    if(typeof lucide !== 'undefined') lucide.createIcons();
    
    statusLabel.textContent = (mode === 'study') ? "Studying..." : "Running";
    statusLabel.className = "text-[10px] font-bold text-blue-500 tracking-[0.5em] uppercase mt-10 animate-pulse";

    timerInterval = setInterval(tick, 10);
}

function stopTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    
    // 経過時間を保存
    if (mode === 'timer') {
        const now = Date.now();
        const done = now - startTime;
        elapsedTime = 0; // タイマーは一時停止非対応（簡易実装）またはリセット
        timerDuration -= done; // 残り時間を保持する場合は計算が必要
    } else {
        elapsedTime += Date.now() - startTime;
        
        // 勉強モードならデータを保存
        if (mode === 'study') {
            const sessionMs = Date.now() - startTime;
            saveStudyTime(sessionMs);
        }
    }

    // アイコンを再生に変更
    playIcon.setAttribute('data-lucide', 'play');
    if(typeof lucide !== 'undefined') lucide.createIcons();

    statusLabel.textContent = "Paused";
    statusLabel.className = "text-[10px] font-bold text-slate-300 tracking-[0.5em] uppercase mt-10";
}

// 勉強時間の保存
function saveStudyTime(ms) {
    studyStats.total += ms;
    studyStats.today += ms;
    const dayIndex = new Date().getDay(); // 0:日曜日
    studyStats.week[dayIndex] += ms;
    
    localStorage.setItem('studyStats', JSON.stringify(studyStats));
    renderStats();
}

// リセット
window.handleReset = function() {
    stopTimer();
    elapsedTime = 0;
    updateDisplay(0);
    statusLabel.textContent = "Ready";
    
    if (mode === 'study') {
        // 表示を保存された合計値に戻す
        const totalSeconds = Math.floor(studyStats.total / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        totalStudyDisplay.textContent = 
            `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
};

// ラップ（簡易実装：コンソール出力のみ、またはHTMLに追加）
window.handleLap = function() {
    if (!isRunning) return;
    
    const lapTime = (mode === 'timer') ? (Date.now() - startTime) : (Date.now() - startTime + elapsedTime);
    const formatted = formatTime(lapTime);
    
    const li = document.createElement('div');
    li.className = "flex justify-between py-2 border-b border-slate-50 last:border-0";
    li.innerHTML = `<span class="text-slate-400">Lap</span> <span class="font-mono font-bold">${formatted}</span>`;
    
    const list = document.getElementById('lap-list');
    list.prepend(li);
    
    // コンテナを表示
    const container = document.getElementById('lap-container');
    container.style.opacity = "1";
    container.style.pointerEvents = "auto";
    
    // 3秒後にフェードアウト
    setTimeout(() => {
        container.style.opacity = "0";
        container.style.pointerEvents = "none";
    }, 3000);
};

// モード切替
window.changeMode = function(newMode) {
    // 現在のタイマーをストップ
    window.handleReset();
    mode = newMode;
    
    // タブのスタイル更新
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('tab-active', 'text-slate-400', 'text-slate-900');
        if (btn.id === `btn-${newMode}`) {
            btn.classList.add('tab-active');
        } else {
            btn.classList.add('text-slate-400');
        }
    });

    // 表示エリアの切り替え
    if (mode === 'timer') {
        display.classList.add('hidden');
        timerInputs.classList.remove('hidden');
        totalStudyContainer.classList.add('hidden');
    } else if (mode === 'study') {
        display.classList.remove('hidden');
        timerInputs.classList.add('hidden');
        totalStudyContainer.classList.remove('hidden');
        
        // 合計時間を表示
        const totalSeconds = Math.floor(studyStats.total / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        totalStudyDisplay.textContent = 
            `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            
    } else {
        // stopwatch
        display.classList.remove('hidden');
        timerInputs.classList.add('hidden');
        totalStudyContainer.classList.add('hidden');
    }
};

// --- 表示更新系 ---

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const centi = Math.floor((ms % 1000) / 10);
    
    if (m > 59) {
        const h = Math.floor(m / 60);
        const remM = m % 60;
        return `${String(h).padStart(2, '0')}:${String(remM).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(centi).padStart(2, '0')}`;
}

function updateDisplay(ms) {
    display.textContent = formatTime(ms);
}

function updateClockHands(ms) {
    // 秒針のみ動かす簡易実装（1周60秒）
    const totalSeconds = ms / 1000;
    const degrees = (totalSeconds % 60) * 6; // 6度/秒
    mainHand.style.transform = `translateX(-50%) rotate(${degrees}deg)`;
}


// --- UI切り替え機能 ---

window.toggleVisual = function() {
    digitalContainer.classList.toggle('hidden');
    analogClock.classList.toggle('hidden');
};

window.toggleStats = function() {
    const modal = document.getElementById('stats-modal');
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) {
        renderStats();
    }
};

window.toggleSettings = function() {
    document.getElementById('settings-modal').classList.toggle('hidden');
};

window.setBackground = function(type) {
    const bgContainer = document.getElementById('bg-container');
    const animLayer = document.getElementById('anim-layer');
    
    bgContainer.className = '';
    animLayer.className = '';
    bgContainer.style.backgroundImage = '';
    animLayer.innerHTML = '';
    
    if (type === 'waves') {
        bgContainer.classList.add('waves-bg');
        // 波のアニメーション要素を追加
        const wave = document.createElement('div');
        wave.className = 'wave-obj';
        animLayer.appendChild(wave);
    } else if (type === 'trees') {
        bgContainer.classList.add('trees-bg');
        // 葉っぱのアニメーション要素を追加（簡易版）
        for(let i=0; i<5; i++) {
            const leaf = document.createElement('div');
            leaf.className = 'leaf-obj';
            leaf.style.left = Math.random() * 100 + '%';
            leaf.style.width = (20 + Math.random() * 20) + 'px';
            leaf.style.height = leaf.style.width;
            leaf.style.animationDelay = Math.random() * 5 + 's';
            leaf.style.top = Math.random() * 80 + '%';
            animLayer.appendChild(leaf);
        }
    }
    
    window.toggleSettings(); // 閉じる
};

// 画像アップロード
document.getElementById('bg-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('bg-container').style.backgroundImage = `url(${e.target.result})`;
            window.toggleSettings();
        };
        reader.readAsDataURL(file);
    }
});


// --- 統計グラフ描画 (簡易版) ---
function renderStats() {
    const chartWeek = document.getElementById('chart-week');
    chartWeek.innerHTML = '';
    
    const maxVal = Math.max(...studyStats.week, 1); // ゼロ除算防止
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // 棒グラフを描画
    studyStats.week.forEach((val, i) => {
        const heightPercent = (val / maxVal) * 100;
        
        const barContainer = document.createElement('div');
        barContainer.className = "absolute bottom-0 w-8 flex flex-col items-center group";
        barContainer.style.left = `${(i * 14) + 2}%`; // 配置調整
        
        const bar = document.createElement('div');
        bar.className = "w-2 bg-blue-500 rounded-t-sm transition-all duration-500 group-hover:bg-blue-600";
        bar.style.height = `${heightPercent}%`;
        bar.style.minHeight = "4px";
        
        const label = document.createElement('div');
        label.className = "text-[9px] mt-1 text-slate-400";
        label.textContent = days[i];
        
        // ツールチップ的な時間表示
        const tooltip = document.createElement('div');
        tooltip.className = "absolute -top-6 bg-slate-800 text-white text-[9px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50";
        const min = Math.floor(val / 1000 / 60);
        tooltip.textContent = `${min}m`;
        
        barContainer.appendChild(tooltip);
        barContainer.appendChild(bar);
        barContainer.appendChild(label);
        chartWeek.appendChild(barContainer);
    });
    
    document.getElementById('stats-total-label').textContent = 
        `Total: ${Math.floor(studyStats.total / 1000 / 3600)}h ${Math.floor((studyStats.total / 1000 % 3600) / 60)}m`;
        
    const today = new Date();
    document.getElementById('stats-date-label').textContent = 
        `${today.getFullYear()}/${today.getMonth()+1}/${today.getDate()}`;
}

// Statsの日付移動（ダミー機能：現在は表示のみ）
window.moveStatsDate = function(dir) {
    // 本来は日付を管理してデータを再取得するが、今回は簡易実装のため省略
    console.log("Change date:", dir);
};

window.switchStatsMode = function(mode) {
    const btnWeek = document.getElementById('stats-tab-week');
    const btnDay = document.getElementById('stats-tab-day');
    const chartWeek = document.getElementById('chart-week');
    const chartDay = document.getElementById('chart-day');
    
    if (mode === 'week') {
        btnWeek.className = "flex-1 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-900 transition-all";
        btnDay.className = "flex-1 py-2 text-xs font-bold rounded-lg text-slate-400 transition-all";
        chartWeek.classList.remove('hidden');
        chartDay.classList.add('hidden');
    } else {
        btnDay.className = "flex-1 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-900 transition-all";
        btnWeek.className = "flex-1 py-2 text-xs font-bold rounded-lg text-slate-400 transition-all";
        chartWeek.classList.add('hidden');
        chartDay.classList.remove('hidden');
    }
};

// 初期化実行
initStudyApp();