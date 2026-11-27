// =========================================================
// MINHA CASA, MINHA DESPENSA - LÓGICA PRINCIPAL (FASE 4)
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
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  limit,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { CATEGORIAS_FIXAS, MEDIDAS_FIXAS, INSTRUCOES_AJUDA } from "./dados-fixos.js";
import { ICONES, inserirIconesNaPagina } from "./icones.js";

// Estado global da despensa sincronizado em tempo real
let listaProdutosDespensa = [];
let cancelarEscutaDespensa = null;
let filtroGrupoAtual = "Todos";

const telaLogin = document.getElementById("tela-login");
const appShell = document.getElementById("app-shell");
const loginMensagem = document.getElementById("login-mensagem");
const usuarioLogadoEmail = document.getElementById("usuario-logado-email");

// Formata números decimais de forma limpa (ex: 1.50 -> 1,5 | 2.00 -> 2)
function formatarNumero(valor) {
  const num = Number(valor) || 0;
  return Number.isInteger(num) ? num.toString() : num.toFixed(2).replace(".", ",").replace(/0$/, "");
}

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

function mostrarMensagemDespensa(texto, tipo = "sucesso") {
  const box = document.getElementById("despensa-mensagem");
  if (!box) return;
  box.textContent = texto;
  box.className = `mensagem-feedback ${
    tipo === "erro" ? "mensagem-erro" : "mensagem-sucesso"
  }`;
  box.classList.remove("oculto");
  setTimeout(() => box.classList.add("oculto"), 4500);
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
// 3. CATEGORIAS DEPENDENTES E FORMULÁRIO DE PRODUTOS
// =========================================================
function atualizarOpcoesSubcategoria(grupoSelecionado, categoriaParaMarcar = "") {
  const selectCategoria = document.getElementById("prod-categoria");
  const subcategorias = CATEGORIAS_FIXAS[grupoSelecionado] || [];

  selectCategoria.innerHTML = subcategorias
    .map((cat) => `<option value="${cat}">${cat}</option>`)
    .join("");

  if (categoriaParaMarcar && subcategorias.includes(categoriaParaMarcar)) {
    selectCategoria.value = categoriaParaMarcar;
  }
}

function preencherOpcoesUnidadesEmbalagem() {
  const selectUnidade = document.getElementById("prod-unidade");
  selectUnidade.innerHTML = MEDIDAS_FIXAS.unidadesEmbalagem
    .map((u) => `<option value="${u.id}">${u.nome}</option>`)
    .join("");
}

function abrirFormularioProduto(produtoParaEditar = null) {
  const painel = document.getElementById("painel-form-produto");
  const titulo = document.getElementById("titulo-form-produto");
  const inputId = document.getElementById("produto-id-edicao");
  const selectGrupo = document.getElementById("prod-grupo");
  const inputNome = document.getElementById("prod-nome");
  const inputTamanho = document.getElementById("prod-tamanho");
  const selectUnidade = document.getElementById("prod-unidade");
  const inputQuantidade = document.getElementById("prod-quantidade");
  const inputMinimo = document.getElementById("prod-minimo");
  const checkXicaras = document.getElementById("prod-usa-xicaras");
  const grupoXicaras = document.getElementById("grupo-rendimento-xicaras");
  const inputXicaras = document.getElementById("prod-xicaras-por-embalagem");

  if (produtoParaEditar) {
    titulo.textContent = `Editar Produto: ${produtoParaEditar.nome}`;
    inputId.value = produtoParaEditar.id;
    selectGrupo.value = produtoParaEditar.grupo;
    atualizarOpcoesSubcategoria(produtoParaEditar.grupo, produtoParaEditar.categoria);
    inputNome.value = produtoParaEditar.nome;
    inputTamanho.value = produtoParaEditar.tamanhoEmbalagem;
    selectUnidade.value = produtoParaEditar.unidadeEmbalagem;
    inputQuantidade.value = produtoParaEditar.quantidadeAtual;
    inputMinimo.value = produtoParaEditar.estoqueMinimo;

    const usaXic = Boolean(produtoParaEditar.usaRendimentoXicaras);
    checkXicaras.checked = usaXic;
    if (usaXic) {
      grupoXicaras.classList.remove("oculto");
      inputXicaras.required = true;
      inputXicaras.value = produtoParaEditar.xicarasPorEmbalagem || "";
    } else {
      grupoXicaras.classList.add("oculto");
      inputXicaras.required = false;
      inputXicaras.value = "";
    }
  } else {
    titulo.textContent = "Novo Produto na Despensa";
    inputId.value = "";
    document.getElementById("form-produto").reset();
    selectGrupo.value = "Mantimentos";
    atualizarOpcoesSubcategoria("Mantimentos");
    grupoXicaras.classList.add("oculto");
    inputXicaras.required = false;
  }

  painel.classList.remove("oculto");
  painel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fecharFormularioProduto() {
  const painel = document.getElementById("painel-form-produto");
  painel.classList.add("oculto");
  document.getElementById("form-produto").reset();
  document.getElementById("produto-id-edicao").value = "";
  document.getElementById("grupo-rendimento-xicaras").classList.add("oculto");
}

function configurarFormularioDespensa() {
  const selectGrupo = document.getElementById("prod-grupo");
  const checkXicaras = document.getElementById("prod-usa-xicaras");
  const grupoXicaras = document.getElementById("grupo-rendimento-xicaras");
  const inputXicaras = document.getElementById("prod-xicaras-por-embalagem");
  const formProduto = document.getElementById("form-produto");

  atualizarOpcoesSubcategoria("Mantimentos");
  preencherOpcoesUnidadesEmbalagem();

  // Filtra subcategorias automaticamente ao trocar Mantimentos <-> Limpeza
  selectGrupo.addEventListener("change", () => {
    atualizarOpcoesSubcategoria(selectGrupo.value);
  });

  // Mostra/esconde o campo extra de rendimento em xícaras
  checkXicaras.addEventListener("change", () => {
    if (checkXicaras.checked) {
      grupoXicaras.classList.remove("oculto");
      inputXicaras.required = true;
      inputXicaras.focus();
    } else {
      grupoXicaras.classList.add("oculto");
      inputXicaras.required = false;
      inputXicaras.value = "";
    }
  });

  // Botões de abrir e fechar formulário
  document.getElementById("btn-abrir-form-produto").addEventListener("click", () => {
    abrirFormularioProduto(null);
  });

  document.getElementById("btn-fechar-form-produto").addEventListener("click", fecharFormularioProduto);
  document.getElementById("btn-cancelar-produto").addEventListener("click", fecharFormularioProduto);

  // Atalho "Cadastrar Produto" da Tela Inicial abre a Despensa já com o formulário aberto
  document.getElementById("atalho-cadastrar-produto").addEventListener("click", () => {
    navegarPara("despensa");
    abrirFormularioProduto(null);
  });

  // Salvar Produto Novo ou Edição no Firestore
  formProduto.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSalvar = document.getElementById("btn-salvar-produto");
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    const idEdicao = document.getElementById("produto-id-edicao").value;
    const usaXicaras = checkXicaras.checked;

    const dadosProduto = {
      grupo: selectGrupo.value,
      categoria: document.getElementById("prod-categoria").value,
      nome: document.getElementById("prod-nome").value.trim(),
      tamanhoEmbalagem: parseFloat(document.getElementById("prod-tamanho").value),
      unidadeEmbalagem: document.getElementById("prod-unidade").value,
      quantidadeAtual: parseFloat(document.getElementById("prod-quantidade").value),
      estoqueMinimo: parseFloat(document.getElementById("prod-minimo").value),
      usaRendimentoXicaras: usaXicaras,
      xicarasPorEmbalagem: usaXicaras ? parseFloat(inputXicaras.value) : null,
      atualizadoPor: auth.currentUser ? auth.currentUser.email : "familiar",
      atualizadoEm: serverTimestamp()
    };

    try {
      if (idEdicao) {
        await updateDoc(doc(db, "despensa", idEdicao), dadosProduto);
        mostrarMensagemDespensa(`"${dadosProduto.nome}" foi atualizado com sucesso!`);
      } else {
        await addDoc(collection(db, "despensa"), dadosProduto);
        mostrarMensagemDespensa(`"${dadosProduto.nome}" foi cadastrado na despensa!`);
      }
      fecharFormularioProduto();
    } catch (erro) {
      console.error("Erro ao salvar produto:", erro);
      mostrarMensagemDespensa("Erro ao salvar produto. Verifique sua conexão.", "erro");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar na Despensa";
    }
  });
}

