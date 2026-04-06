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
// 要素の取得
const studyTag = document.getElementById('study-tag');
const studyContainer = document.getElementById('study-container');

// studyタグがクリックされた時の処理
studyTag.addEventListener('click', () => {
    // 1. 全てのタグの 'active' クラスを外して、studyをアクティブにする
    document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
    studyTag.classList.add('active');

    // 2. 他の画面（コンテナ）を非表示にする
    document.getElementById('news-feed-container').style.display = 'none';
    document.getElementById('calendar-container').style.display = 'none';
    document.getElementById('tolk-screen').style.display = 'none';
    // ※ othersコンテナがあればそれも非表示にする

    // 3. studyコンテナを表示する
    studyContainer.style.display = 'block'; 
});