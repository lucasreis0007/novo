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

// ---------------- ÍCONE POR CATEGORIA ----------------
// Ícones vetoriais por categoria. O nome da categoria continua livre:
// fazemos a associação por palavras-chave e usamos um ícone genérico
// para categorias personalizadas que não tenham correspondência.
const ICONES_POR_PALAVRA = [
    [["uber", "99", "taxi", "corrida", "carro", "combustivel", "gasolina", "transporte", "onibus", "metro", "estacionamento"], ["carro", "#3B82F6"]],
    [["alimenta", "restaurante", "lanche", "ifood", "comida", "almoco", "jantar", "cafe"], ["alimentacao", "#F97316"]],
    [["mercado", "supermercado", "feira", "hortifruti"], ["mercado", "#10B981"]],
    [["farmacia", "remedio", "saude", "medico", "consulta", "dentista"], ["saude", "#EF4444"]],
    [["academia", "gympass"], ["academia", "#14B8A6"]],
    [["futebol"], ["futebol", "#22C55E"]],
    [["esporte"], ["esporte", "#0EA5E9"]],
    [["lazer", "cinema", "show", "viagem", "passeio", "jogo", "game"], ["lazer", "#A855F7"]],
    [["streaming", "netflix", "spotify", "assinatura"], ["streaming", "#E11D48"]],
    [["telefone", "celular", "internet", "wifi"], ["telefone", "#2563EB"]],
    [["casa", "aluguel", "condominio", "luz", "energia", "agua", "gas"], ["casa", "#8B5CF6"]],
    [["educa", "curso", "escola", "faculdade", "livro"], ["educacao", "#6366F1"]],
    [["roupa", "vestuario", "moda"], ["roupa", "#EC4899"]],
    [["pet", "cachorro", "gato", "veterinario"], ["pet", "#F59E0B"]],
    [["presente", "doacao"], ["presente", "#EC4899"]],
    [["consorcio", "financiamento", "emprestimo", "divida", "cartao"], ["pagamento", "#F59E0B"]],
    [["cnh", "habilitacao", "carteira de motorista"], ["cnh", "#0EA5E9"]],
    [["reserva", "investimento"], ["reserva", "#16A34A"]],
    [["salario", "renda"], ["salario", "#22C55E"]]
];

const SVG_ICONE_CATEGORIA = {
    carro: '<path d="M5 17h14l-1.2-5.1a2 2 0 0 0-1.95-1.55H8.15A2 2 0 0 0 6.2 11.9L5 17Z"/><path d="M4 17v2h2v-2m12 0v2h2v-2M7 14h.01M17 14h.01"/>',
    alimentacao: '<path d="M7 3v8M4.5 3v5.5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 3v18M17 3c2.2 1.6 2.2 5.3 0 7"/>',
    mercado: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L20 8H6"/>',
    saude: '<path d="M12 21s-7-4.4-9.2-9.1C1.2 8.4 3.1 5 6.5 5c2 0 3.5 1.2 4.5 2.7C12 6.2 13.5 5 15.5 5c3.4 0 5.3 3.4 3.7 6.9C19 16.6 12 21 12 21Z"/><path d="M12 9v6M9 12h6"/>',
    academia: '<path d="M7 5v14M17 5v14M4 8h16M4 16h16M2 10h4M18 10h4M2 14h4M18 14h4"/>',
    futebol: '<circle cx="12" cy="12" r="8.5"/><path d="m12 8-2.4 1.7.9 2.8h3l.9-2.8L12 8Zm-2.4 1.7-2.7-.1M10.5 12.5l-1.7 2.2m6.4-2.2 1.7 2.2m-6.4-2.2-1.7-2.2m6.4 2.2 1.7-2.2"/>',
    esporte: '<path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="8.5"/>',
    lazer: '<path d="M8 7h8a3 3 0 0 1 3 3v5H5v-5a3 3 0 0 1 3-3Z"/><path d="M9 11v2M15 11v2M5 12H3v4h4M19 12h2v4h-4"/><path d="M10 17h4"/>',
    streaming: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/>',
    telefone: '<path d="M6.6 3.5 9 6l-1.8 2.6a14 14 0 0 0 7.2 7.2L17 14l2.5 2.4-1.7 3.1c-.5.9-1.6 1.3-2.6 1-7.3-2.1-12.1-6.9-14.2-14.2-.3-1 .1-2.1 1-2.6l3.1-1.7Z"/>',
    casa: '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
    educacao: '<path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 11v5c2.7 2 7.3 2 10 0v-5M21 9v6"/>',
    roupa: '<path d="m8 4 4 2 4-2 4 4-3 3v9H7v-9L4 8l4-4Z"/>',
    pet: '<path d="M8 12c-2.5-1.5-5-.1-5 2.4C3 17 6 18 8.5 16.5c1.9 2 5.1 2 7 0C18 18 21 17 21 14.4c0-2.5-2.5-3.9-5-2.4M7 8.5C5.5 8.5 4 7.2 4 5.7S5.1 3 6.5 3 9 4.2 9 5.7 8.5 8.5 7 8.5ZM17 8.5c1.5 0 3-1.3 3-2.8S18.9 3 17.5 3 15 4.2 15 5.7s.5 2.8 2 2.8Z"/>',
    presente: '<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7ZM12 7h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z"/>',
    pagamento: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    cnh: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M12 10h5M12 14h3"/>',
    reserva: '<path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"/><path d="M4 9c0-2 2-3 4-3h5a3 3 0 0 1 3 3"/><path d="M14 13h4"/>',
    salario: '<path d="M12 3v18M16 7.5c0-1.4-1.8-2.5-4-2.5S8 6.1 8 7.5 9.8 10 12 10s4 1.1 4 2.5S14.2 15 12 15s-4-1.1-4-2.5"/>',
    outros: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>'
};

function normalizarTexto(texto) {
    return (texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}


export function iconeCategoria(nomeCategoria) {
    const nomeNormalizado = normalizarTexto(nomeCategoria);
    const encontrado = ICONES_POR_PALAVRA.find(([palavras]) =>
        palavras.some(palavra => nomeNormalizado.includes(palavra))
    );

    const [tipo, cor] = encontrado ? encontrado[1] : ["outros", "#64748B"];
    const svg = SVG_ICONE_CATEGORIA[tipo] || SVG_ICONE_CATEGORIA.outros;

    return `<span class="icone-categoria" style="--icone-cor:${cor}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></span>`;
}
