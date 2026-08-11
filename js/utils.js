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

    if (!dados.iconesCategorias || typeof dados.iconesCategorias !== "object" || Array.isArray(dados.iconesCategorias)) {
        dados.iconesCategorias = {};
    }

    return dados;
}

// Objeto com a mesma "cara" do localStorage (getItem/setItem), mas que
// lê de uma cópia em memória (já carregada do Firestore) e, ao salvar,
// manda a atualização de volta pro Firestore em segundo plano.
export function criarArmazenamento(dados, uid) {

    // Mantém uma referência global somente para que o sistema de ícones
    // consiga descobrir a preferência da categoria em qualquer página.
    window.__financasDados = dados;

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
    [["aposta", "apostas", "cassino", "casino", "slot", "bet"], ["slot", "#E11D48"]],
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
    carro:'<path d="M5 17h14l-1.2-5.1a2 2 0 0 0-1.95-1.55H8.15A2 2 0 0 0 6.2 11.9L5 17Z"/><path d="M4 17v2h2m12-2v2h2M7 14h.01M17 14h.01"/>',
    alimentacao:'<path d="M7 3v8M4.5 3v5.5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 3v18M17 3c2.2 1.6 2.2 5.3 0 7"/>',
    mercado:'<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L20 8H6"/>',
    saude:'<path d="M12 21s-7-4.4-9.2-9.1C1.2 8.4 3.1 5 6.5 5c2 0 3.5 1.2 4.5 2.7C12 6.2 13.5 5 15.5 5c3.4 0 5.3 3.4 3.7 6.9C19 16.6 12 21 12 21Z"/><path d="M12 9v6M9 12h6"/>',
    academia:'<path d="M7 5v14M17 5v14M4 8h16M4 16h16M2 10h4M18 10h4M2 14h4M18 14h4"/>',
    futebol:'<circle cx="12" cy="12" r="8.5"/><path d="m12 8-2.4 1.7.9 2.8h3l.9-2.8L12 8Zm-2.4 1.7-2.7-.1M10.5 12.5l-1.7 2.2m6.4-2.2 1.7 2.2m-6.4-2.2-1.7-2.2m6.4 2.2 1.7-2.2"/>',
    esporte:'<path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="8.5"/>',
    lazer:'<path d="M8 7h8a3 3 0 0 1 3 3v5H5v-5a3 3 0 0 1 3-3Z"/><path d="M9 11v2M15 11v2M5 12H3v4h4M19 12h2v4h-4"/>',
    streaming:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/>',
    telefone:'<path d="M6.6 3.5 9 6l-1.8 2.6a14 14 0 0 0 7.2 7.2L17 14l2.5 2.4-1.7 3.1c-.5.9-1.6 1.3-2.6 1-7.3-2.1-12.1-6.9-14.2-14.2-.3-1 .1-2.1 1-2.6l3.1-1.7Z"/>',
    casa:'<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
    educacao:'<path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 11v5c2.7 2 7.3 2 10 0v-5M21 9v6"/>',
    roupa:'<path d="m8 4 4 2 4-2 4 4-3 3v9H7v-9L4 8l4-4Z"/>',
    pet:'<path d="M8 12c-2.5-1.5-5-.1-5 2.4C3 17 6 18 8.5 16.5c1.9 2 5.1 2 7 0C18 18 21 17 21 14.4c0-2.5-2.5-3.9-5-2.4"/><circle cx="7" cy="6" r="2"/><circle cx="17" cy="6" r="2"/>',
    presente:'<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7ZM12 7h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z"/>',
    pagamento:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    cnh:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M12 10h5M12 14h3"/>',
    reserva:'<path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"/><path d="M4 9c0-2 2-3 4-3h5a3 3 0 0 1 3 3M14 13h4"/>',
    salario:'<path d="M12 3v18M16 7.5c0-1.4-1.8-2.5-4-2.5S8 6.1 8 7.5 9.8 10 12 10s4 1.1 4 2.5S14.2 15 12 15s-4-1.1-4-2.5"/>',
    outros:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
    taxi:'<path d="m7 10 2-4h6l2 4"/><path d="M5 10h14l2 3v5H3v-5l2-3ZM7 18v2m10-2v2"/><circle cx="7" cy="14" r=".5"/><circle cx="17" cy="14" r=".5"/>',
    onibus:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M5 12h14M8 17h.01M16 17h.01M8 7h8"/>',
    bicicleta:'<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-7 3 7 5-7M9 10h4"/>',
    moto:'<circle cx="7" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M7 17l3-7h5l3 7M12 10l2-3h3"/>',
    combustivel:'<path d="M6 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M6 9h11M18 7h2l2 3v7a2 2 0 0 1-2 2h-1"/>',
    predio:'<path d="M5 21V3h10v18M15 8h4v13M8 7h3M8 11h3M8 15h3M18 12h1M18 16h1"/>',
    luz:'<path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-1 1-1.5 2-1.5 4h-5c0-2-.5-3-1.5-4Z"/>',
    agua:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>',
    gas:'<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-5-10-1 3-4 4-4 7 0 1 .4 2 1 2.8-.4-.2-1-.8-1.5-1.8-1.5A6 6 0 0 0 12 21Z"/>',
    internet:'<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2 2.2 3 4.9 3 8s-1 5.8-3 8c-2-2.2-3-4.9-3-8s1-5.8 3-8Z"/>',
    wifi:'<path d="M3 9a14 14 0 0 1 18 0M6 12a9.5 9.5 0 0 1 12 0M9 15a5 5 0 0 1 6 0M12 19h.01"/>',
    computador:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    tv:'<rect x="3" y="5" width="18" height="13" rx="2"/><path d="m9 21 3-3 3 3"/>',
    camera:'<path d="M4 8h4l2-2h4l2 2h4v11H4V8Z"/><circle cx="12" cy="13" r="3"/>',
    musica:'<path d="M9 18V5l10-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3Zm10-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z"/>',
    cinema:'<path d="M4 5h16v14H4zM4 9h16M8 5l2 4M14 5l2 4M8 19l2-4M14 19l2-4"/>',
    jogo:'<path d="M6 9h12a4 4 0 0 1 3.7 5.5l-1.3 3.2a2.2 2.2 0 0 1-3.9.4l-1.2-2H8.7l-1.2 2a2.2 2.2 0 0 1-3.9-.4l-1.3-3.2A4 4 0 0 1 6 9Z"/><path d="M7 12v4M5 14h4M16 13h.01M19 15h.01"/>',
    basquete:'<circle cx="12" cy="12" r="8.5"/><path d="M5 7c3 2 5 3 7 3s4-1 7-3M5 17c3-2 5-3 7-3s4 1 7 3M12 3v18"/>',
    corrida:'<circle cx="15" cy="5" r="2"/><path d="m13 8-3 4 3 2 2 5M10 12l-4 2M13 14l-4 5"/>',
    aviao:'<path d="m3 11 18-6-6 18-3-8-9-4Z"/><path d="m12 15 4-4"/>',
    praia:'<path d="M3 20h18M5 17c3-4 11-4 14 0M7 13c1-5 9-5 10 0M12 3v5M8 5l2 2M16 5l-2 2"/>',
    hotel:'<path d="M4 20V8h16v12M4 12h16M7 16h3M14 16h3"/>',
    mapa:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
    farmacia:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 7v6M9 10h6"/>',
    dentista:'<path d="M8 5c1.5 0 2.5 1 4 1s2.5-1 4-1c3 0 4 3 3 6l-2 7c-.4 1.5-2.2 1.5-2.6 0L13 13h-2l-1.4 4c-.4 1.5-2.2 1.5-2.6 0L5 11c-1-3 .1-6 3-6Z"/>',
    livro:'<path d="M4 5a3 3 0 0 1 3-2h12v18H7a3 3 0 0 0-3 2V5Z"/><path d="M4 5v16M7 7h8M7 11h8"/>',
    escola:'<path d="m3 10 9-6 9 6v10H3V10Z"/><path d="M8 20v-6h8v6M12 4v6"/>',
    curso:'<path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 11v5c2.7 2 7.3 2 10 0v-5"/>',
    trabalho:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5h8v2M3 12h18M10 12v2h4v-2"/>',
    carteira:'<path d="M4 6h15a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><path d="M4 6V4h13M16 13h5"/>',
    pix:'<path d="m8 4 4 4 4-4 4 4-4 4 4 4-4 4-4-4-4 4-4-4 4-4-4-4 4-4Z"/>',
    cartao:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    boleto:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8v8M10 8v8M13 8v8M16 8v8"/>',
    banco:'<path d="m3 9 9-5 9 5M5 10v7M9 10v7M15 10v7M19 10v7M3 20h18"/>',
    investimento:'<path d="M4 19V5M4 19h17M7 15l4-5 3 3 6-8"/>',
    meta:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M22 12h-3"/>',
    doacao:'<path d="M20 12c0 5-8 9-8 9s-8-4-8-9a4 4 0 0 1 8-2 4 4 0 0 1 8 2Z"/>',
    beleza:'<path d="M9 3h6l-1 6 4 10H6l4-10-1-6ZM9 3h6M8 14h8"/>',
    cabelo:'<path d="M8 20c-3-2-3-6 0-8s3-5 0-8M12 20c-3-2-3-6 0-8s3-5 0-8M16 20c-3-2-3-6 0-8s3-5 0-8"/>',
    ferramentas:'<path d="m14 7 3-3 3 3-3 3M4 20l9-9M7 4l4 4M15 13l5 5"/>',
    manutencao:'<path d="m14 6 4-3 3 3-3 4M4 20l9-9M5 7a4 4 0 0 0 5 5M14 14a4 4 0 0 0 5 5"/>',
    sacola:'<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    feira:'<path d="M4 10h16l-2 10H6L4 10Z"/><path d="M7 10c0-4 2-6 5-6s5 2 5 6M8 14h8"/>',
    cafe:'<path d="M5 8h11v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8ZM16 10h2a3 3 0 0 1 0 6h-2M8 4c-1 1-1 2 0 3M12 4c-1 1-1 2 0 3"/>',
    restaurante:'<path d="M7 3v8M4.5 3v5.5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 3v18M17 3c2.2 1.6 2.2 5.3 0 7"/>',
    pizza:'<path d="M4 5c6-3 12-3 16 0l-7 15L4 5Z"/><circle cx="10" cy="9" r="1"/><circle cx="14" cy="12" r="1"/>',
    sorvete:'<path d="m7 10 5 11 5-11M6 9a6 6 0 0 1 12 0"/><path d="M9 6c1-1 2-1 3 0s2 1 3 0"/>',
    compras:'<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2 10h11l2-7H6"/>',
    presente2:'<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13"/>',
    slot:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M7 7h10v7H7zM10 17h4M9 10h.01M12 10h.01M15 10h.01"/><path d="M20 7h2v5"/>',
    alerta:'<path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
    calendario:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    relogio:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sino:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    estrela:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    outros2:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
};

