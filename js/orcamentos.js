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

// ---------------- QUANTO POSSO GASTAR (HOJE E NA SEMANA) ----------------
// Para cada orçamento que vale hoje:
//   sobra  = limite − tudo que já foi gasto no período (+ o que gastei hoje,
//            porque o "por dia" é calculado a partir do começo do dia)
//   por dia = sobra ÷ dias que faltam (hoje até o fim do orçamento)
//   hoje   = por dia − o que já gastei hoje
//   7 dias = por dia × dias que faltam nos próximos 7 dias (hoje + 6, ou até
//            o fim do orçamento, o que vier primeiro) − o que gastei hoje
// Nunca mostra negativo. O total é a soma dos orçamentos ativos.

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

function calcularLimites() {

    const hoje = new Date();
    const hojeISO = isoLocal(hoje);

    // últimos dia da janela: hoje + 6 (7 dias contando hoje)
    const fimJanela = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 6);
    const fimJanelaISO = isoLocal(fimJanela);

    const ativos = carregarOrcamentos().filter(o => o.dataInicio <= hojeISO && o.dataFim >= hojeISO);

    const linhas = ativos.map(orc => {

        const gastoPeriodo = gastoNoPeriodo(orc.categoria, orc.dataInicio, orc.dataFim);
        const gastoHoje = gastoNoPeriodo(orc.categoria, hojeISO, hojeISO);

        const diasRestantes = diasContando(hojeISO, orc.dataFim);

        const fimDaJanela = orc.dataFim < fimJanelaISO ? orc.dataFim : fimJanelaISO;
        const diasNaJanela = diasContando(hojeISO, fimDaJanela);

        const sobraAntesDeHoje = Math.max(0, orc.limite - gastoPeriodo + gastoHoje);
        const porDia = sobraAntesDeHoje / diasRestantes;

        // também não passa do que ainda sobra no orçamento inteiro
        const sobraAgora = Math.max(0, orc.limite - gastoPeriodo);

        return {
            categoria: orc.categoria,
            hoje: Math.min(sobraAgora, Math.max(0, porDia - gastoHoje)),
            semana: Math.min(sobraAgora, Math.max(0, porDia * diasNaJanela - gastoHoje))
        };
    });

    return {
        linhas,
        hoje: linhas.reduce((t, l) => t + l.hoje, 0),
        semana: linhas.reduce((t, l) => t + l.semana, 0),
        hojeISO,
        fimJanelaISO
    };
}

function renderizarLimites() {

    const elHoje = document.getElementById("limiteHoje");
    const elSemana = document.getElementById("limiteSemana");
    const elHojeDatas = document.getElementById("limiteHojeDatas");
    const elSemanaDatas = document.getElementById("limiteSemanaDatas");
    const elDica = document.getElementById("limiteDica");
    const elLista = document.getElementById("limiteLista");

    const resultado = calcularLimites();

    elLista.innerHTML = "";

    // datas no mesmo formato do Controles: "09/10" e "09/10 a 15/10"
    const dataCurta = iso => {
        const [, mes, dia] = iso.split("-");
        return `${dia}/${mes}`;
    };

    elHojeDatas.textContent = `📅 ${dataCurta(resultado.hojeISO)}`;
    elSemanaDatas.textContent = `📅 ${dataCurta(resultado.hojeISO)} a ${dataCurta(resultado.fimJanelaISO)}`;

    if (resultado.linhas.length === 0) {

        elHoje.textContent = "—";
        elSemana.textContent = "—";
        elHoje.classList.remove("zerado");
        elSemana.classList.remove("zerado");
        elDica.textContent = "Crie um orçamento que valha para hoje para ver quanto você pode gastar.";
        return;
    }

    elHoje.textContent = moeda(resultado.hoje);
    elSemana.textContent = moeda(resultado.semana);

    elHoje.classList.toggle("zerado", resultado.hoje < 0.005);
    elSemana.classList.toggle("zerado", resultado.semana < 0.005);

    elDica.textContent =
        "É a soma do que sobra em cada orçamento que vale hoje, dividida pelos dias que faltam. " +
        "Gastos em categorias sem orçamento não entram na conta.";

    const categorias = carregarCategorias();

    resultado.linhas.forEach(linha => {

        const linhaEl = document.createElement("div");
        linhaEl.className = "limite-linha";

        const nome = document.createElement("span");
        nome.textContent = `${iconeCategoriaTexto(linha.categoria, categorias)} ${linha.categoria}`;

        const valores = document.createElement("span");
        valores.className = "limite-linha-valores";
        valores.textContent = `hoje ${moeda(linha.hoje)} · 7 dias ${moeda(linha.semana)}`;

        linhaEl.appendChild(nome);
        linhaEl.appendChild(valores);
        elLista.appendChild(linhaEl);
    });
}

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

    renderizarLimites();

    const orcamentos = carregarOrcamentos();
    const categorias = carregarCategorias();

    listaOrcamentos.innerHTML = "";

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
        `;

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
