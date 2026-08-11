// ---------------- AUTENTICAÇÃO E DADOS (Firebase) ----------------
// Este módulo faz duas coisas:
// 1. Garante que só usuários logados vejam as páginas (protegerPagina).
// 2. Carrega os dados do usuário no Firestore e devolve um objeto que
//    imita a API do localStorage (getItem/setItem), pra não precisar
//    reescrever a lógica de cada página — ela continua usando
//    "localStorage.getItem/setItem" normalmente, só que por baixo dos
//    panos os dados vêm e vão para a nuvem em vez do navegador.

import { auth, db, onAuthStateChanged, doc, getDoc, setDoc, signOut } from "./firebase-config.js";

// "categorias" fica de fora dessa lista de propósito: é um OBJETO
// ({ entrada: [...], saida: [...] }), não um array como as outras chaves.
const CHAVES_DADOS_ARRAY = ["movimentacoes", "bancos", "metas", "orcamentos"];

// Espera o Firebase confirmar se tem alguém logado. Se não tiver,
// manda de volta pra tela de login.
export function protegerPagina() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, (usuario) => {
            if (!usuario) {
                window.location.href = "../index.html";
            } else {
                resolve(usuario);
            }
        });
    });
}

// Busca o documento do usuário no Firestore (uma vez, ao abrir a página).
export async function carregarDados(uid) {

    const referencia = doc(db, "usuarios", uid);
    const instantaneo = await getDoc(referencia);

    const dados = instantaneo.exists() ? instantaneo.data() : {};

    CHAVES_DADOS_ARRAY.forEach(chave => {
        if (!Array.isArray(dados[chave])) {
            dados[chave] = [];
        }
    });

    // "categorias" só é considerada inválida se vier corrompida (array,
    // string, etc.). Se já for um objeto (mesmo vazio {}), mantemos como
    // veio do Firestore — é isso que fazia as categorias salvas sumirem.
    if (
        dados.categorias !== undefined &&
        (typeof dados.categorias !== "object" ||
            dados.categorias === null ||
            Array.isArray(dados.categorias))
    ) {
        delete dados.categorias;
    }

    return dados;
}

// Objeto com a mesma "cara" do localStorage (getItem/setItem), mas que
// lê de uma cópia em memória (já carregada do Firestore) e, ao salvar,
// manda a atualização de volta pro Firestore em segundo plano.
export function criarArmazenamento(dados, uid) {

    const referencia = doc(db, "usuarios", uid);

    // Ícones personalizados ficam em uma chave separada e visual.
    // Assim, nenhum dado financeiro ou a estrutura de "categorias" muda.
    if (!dados.iconesCategorias || typeof dados.iconesCategorias !== "object") {
        dados.iconesCategorias = { entrada: {}, saida: {} };
    }
    window.__iconesCategorias = dados.iconesCategorias;

    return {
        getItem(chave) {
            return chave in dados ? JSON.stringify(dados[chave]) : null;
        },
        setItem(chave, valorJson) {
            dados[chave] = JSON.parse(valorJson);

            if (chave === "iconesCategorias") {
                window.__iconesCategorias = dados[chave];
            }

            // "fire and forget" continua funcionando pra quem não usa o
            // retorno, mas agora devolvemos a Promise pra quem PRECISA
            // ter certeza de que salvou antes de trocar de página
            // (ex: salvar uma movimentação e já ir pro dashboard).
            return setDoc(referencia, { [chave]: dados[chave] }, { merge: true })
                .catch(erro => console.error("Erro ao salvar no Firebase:", erro));
        }
    };
}

export function sair() {
    signOut(auth).then(() => {
        window.location.href = "../index.html";
    });
}

// ---------------- ÍCONE POR CATEGORIA ----------------
// Os ícones visuais das categorias são SVGs inline.
// A personalização fica em "iconesCategorias", separado dos dados
// financeiros e da estrutura original de "categorias".

