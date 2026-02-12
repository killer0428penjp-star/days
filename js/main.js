import { loadMemos } from "./calendar.js";
import { initDashboard } from "./dashboard.js";
import { initNeoPod } from "./neopod.js";

// 各機能の初期化
loadMemos();
initDashboard();
initNeoPod();

// メインタブの切り替え処理
document.querySelectorAll(".tag").forEach(tag => { 
  tag.addEventListener("click", () => { 
    document.querySelectorAll(".tag").forEach(t => t.classList.remove("active")); 
    tag.classList.add("active"); 
    
    // 表示エリアの制御
    const newsEl = document.getElementById("news-feed-container");
    const calEl = document.getElementById("calendar-container");
    const tolkEl = document.getElementById("tolk-screen");
    
    if (tag.id === "news-tag") {
      newsEl.style.display = "block";
      calEl.style.display = "none";
      tolkEl.style.display = "none";
    } else if (tag.id === "calendar-tag") {
      newsEl.style.display = "none";
      calEl.style.display = "block";
      tolkEl.style.display = "none";
    } else if (tag.id === "tolk-tag") {
      newsEl.style.display = "none";
      calEl.style.display = "none";
      tolkEl.style.display = "block";
    } else {
      // その他（study, others）はとりあえず全部隠す、または拡張用に空けておく
      newsEl.style.display = "none";
      calEl.style.display = "none";
      tolkEl.style.display = "none";
    }
  }); 
});