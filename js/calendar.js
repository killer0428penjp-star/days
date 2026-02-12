import { db, collection, getDocs, doc, setDoc, deleteDoc } from "./firebase.js";

export async function initCalendar() {
  const holidays = { "2026-1-1":"元日","2026-1-13":"成人の日","2026-2-11":"建国記念の日","2026-2-23":"天皇誕生日","2026-3-21":"春分の日","2026-4-29":"昭和の日","2026-5-3":"憲法記念日","2026-5-4":"みどりの日","2026-5-5":"こどもの日","2026-11-3":"文化の日","2026-11-23":"勤労感謝の日" };
  let current=new Date(), selectedDate=null, memoCache={}, selectedWeekdays=[];
  const daysEl=document.getElementById("days"), title=document.getElementById("cal-title"), memoText=document.getElementById("memo-text"), memoDate=document.getElementById("memo-date"), statusMsg=document.getElementById("status-msg");

  function showStatus(text){ statusMsg.textContent=text; setTimeout(()=>statusMsg.textContent="",2000); }
  document.querySelectorAll("#weekdays div").forEach(d=>{ d.onclick=()=>{ const w=parseInt(d.dataset.dow); if(selectedWeekdays.includes(w)){ selectedWeekdays=selectedWeekdays.filter(x=>x!==w); d.classList.remove("selected-week"); }else{ selectedWeekdays.push(w); d.classList.add("selected-week"); } }; });

  async function loadMemos(){ memoCache={}; const snap=await getDocs(collection(db,"memos")); snap.forEach(d=>memoCache[d.id]=d.data()); updateTopTodayMemo(); }
  
  function updateTopTodayMemo() {
    const headerEl = document.getElementById("today-memo-top-header");
    if (!headerEl) return;
    const textEl = headerEl.querySelector(".today-bar-text");
    const btn = headerEl.querySelector(".today-more-btn");
    const now = new Date();
    const keys = [`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`, `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`];
    let memoData = null;
    if (memoCache) { for (const k of keys) { if (memoCache[k]) { memoData = memoCache[k]; break; } } }
    const rawText = memoData?.text || "";
    if (!rawText.trim()) { headerEl.style.display = "none"; return; }
    const lines = rawText.split("\n");
    textEl.textContent = lines[0];
    headerEl.classList.remove("open");
    headerEl.style.display = "flex";
    if (lines.length > 1) {
      btn.style.display = "inline-block"; btn.textContent = "もっと見る";
      btn.onclick = (e) => { e.preventDefault(); const isOpen = headerEl.classList.toggle("open"); if (isOpen) { textEl.textContent = rawText; btn.textContent = "元に戻す"; } else { textEl.textContent = lines[0]; btn.textContent = "もっと見る"; } };
    } else { btn.style.display = "none"; }
  }

  function renderCalendar(){ daysEl.innerHTML=""; const y=current.getFullYear(), m=current.getMonth(); title.textContent=`${y}年 ${m+1}月`; const first=new Date(y,m,1).getDay(), last=new Date(y,m+1,0).getDate(), today=new Date(); for(let i=0;i<first;i++) daysEl.appendChild(document.createElement("div")); for(let d=1;d<=last;d++){ const el=document.createElement("div"); el.textContent=d; const key=`${y}-${m+1}-${d}`, dow=new Date(y,m,d).getDay(); if(dow===0) el.classList.add("sunday"); if(dow===6) el.classList.add("saturday"); if(holidays[key]){ el.classList.add("holiday"); el.innerHTML+=`<div class="holiday-label">${holidays[key]}</div>`; } if(memoCache[key] && memoCache[key].important) el.classList.add("memo-day-important"); if(d===today.getDate()&&m===today.getMonth()&&y===today.getFullYear()) el.classList.add("today"); el.onclick=()=>{ document.querySelectorAll(".days div").forEach(e=>e.classList.remove("selected")); el.classList.add("selected"); selectedDate=key; memoDate.textContent=key; memoText.value=memoCache[key] ? memoCache[key].text : ""; }; daysEl.appendChild(el); } }
  async function handleSave(isImportant) { if(!selectedDate || !memoText.value.trim()) return; const text=memoText.value.trim(), [y,m]=selectedDate.split("-").map(Number), repeat=document.getElementById("repeat-checkbox").checked; const data = { text, important: isImportant }; if(!repeat||selectedWeekdays.length===0){ await setDoc(doc(db,"memos",selectedDate), data); }else{ for(let mo=m-1;mo<m+2;mo++){ const yy=y+Math.floor(mo/12), mm=(mo+12)%12, last=new Date(yy,mm+1,0).getDate(); for(let d=1;d<=last;d++) if(selectedWeekdays.includes(new Date(yy,mm,d).getDay())) await setDoc(doc(db,"memos",`${yy}-${mm+1}-${d}`), data); } } await loadMemos(); renderCalendar(); showStatus(isImportant ? "大事に保存しました" : "保存しました"); }
  
  document.getElementById("save-btn").onclick=()=>handleSave(false); document.getElementById("important-btn").onclick=()=>handleSave(true);
  document.getElementById("delete-btn").onclick=async()=>{ if(!selectedDate) return; await deleteDoc(doc(db,"memos",selectedDate)); await loadMemos(); renderCalendar(); showStatus("削除しました"); };
  document.getElementById("delete-all-btn").onclick=async()=>{ if(!confirm("本当にすべて削除しますか？")) return; const snap=await getDocs(collection(db,"memos")); for(const d of snap.docs) await deleteDoc(d.ref); await loadMemos(); renderCalendar(); showStatus("全削除しました"); };
  document.getElementById("prev").onclick=async()=>{ current.setMonth(current.getMonth()-1); await loadMemos(); renderCalendar(); };
  document.getElementById("next").onclick=async()=>{ current.setMonth(current.getMonth()+1); await loadMemos(); renderCalendar(); };
  await loadMemos(); renderCalendar();
}