// =========================================================
// MINHA CASA, MINHA DESPENSA - LÓGICA PRINCIPAL (FASE 8)
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
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { CATEGORIAS_FIXAS, MEDIDAS_FIXAS, INSTRUCOES_AJUDA } from "./dados-fixos.js";
import { ICONES, inserirIconesNaPagina } from "./icones.js";
import { calcularFracaoEmbalagem } from "./conversor-medidas.js";

// Estado global sincronizado em tempo real
let listaProdutosDespensa = [];
let listaReceitas = [];
let listaCompras = [];
let receitaAbertaId = null;
let primeiraCargaDespensa = true;

let cancelarEscutaDespensa = null;
let cancelarEscutaRetiradas = null;
let cancelarEscutaReceitas = null;
let cancelarEscutaCompras = null;
let filtroGrupoAtual = "Todos";

const CHAVE_ALERTAS_NOTIFICADOS = "mc_md_alertas_notificados_v1";

const telaLogin = document.getElementById("tela-login");
const appShell = document.getElementById("app-shell");
const loginMensagem = document.getElementById("login-mensagem");
const usuarioLogadoEmail = document.getElementById("usuario-logado-email");

function formatarNumero(valor) {
  const num = Number(valor) || 0;
  return Number.isInteger(num)
    ? num.toString()
    : num.toFixed(2).replace(".", ",").replace(/0$/, "");
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

function mostrarMensagemRetirada(texto, tipo = "sucesso") {
  const box = document.getElementById("retirada-mensagem");
  if (!box) return;
  box.textContent = texto;
  box.className = `mensagem-feedback ${
    tipo === "erro" ? "mensagem-erro" : "mensagem-sucesso"
  }`;
  box.classList.remove("oculto");
  setTimeout(() => box.classList.add("oculto"), 5000);
}

function mostrarMensagemReceitas(texto, tipo = "sucesso") {
  const box = document.getElementById("receitas-mensagem");
  if (!box) return;
  box.textContent = texto;
  box.className = `mensagem-feedback ${
    tipo === "erro" ? "mensagem-erro" : "mensagem-sucesso"
  }`;
  box.classList.remove("oculto");
  setTimeout(() => box.classList.add("oculto"), 5000);
}

function mostrarMensagemCompras(texto, tipo = "sucesso") {
  const box = document.getElementById("compras-mensagem");
  if (!box) return;
  box.textContent = texto;
  box.className = `mensagem-feedback ${
    tipo === "erro" ? "mensagem-erro" : "mensagem-sucesso"
  }`;
  box.classList.remove("oculto");
  setTimeout(() => box.classList.add("oculto"), 5000);
}

function mostrarMensagemAlertas(texto, tipo = "sucesso") {
  const box = document.getElementById("alertas-mensagem");
  if (!box) return;
  box.textContent = texto;
  box.className = `mensagem-feedback ${
    tipo === "erro" ? "mensagem-erro" : "mensagem-sucesso"
  }`;
  box.classList.remove("oculto");
  setTimeout(() => box.classList.add("oculto"), 5500);
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

  if (nomeTela === "alertas") {
    atualizarStatusPainelNotificacoes();
  }

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

  selectGrupo.addEventListener("change", () => {
    atualizarOpcoesSubcategoria(selectGrupo.value);
  });

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

  document.getElementById("btn-abrir-form-produto").addEventListener("click", () => {
    abrirFormularioProduto(null);
  });

  document.getElementById("btn-fechar-form-produto").addEventListener("click", fecharFormularioProduto);
  document.getElementById("btn-cancelar-produto").addEventListener("click", fecharFormularioProduto);

  document.getElementById("atalho-cadastrar-produto").addEventListener("click", () => {
    navegarPara("despensa");
    abrirFormularioProduto(null);
  });

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
// 4. TELA DEDICADA DE RETIRADA / BAIXA NO ESTOQUE
// =========================================================
function preencherUnidadesRetirada() {
  const selectUnidade = document.getElementById("retirada-unidade");
  if (!selectUnidade) return;

  selectUnidade.innerHTML = MEDIDAS_FIXAS.unidadesRetiradaReceita
    .map((u) => `<option value="${u.id}">${u.nome}</option>`)
    .join("");
}

function atualizarListaProdutosRetirada() {
  const selectProduto = document.getElementById("retirada-produto");
  if (!selectProduto) return;

  const selecionadoAnterior = selectProduto.value;
  const disponiveis = listaProdutosDespensa.filter(
    (p) => Number(p.quantidadeAtual) > 0
  );

  if (disponiveis.length === 0) {
    selectProduto.innerHTML = `<option value="">Nenhum produto com saldo disponível na despensa</option>`;
    document.getElementById("grupo-campos-retirada").classList.add("oculto");
    return;
  }

  selectProduto.innerHTML =
    `<option value="">Selecione um produto (${disponiveis.length} disponíveis)...</option>` +
    disponiveis
      .map(
        (p) =>
          `<option value="${p.id}">${p.nome} — Saldo: ${formatarNumero(p.quantidadeAtual)} emb. (${formatarNumero(p.tamanhoEmbalagem)}${p.unidadeEmbalagem})</option>`
      )
      .join("");

  if (selecionadoAnterior && disponiveis.some((p) => p.id === selecionadoAnterior)) {
    selectProduto.value = selecionadoAnterior;
    atualizarDetalhesProdutoRetirada();
  } else {
    document.getElementById("grupo-campos-retirada").classList.add("oculto");
  }
}

function atualizarDetalhesProdutoRetirada() {
  const selectProduto = document.getElementById("retirada-produto");
  const grupoCampos = document.getElementById("grupo-campos-retirada");
  const boxInfo = document.getElementById("info-saldo-selecionado");
  const inputQtd = document.getElementById("retirada-quantidade");

  const produto = listaProdutosDespensa.find((p) => p.id === selectProduto.value);

  if (!produto) {
    grupoCampos.classList.add("oculto");
    inputQtd.required = false;
    return;
  }

  grupoCampos.classList.remove("oculto");
  inputQtd.required = true;

  const textoXicaras =
    produto.usaRendimentoXicaras && produto.xicarasPorEmbalagem
      ? `<br><strong>Rendimento configurado:</strong> 1 embalagem rende ${formatarNumero(produto.xicarasPorEmbalagem)} xícaras.`
      : "";

  boxInfo.innerHTML = `
    <strong>Saldo atual em casa:</strong> ${formatarNumero(produto.quantidadeAtual)} embalagem(ns) de ${formatarNumero(produto.tamanhoEmbalagem)} ${produto.unidadeEmbalagem}.${textoXicaras}
  `;

  atualizarPreviewConversaoRetirada();
}

function atualizarPreviewConversaoRetirada() {
  const selectProduto = document.getElementById("retirada-produto");
  const inputQtd = document.getElementById("retirada-quantidade");
  const selectUnidade = document.getElementById("retirada-unidade");
  const boxPreview = document.getElementById("preview-conversao-retirada");

  const produto = listaProdutosDespensa.find((p) => p.id === selectProduto.value);
  const qtd = parseFloat(inputQtd.value);

  if (!produto || isNaN(qtd) || qtd <= 0) {
    boxPreview.classList.add("oculto");
    return;
  }

  const resultado = calcularFracaoEmbalagem(produto, qtd, selectUnidade.value);
  boxPreview.classList.remove("oculto");

  if (!resultado.valido) {
    boxPreview.className = "caixa-preview-conversao preview-invalido";
    boxPreview.textContent = resultado.mensagemErro;
    return;
  }

  const saldoAtual = Number(produto.quantidadeAtual) || 0;
  const novoSaldo = Math.max(0, Number((saldoAtual - resultado.fracaoPacote).toFixed(4)));
  const avisoExcesso =
    resultado.fracaoPacote > saldoAtual
      ? " (Atenção: retirada maior que o saldo atual; o estoque ficará zerado)."
      : "";

  boxPreview.className = "caixa-preview-conversao preview-valido";
  boxPreview.innerHTML = `
    <strong>Cálculo automático:</strong> Esta retirada desconta <strong>${formatarNumero(resultado.fracaoPacote)}</strong> embalagem(ns).<br>
    <strong>Novo saldo previsto:</strong> ${formatarNumero(novoSaldo)} embalagem(ns)${avisoExcesso}
  `;
}

function configurarFormularioRetirada() {
  const selectProduto = document.getElementById("retirada-produto");
  const inputQtd = document.getElementById("retirada-quantidade");
  const selectUnidade = document.getElementById("retirada-unidade");
  const formRetirada = document.getElementById("form-retirada");

  preencherUnidadesRetirada();

  selectProduto.addEventListener("change", () => {
    atualizarDetalhesProdutoRetirada();
  });

  inputQtd.addEventListener("input", atualizarPreviewConversaoRetirada);
  selectUnidade.addEventListener("change", atualizarPreviewConversaoRetirada);

  formRetirada.addEventListener("submit", async (e) => {
    e.preventDefault();

    const produto = listaProdutosDespensa.find((p) => p.id === selectProduto.value);
    const qtd = parseFloat(inputQtd.value);
    const unidadeId = selectUnidade.value;

    if (!produto) return;

    const resultado = calcularFracaoEmbalagem(produto, qtd, unidadeId);
    if (!resultado.valido) {
      mostrarMensagemRetirada(resultado.mensagemErro, "erro");
      return;
    }

    const btnConfirmar = document.getElementById("btn-confirmar-retirada");
    btnConfirmar.disabled = true;

    const saldoAnterior = Number(produto.quantidadeAtual) || 0;
    const novoSaldo = Math.max(0, Number((saldoAnterior - resultado.fracaoPacote).toFixed(4)));
    const unidadeObj = MEDIDAS_FIXAS.unidadesRetiradaReceita.find((u) => u.id === unidadeId);
    const usuarioEmail = auth.currentUser ? auth.currentUser.email : "familiar";

    try {
      await updateDoc(doc(db, "despensa", produto.id), {
        quantidadeAtual: novoSaldo,
        atualizadoPor: usuarioEmail,
        atualizadoEm: serverTimestamp()
      });

      await addDoc(collection(db, "retiradas"), {
        produtoId: produto.id,
        produtoNome: produto.nome,
        grupo: produto.grupo,
        categoria: produto.categoria,
        quantidadeRetirada: qtd,
        unidadeRetirada: unidadeId,
        unidadeRetiradaNome: unidadeObj ? unidadeObj.nome : unidadeId,
        fracaoPacoteDescontada: Number(resultado.fracaoPacote.toFixed(4)),
        saldoAnterior: saldoAnterior,
        saldoNovo: novoSaldo,
        retiradoPor: usuarioEmail,
        dataRetirada: serverTimestamp()
      });

      mostrarMensagemRetirada(
        `Retirada registrada! "${produto.nome}" agora possui ${formatarNumero(novoSaldo)} embalagem(ns) em casa.`
      );

      formRetirada.reset();
      document.getElementById("grupo-campos-retirada").classList.add("oculto");
      document.getElementById("preview-conversao-retirada").classList.add("oculto");
    } catch (erro) {
      console.error("Erro ao registrar retirada:", erro);
      mostrarMensagemRetirada("Erro ao registrar retirada. Tente novamente.", "erro");
    } finally {
      btnConfirmar.disabled = false;
    }
  });
}

function iniciarEscutaHistoricoRetiradas() {
  if (cancelarEscutaRetiradas) cancelarEscutaRetiradas();

  const consultaRetiradas = query(
    collection(db, "retiradas"),
    orderBy("dataRetirada", "desc"),
    limit(15)
  );

  cancelarEscutaRetiradas = onSnapshot(
    consultaRetiradas,
    (snapshot) => {
      const container = document.getElementById("lista-historico-retiradas");
      if (!container) return;

      if (snapshot.empty) {
        container.innerHTML = `<p class="estado-vazio">Nenhuma retirada registrada ainda.</p>`;
        return;
      }

      container.innerHTML = snapshot.docs
        .map((docSnap) => {
          const item = docSnap.data();
          const dataFormatada = item.dataRetirada?.toDate
            ? item.dataRetirada.toDate().toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
              })
            : "Agora mesmo";

          return `
            <article class="card-historico-retirada">
              <div>
                <div class="historico-titulo">${item.produtoNome}</div>
                <div class="historico-meta">
                  Por ${item.retiradoPor} • ${dataFormatada} • Restou: ${formatarNumero(item.saldoNovo)} emb.
                </div>
              </div>
              <span class="pilula-baixa">
                -${formatarNumero(item.quantidadeRetirada)} ${item.unidadeRetirada}
              </span>
            </article>
          `;
        })
        .join("");
    },
    (erro) => {
      console.error("Erro ao carregar histórico de retiradas:", erro);
    }
  );
}

