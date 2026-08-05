import { protegerPagina, carregarDados, criarArmazenamento, sair } from "./utils.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

// ---------------- ELEMENTOS ----------------

const abaSaida = document.getElementById("abaSaida");
const abaEntrada = document.getElementById("abaEntrada");

const formCategoria = document.getElementById("formCategoria");
const nomeInput = document.getElementById("nomeCategoria");
const campoNatureza = document.getElementById("campoNatureza");
const naturezaInput = document.getElementById("natureza");

const tituloForm = document.getElementById("tituloForm");
const tituloLista = document.getElementById("tituloLista");
const listaCategorias = document.getElementById("listaCategorias");

const btnSalvarCategoria = document.getElementById("btnSalvarCategoria");
const btnCancelarEdicao = document.getElementById("btnCancelarEdicao");

let tipoAtivo = "saida";
let editandoIndex = null;

// ---------------- DADOS ----------------

// Estrutura salva:
// { entrada: ["Salário", ...], saida: [{nome:"Alimentação", natureza:"Despesa"}, ...] }
function carregarCategorias() {

    let categorias = JSON.parse(localStorage.getItem("categorias"));

    // Conta recém-criada salva "categorias" como {} (objeto vazio, de
    // propósito). Antes só checávamos "=== null", então esse {} passava
    // direto e o código quebrava lá embaixo ao tentar ler categorias.saida.
    // Agora tratamos qualquer formato incompleto (null, {}, ou faltando
    // entrada/saida) como "ainda sem categorias" e preenchemos os padrões.
    const semDadosValidos =
        categorias === null ||
        !Array.isArray(categorias.entrada) ||
        !Array.isArray(categorias.saida);

    if (semDadosValidos) {

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
                { nome: "Outros", natureza: "Despesa" },
                { nome: "Retirada da Reserva", natureza: "Resgate" }
            ]
        };

        localStorage.setItem("categorias", JSON.stringify(categorias));
    }

    const temRetirada = categorias.saida.some(c => c.natureza === "Resgate");

    if (!temRetirada) {
        categorias.saida.push({ nome: "Retirada da Reserva", natureza: "Resgate" });
        localStorage.setItem("categorias", JSON.stringify(categorias));
    }

    return categorias;
}

function salvarCategorias(categorias) {
    localStorage.setItem("categorias", JSON.stringify(categorias));
}

// ---------------- ABAS ----------------

function trocarAba(tipo) {

    tipoAtivo = tipo;

    cancelarEdicao();

    abaSaida.classList.toggle("ativa", tipo === "saida");
    abaEntrada.classList.toggle("ativa", tipo === "entrada");

    campoNatureza.style.display = tipo === "saida" ? "flex" : "none";

    tituloForm.textContent = tipo === "saida"
        ? "Nova categoria de saída"
        : "Nova categoria de entrada";

    tituloLista.textContent = tipo === "saida"
        ? "Categorias de saída"
        : "Categorias de entrada";

    nomeInput.placeholder = tipo === "saida"
        ? "Ex: Farmácia"
        : "Ex: Salário";

    renderizarCategorias();
}

abaSaida.addEventListener("click", () => trocarAba("saida"));
abaEntrada.addEventListener("click", () => trocarAba("entrada"));

// ---------------- RENDERIZAÇÃO ----------------

function tagPorNatureza(natureza) {

    const classes = {
        Despesa: "tag-despesa",
        Reserva: "tag-reserva",
        Investimento: "tag-investimento",
        Resgate: "tag-resgate"
    };

    return `<span class="tag ${classes[natureza] || "tag-despesa"}">${natureza}</span>`;
}

