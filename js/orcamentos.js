import { protegerPagina, carregarDados, criarArmazenamento, sair, iconeCategoria, iconeCategoriaTexto } from "./utils.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

// ---------------- ELEMENTOS ----------------

const formOrcamento = document.getElementById("formOrcamento");
const categoriaSelect = document.getElementById("categoriaOrcamento");
const limiteInput = document.getElementById("limiteOrcamento");
const dataInicioInput = document.getElementById("dataInicioOrcamento");
const dataFimInput = document.getElementById("dataFimOrcamento");
const listaOrcamentos = document.getElementById("listaOrcamentos");
const btnSalvarOrcamento = document.getElementById("btnSalvarOrcamento");
const btnCancelarEdicaoOrcamento = document.getElementById("btnCancelarEdicaoOrcamento");

let orcamentoEditandoId = null;

// ---------------- DADOS ----------------

function carregarCategorias() {

    let categorias = JSON.parse(localStorage.getItem("categorias"));

    if (categorias === null) {

        categorias = {
            entrada: ["Salário", "Renda Extra", "Presente", "Outros"],
            saida: [
                { nome: "Alimentação", natureza: "Despesa" },
                { nome: "Mercado", natureza: "Despesa" },
                { nome: "Uber", natureza: "Despesa" },
                { nome: "Lazer", natureza: "Despesa" },
                { nome: "Futebol", natureza: "Despesa" },
                { nome: "Gympass", natureza: "Despesa" },
                { nome: "Streaming", natureza: "Despesa" },
                { nome: "Telefone", natureza: "Despesa" },
                { nome: "CNH", natureza: "Reserva" },
                { nome: "Reserva", natureza: "Reserva" },
                { nome: "Consórcio", natureza: "Despesa" },
                { nome: "Casa", natureza: "Despesa" },
                { nome: "Outros", natureza: "Despesa" }
            ]
        };

        localStorage.setItem("categorias", JSON.stringify(categorias));
    }

    return categorias;
}

