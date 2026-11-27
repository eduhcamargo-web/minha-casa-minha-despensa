// =========================================================
// MINHA CASA, MINHA DESPENSA - LÓGICA PRINCIPAL (FASE 3.5)
// =========================================================
import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  limit
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { INSTRUCOES_AJUDA } from "./dados-fixos.js";
import { ICONES, inserirIconesNaPagina } from "./icones.js";

const telaLogin = document.getElementById("tela-login");
const appShell = document.getElementById("app-shell");
const loginMensagem = document.getElementById("login-mensagem");
const usuarioLogadoEmail = document.getElementById("usuario-logado-email");

function mostrarMensagemLogin(texto, tipo = "erro") {
  loginMensagem.textContent = texto;
  loginMensagem.className = `mensagem-feedback ${
    tipo === "erro" ? "mensagem-erro" : "mensagem-sucesso"
  }`;
  loginMensagem.classList.remove("oculto");
}

function limparMensagemLogin() {
  loginMensagem.classList.add("oculto");
  loginMensagem.textContent = "";
}

// =========================================================
// 1. NAVEGAÇÃO ENTRE AS 7 TELAS DO APLICATIVO
// =========================================================
export function navegarPara(nomeTela) {
  document.querySelectorAll(".tela").forEach((secao) => {
    secao.classList.remove("ativa");
  });

  const telaAlvo = document.getElementById(`tela-${nomeTela}`);
  if (telaAlvo) {
    telaAlvo.classList.add("ativa");
  }

  document.querySelectorAll(".nav-item").forEach((botao) => {
    if (botao.dataset.tela === nomeTela) {
      botao.classList.add("ativo");
    } else {
      botao.classList.remove("ativo");
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// =========================================================
// 2. RENDERIZAÇÃO DO MANUAL EM FAIXAS PASTÉIS
// =========================================================
function renderizarTelaAjuda() {
  const containerAjuda = document.getElementById("lista-passos-ajuda");
  if (!containerAjuda) return;

  containerAjuda.innerHTML = INSTRUCOES_AJUDA.map(
    (item) => `
      <article class="faixa-pastel ${item.faixaClasse}">
        <div class="faixa-info">
          <span class="faixa-passo-tag">Passo ${item.passo}</span>
          <h3>${item.titulo}</h3>
          <p>${item.descricao}</p>
        </div>
        <div class="faixa-emblema-branco">
          ${ICONES[item.icone] || ""}
        </div>
      </article>
    `
  ).join("");
}

// =========================================================
// 3. AUTENTICAÇÃO E VERIFICAÇÃO DE ACESSO DA FAMÍLIA
// =========================================================
async function verificarPermissaoFamiliar() {
  try {
    const consultaTeste = query(collection(db, "despensa"), limit(1));
    await getDocs(consultaTeste);
    return true;
  } catch (erro) {
    console.warn("Acesso bloqueado pelas regras de segurança:", erro.code);
    return false;
  }
}

function configurarEventosLogin() {
  const formLogin = document.getElementById("form-login");
  const btnEmail = document.getElementById("btn-entrar-email");
  const btnGoogle = document.getElementById("btn-entrar-google");
  const btnSair = document.getElementById("btn-sair");

  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    limparMensagemLogin();

    const email = document.getElementById("login-email").value.trim();
    const senha = document.getElementById("login-senha").value;

    btnEmail.disabled = true;
    btnEmail.textContent = "Verificando acesso...";

    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (erro) {
      let mensagem = "Não foi possível entrar. Verifique seu e-mail e senha.";
      if (
        erro.code === "auth/invalid-credential" ||
        erro.code === "auth/wrong-password" ||
        erro.code === "auth/user-not-found"
      ) {
        mensagem = "E-mail ou senha incorretos. Confira os dados cadastrados no Firebase.";
      } else if (erro.code === "auth/too-many-requests") {
        mensagem = "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.";
      }
      mostrarMensagemLogin(mensagem, "erro");
    } finally {
      btnEmail.disabled = false;
      btnEmail.textContent = "Entrar com E-mail e Senha";
    }
  });

  btnGoogle.addEventListener("click", async () => {
    limparMensagemLogin();
    btnGoogle.disabled = true;
    const provedorGoogle = new GoogleAuthProvider();

    try {
      await signInWithPopup(auth, provedorGoogle);
    } catch (erro) {
      if (erro.code !== "auth/popup-closed-by-user") {
        mostrarMensagemLogin(
          "Erro ao abrir janela do Google. Abra o site em uma aba normal do navegador.",
          "erro"
        );
      }
    } finally {
      btnGoogle.disabled = false;
    }
  });

  btnSair.addEventListener("click", async () => {
    await signOut(auth);
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const autorizado = await verificarPermissaoFamiliar();

    if (!autorizado) {
      await signOut(auth);
      telaLogin.classList.remove("oculto");
      appShell.classList.add("oculto");
      mostrarMensagemLogin(
        `O e-mail "${user.email}" não está na lista de familiares autorizados nas regras do Firestore.`,
        "erro"
      );
      return;
    }

    limparMensagemLogin();
    usuarioLogadoEmail.textContent = user.email;
    telaLogin.classList.add("oculto");
    appShell.classList.remove("oculto");
  } else {
    telaLogin.classList.remove("oculto");
    appShell.classList.add("oculto");
  }
});

// =========================================================
// INICIALIZAÇÃO DO APLICATIVO
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
  inserirIconesNaPagina();
  renderizarTelaAjuda();
  configurarEventosLogin();

  document.querySelectorAll(".nav-item").forEach((botao) => {
    botao.addEventListener("click", () => {
      navegarPara(botao.dataset.tela);
    });
  });

  document.querySelectorAll("[data-ir-para]").forEach((botao) => {
    botao.addEventListener("click", () => {
      navegarPara(botao.dataset.irPara);
    });
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.error("Aviso Service Worker:", err);
    });
  }
});