// =========================================================
// MINHA CASA, MINHA DESPENSA - LÓGICA PRINCIPAL (FASE 6)
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
import { calcularFracaoEmbalagem } from "./conversor-medidas.js";

// Estado global sincronizado em tempo real
let listaProdutosDespensa = [];
let listaReceitas = [];
let receitaAbertaId = null;

let cancelarEscutaDespensa = null;
let cancelarEscutaRetiradas = null;
let cancelarEscutaReceitas = null;
let filtroGrupoAtual = "Todos";

const telaLogin = document.getElementById("tela-login");
const appShell = document.getElementById("app-shell");
const loginMensagem = document.getElementById("login-mensagem");
const usuarioLogadoEmail = document.getElementById("usuario-logado-email");

// Formata números decimais de forma limpa (ex: 1.50 -> 1,5 | 2.00 -> 2)
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
// 5. RECEITAS INTELIGENTES COM VERIFICAÇÃO DE ESTOQUE (FASE 6)
// =========================================================
function obterMedidasUniversaisReceita() {
  // Retorna as 8 medidas universais (xícara, colher de sopa, colher de chá, g, kg, ml, L, unidade)
  return MEDIDAS_FIXAS.unidadesRetiradaReceita.filter((u) => u.id !== "pacote");
}

function nomeAmigavelUnidade(unidadeId) {
  const encontrada = MEDIDAS_FIXAS.unidadesRetiradaReceita.find((u) => u.id === unidadeId);
  return encontrada ? encontrada.nome.split(" (")[0] : unidadeId;
}

// Verifica em tempo real cada ingrediente da receita contra a despensa atual
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
        motivoFalta: `${nomeExibicao} (${formatarNumero(ing.quantidade)} ${unidadeLabel}) — não cadastrado na despensa`
      };
    }

    const saldoAtual = Number(produto.quantidadeAtual) || 0;
    const conversao = calcularFracaoEmbalagem(produto, ing.quantidade, ing.unidadeId);

    if (!conversao.valido) {
      return {
        ...ing,
        nomeExibicao,
        unidadeLabel,
        disponivel: false,
        motivoFalta: `${nomeExibicao} — medida incompatível com o cadastro (${produto.unidadeEmbalagem})`
      };
    }

    // Margem mínima de 0.0005 para evitar falhas de arredondamento decimal (ex: 1/6 * 6)
    const temSuficiente = saldoAtual + 0.0005 >= conversao.fracaoPacote;

    if (!temSuficiente) {
      const textoSaldo =
        saldoAtual <= 0
          ? "zerado na despensa"
          : `você tem ${formatarNumero(saldoAtual)} emb., mas precisa de ${formatarNumero(conversao.fracaoPacote)} emb.`;

      return {
        ...ing,
        nomeExibicao,
        unidadeLabel,
        disponivel: false,
        motivoFalta: `${nomeExibicao} (${formatarNumero(ing.quantidade)} ${unidadeLabel}) — ${textoSaldo}`
      };
    }

    return {
      ...ing,
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

  const opcoesProdutos =
    listaProdutosDespensa.length > 0
      ? listaProdutosDespensa
          .map((p) => `<option value="${p.id}">${p.nome} (${p.unidadeEmbalagem})</option>`)
          .join("")
      : `<option value="">Cadastre produtos na Despensa primeiro</option>`;

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
    linha.querySelector(".ing-select-produto").value = dadosIngrediente.produtoId || "";
    linha.querySelector(".ing-input-qtd").value = dadosIngrediente.quantidade || "";
    linha.querySelector(".ing-select-unidade").value = dadosIngrediente.unidadeId || "xicara";
  }

  linha.querySelector(".btn-remover-linha").addEventListener("click", () => {
    if (container.children.length > 1) {
      linha.remove();
    } else {
      mostrarMensagemReceitas("A receita precisa ter pelo menos 1 ingrediente.", "erro");
    }
  });

  container.appendChild(linha);
}

function abrirFormularioReceita(receitaParaEditar = null) {
  const painelForm = document.getElementById("painel-form-receita");
  const painelDetalhe = document.getElementById("painel-detalhe-receita");
  const visaoLista = document.getElementById("visao-lista-receitas");
  const containerInputs = document.getElementById("lista-inputs-ingredientes");

  painelDetalhe.classList.add("oculto");
  visaoLista.classList.add("oculto");
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

  if (avaliacao.tudoDisponivel) {
    boxSelo.className = "selo-receita-status selo-receita-verde";
    boxSelo.textContent = "✅ Você possui todos os ingredientes na despensa!";
  } else {
    const itensFaltantesHtml = avaliacao.faltantes
      .map((f) => `<li>${f.motivoFalta}</li>`)
      .join("");

    boxSelo.className = "selo-receita-status selo-receita-vermelho";
    boxSelo.innerHTML = `
      <strong>❌ Faltam ingredientes para esta receita</strong>
      <ul class="lista-faltantes-selo">${itensFaltantesHtml}</ul>
    `;
  }

  document.getElementById("detalhe-rec-tipo").textContent = receita.tipoRefeicao;
  document.getElementById("detalhe-rec-tempo").innerHTML = `${ICONES.relogio} ${receita.tempoPreparo}`;
  document.getElementById("detalhe-rec-nome").textContent = receita.nome;
  document.getElementById("detalhe-rec-modo").textContent = receita.modoPreparo;

  const containerIng = document.getElementById("detalhe-rec-ingredientes");
  containerIng.innerHTML = avaliacao.ingredientesAvaliados
    .map(
      (ing) => `
        <div class="item-ingrediente-detalhe ${ing.disponivel ? "" : "ing-faltando"}">
          <div>
            <div class="ing-nome-qtd">
              ${ing.disponivel ? "✅" : "❌"} ${formatarNumero(ing.quantidade)} ${ing.unidadeLabel} de ${ing.nomeExibicao}
            </div>
            <div class="ing-status-subtexto">
              ${ing.disponivel ? "Disponível na despensa" : ing.motivoFalta}
            </div>
          </div>
        </div>
      `
    )
    .join("");
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
  document.getElementById("btn-abrir-form-receita").addEventListener("click", () => {
    if (listaProdutosDespensa.length === 0) {
      mostrarMensagemReceitas(
        "Cadastre primeiro os produtos na aba Despensa para poder vinculá-los aos ingredientes da receita.",
        "erro"
      );
      return;
    }
    abrirFormularioReceita(null);
  });

  document.getElementById("btn-fechar-form-receita").addEventListener("click", fecharFormularioReceita);
  document.getElementById("btn-cancelar-receita").addEventListener("click", fecharFormularioReceita);
  document.getElementById("btn-voltar-receitas").addEventListener("click", fecharDetalheReceita);

  document.getElementById("btn-adicionar-ingrediente-form").addEventListener("click", () => {
    adicionarLinhaIngredienteForm(null);
  });

  document.getElementById("busca-receitas").addEventListener("input", renderizarListaReceitas);

  // Editar receita aberta
  document.getElementById("btn-editar-receita-aberta").addEventListener("click", () => {
    const receita = listaReceitas.find((r) => r.id === receitaAbertaId);
    if (receita) abrirFormularioReceita(receita);
  });

  // Excluir receita aberta
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

  // Salvar receita nova ou edição
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
// 6. RENDERIZAÇÃO EM TEMPO REAL (TELA INICIAL E DESPENSA)
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
      atualizarListaProdutosRetirada();
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
// 7. AUTENTICAÇÃO E VERIFICAÇÃO DE ACESSO DA FAMÍLIA
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