function primeiroDiaMes(data) {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-01`;
}

function ultimoDiaMes(data) {
    const ultimo = new Date(data.getFullYear(), data.getMonth() + 1, 0);
    return `${ultimo.getFullYear()}-${String(ultimo.getMonth() + 1).padStart(2, "0")}-${String(ultimo.getDate()).padStart(2, "0")}`;
}

function carregarOrcamentos() {

    let orcamentos = JSON.parse(localStorage.getItem("orcamentos")) || [];

    // Orçamentos antigos (de antes do período existir) não tinham data.
    // Pra não perder o que já estava configurado, tratamos esses como
    // valendo o mês em que foram criados.
    let precisaSalvar = false;

    orcamentos = orcamentos.map(orc => {

        if (orc.dataInicio && orc.dataFim) return orc;

        const referencia = orc.id ? new Date(orc.id) : new Date();

        precisaSalvar = true;

        return {
            ...orc,
            dataInicio: primeiroDiaMes(referencia),
            dataFim: ultimoDiaMes(referencia)
        };
    });

    if (precisaSalvar) {
        salvarOrcamentos(orcamentos);
    }

    return orcamentos;
}

function salvarOrcamentos(orcamentos) {
    localStorage.setItem("orcamentos", JSON.stringify(orcamentos));
}

function carregarMovimentacoes() {
    return JSON.parse(localStorage.getItem("movimentacoes")) || [];
}

// ---------------- FORMATAÇÃO ----------------

function moeda(valor) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

const nomesMes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function formatarDataBr(dataStr) {
    if (!dataStr) return "";
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
}

// Mostra de qual mês é o orçamento. Se o período começa e termina no
// mesmo mês, mostra "Agosto de 2026". Se atravessa meses diferentes,
// mostra o intervalo completo em dd/mm/aaaa.
function rotuloMes(orc) {

    const [anoInicio, mesInicio] = (orc.dataInicio || "").split("-");
    const [anoFim, mesFim] = (orc.dataFim || "").split("-");

    if (anoInicio === anoFim && mesInicio === mesFim) {
        const indice = Number(mesInicio) - 1;
        return `${nomesMes[indice] || mesInicio} de ${anoInicio}`;
    }

    return `${formatarDataBr(orc.dataInicio)} até ${formatarDataBr(orc.dataFim)}`;
}

function periodosSeSobrepoem(inicioA, fimA, inicioB, fimB) {
    return inicioA <= fimB && inicioB <= fimA;
}

function gastoNoPeriodo(nomeCategoria, dataInicio, dataFim) {

    const movimentacoes = carregarMovimentacoes();

    let total = 0;

    movimentacoes.forEach(mov => {

        if (mov.tipo !== "Saída") return;
        if (mov.categoria !== nomeCategoria) return;
        if (!mov.data) return;
        if (mov.data < dataInicio || mov.data > dataFim) return;

        total += Number(mov.valor);
    });

    return total;
}

// ---------------- QUANTO POSSO GASTAR (EM CADA ORÇAMENTO) ----------------
// Cada orçamento tem a sua própria conta (nada é somado entre orçamentos):
//   sobra   = limite − tudo que já foi gasto no período do orçamento
//   por dia = sobra ÷ número de DIAS DE GASTO que faltam
// Os dias de gasto são marcados à mão em cada orçamento (orc.diasGasto).
// Sem nenhum dia marcado, vale todos os dias, de hoje até o fim do orçamento.
//   hoje    = por dia − o que já gastei hoje (só se hoje for dia marcado)
//   janela  = por dia × dias marcados da janela escolhida
//             − o que gastei hoje, se a janela começa hoje
// A janela é "7 dias" (hoje + 6) ou o período Personalizado escolhido.
// Dias que já passaram não entram na conta. Nunca mostra negativo.

let janelaAtiva = "7dias";

const filtroPeriodoEl = document.getElementById("filtroPeriodo");
const personalizadoEl = document.getElementById("limitePersonalizado");
const limiteInicioEl = document.getElementById("limiteInicio");
const limiteFimEl = document.getElementById("limiteFim");
const limiteDicaEl = document.getElementById("limiteDica");

function isoLocal(data) {
    return data.toLocaleDateString("en-CA");
}

function dataDeISO(iso) {
    const [ano, mes, dia] = iso.split("-").map(Number);
    return new Date(ano, mes - 1, dia);
}

// quantidade de dias entre duas datas ISO, contando as duas pontas
function diasContando(inicioISO, fimISO) {
    return Math.round((dataDeISO(fimISO) - dataDeISO(inicioISO)) / 86400000) + 1;
}

function mais(iso, dias) {
    const d = dataDeISO(iso);
    return isoLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias));
}

// datas no mesmo formato do Controles: "09/10" e "09/10 a 15/10"
function dataCurta(iso) {
    const [ano, mes, dia] = iso.split("-");
    const base = `${dia}/${mes}`;
    return Number(ano) === new Date().getFullYear() ? base : `${base}/${ano}`;
}

function textoDatas(inicio, fim) {
    return inicio === fim ? `📅 ${dataCurta(inicio)}` : `📅 ${dataCurta(inicio)} a ${dataCurta(fim)}`;
}

function obterJanela() {

    const hojeISO = isoLocal(new Date());

    if (janelaAtiva !== "personalizado") {
        return {
            inicio: hojeISO,
            fim: mais(hojeISO, 6),
            rotulo: "Próximos 7 dias",
            aviso: "",
            invalida: false
        };
    }

    const inicio = limiteInicioEl.value || hojeISO;
    const fim = limiteFimEl.value || mais(hojeISO, 6);

    let aviso = "";
    let invalida = false;

    if (fim < inicio) {
        aviso = "A data final precisa ser depois da data inicial.";
        invalida = true;
    } else if (inicio < hojeISO && fim >= hojeISO) {
        aviso = "Dias que já passaram aparecem só no gasto. Na conta de quanto pode gastar, entram só os dias de hoje em diante.";
    } else if (fim < hojeISO) {
        aviso = "Esse período já passou: você vê quanto foi gasto, mas não há quanto gastar.";
    }

    return { inicio, fim, rotulo: "Período escolhido", aviso, invalida };
}

// primeiro dia que ainda conta: hoje, ou o começo do orçamento se ainda não começou
function primeiroDiaFuturo(orc) {
    const hojeISO = isoLocal(new Date());
    return hojeISO > orc.dataInicio ? hojeISO : orc.dataInicio;
}

// dias marcados à mão que ainda contam (de hoje em diante, dentro do orçamento)
function diasMarcadosFuturos(orc) {

    if (!Array.isArray(orc.diasGasto) || orc.diasGasto.length === 0) return [];

    const inicio = primeiroDiaFuturo(orc);

    return [...new Set(orc.diasGasto)]
        .filter(d => d >= inicio && d <= orc.dataFim)
        .sort();
}

function limitesDoOrcamento(orc, janela) {

    const hojeISO = isoLocal(new Date());

    const ativoHoje = orc.dataInicio <= hojeISO && orc.dataFim >= hojeISO;

    const gastoPeriodo = gastoNoPeriodo(orc.categoria, orc.dataInicio, orc.dataFim);
    const sobraAgora = Math.max(0, orc.limite - gastoPeriodo);

    // quanto já foi gasto dentro da janela (só o trecho que cai no orçamento)
    const inicioGasto = janela.inicio > orc.dataInicio ? janela.inicio : orc.dataInicio;
    const fimGasto = janela.fim < orc.dataFim ? janela.fim : orc.dataFim;
    const sobrepoe = !janela.invalida && inicioGasto <= fimGasto;
    const gastoJanela = sobrepoe ? gastoNoPeriodo(orc.categoria, inicioGasto, fimGasto) : 0;

    const resultado = {
        sobrepoe,
        gastoJanela,
        hoje: null,
        janela: null,
        diasContados: 0,
        porDia: 0,
        personalizado: false,
        hojeMarcado: false
    };

    // orçamento que já acabou: não há mais quanto gastar
    if (orc.dataFim < hojeISO) return resultado;

    const inicioFuturo = primeiroDiaFuturo(orc);
    const marcados = diasMarcadosFuturos(orc);
    const personalizado = Array.isArray(orc.diasGasto) && orc.diasGasto.length > 0;

    const nDias = personalizado ? marcados.length : diasContando(inicioFuturo, orc.dataFim);
    const hojeMarcado = ativoHoje && (!personalizado || marcados.includes(hojeISO));

    // o que gastei hoje já saiu da sobra; se hoje é dia marcado, devolve
    // para a conta e depois desconta de "hoje" (assim hoje conta como dia inteiro)
    const gastoHoje = ativoHoje ? gastoNoPeriodo(orc.categoria, hojeISO, hojeISO) : 0;
    const montante = sobraAgora + (hojeMarcado ? gastoHoje : 0);
    const porDia = nDias > 0 ? montante / nDias : 0;

    resultado.personalizado = personalizado;
    resultado.diasContados = nDias;
    resultado.porDia = porDia;
    resultado.hojeMarcado = hojeMarcado;

    if (ativoHoje) {
        resultado.hoje = hojeMarcado
            ? Math.min(sobraAgora, Math.max(0, porDia - gastoHoje))
            : 0;
    }

    if (janela.invalida) return resultado;

    // dias que já passaram não entram
    const inicioEfetivo = janela.inicio < hojeISO ? hojeISO : janela.inicio;

    const iniJ = inicioEfetivo > inicioFuturo ? inicioEfetivo : inicioFuturo;
    const fimJ = janela.fim < orc.dataFim ? janela.fim : orc.dataFim;

    if (iniJ > fimJ) return resultado;

    const diasNaJanela = personalizado
        ? marcados.filter(d => d >= iniJ && d <= fimJ).length
        : diasContando(iniJ, fimJ);

    let valor = porDia * diasNaJanela;

    if (hojeMarcado && iniJ === hojeISO) {
        valor -= gastoHoje;
    } else if (hojeMarcado && nDias > 1 && gastoHoje > porDia) {
        // gastei mais que o permitido hoje: o excesso tira dos dias seguintes
        valor -= (gastoHoje - porDia) * diasNaJanela / (nDias - 1);
    }

    resultado.janela = Math.min(sobraAgora, Math.max(0, valor));

    return resultado;
}

// ---------------- DIAS DE GASTO (escolha manual) ----------------

const painelDiasAberto = new Set();

const letrasSemana = ["D", "S", "T", "Q", "Q", "S", "S"];
const nomesSemana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function alterarDiasGasto(id, novaLista) {

    const orcamentos = carregarOrcamentos();
    const orc = orcamentos.find(o => o.id === id);

    if (!orc) return;

    orc.diasGasto = [...new Set(novaLista)].sort();

    salvarOrcamentos(orcamentos);
    renderizarOrcamentos();
}

// todos os dias de hoje até o fim do orçamento
function diasPossiveis(orc) {

    const lista = [];
    const fim = orc.dataFim;

    for (let dia = primeiroDiaFuturo(orc); dia <= fim; dia = mais(dia, 1)) {
        lista.push(dia);
    }

    return lista;
}

function criarSecaoDias(orc) {

    const secao = document.createElement("div");
    secao.className = "orcamento-dias";

    const hojeISO = isoLocal(new Date());

    if (orc.dataFim < hojeISO) return secao; // orçamento terminou: nada a marcar

    const possiveis = diasPossiveis(orc);
    const marcados = diasMarcadosFuturos(orc);
    const personalizado = Array.isArray(orc.diasGasto) && orc.diasGasto.length > 0;
    const aberto = painelDiasAberto.has(orc.id);

    // ----- topo: título, resumo e botão
    const topo = document.createElement("div");
    topo.className = "orcamento-dias-topo";

    const titulo = document.createElement("span");
    titulo.className = "limite-titulo";
    titulo.textContent = "📆 Dias de gasto";

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "btn-dias";
    botao.textContent = aberto ? "Fechar" : "Escolher dias";

    botao.addEventListener("click", () => {
        if (painelDiasAberto.has(orc.id)) painelDiasAberto.delete(orc.id);
        else painelDiasAberto.add(orc.id);
        renderizarOrcamentos();
    });

    topo.appendChild(titulo);
    topo.appendChild(botao);
    secao.appendChild(topo);

    const resumo = document.createElement("p");
    resumo.className = "limite-gasto-periodo";

    if (!personalizado) {
        resumo.textContent = `Todos os dias (${possiveis.length} de hoje até o fim). Marque só os dias em que você costuma gastar nessa categoria.`;
    } else if (marcados.length === 0) {
        resumo.textContent = "Os dias marcados já passaram. Marque novos dias ou volte para todos os dias.";
    } else {
        resumo.textContent = `${marcados.length} ${marcados.length === 1 ? "dia marcado" : "dias marcados"} de hoje em diante. O que sobra é dividido só entre eles.`;
    }

    secao.appendChild(resumo);

    if (!aberto) return secao;

    // ----- atalhos
    const atalhos = document.createElement("div");
    atalhos.className = "limite-chips";

    const criarAtalho = (rotulo, aoClicar) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "limite-chip";
        b.textContent = rotulo;
        b.addEventListener("click", aoClicar);
        atalhos.appendChild(b);
    };

    const doisDias = dow => possiveis.filter(d => dataDeISO(d).getDay() === dow);

    criarAtalho("Todos os dias", () => alterarDiasGasto(orc.id, []));
    criarAtalho("Seg a sex", () => alterarDiasGasto(orc.id, possiveis.filter(d => {
        const dow = dataDeISO(d).getDay();
        return dow >= 1 && dow <= 5;
    })));
    criarAtalho("Sáb e dom", () => alterarDiasGasto(orc.id, possiveis.filter(d => {
        const dow = dataDeISO(d).getDay();
        return dow === 0 || dow === 6;
    })));

    secao.appendChild(atalhos);

    // ----- calendário (cabeçalho com os dias da semana também marca a coluna toda)
    const grade = document.createElement("div");
    grade.className = "dias-grade";

    letrasSemana.forEach((letra, dow) => {

        const cab = document.createElement("button");
        cab.type = "button";
        cab.className = "dias-cabecalho";
        cab.textContent = letra;
        cab.title = `Marcar todos os dias: ${nomesSemana[dow]}`;

        cab.addEventListener("click", () => {

            const daquele = doisDias(dow);

            if (daquele.length === 0) return;

            const todosMarcados = daquele.every(d => marcados.includes(d));

            const base = personalizado ? marcados : [];

            alterarDiasGasto(
                orc.id,
                todosMarcados
                    ? base.filter(d => !daquele.includes(d))
                    : [...base, ...daquele]
            );
        });

        grade.appendChild(cab);
    });

    if (possiveis.length > 0) {
        for (let k = 0; k < dataDeISO(possiveis[0]).getDay(); k++) {
            grade.appendChild(document.createElement("span"));
        }
    }

    possiveis.forEach(dia => {

        const celula = document.createElement("button");
        celula.type = "button";
        celula.className = "dia-celula";

        if (personalizado && marcados.includes(dia)) celula.classList.add("marcado");
        if (dia === hojeISO) celula.classList.add("hoje");

        celula.textContent = String(Number(dia.split("-")[2]));
        celula.title = `${nomesSemana[dataDeISO(dia).getDay()]} ${dataCurta(dia)}`;
        celula.setAttribute("aria-pressed", String(personalizado && marcados.includes(dia)));

        celula.addEventListener("click", () => {

            const base = personalizado ? marcados : [];

            alterarDiasGasto(
                orc.id,
                base.includes(dia) ? base.filter(d => d !== dia) : [...base, dia]
            );
        });

        grade.appendChild(celula);
    });

    secao.appendChild(grade);

    return secao;
}

function blocoLimitesHTML(orc, janela) {

    if (janela.invalida) return "";

    const hojeISO = isoLocal(new Date());
    const lim = limitesDoOrcamento(orc, janela);

    const valorHoje = lim.hoje === null ? "—" : moeda(lim.hoje);
    const valorJanela = lim.janela === null ? "—" : moeda(lim.janela);

    const zeradoHoje = lim.hoje !== null && lim.hoje < 0.005 ? " zerado" : "";
    const zeradoJanela = lim.janela !== null && lim.janela < 0.005 ? " zerado" : "";

    let nota;

    if (!lim.sobrepoe) {
        nota = "Este orçamento não vale nessas datas.";
    } else {
        nota = `Já gasto nesse período: <strong>${moeda(lim.gastoJanela)}</strong>`;

        if (lim.janela === null) {
            nota += " · não há mais quanto gastar nessas datas.";
        }

        if (lim.diasContados > 0) {
            nota += `<br>Dividido em ${lim.diasContados} ${lim.personalizado ? "dias marcados" : "dias"}: ${moeda(lim.porDia)} por dia.`;
        } else if (lim.personalizado) {
            nota += "<br>Nenhum dia marcado de hoje em diante.";
        }
    }

    return `
        <div class="orcamento-limites">

            <p class="limite-titulo">💡 Quanto posso gastar</p>

            <div class="limite-blocos">

                <div class="limite-bloco">
                    <span class="limite-rotulo">Hoje</span>
                    <span class="limite-datas">${lim.hoje === null ? "Não vale hoje" : (lim.hojeMarcado ? "📅 " + dataCurta(hojeISO) : "Hoje não é dia marcado")}</span>
                    <strong class="limite-valor${zeradoHoje}">${valorHoje}</strong>
                </div>

                <div class="limite-bloco">
                    <span class="limite-rotulo">${janela.rotulo}</span>
                    <span class="limite-datas">${textoDatas(janela.inicio, janela.fim)}</span>
                    <strong class="limite-valor${zeradoJanela}">${valorJanela}</strong>
                </div>

            </div>

            <p class="limite-gasto-periodo">${nota}</p>

        </div>
    `;
}

function atualizarFiltroPeriodo(janela) {

    personalizadoEl.style.display = janelaAtiva === "personalizado" ? "flex" : "none";

    limiteDicaEl.textContent = janela.aviso ||
        "Em cada orçamento: quanto você ainda pode gastar hoje e no período escolhido. " +
        "Gastos em categorias sem orçamento não entram na conta.";
}

// botões "7 dias" / "Personalizado" e as datas De/Até
document.querySelectorAll(".limite-chip").forEach(chip => {

    chip.addEventListener("click", () => {

        janelaAtiva = chip.dataset.janela;

        document.querySelectorAll(".limite-chip").forEach(c => {
            c.classList.toggle("ativo", c === chip);
        });

        if (janelaAtiva === "personalizado") {

            const hojeISO = isoLocal(new Date());

            if (!limiteInicioEl.value) limiteInicioEl.value = hojeISO;
            if (!limiteFimEl.value) limiteFimEl.value = mais(hojeISO, 6);
        }

        renderizarOrcamentos();
    });
});

limiteInicioEl.addEventListener("input", renderizarOrcamentos);
limiteFimEl.addEventListener("input", renderizarOrcamentos);
limiteInicioEl.addEventListener("change", renderizarOrcamentos);
limiteFimEl.addEventListener("change", renderizarOrcamentos);

// ---------------- POPULAR SELECT DE CATEGORIAS ----------------

function popularCategorias() {

    const categorias = carregarCategorias();

    categoriaSelect.innerHTML = '<option value="">Selecione</option>';

    categorias.saida.forEach(item => {
        categoriaSelect.innerHTML += `<option value="${item.nome}">${iconeCategoriaTexto(item.nome, categorias)} ${item.nome}</option>`;
    });
}

// ---------------- RENDERIZAÇÃO ----------------

function renderizarOrcamentos() {

    const janela = obterJanela();
    atualizarFiltroPeriodo(janela);

    const orcamentos = carregarOrcamentos();
    const categorias = carregarCategorias();

    listaOrcamentos.innerHTML = "";

    // sem orçamento não há o que filtrar por data
    filtroPeriodoEl.style.display = orcamentos.length === 0 ? "none" : "block";

    if (orcamentos.length === 0) {
        listaOrcamentos.innerHTML = `
            <div class="vazio">
                <h2>Nenhum orçamento criado.</h2>
                <p>Crie um orçamento acima para começar a acompanhar seus gastos.</p>
            </div>
        `;
        return;
    }

    orcamentos.forEach(orc => {

        const gasto = gastoNoPeriodo(orc.categoria, orc.dataInicio, orc.dataFim);
        const percentual = orc.limite > 0 ? Math.min(100, (gasto / orc.limite) * 100) : 0;

        let classeBarra = "";
        let aviso = "";

        if (percentual >= 100) {
            classeBarra = "estourou";
            aviso = `<p class="orcamento-aviso">⚠️ Orçamento estourado!</p>`;
        } else if (percentual >= 70) {
            classeBarra = "atencao";
        }

        const card = document.createElement("div");
        card.className = "orcamento";

        card.innerHTML = `
            <div class="orcamento-topo">
                <div class="orcamento-titulo-bloco">
                    <span class="orcamento-titulo">${iconeCategoria(orc.categoria, categorias)} ${orc.categoria}</span>
                    <span class="orcamento-mes">${rotuloMes(orc)}</span>
                </div>
                <div class="orcamento-acoes">
                    <button class="orcamento-editar" data-id="${orc.id}" title="Editar orçamento">
                        ✏️
                    </button>
                    <button class="orcamento-excluir" data-id="${orc.id}" title="Excluir orçamento">
                        🗑️
                    </button>
                </div>
            </div>

            <p class="orcamento-periodo">
                Válido de ${formatarDataBr(orc.dataInicio)} até ${formatarDataBr(orc.dataFim)}
            </p>

            <div class="orcamento-valores">
                <span><strong>${moeda(gasto)}</strong> de ${moeda(orc.limite)}</span>
                <span>${percentual.toFixed(0)}%</span>
            </div>

            <div class="barra">
                <div class="progresso ${classeBarra}" style="width:${percentual}%"></div>
            </div>

            ${aviso}

            ${blocoLimitesHTML(orc, janela)}
        `;

        card.appendChild(criarSecaoDias(orc));

        listaOrcamentos.appendChild(card);
    });

    document.querySelectorAll(".orcamento-editar").forEach(botao => {
        botao.addEventListener("click", () => {
            iniciarEdicaoOrcamento(Number(botao.dataset.id));
        });
    });

    document.querySelectorAll(".orcamento-excluir").forEach(botao => {
        botao.addEventListener("click", () => {
            excluirOrcamento(Number(botao.dataset.id));
        });
    });
}

// ---------------- AÇÕES ----------------

function iniciarEdicaoOrcamento(id) {

    const orcamento = carregarOrcamentos().find(o => o.id === id);
    if (!orcamento) return;

    orcamentoEditandoId = id;

    categoriaSelect.value = orcamento.categoria;
    limiteInput.value = orcamento.limite;
    dataInicioInput.value = orcamento.dataInicio;
    dataFimInput.value = orcamento.dataFim;

    btnSalvarOrcamento.textContent = "💾 Salvar alterações";
    btnCancelarEdicaoOrcamento.style.display = "block";

    formOrcamento.scrollIntoView({ behavior: "smooth" });
}

function cancelarEdicaoOrcamento() {

    orcamentoEditandoId = null;

    formOrcamento.reset();
    definirPeriodoPadrao();

    btnSalvarOrcamento.textContent = "💾 Criar orçamento";
    btnCancelarEdicaoOrcamento.style.display = "none";
}

btnCancelarEdicaoOrcamento.addEventListener("click", cancelarEdicaoOrcamento);

function excluirOrcamento(id) {

    if (!confirm("Deseja realmente excluir este orçamento?")) return;

    const orcamentos = carregarOrcamentos().filter(o => o.id !== id);

    salvarOrcamentos(orcamentos);
    painelDiasAberto.delete(id);

    if (orcamentoEditandoId === id) {
        cancelarEdicaoOrcamento();
    }

    renderizarOrcamentos();
}

formOrcamento.addEventListener("submit", (e) => {

    e.preventDefault();

    const categoriaEscolhida = categoriaSelect.value;
    const limite = Number(limiteInput.value);
    const dataInicio = dataInicioInput.value;
    const dataFim = dataFimInput.value;

    if (!categoriaEscolhida || !limite) {
        alert("Selecione a categoria e o valor do limite.");
        return;
    }

    if (!dataInicio || !dataFim) {
        alert("Escolha o período do orçamento (de/até).");
        return;
    }

    if (dataFim < dataInicio) {
        alert("A data final precisa ser depois da data inicial.");
        return;
    }

    const orcamentos = carregarOrcamentos();

    // Duas categorias iguais podem coexistir se forem de períodos
    // diferentes (ex: um orçamento de Mercado em agosto e outro em
    // setembro). Só bloqueia se os períodos se sobrepuserem. Ao editar,
    // ignora o próprio orçamento na comparação, senão ele bateria com
    // ele mesmo.
    const jaExiste = orcamentos.some(o =>
        o.id !== orcamentoEditandoId &&
        o.categoria === categoriaEscolhida &&
        periodosSeSobrepoem(o.dataInicio, o.dataFim, dataInicio, dataFim)
    );

    if (jaExiste) {
        alert("Já existe um orçamento para essa categoria nesse período.");
        return;
    }

    if (orcamentoEditandoId !== null) {

        const index = orcamentos.findIndex(o => o.id === orcamentoEditandoId);

        if (index !== -1) {
            orcamentos[index] = {
                ...orcamentos[index],
                categoria: categoriaEscolhida,
                limite,
                dataInicio,
                dataFim
            };
        }

    } else {

        orcamentos.push({
            id: Date.now(),
            categoria: categoriaEscolhida,
            limite,
            dataInicio,
            dataFim
        });
    }

    salvarOrcamentos(orcamentos);

    orcamentoEditandoId = null;
    btnSalvarOrcamento.textContent = "💾 Criar orçamento";
    btnCancelarEdicaoOrcamento.style.display = "none";

    formOrcamento.reset();
    definirPeriodoPadrao();

    renderizarOrcamentos();
});

// ---------------- INICIALIZAÇÃO ----------------

// Por padrão, sugere o mês atual inteiro (do dia 1 ao último dia),
// já que é o caso mais comum — mas os campos continuam editáveis pra
// quem quiser um período diferente ("até dia tal", por exemplo).
function definirPeriodoPadrao() {
    const hoje = new Date();
    dataInicioInput.value = primeiroDiaMes(hoje);
    dataFimInput.value = ultimoDiaMes(hoje);
}

definirPeriodoPadrao();
popularCategorias();
renderizarOrcamentos();
