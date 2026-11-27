// =========================================================
// MINHA CASA, MINHA DESPENSA - LÓGICA PRINCIPAL (FASE 1)
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Confirma que o JavaScript moderno (ES Modules) está rodando
  const jsStatus = document.getElementById('status-js');
  if (jsStatus) {
    jsStatus.textContent = '✅ JavaScript Moderno ativo e funcionando';
  }

  // 2. Registra o Service Worker para transformar o site em PWA instalável
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