import {
    db, collection, getDocs, doc, setDoc, deleteDoc,
    updateDoc, query, orderBy, onSnapshot, serverTimestamp,
    limit, addDoc, getDoc, arrayUnion, arrayRemove, where
} from "./firebase.js";
import { initCalendar } from "./calendar.js";

let me                = null;
let currentEditRoomId = null;
let currentRoomId     = null;
let chatUnsubscribe   = null;

const DEFAULT_IMG      = "https://placehold.jp/24/cccccc/ffffff/200x200.png?text=NoImage";
const DEFAULT_ROOM_IMG = "https://placehold.jp/24/87ceeb/ffffff/200x200.png?text=☁";

export function initNeoPod() {

    // =========================================================
    // ユーティリティ：モーダル開閉
    // =========================================================
    window.closeModal = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add("hidden");
        el.style.display = "none";
    };

    function openModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove("hidden");
        el.style.display = "flex";
    }

    // =========================================================
    //  プロフィール更新の共通処理
    //  ・me オブジェクト更新
    //  ・Firebase 保存
    //  ・固定ヘッダーのアイコン反映
    //  ・localStorage キャッシュ更新
    //  ・other.html へ最新データ送信
    // =========================================================
    async function applyProfileUpdate({ icon, birthday, bio }) {
        if (!me) return;

        // Firebase 保存
        await updateDoc(doc(db, "users_v11", me.id), {
            "icon.val": icon,
            birthday,
            bio
        });

        // me オブジェクト更新
        if (!me.icon) me.icon = {};
        me.icon.val = icon;
        me.birthday = birthday;
        me.bio      = bio;

        // 固定ヘッダーのアイコン更新
        const myBtn = document.getElementById("my-profile-btn");
        if (myBtn) myBtn.src = icon;

        // localStorage キャッシュ更新
        try {
            const cached    = JSON.parse(localStorage.getItem("np_profile_cache") || "{}");
            cached.icon     = icon;
            cached.birthday = birthday;
            cached.bio      = bio;
            localStorage.setItem("np_profile_cache", JSON.stringify(cached));
        } catch(e) {}

        // other.html へ最新プロフィールを送信（パネルが開いていれば表示も更新される）
        if (typeof window.notifyLoginToOthers === "function") {
            window.notifyLoginToOthers(me);
        }
    }

    // other.html の PROFILE_EDIT パネルからの保存を受け取るグローバル関数
    window._npUpdateProfile = async ({ icon, birthday, bio }) => {
        try {
            await applyProfileUpdate({ icon, birthday, bio });
            // 成功を other.html へ通知
            const iframe = document.getElementById("others-iframe");
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: "profileSaved" }, "*");
            }
        } catch(err) {
            console.error("Profile update failed:", err);
            const iframe = document.getElementById("others-iframe");
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: "profileSaveError" }, "*");
            }
        }
    };

    // =========================================================
    // ログイン
    // =========================================================
    async function login(id, pw, auto = false) {
        const s = await getDoc(doc(db, "users_v11", id));
        if (!s.exists() || s.data().pw !== pw) {
            if (!auto) document.getElementById("auth-err").innerText = "IDまたはパスワードが正しくありません";
            return;
        }

        me    = s.data();
        me.id = id;
        if (!me.icon)    me.icon    = { val: DEFAULT_IMG };
        if (!me.friends) me.friends = [];

        // セッション保存
        localStorage.setItem("np_session", JSON.stringify({
            id, pw, expire: Date.now() + 1000 * 60 * 60 * 24 * 30
        }));

        // アカウント履歴
        const history = JSON.parse(localStorage.getItem("np_account_history") || "[]");
        if (!history.find(a => a.id === id)) {
            history.push({ id, pw, name: me.name, icon: me.icon.val });
            localStorage.setItem("np_account_history", JSON.stringify(history));
        }

        // 固定ヘッダー表示
        const fixedHeader = document.getElementById("neo-fixed-header");
        if (fixedHeader) fixedHeader.style.display = "flex";
        document.getElementById("my-profile-btn").src        = me.icon.val;
        document.getElementById("my-name-display").innerText = me.name;

        // auth → main 切り替え
        document.getElementById("auth-screen").classList.add("hidden");
        document.getElementById("main-content").classList.remove("hidden");

        // news タブへ切り替え（初期表示）
        if (typeof window.showTab === "function") {
            window.showTab("news-tag");
        } else {
            const el = document.getElementById("news-feed-container");
            if (el) el.style.display = "block";
        }

        window.showNeoScreen("rooms");
        initCalendar(me.id);
        watchPendingRequests();

        // other.html へログイン済みプロフィールを送信
        if (typeof window.notifyLoginToOthers === "function") {
            window.notifyLoginToOthers(me);
        }
    }

    // =========================================================
    // アカウント管理
    // =========================================================
    function removeFromHistory(id) {
        const h = JSON.parse(localStorage.getItem("np_account_history") || "[]");
        localStorage.setItem("np_account_history", JSON.stringify(h.filter(a => a.id !== id)));
        renderHistory();
    }

    function renderHistory() {
        const history = JSON.parse(localStorage.getItem("np_account_history") || "[]");
        const area    = document.getElementById("acc-history-area");
        const list    = document.getElementById("acc-history-list");
        if (!area || !list) return;
        list.innerHTML = "";
        if (history.length > 0) {
            area.classList.remove("hidden");
            history.forEach(acc => {
                const div     = document.createElement("div");
                div.className = "acc-item";
                div.innerHTML = `<img src="${acc.icon || DEFAULT_IMG}"><span>${acc.name}</span>`;
                div.onclick   = () => login(acc.id, acc.pw);
                list.appendChild(div);
            });
        } else {
            area.classList.add("hidden");
        }
    }

    window.np_logout = () => {
        localStorage.removeItem("np_session");
        location.reload();
    };

    window.execDeleteAccount = async () => {
        if (!confirm("本当に削除しますか？")) return;
        const targetId = me.id;
        await deleteDoc(doc(db, "users_v11", targetId));
        removeFromHistory(targetId);
        window.np_logout();
    };

    document.getElementById("login-btn").onclick = () =>
        login(
            document.getElementById("auth-id").value.trim(),
            document.getElementById("auth-pw").value.trim()
        );

    document.getElementById("signup-exec-btn").onclick = async () => {
        const id   = document.getElementById("auth-id").value.trim();
        const pw   = document.getElementById("auth-pw").value.trim();
        const name = document.getElementById("signup-name").value.trim() || id;
        if (!id || !pw) return;
        const check = await getDoc(doc(db, "users_v11", id));
        if (check.exists()) {
            document.getElementById("auth-err").innerText = "このIDは既に使用されています";
            return;
        }
        await setDoc(doc(db, "users_v11", id), {
            id, pw, name,
            icon: { val: DEFAULT_IMG },
            friends: [],
            createdAt: serverTimestamp()
        });
        login(id, pw);
    };

    document.getElementById("toggle-signup").onclick = () => {
        document.getElementById("signup-extra").classList.toggle("hidden");
        document.getElementById("login-btn").classList.toggle("hidden");
        document.getElementById("signup-exec-btn").classList.toggle("hidden");
        document.getElementById("auth-err").innerText = "";
    };

    // 自動ログイン
    const session = JSON.parse(localStorage.getItem("np_session"));
    if (session && session.expire > Date.now()) {
        login(session.id, session.pw, true);
    } else {
        document.getElementById("main-content").classList.add("hidden");
        document.getElementById("auth-screen").classList.remove("hidden");
        const fixedHeader = document.getElementById("neo-fixed-header");
        if (fixedHeader) fixedHeader.style.display = "none";
    }
    renderHistory();

    // =========================================================
    // 未読申請バッジ監視
    // =========================================================
    function watchPendingRequests() {
        if (!me) return;
        onSnapshot(
            query(collection(db, "friend_requests"), where("to", "==", me.id), where("status", "==", "pending")),
            (snap) => {
                const badge = document.getElementById("friend-badge");
                if (!badge) return;
                badge.textContent   = snap.size;
                badge.style.display = snap.size > 0 ? "inline-flex" : "none";
            }
        );
    }

    // =========================================================
    // tolk 内サブ画面切り替え
    // =========================================================
    window.showNeoScreen = (mode) => {
        ["rooms-screen", "friends-screen", "chat-screen"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add("hidden");
        });
        const nav = document.getElementById("nav-area");
        if (nav) nav.classList.remove("hidden");

        if (mode === "rooms") {
            document.getElementById("rooms-screen").classList.remove("hidden");
            loadRooms();
        } else if (mode === "friends") {
            document.getElementById("friends-screen").classList.remove("hidden");
            loadFriendsScreen();
        } else if (mode === "chat") {
            document.getElementById("chat-screen").classList.remove("hidden");
            if (nav) nav.classList.add("hidden");
        }

        const tr = document.getElementById("tab-rooms");
        const tf = document.getElementById("tab-friends");
        if (tr) tr.classList.toggle("active", mode === "rooms");
        if (tf) tf.classList.toggle("active", mode === "friends");
    };

    // =========================================================
    // ルーム
    // =========================================================
    function loadRooms() {
        onSnapshot(
            query(collection(db, "rooms_v11"), orderBy("createdAt", "desc")),
            (snap) => {
                const list = document.getElementById("room-list-body");
                if (!list) return;
                list.innerHTML = "";
                snap.forEach(ds => {
                    const r = ds.data();
                    if (r.members && !r.members.includes(me.id) && r.owner !== me.id && ds.id !== "official-lounge") return;
                    const cnt      = r.members ? r.members.length : 0;
                    const isOwner  = r.owner === me.id && ds.id !== "official-lounge";
                    const isMember = r.members && r.members.includes(me.id) && !isOwner && ds.id !== "official-lounge";
                    const tr       = document.createElement("tr");
                    tr.className   = "data-row";
                    tr.innerHTML   = `
                        <td style="width:50px" onclick="window.openChat('${ds.id}','${r.name.replace(/'/g,"\\'")}')">
                            <img src="${r.img || DEFAULT_ROOM_IMG}" class="icon-cell">
                        </td>
                        <td style="text-align:left" onclick="window.openChat('${ds.id}','${r.name.replace(/'/g,"\\'")}')">
                            <b>${r.name}</b>
                            <span style="color:#888; font-size:12px;">(${cnt})</span>
                        </td>
                        <td style="text-align:right; white-space:nowrap;">
                            ${isOwner ? `
                                <button class="btn-sub btn-edit" onclick="window.openRoomModal('${ds.id}','${r.name.replace(/'/g,"\\'")}','${r.img || DEFAULT_ROOM_IMG}')">編集</button>
                                <button class="btn-sub btn-del"  onclick="window.deleteRoom('${ds.id}')">削除</button>
                            ` : ""}
                            ${isMember ? `<button class="btn-leave" onclick="window.leaveRoom('${ds.id}')">退出</button>` : ""}
                        </td>`;
                    list.appendChild(tr);
                });
            }
        );
    }

    window.leaveRoom  = async (rid) => { if (!confirm("このルームから退出しますか？")) return; await updateDoc(doc(db, "rooms_v11", rid), { members: arrayRemove(me.id) }); };
    window.deleteRoom = async (rid) => { if (confirm("ルームを削除しますか？")) await deleteDoc(doc(db, "rooms_v11", rid)); };

    // =========================================================
    // フレンド画面
    // =========================================================
    async function loadFriendsScreen() {
        const screen = document.getElementById("friends-screen");
        screen.innerHTML = `
            <div class="friend-tabs">
                <button class="f-tab active" id="ftab-friends"  onclick="window.switchFTab('friends')">フレンド</button>
                <button class="f-tab"        id="ftab-search"   onclick="window.switchFTab('search')">ユーザー検索</button>
                <button class="f-tab"        id="ftab-requests" onclick="window.switchFTab('requests')">
                    申請
                    <span id="friend-badge" style="display:none; background:var(--danger,#e74c3c); color:#fff; border-radius:50%; width:18px; height:18px; font-size:11px; align-items:center; justify-content:center; margin-left:4px;"></span>
                </button>
            </div>
            <div id="fpanel-friends"></div>
            <div id="fpanel-search"   style="display:none;">
                <div style="display:flex; gap:8px; margin:8px 0 12px;">
                    <input type="text" id="friend-search-input" class="input-field" placeholder="IDまたは名前で検索..." style="margin:0; flex:1;">
                    <button onclick="window.execFriendSearch()" style="background:var(--accent); color:#fff; border:none; padding:8px 14px; border-radius:10px; font-size:13px; cursor:pointer; white-space:nowrap;">検索</button>
                </div>
                <div id="friend-search-results"></div>
            </div>
            <div id="fpanel-requests" style="display:none;"><div id="requests-list"></div></div>
        `;
        watchPendingRequests();
        loadMyFriends();
    }

    window.switchFTab = (tab) => {
        ["friends", "search", "requests"].forEach(t => {
            const p = document.getElementById(`fpanel-${t}`);
            const b = document.getElementById(`ftab-${t}`);
            if (p) p.style.display = (t === tab) ? "block" : "none";
            if (b) b.classList.toggle("active", t === tab);
        });
        if (tab === "requests") loadPendingRequests();
        if (tab === "friends")  loadMyFriends();
    };

    async function loadMyFriends() {
        const panel = document.getElementById("fpanel-friends");
        if (!panel) return;
        const snap    = await getDoc(doc(db, "users_v11", me.id));
        const friends = snap.exists() ? (snap.data().friends || []) : [];
        me.friends    = friends;
        if (friends.length === 0) {
            panel.innerHTML = `<div style="text-align:center; padding:30px; color:#aaa; font-size:13px;">まだフレンドがいません<br>ユーザー検索から申請してみよう</div>`;
            return;
        }
        panel.innerHTML = "";
        for (const fid of friends) {
            const fs = await getDoc(doc(db, "users_v11", fid));
            if (!fs.exists()) continue;
            const u       = fs.data();
            const iconUrl = (u.icon && u.icon.val) ? u.icon.val : DEFAULT_IMG;
            const div     = document.createElement("div");
            div.className = "friend-item";
            const uJson   = JSON.stringify(u).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            div.innerHTML = `
                <img src="${iconUrl}" class="friend-avatar" onclick='window.viewUserProfile(${uJson})'>
                <div class="friend-info">
                    <b style="color:var(--text-main)">${u.name}</b>
                    <span style="color:#aaa; font-size:11px;">ID: ${u.id}</span>
                </div>
                <button class="btn-sub btn-del" onclick="window.removeFriend('${u.id}')">削除</button>
            `;
            panel.appendChild(div);
        }
    }

    window.execFriendSearch = async () => {
        const keyword = document.getElementById("friend-search-input").value.trim().toLowerCase();
        const results = document.getElementById("friend-search-results");
        if (!keyword) { results.innerHTML = `<div style="color:#aaa; font-size:12px; text-align:center; padding:10px;">キーワードを入力してください</div>`; return; }
        results.innerHTML = `<div style="color:#aaa; font-size:12px; text-align:center; padding:10px;">検索中...</div>`;

        const sentSnap = await getDocs(query(collection(db, "friend_requests"), where("from", "==", me.id)));
        const sentMap  = {};
        sentSnap.forEach(d => { sentMap[d.data().to] = d.data().status; });

        const snap      = await getDocs(collection(db, "users_v11"));
        const myFriends = me.friends || [];
        results.innerHTML = "";
        let count = 0;

        snap.forEach(ds => {
            const u = ds.data();
            if (u.id === me.id) return;
            if (!u.name.toLowerCase().includes(keyword) && !u.id.toLowerCase().includes(keyword)) return;
            count++;
            const iconUrl    = (u.icon && u.icon.val) ? u.icon.val : DEFAULT_IMG;
            const isFriend   = myFriends.includes(u.id);
            const sentStatus = sentMap[u.id];
            let actionBtn;
            if (isFriend || sentStatus === "accepted") {
                actionBtn = `<span class="friend-status-badge">フレンド ✓</span>`;
            } else if (sentStatus === "pending") {
                actionBtn = `<span style="color:#aaa; font-size:12px; font-weight:bold;">申請中...</span>`;
            } else {
                actionBtn = `<button class="btn-send-req" onclick="window.sendFriendRequest('${u.id}', this)">申請する</button>`;
            }
            const uJson = JSON.stringify(u).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            const div   = document.createElement("div");
            div.className = "friend-item";
            div.innerHTML = `
                <img src="${iconUrl}" class="friend-avatar" onclick='window.viewUserProfile(${uJson})'>
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

    window.sendFriendRequest = async (toId, btn) => {
        const existing = await getDocs(query(collection(db, "friend_requests"), where("from", "==", me.id), where("to", "==", toId)));
        if (!existing.empty) { btn.textContent = "申請済み"; btn.disabled = true; return; }
        await addDoc(collection(db, "friend_requests"), {
            from: me.id, fromName: me.name,
            fromIcon: (me.icon && me.icon.val) ? me.icon.val : DEFAULT_IMG,
            to: toId, status: "pending", createdAt: serverTimestamp()
        });
        btn.textContent = "申請中...";
        btn.disabled    = true;
        btn.classList.add("disabled");
    };

    function loadPendingRequests() {
        const list = document.getElementById("requests-list");
        if (!list) return;
        list.innerHTML = `<div style="color:#aaa; text-align:center; padding:20px; font-size:13px;">読み込み中...</div>`;
        onSnapshot(
            query(collection(db, "friend_requests"), where("to", "==", me.id), where("status", "==", "pending")),
            (snap) => {
                if (!document.getElementById("requests-list")) return;
                list.innerHTML = "";
                if (snap.empty) { list.innerHTML = `<div style="color:#aaa; text-align:center; padding:30px; font-size:13px;">申請はありません</div>`; return; }
                snap.forEach(ds => {
                    const req = ds.data();
                    const div = document.createElement("div");
                    div.className = "friend-item";
                    div.id        = `req-${ds.id}`;
                    div.innerHTML = `
                        <img src="${req.fromIcon || DEFAULT_IMG}" class="friend-avatar">
                        <div class="friend-info">
                            <b style="color:var(--text-main)">${req.fromName}</b>
                            <span style="color:#aaa; font-size:11px;">ID: ${req.from}</span>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button class="btn-accept" onclick="window.acceptRequest('${ds.id}','${req.from}')">承認</button>
                            <button class="btn-reject" onclick="window.rejectRequest('${ds.id}')">拒否</button>
                        </div>
                    `;
                    list.appendChild(div);
                });
            }
        );
    }

    window.acceptRequest = async (reqId, fromId) => {
        await updateDoc(doc(db, "friend_requests", reqId), { status: "accepted" });
        await updateDoc(doc(db, "users_v11", me.id),   { friends: arrayUnion(fromId) });
        await updateDoc(doc(db, "users_v11", fromId),  { friends: arrayUnion(me.id) });
        if (!me.friends) me.friends = [];
        if (!me.friends.includes(fromId)) me.friends.push(fromId);
    };

    window.rejectRequest = async (reqId) => {
        await updateDoc(doc(db, "friend_requests", reqId), { status: "rejected" });
    };

    window.removeFriend = async (fid) => {
        if (!confirm("フレンドを削除しますか？")) return;
        await updateDoc(doc(db, "users_v11", me.id),  { friends: arrayRemove(fid) });
        await updateDoc(doc(db, "users_v11", fid),    { friends: arrayRemove(me.id) });
        me.friends = (me.friends || []).filter(id => id !== fid);
        loadMyFriends();
    };

    // =========================================================
    // チャット
    // =========================================================
    window.openChat = (roomId, roomName) => {
        currentRoomId = roomId;
        document.getElementById("chat-title").innerText = roomName;
        window.showNeoScreen("chat");
        startChat(roomId);
    };

    function startChat(roomId) {
        if (chatUnsubscribe) chatUnsubscribe();
        chatUnsubscribe = onSnapshot(
            query(collection(db, "rooms_v11", roomId, "messages"), orderBy("createdAt", "asc"), limit(100)),
            (snap) => {
                const area = document.getElementById("chat-area");
                area.innerHTML = "";
                snap.forEach(dSnap => {
                    const d      = dSnap.data();
                    const mid    = dSnap.id;
                    const isMine = me && d.uid === me.id;
                    if (!isMine && (!d.readBy || !d.readBy.includes(me.id))) {
                        updateDoc(doc(db, "rooms_v11", roomId, "messages", mid), { readBy: arrayUnion(me.id) });
                    }
                    const time      = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                    const readCount = d.readBy ? d.readBy.length : 0;
                    const iconUrl   = isMine
                        ? ((me.icon && me.icon.val) ? me.icon.val : DEFAULT_IMG)
                        : ((d.icon  && d.icon.val)  ? d.icon.val  : DEFAULT_IMG);
                    const bubbleBg     = isMine ? "var(--primary)"       : "var(--card-bg,#fff)";
                    const bubbleColor  = isMine ? "#fff"                 : "var(--text-main)";
                    const bubbleBorder = isMine ? "none"                 : "1px solid var(--border-soft)";
                    const group        = document.createElement("div");
                    group.style        = `display:flex; gap:10px; margin-bottom:15px; flex-direction:${isMine ? "row-reverse" : "row"}; align-items:flex-start;`;
                    group.innerHTML    = `
                        <img src="${iconUrl}"
                             style="width:38px; height:38px; border-radius:50%; object-fit:cover; cursor:pointer; flex-shrink:0; border:2px solid ${isMine ? "var(--accent)" : "#eee"};"
                             onclick="window.viewUserById('${d.uid}')"
                             onerror="this.src='${DEFAULT_IMG}'">
                        <div style="max-width:70%; display:flex; flex-direction:column; align-items:${isMine ? "flex-end" : "flex-start"}">
                            <div style="font-size:10px; color:#888; margin-bottom:2px;">${d.name}</div>
                            <div style="display:flex; align-items:center; gap:5px; flex-direction:${isMine ? "row-reverse" : "row"};">
                                <div style="padding:10px; border-radius:15px; font-size:14px; background:${bubbleBg}; color:${bubbleColor}; border:${bubbleBorder}; cursor:pointer;"
                                     onclick="window.toggleMsgMenu('${mid}',${isMine})">
                                    ${d.media
                                        ? (d.media.type.startsWith("image")
                                            ? `<img src="${d.media.val}" style="max-width:100%; border-radius:10px;">`
                                            : `<video src="${d.media.val}" style="max-width:100%;" controls></video>`)
                                        : d.text}
                                </div>
                            </div>
                            <div id="menu-${mid}" class="hidden" style="margin-top:5px; display:flex; gap:5px;">
                                <button onclick="window.editMsg('${mid}','${(d.text||"").replace(/'/g,"\\'")}') " style="font-size:10px; padding:3px 8px; border-radius:5px; border:1px solid #ddd; background:var(--card-bg,#fff); color:var(--text-main);">編集</button>
                                <button onclick="window.deleteMsg('${mid}')" style="font-size:10px; padding:3px 8px; border-radius:5px; border:none; background:#ff7675; color:white;">削除</button>
                            </div>
                            <div style="font-size:9px; color:#aaa; margin-top:2px;">
                                ${isMine && readCount > 0 ? `<span style="color:var(--accent); font-weight:bold;">${readCount} 既読 </span>` : ""}${time}
                            </div>
                        </div>`;
                    area.appendChild(group);
                });
                area.scrollTop = area.scrollHeight;
            }
        );
    }

    window.toggleMsgMenu = (mid, isMine) => { if (isMine) document.getElementById(`menu-${mid}`).classList.toggle("hidden"); };
    window.editMsg       = async (mid, old) => { const n = prompt("編集:", old); if (n !== null && n !== old) await updateDoc(doc(db, "rooms_v11", currentRoomId, "messages", mid), { text: n }); };
    window.deleteMsg     = async (mid) => { if (confirm("削除しますか？")) await deleteDoc(doc(db, "rooms_v11", currentRoomId, "messages", mid)); };
    window.viewUserById  = async (uid) => { const s = await getDoc(doc(db, "users_v11", uid)); if (s.exists()) window.viewUserProfile(s.data()); };

    async function post(text, media = null) {
        if ((!text && !media) || !me || !currentRoomId) return;
        await addDoc(collection(db, "rooms_v11", currentRoomId, "messages"), {
            text, media, uid: me.id, name: me.name,
            icon: me.icon || { val: DEFAULT_IMG },
            readBy: [], createdAt: serverTimestamp()
        });
        document.getElementById("m-text").value = "";
    }

    document.getElementById("send-go").onclick  = () => post(document.getElementById("m-text").value.trim());
    window.sendEmoji = (emoji, anim)             => post(`<span class="animated-emoji ${anim}">${emoji}</span>`);
    document.getElementById("m-file").onchange  = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = (v) => post("", { type: f.type, val: v.target.result });
        r.readAsDataURL(f);
    };

    // =========================================================
    // プロフィール表示（他ユーザー）
    // =========================================================
    window.viewUserProfile = (u) => {
        document.getElementById("view-profile-icon").src           = (u.icon && u.icon.val) ? u.icon.val : DEFAULT_IMG;
        document.getElementById("view-profile-name").innerText     = u.name;
        document.getElementById("view-profile-id").innerText       = "ID: " + u.id;
        document.getElementById("view-profile-birthday").innerText = u.birthday || "未設定";
        document.getElementById("view-profile-bio").innerText      = u.bio || "自己紹介はありません。";
        openModal("view-profile-modal");
    };

    // =========================================================
    // ルームモーダル
    // =========================================================
    window.openRoomModal = async (rid = null, n = "", i = "") => {
        currentEditRoomId = rid;
        document.getElementById("modal-title").innerText  = rid ? "ルーム編集" : "ルーム作成";
        document.getElementById("room-name-input").value  = n;
        document.getElementById("room-preview").src       = rid ? (i || DEFAULT_ROOM_IMG) : DEFAULT_ROOM_IMG;
        const inviteList = document.getElementById("room-invite-list");
        inviteList.innerHTML = "読み込み中...";
        openModal("room-modal");

        let currentMembers = [];
        if (rid) {
            const rDoc = await getDoc(doc(db, "rooms_v11", rid));
            if (rDoc.exists()) currentMembers = rDoc.data().members || [];
        }
        const mySnap    = await getDoc(doc(db, "users_v11", me.id));
        const myFriends = mySnap.exists() ? (mySnap.data().friends || []) : [];
        inviteList.innerHTML = "";
        if (myFriends.length === 0) {
            inviteList.innerHTML = `<div style="color:#aaa; font-size:12px; text-align:center; padding:16px;">フレンドがいません</div>`;
        } else {
            for (const fid of myFriends) {
                const fs = await getDoc(doc(db, "users_v11", fid));
                if (!fs.exists()) continue;
                const u         = fs.data();
                const isChecked = currentMembers.includes(u.id) ? "checked" : "";
                const iconUrl   = (u.icon && u.icon.val) ? u.icon.val : DEFAULT_IMG;
                const div       = document.createElement("div");
                div.style       = "display:flex; align-items:center; gap:10px; padding:5px; border-bottom:1px solid var(--border-soft);";
                div.innerHTML   = `<input type="checkbox" class="invite-check" value="${u.id}" ${isChecked}><img src="${iconUrl}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;"><span style="font-size:12px; color:var(--text-main);">${u.name}</span>`;
                inviteList.appendChild(div);
            }
        }
    };

    document.getElementById("room-save-btn").onclick = async () => {
        const name        = document.getElementById("room-name-input").value.trim();
        if (!name) return;
        const selectedIds = Array.from(document.querySelectorAll(".invite-check:checked")).map(el => el.value);
        selectedIds.push(me.id);
        const roomImg = document.getElementById("room-preview").src || DEFAULT_ROOM_IMG;
        if (currentEditRoomId) {
            await updateDoc(doc(db, "rooms_v11", currentEditRoomId), { name, img: roomImg, members: selectedIds });
        } else {
            await addDoc(collection(db, "rooms_v11"), { name, img: roomImg, owner: me.id, members: selectedIds, createdAt: serverTimestamp() });
        }
        window.closeModal("room-modal");
    };

    document.getElementById("room-file-input").onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader    = new FileReader();
        reader.onload   = (ev) => { document.getElementById("room-preview").src = ev.target.result; };
        reader.readAsDataURL(file);
    };

    // =========================================================
    // 自分のプロフィール編集（index.html 内モーダル）
    // =========================================================
    document.getElementById("my-profile-btn-wrapper").onclick = () => {
        if (!me) return;
        document.getElementById("profile-edit-preview").src      = (me.icon && me.icon.val) ? me.icon.val : DEFAULT_IMG;
        document.getElementById("edit-profile-name").innerText   = me.name;
        document.getElementById("edit-profile-id").innerText     = "ID: " + me.id;
        document.getElementById("edit-birthday").value           = me.birthday || "";
        document.getElementById("edit-bio").value                = me.bio      || "";
        openModal("profile-modal");
    };

    document.getElementById("profile-file-input").onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader  = new FileReader();
        reader.onload = (ev) => { document.getElementById("profile-edit-preview").src = ev.target.result; };
        reader.readAsDataURL(file);
    };

    // 保存ボタン — applyProfileUpdate を呼んで me・Firebase・キャッシュ・ヘッダーを一括更新
    document.getElementById("profile-save-btn").onclick = async () => {
        const birthday = document.getElementById("edit-birthday").value;
        const bio      = document.getElementById("edit-bio").value.trim();
        const newIcon  = document.getElementById("profile-edit-preview").src;

        await applyProfileUpdate({ icon: newIcon, birthday, bio });

        alert("プロフィールを更新しました");
        window.closeModal("profile-modal");
    };
}
