// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  update,
  get,
  runTransaction,
  serverTimestamp,
} from "firebase/database";
import { getAnalytics } from "firebase/analytics";
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCW3a_f5GlGuTRtvWX-Lf9RnV4H55rR89A",
  authDomain: "imposter-game-5bf76.firebaseapp.com",
  databaseURL: "https://imposter-game-5bf76-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "imposter-game-5bf76",
  storageBucket: "imposter-game-5bf76.firebasestorage.app",
  messagingSenderId: "662919374116",
  appId: "1:662919374116:web:883e32d23baf287c0bffb1",
  measurementId: "G-3M4BD4BPQR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export {
  db,
  ref,
  set,
  push,
  onValue,
  update,
  get,
  runTransaction,
  serverTimestamp,
};