// =========================================================
// 4. RENDERIZAÇÃO EM TEMPO REAL (TELA INICIAL E DESPENSA)
// =========================================================
function obterStatusEstoque(produto) {
  const atual = Number(produto.quantidadeAtual) || 0;
  const minimo = Number(produto.estoqueMinimo) || 0;

  if (atual <= 0) {
    return { classeCard: "status-zerado", seloHtml: `<span class="tag-alerta-inline tag-alerta-vermelho">${ICONES.alertaTriangulo} Zerado</span>` };
  }
  if (atual <= minimo) {
    return { classeCard: "status-baixo", seloHtml: `<span class="tag-alerta-inline tag-alerta-laranja">${ICONES.alertaTriangulo} Acabando</span>` };
  }
  return { classeCard: "", seloHtml: "" };
}

function criarCardProdutoHtml(produto, mostrarBotoesGerencia = false) {
  const status = obterStatusEstoque(produto);
  const qtdFormatada = formatarNumero(produto.quantidadeAtual);
  const tamFormatado = formatarNumero(produto.tamanhoEmbalagem);
  const infoXicaras =
    produto.usaRendimentoXicaras && produto.xicarasPorEmbalagem
      ? ` • Rende ${formatarNumero(produto.xicarasPorEmbalagem)} xíc./emb.`
      : "";

  const botoesHtml = mostrarBotoesGerencia
    ? `
      <div class="acoes-item-despensa">
        <button type="button" class="btn-mini-acao editar" data-acao="editar" data-id="${produto.id}" title="Editar produto">
          ${ICONES.editar}
        </button>
        <button type="button" class="btn-mini-acao excluir" data-acao="excluir" data-id="${produto.id}" title="Excluir produto">
          ${ICONES.lixeira}
        </button>
      </div>
    `
    : "";

  return `
    <article class="card-produto ${status.classeCard}">
      <div class="card-produto-info">
        <div class="card-produto-topo">
          <span class="card-produto-nome">${produto.nome}</span>
          <span class="tag-categoria">${produto.categoria}</span>
          ${status.seloHtml}
        </div>
        <div class="card-produto-detalhe">
          Embalagem de ${tamFormatado} ${produto.unidadeEmbalagem} • Mín: ${formatarNumero(produto.estoqueMinimo)}${infoXicaras}
        </div>
      </div>

      <div class="card-produto-direita">
        <div class="pilula-quantidade">
          <span class="qtd-numero">${qtdFormatada}</span>
          <span class="qtd-unidade">emb. (${tamFormatado}${produto.unidadeEmbalagem})</span>
        </div>
        ${botoesHtml}
      </div>
    </article>
  `;
}

