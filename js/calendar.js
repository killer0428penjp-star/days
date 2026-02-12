import { db, collection, getDocs, doc, setDoc, deleteDoc } from "./firebase-config.js";

const daysEl = document.getElementById("days");
const title = document.getElementById("cal-title");
const memoText = document.getElementById("memo-text");
const memoDate = document.getElementById("memo-date");
const statusMsg = document.getElementById("status-msg");
const holidays = { "2026-1-1":"元日","2026-1-13":"成人の日", "2026-2-11":"建国記念の日", "2026-2-23":"天皇誕生日", "2026-3-20":"春分の日", "2026-4-29":"昭和の日", "2026-5-3":"憲法記念日", "2026-5-4":"みどりの日", "2026-5-5":"こどもの日", "2026-7-20":"海の日", "2026-8-11":"山の日", "2026-9-21":"敬老の日", "2026-9-22":"国民の休日", "2026-9-23":"秋分の日", "2026-10-12":"スポーツの日", "2026-11-3":"文化の日", "2026-11-23":"勤労感謝の日" };

let current = new Date();
let selectedDate = null;
let memoCache = {};
let selectedWeekdays = [];

export async function loadMemos() {
    memoCache = {};
    const snap = await getDocs(collection(db, "memos"));
    snap.forEach(d => memoCache[d.id] = d.data());
    renderCalendar();
}

function renderCalendar(){ 
    daysEl.innerHTML=""; 
    const y=current.getFullYear(), m=current.getMonth(); 
    title.textContent=`${y}年 ${m+1}月`; 
    const first=new Date(y,m,1).getDay(), last=new Date(y,m+1,0).getDate(), today=new Date(); 
    
    for(let i=0;i<first;i++) daysEl.appendChild(document.createElement("div")); 
    
    for(let d=1;d<=last;d++){ 
        const el=document.createElement("div"); 
        el.textContent=d; 
        const key=`${y}-${m+1}-${d}`, dow=new Date(y,m,d).getDay(); 
        
        if(dow===0) el.classList.add("sunday"); 
        if(dow===6) el.classList.add("saturday"); 
        if(holidays[key]){ 
            el.classList.add("holiday"); 
            el.innerHTML+=`<div class="holiday-label">${holidays[key]}</div>`; 
        } 
        if(memoCache[key] && memoCache[key].important) el.classList.add("memo-day-important"); 
        if(d===today.getDate()&&m===today.getMonth()&&y===today.getFullYear()) el.classList.add("today"); 
        
        el.onclick=()=>{ 
            document.querySelectorAll(".days div").forEach(e=>e.classList.remove("selected")); 
            el.classList.add("selected"); 
            selectedDate=key; 
            memoDate.textContent=key; 
            memoText.value=memoCache[key] ? memoCache[key].text : ""; 
        }; 
        daysEl.appendChild(el); 
    } 
}

function showStatus(msg) { statusMsg.textContent = msg; setTimeout(()=>statusMsg.textContent="", 2000); }

async function handleSave(isImportant) { 
    if(!selectedDate || !memoText.value.trim()) return; 
    const text=memoText.value.trim(), [y,m]=selectedDate.split("-").map(Number), repeat=document.getElementById("repeat-checkbox").checked; 
    const data = { text, important: isImportant }; 
    
    if(!repeat||selectedWeekdays.length===0){ 
        await setDoc(doc(db,"memos",selectedDate), data); 
    }else{ 
        for(let mo=m-1;mo<m+2;mo++){ 
            const yy=y+Math.floor(mo/12), mm=(mo+12)%12, last=new Date(yy,mm+1,0).getDate(); 
            for(let d=1;d<=last;d++) if(selectedWeekdays.includes(new Date(yy,mm,d).getDay())) await setDoc(doc(db,"memos",`${yy}-${mm+1}-${d}`), data); 
        } 
    } 
    await loadMemos(); 
    showStatus(isImportant ? "大事に保存しました" : "保存しました"); 
}

// イベントリスナー設定
document.getElementById("save-btn").onclick=()=>handleSave(false);
document.getElementById("important-btn").onclick=()=>handleSave(true);
document.getElementById("delete-btn").onclick=async()=>{ if(!selectedDate) return; await deleteDoc(doc(db,"memos",selectedDate)); await loadMemos(); showStatus("削除しました"); };
document.getElementById("delete-all-btn").onclick=async()=>{ if(!confirm("本当にすべて削除しますか？")) return; const snap=await getDocs(collection(db,"memos")); for(const d of snap.docs) await deleteDoc(d.ref); await loadMemos(); showStatus("全削除しました"); };
document.getElementById("prev").onclick=()=>{ current.setMonth(current.getMonth()-1); loadMemos(); };
document.getElementById("next").onclick=()=>{ current.setMonth(current.getMonth()+1); loadMemos(); };