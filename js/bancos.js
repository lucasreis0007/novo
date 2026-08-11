import { protegerPagina, carregarDados, criarArmazenamento, sair } from "./utils.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

// ---------------- ELEMENTOS ----------------

const formBanco = document.getElementById("formBanco");
const emojiInput = document.getElementById("emoji");
const nomeInput = document.getElementById("nomeBanco");
const corInput = document.getElementById("cor");
const listaBancos = document.getElementById("listaBancos");

// ---------------- DADOS ----------------

// Carrega os bancos salvos. Na primeira vez que o app for usado,
// cria os 4 bancos que já existiam fixos no dashboard, pra não perder nada.
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

function salvarBancos(bancos) {
    localStorage.setItem("bancos", JSON.stringify(bancos));
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

function calcularSaldo(nomeBanco) {

    const movimentacoes = carregarMovimentacoes();

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

// ---------------- RENDERIZAÇÃO ----------------

function renderizarBancos() {

    const bancos = carregarBancos();

    listaBancos.innerHTML = "";

    if (bancos.length === 0) {
        listaBancos.innerHTML = `
            <div class="vazio">
                <h2>Nenhuma conta cadastrada.</h2>
                <p>Adicione uma conta acima para começar.</p>
            </div>
        `;
        return;
    }

    bancos.forEach(banco => {

        const saldo = calcularSaldo(banco.nome);

        const card = document.createElement("div");
        card.className = `conta cor-${banco.cor}`;

        card.innerHTML = `
            <div class="conta-info">
                <div>
                    <h3>${banco.emoji} ${banco.nome}</h3>
                    <p>Saldo disponível</p>
                </div>
                <strong>${moeda(saldo)}</strong>
            </div>
            <button class="conta-excluir" data-id="${banco.id}" title="Excluir conta">
                🗑️
            </button>
        `;

        listaBancos.appendChild(card);
    });

    document.querySelectorAll(".conta-excluir").forEach(botao => {
        botao.addEventListener("click", () => {
            excluirBanco(Number(botao.dataset.id));
        });
    });
}

// ---------------- AÇÕES ----------------

function excluirBanco(id) {

    if (!confirm("Deseja realmente excluir esta conta? As movimentações antigas não serão apagadas.")) return;

    const bancos = carregarBancos().filter(banco => banco.id !== id);

    salvarBancos(bancos);
    renderizarBancos();
}

formBanco.addEventListener("submit", (e) => {

    e.preventDefault();

    const novoBanco = {
        id: Date.now(),
        emoji: emojiInput.value,
        nome: nomeInput.value.trim(),
        cor: Number(corInput.value)
    };

    if (!novoBanco.nome) {
        alert("Digite o nome do banco ou conta.");
        return;
    }

    const bancos = carregarBancos();

    const jaExiste = bancos.some(
        b => b.nome.toLowerCase() === novoBanco.nome.toLowerCase()
    );

    if (jaExiste) {
        alert("Já existe uma conta com esse nome.");
        return;
    }

    bancos.push(novoBanco);

    salvarBancos(bancos);

    formBanco.reset();

    renderizarBancos();
});

// ---------------- INICIALIZAÇÃO ----------------

renderizarBancos();