function renderizarResumoVivoInicio() {
  const termoBusca = (document.getElementById("busca-inicio")?.value || "").toLowerCase().trim();
  const listaMantimentosEl = document.getElementById("lista-vivo-mantimentos");
  const listaLimpezaEl = document.getElementById("lista-vivo-limpeza");
  const resumoTotalEl = document.getElementById("resumo-total-itens");

  const filtrados = listaProdutosDespensa.filter(
    (p) =>
      p.nome.toLowerCase().includes(termoBusca) ||
      p.categoria.toLowerCase().includes(termoBusca)
  );

  const mantimentos = filtrados.filter((p) => p.grupo === "Mantimentos");
  const limpeza = filtrados.filter((p) => p.grupo === "Material de Limpeza");

  document.getElementById("contagem-mantimentos").textContent = `${mantimentos.length} ${mantimentos.length === 1 ? "item" : "itens"}`;
  document.getElementById("contagem-limpeza").textContent = `${limpeza.length} ${limpeza.length === 1 ? "item" : "itens"}`;

  if (resumoTotalEl) {
    const totalGeral = listaProdutosDespensa.length;
    resumoTotalEl.textContent =
      totalGeral === 0
        ? "Sua despensa está pronta para o 1º cadastro"
        : `${totalGeral} ${totalGeral === 1 ? "produto cadastrado" : "produtos cadastrados"} em casa`;
  }

  listaMantimentosEl.innerHTML =
    mantimentos.length > 0
      ? mantimentos.map((p) => criarCardProdutoHtml(p, false)).join("")
      : `<p class="estado-vazio">Nenhum mantimento encontrado.</p>`;

  listaLimpezaEl.innerHTML =
    limpeza.length > 0
      ? limpeza.map((p) => criarCardProdutoHtml(p, false)).join("")
      : `<p class="estado-vazio">Nenhum material de limpeza encontrado.</p>`;
}

