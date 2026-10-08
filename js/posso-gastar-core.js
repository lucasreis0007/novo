// ======================================================================
// POSSO GASTAR? — núcleo de cálculo
//
// Este arquivo NÃO mexe em tela nem em Firebase: recebe os dados do app
// (movimentações, metas, categorias, orçamentos, planejamento) e devolve
// o resultado da análise. Assim a regra fica isolada e fácil de testar.
//
// IDEIA CENTRAL: o app nunca olha só o saldo da conta. Ele monta uma
// "linha do tempo" do mês restante:
//   saldo de hoje
//   − o que ainda precisa ser pago (obrigações + aportes de meta)
//   + o que ainda vai ser recebido
// e descobre o PONTO MAIS BAIXO que o saldo atinge até o fim do mês.
// Esse ponto mais baixo é o dinheiro realmente livre: gastar mais do que
// isso hoje faria faltar dinheiro numa conta ou numa meta mais pra frente.
// ======================================================================

export const NIVEL = {
    PODE: "pode",
    CUIDADO: "cuidado",
    NAO: "nao",
    FALTAM_DADOS: "faltam"
};

// Palavra especial usada no seletor de categoria: "o grupo de lazer".
export const GRUPO_LAZER = "__lazer__";

// ---------------- UTILITÁRIOS ----------------

export function arredondar(n) {
    return Math.round(Number(n || 0) * 100) / 100;
}

