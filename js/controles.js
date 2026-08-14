import { protegerPagina, carregarDados, criarArmazenamento, sair, iconeCategoria, iconeCategoriaTexto } from "./utils.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

// Carregado uma vez só pra resolver os ícones personalizados das categorias.
const categoriasSalvas = JSON.parse(localStorage.getItem("categorias")) || {};

// ---------------- DADOS ----------------

const movimentacoes =
    JSON.parse(localStorage.getItem("movimentacoes")) || [];

function moeda(valor) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

// ---------------- DATAS ----------------

function formatarISOGastos(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function paraDataLocalGastos(dataISO) {
    const [ano, mes, dia] = dataISO.split("-").map(Number);
    return new Date(ano, mes - 1, dia);
}

function primeiroDiaMesGastos(data) {
    return formatarISOGastos(new Date(data.getFullYear(), data.getMonth(), 1));
}

function ultimoDiaMesGastos(data) {
    return formatarISOGastos(new Date(data.getFullYear(), data.getMonth() + 1, 0));
}

// Diferença em dias, INCLUSIVA (mesma data = 1 dia).
function diferencaEmDiasGastos(inicioISO, fimISO) {
    const inicio = paraDataLocalGastos(inicioISO);
    const fim = paraDataLocalGastos(fimISO);
    return Math.round((fim - inicio) / 86400000) + 1;
}

const hojeGastos = new Date();
const hojeGastosISO = formatarISOGastos(hojeGastos);

// ---------------- "GASTO" (mesmo critério usado no resto do app:
// só Despesa conta como gasto — Resgate é entrada, ver dashboard.js/
// historico.js/relatorios.js, que usam a mesma regra) ----------------

function ehGasto(mov) {
    return mov.tipo !== "Entrada" && mov.natureza === "Despesa";
}

function movimentacoesGastoNoPeriodo(inicioISO, fimISO) {
    return movimentacoes.filter(mov =>
        ehGasto(mov) && mov.data && mov.data >= inicioISO && mov.data <= fimISO
    );
}

function totalGasto(lista) {
    return lista.reduce((soma, mov) => soma + Number(mov.valor), 0);
}

function periodoParaFiltro(filtro, personalizadoInicio, personalizadoFim) {

    switch (filtro) {

        case "hoje":
            return { inicio: hojeGastosISO, fim: hojeGastosISO };

        case "7dias": {
            const inicio = new Date(hojeGastos);
            inicio.setDate(inicio.getDate() - 6);
            return { inicio: formatarISOGastos(inicio), fim: hojeGastosISO };
        }

        case "mesAnterior": {
            const mesAnt = new Date(hojeGastos.getFullYear(), hojeGastos.getMonth() - 1, 1);
            return { inicio: primeiroDiaMesGastos(mesAnt), fim: ultimoDiaMesGastos(mesAnt) };
        }

        case "personalizado":
            if (personalizadoInicio && personalizadoFim && personalizadoInicio <= personalizadoFim) {
                return { inicio: personalizadoInicio, fim: personalizadoFim };
            }
            // Sem período válido escolhido ainda: cai no mês atual até decidir.
            return { inicio: primeiroDiaMesGastos(hojeGastos), fim: ultimoDiaMesGastos(hojeGastos) };

        case "esteMes":
        default:
            return { inicio: primeiroDiaMesGastos(hojeGastos), fim: ultimoDiaMesGastos(hojeGastos) };
    }
}

// Período imediatamente anterior, de tamanho equivalente, pra comparação
// ("Comparação com o mês anterior" generalizada pros outros filtros).
function periodoAnteriorEquivalente(filtro, periodo) {

    if (filtro === "esteMes" || filtro === "mesAnterior") {
        const [ano, mes] = periodo.inicio.split("-").map(Number);
        const mesAnt = new Date(ano, mes - 2, 1);
        return { inicio: primeiroDiaMesGastos(mesAnt), fim: ultimoDiaMesGastos(mesAnt) };
    }

    const dias = diferencaEmDiasGastos(periodo.inicio, periodo.fim);

    const fimAnterior = paraDataLocalGastos(periodo.inicio);
    fimAnterior.setDate(fimAnterior.getDate() - 1);

    const inicioAnterior = new Date(fimAnterior);
    inicioAnterior.setDate(inicioAnterior.getDate() - (dias - 1));

    return { inicio: formatarISOGastos(inicioAnterior), fim: formatarISOGastos(fimAnterior) };
}

// ---------------- ESTADO DO FILTRO ----------------

let filtroGastoAtivo = "esteMes";

const elFiltrosGasto = document.getElementById("filtrosGasto");
const elPeriodoPersonalizado = document.getElementById("periodoPersonalizado");
const elPersonalizadoInicio = document.getElementById("personalizadoInicio");
const elPersonalizadoFim = document.getElementById("personalizadoFim");

const rotulosFiltroGasto = {
    hoje: "hoje",
    "7dias": "nos últimos 7 dias",
    esteMes: "este mês",
    mesAnterior: "no mês anterior",
    personalizado: "no período escolhido"
};

// ---------------- RENDERIZAÇÃO: CONTROLES ----------------

function atualizarQuantoGastei() {

    const periodo = periodoParaFiltro(
        filtroGastoAtivo,
        elPersonalizadoInicio ? elPersonalizadoInicio.value : "",
        elPersonalizadoFim ? elPersonalizadoFim.value : ""
    );

    const gastosPeriodo = movimentacoesGastoNoPeriodo(periodo.inicio, periodo.fim);
    const total = totalGasto(gastosPeriodo);

    // ---- cards fixos: hoje / 7 dias / este mês (sempre visíveis, não mudam com o filtro) ----

    const pHoje = periodoParaFiltro("hoje");
    const p7Dias = periodoParaFiltro("7dias");
    const pMes = periodoParaFiltro("esteMes");

    document.getElementById("gastoHojeFixo").textContent =
        moeda(totalGasto(movimentacoesGastoNoPeriodo(pHoje.inicio, pHoje.fim)));

    document.getElementById("gasto7DiasFixo").textContent =
        moeda(totalGasto(movimentacoesGastoNoPeriodo(p7Dias.inicio, p7Dias.fim)));

    document.getElementById("gastoMesFixo").textContent =
        moeda(totalGasto(movimentacoesGastoNoPeriodo(pMes.inicio, pMes.fim)));

    // ---- total do período selecionado ----

    document.getElementById("gastoTotalRotulo").textContent =
        `Total gasto ${rotulosFiltroGasto[filtroGastoAtivo] || "no período selecionado"}`;

    document.getElementById("gastoTotalPeriodo").textContent = moeda(total);

    // ---- comparação com o período anterior equivalente ----

    const periodoAnterior = periodoAnteriorEquivalente(filtroGastoAtivo, periodo);
    const totalAnterior = totalGasto(
        movimentacoesGastoNoPeriodo(periodoAnterior.inicio, periodoAnterior.fim)
    );

    const elComparacao = document.getElementById("gastoComparacao");

    if (totalAnterior === 0) {
        elComparacao.textContent = total > 0
            ? "Sem dados do período anterior para comparar."
            : "Sem dados suficientes para comparar ainda.";
    } else {
        const diferenca = total - totalAnterior;
        const percentual = (diferenca / totalAnterior) * 100;
        const subiu = diferenca > 0;
        const ficouIgual = diferenca === 0;

        elComparacao.textContent = ficouIgual
            ? `Igual ao período anterior (${moeda(totalAnterior)}).`
            : `${subiu ? "🔺" : "🔻"} ${Math.abs(percentual).toFixed(0)}% ${subiu ? "a mais" : "a menos"} que no período anterior (${moeda(totalAnterior)}).`;
    }

    // ---- quantidade de despesas ----

    document.getElementById("gastoQuantidade").textContent = gastosPeriodo.length;

    // ---- média diária ----

    const dias = Math.max(1, diferencaEmDiasGastos(periodo.inicio, periodo.fim));
    document.getElementById("gastoMedia").textContent = moeda(total / dias);

    // ---- maior gasto ----

    const elMaior = document.getElementById("gastoMaior");

    if (gastosPeriodo.length === 0) {
        elMaior.textContent = "—";
    } else {
        const maior = gastosPeriodo.reduce(
            (atual, mov) => Number(mov.valor) > Number(atual.valor) ? mov : atual
        );
        elMaior.textContent = `${moeda(Number(maior.valor))} · ${iconeCategoriaTexto(maior.categoria, categoriasSalvas)} ${maior.categoria}`;
    }

    // ---- categoria que mais gastei + gastos por categoria ----

    const porCategoria = {};

    gastosPeriodo.forEach(mov => {
        const cat = mov.categoria || "Outros";
        porCategoria[cat] = (porCategoria[cat] || 0) + Number(mov.valor);
    });

    const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);

    document.getElementById("gastoCategoriaTop").textContent =
        categoriasOrdenadas.length > 0
            ? `${iconeCategoriaTexto(categoriasOrdenadas[0][0], categoriasSalvas)} ${categoriasOrdenadas[0][0]} (${moeda(categoriasOrdenadas[0][1])})`
            : "—";

    renderizarGastosPorCategoria(categoriasOrdenadas, total);
}

