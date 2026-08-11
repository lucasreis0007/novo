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
// Como o nome da categoria é texto livre (o usuário pode criar as dele),
// não dá pra guardar um ícone fixo por categoria — em vez disso, casamos
// palavras-chave no nome (sem acento, minúsculo) com um emoji. Cobre as
// categorias padrão do app e os termos mais comuns; o que não casar cai
// no ícone genérico (📁).
const ICONES_POR_PALAVRA = [
    [["uber", "99", "taxi", "corrida", "carro", "combustivel", "gasolina", "transporte", "onibus", "metro", "estacionamento"], "🚗"],
    [["alimenta", "restaurante", "lanche", "ifood", "comida", "almoco", "jantar", "cafe"], "🍽️"],
    [["mercado", "supermercado", "feira", "hortifruti"], "🛒"],
    [["farmacia", "remedio", "saude", "medico", "consulta", "dentista"], "💊"],
    [["academia", "gympass", "futebol", "esporte"], "🏋️"],
    [["lazer", "cinema", "show", "viagem", "passeio"], "🎉"],
    [["streaming", "netflix", "spotify", "assinatura"], "📺"],
    [["telefone", "celular", "internet", "wifi"], "📱"],
    [["casa", "aluguel", "condominio", "luz", "energia", "agua", "gas"], "🏠"],
    [["educa", "curso", "escola", "faculdade", "livro"], "📚"],
    [["roupa", "vestuario", "moda"], "👕"],
    [["pet", "cachorro", "gato", "veterinario"], "🐾"],
    [["presente", "doacao"], "🎁"],
    [["consorcio", "financiamento", "emprestimo", "divida", "cartao"], "💳"],
    [["reserva", "investimento", "cnh"], "🏦"],
    [["salario", "renda"], "💼"]
];

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

    return encontrado ? encontrado[1] : "📁";
}
