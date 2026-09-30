import { protegerPagina, carregarDados, criarArmazenamento, sair } from "./utils.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

// ---------------- ELEMENTOS ----------------

const formMeta = document.getElementById("formMeta");
const emojiInput = document.getElementById("emoji");
const nomeInput = document.getElementById("nomeMeta");
const valorObjetivoInput = document.getElementById("valorObjetivo");
const valorAtualInput = document.getElementById("valorAtual");
const listaMetas = document.getElementById("listaMetas");
const btnSalvarMeta = document.getElementById("btnSalvarMeta");
const btnCancelarEdicaoMeta = document.getElementById("btnCancelarEdicaoMeta");

let metaEditandoId = null;

// ---------------- DADOS ----------------

function carregarMetas() {
    return JSON.parse(localStorage.getItem("metas")) || [];
}

function salvarMetas(metas) {
    return localStorage.setItem("metas", JSON.stringify(metas));
}

// Na primeira vez que a página é aberta, cria as duas metas
// que já apareciam (fixas) no dashboard, para não perder o que já existia.
function seedMetasIniciais() {
    const jaExiste = localStorage.getItem("metas");

    if (jaExiste === null) {
        const metasIniciais = [
            {
                id: Date.now(),
                emoji: "🚗",
                nome: "CNH",
                valorObjetivo: 3000,
                valorAtual: 0
            },
            {
                id: Date.now() + 1,
                emoji: "🛡️",
                nome: "Reserva",
                valorObjetivo: 5000,
                valorAtual: 0
            }
        ];

        salvarMetas(metasIniciais);
    }
}

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

// ---------------- FORMATAÇÃO ----------------

function moeda(valor) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

// ---------------- RENDERIZAÇÃO ----------------

function renderizarMetas() {

    const metas = carregarMetas();

    const opcoesBancos = carregarBancos()
        .map(b => `<option value="${b.nome}">${b.emoji} ${b.nome}</option>`)
        .join("");

    listaMetas.innerHTML = "";

    if (metas.length === 0) {
        listaMetas.innerHTML = `
            <div class="vazio">
                <h2>Nenhuma meta cadastrada.</h2>
                <p>Crie uma meta acima para começar.</p>
            </div>
        `;
        return;
    }

    metas.forEach(meta => {

        const percentual = meta.valorObjetivo > 0
            ? Math.min(100, (meta.valorAtual / meta.valorObjetivo) * 100)
            : 0;

        const completa = percentual >= 100;

        const card = document.createElement("div");
        card.className = "meta";

        card.innerHTML = `
            <div class="meta-topo">
                <div class="meta-titulo">
                    <span>${meta.emoji}</span>
                    <span>${meta.nome}</span>
                </div>
                <div class="meta-acoes">
                    <button class="meta-editar" data-id="${meta.id}" title="Editar meta">
                        ✏️
                    </button>
                    <button class="meta-excluir" data-id="${meta.id}" title="Excluir meta">
                        🗑️
                    </button>
                </div>
            </div>

            <div class="meta-valores">
                <span><strong>${moeda(meta.valorAtual)}</strong> de ${moeda(meta.valorObjetivo)}</span>
                <span>${percentual.toFixed(0)}%</span>
            </div>

            <div class="barra">
                <div class="progresso ${completa ? "completa" : ""}" style="width:${percentual}%"></div>
            </div>

            ${completa
                ? `<p class="meta-parabens">🎉 Meta concluída!</p>`
                : `
                <div class="meta-aporte">
                    <select data-id="${meta.id}" class="selectBancoAporte">
                        <option value="">De qual conta?</option>
                        ${opcoesBancos}
                    </select>
                    <input type="number" step="0.01" min="0.01" placeholder="Valor do aporte" data-id="${meta.id}" class="inputAporte">
                    <button type="button" data-id="${meta.id}" class="btnAporte">💰 Adicionar</button>
                </div>
                `
            }
        `;

        listaMetas.appendChild(card);
    });

    // Botões de editar
    document.querySelectorAll(".meta-editar").forEach(botao => {
        botao.addEventListener("click", () => {
            iniciarEdicaoMeta(Number(botao.dataset.id));
        });
    });

    // Botões de excluir
    document.querySelectorAll(".meta-excluir").forEach(botao => {
        botao.addEventListener("click", () => {
            excluirMeta(Number(botao.dataset.id));
        });
    });

    // Botões de aporte
    document.querySelectorAll(".btnAporte").forEach(botao => {
        botao.addEventListener("click", () => {
            adicionarAporte(Number(botao.dataset.id));
        });
    });
}