const CORES_ICONES = {
    carro:'#3B82F6', alimentacao:'#F97316', mercado:'#10B981', saude:'#EF4444', academia:'#14B8A6', futebol:'#22C55E', esporte:'#0EA5E9', lazer:'#A855F7', streaming:'#E11D48', telefone:'#2563EB', casa:'#8B5CF6', educacao:'#6366F1', roupa:'#EC4899', pet:'#F59E0B', presente:'#EC4899', pagamento:'#F59E0B', cnh:'#0EA5E9', reserva:'#16A34A', salario:'#22C55E', outros:'#64748B', taxi:'#3B82F6', onibus:'#2563EB', bicicleta:'#10B981', moto:'#F59E0B', combustivel:'#F97316', predio:'#6366F1', luz:'#EAB308', agua:'#06B6D4', gas:'#EF4444', internet:'#0EA5E9', wifi:'#2563EB', computador:'#64748B', tv:'#7C3AED', camera:'#64748B', musica:'#EC4899', cinema:'#A855F7', jogo:'#8B5CF6', basquete:'#F97316', corrida:'#22C55E', aviao:'#0EA5E9', praia:'#06B6D4', hotel:'#6366F1', mapa:'#14B8A6', farmacia:'#EF4444', dentista:'#38BDF8', livro:'#6366F1', escola:'#4F46E5', curso:'#8B5CF6', trabalho:'#475569', carteira:'#16A34A', pix:'#22C55E', cartao:'#64748B', boleto:'#F59E0B', banco:'#0F766E', investimento:'#16A34A', meta:'#EAB308', doacao:'#EC4899', beleza:'#F472B6', cabelo:'#A855F7', ferramentas:'#64748B', manutencao:'#475569', sacola:'#EC4899', feira:'#10B981', cafe:'#92400E', restaurante:'#F97316', pizza:'#EF4444', sorvete:'#38BDF8', compras:'#10B981', presente2:'#EC4899', slot:'#E11D48', alerta:'#F59E0B', calendario:'#6366F1', relogio:'#0EA5E9', sino:'#8B5CF6', estrela:'#EAB308', outros2:'#64748B'
};

