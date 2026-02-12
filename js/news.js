const GAS_URL = 'https://script.google.com/macros/s/AKfycbxWmry3zK_z5YxhnQRp-11yqJiXBX4dkVSjbLi7YGIlBznAAQKGv6Ozk9rxhajxdnU/exec';
let allNews = [], currentNewsTab = 'latest'; 
let likedItems = JSON.parse(localStorage.getItem('newsLikes')) || [];

export function initNews() {
  async function fetchNews() { try { const res = await fetch(GAS_URL); const data = await res.json(); allNews = data.map(item => { const d = new Date(item.pubDate); return { id: item.link, title: item.title, link: item.link, rawDate: isNaN(d) ? new Date() : d, date: isNaN(d) ? "NEW" : `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`, img: `https://picsum.photos/seed/${encodeURIComponent(item.title)}/640/360`, count: Math.floor(Math.random() * 5000) }; }); renderFeed(); } catch (e) { document.getElementById('feed').innerText = "ERROR"; } }
  
  function renderFeed() { const feed = document.getElementById('feed'); feed.innerHTML = ""; let list = [...allNews]; if (currentNewsTab === 'latest') list.sort((a,b) => b.rawDate - a.rawDate); else if (currentNewsTab === 'popular') list.sort((a,b) => b.count - a.count); else if (currentNewsTab === 'likes') list = allNews.filter(i => likedItems.includes(i.id)); list.forEach((item, idx) => { const card = document.createElement('div'), cId = `content-${idx}`; card.className = 'news-card'; card.innerHTML = ` <img src="${item.img}" class="news-img"> <div class="card-body"> <div class="news-title">${item.title}</div> <div id="${cId}" class="news-content">読み込み中...</div> <div class="meta"> <div style="display:flex; gap:15px; align-items:center;"> <button class="btn-like ${likedItems.includes(item.id)?'liked':''}" onclick="toggleLike('${item.id.replace(/'/g, "\\'")}', this)">❤</button> <button class="btn-read" onclick="toggleNewsContent('${item.link}', '${cId}', this)">OPEN</button> </div> <span>${item.date} ${currentNewsTab==='popular'?'🔥'+item.count:''}</span> </div> </div>`; feed.appendChild(card); }); }

  window.toggleNewsContent = async function(url, cId, btn) { const card = btn.closest('.news-card'), contentEl = document.getElementById(cId); card.classList.toggle('open'); if (card.classList.contains('open')) { btn.innerText = "CLOSE"; if (!contentEl.getAttribute('data-loaded')) { const res = await fetch(`${GAS_URL}?url=${encodeURIComponent(url)}`); const text = await res.text(); contentEl.innerHTML = `<div>${text}</div><a href="${url}" target="_blank" class="full-link">LINK TO SITE ↗</a>`; contentEl.setAttribute('data-loaded', 'true'); } } else { btn.innerText = "OPEN"; } }
  window.toggleLike = function(id, btn) { if (likedItems.includes(id)) likedItems = likedItems.filter(i => i !== id); else likedItems.push(id); btn.classList.toggle('liked'); localStorage.setItem('newsLikes', JSON.stringify(likedItems)); if (currentNewsTab === 'likes') renderFeed(); }
  window.changeNewsTab = function(tab) { currentNewsTab = tab; document.querySelectorAll('.n-tab').forEach(t => t.classList.remove('active')); document.getElementById('tab-' + tab).classList.add('active'); renderFeed(); }
  document.getElementById("tab-latest").onclick = () => window.changeNewsTab('latest');
  document.getElementById("tab-popular").onclick = () => window.changeNewsTab('popular');
  document.getElementById("tab-likes").onclick = () => window.changeNewsTab('likes');
  
  fetchNews();
}