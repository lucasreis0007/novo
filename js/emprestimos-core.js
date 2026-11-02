// ---------------- EMPRÉSTIMOS (lógica compartilhada) ----------------
// Funções puras (sem Firebase, sem tela) usadas por Adicionar, Histórico,
// Calendário, Dashboard, Relatórios e pela página Empréstimos.
//
// Como um empréstimo é guardado (tudo dentro de "movimentacoes"):
//
//  • Lançamento do empréstimo (natureza "Empréstimo"), com
//    emprestimoId = id do próprio lançamento:
//      - Emprestei (direcao "dado"):    tipo Saída  — o dinheiro sai da conta
//      - Peguei emprestado ("recebido"): tipo Entrada — o dinheiro entra na conta
//    Campos extras: pessoa, dataPrevista.
//
//  • Devolução (natureza "DevolucaoEmprestimo"), com emprestimoId:
//      - quando a pessoa me paga: tipo Entrada na conta que recebeu
//      - quando eu pago o que devo: tipo Saída da conta de onde saiu
//    Aceita pagamento parcial: o saldo em aberto vai caindo.
//
//  • Perdão (natureza "PerdaoEmprestimo"). Nunca mexe em conta (banco ""):
//      - de quem me devia (direcao "dado"): conta como perda (despesa);
//      - da minha dívida (direcao "recebido"): só baixa o saldo devedor, sem
//        contar como receita nem como gasto.
//
// Nada disso conta como receita nem como gasto comum: é dinheiro que só
// muda de dono por um tempo.

export const NATUREZA_EMPRESTIMO = "Empréstimo";
export const NATUREZA_DEVOLUCAO = "DevolucaoEmprestimo";
export const NATUREZA_PERDAO = "PerdaoEmprestimo";

export const NATUREZAS_EMPRESTIMO = [NATUREZA_EMPRESTIMO, NATUREZA_DEVOLUCAO, NATUREZA_PERDAO];

export function ehMovEmprestimo(mov) {
    return Boolean(mov) && NATUREZAS_EMPRESTIMO.includes(mov.natureza);
}

// Empréstimo e devolução só trocam dinheiro de lugar: ficam fora de
// entradas, despesas e orçamentos. O perdão é a única parte que é perda.
export function ehMovEmprestimoNeutro(mov) {
    return Boolean(mov) && (
        mov.natureza === NATUREZA_EMPRESTIMO ||
        mov.natureza === NATUREZA_DEVOLUCAO ||
        ehDividaPerdoada(mov)
    );
}

// Perdão de uma dívida MINHA (peguei emprestado e a pessoa perdoou): só baixa
// o saldo devedor. Não é receita nem gasto e não mexe em nenhuma conta.
export function ehDividaPerdoada(mov) {
    return Boolean(mov) && mov.natureza === NATUREZA_PERDAO && mov.direcao === "recebido";
}

// Perdão de quem ME devia: o que faltava vira perda (despesa).
export function ehPerdaEmprestimo(mov) {
    return Boolean(mov) && mov.natureza === NATUREZA_PERDAO && !ehDividaPerdoada(mov);
}

function arredondar(valor) {
    return Math.round(Number(valor) * 100) / 100;
}

export function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarDataBR(dataISO) {
    if (!dataISO) return "";
    return String(dataISO).split("-").reverse().join("/");
}

// ---------------- LISTA DE EMPRÉSTIMOS ----------------
// Monta, a partir das movimentações, um registro por empréstimo com o que
// já foi devolvido, o que foi perdoado e o saldo em aberto.

export function listarEmprestimos(movimentacoes) {

    const mapa = new Map();

    (movimentacoes || []).forEach(mov => {

        if (mov.natureza !== NATUREZA_EMPRESTIMO) return;

        const id = mov.emprestimoId != null ? mov.emprestimoId : mov.id;

        mapa.set(String(id), {
            id,
            movimentacaoId: mov.id,
            direcao: mov.direcao || (mov.tipo === "Entrada" ? "recebido" : "dado"),
            pessoa: mov.pessoa || "",
            valor: Number(mov.valor) || 0,
            data: mov.data || "",
            dataPrevista: mov.dataPrevista || "",
            banco: mov.banco || "",
            descricao: mov.descricao || "",
            devolvido: 0,
            perdoado: 0,
            devolucoes: []
        });
    });

    (movimentacoes || []).forEach(mov => {

        if (mov.natureza !== NATUREZA_DEVOLUCAO && mov.natureza !== NATUREZA_PERDAO) return;

        const emprestimo = mapa.get(String(mov.emprestimoId));

        if (!emprestimo) return;

        if (mov.natureza === NATUREZA_DEVOLUCAO) {
            emprestimo.devolvido = arredondar(emprestimo.devolvido + Number(mov.valor));
            emprestimo.devolucoes.push(mov);
        } else {
            emprestimo.perdoado = arredondar(emprestimo.perdoado + Number(mov.valor));
        }
    });

    const lista = [...mapa.values()];

    lista.forEach(emprestimo => {

        emprestimo.saldo = Math.max(0, arredondar(emprestimo.valor - emprestimo.devolvido - emprestimo.perdoado));

        if (emprestimo.saldo <= 0.004) {
            emprestimo.saldo = 0;
            emprestimo.status = emprestimo.perdoado > 0 ? "perdoado" : "quitado";
        } else {
            emprestimo.status = emprestimo.devolvido > 0 ? "parcial" : "aberto";
        }
    });

    return lista;
}

