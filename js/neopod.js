import { db, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, orderBy, onSnapshot, serverTimestamp, limit, addDoc, getDoc, arrayUnion } from "./firebase.js";

let me = null;
let currentEditRoomId = null;
let currentRoomId = null; 
let chatUnsubscribe = null; 
const DEFAULT_IMG = "https://placehold.jp/24/cccccc/ffffff/200x200.png?text=NoImage";

export function initNeoPod() {
    async function login(id, pw, auto = false) {
        const s = await getDoc(doc(db, "users_v11", id));
        if(!s.exists() || s.data().pw !== pw) {
            if(!auto) document.getElementById('auth-err').innerText = "IDまたはパスワードが正しくありません";
            if(auto && !s.exists()) removeFromHistory(id);
            return;
        }
        me = s.data(); me.id = id;
        if(!me.icon) me.icon = { val: DEFAULT_IMG };

        // セッション保存と履歴更新
        localStorage.setItem('np_session', JSON.stringify({id, pw, expire: Date.now() + (7*24*60*60*1000)}));
        const history = JSON.parse(localStorage.getItem('np_account_history') || '[]');
        const newHistory = [{id, pw, name:me.name, icon:me.icon.val}, ...history.filter(a=>a.id!==id)].slice(0,5);
        localStorage.setItem('np_account_history', JSON.stringify(newHistory));
        
        // --- ★ここから追加：固定ヘッダー（右上）を常に表示する設定 ---
        const fixedHeader = document.getElementById('neo-fixed-header');
        if (fixedHeader) {
            fixedHeader.style.display = "flex"; // 非表示を解除
            const fixedIcon = document.getElementById('my-profile-btn-fixed');
            const fixedName = document.getElementById('my-name-display-fixed');
            if(fixedIcon) fixedIcon.src = me.icon.val;
            if(fixedName) fixedName.innerText = me.name;
        }
        // --- ★ここまで ---

        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        
        // 自動ログイン時などで画面が切り替わらないよう、タグの状態を確認して表示
        if (!auto) {
            document.querySelectorAll(".tag").forEach(t => t.classList.remove("active"));
            const talkTag = document.getElementById("tolk-tag"); 
            if (talkTag) talkTag.classList.add("active");
            document.getElementById("news-feed-container").style.display = "none";
            document.getElementById("calendar-container").style.display = "none";
            document.getElementById("tolk-screen").style.display = "block";
        }
        
        document.getElementById("header-bg").style.display = "flex"; 
        document.getElementById('my-profile-btn').src = me.icon.val;
        document.getElementById('my-name-display').innerText = me.name;
        window.showNeoScreen('rooms');
    }

    function removeFromHistory(id) { const history = JSON.parse(localStorage.getItem('np_account_history') || '[]'); const filtered = history.filter(a => a.id !== id); localStorage.setItem('np_account_history', JSON.stringify(filtered)); renderHistory(); }
    function renderHistory() { const history = JSON.parse(localStorage.getItem('np_account_history') || '[]'); const area = document.getElementById('acc-history-area'); const list = document.getElementById('acc-history-list'); list.innerHTML = ""; if(history.length > 0) { area.classList.remove('hidden'); history.forEach(acc => { const div = document.createElement('div'); div.className = 'acc-item'; div.innerHTML = `<img src="${acc.icon || DEFAULT_IMG}"><span>${acc.name}</span>`; div.onclick = () => login(acc.id, acc.pw); list.appendChild(div); }); } else { area.classList.add('hidden'); } }

    window.np_logout = () => { localStorage.removeItem('np_session'); location.reload(); };
    window.execDeleteAccount = async () => { if(!confirm("本当に削除しますか？")) return; const targetId = me.id; await deleteDoc(doc(db, "users_v11", targetId)); removeFromHistory(targetId); window.np_logout(); };

    document.getElementById('login-btn').onclick = () => login(document.getElementById('auth-id').value.trim(), document.getElementById('auth-pw').value.trim());
    document.getElementById('signup-exec-btn').onclick = async () => { const id = document.getElementById('auth-id').value.trim(); const pw = document.getElementById('auth-pw').value.trim(); const name = document.getElementById('signup-name').value.trim() || id; if(!id || !pw) return; const check = await getDoc(doc(db, "users_v11", id)); if(check.exists()) { document.getElementById('auth-err').innerText = "このIDは既に使用されています"; return; } await setDoc(doc(db, "users_v11", id), { id, pw, name, icon: {val: DEFAULT_IMG}, createdAt: serverTimestamp() }); login(id, pw); };

    const session = JSON.parse(localStorage.getItem('np_session'));
    if (session && session.expire > Date.now()) { login(session.id, session.pw, true); } 
    else { document.getElementById('main-content').classList.add('hidden'); document.getElementById('auth-screen').classList.remove('hidden'); }
    renderHistory();

    window.showNeoScreen = (mode) => {
        document.getElementById('rooms-screen').classList.add('hidden'); document.getElementById('friends-screen').classList.add('hidden'); document.getElementById('chat-screen').classList.add('hidden'); document.getElementById('nav-area').classList.remove('hidden');
        if (mode === 'rooms') { document.getElementById('rooms-screen').classList.remove('hidden'); loadRooms(); } 
        else if (mode === 'friends') { document.getElementById('friends-screen').classList.remove('hidden'); loadFriends(); } 
        else if (mode === 'chat') { document.getElementById('chat-screen').classList.remove('hidden'); document.getElementById('nav-area').classList.add('hidden'); }
        if (document.getElementById('tab-rooms')) document.getElementById('tab-rooms').classList.toggle('active', mode === 'rooms');
        if (document.getElementById('tab-friends')) document.getElementById('tab-friends').classList.toggle('active', mode === 'friends');
    };

    function loadRooms() {
        onSnapshot(query(collection(db, "rooms_v11"), orderBy("createdAt", "desc")), (snap) => {
            const list = document.getElementById('room-list-body'); list.innerHTML = "";
            snap.forEach(ds => { const r = ds.data(); if (r.members && !r.members.includes(me.id) && r.owner !== me.id && ds.id !== "official-lounge") return; const memberCount = r.members ? r.members.length : 0; const tr = document.createElement('tr'); tr.className = 'data-row'; tr.innerHTML = ` <td style="width:50px" onclick="openChat('${ds.id}', '${r.name.replace(/'/g, "\\'")}')"><img src="${r.img || DEFAULT_IMG}" class="icon-cell"></td> <td style="text-align:left" onclick="openChat('${ds.id}', '${r.name.replace(/'/g, "\\'")}')"> <b>${r.name}</b> <span style="color:#888; font-size:12px;">(${memberCount})</span> </td> <td style="text-align:right; white-space:nowrap;"> ${(r.owner === me.id && ds.id !== "official-lounge") ? ` <button class="btn-sub btn-edit" onclick="openRoomModal('${ds.id}','${r.name.replace(/'/g, "\\'")}','${r.img}')">編集</button> <button class="btn-sub btn-del" onclick="deleteRoom('${ds.id}')">削除</button> ` : ''} </td>`; list.appendChild(tr); });
        });
    }

    window.openChat = (roomId, roomName) => { currentRoomId = roomId; document.getElementById('chat-title').innerText = roomName; window.showNeoScreen('chat'); startChat(roomId); };
    function startChat(roomId) { if (chatUnsubscribe) chatUnsubscribe(); const q = query(collection(db, "rooms_v11", roomId, "messages"), orderBy("createdAt", "asc"), limit(100)); chatUnsubscribe = onSnapshot(q, (snap) => { const area = document.getElementById('chat-area'); area.innerHTML = ""; snap.forEach(dSnap => { const d = dSnap.data(); const mid = dSnap.id; const isMine = me && d.uid === me.id; if(!isMine && (!d.readBy || !d.readBy.includes(me.id))) { updateDoc(doc(db, "rooms_v11", roomId, "messages", mid), { readBy: arrayUnion(me.id) }); } const group = document.createElement('div'); group.style = `display:flex; gap:10px; margin-bottom:15px; flex-direction:${isMine ? 'row-reverse' : 'row'}; align-items:flex-start;`; const time = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""; const readCount = d.readBy ? d.readBy.length : 0; const iconUrl = (d.icon && d.icon.val) ? d.icon.val : DEFAULT_IMG; group.innerHTML = ` <img src="${iconUrl}" style="width:38px; height:38px; border-radius:12px; object-fit:cover; cursor:pointer;" onclick="viewUserById('${d.uid}')"> <div style="max-width:70%; display:flex; flex-direction:column; align-items:${isMine ? 'flex-end' : 'flex-start'}"> <div style="font-size:10px; color:#888; margin-bottom:2px;">${d.name}</div> <div style="display:flex; align-items:center; gap:5px; flex-direction:${isMine ? 'row-reverse' : 'row'};"> <div style="padding:10px; border-radius:15px; font-size:14px; background:${isMine ? 'var(--primary)' : '#fff'}; color:${isMine ? '#fff' : '#000'}; border:${isMine ? 'none' : '1px solid #ddd'}; cursor:pointer;" onclick="toggleMsgMenu('${mid}', ${isMine})"> ${d.media ? (d.media.type.startsWith('image') ? `<img src="${d.media.val}" style="max-width:100%; border-radius:10px;">` : `<video src="${d.media.val}" style="max-width:100%;" controls></video>`) : d.text} </div> </div> <div id="menu-${mid}" class="hidden" style="margin-top:5px; display:flex; gap:5px;"> <button onclick="editMsg('${mid}','${(d.text||"").replace(/'/g, "\\'")}')" style="font-size:10px; padding:3px 8px; border-radius:5px; border:1px solid #ddd; background:#fff;">編集</button> <button onclick="deleteMsg('${mid}')" style="font-size:10px; padding:3px 8px; border-radius:5px; border:none; background:#ff7675; color:white;">削除</button> </div> <div style="font-size:9px; color:#aaa; margin-top:2px;"> ${isMine && readCount > 0 ? `<span style="color:var(--accent); font-weight:bold;">${readCount} 既読 </span>` : ''}${time} </div> </div> `; area.appendChild(group); }); area.scrollTop = area.scrollHeight; }); }
    window.toggleMsgMenu = (mid, isMine) => { if(isMine) document.getElementById(`menu-${mid}`).classList.toggle('hidden'); };
    window.editMsg = async (mid, old) => { const n = prompt("編集:", old); if(n !== null && n !== old) await updateDoc(doc(db, "rooms_v11", currentRoomId, "messages", mid), { text: n }); };
    window.deleteMsg = async (mid) => { if(confirm("削除しますか？")) await deleteDoc(doc(db, "rooms_v11", currentRoomId, "messages", mid)); };
    window.viewUserById = async (uid) => { const s = await getDoc(doc(db, "users_v11", uid)); if(s.exists()) viewUserProfile(s.data()); };
    async function post(text, media = null) { if((!text && !media) || !me || !currentRoomId) return; await addDoc(collection(db, "rooms_v11", currentRoomId, "messages"), { text, media, uid: me.id, name: me.name, icon: me.icon, readBy: [], createdAt: serverTimestamp() }); document.getElementById('m-text').value = ""; }
    document.getElementById('send-go').onclick = () => post(document.getElementById('m-text').value.trim());
    window.sendEmoji = (emoji, anim) => post(`<span class="animated-emoji ${anim}">${emoji}</span>`);
    document.getElementById('m-file').onchange = (e) => { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = (v) => post("", { type: f.type, val: v.target.result }); r.readAsDataURL(f); };

    function loadFriends() {
        const list = document.getElementById('friend-list-body'); list.innerHTML = "<tr><td colspan='2' style='text-align:center;'>読み込み中...</td></tr>";
        onSnapshot(collection(db, "users_v11"), (snap) => {
            list.innerHTML = ""; let userCount = 0;
            snap.forEach(ds => { const u = ds.data(); if(u.id === me.id) return; userCount++; const tr = document.createElement('tr'); tr.className = 'data-row'; const iconUrl = (u.icon && u.icon.val) ? u.icon.val : DEFAULT_IMG; const userDataJson = JSON.stringify(u).replace(/'/g, "\\'"); tr.innerHTML = ` <td style="width:50px"> <img src="${iconUrl}" class="icon-cell friend-icon" style="cursor:pointer" onclick='viewUserProfile(${userDataJson})'> </td> <td style="text-align:left"> <b>${u.name}</b><br><small style="color:#aaa">ID: ${u.id}</small> </td> <td></td>`; list.appendChild(tr); });
            if(userCount === 0) { list.innerHTML = "<tr><td colspan='2' style='text-align:center; color:#888; padding:20px;'>他のユーザーはいません</td></tr>"; }
        });
    }
    window.viewUserProfile = (u) => { document.getElementById('view-profile-modal').classList.remove('hidden'); document.getElementById('view-profile-icon').src = (u.icon && u.icon.val) ? u.icon.val : DEFAULT_IMG; document.getElementById('view-profile-name').innerText = u.name; document.getElementById('view-profile-id').innerText = "ID: " + u.id; document.getElementById('view-profile-birthday').innerText = u.birthday || "未設定"; document.getElementById('view-profile-bio').innerText = u.bio || "自己紹介はありません。"; };
    window.openRoomModal = async (rid=null, n="", i="") => { currentEditRoomId = rid; document.getElementById('room-modal').classList.remove('hidden'); document.getElementById('room-name-input').value = n; document.getElementById('room-preview').src = rid ? (i || DEFAULT_IMG) : "https://placehold.jp/150x150.png?text=PICK"; const inviteList = document.getElementById('room-invite-list'); inviteList.innerHTML = "読み込み中..."; let currentMembers = []; if (rid) { const rDoc = await getDoc(doc(db, "rooms_v11", rid)); if (rDoc.exists()) currentMembers = rDoc.data().members || []; } const snap = await getDocs(collection(db, "users_v11")); inviteList.innerHTML = ""; snap.forEach(ds => { const u = ds.data(); if(u.id === me.id) return; const isChecked = currentMembers.includes(u.id) ? "checked" : ""; const iconUrl = (u.icon && u.icon.val) ? u.icon.val : DEFAULT_IMG; const div = document.createElement('div'); div.style = "display:flex; align-items:center; gap:10px; padding:5px; border-bottom:1px solid #f9f9f9;"; div.innerHTML = `<input type="checkbox" class="invite-check" value="${u.id}" ${isChecked}><img src="${iconUrl}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;"><span style="font-size:12px;">${u.name}</span>`; inviteList.appendChild(div); }); };
    document.getElementById('room-save-btn').onclick = async () => { const name = document.getElementById('room-name-input').value.trim(); if(!name) return; const selectedIds = Array.from(document.querySelectorAll('.invite-check:checked')).map(el => el.value); selectedIds.push(me.id); const roomData = { name, img: document.getElementById('room-preview').src, owner: me.id, members: selectedIds, createdAt: serverTimestamp() }; if(currentEditRoomId) { await updateDoc(doc(db, "rooms_v11", currentEditRoomId), { name, img: roomData.img, members: selectedIds }); } else { await addDoc(collection(db, "rooms_v11"), roomData); } window.closeModal('room-modal'); };
    document.getElementById('room-file-input').onchange = (e) => { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (ev) => { document.getElementById('room-preview').src = ev.target.result; }; reader.readAsDataURL(file); };
    window.deleteRoom = async (rid) => { if(confirm("ルームを削除しますか？")) await deleteDoc(doc(db, "rooms_v11", rid)); };
    window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
    document.getElementById('toggle-signup').onclick = () => { document.getElementById('signup-extra').classList.toggle('hidden'); document.getElementById('login-btn').classList.toggle('hidden'); document.getElementById('signup-exec-btn').classList.toggle('hidden'); document.getElementById('auth-err').innerText = ""; };
    document.getElementById('my-profile-btn').onclick = () => { document.getElementById('profile-modal').classList.remove('hidden'); document.getElementById('profile-edit-preview').src = me.icon.val || DEFAULT_IMG; if(document.getElementById('edit-profile-name')) document.getElementById('edit-profile-name').innerText = me.name; if(document.getElementById('edit-profile-id')) document.getElementById('edit-profile-id').innerText = "ID: " + me.id; document.getElementById('edit-birthday').value = me.birthday || ""; document.getElementById('edit-bio').value = me.bio || ""; };
    document.getElementById('profile-file-input').onchange = (e) => { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (ev) => { document.getElementById('profile-edit-preview').src = ev.target.result; }; reader.readAsDataURL(file); };
    
    document.getElementById('profile-save-btn').onclick = async () => { 
        const birthday = document.getElementById('edit-birthday').value; 
        const bio = document.getElementById('edit-bio').value.trim(); 
        const newIcon = document.getElementById('profile-edit-preview').src; 
        
        const userRef = doc(db, "users_v11", me.id); 
        await updateDoc(userRef, { "icon.val": newIcon, birthday, bio }); 
        
        me.icon.val = newIcon; 
        me.birthday = birthday; 
        me.bio = bio; 
        
        // トーク画面内と、右上の固定ヘッダーの両方のアイコンを更新
        document.getElementById('my-profile-btn').src = newIcon; 
        const fixedIcon = document.getElementById('my-profile-btn-fixed');
        if (fixedIcon) fixedIcon.src = newIcon;

        alert("プロフィールを更新しました"); 
        window.closeModal('profile-modal'); 
    };
}