// =========================================================
// MINHA CASA, MINHA DESPENSA - LÓGICA PRINCIPAL (FASE 2)
// =========================================================
import { auth, db } from "./firebase-config.js";

document.addEventListener('DOMContentLoaded', () => {
  // 1. Confirma que o JavaScript moderno (ES Modules) está rodando
  const jsStatus = document.getElementById('status-js');
  if (jsStatus) {
    jsStatus.textContent = '✅ JavaScript Moderno ativo e funcionando';
  }

  // 2. Verifica se o Firebase Auth e o Firestore foram inicializados com sucesso
  const fbStatus = document.getElementById('status-firebase');
  if (fbStatus) {
    if (auth && db && auth.app.options.projectId && !auth.app.options.projectId.includes("COLE_SEU")) {
      fbStatus.textContent = `✅ Firebase conectado ao projeto: ${auth.app.options.projectId}`;
    } else {
      fbStatus.textContent = '❌ Verifique as chaves coladas no arquivo firebase-config.js';
    }
  }

  // 3. Registra o Service Worker para transformar o site em PWA instalável
  const pwaStatus = document.getElementById('status-pwa');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => {
        if (pwaStatus) {
          pwaStatus.textContent = '✅ Service Worker PWA registrado com sucesso';
        }
      })
      .catch((erro) => {
        console.error('Erro ao registrar Service Worker:', erro);
        if (pwaStatus) {
          pwaStatus.textContent = '⚠️ Aviso no Service Worker (ver console)';
        }
      });
  } else if (pwaStatus) {
    pwaStatus.textContent = '⚠️ Navegador sem suporte a Service Worker';
  }
});