function renderizarCategorias() {

    const categorias = carregarCategorias();

    listaCategorias.innerHTML = "";

    const lista = tipoAtivo === "saida" ? categorias.saida : categorias.entrada;

    if (lista.length === 0) {
        listaCategorias.innerHTML = `
            <div class="vazio">
                <h2>Nenhuma categoria cadastrada.</h2>
                <p>Adicione uma categoria acima.</p>
            </div>
        `;
        return;
    }

    lista.forEach((item, index) => {

        const nome = tipoAtivo === "saida" ? item.nome : item;

        const card = document.createElement("div");
        card.className = "categoria";

        card.innerHTML = `
            <div class="categoria-nome">
                <strong>${nome}</strong>
                ${tipoAtivo === "saida" ? tagPorNatureza(item.natureza) : `<span class="tag tag-entrada">Entrada</span>`}
            </div>
            <div class="categoria-acoes">
                <button class="categoria-editar" data-index="${index}" title="Editar categoria">
                    ✏️
                </button>
                <button class="categoria-excluir" data-index="${index}" title="Excluir categoria">
                    🗑️
                </button>
            </div>
        `;

        listaCategorias.appendChild(card);
    });

    document.querySelectorAll(".categoria-excluir").forEach(botao => {
        botao.addEventListener("click", () => {
            excluirCategoria(Number(botao.dataset.index));
        });
    });

    document.querySelectorAll(".categoria-editar").forEach(botao => {
        botao.addEventListener("click", () => {
            editarCategoria(Number(botao.dataset.index));
        });
    });
}

// ---------------- AÇÕES ----------------

function excluirCategoria(index) {

    if (!confirm("Deseja realmente excluir esta categoria?")) return;

    const categorias = carregarCategorias();

    if (tipoAtivo === "saida") {
        categorias.saida.splice(index, 1);
    } else {
        categorias.entrada.splice(index, 1);
    }

    salvarCategorias(categorias);

    if (editandoIndex === index) {
        cancelarEdicao();
    }

    renderizarCategorias();
}

function editarCategoria(index) {

    const categorias = carregarCategorias();
    const lista = tipoAtivo === "saida" ? categorias.saida : categorias.entrada;
    const item = lista[index];

    if (!item) return;

    editandoIndex = index;

    nomeInput.value = tipoAtivo === "saida" ? item.nome : item;

    if (tipoAtivo === "saida") {
        naturezaInput.value = item.natureza;
    }

    tituloForm.textContent = tipoAtivo === "saida"
        ? "Editar categoria de saída"
        : "Editar categoria de entrada";

    btnSalvarCategoria.textContent = "💾 Salvar alterações";
    btnCancelarEdicao.classList.remove("oculto");

    nomeInput.focus();
}

function cancelarEdicao() {

    editandoIndex = null;

    formCategoria.reset();

    tituloForm.textContent = tipoAtivo === "saida"
        ? "Nova categoria de saída"
        : "Nova categoria de entrada";

    btnSalvarCategoria.textContent = "💾 Adicionar categoria";
    btnCancelarEdicao.classList.add("oculto");
}

btnCancelarEdicao.addEventListener("click", cancelarEdicao);

formCategoria.addEventListener("submit", (e) => {

    e.preventDefault();

    const nome = nomeInput.value.trim();

    if (!nome) {
        alert("Digite o nome da categoria.");
        return;
    }

    const categorias = carregarCategorias();

    if (tipoAtivo === "saida") {

        const jaExiste = categorias.saida.some(
            (c, i) => c.nome.toLowerCase() === nome.toLowerCase() && i !== editandoIndex
        );

        if (jaExiste) {
            alert("Já existe uma categoria de saída com esse nome.");
            return;
        }

        if (editandoIndex !== null) {
            categorias.saida[editandoIndex] = { nome, natureza: naturezaInput.value };
        } else {
            categorias.saida.push({ nome, natureza: naturezaInput.value });
        }

    } else {

        const jaExiste = categorias.entrada.some(
            (c, i) => c.toLowerCase() === nome.toLowerCase() && i !== editandoIndex
        );

        if (jaExiste) {
            alert("Já existe uma categoria de entrada com esse nome.");
            return;
        }

        if (editandoIndex !== null) {
            categorias.entrada[editandoIndex] = nome;
        } else {
            categorias.entrada.push(nome);
        }
    }

    salvarCategorias(categorias);

    cancelarEdicao();

    renderizarCategorias();
});

// ---------------- INICIALIZAÇÃO ----------------

trocarAba("saida");
