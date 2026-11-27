// =========================================================
// CONEXÃO COM O GOOGLE FIREBASE (MODULAR SDK v11 VIA CDN)
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// COLE AQUI AS SUAS CHAVES DO PASSO 2.2 (substituindo os valores de exemplo abaixo)
const firebaseConfig = {
  apiKey: "AIzaSyAHMfmDe0HaK2j5JTtE1KmRzLaLRhH46hA",
  authDomain: "minha-casa-minha-despensa.firebaseapp.com",
  projectId: "minha-casa-minha-despensa",
  storageBucket: "minha-casa-minha-despensa.firebasestorage.app",
  messagingSenderId: "530716893435",
  appId: "1:530716893435:web:a46931a1033536a189905e"
};

// Inicializa o aplicativo Firebase e exporta os serviços de Login e Banco de Dados
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);