const NOMES_ICONES = {
    carro:'Carro', alimentacao:'Alimentação', mercado:'Mercado', saude:'Saúde', academia:'Academia', futebol:'Futebol', esporte:'Esporte', lazer:'Lazer', streaming:'Streaming', telefone:'Telefone', casa:'Casa', educacao:'Educação', roupa:'Roupas', pet:'Pet', presente:'Presente', pagamento:'Pagamento', cnh:'CNH', reserva:'Reserva', salario:'Salário', outros:'Outros', taxi:'Táxi', onibus:'Ônibus', bicicleta:'Bicicleta', moto:'Moto', combustivel:'Combustível', predio:'Prédio', luz:'Energia', agua:'Água', gas:'Gás', internet:'Internet', wifi:'Wi‑Fi', computador:'Computador', tv:'TV', camera:'Câmera', musica:'Música', cinema:'Cinema', jogo:'Jogos', basquete:'Basquete', corrida:'Corrida', aviao:'Viagem / Avião', praia:'Praia', hotel:'Hotel', mapa:'Mapa', farmacia:'Farmácia', dentista:'Dentista', livro:'Livro', escola:'Escola', curso:'Curso', trabalho:'Trabalho', carteira:'Carteira', pix:'PIX', cartao:'Cartão', boleto:'Boleto', banco:'Banco', investimento:'Investimento', meta:'Meta', doacao:'Doação', beleza:'Beleza', cabelo:'Cabelo', ferramentas:'Ferramentas', manutencao:'Manutenção', sacola:'Sacola', feira:'Feira', cafe:'Café', restaurante:'Restaurante', pizza:'Pizza', sorvete:'Sorvete', compras:'Compras', presente2:'Presente 2', slot:'Apostas / Cassino', alerta:'Alerta', calendario:'Calendário', relogio:'Relógio', sino:'Notificação', estrela:'Favorito', outros2:'Mais opções'
};

