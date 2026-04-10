export function initClockAndWeather() {
  function updateClock() { const now = new Date(); const hours = now.getHours(); document.getElementById("clock").innerHTML = `${String(hours).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:<span class="seconds">${String(now.getSeconds()).padStart(2,"0")}</span>`; const header = document.getElementById("header-bg"); header.style.backgroundImage = (hours >= 6 && hours < 18) ? "url('https://images.unsplash.com/photo-1470252649358-96949c751bd8?q=80&w=1000')" : "url('https://images.unsplash.com/photo-1472552947727-b59a1e809df9?q=80&w=1000')"; }
  setInterval(updateClock, 1000); updateClock();

  // ダークモード切替 + localStorage保存 + iframeへpostMessage
  const toggle = document.getElementById("modeToggle");

  function sendDarkModeToIframe(isDark) {
    // study iframe
    const studyFrame = document.querySelector("#study-container iframe");
    if (studyFrame && studyFrame.contentWindow) {
      studyFrame.contentWindow.postMessage({ type: "darkMode", value: isDark }, "*");
    }
    // others iframe
    const othersFrame = document.querySelector("#others-container iframe");
    if (othersFrame && othersFrame.contentWindow) {
      othersFrame.contentWindow.postMessage({ type: "darkMode", value: isDark }, "*");
    }
  }

  // 親ページのダークモードを適用する関数（other.html からの postMessage でも使う）
  function applyDarkMode(isDark) {
    document.body.classList.toggle("dark-mode", isDark);
    localStorage.setItem("darkMode", isDark);
    if (toggle) toggle.checked = isDark;
    sendDarkModeToIframe(isDark);
  }

  if (toggle) {
    toggle.addEventListener("change", () => {
      applyDarkMode(toggle.checked);
    });
  }

  // リロード後に復元
  const saved = localStorage.getItem("darkMode") === "true";
  if (saved) {
    document.body.classList.add("dark-mode");
    if (toggle) toggle.checked = true;
  }

  // iframeが読み込まれたタイミングでも送る
  window.addEventListener("load", () => {
    const studyFrame = document.querySelector("#study-container iframe");
    if (studyFrame) {
      studyFrame.addEventListener("load", () => {
        sendDarkModeToIframe(localStorage.getItem("darkMode") === "true");
      });
    }
    const othersFrame = document.querySelector("#others-container iframe");
    if (othersFrame) {
      othersFrame.addEventListener("load", () => {
        sendDarkModeToIframe(localStorage.getItem("darkMode") === "true");
      });
    }
  });

  // other.html からの postMessage を受け取る
  // （index.html側の<script>ブロックでも処理しているが、clock.js側でも対応）
  window.addEventListener("message", (e) => {
    if (!e.data || !e.data.type) return;

    // DARK_MODE スイッチ → 親のダークモードを切り替え
    if (e.data.type === "setDarkMode") {
      applyDarkMode(e.data.value);
    }

    // NOTIFICATIONS スイッチ → 右上の切替ボタンの表示/非表示
    if (e.data.type === "setNotifications") {
      const switchContainer = document.getElementById("main-switch-container");
      if (switchContainer) {
        switchContainer.style.display = e.data.value ? "" : "none";
      }
    }
  });

  async function fetchWeather() { try { const resOM = await fetch("https://api.open-meteo.com/v1/forecast?latitude=35.6895&longitude=139.6917&current=temperature_2m,relative_humidity_2m,weather_code&hourly=temperature_2m,relative_humidity_2m"); const data = await resOM.json(); const curTemp = Math.round(data.current.temperature_2m), curHum = Math.round(data.current.relative_humidity_2m); const hIdx = new Date().getHours(), prevTemp = Math.round(data.hourly.temperature_2m[hIdx-1]||curTemp), prevHum = Math.round(data.hourly.relative_humidity_2m[hIdx-1]||curHum); document.getElementById("temp").textContent = curTemp; const tD = curTemp - prevTemp, tB = document.getElementById("temp-diff"); tB.style.display = "inline-block"; tB.textContent = (tD>=0?"+":"")+tD; tB.className = "diff-badge "+(tD>=0?"diff-up":"diff-down"); const hEl = document.getElementById("humidity"); hEl.textContent = curHum; if(curHum<=40){ hEl.style.color="#ff4d4d"; hEl.classList.add("blink"); }else{ hEl.style.color="inherit"; hEl.classList.remove("blink"); } const hD = curHum - prevHum, hB = document.getElementById("hum-diff"); hB.style.display = "inline-block"; hB.textContent = (hD>=0?"+":"")+hD; hB.className = "diff-badge "+(hD>=0?"diff-up":"diff-down"); const code = data.current.weather_code; let icon = "☁️"; if(code<=1)icon="☀️"; else if(code<=3)icon="🌤️"; else if(code<=67)icon="🌧️"; else if(code<=82)icon="☔"; document.getElementById("weather-text").textContent = icon; } catch (e) { console.error(e); } }
  fetchWeather();
}