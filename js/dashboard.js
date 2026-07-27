import { protegerPagina, carregarDados, criarArmazenamento, sair } from "./utils.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

const movimentacoes =
    JSON.parse(localStorage.getItem("movimentacoes")) || [];

let saldoDisponivel = 0;
let patrimonioTotal = 0;

let entradas = 0;
let despesas = 0;
let reservas = 0;
let investimentos = 0;

movimentacoes.forEach((mov) => {

    if (mov.tipo === "Entrada") {

        entradas += mov.valor;

        saldoDisponivel += mov.valor;

    } else {

        switch (mov.natureza) {

            case "Despesa":
                despesas += mov.valor;
                saldoDisponivel -= mov.valor;
                break;

            case "Reserva":
                reservas += mov.valor;
                saldoDisponivel -= mov.valor;
                break;

            case "Investimento":
                investimentos += mov.valor;
                saldoDisponivel -= mov.valor;
                break;

            case "Resgate":
                // Dinheiro que já estava fora do saldo disponível (guardado na reserva)
                // volta a ser gasto: sai da reserva e entra como despesa,
                // sem mexer de novo no saldo disponível.
                reservas -= mov.valor;
                despesas += mov.valor;
                break;
        }

    }

});

patrimonioTotal =
    saldoDisponivel + reservas + investimentos;

function moeda(valor) {

    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

}

document.getElementById("patrimonioTotal").textContent = moeda(patrimonioTotal);
document.getElementById("saldoDisponivel").textContent = moeda(saldoDisponivel);

document.getElementById("totalEntradas").textContent = moeda(entradas);
document.getElementById("totalDespesas").textContent = moeda(despesas);
document.getElementById("totalReservas").textContent = moeda(reservas);
document.getElementById("totalInvestimentos").textContent = moeda(investimentos);

// ---------------- CONTAS (BANCOS) ----------------

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

function calcularSaldoBanco(nomeBanco) {

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

function renderizarContas() {

    const bancos = carregarBancos();
    const listaContas = document.getElementById("listaContas");

    listaContas.innerHTML = "";

    if (bancos.length === 0) {
        listaContas.innerHTML = `
            <div class="vazio">
                <h2>Nenhuma conta cadastrada.</h2>
                <p>Cadastre uma conta na página de Bancos.</p>
            </div>
        `;
        return;
    }

    bancos.forEach(banco => {

        const saldo = calcularSaldoBanco(banco.nome);

        const card = document.createElement("div");
        card.className = `conta cor-${banco.cor}`;

        card.innerHTML = `
            <div>
                <h3>${banco.emoji} ${banco.nome}</h3>
                <p>Saldo disponível</p>
            </div>
            <strong>${moeda(saldo)}</strong>
        `;

        listaContas.appendChild(card);
    });
}

renderizarContas();

// ---------------- METAS ----------------

function carregarMetas() {

    let metas = JSON.parse(localStorage.getItem("metas"));

    if (metas === null) {

        metas = [
            {
                id: 1,
                emoji: "🚗",
                nome: "CNH",
                valorObjetivo: 3000,
                valorAtual: 0
            },
            {
                id: 2,
                emoji: "🛡️",
                nome: "Reserva",
                valorObjetivo: 5000,
                valorAtual: 0
            }
        ];

        localStorage.setItem("metas", JSON.stringify(metas));
    }

    return metas;
}

function renderizarMetasDashboard() {

    const metas = carregarMetas();
    const listaMetasDash = document.getElementById("listaMetasDash");

    listaMetasDash.innerHTML = "";

    if (metas.length === 0) {
        listaMetasDash.innerHTML = `
            <div class="vazio">
                <h2>Nenhuma meta cadastrada.</h2>
                <p>Crie uma meta na página de Metas.</p>
            </div>
        `;
        return;
    }

    metas.forEach(meta => {

        const percentual = meta.valorObjetivo > 0
            ? Math.min(100, (meta.valorAtual / meta.valorObjetivo) * 100)
            : 0;

        const card = document.createElement("div");
        card.className = "meta";

        card.innerHTML = `
            <div class="meta-topo">
                <span>${meta.emoji} ${meta.nome}</span>
                <span>${percentual.toFixed(0)}%</span>
            </div>
            <div class="barra">
                <div class="progresso" style="width:${percentual}%"></div>
            </div>
        `;

        listaMetasDash.appendChild(card);
    });
}

renderizarMetasDashboard();

// ---------------- ÚLTIMAS MOVIMENTAÇÕES ----------------

function renderizarUltimasMovimentacoes() {

    const container = document.getElementById("ultimasMovimentacoes");

    const ultimas = [...movimentacoes]
        .sort((a, b) => b.id - a.id)
        .slice(0, 5);

    if (ultimas.length === 0) {
        container.innerHTML = `
            <p class="sem-movimentacoes">
                Nenhuma movimentação cadastrada.
            </p>
        `;
        return;
    }

    container.innerHTML = "";

    ultimas.forEach(mov => {

        let classe = "";
        let sinal = "";
        let textoNatureza = "";

        if (mov.tipo === "Entrada") {
            classe = "entrada";
            sinal = "+";
            textoNatureza = "Entrada";
        } else if (mov.natureza === "Despesa") {
            classe = "despesa";
            sinal = "-";
            textoNatureza = "Despesa";
        } else if (mov.natureza === "Reserva") {
            classe = "reserva";
            sinal = "🏦";
            textoNatureza = "Reserva";
        } else if (mov.natureza === "Resgate") {
            classe = "despesa";
            sinal = "🏧";
            textoNatureza = "Retirada da Reserva";
        } else {
            classe = "investimento";
            sinal = "📈";
            textoNatureza = "Investimento";
        }

        const card = document.createElement("div");
        card.className = "movimentacao";

        card.innerHTML = `
            <div class="info">
                <h3>${mov.categoria}</h3>
                <p>${mov.descricao || "Sem descrição"}</p>
                <p>${mov.banco}</p>
                <p>${mov.data}</p>
                <p>${textoNatureza}</p>
            </div>
            <div class="valor ${classe}">
                ${sinal} ${moeda(mov.valor)}
            </div>
            <div class="acoesMov">
                <button class="btnEditar" data-id="${mov.id}" title="Editar">✏️</button>
                <button class="btnExcluir" data-id="${mov.id}" title="Excluir">🗑️</button>
            </div>
        `;

        container.appendChild(card);
    });

    container.querySelectorAll(".btnEditar").forEach(btn => {
        btn.addEventListener("click", () => {
            window.location.href = `adicionar.html?id=${btn.dataset.id}`;
        });
    });

    container.querySelectorAll(".btnExcluir").forEach(btn => {
        btn.addEventListener("click", async () => {
            const confirmar = confirm("Tem certeza que deseja excluir essa movimentação?");
            if (!confirmar) return;

            const id = Number(btn.dataset.id);
            let todasMovimentacoes = JSON.parse(localStorage.getItem("movimentacoes")) || [];
            todasMovimentacoes = todasMovimentacoes.filter(mov => mov.id !== id);

            // espera o Firestore confirmar antes de recarregar a página,
            // senão o reload cancela o salvamento no meio do caminho
            await localStorage.setItem("movimentacoes", JSON.stringify(todasMovimentacoes));

            window.location.reload();
        });
    });
}

renderizarUltimasMovimentacoes();

// ---------------- BOTÃO NOVA MOVIMENTAÇÃO ----------------

const botao = document.getElementById("novaMovimentacao");

if (botao) {

    botao.addEventListener("click", () => {

        window.location.href = "adicionar.html";

    });

}