export const ICONES_DISPONIVEIS = Object.keys(SVG_ICONE_CATEGORIA).map(id => ({
    id,
    nome: NOMES_ICONES[id] || id,
    cor: CORES_ICONES[id] || '#64748B'
}));

function iconeSVG(tipo, cor) {
    const svg = SVG_ICONE_CATEGORIA[tipo] || SVG_ICONE_CATEGORIA.outros;
    return `<span class="icone-categoria" style="--icone-cor:${cor || CORES_ICONES[tipo] || '#64748B'}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></span>`;
}

function iconePersonalizada(nomeCategoria) {
    const dados = window.__financasDados;
    const mapa = dados?.iconesCategorias;
    if (!mapa) return null;
    const chave = normalizarTexto(nomeCategoria);
    const encontrado = Object.keys(mapa).find(nome => normalizarTexto(nome) === chave);
    return encontrado ? mapa[encontrado] : null;
}

export function iconeCategoria(nomeCategoria, iconeForcado = null) {
    const personalizado = iconeForcado || iconePersonalizada(nomeCategoria);
    if (personalizado && SVG_ICONE_CATEGORIA[personalizado]) {
        return iconeSVG(personalizado, CORES_ICONES[personalizado]);
    }

    const nomeNormalizado = normalizarTexto(nomeCategoria);
    const encontrado = ICONES_POR_PALAVRA.find(([palavras]) => palavras.some(palavra => nomeNormalizado.includes(palavra)));
    const [tipo, cor] = encontrado ? encontrado[1] : ['outros', '#64748B'];
    return iconeSVG(tipo, cor);
}

export function obterIconeCategoria(nomeCategoria) {
    return iconePersonalizada(nomeCategoria);
}

export function salvarIconeCategoria(nomeCategoria, icone) {
    const dados = window.__financasDados;
    if (!dados) return null;
    if (!dados.iconesCategorias || typeof dados.iconesCategorias !== 'object') dados.iconesCategorias = {};
    dados.iconesCategorias[nomeCategoria] = icone;
    return dados.iconesCategorias;
}