// ---------------- AÇÕES ----------------

function excluirMeta(id) {

    const metaExcluir = carregarMetas().find(m => m.id === id);

    const aviso = metaExcluir && Number(metaExcluir.valorAtual) > 0
        ? `Esta meta ainda tem ${moeda(Number(metaExcluir.valorAtual))} guardado. Se excluir, esse valor some do seu patrimônio. Retire o valor para uma conta antes, se quiser mantê-lo.\n\nExcluir mesmo assim?`
        : "Deseja realmente excluir esta meta?";

    if (!confirm(aviso)) return;

    const metas = carregarMetas().filter(meta => meta.id !== id);

    salvarMetas(metas);

    if (metaEditandoId === id) {
        cancelarEdicaoMeta();
    }

    renderizarMetas();
}

function iniciarEdicaoMeta(id) {

    const meta = carregarMetas().find(m => m.id === id);
    if (!meta) return;

    metaEditandoId = id;

    emojiInput.value = meta.emoji;
    nomeInput.value = meta.nome;
    valorObjetivoInput.value = meta.valorObjetivo;
    valorAtualInput.value = meta.valorAtual;

    btnSalvarMeta.textContent = "💾 Salvar alterações";
    btnCancelarEdicaoMeta.style.display = "block";

    formMeta.scrollIntoView({ behavior: "smooth" });
}

function cancelarEdicaoMeta() {

    metaEditandoId = null;

    formMeta.reset();

    btnSalvarMeta.textContent = "💾 Criar meta";
    btnCancelarEdicaoMeta.style.display = "none";
}

btnCancelarEdicaoMeta.addEventListener("click", cancelarEdicaoMeta);

async function adicionarAporte(id) {

    const input = document.querySelector(`.inputAporte[data-id="${id}"]`);
    const selectBanco = document.querySelector(`.selectBancoAporte[data-id="${id}"]`);
    const valor = Number(input.value);

    if (!selectBanco.value) {
        alert("Escolha de qual conta o dinheiro vai sair.");
        return;
    }

    if (!valor || valor <= 0) {
        alert("Digite um valor válido para o aporte.");
        return;
    }

    const metas = carregarMetas();

    const meta = metas.find(m => m.id === id);

    if (!meta) return;

    meta.valorAtual = Math.round((Number(meta.valorAtual) + valor) * 100) / 100;

    // O aporte é um lançamento de saída na conta escolhida (natureza
    // "Meta"), ligado à meta. Assim a conta, a meta e o patrimônio
    // continuam batendo, e a seção Reservas não é afetada.
    const movimentacoes = JSON.parse(localStorage.getItem("movimentacoes")) || [];

    movimentacoes.push({
        id: Date.now(),
        tipo: "Saída",
        natureza: "Meta",
        metaId: meta.id,
        banco: selectBanco.value,
        categoria: `Meta: ${meta.nome}`,
        valor,
        data: new Date().toLocaleDateString("en-CA"),
        descricao: `Aporte na meta ${meta.nome}`
    });

    await localStorage.setItem("movimentacoes", JSON.stringify(movimentacoes));
    await salvarMetas(metas);

    renderizarMetas();
}

// ---------------- CRIAR NOVA META ----------------

formMeta.addEventListener("submit", (e) => {

    e.preventDefault();

    const nome = nomeInput.value.trim();
    const valorObjetivo = Number(valorObjetivoInput.value);
    const valorAtual = Number(valorAtualInput.value) || 0;

    if (!nome || !valorObjetivo) {
        alert("Preencha o nome e o valor objetivo da meta.");
        return;
    }

    const metas = carregarMetas();

    if (metaEditandoId !== null) {

        const index = metas.findIndex(m => m.id === metaEditandoId);

        if (index !== -1) {
            metas[index] = {
                ...metas[index],
                emoji: emojiInput.value,
                nome,
                valorObjetivo,
                valorAtual
            };
        }

    } else {

        metas.push({
            id: Date.now(),
            emoji: emojiInput.value,
            nome,
            valorObjetivo,
            valorAtual
        });
    }

    salvarMetas(metas);

    metaEditandoId = null;
    btnSalvarMeta.textContent = "💾 Criar meta";
    btnCancelarEdicaoMeta.style.display = "none";

    formMeta.reset();

    renderizarMetas();
});

// ---------------- INICIALIZAÇÃO ----------------

seedMetasIniciais();
renderizarMetas();