// =========================================================
// 5. LISTA DE COMPRAS INTERATIVA
// =========================================================
function itemJaEstaNaListaCompras(produtoId, nomeItem = "") {
  if (produtoId) {
    return listaCompras.some((item) => !item.comprado && item.produtoId === produtoId);
  }
  const nomeNorm = nomeItem.toLowerCase().trim();
  return listaCompras.some(
    (item) => !item.comprado && (item.nome || "").toLowerCase().trim() === nomeNorm
  );
}

async function adicionarItemNaListaCompras({
  produtoId = null,
  nome,
  quantidadeComprar = 1,
  detalheEmbalagem = "",
  observacao = "",
  origemReceita = ""
}) {
  const usuarioEmail = auth.currentUser ? auth.currentUser.email : "familiar";

  const existente = listaCompras.find(
    (item) =>
      !item.comprado &&
      ((produtoId && item.produtoId === produtoId) ||
        (!produtoId && (item.nome || "").toLowerCase().trim() === nome.toLowerCase().trim()))
  );

  if (existente) {
    const novaQtd = Math.max(Number(existente.quantidadeComprar) || 1, Math.ceil(quantidadeComprar));
    await updateDoc(doc(db, "lista_compras", existente.id), {
      quantidadeComprar: novaQtd,
      origemReceita: origemReceita || existente.origemReceita || ""
    });
    return { status: "atualizado", nome, quantidade: novaQtd };
  }

  await addDoc(collection(db, "lista_compras"), {
    produtoId: produtoId || null,
    nome: nome.trim(),
    quantidadeComprar: Math.max(1, Math.ceil(quantidadeComprar)),
    detalheEmbalagem: detalheEmbalagem || "",
    observacao: observacao.trim(),
    origemReceita: origemReceita || "",
    comprado: false,
    adicionadoPor: usuarioEmail,
    criadoEm: serverTimestamp()
  });

  return { status: "adicionado", nome, quantidade: Math.max(1, Math.ceil(quantidadeComprar)) };
}

function atualizarSelectProdutosCompra() {
  const select = document.getElementById("compra-produto-select");
  if (!select) return;

  if (listaProdutosDespensa.length === 0) {
    select.innerHTML = `<option value="">Nenhum produto cadastrado na despensa ainda</option>`;
    return;
  }

  select.innerHTML = listaProdutosDespensa
    .map(
      (p) =>
        `<option value="${p.id}">${p.nome} (${formatarNumero(p.tamanhoEmbalagem)}${p.unidadeEmbalagem}) — Em casa: ${formatarNumero(p.quantidadeAtual)}</option>`
    )
    .join("");
}

function abrirFormularioCompra() {
  atualizarSelectProdutosCompra();
  document.getElementById("form-compra").reset();
  document.getElementById("compra-origem").value = "despensa";
  document.getElementById("grupo-compra-produto-despensa").classList.remove("oculto");
  document.getElementById("grupo-compra-nome-avulso").classList.add("oculto");
  document.getElementById("painel-form-compra").classList.remove("oculto");
  document.getElementById("painel-form-compra").scrollIntoView({ behavior: "smooth", block: "start" });
}

function fecharFormularioCompra() {
  document.getElementById("painel-form-compra").classList.add("oculto");
  document.getElementById("form-compra").reset();
}