export function emprestimoEmAberto(emprestimo) {
    return emprestimo.saldo > 0;
}

export function acharEmprestimo(movimentacoes, emprestimoId) {
    return listarEmprestimos(movimentacoes).find(e => String(e.id) === String(emprestimoId)) || null;
}

// Totais "a receber" (o que me devem) e "a pagar" (o que eu devo).
export function totaisEmprestimos(movimentacoes) {

    let aReceber = 0;
    let aPagar = 0;

    listarEmprestimos(movimentacoes).forEach(emprestimo => {
        if (emprestimo.direcao === "dado") aReceber += emprestimo.saldo;
        else aPagar += emprestimo.saldo;
    });

    return { aReceber: arredondar(aReceber), aPagar: arredondar(aPagar) };
}

// ---------------- LANÇAMENTOS ----------------

export function categoriaDoEmprestimo(direcao, pessoa) {
    return direcao === "dado" ? `Empréstimo para ${pessoa}` : `Empréstimo de ${pessoa}`;
}

export function categoriaDaDevolucao(direcao, pessoa) {
    return direcao === "dado" ? `Devolução de ${pessoa}` : `Pagamento a ${pessoa}`;
}

export function categoriaDoPerdao(pessoa, direcao) {
    return direcao === "recebido"
        ? `Dívida perdoada por ${pessoa}`
        : `Perdão de empréstimo: ${pessoa}`;
}

// Ids que devem sair juntos quando um lançamento é excluído: apagar o
// empréstimo em si leva as devoluções e perdões dele junto.
export function idsParaExcluir(mov, movimentacoes) {

    if (!mov) return [];

    if (mov.natureza === NATUREZA_EMPRESTIMO) {

        const idEmprestimo = mov.emprestimoId != null ? mov.emprestimoId : mov.id;

        return (movimentacoes || [])
            .filter(m =>
                String(m.id) === String(mov.id) ||
                (ehMovEmprestimo(m) && String(m.emprestimoId) === String(idEmprestimo))
            )
            .map(m => m.id);
    }

    return [mov.id];
}

// ---------------- LEMBRETES DE COBRANÇA / PAGAMENTO ----------------
// O lembrete (Calendário e Dashboard) é sempre um reflexo do empréstimo:
// existe enquanto há saldo e data prevista, mostra o saldo que falta e some
// quando o empréstimo é quitado, perdoado ou excluído.

export function sincronizarLembretesEmprestimo(movimentacoes, lembretes) {

    const lista = listarEmprestimos(movimentacoes);

    let resultado = Array.isArray(lembretes) ? lembretes.map(l => ({ ...l })) : [];

    const doEmprestimo = (lembrete, emprestimo) =>
        (lembrete.emprestimoId != null && String(lembrete.emprestimoId) === String(emprestimo.id)) ||
        (lembrete.movimentacaoId != null && String(lembrete.movimentacaoId) === String(emprestimo.movimentacaoId));

    // lembretes de empréstimos que não existem mais
    resultado = resultado.filter(lembrete =>
        lembrete.emprestimoId == null || lista.some(e => doEmprestimo(lembrete, e))
    );

    let contador = 0;

    lista.forEach(emprestimo => {

        const indice = resultado.findIndex(l => doEmprestimo(l, emprestimo));

        const precisa = emprestimo.saldo > 0 && Boolean(emprestimo.dataPrevista);

        if (!precisa) {
            if (indice !== -1) resultado.splice(indice, 1);
            return;
        }

        const dado = emprestimo.direcao === "dado";

        const dados = {
            titulo: dado ? `Receber de ${emprestimo.pessoa}` : `Pagar a ${emprestimo.pessoa}`,
            devedor: emprestimo.pessoa,
            valor: emprestimo.saldo,
            recorrente: false,
            data: emprestimo.dataPrevista,
            observacao: `Empréstimo de ${formatarMoeda(emprestimo.valor)} ${dado ? "feito" : "recebido"} em ${formatarDataBR(emprestimo.data)}` +
                (emprestimo.saldo < emprestimo.valor ? `. Falta ${formatarMoeda(emprestimo.saldo)}.` : ""),
            tipoLembrete: dado ? "receber" : "pagar",
            movimentacaoId: emprestimo.movimentacaoId,
            emprestimoId: emprestimo.id
        };

        if (indice === -1) {
            contador += 1;
            resultado.push({ id: Date.now() + contador, pagamentos: {}, ...dados });
        } else {
            resultado[indice] = { ...resultado[indice], ...dados, pagamentos: {} };
        }
    });

    return resultado;
}

