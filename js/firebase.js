import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, orderBy, onSnapshot, serverTimestamp, limit, addDoc, getDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBkKXKmrV-vzq3OoUrvihd4X9KGKpjoNBc", authDomain: "calender-98a9e.firebaseapp.com", projectId: "calender-98a9e" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, orderBy, onSnapshot, serverTimestamp, limit, addDoc, getDoc, arrayUnion };
function updateDate() {
    const now = new Date();
    const days = ['日', '月', '火', '水', '木', '金', '土'];

    // 年・月・日を取得
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const w = days[now.getDay()]; // 曜日

    // HTMLに書き込み
    const dateEl = document.getElementById('date-display');
    if (dateEl) {
        dateEl.innerText = `${y}/${m}/${d} (${w})`;
    }
}

// 初回実行
updateDate();
// 1時間ごとに更新（日付の切り替わり対策）
setInterval(updateDate, 3600000);