import { protegerPagina, carregarDados, criarArmazenamento, sair } from "./utils.js";

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

// ---------------- POPULAR SELECT DE CATEGORIAS ----------------

function popularCategorias() {

    const categorias = carregarCategorias();

    categoriaSelect.innerHTML = '<option value="">Selecione</option>';

    categorias.saida.forEach(item => {
        categoriaSelect.innerHTML += `<option value="${item.nome}">${item.nome}</option>`;
    });
}

// ---------------- RENDERIZAÇÃO ----------------

function renderizarOrcamentos() {

    const orcamentos = carregarOrcamentos();

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
                    <span class="orcamento-titulo">${orc.categoria}</span>
                    <span class="orcamento-mes">${rotuloMes(orc)}</span>
                </div>
                <button class="orcamento-excluir" data-id="${orc.id}" title="Excluir orçamento">
                    🗑️
                </button>
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

    document.querySelectorAll(".orcamento-excluir").forEach(botao => {
        botao.addEventListener("click", () => {
            excluirOrcamento(Number(botao.dataset.id));
        });
    });
}

// ---------------- AÇÕES ----------------

function excluirOrcamento(id) {

    if (!confirm("Deseja realmente excluir este orçamento?")) return;

    const orcamentos = carregarOrcamentos().filter(o => o.id !== id);

    salvarOrcamentos(orcamentos);
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
    // setembro). Só bloqueia se os períodos se sobrepuserem.
    const jaExiste = orcamentos.some(o =>
        o.categoria === categoriaEscolhida &&
        periodosSeSobrepoem(o.dataInicio, o.dataFim, dataInicio, dataFim)
    );

    if (jaExiste) {
        alert("Já existe um orçamento para essa categoria nesse período.");
        return;
    }

    orcamentos.push({
        id: Date.now(),
        categoria: categoriaEscolhida,
        limite,
        dataInicio,
        dataFim
    });

    salvarOrcamentos(orcamentos);

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