function renderizarListaGerenciarDespensa() {
  const container = document.getElementById("lista-gerenciar-despensa");
  if (!container) return;

  const termoBusca = (document.getElementById("busca-despensa")?.value || "").toLowerCase().trim();

  const filtrados = listaProdutosDespensa.filter((p) => {
    const bateGrupo = filtroGrupoAtual === "Todos" || p.grupo === filtroGrupoAtual;
    const bateTexto =
      p.nome.toLowerCase().includes(termoBusca) ||
      p.categoria.toLowerCase().includes(termoBusca);
    return bateGrupo && bateTexto;
  });

  if (filtrados.length === 0) {
    container.innerHTML = `<p class="estado-vazio">Nenhum produto encontrado neste filtro. Clique em "+ Cadastrar" acima para adicionar.</p>`;
    return;
  }

  container.innerHTML = filtrados.map((p) => criarCardProdutoHtml(p, true)).join("");

  // Eventos dos botões Editar e Excluir
  container.querySelectorAll("[data-acao]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const produto = listaProdutosDespensa.find((item) => item.id === id);
      if (!produto) return;

      if (btn.dataset.acao === "editar") {
        abrirFormularioProduto(produto);
      } else if (btn.dataset.acao === "excluir") {
        const confirmou = window.confirm(`Deseja realmente excluir "${produto.nome}" da despensa?`);
        if (confirmou) {
          try {
            await deleteDoc(doc(db, "despensa", id));
            mostrarMensagemDespensa(`"${produto.nome}" foi removido da despensa.`);
          } catch (erro) {
            console.error("Erro ao excluir:", erro);
            mostrarMensagemDespensa("Não foi possível excluir o item.", "erro");
          }
        }
      }
    });
  });
}

function iniciarEscutaTempoRealDespensa() {
  if (cancelarEscutaDespensa) cancelarEscutaDespensa();

  const consultaDespensa = query(collection(db, "despensa"), orderBy("nome", "asc"));

  cancelarEscutaDespensa = onSnapshot(
    consultaDespensa,
    (snapshot) => {
      listaProdutosDespensa = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data()
      }));

      renderizarResumoVivoInicio();
      renderizarListaGerenciarDespensa();
    },
    (erro) => {
      console.error("Erro na sincronização em tempo real:", erro);
    }
  );
}

// =========================================================
// 5. AUTENTICAÇÃO E VERIFICAÇÃO DE ACESSO DA FAMÍLIA
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
    if (cancelarEscutaDespensa) {
      cancelarEscutaDespensa();
      cancelarEscutaDespensa = null;
    }
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

    // Liga a sincronização em tempo real com o Firebase
    iniciarEscutaTempoRealDespensa();
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
  configurarFormularioDespensa();

  // Navegação inferior e atalhos
  document.querySelectorAll(".nav-item").forEach((botao) => {
    botao.addEventListener("click", () => navegarPara(botao.dataset.tela));
  });

  document.querySelectorAll("[data-ir-para]").forEach((botao) => {
    botao.addEventListener("click", () => navegarPara(botao.dataset.irPara));
  });

  // Filtros e buscas em tempo real
  document.getElementById("busca-inicio").addEventListener("input", renderizarResumoVivoInicio);
  document.getElementById("busca-despensa").addEventListener("input", renderizarListaGerenciarDespensa);

  document.querySelectorAll(".aba-filtro").forEach((aba) => {
    aba.addEventListener("click", () => {
      document.querySelectorAll(".aba-filtro").forEach((a) => a.classList.remove("ativa"));
      aba.classList.add("ativa");
      filtroGrupoAtual = aba.dataset.filtroGrupo;
      renderizarListaGerenciarDespensa();
    });
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.error("Aviso Service Worker:", err);
    });
  }
});