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

        document.getElementById("news-feed-container").style.display  = "none";
        document.getElementById("calendar-container").style.display   = "none";
        document.getElementById("tolk-screen").style.display          = "none";
        document.getElementById("study-container").style.display      = "none";

        if (tag.id === "news-tag")      document.getElementById("news-feed-container").style.display  = "block";
        if (tag.id === "study-tag")     document.getElementById("study-container").style.display      = "block";
        if (tag.id === "tolk-tag")      document.getElementById("tolk-screen").style.display          = "block";
        if (tag.id === "calendar-tag")  document.getElementById("calendar-container").style.display   = "block";
    });
});

// 日付表示
function updateDateDisplay() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    const day = dayNames[now.getDay()];

    const dateEl = document.getElementById("current-date");
    const dayEl  = document.getElementById("current-day");

    if (dateEl) dateEl.textContent = `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    if (dayEl)  dayEl.textContent  = day;
}

updateDateDisplay();
setInterval(updateDateDisplay, 60000);