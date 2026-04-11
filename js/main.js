import { initClockAndWeather } from "./clock.js";
import { initNews }            from "./news.js";
import { initCalendar }        from "./calendar.js";
import { initNeoPod }          from "./neopod.js";

// ===== モジュール初期化 =====
initClockAndWeather();
initNews();
initCalendar();
initNeoPod();

// ===== 日付表示 =====
function updateDateDisplay() {
    const now      = new Date();
    const y        = now.getFullYear();
    const m        = String(now.getMonth() + 1).padStart(2, "0");
    const d        = String(now.getDate()).padStart(2, "0");
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

    const dateEl = document.getElementById("current-date");
    const dayEl  = document.getElementById("current-day");
    if (dateEl) dateEl.textContent = `${y}/${m}/${d}`;
    if (dayEl)  dayEl.textContent  = dayNames[now.getDay()];
}
updateDateDisplay();
setInterval(updateDateDisplay, 60000);

// ===== タブ切り替え（全体一元管理） =====
const TAB_MAP = {
    "news-tag":     "news-feed-container",
    "study-tag":    "study-container",
    "tolk-tag":     "tolk-screen",
    "calendar-tag": "calendar-container",
};

// グローバルに公開（neopod.js のログイン後にも使う）
window.showTab = function(activeTagId) {
    // 全タグ active 解除
    document.querySelectorAll(".tag").forEach(t => t.classList.remove("active"));

    // 全コンテナ非表示
    Object.values(TAB_MAP).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    // 対象タグを active に
    const activeTag = document.getElementById(activeTagId);
    if (activeTag) activeTag.classList.add("active");

    // 対応コンテナを表示
    const targetId = TAB_MAP[activeTagId];
    if (targetId) {
        const el = document.getElementById(targetId);
        if (el) el.style.display = "block";
    }
};

// 初期表示: news
window.showTab("news-tag");

// 各タグにクリック設定
document.querySelectorAll(".tag").forEach(tag => {
    tag.addEventListener("click", () => window.showTab(tag.id));
});