function renderizarListaCompras() {
  const container = document.getElementById("lista-itens-compras");
  const contadorPendentes = document.getElementById("contador-compras-pendentes");
  const contadorRiscados = document.getElementById("contador-compras-riscados");
  const btnFinalizar = document.getElementById("btn-finalizar-lista");
  const textoBtnFinalizar = document.getElementById("texto-btn-finalizar-lista");

  if (!container) return;

  const pendentes = listaCompras.filter((i) => !i.comprado);
  const riscados = listaCompras.filter((i) => i.comprado);

  contadorPendentes.textContent = `${pendentes.length} ${pendentes.length === 1 ? "pendente" : "pendentes"}`;
  contadorRiscados.textContent = `${riscados.length} no carrinho`;

  if (riscados.length > 0) {
    btnFinalizar.classList.remove("oculto");
    textoBtnFinalizar.textContent = `Finalizar Lista (${riscados.length} ${riscados.length === 1 ? "item" : "itens"})`;
  } else {
    btnFinalizar.classList.add("oculto");
  }

  const ordenados = [...pendentes, ...riscados];

  if (ordenados.length === 0) {
    container.innerHTML = `<p class="estado-vazio">Sua lista de compras está vazia! Adicione itens acima ou envie o que falta direto de uma receita.</p>`;
    return;
  }

  container.innerHTML = ordenados
    .map((item) => {
      const qtd = Number(item.quantidadeComprar) || 1;
      const detalheHtml = item.detalheEmbalagem ? `<span>${item.detalheEmbalagem}</span>` : "";
      const obsHtml = item.observacao ? `<span>• ${item.observacao}</span>` : "";
      const tagReceitaHtml = item.origemReceita
        ? `<span class="tag-origem-receita">Receita: ${item.origemReceita}</span>`
        : "";
      const tipoVinculoHtml = item.produtoId ? "" : `<span>• Avulso</span>`;

      return `
        <article class="card-compra-item ${item.comprado ? "item-riscado" : ""}" data-compra-id="${item.id}">
          <div class="area-toque-checkbox" data-acao-compra="toggle" data-id="${item.id}">
            <div class="checkbox-visual-compra">${ICONES.check}</div>
            <div class="compra-texto-bloco">
              <div class="compra-item-nome">${item.nome}</div>
              <div class="compra-item-meta">
                ${detalheHtml}
                ${obsHtml}
                ${tipoVinculoHtml}
                ${tagReceitaHtml}
              </div>
            </div>
          </div>

          <div class="controles-qtd-compra">
            <button type="button" class="btn-stepper-compra" data-acao-compra="diminuir" data-id="${item.id}" title="Diminuir quantidade">−</button>
            <span class="qtd-compra-badge">${qtd}</span>
            <button type="button" class="btn-stepper-compra" data-acao-compra="aumentar" data-id="${item.id}" title="Aumentar quantidade">+</button>
            <button type="button" class="btn-mini-acao excluir" data-acao-compra="excluir" data-id="${item.id}" title="Remover da lista">
              ${ICONES.lixeira}
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  container.querySelectorAll("[data-acao-compra]").forEach((el) => {
    el.addEventListener("click", async () => {
      const id = el.dataset.id;
      const acao = el.dataset.acaoCompra;
      const item = listaCompras.find((c) => c.id === id);
      if (!item) return;

      try {
        if (acao === "toggle") {
          await updateDoc(doc(db, "lista_compras", id), {
            comprado: !item.comprado
          });
        } else if (acao === "aumentar") {
          await updateDoc(doc(db, "lista_compras", id), {
            quantidadeComprar: (Number(item.quantidadeComprar) || 1) + 1
          });
        } else if (acao === "diminuir") {
          const atual = Number(item.quantidadeComprar) || 1;
          if (atual > 1) {
            await updateDoc(doc(db, "lista_compras", id), {
              quantidadeComprar: atual - 1
            });
          }
        } else if (acao === "excluir") {
          await deleteDoc(doc(db, "lista_compras", id));
        }
      } catch (erro) {
        console.error("Erro ao atualizar item da lista de compras:", erro);
        mostrarMensagemCompras("Erro ao atualizar item. Verifique sua conexão.", "erro");
      }
    });
  });
}

function configurarModuloCompras() {
  const selectOrigem = document.getElementById("compra-origem");
  const grupoDespensa = document.getElementById("grupo-compra-produto-despensa");
  const grupoAvulso = document.getElementById("grupo-compra-nome-avulso");

  selectOrigem.addEventListener("change", () => {
    if (selectOrigem.value === "despensa") {
      grupoDespensa.classList.remove("oculto");
      grupoAvulso.classList.add("oculto");
    } else {
      grupoDespensa.classList.add("oculto");
      grupoAvulso.classList.remove("oculto");
      document.getElementById("compra-nome-avulso").focus();
    }
  });

  document.getElementById("btn-abrir-form-compra").addEventListener("click", abrirFormularioCompra);
  document.getElementById("btn-fechar-form-compra").addEventListener("click", fecharFormularioCompra);
  document.getElementById("btn-cancelar-compra").addEventListener("click", fecharFormularioCompra);

  document.getElementById("form-compra").addEventListener("submit", async (e) => {
    e.preventDefault();

    const origem = selectOrigem.value;
    const qtd = parseInt(document.getElementById("compra-quantidade").value, 10) || 1;
    const observacao = document.getElementById("compra-observacao").value.trim();

    let dadosNovoItem = null;

    if (origem === "despensa") {
      const produtoId = document.getElementById("compra-produto-select").value;
      const produto = listaProdutosDespensa.find((p) => p.id === produtoId);
      if (!produto) {
        mostrarMensagemCompras("Selecione um produto da despensa ou mude para Item avulso.", "erro");
        return;
      }
      dadosNovoItem = {
        produtoId: produto.id,
        nome: produto.nome,
        quantidadeComprar: qtd,
        detalheEmbalagem: `emb. ${formatarNumero(produto.tamanhoEmbalagem)}${produto.unidadeEmbalagem}`,
        observacao
      };
    } else {
      const nomeAvulso = document.getElementById("compra-nome-avulso").value.trim();
      if (!nomeAvulso) {
        mostrarMensagemCompras("Digite o nome do item avulso.", "erro");
        return;
      }
      dadosNovoItem = {
        produtoId: null,
        nome: nomeAvulso,
        quantidadeComprar: qtd,
        detalheEmbalagem: "unid.",
        observacao
      };
    }

    const btnSalvar = document.getElementById("btn-salvar-compra");
    btnSalvar.disabled = true;

    try {
      const res = await adicionarItemNaListaCompras(dadosNovoItem);
      fecharFormularioCompra();
      mostrarMensagemCompras(
        res.status === "atualizado"
          ? `"${res.nome}" já estava na lista e teve a quantidade ajustada para ${res.quantidade}.`
          : `"${res.nome}" adicionado à Lista de Compras!`
      );
    } catch (erro) {
      console.error("Erro ao adicionar item na lista:", erro);
      mostrarMensagemCompras("Erro ao adicionar item na lista.", "erro");
    } finally {
      btnSalvar.disabled = false;
    }
  });

  document.getElementById("btn-finalizar-lista").addEventListener("click", async () => {
    const riscados = listaCompras.filter((i) => i.comprado);
    if (riscados.length === 0) return;

    const vinculados = riscados.filter((i) => i.produtoId);
    const resumoReposicao =
      vinculados.length > 0
        ? `\n\nSerão somados automaticamente ao estoque da despensa:\n` +
          vinculados.map((v) => `• +${v.quantidadeComprar} emb. de ${v.nome}`).join("\n")
        : "";

    const confirmou = window.confirm(
      `Finalizar compra de ${riscados.length} ${riscados.length === 1 ? "item marcado" : "itens marcados"}?${resumoReposicao}\n\nItens não marcados permanecerão na lista.`
    );

    if (!confirmou) return;

    const btnFinalizar = document.getElementById("btn-finalizar-lista");
    btnFinalizar.disabled = true;

    try {
      const batch = writeBatch(db);
      const usuarioEmail = auth.currentUser ? auth.currentUser.email : "familiar";

      const somaPorProduto = new Map();
      riscados.forEach((item) => {
        if (item.produtoId) {
          const atual = somaPorProduto.get(item.produtoId) || 0;
          somaPorProduto.set(item.produtoId, atual + (Number(item.quantidadeComprar) || 1));
        }
        batch.delete(doc(db, "lista_compras", item.id));
      });

      somaPorProduto.forEach((qtdComprada, produtoId) => {
        const produtoDespensa = listaProdutosDespensa.find((p) => p.id === produtoId);
        if (!produtoDespensa) return;

        const saldoAnterior = Number(produtoDespensa.quantidadeAtual) || 0;
        const novoSaldo = Number((saldoAnterior + qtdComprada).toFixed(4));

        batch.update(doc(db, "despensa", produtoId), {
          quantidadeAtual: novoSaldo,
          atualizadoPor: usuarioEmail,
          atualizadoEm: serverTimestamp()
        });
      });

      await batch.commit();
      mostrarMensagemCompras(
        `Compra finalizada! ${riscados.length} ${riscados.length === 1 ? "item concluído" : "itens concluídos"} e estoque da despensa atualizado.`
      );
    } catch (erro) {
      console.error("Erro ao finalizar lista de compras:", erro);
      mostrarMensagemCompras("Erro ao finalizar lista. Tente novamente.", "erro");
    } finally {
      btnFinalizar.disabled = false;
    }
  });
}

function iniciarEscutaListaCompras() {
  if (cancelarEscutaCompras) cancelarEscutaCompras();

  cancelarEscutaCompras = onSnapshot(
    collection(db, "lista_compras"),
    (snapshot) => {
      listaCompras = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      listaCompras.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

      renderizarListaCompras();
      renderizarTelaAlertas();
      if (receitaAbertaId) {
        renderizarDetalheReceita();
      }
    },
    (erro) => {
      console.error("Erro ao sincronizar lista de compras:", erro);
    }
  );
}

// =========================================================
// 6. TELA DE ALERTAS E NOTIFICAÇÕES NO CELULAR (FASE 8)
// =========================================================
async function enviarNotificacaoCelular(titulo, corpo) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }

  const opcoes = {
    body: corpo,
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='24' fill='%2378B159'/><path d='M25 46L50 27L75 46V72C75 76 72 79 68 79H32C28 79 25 76 25 72V46Z' fill='none' stroke='white' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/></svg>",
    vibrate: [200, 100, 200],
    tag: `despensa-alerta-${Date.now()}`
  };

  try {
    if ("serviceWorker" in navigator) {
      const registro = await navigator.serviceWorker.ready;
      if (registro && registro.showNotification) {
        await registro.showNotification(titulo, opcoes);
        return true;
      }
    }
    new Notification(titulo, opcoes);
    return true;
  } catch (erro) {
    console.warn("Não foi possível disparar notificação nativa:", erro);
    return false;
  }
}

function atualizarStatusPainelNotificacoes() {
  const badge = document.getElementById("status-notificacao-badge");
  const texto = document.getElementById("texto-status-notificacao");
  const btnAtivar = document.getElementById("btn-ativar-notificacoes");

  if (!badge || !texto || !btnAtivar) return;

  if (!("Notification" in window)) {
    badge.textContent = "Instale na Tela Inicial";
    badge.className = "tag-pastel-mini badge-laranja-suave";
    texto.textContent =
      "No iPhone/iPad, toque em Compartilhar → Adicionar à Tela de Início e abra o app pelo ícone para liberar as notificações.";
    btnAtivar.classList.add("oculto");
    return;
  }

  const permissao = Notification.permission;

  if (permissao === "granted") {
    badge.textContent = "✅ Ativadas neste celular";
    badge.className = "tag-pastel-mini badge-verde-suave";
    texto.textContent =
      "Tudo certo! Este aparelho receberá avisos sempre que algum produto atingir o estoque mínimo ou zerar.";
    btnAtivar.classList.add("oculto");
  } else if (permissao === "denied") {
    badge.textContent = "Bloqueadas no navegador";
    badge.className = "tag-pastel-mini badge-vermelho-suave";
    texto.textContent =
      "As notificações foram bloqueadas nas configurações do navegador. Libere as permissões do site no ícone de cadeado da barra de endereço.";
    btnAtivar.classList.add("oculto");
  } else {
    badge.textContent = "Aguardando ativação";
    badge.className = "tag-pastel-mini badge-rosa-mini";
    texto.textContent =
      "Toque no botão abaixo para autorizar alertas na barra de notificações deste celular.";
    btnAtivar.classList.remove("oculto");
  }
}

function verificarEDispararNovosAlertas(produtos) {
  let historicoNotificados = {};
  try {
    historicoNotificados = JSON.parse(localStorage.getItem(CHAVE_ALERTAS_NOTIFICADOS) || "{}");
  } catch {
    historicoNotificados = {};
  }

  const novosParaNotificar = [];

  produtos.forEach((p) => {
    const atual = Number(p.quantidadeAtual) || 0;
    const minimo = Number(p.estoqueMinimo) || 0;

    if (atual <= 0) {
      if (historicoNotificados[p.id] !== "zerado") {
        novosParaNotificar.push({ produto: p, nivel: "zerado" });
      }
      historicoNotificados[p.id] = "zerado";
    } else if (atual <= minimo) {
      if (!historicoNotificados[p.id]) {
        novosParaNotificar.push({ produto: p, nivel: "baixo" });
      }
      historicoNotificados[p.id] = "baixo";
    } else {
      delete historicoNotificados[p.id];
    }
  });

  try {
    localStorage.setItem(CHAVE_ALERTAS_NOTIFICADOS, JSON.stringify(historicoNotificados));
  } catch {
    // Ignora falha de armazenamento privado
  }

  // Na primeira carga ao abrir o app, apenas sincroniza o estado atual sem disparar spam
  if (primeiraCargaDespensa) {
    primeiraCargaDespensa = false;
    return;
  }

  if (novosParaNotificar.length === 0) return;

  if (novosParaNotificar.length === 1) {
    const item = novosParaNotificar[0];
    const titulo =
      item.nivel === "zerado"
        ? `🚨 Produto zerado: ${item.produto.nome}`
        : `⚠️ Estoque baixo: ${item.produto.nome}`;
    const corpo =
      item.nivel === "zerado"
        ? `Acabou na despensa! Adicione à Lista de Compras.`
        : `Restam ${formatarNumero(item.produto.quantidadeAtual)} emb. (mínimo: ${formatarNumero(item.produto.estoqueMinimo)}).`;
    enviarNotificacaoCelular(titulo, corpo);
  } else {
    const nomes = novosParaNotificar.map((n) => n.produto.nome).join(", ");
    enviarNotificacaoCelular(
      `⚠️ ${novosParaNotificar.length} produtos precisam de reposição`,
      `Itens em alerta: ${nomes}.`
    );
  }
}

function renderizarTelaAlertas() {
  const container = document.getElementById("lista-itens-alertas");
  const contZerados = document.getElementById("contador-alertas-zerados");
  const contAcabando = document.getElementById("contador-alertas-acabando");
  const btnEnviarTodos = document.getElementById("btn-enviar-todos-alertas-compras");

  if (!container) return;

  const zerados = listaProdutosDespensa.filter((p) => (Number(p.quantidadeAtual) || 0) <= 0);
  const acabando = listaProdutosDespensa.filter((p) => {
    const atual = Number(p.quantidadeAtual) || 0;
    const minimo = Number(p.estoqueMinimo) || 0;
    return atual > 0 && atual <= minimo;
  });

  contZerados.textContent = `${zerados.length} ${zerados.length === 1 ? "zerado" : "zerados"}`;
  contAcabando.textContent = `${acabando.length} acabando`;

  const todosAlertas = [...zerados, ...acabando];

  if (todosAlertas.length > 0) {
    btnEnviarTodos.classList.remove("oculto");
  } else {
    btnEnviarTodos.classList.add("oculto");
  }

  if (todosAlertas.length === 0) {
    container.innerHTML = `<p class="estado-vazio">🎉 Nenhum item em alerta! Todos os produtos estão acima do estoque mínimo.</p>`;
    return;
  }

  container.innerHTML = todosAlertas
    .map((produto) => {
      const status = obterStatusEstoque(produto);
      const jaNaLista = itemJaEstaNaListaCompras(produto.id, produto.nome);
      const tamFormatado = formatarNumero(produto.tamanhoEmbalagem);

      return `
        <article class="card-produto ${status.classeCard}">
          <div class="card-produto-info">
            <div class="card-produto-topo">
              <span class="card-produto-nome">${produto.nome}</span>
              ${status.seloHtml}
            </div>
            <div class="card-produto-detalhe">
              Em casa: <strong>${formatarNumero(produto.quantidadeAtual)}</strong> emb. • Mínimo: ${formatarNumero(produto.estoqueMinimo)} emb. (${tamFormatado}${produto.unidadeEmbalagem})
            </div>
          </div>

          <button
            type="button"
            class="btn-carrinho-azul-mini ${jaNaLista ? "ja-na-lista" : ""}"
            data-alerta-add-compra="${produto.id}"
            title="${jaNaLista ? "Já está na Lista de Compras" : "Enviar para Lista de Compras"}"
          >
            ${jaNaLista ? ICONES.check : ICONES.carrinho}
          </button>
        </article>
      `;
    })
    .join("");

  container.querySelectorAll("[data-alerta-add-compra]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const prod = listaProdutosDespensa.find((p) => p.id === btn.dataset.alertaAddCompra);
      if (!prod) return;

      const atual = Number(prod.quantidadeAtual) || 0;
      const minimo = Number(prod.estoqueMinimo) || 1;
      const qtdSugerida = Math.max(1, Math.ceil(minimo - atual) || 1);

      try {
        await adicionarItemNaListaCompras({
          produtoId: prod.id,
          nome: prod.nome,
          quantidadeComprar: qtdSugerida,
          detalheEmbalagem: `emb. ${formatarNumero(prod.tamanhoEmbalagem)}${prod.unidadeEmbalagem}`
        });
        mostrarMensagemAlertas(`"${prod.nome}" enviado para a Lista de Compras!`);
      } catch (erro) {
        console.error("Erro ao enviar alerta para compras:", erro);
        mostrarMensagemAlertas("Erro ao adicionar item na lista de compras.", "erro");
      }
    });
  });
}

function configurarModuloAlertas() {
  atualizarStatusPainelNotificacoes();

  document.getElementById("btn-ativar-notificacoes").addEventListener("click", async () => {
    if (!("Notification" in window)) return;

    try {
      const resultado = await Notification.requestPermission();
      atualizarStatusPainelNotificacoes();

      if (resultado === "granted") {
        mostrarMensagemAlertas("Notificações ativadas com sucesso neste celular!");
        await enviarNotificacaoCelular(
          "Minha Casa, Minha Despensa",
          "Notificações ativadas! Avisaremos quando algum item estiver acabando."
        );
      } else {
        mostrarMensagemAlertas("Permissão não concedida pelo navegador.", "erro");
      }
    } catch (erro) {
      console.error("Erro ao solicitar permissão de notificação:", erro);
    }
  });

  document.getElementById("btn-testar-notificacao").addEventListener("click", async () => {
    if (!("Notification" in window)) {
      mostrarMensagemAlertas(
        "Instale o app na Tela Inicial do celular primeiro para testar notificações.",
        "erro"
      );
      return;
    }

    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      atualizarStatusPainelNotificacoes();
      if (perm !== "granted") {
        mostrarMensagemAlertas("Ative a permissão de notificação primeiro.", "erro");
        return;
      }
    }

    const enviou = await enviarNotificacaoCelular(
      "🔔 Teste de Alerta da Despensa",
      "Perfeito! As notificações estão funcionando neste celular."
    );

    if (enviou) {
      mostrarMensagemAlertas("Notificação de teste enviada para a barra do seu aparelho!");
    } else {
      mostrarMensagemAlertas("Não foi possível exibir a notificação neste navegador.", "erro");
    }
  });

  document.getElementById("btn-enviar-todos-alertas-compras").addEventListener("click", async () => {
    const emAlerta = listaProdutosDespensa.filter(
      (p) => (Number(p.quantidadeAtual) || 0) <= (Number(p.estoqueMinimo) || 0)
    );
    if (emAlerta.length === 0) return;

    try {
      for (const prod of emAlerta) {
        const atual = Number(prod.quantidadeAtual) || 0;
        const minimo = Number(prod.estoqueMinimo) || 1;
        const qtdSugerida = Math.max(1, Math.ceil(minimo - atual) || 1);

        await adicionarItemNaListaCompras({
          produtoId: prod.id,
          nome: prod.nome,
          quantidadeComprar: qtdSugerida,
          detalheEmbalagem: `emb. ${formatarNumero(prod.tamanhoEmbalagem)}${prod.unidadeEmbalagem}`
        });
      }
      mostrarMensagemAlertas(
        `${emAlerta.length} ${emAlerta.length === 1 ? "item enviado" : "itens enviados"} para a Lista de Compras!`
      );
    } catch (erro) {
      console.error("Erro ao enviar alertas em lote:", erro);
      mostrarMensagemAlertas("Erro ao enviar itens para a Lista de Compras.", "erro");
    }
  });
}

// =========================================================
// 7. RECEITAS INTELIGENTES + BOTÕES DE CARRINHO AZUL
// =========================================================
function obterMedidasUniversaisReceita() {
  return MEDIDAS_FIXAS.unidadesRetiradaReceita.filter((u) => u.id !== "pacote");
}

function nomeAmigavelUnidade(unidadeId) {
  const encontrada = MEDIDAS_FIXAS.unidadesRetiradaReceita.find((u) => u.id === unidadeId);
  return encontrada ? encontrada.nome.split(" (")[0] : unidadeId;
}

function gerarHtmlOpcoesProdutosReceita() {
  if (listaProdutosDespensa.length === 0) {
    return `<option value="">Clique em "+ Novo Ingrediente" acima para cadastrar</option>`;
  }
  return listaProdutosDespensa
    .map((p) => `<option value="${p.id}">${p.nome} (${p.unidadeEmbalagem})</option>`)
    .join("");
}

function atualizarTodosSelectsIngredientesReceita() {
  const opcoesHtml = gerarHtmlOpcoesProdutosReceita();
  document.querySelectorAll("#lista-inputs-ingredientes .ing-select-produto").forEach((select) => {
    const valorAtual = select.value;
    select.innerHTML = opcoesHtml;
    if (valorAtual && listaProdutosDespensa.some((p) => p.id === valorAtual)) {
      select.value = valorAtual;
    }
  });
}

function prepararCamposMiniCadastroReceita() {
  const selectCat = document.getElementById("rec-novo-categoria");
  const selectUnid = document.getElementById("rec-novo-unidade");

  if (selectCat) {
    selectCat.innerHTML = (CATEGORIAS_FIXAS.Mantimentos || [])
      .map((cat) => `<option value="${cat}">${cat}</option>`)
      .join("");
  }

  if (selectUnid) {
    selectUnid.innerHTML = MEDIDAS_FIXAS.unidadesEmbalagem
      .map((u) => `<option value="${u.id}">${u.nome}</option>`)
      .join("");
  }
}

function abrirFecharMiniCadastroReceita(abrir) {
  const box = document.getElementById("box-novo-produto-receita");
  if (!box) return;

  if (abrir) {
    document.getElementById("rec-novo-nome").value = "";
    document.getElementById("rec-novo-quantidade").value = "0";
    document.getElementById("rec-novo-tamanho").value = "";
    document.getElementById("rec-novo-minimo").value = "1";
    document.getElementById("rec-novo-xicaras").value = "";
    box.classList.remove("oculto");
    document.getElementById("rec-novo-nome").focus();
  } else {
    box.classList.add("oculto");
  }
}

function avaliarDisponibilidadeReceita(receita) {
  const ingredientesAvaliados = (receita.ingredientes || []).map((ing) => {
    const produto = listaProdutosDespensa.find((p) => p.id === ing.produtoId);
    const nomeExibicao = produto ? produto.nome : ing.produtoNome || "Item removido";
    const unidadeLabel = nomeAmigavelUnidade(ing.unidadeId);

    if (!produto) {
      return {
        ...ing,
        nomeExibicao,
        unidadeLabel,
        disponivel: false,
        pacotesSugeridosCompra: 1,
        motivoFalta: `${nomeExibicao} (${formatarNumero(ing.quantidade)} ${unidadeLabel}) — não cadastrado na despensa`
      };
    }

    const saldoAtual = Number(produto.quantidadeAtual) || 0;
    const conversao = calcularFracaoEmbalagem(produto, ing.quantidade, ing.unidadeId);

    if (!conversao.valido) {
      return {
        ...ing,
        produtoRef: produto,
        nomeExibicao,
        unidadeLabel,
        disponivel: false,
        pacotesSugeridosCompra: 1,
        motivoFalta: `${nomeExibicao} — medida incompatível com o cadastro (${produto.unidadeEmbalagem})`
      };
    }

    const temSuficiente = saldoAtual + 0.0005 >= conversao.fracaoPacote;

    if (!temSuficiente) {
      const fracaoFaltante = Math.max(0.01, conversao.fracaoPacote - saldoAtual);
      const pacotesSugeridosCompra = Math.max(1, Math.ceil(fracaoFaltante));
      const textoSaldo =
        saldoAtual <= 0
          ? "zerado na despensa"
          : `você tem ${formatarNumero(saldoAtual)} emb., mas precisa de ${formatarNumero(conversao.fracaoPacote)} emb.`;

      return {
        ...ing,
        produtoRef: produto,
        nomeExibicao,
        unidadeLabel,
        disponivel: false,
        pacotesSugeridosCompra,
        motivoFalta: `${nomeExibicao} (${formatarNumero(ing.quantidade)} ${unidadeLabel}) — ${textoSaldo}`
      };
    }

    return {
      ...ing,
      produtoRef: produto,
      nomeExibicao,
      unidadeLabel,
      disponivel: true,
      fracaoNecessaria: conversao.fracaoPacote
    };
  });

  const faltantes = ingredientesAvaliados.filter((i) => !i.disponivel);

  return {
    tudoDisponivel: faltantes.length === 0 && ingredientesAvaliados.length > 0,
    ingredientesAvaliados,
    faltantes
  };
}

function adicionarLinhaIngredienteForm(dadosIngrediente = null) {
  const container = document.getElementById("lista-inputs-ingredientes");
  if (!container) return;

  const opcoesProdutos = gerarHtmlOpcoesProdutosReceita();
  const opcoesMedidas = obterMedidasUniversaisReceita()
    .map((m) => `<option value="${m.id}">${m.nome}</option>`)
    .join("");

  const linha = document.createElement("div");
  linha.className = "linha-ingrediente-input";
  linha.innerHTML = `
    <select class="ing-select-produto" required>${opcoesProdutos}</select>
    <input type="number" class="ing-input-qtd" step="0.01" min="0.01" placeholder="Qtd" required>
    <select class="ing-select-unidade" required>${opcoesMedidas}</select>
    <button type="button" class="btn-remover-linha" title="Remover ingrediente">✕</button>
  `;

  if (dadosIngrediente) {
    if (dadosIngrediente.produtoId) {
      linha.querySelector(".ing-select-produto").value = dadosIngrediente.produtoId;
    }
    if (dadosIngrediente.quantidade) {
      linha.querySelector(".ing-input-qtd").value = dadosIngrediente.quantidade;
    }
    if (dadosIngrediente.unidadeId) {
      linha.querySelector(".ing-select-unidade").value = dadosIngrediente.unidadeId;
    }
  }

  linha.querySelector(".btn-remover-linha").addEventListener("click", () => {
    if (container.children.length > 1) {
      linha.remove();
    } else {
      mostrarMensagemReceitas("A receita precisa ter pelo menos 1 ingrediente.", "erro");
    }
  });

  container.appendChild(linha);
  return linha;
}

function abrirFormularioReceita(receitaParaEditar = null) {
  const painelForm = document.getElementById("painel-form-receita");
  const painelDetalhe = document.getElementById("painel-detalhe-receita");
  const visaoLista = document.getElementById("visao-lista-receitas");
  const containerInputs = document.getElementById("lista-inputs-ingredientes");

  painelDetalhe.classList.add("oculto");
  visaoLista.classList.add("oculto");
  abrirFecharMiniCadastroReceita(false);
  receitaAbertaId = null;

  containerInputs.innerHTML = "";

  if (receitaParaEditar) {
    document.getElementById("titulo-form-receita").textContent = `Editar Receita: ${receitaParaEditar.nome}`;
    document.getElementById("receita-id-edicao").value = receitaParaEditar.id;
    document.getElementById("rec-nome").value = receitaParaEditar.nome;
    document.getElementById("rec-tipo").value = receitaParaEditar.tipoRefeicao;
    document.getElementById("rec-tempo").value = receitaParaEditar.tempoPreparo;
    document.getElementById("rec-modo").value = receitaParaEditar.modoPreparo;

    (receitaParaEditar.ingredientes || []).forEach((ing) => {
      adicionarLinhaIngredienteForm(ing);
    });
  } else {
    document.getElementById("titulo-form-receita").textContent = "Nova Receita";
    document.getElementById("receita-id-edicao").value = "";
    document.getElementById("form-receita").reset();
    adicionarLinhaIngredienteForm(null);
  }

  painelForm.classList.remove("oculto");
  painelForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fecharFormularioReceita() {
  document.getElementById("painel-form-receita").classList.add("oculto");
  abrirFecharMiniCadastroReceita(false);
  document.getElementById("visao-lista-receitas").classList.remove("oculto");
  document.getElementById("form-receita").reset();
  document.getElementById("receita-id-edicao").value = "";
}

function abrirDetalheReceita(receitaId) {
  receitaAbertaId = receitaId;
  document.getElementById("painel-form-receita").classList.add("oculto");
  document.getElementById("visao-lista-receitas").classList.add("oculto");
  document.getElementById("painel-detalhe-receita").classList.remove("oculto");
  renderizarDetalheReceita();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function fecharDetalheReceita() {
  receitaAbertaId = null;
  document.getElementById("painel-detalhe-receita").classList.add("oculto");
  document.getElementById("visao-lista-receitas").classList.remove("oculto");
}

function renderizarDetalheReceita() {
  if (!receitaAbertaId) return;

  const receita = listaReceitas.find((r) => r.id === receitaAbertaId);
  if (!receita) {
    fecharDetalheReceita();
    return;
  }

  const avaliacao = avaliarDisponibilidadeReceita(receita);
  const boxSelo = document.getElementById("selo-disponibilidade-receita");
  const boxAcaoConcluir = document.getElementById("box-acao-concluir-receita");

  if (avaliacao.tudoDisponivel) {
    boxSelo.className = "selo-receita-status selo-receita-verde";
    boxSelo.textContent = "✅ Você possui todos os ingredientes na despensa!";
    boxAcaoConcluir.classList.remove("oculto");
  } else {
    const itensFaltantesHtml = avaliacao.faltantes
      .map((f) => `<li>${f.motivoFalta}</li>`)
      .join("");

    boxSelo.className = "selo-receita-status selo-receita-vermelho";
    boxSelo.innerHTML = `
      <strong>❌ Faltam ingredientes para esta receita</strong>
      <ul class="lista-faltantes-selo">${itensFaltantesHtml}</ul>
      <button type="button" id="btn-enviar-todos-faltantes-lista" class="btn-enviar-todos-faltantes">
        ${ICONES.carrinho}
        <span>Enviar Todos os Faltantes para a Lista de Compras</span>
      </button>
    `;
    boxAcaoConcluir.classList.add("oculto");

    document.getElementById("btn-enviar-todos-faltantes-lista").addEventListener("click", async () => {
      try {
        for (const faltante of avaliacao.faltantes) {
          const prod = faltante.produtoRef;
          await adicionarItemNaListaCompras({
            produtoId: prod ? prod.id : null,
            nome: faltante.nomeExibicao,
            quantidadeComprar: faltante.pacotesSugeridosCompra || 1,
            detalheEmbalagem: prod
              ? `emb. ${formatarNumero(prod.tamanhoEmbalagem)}${prod.unidadeEmbalagem}`
              : `${formatarNumero(faltante.quantidade)} ${faltante.unidadeLabel}`,
            origemReceita: receita.nome
          });
        }
        mostrarMensagemReceitas(
          `${avaliacao.faltantes.length} ${avaliacao.faltantes.length === 1 ? "item enviado" : "itens enviados"} para a Lista de Compras!`
        );
      } catch (erro) {
        console.error("Erro ao enviar faltantes:", erro);
        mostrarMensagemReceitas("Erro ao enviar itens para a Lista de Compras.", "erro");
      }
    });
  }

  document.getElementById("detalhe-rec-tipo").textContent = receita.tipoRefeicao;
  document.getElementById("detalhe-rec-tempo").innerHTML = `${ICONES.relogio} ${receita.tempoPreparo}`;
  document.getElementById("detalhe-rec-nome").textContent = receita.nome;
  document.getElementById("detalhe-rec-modo").textContent = receita.modoPreparo;

  const containerIng = document.getElementById("detalhe-rec-ingredientes");
  containerIng.innerHTML = avaliacao.ingredientesAvaliados
    .map((ing, idx) => {
      const jaNaLista = !ing.disponivel && itemJaEstaNaListaCompras(ing.produtoId, ing.nomeExibicao);
      const botaoCarrinhoHtml = !ing.disponivel
        ? `
          <button
            type="button"
            class="btn-carrinho-azul-mini ${jaNaLista ? "ja-na-lista" : ""}"
            data-add-compra-ing-idx="${idx}"
            title="${jaNaLista ? "Já está na Lista de Compras (clique para atualizar)" : "Adicionar à Lista de Compras"}"
          >
            ${jaNaLista ? ICONES.check : ICONES.carrinho}
          </button>
        `
        : "";

      return `
        <div class="item-ingrediente-detalhe ${ing.disponivel ? "" : "ing-faltando"}">
          <div>
            <div class="ing-nome-qtd">
              ${ing.disponivel ? "✅" : "❌"} ${formatarNumero(ing.quantidade)} ${ing.unidadeLabel} de ${ing.nomeExibicao}
            </div>
            <div class="ing-status-subtexto">
              ${ing.disponivel ? "Disponível na despensa" : jaNaLista ? "🛒 Já está na Lista de Compras" : ing.motivoFalta}
            </div>
          </div>
          ${botaoCarrinhoHtml}
        </div>
      `;
    })
    .join("");

  containerIng.querySelectorAll("[data-add-compra-ing-idx]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.dataset.addCompraIngIdx);
      const ing = avaliacao.ingredientesAvaliados[idx];
      if (!ing) return;

      const prod = ing.produtoRef;
      try {
        const res = await adicionarItemNaListaCompras({
          produtoId: prod ? prod.id : null,
          nome: ing.nomeExibicao,
          quantidadeComprar: ing.pacotesSugeridosCompra || 1,
          detalheEmbalagem: prod
            ? `emb. ${formatarNumero(prod.tamanhoEmbalagem)}${prod.unidadeEmbalagem}`
            : `${formatarNumero(ing.quantidade)} ${ing.unidadeLabel}`,
          origemReceita: receita.nome
        });
        mostrarMensagemReceitas(
          res.status === "atualizado"
            ? `"${ing.nomeExibicao}" já está na Lista de Compras!`
            : `"${ing.nomeExibicao}" enviado para a Lista de Compras!`
        );
      } catch (erro) {
        console.error("Erro ao adicionar ingrediente na lista:", erro);
        mostrarMensagemReceitas("Erro ao adicionar à Lista de Compras.", "erro");
      }
    });
  });
}

function renderizarListaReceitas() {
  const container = document.getElementById("lista-cards-receitas");
  if (!container) return;

  const termoBusca = (document.getElementById("busca-receitas")?.value || "").toLowerCase().trim();

  const filtradas = listaReceitas.filter(
    (r) =>
      r.nome.toLowerCase().includes(termoBusca) ||
      (r.tipoRefeicao || "").toLowerCase().includes(termoBusca)
  );

  if (filtradas.length === 0) {
    container.innerHTML = `<p class="estado-vazio">Nenhuma receita encontrada. Clique em "+ Nova Receita" acima para cadastrar a primeira!</p>`;
    return;
  }

  container.innerHTML = filtradas
    .map((receita) => {
      const avaliacao = avaliarDisponibilidadeReceita(receita);
      const qtdIng = (receita.ingredientes || []).length;
      const seloMini = avaliacao.tudoDisponivel
        ? `<span class="selo-mini-disponivel selo-mini-verde">✅ Tem tudo</span>`
        : `<span class="selo-mini-disponivel selo-mini-vermelho">❌ Falta ${avaliacao.faltantes.length}</span>`;

      return `
        <article class="card-receita-item" data-receita-id="${receita.id}">
          <div>
            <div class="card-receita-titulo">${receita.nome}</div>
            <div class="card-receita-meta">
              <span class="tag-pastel-mini badge-lavanda-mini">${receita.tipoRefeicao}</span>
              <span>⏱ ${receita.tempoPreparo}</span>
              <span>• ${qtdIng} ${qtdIng === 1 ? "ingrediente" : "ingredientes"}</span>
            </div>
          </div>
          ${seloMini}
        </article>
      `;
    })
    .join("");

  container.querySelectorAll("[data-receita-id]").forEach((card) => {
    card.addEventListener("click", () => {
      abrirDetalheReceita(card.dataset.receitaId);
    });
  });
}

function configurarModuloReceitas() {
  prepararCamposMiniCadastroReceita();

  document.getElementById("btn-abrir-form-receita").addEventListener("click", () => {
    abrirFormularioReceita(null);
  });

  document.getElementById("btn-fechar-form-receita").addEventListener("click", fecharFormularioReceita);
  document.getElementById("btn-cancelar-receita").addEventListener("click", fecharFormularioReceita);
  document.getElementById("btn-voltar-receitas").addEventListener("click", fecharDetalheReceita);

  document.getElementById("btn-adicionar-ingrediente-form").addEventListener("click", () => {
    adicionarLinhaIngredienteForm(null);
  });

  document.getElementById("btn-concluir-receita").addEventListener("click", async () => {
    const receita = listaReceitas.find((r) => r.id === receitaAbertaId);
    if (!receita) return;

    const avaliacao = avaliarDisponibilidadeReceita(receita);
    if (!avaliacao.tudoDisponivel) {
      mostrarMensagemReceitas("Ops! Algum ingrediente ficou sem saldo suficiente na despensa.", "erro");
      renderizarDetalheReceita();
      return;
    }

    const totalItens = avaliacao.ingredientesAvaliados.length;
    const confirmou = window.confirm(
      `Confirmar preparo de "${receita.nome}"?\n\nTodos os ${totalItens} ingredientes serão descontados automaticamente da despensa.`
    );

    if (!confirmou) return;

    const btnConcluir = document.getElementById("btn-concluir-receita");
    btnConcluir.disabled = true;

    try {
      const batch = writeBatch(db);
      const usuarioEmail = auth.currentUser ? auth.currentUser.email : "familiar";

      const fracaoTotalPorProduto = new Map();
      avaliacao.ingredientesAvaliados.forEach((ing) => {
        const acumulado = fracaoTotalPorProduto.get(ing.produtoId) || 0;
        fracaoTotalPorProduto.set(ing.produtoId, acumulado + ing.fracaoNecessaria);
      });

      const novoSaldoPorProduto = new Map();
      fracaoTotalPorProduto.forEach((fracaoDescontar, produtoId) => {
        const produto = listaProdutosDespensa.find((p) => p.id === produtoId);
        if (!produto) return;

        const saldoAtual = Number(produto.quantidadeAtual) || 0;
        const novoSaldo = Math.max(0, Number((saldoAtual - fracaoDescontar).toFixed(4)));
        novoSaldoPorProduto.set(produtoId, { saldoAtual, novoSaldo });

        batch.update(doc(db, "despensa", produtoId), {
          quantidadeAtual: novoSaldo,
          atualizadoPor: usuarioEmail,
          atualizadoEm: serverTimestamp()
        });
      });

      avaliacao.ingredientesAvaliados.forEach((ing) => {
        const produto = ing.produtoRef;
        const saldos = novoSaldoPorProduto.get(ing.produtoId) || { saldoAtual: 0, novoSaldo: 0 };
        const unidadeObj = MEDIDAS_FIXAS.unidadesRetiradaReceita.find((u) => u.id === ing.unidadeId);

        const novaRetiradaRef = doc(collection(db, "retiradas"));
        batch.set(novaRetiradaRef, {
          produtoId: ing.produtoId,
          produtoNome: `${ing.nomeExibicao} (Receita: ${receita.nome})`,
          grupo: produto ? produto.grupo : "Mantimentos",
          categoria: produto ? produto.categoria : "Outros",
          quantidadeRetirada: ing.quantidade,
          unidadeRetirada: ing.unidadeId,
          unidadeRetiradaNome: unidadeObj ? unidadeObj.nome : ing.unidadeId,
          fracaoPacoteDescontada: Number(ing.fracaoNecessaria.toFixed(4)),
          saldoAnterior: saldos.saldoAtual,
          saldoNovo: saldos.novoSaldo,
          retiradoPor: usuarioEmail,
          dataRetirada: serverTimestamp()
        });
      });

      await batch.commit();

      mostrarMensagemReceitas(
        `Receita "${receita.nome}" concluída! Todos os ingredientes foram descontados da despensa.`
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (erro) {
      console.error("Erro ao descontar ingredientes da receita:", erro);
      mostrarMensagemReceitas("Erro ao descontar ingredientes. Tente novamente.", "erro");
    } finally {
      btnConcluir.disabled = false;
    }
  });

  document.getElementById("btn-toggle-novo-produto-receita").addEventListener("click", () => {
    const box = document.getElementById("box-novo-produto-receita");
    abrirFecharMiniCadastroReceita(box.classList.contains("oculto"));
  });

  document.getElementById("btn-fechar-mini-cadastro").addEventListener("click", () => {
    abrirFecharMiniCadastroReceita(false);
  });

  document.getElementById("btn-cancelar-mini-cadastro").addEventListener("click", () => {
    abrirFecharMiniCadastroReceita(false);
  });

  document.getElementById("btn-salvar-mini-cadastro").addEventListener("click", async () => {
    const nome = document.getElementById("rec-novo-nome").value.trim();
    const categoria = document.getElementById("rec-novo-categoria").value;
    const quantidadeAtual = parseFloat(document.getElementById("rec-novo-quantidade").value);
    const tamanhoEmbalagem = parseFloat(document.getElementById("rec-novo-tamanho").value);
    const unidadeEmbalagem = document.getElementById("rec-novo-unidade").value;
    const estoqueMinimo = parseFloat(document.getElementById("rec-novo-minimo").value);
    const xicarasVal = parseFloat(document.getElementById("rec-novo-xicaras").value);

    if (!nome) {
      mostrarMensagemReceitas("Digite o nome do novo ingrediente.", "erro");
      document.getElementById("rec-novo-nome").focus();
      return;
    }

    if (isNaN(tamanhoEmbalagem) || tamanhoEmbalagem <= 0) {
      mostrarMensagemReceitas("Informe o tamanho do pacote fechado (ex: 500 ou 1).", "erro");
      document.getElementById("rec-novo-tamanho").focus();
      return;
    }

    const btnSalvarMini = document.getElementById("btn-salvar-mini-cadastro");
    btnSalvarMini.disabled = true;
    btnSalvarMini.textContent = "Salvando...";

    const usaXicaras = !isNaN(xicarasVal) && xicarasVal > 0;
    const dadosNovoProduto = {
      grupo: "Mantimentos",
      categoria,
      nome,
      tamanhoEmbalagem,
      unidadeEmbalagem,
      quantidadeAtual: isNaN(quantidadeAtual) || quantidadeAtual < 0 ? 0 : quantidadeAtual,
      estoqueMinimo: isNaN(estoqueMinimo) || estoqueMinimo < 0 ? 1 : estoqueMinimo,
      usaRendimentoXicaras: usaXicaras,
      xicarasPorEmbalagem: usaXicaras ? xicarasVal : null,
      atualizadoPor: auth.currentUser ? auth.currentUser.email : "familiar",
      atualizadoEm: serverTimestamp()
    };

    try {
      const docCriado = await addDoc(collection(db, "despensa"), dadosNovoProduto);

      if (!listaProdutosDespensa.some((p) => p.id === docCriado.id)) {
        listaProdutosDespensa.push({ id: docCriado.id, ...dadosNovoProduto });
        listaProdutosDespensa.sort((a, b) => a.nome.localeCompare(b.nome));
      }

      atualizarTodosSelectsIngredientesReceita();

      const linhas = Array.from(
        document.querySelectorAll("#lista-inputs-ingredientes .linha-ingrediente-input")
      );
      const linhaVazia = linhas.find((l) => !l.querySelector(".ing-input-qtd").value);

      if (linhaVazia) {
        linhaVazia.querySelector(".ing-select-produto").value = docCriado.id;
        linhaVazia.querySelector(".ing-input-qtd").focus();
      } else {
        const novaLinha = adicionarLinhaIngredienteForm({ produtoId: docCriado.id });
        novaLinha.querySelector(".ing-input-qtd").focus();
      }

      abrirFecharMiniCadastroReceita(false);
      mostrarMensagemReceitas(`"${nome}" cadastrado na despensa e selecionado na receita!`);
    } catch (erro) {
      console.error("Erro ao cadastrar ingrediente rápido:", erro);
      mostrarMensagemReceitas("Erro ao cadastrar ingrediente. Tente novamente.", "erro");
    } finally {
      btnSalvarMini.disabled = false;
      btnSalvarMini.textContent = "Salvar e Usar na Receita";
    }
  });

  document.getElementById("busca-receitas").addEventListener("input", renderizarListaReceitas);

  document.getElementById("btn-editar-receita-aberta").addEventListener("click", () => {
    const receita = listaReceitas.find((r) => r.id === receitaAbertaId);
    if (receita) abrirFormularioReceita(receita);
  });

  document.getElementById("btn-excluir-receita-aberta").addEventListener("click", async () => {
    const receita = listaReceitas.find((r) => r.id === receitaAbertaId);
    if (!receita) return;

    const confirmou = window.confirm(`Deseja realmente excluir a receita "${receita.nome}"?`);
    if (confirmou) {
      try {
        await deleteDoc(doc(db, "receitas", receita.id));
        fecharDetalheReceita();
        mostrarMensagemReceitas(`Receita "${receita.nome}" excluída.`);
      } catch (erro) {
        console.error("Erro ao excluir receita:", erro);
        mostrarMensagemReceitas("Não foi possível excluir a receita.", "erro");
      }
    }
  });

  document.getElementById("form-receita").addEventListener("submit", async (e) => {
    e.preventDefault();

    const linhas = document.querySelectorAll("#lista-inputs-ingredientes .linha-ingrediente-input");
    const ingredientes = [];

    linhas.forEach((linha) => {
      const produtoId = linha.querySelector(".ing-select-produto").value;
      const quantidade = parseFloat(linha.querySelector(".ing-input-qtd").value);
      const unidadeId = linha.querySelector(".ing-select-unidade").value;
      const prodObj = listaProdutosDespensa.find((p) => p.id === produtoId);

      if (produtoId && !isNaN(quantidade) && quantidade > 0) {
        ingredientes.push({
          produtoId,
          produtoNome: prodObj ? prodObj.nome : "Produto",
          quantidade,
          unidadeId
        });
      }
    });

    if (ingredientes.length === 0) {
      mostrarMensagemReceitas("Adicione pelo menos um ingrediente válido.", "erro");
      return;
    }

    const btnSalvar = document.getElementById("btn-salvar-receita");
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    const idEdicao = document.getElementById("receita-id-edicao").value;
    const dadosReceita = {
      nome: document.getElementById("rec-nome").value.trim(),
      tipoRefeicao: document.getElementById("rec-tipo").value,
      tempoPreparo: document.getElementById("rec-tempo").value.trim(),
      ingredientes,
      modoPreparo: document.getElementById("rec-modo").value.trim(),
      atualizadoPor: auth.currentUser ? auth.currentUser.email : "familiar",
      atualizadoEm: serverTimestamp()
    };

    try {
      if (idEdicao) {
        await updateDoc(doc(db, "receitas", idEdicao), dadosReceita);
        mostrarMensagemReceitas(`Receita "${dadosReceita.nome}" atualizada!`);
      } else {
        await addDoc(collection(db, "receitas"), dadosReceita);
        mostrarMensagemReceitas(`Receita "${dadosReceita.nome}" cadastrada!`);
      }
      fecharFormularioReceita();
    } catch (erro) {
      console.error("Erro ao salvar receita:", erro);
      mostrarMensagemReceitas("Erro ao salvar receita. Verifique sua conexão.", "erro");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar Receita";
    }
  });
}

function iniciarEscutaReceitas() {
  if (cancelarEscutaReceitas) cancelarEscutaReceitas();

  const consultaReceitas = query(collection(db, "receitas"), orderBy("nome", "asc"));

  cancelarEscutaReceitas = onSnapshot(
    consultaReceitas,
    (snapshot) => {
      listaReceitas = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      renderizarListaReceitas();
      if (receitaAbertaId) {
        renderizarDetalheReceita();
      }
    },
    (erro) => {
      console.error("Erro ao sincronizar receitas:", erro);
    }
  );
}

// =========================================================
// 8. RENDERIZAÇÃO EM TEMPO REAL (TELA INICIAL E DESPENSA)
// =========================================================
function obterStatusEstoque(produto) {
  const atual = Number(produto.quantidadeAtual) || 0;
  const minimo = Number(produto.estoqueMinimo) || 0;

  if (atual <= 0) {
    return {
      classeCard: "status-zerado",
      seloHtml: `<span class="tag-alerta-inline tag-alerta-vermelho">${ICONES.alertaTriangulo} Zerado</span>`
    };
  }
  if (atual <= minimo) {
    return {
      classeCard: "status-baixo",
      seloHtml: `<span class="tag-alerta-inline tag-alerta-laranja">${ICONES.alertaTriangulo} Acabando</span>`
    };
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

  primeiraCargaDespensa = true;
  const consultaDespensa = query(collection(db, "despensa"), orderBy("nome", "asc"));

  cancelarEscutaDespensa = onSnapshot(
    consultaDespensa,
    (snapshot) => {
      listaProdutosDespensa = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data()
      }));

      verificarEDispararNovosAlertas(listaProdutosDespensa);
      renderizarResumoVivoInicio();
      renderizarListaGerenciarDespensa();
      atualizarListaProdutosRetirada();
      atualizarSelectProdutosCompra();
      renderizarTelaAlertas();
      atualizarTodosSelectsIngredientesReceita();
      renderizarListaReceitas();
      if (receitaAbertaId) {
        renderizarDetalheReceita();
      }
    },
    (erro) => {
      console.error("Erro na sincronização em tempo real:", erro);
    }
  );
}

// =========================================================
// 9. AUTENTICAÇÃO E VERIFICAÇÃO DE ACESSO DA FAMÍLIA
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
    if (cancelarEscutaRetiradas) {
      cancelarEscutaRetiradas();
      cancelarEscutaRetiradas = null;
    }
    if (cancelarEscutaReceitas) {
      cancelarEscutaReceitas();
      cancelarEscutaReceitas = null;
    }
    if (cancelarEscutaCompras) {
      cancelarEscutaCompras();
      cancelarEscutaCompras = null;
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

    iniciarEscutaTempoRealDespensa();
    iniciarEscutaHistoricoRetiradas();
    iniciarEscutaReceitas();
    iniciarEscutaListaCompras();
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
  configurarFormularioRetirada();
  configurarModuloCompras();
  configurarModuloAlertas();
  configurarModuloReceitas();

  document.querySelectorAll(".nav-item").forEach((botao) => {
    botao.addEventListener("click", () => navegarPara(botao.dataset.tela));
  });

  document.querySelectorAll("[data-ir-para]").forEach((botao) => {
    botao.addEventListener("click", () => navegarPara(botao.dataset.irPara));
  });

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