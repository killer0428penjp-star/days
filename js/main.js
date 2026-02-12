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