function renderizarGastosPorCategoria(categoriasOrdenadas, total) {

    const container = document.getElementById("listaGastosPorCategoria");
    container.innerHTML = "";

    if (categoriasOrdenadas.length === 0) {
        container.innerHTML = `<p class="sem-dados-gasto">Nenhum gasto nesse período.</p>`;
        return;
    }

    categoriasOrdenadas.forEach(([categoria, valor]) => {

        const percentual = total > 0 ? (valor / total) * 100 : 0;

        const linha = document.createElement("div");
        linha.className = "linha-categoria-gasto";

        linha.innerHTML = `
            <div class="linha-categoria-topo">
                <span>${iconeCategoria(categoria, categoriasSalvas)} ${categoria}</span>
                <span>${moeda(valor)}</span>
            </div>
            <div class="barra">
                <div class="progresso" style="width:${percentual}%"></div>
            </div>
        `;

        container.appendChild(linha);
    });
}

// ---------------- FILTROS: EVENTOS ----------------

if (elFiltrosGasto) {

    elFiltrosGasto.querySelectorAll(".filtro-gasto-chip").forEach(botao => {

        botao.addEventListener("click", () => {

            elFiltrosGasto.querySelectorAll(".filtro-gasto-chip").forEach(b => b.classList.remove("ativo"));
            botao.classList.add("ativo");

            filtroGastoAtivo = botao.dataset.filtro;

            elPeriodoPersonalizado.style.display = filtroGastoAtivo === "personalizado" ? "flex" : "none";

            atualizarQuantoGastei();
        });
    });
}

if (elPersonalizadoInicio) {
    elPersonalizadoInicio.addEventListener("change", () => {
        if (filtroGastoAtivo === "personalizado") atualizarQuantoGastei();
    });
}

if (elPersonalizadoFim) {
    elPersonalizadoFim.addEventListener("change", () => {
        if (filtroGastoAtivo === "personalizado") atualizarQuantoGastei();
    });
}

atualizarQuantoGastei();
