import { protegerPagina, carregarDados, criarArmazenamento, sair, iconeCategoria } from "./utils.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

const movimentacoes =
    JSON.parse(localStorage.getItem("movimentacoes")) || [];

let saldoDisponivel = 0;
let patrimonioTotal = 0;

let entradas = 0;
let despesas = 0;
let reservas = 0;
let investimentos = 0;

movimentacoes.forEach((mov) => {

    // Transferência entre contas próprias: dinheiro sai de um banco e
    // entra em outro, mas não é receita nem despesa de verdade, então
    // não deve contar em "entradas"/"despesas" — só passa pelo saldo
    // disponível (que fica igual no total, já que uma perna soma e a
    // outra subtrai o mesmo valor).
    if (mov.natureza === "Transferência") {

        if (mov.tipo === "Entrada") {
            saldoDisponivel += mov.valor;
        } else {
            saldoDisponivel -= mov.valor;
        }

        return;
    }

    // Rendimento: dinheiro que a reserva já rendeu sozinha (juros,
    // rendimento de conta digital etc). Só soma na reserva — nunca
    // esteve no saldo disponível, então não mexe em banco nenhum.
    if (mov.natureza === "Rendimento") {
        reservas += mov.valor;
        return;
    }

    if (mov.tipo === "Entrada") {

        entradas += mov.valor;

        saldoDisponivel += mov.valor;

    } else {

        switch (mov.natureza) {

            case "Despesa":
                despesas += mov.valor;
                saldoDisponivel -= mov.valor;
                break;

            case "Reserva":
                reservas += mov.valor;
                saldoDisponivel -= mov.valor;
                break;

            case "Investimento":
                investimentos += mov.valor;
                saldoDisponivel -= mov.valor;
                break;

            case "Resgate":
                // Dinheiro que já estava fora do saldo disponível (guardado na reserva)
                // volta a ser gasto: sai da reserva e entra como despesa,
                // sem mexer de novo no saldo disponível.
                reservas -= mov.valor;
                despesas += mov.valor;
                break;
        }

    }

});

patrimonioTotal =
    saldoDisponivel + reservas + investimentos;

function moeda(valor) {

    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

}

document.getElementById("patrimonioTotal").textContent = moeda(patrimonioTotal);
document.getElementById("saldoDisponivel").textContent = moeda(saldoDisponivel);

document.getElementById("totalEntradas").textContent = moeda(entradas);
document.getElementById("totalDespesas").textContent = moeda(despesas);
document.getElementById("totalReservas").textContent = moeda(reservas);
document.getElementById("totalInvestimentos").textContent = moeda(investimentos);

// ---------------- CONTAS (BANCOS) ----------------

function carregarBancos() {

    let bancos = JSON.parse(localStorage.getItem("bancos"));

    if (bancos === null) {

        bancos = [
            { id: 1, nome: "Nubank", emoji: "🟣", cor: 0 },
            { id: 2, nome: "Inter", emoji: "🟠", cor: 1 },
            { id: 3, nome: "Mercado Pago", emoji: "⚫", cor: 2 },
            { id: 4, nome: "Dinheiro", emoji: "🟢", cor: 3 }
        ];

        localStorage.setItem("bancos", JSON.stringify(bancos));
    }

    return bancos;
}

function calcularSaldoBanco(nomeBanco) {

    let saldo = 0;

    movimentacoes.forEach(mov => {

        if (mov.banco !== nomeBanco) return;

        if (mov.natureza === "Resgate") return;

        if (mov.tipo === "Entrada") {
            saldo += Number(mov.valor);
        } else {
            saldo -= Number(mov.valor);
        }

    });

    return saldo;
}

function renderizarContas() {

    const bancos = carregarBancos();
    const listaContas = document.getElementById("listaContas");

    listaContas.innerHTML = "";

    if (bancos.length === 0) {
        listaContas.innerHTML = `
            <div class="vazio">
                <h2>Nenhuma conta cadastrada.</h2>
                <p>Cadastre uma conta na página de Bancos.</p>
            </div>
        `;
        return;
    }

    bancos.forEach(banco => {

        const saldo = calcularSaldoBanco(banco.nome);

        const card = document.createElement("div");
        card.className = `conta cor-${banco.cor}`;

        card.innerHTML = `
            <div>
                <h3>${banco.emoji} ${banco.nome}</h3>
                <p>Saldo disponível</p>
            </div>
            <strong>${moeda(saldo)}</strong>
        `;

        listaContas.appendChild(card);
    });
}

