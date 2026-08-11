import { protegerPagina, carregarDados, criarArmazenamento, sair, iconeCategoria, ICONES_DISPONIVEIS, obterIconeCategoria, salvarIconeCategoria } from "./utils.js";

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
const seletorIcones = document.getElementById("seletorIcones");
const iconeSelecionadoInput = document.getElementById("iconeSelecionado");

let tipoAtivo = "saida";
let editandoIndex = null;
let nomeOriginalEdicao = null;

// ---------------- DADOS ----------------

// Estrutura salva:
// { entrada: ["Salário", ...], saida: [{nome:"Alimentação", natureza:"Despesa"}, ...] }
function carregarCategorias() {

    let bruto = localStorage.getItem("categorias");
    let categorias = null;

    try {
        categorias = bruto ? JSON.parse(bruto) : null;
    } catch (erro) {
        console.error("Categorias salvas em formato inválido:", erro);
    }

    // Mantém categorias já salvas e só cria as padrões quando realmente
    // não existe uma estrutura utilizável. Também aceita formatos antigos
    // para não fazer categorias existentes desaparecerem.
    if (Array.isArray(categorias)) {
        categorias = {
            entrada: [],
            saida: categorias.map(item => {
                if (typeof item === "string") return { nome: item, natureza: "Despesa" };
                return {
                    nome: item?.nome || item?.categoria || "Outros",
                    natureza: item?.natureza || "Despesa"
                };
            })
        };
    }

    if (!categorias || typeof categorias !== "object") {
        categorias = {};
    }

    // Alguns backups/versões antigas podem ter usado nomes diferentes.
    // Aproveitamos esses dados em vez de substituí-los pelos padrões.
    if (!Array.isArray(categorias.entrada)) {
        if (Array.isArray(categorias.entradas)) categorias.entrada = categorias.entradas;
        else categorias.entrada = [];
    }

    if (!Array.isArray(categorias.saida)) {
        if (Array.isArray(categorias.saidas)) categorias.saida = categorias.saidas;
        else categorias.saida = [];
    }

    // Normaliza entradas que vieram como objetos.
    categorias.entrada = categorias.entrada
        .map(item => typeof item === "string" ? item : (item?.nome || item?.categoria || null))
        .filter(Boolean);

    // Normaliza saídas sem apagar as categorias existentes.
    categorias.saida = categorias.saida
        .map(item => {
            if (typeof item === "string") return { nome: item, natureza: "Despesa" };
            if (!item || typeof item !== "object") return null;
            return {
                ...item,
                nome: item.nome || item.categoria || "Outros",
                natureza: item.natureza || "Despesa"
            };
        })
        .filter(Boolean);

    // Só adiciona categorias padrão quando a conta realmente não tem
    // nenhuma categoria salva. Assim, categorias personalizadas nunca são
    // apagadas ou substituídas ao abrir esta tela.
    if (categorias.entrada.length === 0 && categorias.saida.length === 0) {
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
    }

    const temRetirada = categorias.saida.some(c => c?.natureza === "Resgate");
    if (!temRetirada) {
        categorias.saida.push({ nome: "Retirada da Reserva", natureza: "Resgate" });
    }

    // Mantém a memória local sincronizada com o que veio do Firebase.
    // O armazenamento usado aqui salva no Firestore através de setItem.
    localStorage.setItem("categorias", JSON.stringify(categorias));

    return categorias;
}

function salvarCategorias(categorias) {
    localStorage.setItem("categorias", JSON.stringify(categorias));
}

// ---------------- SELETOR DE ÍCONES ----------------

function renderizarSeletorIcones() {
    if (!seletorIcones) return;
    seletorIcones.innerHTML = ICONES_DISPONIVEIS.map(item => `
        <button type="button" class="icone-opcao ${iconeSelecionadoInput.value === item.id ? "selecionado" : ""}" data-icone="${item.id}" title="${item.nome}" aria-label="${item.nome}">
            ${iconeCategoria("", item.id)}
            <span>${item.nome}</span>
        </button>
    `).join("");

    seletorIcones.querySelectorAll(".icone-opcao").forEach(botao => {
        botao.addEventListener("click", () => {
            iconeSelecionadoInput.value = botao.dataset.icone;
            seletorIcones.querySelectorAll(".icone-opcao").forEach(b => b.classList.remove("selecionado"));
            botao.classList.add("selecionado");
        });
    });
}

function selecionarIconeInicial(nome) {
    const personalizado = obterIconeCategoria(nome);
    if (personalizado && ICONES_DISPONIVEIS.some(i => i.id === personalizado)) {
        iconeSelecionadoInput.value = personalizado;
        return;
    }

    const html = iconeCategoria(nome);
    const tipo = ICONES_DISPONIVEIS.find(i => html.includes(`--icone-cor:${i.cor}`));
    iconeSelecionadoInput.value = tipo?.id || "outros";
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
                <strong>${iconeCategoria(nome)} ${nome}</strong>
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
    const listaAntes = tipoAtivo === "saida" ? categorias.saida : categorias.entrada;
    const itemAntes = listaAntes[index];
    const nomeExcluido = tipoAtivo === "saida" ? itemAntes?.nome : itemAntes;

    if (tipoAtivo === "saida") {
        categorias.saida.splice(index, 1);
    } else {
        categorias.entrada.splice(index, 1);
    }

    if (nomeExcluido && dadosUsuario.iconesCategorias) {
        delete dadosUsuario.iconesCategorias[nomeExcluido];
        localStorage.setItem("iconesCategorias", JSON.stringify(dadosUsuario.iconesCategorias));
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
    nomeOriginalEdicao = tipoAtivo === "saida" ? item.nome : item;

    nomeInput.value = nomeOriginalEdicao;
    selecionarIconeInicial(nomeOriginalEdicao);
    renderizarSeletorIcones();

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
    nomeOriginalEdicao = null;

    formCategoria.reset();
    iconeSelecionadoInput.value = "outros";
    renderizarSeletorIcones();

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

    const iconeEscolhido = iconeSelecionadoInput.value || "outros";
    const nomeNovo = nome;

    // Se a categoria foi renomeada, mantém a preferência do ícone ligada ao novo nome.
    if (nomeOriginalEdicao && nomeOriginalEdicao.toLowerCase() !== nomeNovo.toLowerCase()) {
        const mapa = dadosUsuario.iconesCategorias || {};
        if (mapa[nomeOriginalEdicao]) {
            mapa[nomeNovo] = mapa[nomeOriginalEdicao];
            delete mapa[nomeOriginalEdicao];
        }
    }

    salvarIconeCategoria(nomeNovo, iconeEscolhido);
    localStorage.setItem("iconesCategorias", JSON.stringify(dadosUsuario.iconesCategorias));
    salvarCategorias(categorias);

    cancelarEdicao();

    renderizarCategorias();
});

// ---------------- INICIALIZAÇÃO ----------------

trocarAba("saida");
