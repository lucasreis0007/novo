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

    return {
        getItem(chave) {
            return chave in dados ? JSON.stringify(dados[chave]) : null;
        },
        setItem(chave, valorJson) {
            dados[chave] = JSON.parse(valorJson);
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

// ---------------- ÍCONES SVG POR CATEGORIA ----------------
// Biblioteca de ícones (SVG em vez de emoji) que o usuário pode escolher
// manualmente pra cada categoria na tela de Categorias. Cada ícone tem uma
// cor de fundo, pra reproduzir o visual de "círculo colorido" usado no
// resto do app (alertas, lembretes etc.).
//
// IMPORTANTE: os SVGs aqui usam stroke="currentColor" e não têm cor fixa —
// quem define a cor é o "cor" de cada entrada, aplicada como texto/fundo
// do círculo que envolve o ícone (ver renderizarIcone()).
export const ICONES_DISPONIVEIS = [
    {
        id: "transporte", rotulo: "Transporte", cor: "#2563EB",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><rect x="3" y="11" width="18" height="6" rx="2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>`
    },
    {
        id: "alimentacao", rotulo: "Alimentação", cor: "#EA580C",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v7a2 2 0 0 0 4 0V3"/><path d="M9 10v11"/><path d="M17 3c-1.5 0-3 1.5-3 4s1.5 4 3 4v10"/></svg>`
    },
    {
        id: "mercado", rotulo: "Mercado", cor: "#16A34A",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M2 3h2l2.6 12.2A2 2 0 0 0 8.6 17h8.8a2 2 0 0 0 2-1.6L21 7H6"/></svg>`
    },
    {
        id: "saude", rotulo: "Saúde", cor: "#DC2626",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.35-9.5-8.5C.6 8.9 2.4 5 6 5c2 0 3.2 1 4 2.1C10.8 6 12 5 14 5c3.6 0 5.4 3.9 3.5 7.5C19 16.65 12 21 12 21z"/><path d="M9 11h6M12 8v6"/></svg>`
    },
    {
        id: "academia", rotulo: "Academia", cor: "#7C3AED",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 7v10M17.5 7v10M3 10v4M21 10v4M6.5 12h11"/></svg>`
    },
    {
        id: "lazer", rotulo: "Lazer", cor: "#DB2777",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/><path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14z"/><path d="M5 14l.7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7L5 14z"/></svg>`
    },
    {
        id: "streaming", rotulo: "Streaming", cor: "#4338CA",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 21h8M12 18v3"/><path d="M10.5 9.5l4 2.2-4 2.2z"/></svg>`
    },
    {
        id: "telefone", rotulo: "Telefone", cor: "#0284C7",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>`
    },
    {
        id: "casa", rotulo: "Casa", cor: "#0D9488",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>`
    },
    {
        id: "educacao", rotulo: "Educação", cor: "#CA8A04",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l10-4 10 4-10 4-10-4z"/><path d="M6 11v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5"/></svg>`
    },
    {
        id: "roupa", rotulo: "Roupas", cor: "#E11D48",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4L4 7v3h3v10h10V10h3V7l-4-3-3 2h-2L8 4z"/></svg>`
    },
    {
        id: "pet", rotulo: "Pet", cor: "#B45309",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="8" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="17" cy="8" r="1.6"/><circle cx="19" cy="12.5" r="1.6"/><path d="M8 17c-1 0-2-1-2-2.4 0-2.3 3-4.1 6-4.1s6 1.8 6 4.1c0 1.4-1 2.4-2 2.4-1.4 0-1.7-1-4-1s-2.6 1-4 1z"/></svg>`
    },
    {
        id: "presente", rotulo: "Presente", cor: "#E53E3E",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><rect x="5" y="12" width="14" height="9" rx="1"/><path d="M12 8v13"/><path d="M12 8c-1.5 0-4-.8-4-3s2-3 4-1c2-2 4 1 4 3s-2.5 1-4 1z"/></svg>`
    },
    {
        id: "cartao", rotulo: "Cartão/Financiamento", cor: "#7C3AED",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>`
    },
    {
        id: "reserva", rotulo: "Reserva/Investimento", cor: "#15803D",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V10l9-6 9 6v11"/><path d="M8 21v-6h8v6"/><path d="M8 13h8"/></svg>`
    },
    {
        id: "salario", rotulo: "Salário/Renda", cor: "#475569",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>`
    },
    {
        id: "viagem", rotulo: "Viagem", cor: "#0891B2",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 21l1.5-6-8.5-3 2-2 9 1.5L20 6a1.4 1.4 0 0 1 2 2l-5.5 5.5 1.5 9-2-2-3-8.5-6 8-2-2z"/></svg>`
    },
    {
        id: "beleza", rotulo: "Beleza/Estética", cor: "#DB2777",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 8l12 12M20 4L8 16"/></svg>`
    },
    {
        id: "conta", rotulo: "Contas/Boletos", cor: "#B45309",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12v19l-3-2-3 2-3-2-3 2V2z"/><path d="M9 7h6M9 11h6M9 15h3"/></svg>`
    },
    {
        id: "seguro", rotulo: "Seguro", cor: "#0D9488",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.4 8.7-8 11-4.6-2.3-8-6-8-11V5l8-3z"/><path d="M9 12l2 2 4-4"/></svg>`
    },
    {
        id: "manutencao", rotulo: "Manutenção/Reparos", cor: "#57534E",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2 2.8-2.8z"/></svg>`
    },
    {
        id: "trabalho", rotulo: "Trabalho Extra/Freelance", cor: "#4338CA",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="1"/><path d="M2 18h20l-1.5 2h-17z"/><path d="M10 9h4"/></svg>`
    },
    {
        id: "apostas", rotulo: "Apostas", cor: "#B91C1C",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1" fill="currentColor" stroke="none"/></svg>`
    },
    {
        id: "rendimentos", rotulo: "Rendimentos", cor: "#059669",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 6"/><polyline points="15 6 21 6 21 12"/></svg>`
    },
    {
        id: "combustivel", rotulo: "Combustível", cor: "#C2410C",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15"/><path d="M3 21h11"/><path d="M13 9h2l3 3v6a1.5 1.5 0 0 1-3 0v-3h-2"/><path d="M6 6h5"/></svg>`
    },
    {
        id: "transferencia", rotulo: "Transferência/Pix", cor: "#1D4ED8",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h13l-3-3"/><path d="M20 17H7l3 3"/></svg>`
    },
    {
        id: "compras", rotulo: "Compras Online", cor: "#9333EA",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>`
    },
    {
        id: "festa", rotulo: "Festa/Aniversário", cor: "#F472B6",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 1 5 5c0 3-2 5-4 6.5L13 16h-2l.5-2.5C9.5 12 7 10 7 7a5 5 0 0 1 5-5z"/><path d="M11 16l-1 6"/></svg>`
    },
    {
        id: "multa", rotulo: "Multa", cor: "#DC2626",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>`
    },
    {
        id: "outros", rotulo: "Outros", cor: "#64748B",
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`
    }
];

const ICONE_PADRAO = "outros";

// Versão em emoji dos mesmos ícones, usada só em lugares onde HTML não
// funciona (ex: dentro de <option> de um <select> — o navegador ignora
// tags ali e mostraria o SVG como texto cru).
const EMOJI_POR_ICONE = {
    transporte: "🚗", alimentacao: "🍽️", mercado: "🛒", saude: "💊",
    academia: "🏋️", lazer: "🎉", streaming: "📺", telefone: "📱",
    casa: "🏠", educacao: "📚", roupa: "👕", pet: "🐾", presente: "🎁",
    cartao: "💳", reserva: "🏦", salario: "💼", viagem: "✈️",
    beleza: "💇", conta: "🧾", seguro: "🛡️", manutencao: "🔧",
    trabalho: "💻", apostas: "🎲", rendimentos: "📈", combustivel: "⛽",
    transferencia: "🔁", compras: "🛍️", festa: "🎈", multa: "⚠️",
    outros: "📁"
};

// Mesma lógica de antes (palavra-chave → ícone), só que agora aponta pro
// "id" de um ícone SVG em vez de um emoji direto.
const ICONES_POR_PALAVRA = [
    [["uber", "99", "taxi", "corrida", "carro", "transporte", "onibus", "metro", "estacionamento"], "transporte"],
    [["alimenta", "restaurante", "lanche", "ifood", "comida", "almoco", "jantar", "cafe"], "alimentacao"],
    [["mercado", "supermercado", "feira", "hortifruti"], "mercado"],
    [["farmacia", "remedio", "saude", "medico", "consulta", "dentista"], "saude"],
    [["academia", "gympass", "futebol", "esporte"], "academia"],
    [["lazer", "cinema", "show", "passeio"], "lazer"],
    [["streaming", "netflix", "spotify", "assinatura"], "streaming"],
    [["telefone", "celular", "internet", "wifi"], "telefone"],
    [["casa", "aluguel", "condominio", "luz", "energia", "agua", "gas"], "casa"],
    [["educa", "curso", "escola", "faculdade", "livro"], "educacao"],
    [["roupa", "vestuario", "moda"], "roupa"],
    [["pet", "cachorro", "gato", "veterinario"], "pet"],
    [["presente", "doacao"], "presente"],
    [["consorcio", "financiamento", "emprestimo", "divida", "cartao"], "cartao"],
    [["reserva", "investimento", "cnh"], "reserva"],
    [["salario", "renda"], "salario"],
    [["viagem", "passagem", "hotel", "aeroporto", "hospedagem"], "viagem"],
    [["beleza", "cabelo", "salao", "manicure", "estetica", "barbearia"], "beleza"],
    [["conta", "boleto", "imposto", "taxa", "iptu", "ipva"], "conta"],
    [["seguro"], "seguro"],
    [["manutencao", "reparo", "conserto", "oficina"], "manutencao"],
    [["freelance", "freela", "bico", "extra"], "trabalho"],
    [["aposta", "bet", "loteria", "cassino", "jogo do bicho"], "apostas"],
    [["rendimento", "dividendo", "juros", "lucro"], "rendimentos"],
    [["combustivel", "gasolina", "alcool", "etanol", "posto"], "combustivel"],
    [["transferencia"], "transferencia"],
    [["compra", "shopping", "shopee", "amazon", "magalu", "aliexpress"], "compras"],
    [["festa", "aniversario", "balada"], "festa"],
    [["multa", "infracao"], "multa"]
];

function normalizarTexto(texto) {
    return (texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function buscarIconePorId(id) {
    return ICONES_DISPONIVEIS.find(icone => icone.id === id);
}

// Monta o HTML de um ícone: círculo colorido de fundo + SVG dentro,
// igual ao estilo usado nos alertas/lembretes do dashboard.
// "tamanho" controla o diâmetro do círculo em pixels (padrão 32).
export function renderizarIcone(id, tamanho = 32) {

    const icone = buscarIconePorId(id) || buscarIconePorId(ICONE_PADRAO);
    const tamanhoSvg = Math.round(tamanho * 0.55);

    return `<span class="icone-categoria" style="display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:${tamanho}px;height:${tamanho}px;border-radius:50%;background:${icone.cor}22;color:${icone.cor};"><span style="width:${tamanhoSvg}px;height:${tamanhoSvg}px;display:inline-flex;">${icone.svg}</span></span>`;
}

// Decide qual ícone usar pra uma categoria:
// 1. Se essa categoria tem um ícone escolhido manualmente pelo usuário
//    (guardado em categorias.iconesPersonalizados), usa ele.
// 2. Senão, tenta casar por palavra-chave no nome (comportamento antigo).
// 3. Senão, usa o ícone genérico.
//
// O segundo parâmetro (categorias) é OPCIONAL — quem já chamava
// iconeCategoria(nome) continua funcionando normalmente, só não vai
// enxergar ícones personalizados até passar o objeto de categorias também.
export function iconeCategoria(nomeCategoria, categorias) {

    const personalizado = categorias?.iconesPersonalizados?.[nomeCategoria];

    if (personalizado && buscarIconePorId(personalizado)) {
        return renderizarIcone(personalizado);
    }

    const nomeNormalizado = normalizarTexto(nomeCategoria);

    const encontrado = ICONES_POR_PALAVRA.find(([palavras]) =>
        palavras.some(palavra => nomeNormalizado.includes(palavra))
    );

    return renderizarIcone(encontrado ? encontrado[1] : ICONE_PADRAO);
}

// Igual iconeCategoria(), mas devolve emoji em vez de HTML — use essa
// dentro de <option> de <select> (o navegador não renderiza HTML ali).
export function iconeCategoriaTexto(nomeCategoria, categorias) {
    return EMOJI_POR_ICONE[idIconeCategoria(nomeCategoria, categorias)] || EMOJI_POR_ICONE[ICONE_PADRAO];
}
// HTML) — usado pela tela de Categorias pra marcar qual ícone já está
// selecionado no seletor.
export function idIconeCategoria(nomeCategoria, categorias) {

    const personalizado = categorias?.iconesPersonalizados?.[nomeCategoria];

    if (personalizado && buscarIconePorId(personalizado)) {
        return personalizado;
    }

    const nomeNormalizado = normalizarTexto(nomeCategoria);

    const encontrado = ICONES_POR_PALAVRA.find(([palavras]) =>
        palavras.some(palavra => nomeNormalizado.includes(palavra))
    );

    return encontrado ? encontrado[1] : ICONE_PADRAO;
}