renderizarContas();

// ---------------- METAS ----------------

function carregarMetas() {

    let metas = JSON.parse(localStorage.getItem("metas"));

    if (metas === null) {

        metas = [
            {
                id: 1,
                emoji: "🚗",
                nome: "CNH",
                valorObjetivo: 3000,
                valorAtual: 0
            },
            {
                id: 2,
                emoji: "🛡️",
                nome: "Reserva",
                valorObjetivo: 5000,
                valorAtual: 0
            }
        ];

        localStorage.setItem("metas", JSON.stringify(metas));
    }

    return metas;
}

function renderizarMetasDashboard() {

    const metas = carregarMetas();
    const listaMetasDash = document.getElementById("listaMetasDash");

    listaMetasDash.innerHTML = "";

    if (metas.length === 0) {
        listaMetasDash.innerHTML = `
            <div class="vazio">
                <h2>Nenhuma meta cadastrada.</h2>
                <p>Crie uma meta na página de Metas.</p>
            </div>
        `;
        return;
    }

    metas.forEach(meta => {

        const percentual = meta.valorObjetivo > 0
            ? Math.min(100, (meta.valorAtual / meta.valorObjetivo) * 100)
            : 0;

        const card = document.createElement("div");
        card.className = "meta";

        card.innerHTML = `
            <div class="meta-topo">
                <span>${meta.emoji} ${meta.nome}</span>
                <span>${percentual.toFixed(0)}%</span>
            </div>
            <div class="barra">
                <div class="progresso" style="width:${percentual}%"></div>
            </div>
        `;

        listaMetasDash.appendChild(card);
    });
}

renderizarMetasDashboard();

// ---------------- ÚLTIMAS MOVIMENTAÇÕES ----------------

function renderizarUltimasMovimentacoes() {

    const container = document.getElementById("ultimasMovimentacoes");

    const ultimas = [...movimentacoes]
        .sort((a, b) => b.id - a.id)
        .slice(0, 5);

    if (ultimas.length === 0) {
        container.innerHTML = `
            <p class="sem-movimentacoes">
                Nenhuma movimentação cadastrada.
            </p>
        `;
        return;
    }

    container.innerHTML = "";

    ultimas.forEach(mov => {

        let classe = "";
        let sinal = "";
        let textoNatureza = "";

        if (mov.natureza === "Transferência") {
            classe = mov.tipo === "Entrada" ? "entrada" : "despesa";
            sinal = mov.tipo === "Entrada" ? "⬇️" : "⬆️";
            textoNatureza = mov.tipo === "Entrada" ? "Transferência recebida" : "Transferência enviada";
        } else if (mov.tipo === "Entrada") {
            classe = "entrada";
            sinal = "+";
            textoNatureza = "Entrada";
        } else if (mov.natureza === "Despesa") {
            classe = "despesa";
            sinal = "-";
            textoNatureza = "Despesa";
        } else if (mov.natureza === "Reserva") {
            classe = "reserva";
            sinal = "🏦";
            textoNatureza = "Reserva";
        } else if (mov.natureza === "Rendimento") {
            classe = "reserva";
            sinal = "🌱";
            textoNatureza = "Rendimento da Reserva";
        } else if (mov.natureza === "Resgate") {
            classe = "despesa";
            sinal = "🏧";
            textoNatureza = "Retirada da Reserva";
        } else {
            classe = "investimento";
            sinal = "📈";
            textoNatureza = "Investimento";
        }

        const card = document.createElement("div");
        card.className = "movimentacao";

        card.innerHTML = `
            <div class="info">
                <h3>${iconeCategoria(mov.categoria)} ${mov.categoria}</h3>
                <p>${mov.descricao || "Sem descrição"}</p>
                <p>${mov.banco || "Direto na reserva"}</p>
                <p>${mov.data}</p>
                <p>${textoNatureza}</p>
            </div>
            <div class="valor ${classe}">
                ${sinal} ${moeda(mov.valor)}
            </div>
            <div class="acoesMov">
                <button class="btnEditar" data-id="${mov.id}" title="Editar">✏️</button>
                <button class="btnExcluir" data-id="${mov.id}" title="Excluir">🗑️</button>
            </div>
        `;

        container.appendChild(card);
    });

    container.querySelectorAll(".btnEditar").forEach(btn => {
        btn.addEventListener("click", () => {
            window.location.href = `adicionar.html?id=${btn.dataset.id}`;
        });
    });

    container.querySelectorAll(".btnExcluir").forEach(btn => {
        btn.addEventListener("click", async () => {
            const confirmar = confirm("Tem certeza que deseja excluir essa movimentação?");
            if (!confirmar) return;

            const id = Number(btn.dataset.id);
            let todasMovimentacoes = JSON.parse(localStorage.getItem("movimentacoes")) || [];
            todasMovimentacoes = todasMovimentacoes.filter(mov => mov.id !== id);

            // espera o Firestore confirmar antes de recarregar a página,
            // senão o reload cancela o salvamento no meio do caminho
            await localStorage.setItem("movimentacoes", JSON.stringify(todasMovimentacoes));

            window.location.reload();
        });
    });
}