const ICONES_SVG = {
    carro: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14M7 17v2m10-2v2M4 17V9.8a2 2 0 0 1 1.4-1.9l1.2-.4 1.3-3.1A2 2 0 0 1 9.8 3h4.4a2 2 0 0 1 1.9 1.4l1.3 3.1 1.2.4A2 2 0 0 1 20 9.8V17M7 12h.01M17 12h.01M6 8h12"/></svg>`,
    comida: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8M4 3v5a3 3 0 0 0 3 3V21M10 3v5a3 3 0 0 1-3 3M17 3v18M14 8a3 3 0 0 1 6 0v1h-6V8Z"/></svg>`,
    mercado: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6M9 21h.01M18 21h.01M9 12h9M12 8v4M16 8v4"/></svg>`,
    lazer: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v18M3 3h4M3 7h4M12 4v5M9.5 6.5h5M18 3l-2 7h4l-2 11"/></svg>`,
    futebol: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m12 7 3 2-1 4h-4l-1-4 3-2ZM8 17l2-4M16 17l-2-4M5 10l4 1M19 10l-4 1"/></svg>`,
    academia: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10M2 10v4M22 10v4"/></svg>`,
    streaming: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/></svg>`,
    telefone: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10 5h4M11 18.5h2"/></svg>`,
    casa: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-6h6v6M7 11h.01M17 11h.01"/></svg>`,
    educacao: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 8 9-4 9 4-9 4-9-4Z"/><path d="M7 10v6c2.8 2.2 7.2 2.2 10 0v-6M21 9v6"/></svg>`,
    roupa: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 4 3 4-3 4 3v13H4V7l4-3Z"/><path d="M8 4c.3 2 1.7 3 4 3s3.7-1 4-3"/></svg>`,
    pet: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11c-3 0-4 2-4 4.5C4 18 5.5 20 8 20h8c2.5 0 4-2 4-4.5C20 13 19 11 16 11c-1.2 0-2.2.6-3 1.4-.8-.8-1.8-1.4-3-1.4Z"/><circle cx="6.5" cy="7" r="2"/><circle cx="17.5" cy="7" r="2"/><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/></svg>`,
    presente: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="9" width="18" height="12" rx="1"/><path d="M12 9v12M3 13h18M12 9H8.5a2.5 2.5 0 1 1 2.5-2.5V9ZM12 9h3.5A2.5 2.5 0 1 0 13 6.5V9Z"/></svg>`,
    cartao: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/></svg>`,
    reserva: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14v12H5zM7 8V5h10v3M9 12h6M12 12v4"/></svg>`,
    investimento: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-8M22 19V3M3 19h20"/></svg>`,
    salario: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/></svg>`,
    outros: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>`,
    farmacia: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M9 11h6M12 8v6"/></svg>`,
    combustivel: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M8 7h4v4H8zM15 7l3 2v7a2 2 0 0 0 2 2h1V9l-3-2"/></svg>`,
    contas: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h8"/></svg>`,
    viagem: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 18-5-5 18-4-8-9-5 0-0Z"/><path d="m12 16 4-6"/></svg>`,
    computador: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
    musica: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3ZM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z"/></svg>`,
    cinema: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 9h16M8 5l3 4M14 5l3 4M10 14l4 2-4 2v-4Z"/></svg>`,
    cafe: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h12v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8ZM17 10h2a2 2 0 0 1 0 4h-2M8 5c0-1 1-1 1-2M12 5c0-1 1-1 1-2"/></svg>`,
    ferramentas: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6 4-4 4 4-4 4M3 21l11-11M5 3l6 6M13 15l6 6M15 13l-4 4"/></svg>`,
    dinheiro: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 8h.01M18 16h.01"/></svg>`
};

const CHAVE_SVG_POR_PALAVRA = [
    [["uber","99","taxi","corrida","carro","transporte","onibus","metro","estacionamento"], "carro"],
    [["combustivel","gasolina","posto"], "combustivel"],
    [["alimenta","restaurante","lanche","ifood","comida","almoco","jantar"], "comida"],
    [["mercado","supermercado","feira","hortifruti"], "mercado"],
    [["farmacia","remedio","saude","medico","consulta","dentista"], "farmacia"],
    [["academia","gympass","esporte"], "academia"],
    [["futebol"], "futebol"],
    [["lazer","show","passeio"], "lazer"],
    [["cinema"], "cinema"],
    [["viagem"], "viagem"],
    [["streaming","netflix","spotify","assinatura"], "streaming"],
    [["telefone","celular","internet","wifi"], "telefone"],
    [["casa","aluguel","condominio","luz","energia","agua","gas"], "casa"],
    [["educa","curso","escola","faculdade","livro"], "educacao"],
    [["roupa","vestuario","moda"], "roupa"],
    [["pet","cachorro","gato","veterinario"], "pet"],
    [["presente","doacao"], "presente"],
    [["consorcio","financiamento","emprestimo","divida","cartao"], "cartao"],
    [["reserva","cnh"], "reserva"],
    [["investimento"], "investimento"],
    [["salario","renda"], "salario"],
    [["musica"], "musica"],
    [["computador","notebook","pc"], "computador"],
    [["cafe"], "cafe"],
    [["ferramenta","manutencao"], "ferramentas"],
    [["conta","boleto"], "contas"]
];

function normalizarTexto(texto) {
    return (texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

export function listaIconesCategoria() {
    return ICONES_SVG;
}

export function iconeCategoriaSVG(nomeCategoria, iconesPersonalizados = null) {
    const nome = String(nomeCategoria || "");
    const mapaPersonalizado = iconesPersonalizados || window.__iconesCategorias || {};

    // Aceita tanto {saida:{Nome:"icone"}} quanto {Nome:"icone"}
    const personalizado =
        mapaPersonalizado?.saida?.[nome] ||
        mapaPersonalizado?.entrada?.[nome] ||
        mapaPersonalizado?.[nome];

    const chave = personalizado && ICONES_SVG[personalizado]
        ? personalizado
        : (personalizado && personalizado.trim?.().startsWith("<svg")
            ? personalizado
            : null);

    const prepararSVG = (svg) => svg
        .replace(
            "<svg ",
            '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" '
        );

    if (chave) {
        const svg = chave.startsWith("<svg")
            ? chave
            : ICONES_SVG[chave];

        return `<span class="icone-categoria-svg" style="display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;vertical-align:middle;flex-shrink:0;">${prepararSVG(svg)}</span>`;
    }

    const nomeNormalizado = normalizarTexto(nome);
    const encontrado = CHAVE_SVG_POR_PALAVRA.find(([palavras]) =>
        palavras.some(palavra => nomeNormalizado.includes(palavra))
    );

    const svg = encontrado ? ICONES_SVG[encontrado[1]] : ICONES_SVG.outros;
    return `<span class="icone-categoria-svg" style="display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;vertical-align:middle;flex-shrink:0;">${prepararSVG(svg)}</span>`;
}

// Mantida para compatibilidade com o restante do app.
// Nenhuma lógica financeira depende mais de emojis, mas chamadas antigas
// continuam funcionando sem quebrar.
export function iconeCategoria(nomeCategoria, iconesPersonalizados = {}) {
    return iconeCategoriaSVG(nomeCategoria, iconesPersonalizados);
}
