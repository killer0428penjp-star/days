// 時計 & 天気 & ニュース
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxWmry3zK_z5YxhnQRp-11yqJiXBX4dkVSjbLi7YGIlBznAAQKGv6Ozk9rxhajxdnU/exec';
let allNews = [], currentNewsTab = 'latest'; 
let likedItems = JSON.parse(localStorage.getItem('newsLikes')) || [];

export function initDashboard() {
    updateClock();
    setInterval(updateClock, 1000);
    fetchWeather();
    fetchNews();
    
    // ダークモード
    document.getElementById("modeToggle").addEventListener("change", () => document.body.classList.toggle("dark-mode"));
}

function updateClock() { 
    const now = new Date(); 
    const hours = now.getHours(); 
    document.getElementById("clock").innerHTML = `${String(hours).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:<span class="seconds">${String(now.getSeconds()).padStart(2,"0")}</span>`; 
    const header = document.getElementById("header-bg"); 
    header.style.backgroundImage = (hours >= 6 && hours < 18) ? "url('https://images.unsplash.com/photo-1470252649358-96949c751bd8?q=80&w=1000')" : "url('https://images.unsplash.com/photo-1472552947727-b59a1e809df9?q=80&w=1000')"; 
}

async function fetchWeather() { 
    try { 
        const resOM = await fetch("https://api.open-meteo.com/v1/forecast?latitude=35.6895&longitude=139.6917&current=temperature_2m,relative_humidity_2m,weather_code&hourly=temperature_2m,relative_humidity_2m"); 
        const data = await resOM.json(); 
        const curTemp = Math.round(data.current.temperature_2m), curHum = Math.round(data.current.relative_humidity_2m); 
        const hIdx = new Date().getHours(), prevTemp = Math.round(data.hourly.temperature_2m[hIdx-1]||curTemp), prevHum = Math.round(data.hourly.relative_humidity_2m[hIdx-1]||curHum); 
        
        document.getElementById("temp").textContent = curTemp; 
        const tD = curTemp - prevTemp, tB = document.getElementById("temp-diff"); 
        tB.style.display = "inline-block"; tB.textContent = (tD>=0?"+":"")+tD; tB.className = "diff-badge "+(tD>=0?"diff-up":"diff-down"); 
        
        const hEl = document.getElementById("humidity"); hEl.textContent = curHum; 
        if(curHum<=40){ hEl.style.color="#ff4d4d"; hEl.classList.add("blink"); }else{ hEl.style.color="inherit"; hEl.classList.remove("blink"); } 
        const hD = curHum - prevHum, hB = document.getElementById("hum-diff"); 
        hB.style.display = "inline-block"; hB.textContent = (hD>=0?"+":"")+hD; hB.className = "diff-badge "+(hD>=0?"diff-up":"diff-down"); 
        
        const code = data.current.weather_code; let icon = "☁️"; 
        if(code<=1)icon="☀️"; else if(code<=3)icon="🌤️"; else if(code<=67)icon="🌧️"; else if(code<=82)icon="☔"; 
        document.getElementById("weather-text").textContent = icon; 
    } catch (e) { console.error(e); } 
}

async function fetchNews() { 
    try { 
        const res = await fetch(GAS_URL); const data = await res.json(); 
        allNews = data.map(item => { 
            const d = new Date(item.pubDate); 
            return { id: item.link, title: item.title, link: item.link, rawDate: isNaN(d) ? new Date() : d, date: isNaN(d) ? "NEW" : `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`, img: `https://picsum.photos/seed/${encodeURIComponent(item.title)}/640/360`, count: Math.floor(Math.random() * 5000) }; 
        }); 
        renderFeed(); 
    } catch (e) { document.getElementById('feed').innerText = "ERROR"; } 
}

function renderFeed() { 
    const feed = document.getElementById('feed'); feed.innerHTML = ""; let list = [...allNews]; 
    if (currentNewsTab === 'latest') list.sort((a,b) => b.rawDate - a.rawDate); 
    else if (currentNewsTab === 'popular') list.sort((a,b) => b.count - a.count); 
    else if (currentNewsTab === 'likes') list = allNews.filter(i => likedItems.includes(i.id)); 
    
    list.forEach((item, idx) => { 
        const card = document.createElement('div'), cId = `content-${idx}`; 
        card.className = 'news-card'; 
        card.innerHTML = ` <img src="${item.img}" class="news-img"> <div class="card-body"> <div class="news-title">${item.title}</div> <div id="${cId}" class="news-content">読み込み中...</div> <div class="meta"> <div style="display:flex; gap:15px; align-items:center;"> <button class="btn-like ${likedItems.includes(item.id)?'liked':''}" onclick="toggleLike('${item.id.replace(/'/g, "\\'")}', this)">❤</button> <button class="btn-read" onclick="toggleNewsContent('${item.link}', '${cId}', this)">OPEN</button> </div> <span>${item.date} ${currentNewsTab==='popular'?'🔥'+item.count:''}</span> </div> </div>`; 
        feed.appendChild(card); 
    }); 
}

// Global functions for onclick events in News HTML
window.toggleNewsContent = async function(url, cId, btn) { 
    const card = btn.closest('.news-card'), contentEl = document.getElementById(cId); 
    card.classList.toggle('open'); 
    if (card.classList.contains('open')) { 
        btn.innerText = "CLOSE"; 
        if (!contentEl.getAttribute('data-loaded')) { 
            const res = await fetch(`${GAS_URL}?url=${encodeURIComponent(url)}`); 
            const text = await res.text(); 
            contentEl.innerHTML = `<div>${text}</div><a href="${url}" target="_blank" class="full-link">LINK TO SITE ↗</a>`; 
            contentEl.setAttribute('data-loaded', 'true'); 
        } 
    } else { btn.innerText = "OPEN"; } 
}
window.toggleLike = function(id, btn) { 
    if (likedItems.includes(id)) likedItems = likedItems.filter(i => i !== id); 
    else likedItems.push(id); 
    btn.classList.toggle('liked'); 
    localStorage.setItem('newsLikes', JSON.stringify(likedItems)); 
    if (currentNewsTab === 'likes') renderFeed(); 
}
window.changeNewsTab = function(tab) { 
    currentNewsTab = tab; 
    document.querySelectorAll('.n-tab').forEach(t => t.classList.remove('active')); 
    document.getElementById('tab-' + tab).classList.add('active'); 
    renderFeed(); 
}