renderizarUltimasMovimentacoes();

// ---------------- BOTÃO NOVA MOVIMENTAÇÃO ----------------

const botao = document.getElementById("novaMovimentacao");

if (botao) {

    botao.addEventListener("click", () => {

        window.location.href = "adicionar.html";

    });

}

// ======================================================================
// NOVOS RECURSOS DO DASHBOARD
// (Quanto gastei / Alertas inteligentes / Lembretes / Notificações)
//
// Tudo daqui pra baixo é código NOVO, adicionado sem alterar nenhum
// cálculo financeiro já existente acima (saldo, patrimônio, contas,
// metas, últimas movimentações). Só LÊ os mesmos dados (movimentacoes,
// orcamentos, metas, lembretes) que já estão salvos no Firestore através
// do "localStorage" simulado (criarArmazenamento), sem criar nenhum
// sistema de armazenamento paralelo.
// ======================================================================

// ---------------- HELPERS DE DATA (mesma lógica do calendario.js) ----------------

function formatarISODash(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function paraDataLocalDash(dataISO) {
    const [ano, mes, dia] = dataISO.split("-").map(Number);
    return new Date(ano, mes - 1, dia);
}

function primeiroDiaMesDash(data) {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-01`;
}

function ultimoDiaMesDash(data) {
    const ultimo = new Date(data.getFullYear(), data.getMonth() + 1, 0);
    return formatarISODash(ultimo);
}

function diasNoMesDash(data) {
    return new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
}

// Diferença em dias, INCLUSIVA (mesma data = 1 dia).
function diferencaEmDiasDash(inicioISO, fimISO) {
    const inicio = paraDataLocalDash(inicioISO);
    const fim = paraDataLocalDash(fimISO);
    return Math.round((fim - inicio) / 86400000) + 1;
}

const hojeDash = new Date();
const hojeDashISO = formatarISODash(hojeDash);

// ---------------- "GASTO" (mesmo critério usado no resto do app:
// Despesa OU Resgate contam como despesa — ver dashboard.js linha ~53
// e historico.js/relatorios.js, que usam a mesma regra) ----------------

function ehGastoDash(mov) {
    return mov.tipo !== "Entrada" && (mov.natureza === "Despesa" || mov.natureza === "Resgate");
}

function movimentacoesGastoNoPeriodoDash(inicioISO, fimISO) {
    return movimentacoes.filter(mov =>
        ehGastoDash(mov) && mov.data && mov.data >= inicioISO && mov.data <= fimISO
    );
}

function totalGastoDash(lista) {
    return lista.reduce((soma, mov) => soma + Number(mov.valor), 0);
}

// ---------------- RESUMO "QUANTO GASTEI" (versão enxuta no dashboard —
// o controle completo, com filtros de período e detalhamento por
// categoria, agora mora em gastos.html/gastos.js) ----------------

function atualizarResumoGastoDashboard() {

    const inicioMes = primeiroDiaMesDash(hojeDash);
    const fimMes = ultimoDiaMesDash(hojeDash);

    const gastosMes = movimentacoesGastoNoPeriodoDash(inicioMes, fimMes);
    const totalMes = totalGastoDash(gastosMes);

    document.getElementById("gastoResumoValor").textContent = moeda(totalMes);

    // comparação com o mesmo trecho (até hoje) do mês anterior
    const mesAnt = new Date(hojeDash.getFullYear(), hojeDash.getMonth() - 1, 1);
    const inicioMesAnt = primeiroDiaMesDash(mesAnt);
    const diaEquivalenteAnt = Math.min(hojeDash.getDate(), diasNoMesDash(mesAnt));
    const fimMesAntEquivalente = formatarISODash(new Date(mesAnt.getFullYear(), mesAnt.getMonth(), diaEquivalenteAnt));

    const gastoMesAtualAteHoje = totalGastoDash(
        movimentacoesGastoNoPeriodoDash(inicioMes, hojeDashISO)
    );
    const gastoMesAnteriorEquivalente = totalGastoDash(
        movimentacoesGastoNoPeriodoDash(inicioMesAnt, fimMesAntEquivalente)
    );

    const elComparacao = document.getElementById("gastoResumoComparacao");

    if (gastoMesAnteriorEquivalente === 0) {
        elComparacao.textContent = gastoMesAtualAteHoje > 0
            ? "Sem dados do mês anterior para comparar."
            : "Sem dados suficientes para comparar ainda.";
    } else {
        const diferenca = gastoMesAtualAteHoje - gastoMesAnteriorEquivalente;
        const percentual = (diferenca / gastoMesAnteriorEquivalente) * 100;
        const subiu = diferenca > 0;
        const ficouIgual = diferenca === 0;

        elComparacao.textContent = ficouIgual
            ? "Igual ao mesmo período do mês anterior."
            : `${subiu ? "🔺" : "🔻"} ${Math.abs(percentual).toFixed(0)}% ${subiu ? "a mais" : "a menos"} que no mesmo período do mês anterior.`;
    }
}

// ======================================================================
// LEMBRETES (reaproveita a mesma lógica de ocorrência/pagamento do
// calendario.js — recorrente por dia do mês, com "pagamentos" por chave
// de ocorrência — só que aqui a gente só LÊ pra decidir o que mostrar).
// ======================================================================

function diaEfetivoLembreteDash(lembrete, ano, mesIndex) {
    return Math.min(lembrete.diaDoMes, new Date(ano, mesIndex + 1, 0).getDate());
}

function chaveOcorrenciaDash(lembrete, dataISO) {
    if (!lembrete.recorrente) return lembrete.data;
    const [ano, mes] = dataISO.split("-");
    return `${ano}-${mes}`;
}

function lembreteEstaPagoDash(lembrete, dataISO) {
    if (!lembrete.pagamentos) return false;
    return !!lembrete.pagamentos[chaveOcorrenciaDash(lembrete, dataISO)];
}

// Pra cada lembrete, acha a ocorrência relevante mais próxima: se a
// desse mês ainda não foi paga, é essa (mesmo que já tenha passado =
// atrasada). Se já foi paga, mostra a do próximo mês (só faz sentido
// pra recorrentes).
function proximaOcorrenciaLembreteDash(lembrete) {

    if (!lembrete.recorrente) {
        return { data: lembrete.data, pago: lembreteEstaPagoDash(lembrete, lembrete.data) };
    }

    const ano = hojeDash.getFullYear();
    const mes = hojeDash.getMonth();

    const diaEsteMes = diaEfetivoLembreteDash(lembrete, ano, mes);
    const dataEsteMes = formatarISODash(new Date(ano, mes, diaEsteMes));

    if (!lembreteEstaPagoDash(lembrete, dataEsteMes)) {
        return { data: dataEsteMes, pago: false };
    }

    const proxMes = new Date(ano, mes + 1, 1);
    const diaProxMes = diaEfetivoLembreteDash(lembrete, proxMes.getFullYear(), proxMes.getMonth());
    const dataProxMes = formatarISODash(new Date(proxMes.getFullYear(), proxMes.getMonth(), diaProxMes));

    return { data: dataProxMes, pago: false };
}

function prepararLembretesDashboard() {

    const lembretesUsuario = JSON.parse(localStorage.getItem("lembretes")) || [];

    const atrasados = [];
    const hojeLista = [];
    const proximos = [];

    lembretesUsuario.forEach(lembrete => {

        const ocorrencia = proximaOcorrenciaLembreteDash(lembrete);
        if (ocorrencia.pago || !ocorrencia.data) return;

        const item = { ...lembrete, dataOcorrencia: ocorrencia.data };

        if (ocorrencia.data < hojeDashISO) {
            atrasados.push(item);
        } else if (ocorrencia.data === hojeDashISO) {
            hojeLista.push(item);
        } else {
            proximos.push(item);
        }
    });

    atrasados.sort((a, b) => a.dataOcorrencia.localeCompare(b.dataOcorrencia));
    proximos.sort((a, b) => a.dataOcorrencia.localeCompare(b.dataOcorrencia));

    return { atrasados, hoje: hojeLista, proximos };
}

function formatarDataBrDash(dataISO) {
    if (!dataISO) return "";
    const [, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}`;
}

function renderizarLembretesDashboard() {

    const { atrasados, hoje, proximos } = prepararLembretesDashboard();

    const combinados = [
        ...atrasados.map(l => ({ ...l, status: "atrasado" })),
        ...hoje.map(l => ({ ...l, status: "hoje" })),
        ...proximos.map(l => ({ ...l, status: "proximo" }))
    ].slice(0, 5);

    const container = document.getElementById("listaLembretesDashboard");
    container.innerHTML = "";

    if (combinados.length === 0) {
        container.innerHTML = `<p class="sem-lembretes-dash">Nenhum lembrete pendente. 🎉</p>`;
    } else {

        combinados.forEach(lembrete => {

            const card = document.createElement("div");
            card.className = `lembrete-dash ${lembrete.status}`;

            const rotuloData =
                lembrete.status === "hoje" ? "Hoje" :
                lembrete.status === "atrasado" ? `Atrasado · ${formatarDataBrDash(lembrete.dataOcorrencia)}` :
                formatarDataBrDash(lembrete.dataOcorrencia);

            card.innerHTML = `
                <div>
                    <h3>🔔 ${lembrete.titulo}</h3>
                    <p>${rotuloData}</p>
                </div>
                ${lembrete.valor ? `<strong>${moeda(Number(lembrete.valor))}</strong>` : ""}
            `;

            container.appendChild(card);
        });
    }

    return { atrasados, hoje, proximos };
}

// ======================================================================
// ALERTAS INTELIGENTES
// ======================================================================

function calcularAlertasDashboard(infoLembretes) {

    const alertas = [];

    // ---- orçamentos ativos hoje: estourado / perto do limite ----

    const orcamentos = JSON.parse(localStorage.getItem("orcamentos")) || [];

    orcamentos.forEach(orc => {

        if (!orc.dataInicio || !orc.dataFim) return;
        if (hojeDashISO < orc.dataInicio || hojeDashISO > orc.dataFim) return;
        if (!orc.limite || orc.limite <= 0) return;

        const gastoCategoria = totalGastoDash(
            movimentacoes.filter(mov =>
                ehGastoDash(mov) &&
                mov.categoria === orc.categoria &&
                mov.data >= orc.dataInicio &&
                mov.data <= orc.dataFim
            )
        );

        const percentual = (gastoCategoria / orc.limite) * 100;

        if (percentual >= 100) {
            alertas.push({
                prioridade: 1,
                icone: "🚨",
                texto: `Orçamento de "${orc.categoria}" estourado: ${moeda(gastoCategoria)} de ${moeda(orc.limite)}.`
            });
        } else if (percentual >= 70) {
            alertas.push({
                prioridade: 3,
                icone: "⚠️",
                texto: `Orçamento de "${orc.categoria}" já em ${percentual.toFixed(0)}% do limite.`
            });
        }
    });

    // ---- lembretes atrasados ----

    if (infoLembretes.atrasados.length > 0) {
        alertas.push({
            prioridade: 0,
            icone: "🔴",
            texto: infoLembretes.atrasados.length === 1
                ? `1 lembrete atrasado: "${infoLembretes.atrasados[0].titulo}".`
                : `${infoLembretes.atrasados.length} lembretes atrasados.`
        });
    }

    // ---- contas/lembretes próximos (nos próximos 3 dias, incluindo hoje) ----

    const proximosPertoDeVencer = [
        ...infoLembretes.hoje,
        ...infoLembretes.proximos.filter(l => diferencaEmDiasDash(hojeDashISO, l.dataOcorrencia) <= 4)
    ];

    if (proximosPertoDeVencer.length > 0) {

        let textoAlertaLembrete;

        if (proximosPertoDeVencer.length === 1) {

            const diasParaVencer = diferencaEmDiasDash(hojeDashISO, proximosPertoDeVencer[0].dataOcorrencia) - 1;

            const rotuloPrazo = diasParaVencer <= 0
                ? "vence hoje"
                : diasParaVencer === 1
                    ? "vence em 1 dia"
                    : `vence em ${diasParaVencer} dias`;

            textoAlertaLembrete = `Lembrete "${proximosPertoDeVencer[0].titulo}" ${rotuloPrazo}.`;

        } else {
            textoAlertaLembrete = `${proximosPertoDeVencer.length} lembretes vencendo nos próximos dias.`;
        }

        alertas.push({
            prioridade: 2,
            icone: "🔔",
            texto: textoAlertaLembrete
        });
    }

    // ---- gasto do mês (até hoje) vs mesmo período do mês anterior ----

    const inicioMesAtual = primeiroDiaMesDash(hojeDash);
    const gastoMesAtualAteHoje = totalGastoDash(
        movimentacoesGastoNoPeriodoDash(inicioMesAtual, hojeDashISO)
    );

    const mesAnt = new Date(hojeDash.getFullYear(), hojeDash.getMonth() - 1, 1);
    const inicioMesAnt = primeiroDiaMesDash(mesAnt);
    const diaEquivalenteAnt = Math.min(hojeDash.getDate(), diasNoMesDash(mesAnt));
    const fimMesAntEquivalente = formatarISODash(new Date(mesAnt.getFullYear(), mesAnt.getMonth(), diaEquivalenteAnt));

    const gastoMesAnteriorEquivalente = totalGastoDash(
        movimentacoesGastoNoPeriodoDash(inicioMesAnt, fimMesAntEquivalente)
    );

    // só alerta se já tiver dados suficientes dos dois períodos pra comparar
    if (gastoMesAnteriorEquivalente > 0 && gastoMesAtualAteHoje > gastoMesAnteriorEquivalente) {

        const percentualAumento =
            ((gastoMesAtualAteHoje - gastoMesAnteriorEquivalente) / gastoMesAnteriorEquivalente) * 100;

        alertas.push({
            prioridade: 4,
            icone: "📈",
            texto: `Gastos desse mês (até hoje) já estão ${percentualAumento.toFixed(0)}% acima do mesmo período do mês passado.`
        });
    }

    // ---- metas perto de bater ----

    const metasUsuario = JSON.parse(localStorage.getItem("metas")) || [];

    metasUsuario.forEach(meta => {

        if (!meta.valorObjetivo || meta.valorObjetivo <= 0) return;

        const percentual = (meta.valorAtual / meta.valorObjetivo) * 100;

        if (percentual >= 90 && percentual < 100) {
            alertas.push({
                prioridade: 5,
                icone: "🎯",
                texto: `Meta "${meta.nome}" está quase lá: faltam ${moeda(meta.valorObjetivo - meta.valorAtual)}.`
            });
        }
    });

    alertas.sort((a, b) => a.prioridade - b.prioridade);

    // não exagera na quantidade: no máximo 4 alertas por vez
    return alertas.slice(0, 4);
}

function renderizarAlertasDashboard(infoLembretes) {

    const container = document.getElementById("listaAlertas");
    const alertas = calcularAlertasDashboard(infoLembretes);

    container.innerHTML = "";

    if (alertas.length === 0) {
        container.innerHTML = `
            <div class="alerta alerta-ok">
                <span>✓</span>
                <p>Tudo certo por enquanto.</p>
            </div>
        `;
        return;
    }

    alertas.forEach(alerta => {
        const el = document.createElement("div");
        el.className = "alerta";
        el.innerHTML = `<span>${alerta.icone}</span><p>${alerta.texto}</p>`;
        container.appendChild(el);
    });
}

// ======================================================================
// NOTIFICAÇÕES (PWA / Notification API)
//
// Usa a API nativa de notificações do navegador. Funciona com o app
// aberto (ou recém aberto, via Service Worker) — é uma notificação
// "local", disparada pelo próprio dispositivo, não um push vindo de um
// servidor. Pra notificação chegar com o app fechado seria necessário
// um serviço de push (ex: Firebase Cloud Messaging) rodando num
// back-end, o que esse projeto não tem hoje — por isso não foi
// simulado aqui.
// ======================================================================

function notificarLembretesPendentesDash(itens) {

    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!itens || itens.length === 0) return;

    // Chave só pra lembrar, NESSE aparelho, que já notificamos hoje.
    // Usa de propósito o localStorage REAL do navegador (window.localStorage)
    // em vez do "localStorage" simulado (que vai pro Firestore) — isso
    // não é dado financeiro, é só um controle local de UI, então não
    // deve sincronizar nem contar como alteração dos dados do usuário.
    const chaveHoje = `financas_notificado_${hojeDashISO}`;

    if (window.localStorage.getItem(chaveHoje)) return;

    itens.slice(0, 5).forEach(lembrete => {

        const atrasado = lembrete.dataOcorrencia < hojeDashISO;

        const corpo = lembrete.valor
            ? `${moeda(Number(lembrete.valor))} — ${atrasado ? "atrasado" : "vence hoje"}`
            : (atrasado ? "Atrasado" : "Vence hoje");

        const opcoes = {
            body: corpo,
            icon: "../img/icons/icon-192.png",
            badge: "../img/icons/icon-192.png",
            tag: `lembrete-${lembrete.id}`
        };

        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready
                .then(registro => registro.showNotification(`🔔 ${lembrete.titulo}`, opcoes))
                .catch(() => {});
        } else if (typeof Notification === "function") {
            new Notification(`🔔 ${lembrete.titulo}`, opcoes);
        }
    });

    window.localStorage.setItem(chaveHoje, "1");
}

