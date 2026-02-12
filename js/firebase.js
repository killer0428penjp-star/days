import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, orderBy, onSnapshot, serverTimestamp, limit, addDoc, getDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBkKXKmrV-vzq3OoUrvihd4X9KGKpjoNBc", authDomain: "calender-98a9e.firebaseapp.com", projectId: "calender-98a9e" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, orderBy, onSnapshot, serverTimestamp, limit, addDoc, getDoc, arrayUnion };
function updateDisplay() {
            const now = new Date();
            
            // 日付の更新
            const month = now.getMonth() + 1;
            const date = now.getDate();
            const year = now.getFullYear();
            const dayNames = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
            const dayName = dayNames[now.getDay()];

            document.getElementById('year-label').innerText = year;
            document.getElementById('date-display').innerText = `${month}月 ${date}日`;
            document.getElementById('weekday-display').innerText = dayName;

            // 時計の更新
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            document.getElementById('clock-display').innerText = `${h}:${m}:${s}`;
        }

        // 1秒ごとに更新
        setInterval(updateDisplay, 1000);
        updateDisplay(); // 初回実行