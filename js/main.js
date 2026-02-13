import { initClockAndWeather } from "./clock.js";
import { initNews } from "./news.js";
import { initCalendar } from "./calendar.js";
import { initNeoPod } from "./neopod.js";

// 全てのモジュールを初期化
initClockAndWeather();
initNews();
initCalendar();
initNeoPod();

// タブ切り替え制御（全体共通）
document.querySelectorAll(".tag").forEach(tag => {
    tag.addEventListener("click", () => {
        document.querySelectorAll(".tag").forEach(t => t.classList.remove("active"));
        tag.classList.add("active");
        
        document.getElementById("news-feed-container").style.display = (tag.id === "news-tag" || tag.innerText === "news") ? "block" : "none";
        document.getElementById("calendar-container").style.display = tag.id === "calendar-tag" ? "block" : "none";
        document.getElementById("tolk-screen").style.display = (tag.id === "tolk-tag" || tag.innerText === "tolk") ? "block" : "none";
    });
});
function updateDateDisplay() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    const day = dayNames[now.getDay()];

    const dateEl = document.getElementById("current-date");
    const dayEl = document.getElementById("current-day");

    if (dateEl) dateEl.textContent = `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    if (dayEl) dayEl.textContent = day;
}

// 初期化時と、1分ごと（あるいは時計更新時）に実行するように設定
updateDateDisplay();
setInterval(updateDateDisplay, 60000);