// ---------------- EMPRÉSTIMOS ANTIGOS ----------------
// Antes desta função, emprestar era um lançamento de Despesa numa categoria
// com "empréstimo" no nome, com um lembrete "receber" ligado. Aqui achamos
// esses lançamentos e os convertemos para o formato novo.

function semAcento(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

export function acharEmprestimosAntigos(movimentacoes) {

    return (movimentacoes || []).filter(mov =>
        mov.tipo === "Saída" &&
        mov.natureza === "Despesa" &&
        mov.emprestimoId == null &&
        semAcento(mov.categoria).includes("emprestimo")
    );
}

// Devolve { movimentacoes, lembretes, convertidos } com tudo convertido.
// A pessoa vem do lembrete que existia; sem lembrete, da descrição.
export function converterEmprestimosAntigos(movimentacoes, lembretes) {

    const antigos = acharEmprestimosAntigos(movimentacoes);

    const idsAntigos = new Set(antigos.map(m => String(m.id)));

    const resultado = movimentacoes.map(mov => ({ ...mov }));

    antigos.forEach(antigo => {

        const lembrete = (lembretes || []).find(l => String(l.movimentacaoId) === String(antigo.id));

        const pessoa = (lembrete && (lembrete.devedor || "").trim()) ||
            (antigo.descricao || "").trim() ||
            "Não informado";

        const destino = resultado.find(m => m.id === antigo.id);

        destino.natureza = NATUREZA_EMPRESTIMO;
        destino.emprestimoId = antigo.id;
        destino.direcao = "dado";
        destino.pessoa = pessoa;
        destino.dataPrevista = (lembrete && lembrete.data) || "";
        destino.categoria = categoriaDoEmprestimo("dado", pessoa);

        // devoluções que foram lançadas ao marcar o lembrete como pago
        resultado.forEach(mov => {

            if (!lembrete) return;
            if (mov.tipo !== "Entrada" || mov.natureza !== "Entrada") return;
            if (String(mov.lembreteId) !== String(lembrete.id)) return;

            mov.natureza = NATUREZA_DEVOLUCAO;
            mov.emprestimoId = antigo.id;
            mov.categoria = categoriaDaDevolucao("dado", pessoa);
        });
    });

    return {
        movimentacoes: resultado,
        lembretes: sincronizarLembretesEmprestimo(resultado, lembretes),
        convertidos: idsAntigos.size
    };
}

// ---------------- CATEGORIA "EMPRÉSTIMO" ----------------
// Categorias de saída com natureza "Empréstimo" são as que abrem o
// formulário de quem vai pagar. Categorias antigas com "empréstimo" no
// nome (natureza Despesa) são convertidas, e se não existir nenhuma uma
// padrão é criada. Devolve true se mudou alguma coisa.

export function garantirCategoriaEmprestimo(categorias) {

    if (!categorias || !Array.isArray(categorias.saida)) return false;

    let mudou = false;

    categorias.saida.forEach(cat => {
        if (cat && cat.natureza === "Despesa" && semAcento(cat.nome).includes("emprestimo")) {
            cat.natureza = NATUREZA_EMPRESTIMO;
            mudou = true;
        }
    });

    if (!categorias.saida.some(cat => cat && cat.natureza === NATUREZA_EMPRESTIMO)) {

        const nomeLivre = !categorias.saida.some(cat => cat && cat.nome === "Empréstimo");

        categorias.saida.push({ nome: nomeLivre ? "Empréstimo" : "Empréstimo (dado)", natureza: NATUREZA_EMPRESTIMO });
        mudou = true;
    }

    return mudou;
}
