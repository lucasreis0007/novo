import { protegerPagina, carregarDados, criarArmazenamento, sair } from "./utils.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

// ---------------- ELEMENTOS ----------------

const formOrcamento = document.getElementById("formOrcamento");
const categoriaSelect = document.getElementById("categoriaOrcamento");
const limiteInput = document.getElementById("limiteOrcamento");
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

function carregarOrcamentos() {
    return JSON.parse(localStorage.getItem("orcamentos")) || [];
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

function mesAtual() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    return `${ano}-${mes}`;
}

function gastoDoMes(nomeCategoria) {

    const movimentacoes = carregarMovimentacoes();
    const mesAtualStr = mesAtual();

    let total = 0;

    movimentacoes.forEach(mov => {

        if (mov.tipo !== "Saída") return;
        if (mov.categoria !== nomeCategoria) return;
        if (!mov.data || !mov.data.startsWith(mesAtualStr)) return;

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

        const gasto = gastoDoMes(orc.categoria);
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
                <span class="orcamento-titulo">${orc.categoria}</span>
                <button class="orcamento-excluir" data-id="${orc.id}" title="Excluir orçamento">
                    🗑️
                </button>
            </div>

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

    if (!categoriaEscolhida || !limite) {
        alert("Selecione a categoria e o valor do limite.");
        return;
    }

    const orcamentos = carregarOrcamentos();

    const jaExiste = orcamentos.some(o => o.categoria === categoriaEscolhida);

    if (jaExiste) {
        alert("Já existe um orçamento para essa categoria.");
        return;
    }

    orcamentos.push({
        id: Date.now(),
        categoria: categoriaEscolhida,
        limite
    });

    salvarOrcamentos(orcamentos);

    formOrcamento.reset();

    renderizarOrcamentos();
});

// ---------------- INICIALIZAÇÃO ----------------

popularCategorias();
renderizarOrcamentos();
