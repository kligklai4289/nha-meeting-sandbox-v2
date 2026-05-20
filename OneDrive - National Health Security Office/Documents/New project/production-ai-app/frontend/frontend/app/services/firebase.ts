import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCzW7VUELVRZ4Hww4fWtMmZxJ7Uby9SZfU",
  authDomain: "nhso4-01-srr.firebaseapp.com",
  projectId: "nhso4-01-srr",
  storageBucket: "nhso4-01-srr.firebasestorage.app",
  messagingSenderId: "16601624547",
  appId: "1:16601624547:web:aa62d5c74ffd4812defad6"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
