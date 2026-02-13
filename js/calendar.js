import { db, collection, getDocs, doc, setDoc, deleteDoc } from "./firebase.js";

/**
 * 指定されたユーザーIDのカレンダーを初期化します
 * @param {string} userId - ログイン中のユーザーID
 */
export async function initCalendar(userId) {
    if (!userId) {
        console.error("ユーザーIDが指定されていません");
        return;
    }

    // ★ 保存先を「users_v11 > {userId} > calendar」に設定
    // これで完全にそのアカウント専用のデータになります
    const userCalendarRef = collection(db, "users_v11", userId, "calendar");

    const holidays = { "2026-1-1":"元日","2026-1-13":"成人の日","2026-2-11":"建国記念の日","2026-2-23":"天皇誕生日","2026-3-21":"春分の日","2026-4-29":"昭和の日","2026-5-3":"憲法記念日","2026-5-4":"みどりの日","2026-5-5":"こどもの日","2026-11-3":"文化の日","2026-11-23":"勤労感謝の日" };
    
    let current = new Date();
    let selectedDate = null;
    let memoCache = {};
    let selectedWeekdays = [];

    // DOM要素の取得
    const daysEl = document.getElementById("days");
    const title = document.getElementById("cal-title");
    const memoText = document.getElementById("memo-text");
    const memoDate = document.getElementById("memo-date");
    const statusMsg = document.getElementById("status-msg");

    // ステータス表示
    function showStatus(text){ 
        if(!statusMsg) return;
        statusMsg.textContent=text; 
        setTimeout(()=>statusMsg.textContent="", 2000); 
    }

    // 曜日選択のクリックイベント設定
    document.querySelectorAll("#weekdays div").forEach(d => {
        d.onclick = () => {
            const w = parseInt(d.dataset.dow);
            if (selectedWeekdays.includes(w)) {
                selectedWeekdays = selectedWeekdays.filter(x => x !== w);
                d.classList.remove("selected-week");
            } else {
                selectedWeekdays.push(w);
                d.classList.add("selected-week");
            }
        };
    });

    // Firestoreからデータを読み込む
    async function loadMemos() {
        memoCache = {};
        try {
            const snap = await getDocs(userCalendarRef);
            snap.forEach(d => memoCache[d.id] = d.data());
            updateTopTodayMemo(); // 今日の予定表示を更新
        } catch (e) {
            console.error("カレンダー読み込みエラー:", e);
        }
    }
  
    // 画面上部の「今日の予定」バーを更新する機能
    function updateTopTodayMemo() {
        const headerEl = document.getElementById("today-memo-top-header");
        const innerTop = document.getElementById("today-memo-top");
        const now = new Date();
        const keys = [
            `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,
            `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`
        ];
        
        let memoData = null;
        for (const k of keys) { if (memoCache[k]) { memoData = memoCache[k]; break; } }
        
        const rawText = memoData?.text || "なし";
        const firstLine = rawText.split("\n")[0];

        // メイン画面のヘッダーバー制御
        if (headerEl) {
            const textEl = headerEl.querySelector(".today-bar-text");
            const btn = headerEl.querySelector(".today-more-btn");
            if(rawText !== "なし" && rawText.trim() !== "") {
                headerEl.style.display = "flex";
                textEl.textContent = firstLine;
                if(rawText.split("\n").length > 1) {
                    btn.style.display = "inline-block";
                    btn.onclick = (e) => { 
                        e.preventDefault(); 
                        const isOpen = headerEl.classList.toggle("open"); 
                        textEl.textContent = isOpen ? rawText : firstLine; 
                        btn.textContent = isOpen ? "元に戻す" : "もっと見る"; 
                    };
                } else { btn.style.display = "none"; }
            } else {
                headerEl.style.display = "none";
            }
        }

        // カレンダー内部の表示制御
        if(innerTop) {
            innerTop.textContent = `今日の予定: ${firstLine}`;
        }
    }

    // カレンダー描画
    function renderCalendar() {
        if(!daysEl) return;
        daysEl.innerHTML = "";
        const y = current.getFullYear(), m = current.getMonth();
        if(title) title.textContent = `${y}年 ${m+1}月`;
        
        const first = new Date(y, m, 1).getDay();
        const last = new Date(y, m+1, 0).getDate();
        const today = new Date();

        for(let i=0; i<first; i++) daysEl.appendChild(document.createElement("div"));

        for(let d=1; d<=last; d++) {
            const el = document.createElement("div");
            el.textContent = d;
            const key = `${y}-${m+1}-${d}`;
            const dow = new Date(y, m, d).getDay();

            if(dow===0) el.classList.add("sunday");
            if(dow===6) el.classList.add("saturday");
            
            if(holidays[key]) {
                el.classList.add("holiday");
                el.innerHTML += `<div class="holiday-label">${holidays[key]}</div>`;
            }
            if(memoCache[key]) {
                el.classList.add(memoCache[key].important ? "memo-day-important" : "memo-day");
            }
            if(d===today.getDate() && m===today.getMonth() && y===today.getFullYear()) el.classList.add("today");

            el.onclick = () => {
                document.querySelectorAll(".days div").forEach(e => e.classList.remove("selected"));
                el.classList.add("selected");
                selectedDate = key;
                if(memoDate) memoDate.textContent = `${key} のメモ`;
                if(memoText) memoText.value = memoCache[key] ? memoCache[key].text : "";
            };
            daysEl.appendChild(el);
        }
    }

    // 保存ボタン処理
    async function handleSave(isImportant) {
        if(!selectedDate || !memoText.value.trim()) return;
        const text = memoText.value.trim();
        const [y, mStr] = selectedDate.split("-");
        const yNum = parseInt(y), mNum = parseInt(mStr);
        const repeatCheck = document.getElementById("repeat-checkbox");
        const repeat = repeatCheck ? repeatCheck.checked : false;
        const data = { text, important: isImportant };

        if(!repeat || selectedWeekdays.length === 0) {
            // 単発保存
            await setDoc(doc(userCalendarRef, selectedDate), data);
        } else {
            // 繰り返し保存（3ヶ月分）
            for(let mo = mNum - 1; mo < mNum + 2; mo++) {
                const yy = yNum + Math.floor(mo/12);
                const mm = (mo + 12) % 12;
                const last = new Date(yy, mm + 1, 0).getDate();
                for(let d = 1; d <= last; d++) {
                    if(selectedWeekdays.includes(new Date(yy, mm, d).getDay())) {
                        await setDoc(doc(userCalendarRef, `${yy}-${mm+1}-${d}`), data);
                    }
                }
            }
        }
        await loadMemos();
        renderCalendar();
        showStatus(isImportant ? "大事に保存しました" : "保存しました");
    }
  
    // ボタンのイベントリスナー設定
    const saveBtn = document.getElementById("save-btn");
    const impBtn = document.getElementById("important-btn");
    const delBtn = document.getElementById("delete-btn");
    const delAllBtn = document.getElementById("delete-all-btn");
    const prevBtn = document.getElementById("prev");
    const nextBtn = document.getElementById("next");

    if(saveBtn) saveBtn.onclick = () => handleSave(false);
    if(impBtn) impBtn.onclick = () => handleSave(true);
    
    if(delBtn) delBtn.onclick = async () => {
        if(!selectedDate) return;
        await deleteDoc(doc(userCalendarRef, selectedDate));
        await loadMemos();
        renderCalendar();
        showStatus("削除しました");
    };
    
    if(delAllBtn) delAllBtn.onclick = async () => {
        if(!confirm("本当にこのカレンダーの全データを削除しますか？")) return;
        const snap = await getDocs(userCalendarRef);
        for(const d of snap.docs) await deleteDoc(d.ref);
        await loadMemos();
        renderCalendar();
        showStatus("全削除しました");
    };

    if(prevBtn) prevBtn.onclick = async () => { current.setMonth(current.getMonth()-1); await loadMemos(); renderCalendar(); };
    if(nextBtn) nextBtn.onclick = async () => { current.setMonth(current.getMonth()+1); await loadMemos(); renderCalendar(); };

    // 初期化実行
    await loadMemos();
    renderCalendar();
}