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

function escapar(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
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

// Texto legível de um período: "30/09" (um dia só) ou "01/09 a 30/09".
// O ano só aparece quando o período não é do ano atual.
function textoPeriodo(periodo) {

    const formatar = iso => {
        const [ano, mes, dia] = iso.split("-");
        const base = `${dia}/${mes}`;
        return Number(ano) === hojeGastos.getFullYear() ? base : `${base}/${ano}`;
    };

    return periodo.inicio === periodo.fim
        ? formatar(periodo.inicio)
        : `${formatar(periodo.inicio)} a ${formatar(periodo.fim)}`;
}

function dataBr(iso) {
    const [, mes, dia] = iso.split("-");
    return `${dia}/${mes}`;
}

// ---------------- CONTAS A PAGAR (lembretes pendentes no período) ----------------
// Mesma lógica do Calendário: lembrete mensal cai todo mês no mesmo dia
// (escorrega pro último dia se o mês for menor); a ocorrência está paga
// se existir lembrete.pagamentos[chave].

function contasAPagarNoPeriodo(inicioISO, fimISO) {

    const lembretes = JSON.parse(localStorage.getItem("lembretes")) || [];
    const pendentes = [];

    lembretes.forEach(lembrete => {

        // empréstimo (a receber) não é conta a pagar
        if (lembrete.tipoLembrete === "receber") return;

        const pagamentos = lembrete.pagamentos || {};

        if (!lembrete.recorrente) {

            if (lembrete.data && lembrete.data >= inicioISO && lembrete.data <= fimISO && !pagamentos[lembrete.data]) {
                pendentes.push({ lembrete, data: lembrete.data });
            }

            return;
        }

        if (!lembrete.diaDoMes) return;

        const cursor = paraDataLocalGastos(inicioISO);
        cursor.setDate(1);

        const limite = paraDataLocalGastos(fimISO);

        while (cursor <= limite) {

            const ano = cursor.getFullYear();
            const mes = cursor.getMonth();
            const diasNoMes = new Date(ano, mes + 1, 0).getDate();
            const dia = Math.min(lembrete.diaDoMes, diasNoMes);

            const dataISO = formatarISOGastos(new Date(ano, mes, dia));
            const chave = `${ano}-${String(mes + 1).padStart(2, "0")}`;

            if (dataISO >= inicioISO && dataISO <= fimISO && !pagamentos[chave]) {
                pendentes.push({ lembrete, data: dataISO });
            }

            cursor.setMonth(cursor.getMonth() + 1);
        }
    });

    return pendentes.sort((a, b) => a.data.localeCompare(b.data));
}

function renderizarContasAPagar(periodo, totalGastoPeriodo) {

    const pendentes = contasAPagarNoPeriodo(periodo.inicio, periodo.fim);

    const total = pendentes.reduce((soma, item) => soma + (Number(item.lembrete.valor) || 0), 0);
    const semValor = pendentes.filter(item => !(Number(item.lembrete.valor) > 0)).length;

    document.getElementById("contasPagarTotal").textContent = moeda(total);

    const lista = document.getElementById("contasPagarLista");
    const previsao = document.getElementById("contasPagarPrevisao");

    lista.innerHTML = "";

    if (pendentes.length === 0) {
        lista.innerHTML = `<p class="sem-dados-gasto">Nenhuma conta pendente nesse período. 🎉</p>`;
        previsao.textContent = "";
        return;
    }

    pendentes.forEach(({ lembrete, data }) => {

        const atrasada = data < hojeGastosISO;

        const linha = document.createElement("div");
        linha.className = `conta-pagar-linha${atrasada ? " atrasada" : ""}`;

        linha.innerHTML = `
            <div>
                <strong>${escapar(lembrete.titulo)}</strong>
                <small>${dataBr(data)}${atrasada ? " · atrasada" : ""}${lembrete.categoria ? ` · ${escapar(lembrete.categoria)}` : ""}</small>
            </div>
            <span>${Number(lembrete.valor) > 0 ? moeda(Number(lembrete.valor)) : "sem valor"}</span>
        `;

        lista.appendChild(linha);
    });

    previsao.textContent =
        `Já gasto ${moeda(totalGastoPeriodo)} + a pagar ${moeda(total)} = previsão de ${moeda(totalGastoPeriodo + total)}` +
        (semValor > 0 ? ` (${semValor} conta${semValor > 1 ? "s" : ""} sem valor não entram na soma).` : ".");
}

// ---------------- META DE GASTO DO MÊS ----------------
// Guardada em "metaGastoMensal" (número). Sempre compara com o mês atual,
// independente do filtro escolhido.

function carregarMetaGasto() {
    const valor = Number(JSON.parse(localStorage.getItem("metaGastoMensal")));
    return valor > 0 ? valor : 0;
}

function renderizarMetaGasto() {

    const meta = carregarMetaGasto();
    const conteudo = document.getElementById("metaGastoConteudo");
    const botao = document.getElementById("btnEditarMetaGasto");

    botao.textContent = meta > 0 ? "✏️ Editar" : "✏️ Definir";

    if (meta <= 0) {
        conteudo.innerHTML = `<p class="meta-gasto-vazio">Defina quanto você quer gastar por mês para acompanhar aqui.</p>`;
        return;
    }

    const pMes = periodoParaFiltro("esteMes");
    const gasto = totalGasto(movimentacoesGastoNoPeriodo(pMes.inicio, pMes.fim));

    const percentual = (gasto / meta) * 100;
    const restante = meta - gasto;

    const classe = percentual >= 100 ? "estourou" : percentual >= 80 ? "perto" : "ok";

    const diasRestantes = diferencaEmDiasGastos(hojeGastosISO, pMes.fim);

    let situacao;

    if (restante < 0) {
        situacao = `🚨 Você passou ${moeda(Math.abs(restante))} da meta.`;
    } else if (restante === 0) {
        situacao = "⚠️ Você chegou exatamente na meta.";
    } else {
        situacao = `Restam ${moeda(restante)}` +
            (diasRestantes > 0 ? ` — dá ${moeda(restante / diasRestantes)} por dia nos ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""} que faltam.` : ".");
    }

    conteudo.innerHTML = `
        <div class="meta-gasto-valores">
            <strong>${moeda(gasto)}</strong>
            <span>de ${moeda(meta)} (${percentual.toFixed(0)}%)</span>
        </div>
        <div class="barra">
            <div class="progresso meta-${classe}" style="width:${Math.min(100, percentual)}%"></div>
        </div>
        <p class="meta-gasto-situacao ${classe}">${situacao}</p>
    `;
}

const elMetaEdicao = document.getElementById("metaGastoEdicao");
const elMetaInput = document.getElementById("metaGastoInput");

document.getElementById("btnEditarMetaGasto").addEventListener("click", () => {

    const aberto = elMetaEdicao.style.display !== "none";

    elMetaEdicao.style.display = aberto ? "none" : "block";

    if (!aberto) {
        const meta = carregarMetaGasto();
        elMetaInput.value = meta > 0 ? meta : "";
        elMetaInput.focus();
    }
});

document.getElementById("btnCancelarMetaGasto").addEventListener("click", () => {
    elMetaEdicao.style.display = "none";
});

document.getElementById("btnSalvarMetaGasto").addEventListener("click", async () => {

    const valor = Number(elMetaInput.value);

    if (!(valor > 0)) {
        alert("Digite um valor maior que zero.");
        return;
    }

    await localStorage.setItem("metaGastoMensal", JSON.stringify(Math.round(valor * 100) / 100));

    elMetaEdicao.style.display = "none";
    renderizarMetaGasto();
});

document.getElementById("btnRemoverMetaGasto").addEventListener("click", async () => {

    if (carregarMetaGasto() > 0 && !confirm("Remover a meta de gasto mensal?")) return;

    await localStorage.setItem("metaGastoMensal", JSON.stringify(0));

    elMetaEdicao.style.display = "none";
    renderizarMetaGasto();
});

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

    // datas do período usado na comparação
    const datasAnterior = textoPeriodo(periodoAnterior);

    document.getElementById("gastoPeriodoDatas").textContent = `📅 ${textoPeriodo(periodo)}`;

    if (totalAnterior === 0) {
        elComparacao.textContent = total > 0
            ? `Sem gastos no período anterior (${datasAnterior}) para comparar.`
            : "Sem dados suficientes para comparar ainda.";
    } else {
        const diferenca = total - totalAnterior;
        const percentual = (diferenca / totalAnterior) * 100;
        const subiu = diferenca > 0;
        const ficouIgual = diferenca === 0;

        elComparacao.textContent = ficouIgual
            ? `Igual ao período anterior, ${datasAnterior} (${moeda(totalAnterior)}).`
            : `${subiu ? "🔺" : "🔻"} ${Math.abs(percentual).toFixed(0)}% ${subiu ? "a mais" : "a menos"} que no período anterior, ${datasAnterior} (${moeda(totalAnterior)}).`;
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

    // ---- categorias do período anterior (pra comparar categoria por categoria) ----

    const porCategoriaAnterior = {};

    movimentacoesGastoNoPeriodo(periodoAnterior.inicio, periodoAnterior.fim).forEach(mov => {
        const cat = mov.categoria || "Outros";
        porCategoriaAnterior[cat] = (porCategoriaAnterior[cat] || 0) + Number(mov.valor);
    });

    renderizarGastosPorCategoria(categoriasOrdenadas, total, gastosPeriodo, porCategoriaAnterior, datasAnterior);

    renderizarContasAPagar(periodo, total);

    renderizarMetaGasto();
}

function renderizarGastosPorCategoria(categoriasOrdenadas, total, gastosPeriodo, porCategoriaAnterior, datasAnterior) {

    const container = document.getElementById("listaGastosPorCategoria");
    container.innerHTML = "";

    const temBaseAnterior = Object.keys(porCategoriaAnterior).length > 0;

    if (categoriasOrdenadas.length === 0 && !temBaseAnterior) {
        container.innerHTML = `<p class="sem-dados-gasto">Nenhum gasto nesse período.</p>`;
        return;
    }

    if (categoriasOrdenadas.length === 0) {
        container.innerHTML = `<p class="sem-dados-gasto">Nenhum gasto nesse período.</p>`;
    }

    categoriasOrdenadas.forEach(([categoria, valor]) => {

        const percentual = total > 0 ? (valor / total) * 100 : 0;

        // ---- comparação com o período anterior ----
        let comparacaoHtml = "";

        if (temBaseAnterior) {

            const anterior = porCategoriaAnterior[categoria] || 0;

            if (anterior === 0) {
                comparacaoHtml = `<span class="cat-comparacao novo">🆕 Sem gasto em ${datasAnterior}</span>`;
            } else {
                const variacao = ((valor - anterior) / anterior) * 100;

                if (Math.abs(variacao) < 1) {
                    comparacaoHtml = `<span class="cat-comparacao igual">= Igual a ${datasAnterior} (${moeda(anterior)})</span>`;
                } else {
                    const subiu = variacao > 0;
                    comparacaoHtml = `<span class="cat-comparacao ${subiu ? "subiu" : "desceu"}">${subiu ? "🔺 +" : "🔻 -"}${Math.abs(variacao).toFixed(0)}% vs ${datasAnterior} (${moeda(anterior)})</span>`;
                }
            }
        }

        // ---- lançamentos da categoria (aparecem ao tocar) ----
        const lancamentos = gastosPeriodo
            .filter(mov => (mov.categoria || "Outros") === categoria)
            .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);

        const linha = document.createElement("div");
        linha.className = "linha-categoria-gasto";

        linha.innerHTML = `
            <button type="button" class="linha-categoria-botao" aria-expanded="false">
                <div class="linha-categoria-topo">
                    <span><span class="seta-categoria">▸</span> ${iconeCategoria(categoria, categoriasSalvas)} ${escapar(categoria)}</span>
                    <span>${moeda(valor)} <small>· ${percentual.toFixed(0)}%</small></span>
                </div>
                <div class="barra">
                    <div class="progresso" style="width:${percentual}%"></div>
                </div>
                ${comparacaoHtml}
            </button>
            <div class="lancamentos-categoria" style="display:none;">
                ${lancamentos.map(mov => `
                    <div class="lancamento-categoria">
                        <div>
                            <strong>${escapar(mov.descricao || "Sem descrição")}</strong>
                            <small>${dataBr(mov.data)}${mov.banco ? ` · ${escapar(mov.banco)}` : ""}</small>
                        </div>
                        <span>${moeda(Number(mov.valor))}</span>
                    </div>
                `).join("")}
            </div>
        `;

        const botao = linha.querySelector(".linha-categoria-botao");
        const detalhes = linha.querySelector(".lancamentos-categoria");
        const seta = linha.querySelector(".seta-categoria");

        botao.addEventListener("click", () => {

            const aberto = detalhes.style.display !== "none";

            detalhes.style.display = aberto ? "none" : "block";
            seta.textContent = aberto ? "▸" : "▾";
            botao.setAttribute("aria-expanded", String(!aberto));
        });

        container.appendChild(linha);
    });

    // categorias que tinham gasto no período anterior e agora não têm
    const zeradas = Object.entries(porCategoriaAnterior)
        .filter(([categoria]) => !categoriasOrdenadas.some(([nome]) => nome === categoria))
        .sort((a, b) => b[1] - a[1]);

    if (zeradas.length > 0) {

        const bloco = document.createElement("div");
        bloco.className = "categorias-zeradas";

        bloco.innerHTML = `
            <h4>Sem gastos agora (tinham em ${datasAnterior})</h4>
            ${zeradas.map(([categoria, valor]) => `
                <div class="categoria-zerada">
                    <span>${iconeCategoria(categoria, categoriasSalvas)} ${escapar(categoria)}</span>
                    <span>🔻 antes ${moeda(valor)}</span>
                </div>
            `).join("")}
        `;

        container.appendChild(bloco);
    }
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
