import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, orderBy, onSnapshot, serverTimestamp, limit, addDoc, getDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBkKXKmrV-vzq3OoUrvihd4X9KGKpjoNBc", authDomain: "calender-98a9e.firebaseapp.com", projectId: "calender-98a9e" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, orderBy, onSnapshot, serverTimestamp, limit, addDoc, getDoc, arrayUnion };