export function normalizar(texto) {
    return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function pad(n) {
    return String(n).padStart(2, "0");
}

export function paraISO(data) {
    return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function limitesDoMes(hoje) {
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    const ultimo = new Date(ano, mes + 1, 0).getDate();
    return {
        inicio: `${ano}-${pad(mes + 1)}-01`,
        fim: `${ano}-${pad(mes + 1)}-${pad(ultimo)}`,
        ultimoDia: ultimo
    };
}

function noPeriodo(mov, inicio, fim) {
    return Boolean(mov.data) && mov.data >= inicio && mov.data <= fim;
}

function ehSaida(mov) {
    return mov.tipo !== "Entrada";
}

// Mesmo critério do dashboard.js: só "Despesa" conta como gasto.
function ehDespesa(mov) {
    return ehSaida(mov) && mov.natureza === "Despesa";
}

// ---------------- SALDO ATUAL ----------------
// Cópia fiel da regra do dashboard.js (Saldo Disponível), pra o número
// que o "Posso gastar?" usa ser SEMPRE o mesmo que aparece na tela inicial.

export function calcularSaldoDisponivel(movimentacoes) {

    let saldo = 0;

    movimentacoes.forEach(mov => {

        const valor = Number(mov.valor) || 0;

        if (mov.natureza === "Transferência") {
            saldo += mov.tipo === "Entrada" ? valor : -valor;
            return;
        }

        if (mov.natureza === "RendimentoMeta" || mov.natureza === "Rendimento") return;

        if (mov.natureza === "Resgate") {
            saldo += valor;
            return;
        }

        if (mov.tipo === "Entrada") {
            saldo += valor;
            return;
        }

        if (["Despesa", "Reserva", "Investimento", "Meta"].includes(mov.natureza)) {
            saldo -= valor;
        }
    });

    return arredondar(saldo);
}

// ---------------- PLANEJAMENTO ----------------
// Formato guardado no Firestore (chave "planejamento"):
// {
//   confirmado: true,           // false = ainda são os valores sugeridos
//   rendaMensal: 709,
//   limiteLazer: 129,
//   categoriasLazer: ["Lazer", "Namoro"],
//   aportes:      [{ metaId, nome, valor, dia }],
//   obrigacoes:   [{ id, nome, valor, categoria, dia }],
//   recebimentos: [{ id, nome, valor, categoria, dia }]
// }
// "dia" = dia do mês (1–31) ou null quando não informado.

const PALAVRAS_LAZER = ["lazer", "namoro", "entretenimento", "diversao", "cinema", "festa", "balada", "role"];

export function categoriasDeSaida(categorias) {
    const lista = Array.isArray(categorias?.saida) ? categorias.saida : [];
    return lista
        .filter(c => c && c.natureza === "Despesa")
        .map(c => c.nome);
}

function achaCategoriaPorNome(nomes, alvo) {
    const n = normalizar(alvo);
    return nomes.find(nome => normalizar(nome) === n) || "";
}

// Valores sugeridos na primeira vez (os mesmos que você passou no pedido).
// Nada é salvo até você tocar em "Salvar planejamento".
export function planejamentoPadrao(metas, categorias) {

    const nomes = categoriasDeSaida(categorias);

    const categoriasLazer = nomes.filter(nome => {
        const n = normalizar(nome);
        return PALAVRAS_LAZER.some(p => n.includes(p));
    });

    const metaCnh = (metas || []).find(m => normalizar(m.nome).includes("cnh"));
    const metaReserva = (metas || []).find(m => normalizar(m.nome) === "reserva")
        || (metas || []).find(m => normalizar(m.nome).includes("reserva"));

    const aportes = [];

    if (metaCnh) aportes.push({ metaId: metaCnh.id, nome: metaCnh.nome, valor: 100, dia: null });
    if (metaReserva) aportes.push({ metaId: metaReserva.id, nome: metaReserva.nome, valor: 50, dia: null });

    return {
        confirmado: false,
        rendaMensal: 709,
        limiteLazer: 129,
        categoriasLazer,
        aportes,
        obrigacoes: [
            { id: 1, nome: "Consórcio", valor: 245, categoria: achaCategoriaPorNome(nomes, "Consórcio"), dia: null },
            { id: 2, nome: "Boxe", valor: 100, categoria: achaCategoriaPorNome(nomes, "Boxe"), dia: null },
            { id: 3, nome: "Cabelo + telefone", valor: 85, categoria: "", dia: null }
        ],
        recebimentos: [
            { id: 1, nome: "Recebimento 1", valor: 324, categoria: "", dia: null },
            { id: 2, nome: "Recebimento 2", valor: 385, categoria: "", dia: null }
        ]
    };
}

// ---------------- CÁLCULO DO MÊS ----------------

function gastoDaCategoriaNoMes(movs, categoria, inicio, fim) {
    return movs
        .filter(m => ehDespesa(m) && m.categoria === categoria && noPeriodo(m, inicio, fim))
        .reduce((s, m) => s + Number(m.valor), 0);
}

function aportadoNoMes(movs, aporte, inicio, fim) {
    return movs
        .filter(m => noPeriodo(m, inicio, fim) && ehSaida(m) && (
            (m.natureza === "Meta" && aporte.metaId != null && String(m.metaId) === String(aporte.metaId)) ||
            // categorias antigas "CNH"/"Reserva" com natureza Reserva
            (m.natureza === "Reserva" && normalizar(m.categoria) === normalizar(aporte.nome))
        ))
        .reduce((s, m) => s + Number(m.valor), 0);
}

// Quanto de cada recebimento previsto já entrou no mês. Entradas de uma
// categoria vão sendo "consumidas" pelos recebimentos em ordem de dia.
function situacaoRecebimentos(movs, recebimentos, inicio, fim) {

    const entradas = movs.filter(m =>
        m.tipo === "Entrada" && m.natureza === "Entrada" && noPeriodo(m, inicio, fim)
    );

    const usadoPorChave = {};

    const ordenados = [...recebimentos].sort((a, b) => (a.dia ?? 99) - (b.dia ?? 99));

    return ordenados.map(rec => {

        const chave = rec.categoria || "*";

        const totalPool = entradas
            .filter(m => chave === "*" || m.categoria === chave)
            .reduce((s, m) => s + Number(m.valor), 0);

        const jaUsado = usadoPorChave[chave] || 0;
        const recebido = Math.max(0, Math.min(Number(rec.valor), totalPool - jaUsado));

        usadoPorChave[chave] = jaUsado + recebido;

        return {
            ...rec,
            recebido: arredondar(recebido),
            pendente: arredondar(Number(rec.valor) - recebido)
        };
    });
}

function diaValido(dia, ultimoDia) {
    const n = Number(dia);
    if (!Number.isFinite(n) || n < 1) return null;
    return Math.min(Math.floor(n), ultimoDia);
}

export function calcularSituacao({ movimentacoes, planejamento, orcamentos = [], hoje = new Date() }) {

    const { inicio, fim, ultimoDia } = limitesDoMes(hoje);
    const diaHoje = hoje.getDate();
    const hojeISO = paraISO(hoje);

    const movs = movimentacoes || [];
    const plano = planejamento;

    const avisos = [];

    // ---- saldo ----
    const saldo = calcularSaldoDisponivel(movs);

    // ---- obrigações ainda não pagas ----
    const obrigacoes = (plano.obrigacoes || []).map(obr => {

        const valor = Number(obr.valor) || 0;
        let pago = 0;

        if (obr.categoria) {
            pago = Math.min(valor, gastoDaCategoriaNoMes(movs, obr.categoria, inicio, fim));
        } else if (valor > 0) {
            avisos.push(`Defina a categoria de "${obr.nome}" para eu saber quando ela for paga (por enquanto conto como pendente).`);
        }

        const dia = diaValido(obr.dia, ultimoDia);

        return {
            tipo: "obrigacao",
            nome: obr.nome,
            valor,
            pago: arredondar(pago),
            pendente: arredondar(valor - pago),
            dia,
            atrasada: dia !== null && dia < diaHoje && valor - pago > 0
        };
    });

    // ---- aportes de meta ainda não feitos ----
    const aportes = (plano.aportes || []).map(ap => {

        const valor = Number(ap.valor) || 0;
        const feito = Math.min(valor, aportadoNoMes(movs, ap, inicio, fim));

        return {
            tipo: "aporte",
            nome: `Aporte ${ap.nome}`,
            valor,
            pago: arredondar(feito),
            pendente: arredondar(valor - feito),
            dia: diaValido(ap.dia, ultimoDia),
            atrasada: false
        };
    });

    // ---- recebimentos previstos ----
    const recebimentos = situacaoRecebimentos(movs, plano.recebimentos || [], inicio, fim)
        .map(rec => ({ ...rec, dia: diaValido(rec.dia, ultimoDia) }));

    const recebimentosPendentes = recebimentos.filter(r => r.pendente > 0);

    if (recebimentosPendentes.some(r => r.dia === null)) {
        avisos.push("Informe o dia de cada recebimento previsto. Sem o dia, eu só conto esse dinheiro como disponível no fim do mês.");
    }

    // ---- linha do tempo ----
    // Pagamentos pendentes SEM dia (ou já atrasados) são tratados como
    // "vencendo hoje": o dinheiro já fica reservado, por segurança.
    // Recebimentos pendentes SEM dia (ou atrasados) só entram no último
    // dia do mês: não se conta com dinheiro que não se sabe quando chega.

    const pagamentosPendentes = [...obrigacoes, ...aportes].filter(p => p.pendente > 0);

    let saldoInicial = saldo;
    const eventos = [];

    pagamentosPendentes.forEach(p => {

        if (p.dia === null || p.dia <= diaHoje) {
            saldoInicial -= p.pendente;
        } else {
            eventos.push({ ordem: p.dia, delta: -p.pendente });
        }
    });

    recebimentosPendentes.forEach(r => {

        if (r.dia !== null && r.dia >= diaHoje) {
            // 0.5: entra DEPOIS dos pagamentos do mesmo dia (mais seguro)
            eventos.push({ ordem: r.dia + 0.5, delta: r.pendente });
        } else {
            eventos.push({ ordem: ultimoDia + 0.5, delta: r.pendente });
        }
    });

    eventos.sort((a, b) => a.ordem - b.ordem);

    let corrente = saldoInicial;
    let pontoMaisBaixo = saldoInicial;

    eventos.forEach(ev => {
        corrente += ev.delta;
        pontoMaisBaixo = Math.min(pontoMaisBaixo, corrente);
    });

    const saldoProjetadoFimMes = arredondar(corrente);
    const dinheiroLivre = arredondar(pontoMaisBaixo);

    // ---- próximo recebimento ----
    let diasAteProximoRecebimento = null;
    let proximoRecebimento = null;

    const futuros = recebimentosPendentes
        .filter(r => r.dia !== null && r.dia >= diaHoje)
        .sort((a, b) => a.dia - b.dia);

    if (futuros.length > 0) {

        proximoRecebimento = futuros[0];
        diasAteProximoRecebimento = futuros[0].dia - diaHoje;

    } else if (recebimentosPendentes.length === 0) {

        // tudo deste mês já entrou: o próximo é o primeiro do mês que vem
        const dias = recebimentos.map(r => r.dia).filter(d => d !== null).sort((a, b) => a - b);

        if (dias.length > 0) {
            diasAteProximoRecebimento = (ultimoDia - diaHoje) + dias[0];
        }
    }

    // ---- lazer ----
    const categoriasLazer = plano.categoriasLazer || [];

    const gastoLazer = movs
        .filter(m => ehDespesa(m) && categoriasLazer.includes(m.categoria) && noPeriodo(m, inicio, fim))
        .reduce((s, m) => s + Number(m.valor), 0);

    const limiteLazer = plano.limiteLazer === null || plano.limiteLazer === undefined || plano.limiteLazer === ""
        ? null
        : Number(plano.limiteLazer);

    return {
        hojeISO,
        diaHoje,
        ultimoDia,
        mes: { inicio, fim },
        saldo,
        rendaMensal: plano.rendaMensal === "" || plano.rendaMensal == null ? null : Number(plano.rendaMensal),
        obrigacoes,
        aportes,
        recebimentos,
        pagamentosPendentes,
        recebimentosPendentes,
        totalObrigacoesPendentes: arredondar(obrigacoes.reduce((s, o) => s + o.pendente, 0)),
        totalAportesPendentes: arredondar(aportes.reduce((s, a) => s + a.pendente, 0)),
        totalAReceber: arredondar(recebimentosPendentes.reduce((s, r) => s + r.pendente, 0)),
        dinheiroLivre,
        saldoProjetadoFimMes,
        diasAteProximoRecebimento,
        proximoRecebimento,
        lazer: {
            limite: limiteLazer,
            gasto: arredondar(gastoLazer),
            disponivel: limiteLazer === null ? null : arredondar(limiteLazer - gastoLazer)
        },
        avisos: [...new Set(avisos)],
        _orcamentos: orcamentos,
        _movs: movs,
        _plano: plano,
        _hoje: hoje
    };
}

// ---------------- ANÁLISE DE UM GASTO ----------------

function orcamentoAtivoDaCategoria(orcamentos, movs, categoria, hojeISO) {

    const orc = (orcamentos || []).find(o =>
        o.categoria === categoria &&
        o.dataInicio && o.dataFim &&
        hojeISO >= o.dataInicio && hojeISO <= o.dataFim &&
        Number(o.limite) > 0
    );

    if (!orc) return null;

    const gasto = movs
        .filter(m => ehDespesa(m) && m.categoria === categoria && noPeriodo(m, orc.dataInicio, orc.dataFim))
        .reduce((s, m) => s + Number(m.valor), 0);

    return { limite: Number(orc.limite), gasto: arredondar(gasto), disponivel: arredondar(Number(orc.limite) - gasto) };
}

// categoria: GRUPO_LAZER, o nome de uma categoria, ou "" (outra / sem limite)
export function analisarGasto(situacao, valorPedido, categoria = GRUPO_LAZER) {

    const valor = arredondar(valorPedido);
    const faltando = [];

    const ehLazer = categoria === GRUPO_LAZER || (situacao._plano.categoriasLazer || []).includes(categoria);

    let orcamento = null;
    let rotuloCategoria = "";

    if (ehLazer) {

        rotuloCategoria = "Lazer";

        if (situacao.lazer.limite === null) {
            faltando.push("Orçamento mensal de lazer");
        } else {
            orcamento = situacao.lazer;
        }

    } else if (categoria) {

        rotuloCategoria = categoria;
        orcamento = orcamentoAtivoDaCategoria(situacao._orcamentos, situacao._movs, categoria, situacao.hojeISO);

    } else {
        rotuloCategoria = "Sem categoria definida";
    }

    const incompletas = (situacao._plano.obrigacoes || []).some(o => !(Number(o.valor) > 0));
    if (incompletas) faltando.push("Valor de uma das obrigações fixas");

    if (!(valor > 0)) faltando.push("Valor que você pretende gastar");

    // ---------------- sem dados suficientes ----------------
    if (faltando.length > 0) {
        return {
            nivel: NIVEL.FALTAM_DADOS,
            faltando,
            valor,
            categoria: rotuloCategoria
        };
    }

    const livreAntes = situacao.dinheiroLivre;
    const categoriaAntes = orcamento ? orcamento.disponivel : null;

    // O limite é o MENOR entre o dinheiro livre da linha do tempo e o
    // que ainda resta no orçamento da categoria.
    const restanteAntes = categoriaAntes === null ? livreAntes : Math.min(livreAntes, categoriaAntes);

    const livreDepois = arredondar(livreAntes - valor);
    const categoriaDepois = categoriaAntes === null ? null : arredondar(categoriaAntes - valor);
    const restanteDepois = arredondar(restanteAntes - valor);

    const referencia = orcamento ? orcamento.limite : (situacao.rendaMensal || 0);
    const margem = restanteDepois;

    let nivel;
    let motivo;

    if (livreAntes <= 0) {
        nivel = NIVEL.NAO;
        motivo = "sem-folga";
    } else if (livreDepois < 0) {
        nivel = NIVEL.NAO;
        motivo = "compromete-contas";
    } else if (categoriaDepois !== null && categoriaDepois < 0) {
        nivel = NIVEL.NAO;
        motivo = "estoura-categoria";
    } else if (referencia > 0 && margem < referencia * 0.15) {
        nivel = NIVEL.CUIDADO;
        motivo = "aperta";
    } else {
        nivel = NIVEL.PODE;
        motivo = "ok";
    }

    const limiteSeguro = Math.max(0, restanteAntes);

    let limiteSeguroPorDia = null;

    if (situacao.diasAteProximoRecebimento !== null) {
        limiteSeguroPorDia = arredondar(limiteSeguro / Math.max(1, situacao.diasAteProximoRecebimento));
    }

    return {
        nivel,
        motivo,
        valor,
        categoria: rotuloCategoria,
        temOrcamentoCategoria: orcamento !== null,
        orcamento,
        categoriaAntes,
        categoriaDepois,
        livreAntes,
        livreDepois,
        restanteAntes: arredondar(restanteAntes),
        restanteDepois,
        limiteSeguro: arredondar(limiteSeguro),
        limiteSeguroPorDia,
        proximasObrigacoes: [...situacao.pagamentosPendentes]
            .sort((a, b) => (a.dia ?? 0) - (b.dia ?? 0))
            .slice(0, 4)
    };
}

// Resposta pra "Quanto posso gastar?" (sem valor).
export function limiteSeguro(situacao, categoria = GRUPO_LAZER) {

    const base = analisarGasto(situacao, 0.01, categoria);

    if (base.nivel === NIVEL.FALTAM_DADOS) {
        return { faltando: base.faltando.filter(f => !f.startsWith("Valor que você")) };
    }

    return {
        faltando: [],
        limite: base.limiteSeguro,
        porDia: base.limiteSeguroPorDia,
        categoria: base.categoria
    };
}

// ---------------- LINGUAGEM NATURAL ----------------

const PALAVRAS_CATEGORIA = [
    { grupo: GRUPO_LAZER, palavras: ["sair", "namoro", "namorada", "namorado", "cinema", "bar", "festa", "balada", "lazer", "passeio", "role", "encontro", "jantar", "show", "entretenimento"] },
    { nomeContem: "mercado", palavras: ["mercado", "supermercado", "feira"] },
    { nomeContem: "uber", palavras: ["uber", "99", "corrida", "taxi"] },
    { nomeContem: "aliment", palavras: ["lanche", "ifood", "restaurante", "almoco", "comida", "pizza", "hamburguer"] },
    { nomeContem: "roupa", palavras: ["roupa", "tenis", "camisa", "calca"] }
];

export function lerValor(textoNormalizado) {

    const achado = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/.exec(textoNormalizado);

    if (!achado) return null;

    let bruto = achado[1];

    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(bruto)) {
        bruto = bruto.replace(/\./g, "").replace(",", ".");
    } else {
        bruto = bruto.replace(",", ".");
    }

    const numero = Number(bruto);

    return Number.isFinite(numero) && numero > 0 ? numero : null;
}

export function interpretarPergunta(texto, nomesCategorias = []) {

    const t = normalizar(texto);

    const valor = lerValor(t);

    // categoria sugerida pelas palavras da frase
    let categoria = GRUPO_LAZER;

    for (const regra of PALAVRAS_CATEGORIA) {

        if (!regra.palavras.some(p => new RegExp(`\\b${p}\\b`).test(t))) continue;

        if (regra.grupo) {
            categoria = regra.grupo;
            break;
        }

        const nome = nomesCategorias.find(n => normalizar(n).includes(regra.nomeContem));

        if (nome) {
            categoria = nome;
            break;
        }
    }

    const perguntaLimite = /\bquanto\b/.test(t);

    if (valor === null) {
        return {
            tipo: perguntaLimite ? "limite" : "sem-valor",
            periodo: /\b(mes|mensal)\b/.test(t) ? "mes" : "hoje",
            categoria
        };
    }

    return {
        tipo: perguntaLimite && !/\bposso\b|\bda pra\b|\bdá pra\b/.test(t) ? "limite" : "verificar",
        valor,
        categoria,
        periodo: "hoje"
    };
}
