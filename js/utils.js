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
    alimentacao: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="12" width="50" height="40" rx="12" fill="#FFF4DE"/><path d="M20 17v15M15 17v9c0 4 5 4 5 0M25 17v9c0 4-5 4-5 0M20 26v22" stroke="#D97706" stroke-width="4" stroke-linecap="round"/><path d="M42 16c7 5 9 13 5 18-2 2-4 3-6 3V48" fill="none" stroke="#EA580C" stroke-width="4" stroke-linecap="round"/></svg>`,
    mercado: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="12" width="50" height="40" rx="12" fill="#E9F8EE"/><path d="M15 20h4l5 23h21c3 0 5-2 6-5l3-12H22" fill="none" stroke="#16A34A" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 25v9M37 25v9M46 25v9" stroke="#F59E0B" stroke-width="4" stroke-linecap="round"/><circle cx="27" cy="49" r="3" fill="#15803D"/><circle cx="48" cy="49" r="3" fill="#15803D"/></svg>`,
    transporte: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="10" width="52" height="44" rx="13" fill="#E8F1FF"/><path d="M14 39l4-18c1-4 4-6 8-6h12c4 0 7 2 8 6l4 18" fill="#4F8EF7"/><path d="M12 39h40v8H12z" fill="#2563EB"/><path d="M19 27h26l-3-8H22z" fill="#DDEBFF"/><circle cx="21" cy="45" r="5" fill="#172554"/><circle cx="43" cy="45" r="5" fill="#172554"/><circle cx="21" cy="45" r="2" fill="#93C5FD"/><circle cx="43" cy="45" r="2" fill="#93C5FD"/><rect x="27" y="30" width="10" height="4" rx="2" fill="#BFDBFE"/></svg>`,
    combustivel: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="10" width="48" height="44" rx="12" fill="#FFF0F0"/><rect x="17" y="15" width="22" height="35" rx="3" fill="#EF4444"/><rect x="21" y="20" width="14" height="9" rx="2" fill="#FECACA"/><path d="M39 20h6l7 6v14c0 3-2 5-5 5h-3" fill="none" stroke="#991B1B" stroke-width="4" stroke-linecap="round"/><path d="M45 27h4" stroke="#991B1B" stroke-width="4" stroke-linecap="round"/></svg>`,
    futebol: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="23" fill="#EAF8EE"/><path d="m32 19 9 7-3 11H26l-3-11z" fill="#fff" stroke="#15803D" stroke-width="3"/><path d="m32 19-4 6m13 1-6 2m3 9 5 5M26 37l-5 5m2-16-7 2" stroke="#15803D" stroke-width="3" stroke-linecap="round"/></svg>`,
    academia: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="12" width="50" height="40" rx="12" fill="#F0EAFE"/><path d="M13 28h6v8h-6zM19 23h6v18h-6zM25 30h14v4H25zM39 23h6v18h-6zM45 28h6v8h-6z" fill="#7C3AED"/><circle cx="16" cy="32" r="2" fill="#DDD6FE"/><circle cx="48" cy="32" r="2" fill="#DDD6FE"/></svg>`,
    lazer: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#FFF1F7"/><path d="M17 41h30" stroke="#DB2777" stroke-width="4" stroke-linecap="round"/><path d="M20 39l5-17h14l5 17" fill="#F9A8D4"/><path d="M25 22l-4-7M39 22l4-7" stroke="#BE185D" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="31" r="5" fill="#fff" stroke="#DB2777" stroke-width="3"/></svg>`,
    cinema: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="11" width="50" height="42" rx="12" fill="#FFF3E8"/><rect x="14" y="19" width="36" height="27" rx="4" fill="#EA580C"/><path d="M17 19l5 8M27 19l5 8M37 19l5 8M47 19l3 5" stroke="#FED7AA" stroke-width="4"/><path d="m29 27 10 5-10 6z" fill="#fff"/></svg>`,
    streaming: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="11" width="50" height="42" rx="13" fill="#EEEAFE"/><rect x="14" y="18" width="36" height="25" rx="4" fill="#5B21B6"/><path d="m29 25 10 5-10 6z" fill="#fff"/><rect x="23" y="47" width="18" height="4" rx="2" fill="#A78BFA"/></svg>`,
    musica: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#EAF5FF"/><path d="M34 42V18l16-4v22" fill="none" stroke="#2563EB" stroke-width="5" stroke-linecap="round"/><circle cx="24" cy="43" r="8" fill="#3B82F6"/><circle cx="42" cy="38" r="8" fill="#60A5FA"/><circle cx="24" cy="43" r="3" fill="#DBEAFE"/><circle cx="42" cy="38" r="3" fill="#DBEAFE"/></svg>`,
    telefone: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="9" width="50" height="46" rx="13" fill="#E8F1FF"/><rect x="22" y="14" width="20" height="36" rx="5" fill="#2563EB"/><rect x="25" y="18" width="14" height="22" rx="2" fill="#DBEAFE"/><circle cx="32" cy="45" r="2" fill="#BFDBFE"/></svg>`,
    casa: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#FFF8E7"/><path d="m14 31 18-16 18 16v17H14z" fill="#F59E0B"/><path d="m12 31 20-18 20 18" fill="none" stroke="#B45309" stroke-width="4" stroke-linecap="round"/><rect x="27" y="36" width="10" height="12" rx="2" fill="#FFF7ED"/><rect x="18" y="33" width="7" height="7" rx="1" fill="#FEF3C7"/><rect x="39" y="33" width="7" height="7" rx="1" fill="#FEF3C7"/></svg>`,
    contas: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#F3F4F6"/><rect x="18" y="14" width="28" height="37" rx="4" fill="#fff" stroke="#6B7280" stroke-width="3"/><path d="M24 22h16M24 29h4M34 29h4M24 36h4M34 36h4M24 43h16" stroke="#9CA3AF" stroke-width="3" stroke-linecap="round"/></svg>`,
    cartao: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="11" width="50" height="42" rx="12" fill="#EEF2FF"/><rect x="13" y="19" width="38" height="26" rx="5" fill="#4F46E5"/><rect x="13" y="25" width="38" height="5" fill="#818CF8"/><rect x="19" y="36" width="11" height="4" rx="2" fill="#C7D2FE"/></svg>`,
    carteira: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#EAF8EE"/><path d="M16 19a5 5 0 0 1 5-5h27v34H19a5 5 0 0 1-5-5z" fill="#16A34A"/><path d="M14 23h34v21H19a5 5 0 0 1-5-5z" fill="#22C55E"/><rect x="37" y="29" width="16" height="10" rx="4" fill="#166534"/><circle cx="42" cy="34" r="2" fill="#DCFCE7"/></svg>`,
    dinheiro: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#E9F8EE"/><rect x="13" y="19" width="38" height="27" rx="5" fill="#16A34A"/><circle cx="32" cy="32.5" r="8" fill="#DCFCE7"/><path d="M32 27v11M35 29c-1-1-5-1-5 1 0 3 5 1 5 4 0 2-4 2-5 1" fill="none" stroke="#15803D" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    salario: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#EEF2FF"/><rect x="16" y="20" width="32" height="27" rx="4" fill="#4F46E5"/><path d="M23 20v-3a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v3" fill="none" stroke="#3730A3" stroke-width="4"/><circle cx="32" cy="33" r="7" fill="#C7D2FE"/><path d="M32 29v8M35 31c-1-1-5-1-5 1 0 3 5 1 5 4 0 2-4 2-5 1" fill="none" stroke="#4338CA" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    investimento: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#EAF8EE"/><path d="M15 45h34" stroke="#166534" stroke-width="4" stroke-linecap="round"/><rect x="18" y="31" width="7" height="14" rx="2" fill="#86EFAC"/><rect x="29" y="24" width="7" height="21" rx="2" fill="#4ADE80"/><rect x="40" y="18" width="7" height="27" rx="2" fill="#16A34A"/><path d="m17 27 10-8 8 4 12-10" fill="none" stroke="#15803D" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="m43 13 4 0-1 4" fill="none" stroke="#15803D" stroke-width="3" stroke-linecap="round"/></svg>`,
    reserva: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#EAF1FF"/><path d="M17 25h30v22H17z" fill="#3B82F6"/><path d="M22 25v-6h20v6" fill="#60A5FA"/><rect x="27" y="33" width="10" height="4" rx="2" fill="#DBEAFE"/><path d="M32 31v10" stroke="#DBEAFE" stroke-width="3" stroke-linecap="round"/></svg>`,
    meta: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#FFF7E6"/><circle cx="32" cy="32" r="18" fill="#FBBF24"/><circle cx="32" cy="32" r="11" fill="#FEF3C7"/><circle cx="32" cy="32" r="5" fill="#F59E0B"/><path d="m45 19 6-6" stroke="#B45309" stroke-width="4" stroke-linecap="round"/></svg>`,
    educacao: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#F3E8FF"/><path d="m12 27 20-10 20 10-20 10z" fill="#9333EA"/><path d="M20 31v10c7 5 17 5 24 0V31" fill="#C084FC"/><path d="M52 29v12" stroke="#7E22CE" stroke-width="4" stroke-linecap="round"/></svg>`,
    roupa: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#FFF1F7"/><path d="m22 18 10 7 10-7 10 9-5 22H17l-5-22z" fill="#EC4899"/><path d="M22 18c1 6 4 8 10 8s9-2 10-8" fill="none" stroke="#9D174D" stroke-width="3"/></svg>`,
    pet: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#FFF4E6"/><circle cx="21" cy="23" r="6" fill="#D97706"/><circle cx="43" cy="23" r="6" fill="#D97706"/><circle cx="27" cy="18" r="5" fill="#F59E0B"/><circle cx="37" cy="18" r="5" fill="#F59E0B"/><path d="M20 37c0-8 5-12 12-12s12 4 12 12c0 7-4 11-12 11s-12-4-12-11Z" fill="#EA580C"/><path d="M29 36c2 2 4 2 6 0" fill="none" stroke="#FFEDD5" stroke-width="3" stroke-linecap="round"/></svg>`,
    presente: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#FFF1F2"/><rect x="15" y="25" width="34" height="24" rx="3" fill="#EF4444"/><rect x="15" y="25" width="34" height="7" fill="#F87171"/><rect x="29" y="25" width="6" height="24" fill="#FECACA"/><path d="M32 25h-7c-5 0-7-3-5-6 2-3 7-1 12 6Zm0 0h7c5 0 7-3 5-6-2-3-7-1-12 6Z" fill="#FB7185"/></svg>`,
    farmacia: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#ECFDF5"/><rect x="19" y="15" width="26" height="34" rx="5" fill="#10B981"/><rect x="24" y="27" width="16" height="5" rx="2" fill="#D1FAE5"/><rect x="29.5" y="21.5" width="5" height="16" rx="2" fill="#D1FAE5"/></svg>`,
    viagem: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#EAF5FF"/><path d="m12 35 40-13-11 31-8-14-21-4z" fill="#0EA5E9"/><path d="m33 39 8-17" stroke="#E0F2FE" stroke-width="4" stroke-linecap="round"/><path d="M24 31 40 25" stroke="#E0F2FE" stroke-width="3" stroke-linecap="round"/></svg>`,
    computador: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#EEF2F7"/><rect x="14" y="17" width="36" height="24" rx="4" fill="#475569"/><rect x="18" y="21" width="28" height="16" rx="2" fill="#BFDBFE"/><path d="M24 48h16M32 41v7" stroke="#334155" stroke-width="4" stroke-linecap="round"/></svg>`,
    cafe: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#FFF7ED"/><path d="M17 24h28v13c0 7-5 11-14 11s-14-4-14-11z" fill="#F59E0B"/><path d="M45 28h4c5 0 6 8 0 10h-4" fill="none" stroke="#B45309" stroke-width="4" stroke-linecap="round"/><path d="M24 18c0-4 3-4 3-8M33 18c0-4 3-4 3-8" fill="none" stroke="#D97706" stroke-width="3" stroke-linecap="round"/></svg>`,
    ferramentas: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#F3F4F6"/><path d="m18 45 23-23" stroke="#64748B" stroke-width="7" stroke-linecap="round"/><path d="m18 45-4 4M41 22l6-6 5 5-6 6" stroke="#334155" stroke-width="4" stroke-linecap="round"/><path d="m17 18 9 9" stroke="#F59E0B" stroke-width="6" stroke-linecap="round"/><path d="m12 15 5-5 9 9-5 5z" fill="#FBBF24"/></svg>`,
    apostas: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#FFF7E6"/><rect x="15" y="17" width="34" height="30" rx="5" fill="#F59E0B"/><rect x="21" y="23" width="22" height="12" rx="3" fill="#FFF7ED"/><text x="25" y="33" font-size="10" font-family="Arial" font-weight="700" fill="#92400E">7 7</text><path d="M22 41h20" stroke="#B45309" stroke-width="3" stroke-linecap="round"/></svg>`,
    outros: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="10" width="50" height="44" rx="13" fill="#F1F5F9"/><circle cx="22" cy="32" r="5" fill="#64748B"/><circle cx="32" cy="32" r="5" fill="#94A3B8"/><circle cx="42" cy="32" r="5" fill="#CBD5E1"/></svg>`
};

const CHAVE_SVG_POR_PALAVRA = [
    [["alimenta","restaurante","lanche","ifood","comida","almoco","jantar"], "alimentacao"],
    [["mercado","supermercado","feira","hortifruti"], "mercado"],
    [["uber","99","taxi","corrida","carro","transporte","onibus","metro","estacionamento"], "transporte"],
    [["combustivel","gasolina","posto"], "combustivel"],
    [["academia","gympass"], "academia"],
    [["futebol"], "futebol"],
    [["lazer","show","passeio"], "lazer"],
    [["cinema"], "cinema"],
    [["streaming","netflix"], "streaming"],
    [["musica","spotify"], "musica"],
    [["telefone","celular","internet","wifi"], "telefone"],
    [["casa","aluguel","condominio","luz","energia","agua","gas"], "casa"],
    [["conta","boleto"], "contas"],
    [["cartao"], "cartao"],
    [["salario","renda"], "salario"],
    [["reserva","cnh"], "reserva"],
    [["investimento"], "investimento"],
    [["meta","objetivo"], "meta"],
    [["educa","curso","escola","faculdade","livro"], "educacao"],
    [["roupa","vestuario","moda"], "roupa"],
    [["pet","cachorro","gato","veterinario"], "pet"],
    [["presente","doacao"], "presente"],
    [["farmacia","remedio","saude","medico","consulta","dentista"], "farmacia"],
    [["viagem"], "viagem"],
    [["computador","notebook","pc"], "computador"],
    [["cafe"], "cafe"],
    [["ferramenta","manutencao"], "ferramentas"],
    [["aposta","apostas","casino","cassino"], "apostas"]
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

    // Uso interno do seletor: { __icone: "carteira" }
    // Isso evita confundir a chave do ícone com o nome da categoria.
    let personalizado = mapaPersonalizado?.__icone;

    if (!personalizado) {
        personalizado =
            mapaPersonalizado?.saida?.[nome] ||
            mapaPersonalizado?.entrada?.[nome] ||
            mapaPersonalizado?.[nome];
    }

    const chave = personalizado && ICONES_SVG[personalizado]
        ? personalizado
        : null;

    const prepararSVG = (svg) => svg.replace(
        "<svg ",
        '<svg width="32" height="32" preserveAspectRatio="xMidYMid meet" '
    );

    const svg = chave ? ICONES_SVG[chave] : (() => {
        const nomeNormalizado = normalizarTexto(nome);
        const encontrado = CHAVE_SVG_POR_PALAVRA.find(([palavras]) =>
            palavras.some(palavra => nomeNormalizado.includes(palavra))
        );
        return encontrado ? ICONES_SVG[encontrado[1]] : ICONES_SVG.outros;
    })();

    return `<span class="icone-categoria-svg">${prepararSVG(svg)}</span>`;
}

// Mantida para compatibilidade com o restante do app.
// Nenhuma lógica financeira depende mais de emojis, mas chamadas antigas
// continuam funcionando sem quebrar.
export function iconeCategoria(nomeCategoria, iconesPersonalizados = {}) {
    return iconeCategoriaSVG(nomeCategoria, iconesPersonalizados);
}
