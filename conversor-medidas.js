// =========================================================
// MOTOR MATEMÁTICO DE CONVERSÃO DE MEDIDAS E FRAÇÕES
// =========================================================
import { MEDIDAS_FIXAS } from "./dados-fixos.js";

/**
 * Converte uma quantidade retirada (ou exigida em receita) na fração
 * equivalente de 1 pacote/embalagem fechada do produto cadastrado.
 *
 * @param {Object} produto - Objeto do produto vindo do Firestore
 * @param {number} quantidade - Valor numérico informado pelo usuário
 * @param {string} unidadeId - ID da unidade escolhida (ex: 'xicara', 'g', 'pacote')
 * @returns {{ valido: boolean, fracaoPacote: number, mensagemErro?: string }}
 */
export function calcularFracaoEmbalagem(produto, quantidade, unidadeId) {
  const qtd = Number(quantidade);

  if (!produto || isNaN(qtd) || qtd <= 0) {
    return {
      valido: false,
      fracaoPacote: 0,
      mensagemErro: "Informe uma quantidade maior que zero."
    };
  }

  // Caso 1: Retirada por pacote / embalagem inteira
  if (unidadeId === "pacote") {
    return { valido: true, fracaoPacote: qtd };
  }

  // Caso 2: Produto com rendimento personalizado em xícaras cadastrado
  if (
    unidadeId === "xicara" &&
    produto.usaRendimentoXicaras &&
    Number(produto.xicarasPorEmbalagem) > 0
  ) {
    const fracao = qtd / Number(produto.xicarasPorEmbalagem);
    return { valido: true, fracaoPacote: fracao };
  }

  const unidadeEmb = produto.unidadeEmbalagem; // 'g', 'kg', 'ml', 'L', 'un'
  const tamanhoEmb = Number(produto.tamanhoEmbalagem) || 1;

  // Caso 3: Produto cadastrado em Unidade(s) ('un')
  if (unidadeEmb === "un") {
    if (unidadeId === "un") {
      return { valido: true, fracaoPacote: qtd / tamanhoEmb };
    }
    return {
      valido: false,
      fracaoPacote: 0,
      mensagemErro: `Este item está cadastrado em Unidade(s). Escolha "Unidade" ou "Pacote" para dar baixa.`
    };
  }

  // Busca os dados da medida escolhida na tabela fixa
  const infoMedida = MEDIDAS_FIXAS.unidadesRetiradaReceita.find(
    (m) => m.id === unidadeId
  );

  if (!infoMedida || unidadeId === "un") {
    return {
      valido: false,
      fracaoPacote: 0,
      mensagemErro: `Este item está cadastrado em ${unidadeEmb}. Escolha uma medida de peso, volume ou "Pacote".`
    };
  }

  // Converte o tamanho da embalagem fechada para a unidade base (gramas ou mililitros)
  const tipoEmbalagem = unidadeEmb === "g" || unidadeEmb === "kg" ? "massa" : "volume";
  const fatorEmbalagem = unidadeEmb === "kg" || unidadeEmb === "L" ? 1000 : 1;
  const totalEmbalagemBase = tamanhoEmb * fatorEmbalagem;

  // Verifica compatibilidade entre massa (g/kg) e volume (ml/L)
  // Medidas culinárias (xícara, colher de sopa, colher de chá) funcionam tanto para líquidos quanto para pós/grãos
  if (infoMedida.tipo !== "culinaria" && infoMedida.tipo !== tipoEmbalagem) {
    const labelTipo = tipoEmbalagem === "massa" ? "peso (g ou kg)" : "volume (ml ou L)";
    return {
      valido: false,
      fracaoPacote: 0,
      mensagemErro: `Este produto foi cadastrado por ${labelTipo}. Selecione uma medida compatível ou "Pacote".`
    };
  }

  const totalRetiradoBase = qtd * infoMedida.fatorBase;
  const fracaoCalculada = totalRetiradoBase / totalEmbalagemBase;

  return {
    valido: true,
    fracaoPacote: fracaoCalculada
  };
}