function atualizarStatusNotificacoesDash() {

    const bloco = document.getElementById("blocoNotificacoes");
    const botao = document.getElementById("btnAtivarNotificacoes");
    const status = document.getElementById("statusNotificacoes");

    if (!bloco || !botao || !status) return;

    if (!("Notification" in window)) {
        bloco.style.display = "none";
        return;
    }

    if (Notification.permission === "granted") {
        botao.style.display = "none";
        status.textContent = "🔔 Notificações ativadas neste aparelho.";
        status.style.display = "block";
    } else if (Notification.permission === "denied") {
        botao.style.display = "none";
        status.textContent = "🔕 Notificações bloqueadas nas configurações do navegador.";
        status.style.display = "block";
    } else {
        botao.style.display = "inline-block";
        status.style.display = "none";
    }
}

const botaoAtivarNotificacoesDash = document.getElementById("btnAtivarNotificacoes");

if (botaoAtivarNotificacoesDash) {

    botaoAtivarNotificacoesDash.addEventListener("click", async () => {

        try {
            await Notification.requestPermission();
        } catch (erro) {
            console.error("Erro ao pedir permissão de notificação:", erro);
        }

        atualizarStatusNotificacoesDash();

        const { atrasados, hoje } = prepararLembretesDashboard();
        notificarLembretesPendentesDash([...atrasados, ...hoje]);
    });
}

// ======================================================================
// INICIALIZAÇÃO DOS NOVOS RECURSOS
// ======================================================================

atualizarResumoGastoDashboard();

const infoLembretesDashboard = renderizarLembretesDashboard();
renderizarAlertasDashboard(infoLembretesDashboard);

atualizarStatusNotificacoesDash();
notificarLembretesPendentesDash([...infoLembretesDashboard.atrasados, ...infoLembretesDashboard.hoje]);
