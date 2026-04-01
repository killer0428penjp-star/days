import { db, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, orderBy, onSnapshot, serverTimestamp, limit, addDoc, getDoc, arrayUnion, arrayRemove, where } from "./firebase.js";
import { initCalendar } from "./calendar.js";

let me = null;
let currentEditRoomId = null; 
let currentRoomId = null; 
let chatUnsubscribe = null; 
const DEFAULT_IMG = "https://placehold.jp/24/cccccc/ffffff/200x200.png?text=NoImage";
const DEFAULT_ROOM_IMG = "https://placehold.jp/24/87ceeb/ffffff/200x200.png?text=☁";

export function initNeoPod() {

    // --- 1. タブ切り替えシステム ---
    const tags = document.querySelectorAll('.tag');
    const containers = {
        'news-tag': document.getElementById('news-feed-container'),
        'calendar-tag': document.getElementById('calendar-container'),
        'tolk-tag': document.getElementById('tolk-screen')
    };

    tags.forEach(tag => {
        tag.onclick = () => {
            Object.values(containers).forEach(c => { if(c) c.style.display = 'none'; });
            tags.forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            if (containers[tag.id]) containers[tag.id].style.display = 'block';
        };
    });

    // --- 2. ログイン処理 ---
    async function login(id, pw, auto = false) {
        const s = await getDoc(doc(db, "users_v11", id));
        if(!s.exists() || s.data().pw !== pw) {
            if(!auto) document.getElementById('auth-err').innerText = "IDまたはパスワードが正しくありません";
            return;
        }
        me = s.data(); me.id = id;
        if(!me.icon) me.icon = { val: DEFAULT_IMG };
        if(!me.friends) me.friends = [];
        
        localStorage.setItem('np_session', JSON.stringify({ id, pw, expire: Date.now() + 1000 * 60 * 60 * 24 * 30 }));
        
        const history = JSON.parse(localStorage.getItem('np_account_history') || '[]');
        if(!history.find(a => a.id === id)) { 
            history.push({id, pw, name: me.name, icon: me.icon.val}); 
            localStorage.setItem('np_account_history', JSON.stringify(history)); 
        }

        const fixedHeader = document.getElementById('neo-fixed-header');
        if (fixedHeader) fixedHeader.style.display = "flex";
        
        document.getElementById('my-profile-btn').src = me.icon.val;
        document.getElementById('my-name-display').innerText = me.name;

        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        document.getElementById('header-bg').style.display = "flex"; 

        Object.values(containers).forEach(c => { if(c) c.style.display = 'none'; });
        tags.forEach(t => t.classList.remove('active'));
        const talkTag = document.getElementById("tolk-tag");
        if (talkTag) talkTag.classList.add('active');
        const tolkScreen = document.getElementById('tolk-screen');
        if (tolkScreen) tolkScreen.style.display = 'block';
        window.showNeoScreen('rooms');

        initCalendar(me.id);
        watchPendingRequests();
    }

    // --- 3. アカウント管理 ---
    function removeFromHistory(id) { const history = JSON.parse(localStorage.getItem('np_account_history') || '[]'); const filtered = history.filter(a => a.id !== id); localStorage.setItem('np_account_history', JSON.stringify(filtered)); renderHistory(); }
    
    function renderHistory() { 
        const history = JSON.parse(localStorage.getItem('np_account_history') || '[]'); 
        const area = document.getElementById('acc-history-area'); 
        const list = document.getElementById('acc-history-list'); 
        list.innerHTML = ""; 
        if(history.length > 0) { 
            area.classList.remove('hidden'); 
            history.forEach(acc => { 
                const div = document.createElement('div'); 
                div.className = 'acc-item'; 
                div.innerHTML = `<img src="${acc.icon || DEFAULT_IMG}"><span>${acc.name}</span>`; 
                div.onclick = () => login(acc.id, acc.pw); 
                list.appendChild(div); 
            }); 
        } else { 
            area.classList.add('hidden'); 
        } 
    }

    window.np_logout = () => { localStorage.removeItem('np_session'); location.reload(); };
    window.execDeleteAccount = async () => { if(!confirm("本当に削除しますか？")) return; const targetId = me.id; await deleteDoc(doc(db, "users_v11", targetId)); removeFromHistory(targetId); window.np_logout(); };

    document.getElementById('login-btn').onclick = () => login(document.getElementById('auth-id').value.trim(), document.getElementById('auth-pw').value.trim());
    document.getElementById('signup-exec-btn').onclick = async () => { const id = document.getElementById('auth-id').value.trim(); const pw = document.getElementById('auth-pw').value.trim(); const name = document.getElementById('signup-name').value.trim() || id; if(!id || !pw) return; const check = await getDoc(doc(db, "users_v11", id)); if(check.exists()) { document.getElementById('auth-err').innerText = "このIDは既に使用されています"; return; } await setDoc(doc(db, "users_v11", id), { id, pw, name, icon: {val: DEFAULT_IMG}, friends: [], createdAt: serverTimestamp() }); login(id, pw); };

    const session = JSON.parse(localStorage.getItem('np_session'));
    if (session && session.expire > Date.now()) { 
        login(session.id, session.pw, true); 
    } else { 
        document.getElementById('main-content').classList.add('hidden'); 
        document.getElementById('auth-screen').classList.remove('hidden'); 
        const fixedHeader = document.getElementById('neo-fixed-header');
        if(fixedHeader) fixedHeader.style.display = "none";
    }
    renderHistory();

    // --- 4. 未読申請バッジ監視（リアルタイム） ---
    function watchPendingRequests() {
        if (!me) return;
        const q = query(
            collection(db, "friend_requests"),
            where("to", "==", me.id),
            where("status", "==", "pending")
        );
        onSnapshot(q, (snap) => {
            const badge = document.getElementById('friend-badge');
            if (!badge) return;
            if (snap.size > 0) {
                badge.textContent = snap.size;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        });
    }

    // --- 5. 画面切り替え ---
    window.showNeoScreen = (mode) => {
        document.getElementById('rooms-screen').classList.add('hidden');
        document.getElementById('friends-screen').classList.add('hidden');
        document.getElementById('chat-screen').classList.add('hidden');
        document.getElementById('nav-area').classList.remove('hidden');
        if (mode === 'rooms') { document.getElementById('rooms-screen').classList.remove('hidden'); loadRooms(); } 
        else if (mode === 'friends') { document.getElementById('friends-screen').classList.remove('hidden'); loadFriendsScreen(); } 
        else if (mode === 'chat') { document.getElementById('chat-screen').classList.remove('hidden'); document.getElementById('nav-area').classList.add('hidden'); }
        if (document.getElementById('tab-rooms')) document.getElementById('tab-rooms').classList.toggle('active', mode === 'rooms');
        if (document.getElementById('tab-friends')) document.getElementById('tab-friends').classList.toggle('active', mode === 'friends');
    };

    // --- 6. ルーム ---
    function loadRooms() {
        onSnapshot(query(collection(db, "rooms_v11"), orderBy("createdAt", "desc")), (snap) => {
            const list = document.getElementById('room-list-body'); list.innerHTML = "";
            snap.forEach(ds => {
                const r = ds.data();
                if (r.members && !r.members.includes(me.id) && r.owner !== me.id && ds.id !== "official-lounge") return;
                const memberCount = r.members ? r.members.length : 0;
                const isOwner = r.owner === me.id && ds.id !== "official-lounge";
                const isMember = r.members && r.members.includes(me.id) && !isOwner && ds.id !== "official-lounge";
                const tr = document.createElement('tr');
                tr.className = 'data-row';
                tr.innerHTML = `
                    <td style="width:50px" onclick="openChat('${ds.id}', '${r.name.replace(/'/g, "\\'")}')">
                        <img src="${r.img || DEFAULT_ROOM_IMG}" class="icon-cell">
                    </td>
                    <td style="text-align:left" onclick="openChat('${ds.id}', '${r.name.replace(/'/g, "\\'")}')">
                        <b>${r.name}</b>
                        <span style="color:#888; font-size:12px;">(${memberCount})</span>
                    </td>
                    <td style="text-align:right; white-space:nowrap;">
                        ${isOwner ? `
                            <button class="btn-sub btn-edit" onclick="openRoomModal('${ds.id}','${r.name.replace(/'/g, "\\'")}','${r.img || DEFAULT_ROOM_IMG}')">編集</button>
                            <button class="btn-sub btn-del" onclick="deleteRoom('${ds.id}')">削除</button>
                        ` : ''}
                        ${isMember ? `<button class="btn-leave" onclick="leaveRoom('${ds.id}')">退出</button>` : ''}
                    </td>`;
                list.appendChild(tr);
            });
        });
    }

    window.leaveRoom = async (rid) => {
        if(!confirm("このルームから退出しますか？")) return;
        await updateDoc(doc(db, "rooms_v11", rid), { members: arrayRemove(me.id) });
    };

    // --- 7. フレンド画面 ---
    async function loadFriendsScreen() {
        const screen = document.getElementById('friends-screen');
        screen.innerHTML = `
            <div class="friend-tabs">
                <button class="f-tab active" id="ftab-friends" onclick="switchFTab('friends')">フレンド</button>
                <button class="f-tab" id="ftab-search" onclick="switchFTab('search')">ユーザー検索</button>
                <button class="f-tab" id="ftab-requests" onclick="switchFTab('requests')">
                    申請
                    <span id="friend-badge" style="display:none; background:var(--danger,#e74c3c); color:#fff; border-radius:50%; width:18px; height:18px; font-size:11px; align-items:center; justify-content:center; margin-left:4px;"></span>
                </button>
            </div>
            <div id="fpanel-friends"></div>
            <div id="fpanel-search" style="display:none">
                <div style="display:flex; gap:8px; margin-bottom:12px; margin-top:4px;">
                    <input type="text" id="friend-search-input" class="input-field" placeholder="IDまたは名前で検索..." style="margin:0; flex:1;">
                    <button onclick="execFriendSearch()" style="background:var(--accent); color:#fff; border:none; padding:8px 14px; border-radius:10px; font-size:13px; cursor:pointer; white-space:nowrap;">検索</button>
                </div>
                <div id="friend-search-results"></div>
            </div>
            <div id="fpanel-requests" style="display:none">
                <div id="requests-list"></div>
            </div>
        `;
        watchPendingRequests();
        loadMyFriends();
    }

    window.switchFTab = (tab) => {
        ['friends','search','requests'].forEach(t => {
            const panel = document.getElementById(`fpanel-${t}`);
            const btn = document.getElementById(`ftab-${t}`);
            if (panel) panel.style.display = t === tab ? 'block' : 'none';
            if (btn) btn.classList.toggle('active', t === tab);
        });
        if (tab === 'requests') loadPendingRequests();
        if (tab === 'friends') loadMyFriends();
    };

    // フレンド一覧
    async function loadMyFriends() {
        const panel = document.getElementById('fpanel-friends');
        if (!panel) return;
        const snap = await getDoc(doc(db, "users_v11", me.id));
        const friends = snap.exists() ? (snap.data().friends || []) : [];
        me.friends = friends;

        if (friends.length === 0) {
            panel.innerHTML = `<div style="text-align:center; padding:30px; color:#aaa; font-size:13px;">まだフレンドがいません<br>ユーザー検索から申請してみよう</div>`;
            return;
        }
        panel.innerHTML = "";
        for (const fid of friends) {
            const fs = await getDoc(doc(db, "users_v11", fid));
            if (!fs.exists()) continue;
            const u = fs.data();
            const iconUrl = (u.icon && u.icon.val) ? u.icon.val : DEFAULT_IMG;
            const div = document.createElement('div');
            div.className = 'friend-item';
            const uJson = JSON.stringify(u).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            div.innerHTML = `
                <img src="${iconUrl}" class="friend-avatar" onclick='viewUserProfile(${uJson})'>
                <div class="friend-info">
                    <b style="color:var(--text-main)">${u.name}</b>
                    <span style="color:#aaa; font-size:11px;">ID: ${u.id}</span>
                </div>
                <button class="btn-sub btn-del" onclick="removeFriend('${u.id}')">削除</button>
            `;
            panel.appendChild(div);
        }
    }

    // ユーザー検索
    window.execFriendSearch = async () => {
        const keyword = document.getElementById('friend-search-input').value.trim().toLowerCase();
        const results = document.getElementById('friend-search-results');
        if (!keyword) { results.innerHTML = `<div style="color:#aaa; font-size:12px; text-align:center; padding:10px;">キーワードを入力してください</div>`; return; }
        results.innerHTML = `<div style="color:#aaa; font-size:12px; text-align:center; padding:10px;">検索中...</div>`;

        // 申請状況を取得
        const sentSnap = await getDocs(query(collection(db, "friend_requests"), where("from", "==", me.id)));
        const sentMap = {};
        sentSnap.forEach(d => { sentMap[d.data().to] = d.data().status; });

        const snap = await getDocs(collection(db, "users_v11"));
        results.innerHTML = "";
        let count = 0;
        const myFriends = me.friends || [];

        snap.forEach(ds => {
            const u = ds.data();
            if (u.id === me.id) return;
            if (!u.name.toLowerCase().includes(keyword) && !u.id.toLowerCase().includes(keyword)) return;
            count++;
            const iconUrl = (u.icon && u.icon.val) ? u.icon.val : DEFAULT_IMG;
            const isFriend = myFriends.includes(u.id);
            const sentStatus = sentMap[u.id];

            let actionBtn = '';
            if (isFriend || sentStatus === 'accepted') {
                actionBtn = `<span class="friend-status-badge">フレンド ✓</span>`;
            } else if (sentStatus === 'pending') {
                actionBtn = `<span style="color:#aaa; font-size:12px; font-weight:bold;">申請中...</span>`;
            } else {
                actionBtn = `<button class="btn-send-req" onclick="sendFriendRequest('${u.id}', this)">申請する</button>`;
            }

            const uJson = JSON.stringify(u).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const div = document.createElement('div');
            div.className = 'friend-item';
            div.innerHTML = `
                <img src="${iconUrl}" class="friend-avatar" onclick='viewUserProfile(${uJson})'>
                <div class="friend-info">
                    <b style="color:var(--text-main)">${u.name}</b>
                    <span style="color:#aaa; font-size:11px;">ID: ${u.id}</span>
                </div>
                ${actionBtn}
            `;
            results.appendChild(div);
        });

        if (count === 0) results.innerHTML = `<div style="color:#aaa; font-size:12px; text-align:center; padding:10px;">見つかりませんでした</div>`;
    };

    // 申請送信
    window.sendFriendRequest = async (toId, btn) => {
        const existing = await getDocs(query(
            collection(db, "friend_requests"),
            where("from", "==", me.id),
            where("to", "==", toId)
        ));
        if (!existing.empty) { btn.textContent = "申請済み"; btn.disabled = true; return; }

        await addDoc(collection(db, "friend_requests"), {
            from: me.id,
            fromName: me.name,
            fromIcon: (me.icon && me.icon.val) ? me.icon.val : DEFAULT_IMG,
            to: toId,
            status: "pending",
            createdAt: serverTimestamp()
        });
        btn.textContent = "申請中...";
        btn.disabled = true;
        btn.classList.add('disabled');
    };

    // 受信申請一覧（リアルタイム）
    function loadPendingRequests() {
        const list = document.getElementById('requests-list');
        if (!list) return;
        list.innerHTML = `<div style="color:#aaa; text-align:center; padding:20px; font-size:13px;">読み込み中...</div>`;

        const q = query(
            collection(db, "friend_requests"),
            where("to", "==", me.id),
            where("status", "==", "pending")
        );
        onSnapshot(q, (snap) => {
            if (!document.getElementById('requests-list')) return;
            list.innerHTML = "";
            if (snap.empty) {
                list.innerHTML = `<div style="color:#aaa; text-align:center; padding:30px; font-size:13px;">申請はありません</div>`;
                return;
            }
            snap.forEach(ds => {
                const req = ds.data();
                const reqId = ds.id;
                const div = document.createElement('div');
                div.className = 'friend-item';
                div.id = `req-${reqId}`;
                div.innerHTML = `
                    <img src="${req.fromIcon || DEFAULT_IMG}" class="friend-avatar">
                    <div class="friend-info">
                        <b style="color:var(--text-main)">${req.fromName}</b>
                        <span style="color:#aaa; font-size:11px;">ID: ${req.from}</span>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-accept" onclick="acceptRequest('${reqId}', '${req.from}')">承認</button>
                        <button class="btn-reject" onclick="rejectRequest('${reqId}')">拒否</button>
                    </div>
                `;
                list.appendChild(div);
            });
        });
    }

    // 承認
    window.acceptRequest = async (reqId, fromId) => {
        await updateDoc(doc(db, "friend_requests", reqId), { status: "accepted" });
        await updateDoc(doc(db, "users_v11", me.id), { friends: arrayUnion(fromId) });
        await updateDoc(doc(db, "users_v11", fromId), { friends: arrayUnion(me.id) });
        if (!me.friends) me.friends = [];
        if (!me.friends.includes(fromId)) me.friends.push(fromId);
    };

    // 拒否
    window.rejectRequest = async (reqId) => {
        await updateDoc(doc(db, "friend_requests", reqId), { status: "rejected" });
    };

    // フレンド削除
    window.removeFriend = async (fid) => {
        if (!confirm("フレンドを削除しますか？")) return;
        await updateDoc(doc(db, "users_v11", me.id), { friends: arrayRemove(fid) });
        await updateDoc(doc(db, "users_v11", fid), { friends: arrayRemove(me.id) });
        me.friends = (me.friends || []).filter(id => id !== fid);
        loadMyFriends();
    };

    // --- 8. チャット ---
    window.openChat = (roomId, roomName) => { currentRoomId = roomId; document.getElementById('chat-title').innerText = roomName; window.showNeoScreen('chat'); startChat(roomId); };

    function startChat(roomId) {
        if (chatUnsubscribe) chatUnsubscribe();
        const q = query(collection(db, "rooms_v11", roomId, "messages"), orderBy("createdAt", "asc"), limit(100));
        chatUnsubscribe = onSnapshot(q, (snap) => {
            const area = document.getElementById('chat-area');
            area.innerHTML = "";
            snap.forEach(dSnap => {
                const d = dSnap.data();
                const mid = dSnap.id;
                const isMine = me && d.uid === me.id;

                if(!isMine && (!d.readBy || !d.readBy.includes(me.id))) {
                    updateDoc(doc(db, "rooms_v11", roomId, "messages", mid), { readBy: arrayUnion(me.id) });
                }

                const group = document.createElement('div');
                group.style = `display:flex; gap:10px; margin-bottom:15px; flex-direction:${isMine ? 'row-reverse' : 'row'}; align-items:flex-start;`;

                const time = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "";
                const readCount = d.readBy ? d.readBy.length : 0;

                let iconUrl = isMine
                    ? ((me.icon && me.icon.val) ? me.icon.val : DEFAULT_IMG)
                    : ((d.icon && d.icon.val) ? d.icon.val : DEFAULT_IMG);

                const bubbleBg = isMine ? 'var(--primary)' : 'var(--card-bg, #fff)';
                const bubbleColor = isMine ? '#fff' : 'var(--text-main)';
                const bubbleBorder = isMine ? 'none' : '1px solid var(--border-soft)';

                group.innerHTML = `
                    <img src="${iconUrl}" 
                         style="width:38px; height:38px; border-radius:50%; object-fit:cover; cursor:pointer; flex-shrink:0; border:2px solid ${isMine ? 'var(--accent)' : '#eee'};"
                         onclick="viewUserById('${d.uid}')"
                         onerror="this.src='${DEFAULT_IMG}'">
                    <div style="max-width:70%; display:flex; flex-direction:column; align-items:${isMine ? 'flex-end' : 'flex-start'}">
                        <div style="font-size:10px; color:#888; margin-bottom:2px;">${d.name}</div>
                        <div style="display:flex; align-items:center; gap:5px; flex-direction:${isMine ? 'row-reverse' : 'row'};">
                            <div class="${isMine ? '' : 'msg-bubble-other'}"
                                 style="padding:10px; border-radius:15px; font-size:14px; background:${bubbleBg}; color:${bubbleColor}; border:${bubbleBorder}; cursor:pointer;"
                                 onclick="toggleMsgMenu('${mid}', ${isMine})">
                                ${d.media ? (d.media.type.startsWith('image') ? `<img src="${d.media.val}" style="max-width:100%; border-radius:10px;">` : `<video src="${d.media.val}" style="max-width:100%;" controls></video>`) : d.text}
                            </div>
                        </div>
                        <div id="menu-${mid}" class="hidden" style="margin-top:5px; display:flex; gap:5px;">
                            <button onclick="editMsg('${mid}','${(d.text||"").replace(/'/g, "\\'")}')" style="font-size:10px; padding:3px 8px; border-radius:5px; border:1px solid #ddd; background:var(--card-bg,#fff); color:var(--text-main);">編集</button>
                            <button onclick="deleteMsg('${mid}')" style="font-size:10px; padding:3px 8px; border-radius:5px; border:none; background:#ff7675; color:white;">削除</button>
                        </div>
                        <div style="font-size:9px; color:#aaa; margin-top:2px;">
                            ${isMine && readCount > 0 ? `<span style="color:var(--accent); font-weight:bold;">${readCount} 既読 </span>` : ''}${time}
                        </div>
                    </div>`;
                area.appendChild(group);
            });
            area.scrollTop = area.scrollHeight;
        });
    }

    window.toggleMsgMenu = (mid, isMine) => { if(isMine) document.getElementById(`menu-${mid}`).classList.toggle('hidden'); };
    window.editMsg = async (mid, old) => { const n = prompt("編集:", old); if(n !== null && n !== old) await updateDoc(doc(db, "rooms_v11", currentRoomId, "messages", mid), { text: n }); };
    window.deleteMsg = async (mid) => { if(confirm("削除しますか？")) await deleteDoc(doc(db, "rooms_v11", currentRoomId, "messages", mid)); };
    window.viewUserById = async (uid) => { const s = await getDoc(doc(db, "users_v11", uid)); if(s.exists()) viewUserProfile(s.data()); };

    async function post(text, media = null) {
        if((!text && !media) || !me || !currentRoomId) return;
        await addDoc(collection(db, "rooms_v11", currentRoomId, "messages"), {
            text, media, uid: me.id, name: me.name,
            icon: me.icon || { val: DEFAULT_IMG },
            readBy: [], createdAt: serverTimestamp()
        });
        document.getElementById('m-text').value = "";
    }

    document.getElementById('send-go').onclick = () => post(document.getElementById('m-text').value.trim());
    window.sendEmoji = (emoji, anim) => post(`<span class="animated-emoji ${anim}">${emoji}</span>`);
    document.getElementById('m-file').onchange = (e) => { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = (v) => post("", { type: f.type, val: v.target.result }); r.readAsDataURL(f); };

    window.viewUserProfile = (u) => { document.getElementById('view-profile-modal').classList.remove('hidden'); document.getElementById('view-profile-icon').src = (u.icon && u.icon.val) ? u.icon.val : DEFAULT_IMG; document.getElementById('view-profile-name').innerText = u.name; document.getElementById('view-profile-id').innerText = "ID: " + u.id; document.getElementById('view-profile-birthday').innerText = u.birthday || "未設定"; document.getElementById('view-profile-bio').innerText = u.bio || "自己紹介はありません。"; };

    window.openRoomModal = async (rid=null, n="", i="") => {
        currentEditRoomId = rid;
        document.getElementById('room-modal').classList.remove('hidden');
        document.getElementById('room-name-input').value = n;
        document.getElementById('room-preview').src = rid ? (i || DEFAULT_ROOM_IMG) : DEFAULT_ROOM_IMG;
        const inviteList = document.getElementById('room-invite-list');
        inviteList.innerHTML = "読み込み中...";
        let currentMembers = [];
        if (rid) {
            const rDoc = await getDoc(doc(db, "rooms_v11", rid));
            if (rDoc.exists()) currentMembers = rDoc.data().members || [];
        }
        const snap = await getDocs(collection(db, "users_v11"));
        inviteList.innerHTML = "";
        snap.forEach(ds => {
            const u = ds.data();
            if(u.id === me.id) return;
            const isChecked = currentMembers.includes(u.id) ? "checked" : "";
            const iconUrl = (u.icon && u.icon.val) ? u.icon.val : DEFAULT_IMG;
            const div = document.createElement('div');
            div.style = "display:flex; align-items:center; gap:10px; padding:5px; border-bottom:1px solid var(--border-soft);";
            div.innerHTML = `<input type="checkbox" class="invite-check" value="${u.id}" ${isChecked}><img src="${iconUrl}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;"><span style="font-size:12px; color:var(--text-main);">${u.name}</span>`;
            inviteList.appendChild(div);
        });
    };

    document.getElementById('room-save-btn').onclick = async () => {
        const name = document.getElementById('room-name-input').value.trim();
        if(!name) return;
        const selectedIds = Array.from(document.querySelectorAll('.invite-check:checked')).map(el => el.value);
        selectedIds.push(me.id);
        const previewSrc = document.getElementById('room-preview').src;
        const roomImg = previewSrc || DEFAULT_ROOM_IMG;
        const roomData = { name, img: roomImg, owner: me.id, members: selectedIds, createdAt: serverTimestamp() };
        if(currentEditRoomId) {
            await updateDoc(doc(db, "rooms_v11", currentEditRoomId), { name, img: roomImg, members: selectedIds });
        } else {
            await addDoc(collection(db, "rooms_v11"), roomData);
        }
        window.closeModal('room-modal');
    };

    document.getElementById('room-file-input').onchange = (e) => { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (ev) => { document.getElementById('room-preview').src = ev.target.result; }; reader.readAsDataURL(file); };
    window.deleteRoom = async (rid) => { if(confirm("ルームを削除しますか？")) await deleteDoc(doc(db, "rooms_v11", rid)); };
    window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
    document.getElementById('toggle-signup').onclick = () => { document.getElementById('signup-extra').classList.toggle('hidden'); document.getElementById('login-btn').classList.toggle('hidden'); document.getElementById('signup-exec-btn').classList.toggle('hidden'); document.getElementById('auth-err').innerText = ""; };
    
    document.getElementById('my-profile-btn-wrapper').onclick = () => { document.getElementById('profile-modal').classList.remove('hidden'); document.getElementById('profile-edit-preview').src = me.icon.val || DEFAULT_IMG; if(document.getElementById('edit-profile-name')) document.getElementById('edit-profile-name').innerText = me.name; if(document.getElementById('edit-profile-id')) document.getElementById('edit-profile-id').innerText = "ID: " + me.id; document.getElementById('edit-birthday').value = me.birthday || ""; document.getElementById('edit-bio').value = me.bio || ""; };
    document.getElementById('profile-file-input').onchange = (e) => { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (ev) => { document.getElementById('profile-edit-preview').src = ev.target.result; }; reader.readAsDataURL(file); };
    document.getElementById('profile-save-btn').onclick = async () => { const birthday = document.getElementById('edit-birthday').value; const bio = document.getElementById('edit-bio').value.trim(); const newIcon = document.getElementById('profile-edit-preview').src; const userRef = doc(db, "users_v11", me.id); await updateDoc(userRef, { "icon.val": newIcon, birthday, bio }); me.icon.val = newIcon; me.birthday = birthday; me.bio = bio; document.getElementById('my-profile-btn').src = newIcon; alert("プロフィールを更新しました"); window.closeModal('profile-modal'); };
}
