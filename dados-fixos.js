// =========================================================
// DADOS FIXOS E PROTEGIDOS DO SISTEMA (CONGELADOS EM MEMÓRIA)
// =========================================================

function congelarTudo(objeto) {
  Object.keys(objeto).forEach((chave) => {
    if (typeof objeto[chave] === "object" && objeto[chave] !== null) {
      congelarTudo(objeto[chave]);
    }
  });
  return Object.freeze(objeto);
}

// 1. Grupos principais e suas subcategorias dependentes
export const CATEGORIAS_FIXAS = congelarTudo({
  Mantimentos: [
    "Grãos e Cereais",
    "Massas e Farinhas",
    "Temperos e Condimentos",
    "Óleos, Azeites e Vinagres",
    "Laticínios e Frios",
    "Carnes, Aves e Ovos",
    "Hortifrúti",
    "Padaria e Matinais",
    "Enlatados e Conservas",
    "Bebidas",
    "Doces e Sobremesas",
    "Outros Mantimentos"
  ],
  "Material de Limpeza": [
    "Lavanderia",
    "Cozinha e Louças",
    "Banheiro",
    "Pisos e Superfícies",
    "Descartáveis e Papéis",
    "Uso Geral"
  ]
});

// 2. Unidades de medida e fatores de conversão padronizados
export const MEDIDAS_FIXAS = congelarTudo({
  unidadesEmbalagem: [
    { id: "g", nome: "Gramas (g)", tipo: "massa", fatorBase: 1 },
    { id: "kg", nome: "Quilogramas (kg)", tipo: "massa", fatorBase: 1000 },
    { id: "ml", nome: "Mililitros (ml)", tipo: "volume", fatorBase: 1 },
    { id: "L", nome: "Litros (L)", tipo: "volume", fatorBase: 1000 },
    { id: "un", nome: "Unidade(s)", tipo: "unidade", fatorBase: 1 }
  ],
  unidadesRetiradaReceita: [
    { id: "pacote", nome: "Pacote / Embalagem inteira", tipo: "embalagem", fatorBase: 1 },
    { id: "g", nome: "Gramas (g)", tipo: "massa", fatorBase: 1 },
    { id: "kg", nome: "Quilogramas (kg)", tipo: "massa", fatorBase: 1000 },
    { id: "ml", nome: "Mililitros (ml)", tipo: "volume", fatorBase: 1 },
    { id: "L", nome: "Litros (L)", tipo: "volume", fatorBase: 1000 },
    { id: "xicara", nome: "Xícara (240 ml)", tipo: "culinaria", fatorBase: 240 },
    { id: "colher_sopa", nome: "Colher de Sopa (15 ml / 15 g)", tipo: "culinaria", fatorBase: 15 },
    { id: "colher_cha", nome: "Colher de Chá (5 ml / 5 g)", tipo: "culinaria", fatorBase: 5 },
    { id: "un", nome: "Unidade", tipo: "unidade", fatorBase: 1 }
  ]
});

// 3. Guia integrado de 7 passos com cores pastéis e ícones fluidos
export const INSTRUCOES_AJUDA = congelarTudo([
  {
    passo: 1,
    titulo: "Tela Inicial e Resumo Vivo",
    faixaClasse: "faixa-verde",
    icone: "casa",
    descricao: "Acompanhe em tempo real tudo o que existe em casa, dividido entre Mantimentos e Material de Limpeza, com 6 botões de atalho rápido no topo."
  },
  {
    passo: 2,
    titulo: "Cadastrar Produtos na Despensa",
    faixaClasse: "faixa-azul",
    icone: "cadastrar",
    descricao: "Toque em '+' para incluir itens. Escolha Mantimentos ou Limpeza para filtrar as subcategorias, informe o tamanho do pacote, quantidade atual e estoque mínimo."
  },
  {
    passo: 3,
    titulo: "Dar Baixa no Consumo (Retirada)",
    faixaClasse: "faixa-pessego",
    icone: "retirar",
    descricao: "Ao usar um item, acesse 'Retirar'. Informe a quantidade e a medida usada (xícara, colher, gramas ou pacote) que o sistema converte e desconta sozinho."
  },
  {
    passo: 4,
    titulo: "Receitas com Checagem de Estoque",
    faixaClasse: "faixa-lavanda",
    icone: "receitas",
    descricao: "Cadastre receitas vinculadas à despensa. Ao abrir qualquer prato, um selo verde avisa se você tem tudo em casa ou um selo vermelho lista o que falta."
  },
  {
    passo: 5,
    titulo: "Lista de Compras Interativa",
    faixaClasse: "faixa-amarelo",
    icone: "compras",
    descricao: "Envie ingredientes das receitas ou adicione itens avulsos. No mercado, toque para riscar o item em tempo real e use 'Finalizar Lista' para somar tudo ao estoque."
  },
  {
    passo: 6,
    titulo: "Alertas e E-mail Automático",
    faixaClasse: "faixa-rosa",
    icone: "alertas",
    descricao: "Produtos no estoque mínimo ganham destaque laranja ou vermelho, aparecem na aba Alertas e disparam um e-mail automático para a família."
  },
  {
    passo: 7,
    titulo: "Sincronização Familiar e PWA",
    faixaClasse: "faixa-verde",
    icone: "coracaoCheck",
    descricao: "Todos os celulares da família veem as mudanças na mesma hora. Instale este site na tela inicial do celular para usar em tela cheia como aplicativo."
  }
]);