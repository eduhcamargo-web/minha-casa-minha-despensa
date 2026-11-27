// =========================================================
// BIBLIOTECA DE ÍCONES FLUIDOS (ESTILO STREAMLINE FLEX)
// =========================================================

const SVG_BASE = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"`;

export const ICONES = Object.freeze({
  // Casa orgânica com arco interno
  casa: `<svg ${SVG_BASE}><path d="M4 10.5C4 9.2 4.6 8.1 5.6 7.3L10.4 3.8C11.4 3.1 12.6 3.1 13.6 3.8L18.4 7.3C19.4 8.1 20 9.2 20 10.5V17.2C20 19.1 18.6 20.5 16.7 20.5H7.3C5.4 20.5 4 19.1 4 17.2V10.5Z"/><path d="M9.5 20.5V15.2C9.5 13.9 10.6 12.8 12 12.8C13.4 12.8 14.5 13.9 14.5 15.2V20.5"/></svg>`,

  // Caixa/Pote arredondado de despensa
  despensa: `<svg ${SVG_BASE}><rect x="4" y="4" width="16" height="16" rx="5"/><path d="M9 4V7.2C9 8 9.6 8.6 10.4 8.6H13.6C14.4 8.6 15 8 15 7.2V4"/><path d="M14.5 15.5H16.5"/></svg>`,

  // Botão quadrado arredondado com sinal de + (Cadastrar)
  cadastrar: `<svg ${SVG_BASE}><rect x="3.5" y="3.5" width="17" height="17" rx="5.5"/><path d="M12 8.5V15.5"/><path d="M8.5 12H15.5"/></svg>`,

  // Caixa com seta fluida para cima/fora (Retirar item)
  retirar: `<svg ${SVG_BASE}><path d="M5 13.5V16.5C5 18.7 6.8 20.5 9 20.5H15C17.2 20.5 19 18.7 19 16.5V13.5"/><path d="M12 14.5V4.5"/><path d="M8.5 7.8L12 4.3L15.5 7.8"/></svg>`,

  // Tigela arredondada com vapor/hashi (Receitas)
  receitas: `<svg ${SVG_BASE}><path d="M4 12.5H20C20 16.8 16.6 20 12 20C7.4 20 4 16.8 4 12.5Z"/><path d="M6 8.5L19 6.5"/><path d="M6 10.5L19 9.5"/><path d="M10 4.5C10 5.5 10.8 6 10.8 7"/></svg>`,

  // Sacola de compras orgânica com alça curva (Lista de Compras)
  compras: `<svg ${SVG_BASE}><path d="M5.2 9.2C5.4 7.4 6.9 6 8.7 6H15.3C17.1 6 18.6 7.4 18.8 9.2L19.6 16.4C19.9 18.6 18.2 20.5 16 20.5H8C5.8 20.5 4.1 18.6 4.4 16.4L5.2 9.2Z"/><path d="M9.2 9.5C9.2 11.1 10.4 12.3 12 12.3C13.6 12.3 14.8 11.1 14.8 9.5"/></svg>`,

  // Sino arredondado expressivo (Alertas)
  alertas: `<svg ${SVG_BASE}><path d="M6.5 10.2C6.5 7 8.9 4.5 12 4.5C15.1 4.5 17.5 7 17.5 10.2V13.6C17.5 14.6 18.1 15.5 18.9 16.1C19.4 16.5 19.1 17.3 18.4 17.3H5.6C4.9 17.3 4.6 16.5 5.1 16.1C5.9 15.5 6.5 14.6 6.5 13.6V10.2Z"/><path d="M10 19.8C10.5 20.4 11.2 20.8 12 20.8C12.8 20.8 13.5 20.4 14 19.8"/></svg>`,

  // Balão de diálogo arredondado com interrogação (Ajuda)
  ajuda: `<svg ${SVG_BASE}><path d="M5.5 5.5C6.8 4.2 9.2 3.8 12 3.8C16.7 3.8 20.2 6.8 20.2 11.2C20.2 15.6 16.7 18.6 12 18.6C10.7 18.6 9.5 18.4 8.4 17.9L4.5 19.6L5.6 16.1C4.5 14.8 3.8 13.1 3.8 11.2C3.8 8.9 4.4 6.8 5.5 5.5Z"/><path d="M10.2 9.3C10.4 8.2 11.2 7.6 12.2 7.6C13.3 7.6 14.1 8.3 14.1 9.3C14.1 10.3 13.2 10.8 12.3 11.4C12.1 11.6 12 11.9 12 12.3"/><circle cx="12" cy="14.8" r="0.6" fill="currentColor"/></svg>`,

  // Lupa fluida (Pesquisa)
  busca: `<svg ${SVG_BASE}><circle cx="11" cy="11" r="6.5"/><path d="M16 16L20 20"/></svg>`,

  // Coração com visto (Sincronização / Sucesso)
  coracaoCheck: `<svg ${SVG_BASE}><path d="M12 19.5C12 19.5 4.5 14.8 4.5 9.2C4.5 6.6 6.5 4.6 9 4.6C10.5 4.6 11.5 5.3 12 6.2C12.5 5.3 13.5 4.6 15 4.6C17.5 4.6 19.5 6.6 19.5 9.2C19.5 11.1 18.6 12.9 17.3 14.4"/><path d="M13.5 16.8L15.6 18.9L19.8 14.7"/></svg>`,

  // Seta de saída arredondada
  sair: `<svg ${SVG_BASE}><path d="M14 5.5H8.5C6.6 5.5 5 7.1 5 9V15C5 16.9 6.6 18.5 8.5 18.5H14"/><path d="M11 12H19.5"/><path d="M16.8 9.2L19.6 12L16.8 14.8"/></svg>`,

  // Rosto amigável arredondado (Boas-vindas / Família)
  familia: `<svg ${SVG_BASE}><rect x="4" y="4.5" width="16" height="15" rx="6.5"/><path d="M9.2 10.5H9.3"/><path d="M14.7 10.5H14.8"/><path d="M9.5 14C10.2 15 11.1 15.4 12 15.4C12.9 15.4 13.8 15 14.5 14"/></svg>`,

  // Lápis arredondado (Editar item)
  editar: `<svg ${SVG_BASE}><path d="M14.5 5.5L18.5 9.5L8.5 19.5H4.5V15.5L14.5 5.5Z"/><path d="M12.5 7.5L16.5 11.5"/></svg>`,

  // Lixeira orgânica (Excluir item)
  lixeira: `<svg ${SVG_BASE}><path d="M4.5 7.5H19.5"/><path d="M9.5 7.5V5.5C9.5 4.7 10.2 4 11 4H13C13.8 4 14.5 4.7 14.5 5.5V7.5"/><path d="M6.5 7.5L7.3 18.2C7.4 19.5 8.5 20.5 9.8 20.5H14.2C15.5 20.5 16.6 19.5 16.7 18.2L17.5 7.5"/></svg>`,

  // X arredondado (Fechar formulário)
  fechar: `<svg ${SVG_BASE}><path d="M6.5 6.5L17.5 17.5"/><path d="M17.5 6.5L6.5 17.5"/></svg>`,

  // Triângulo suave de alerta (Estoque mínimo / zerado)
  alertaTriangulo: `<svg ${SVG_BASE}><path d="M10.4 4.8L3.8 16.4C3.1 17.6 4 19.1 5.4 19.1H18.6C20 19.1 20.9 17.6 20.2 16.4L13.6 4.8C12.9 3.6 11.1 3.6 10.4 4.8Z"/><path d="M12 9.5V13"/><circle cx="12" cy="16" r="0.6" fill="currentColor"/></svg>`,

  // Relógio arredondado (Tempo de preparo)
  relogio: `<svg ${SVG_BASE}><circle cx="12" cy="12" r="8"/><path d="M12 8V12L14.8 14"/></svg>`,

  // Seta esquerda arredondada (Voltar)
  voltar: `<svg ${SVG_BASE}><path d="M19 12H5.5"/><path d="M10.5 7L5.5 12L10.5 17"/></svg>`,

  // Carrinho de supermercado fluido (Adicionar à Lista de Compras)
  carrinho: `<svg ${SVG_BASE}><path d="M3.5 5.5H5.8L7.8 14.5C8 15.4 8.8 16 9.7 16H17.3C18.2 16 19 15.4 19.2 14.5L20.5 8.5H6.5"/><circle cx="9.5" cy="19.2" r="1.2"/><circle cx="17.2" cy="19.2" r="1.2"/></svg>`,

  // Visto / Check arredondado (Marcar item comprado)
  check: `<svg ${SVG_BASE}><path d="M5.5 12.5L9.8 16.8L18.8 7.5"/></svg>`
});

// Preenche automaticamente qualquer elemento HTML com atributo data-icone="nome"
export function inserirIconesNaPagina() {
  document.querySelectorAll("[data-icone]").forEach((el) => {
    const nome = el.dataset.icone;
    if (ICONES[nome]) {
      el.innerHTML = ICONES[nome];
    }
  });
}