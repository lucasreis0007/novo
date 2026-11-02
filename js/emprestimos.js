import { protegerPagina, carregarDados, criarArmazenamento, sair } from "./utils.js";
import {
    listarEmprestimos,
    totaisEmprestimos,
    sincronizarLembretesEmprestimo,
    acharEmprestimosAntigos,
    converterEmprestimosAntigos,
    categoriaDaDevolucao,
    categoriaDoPerdao,
    formatarMoeda,
    formatarDataBR,
    NATUREZA_DEVOLUCAO,
    NATUREZA_PERDAO
} from "./emprestimos-core.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

// ---------------- ELEMENTOS ----------------

const listaEmprestimos = document.getElementById("listaEmprestimos");
const abaAbertos = document.getElementById("abaAbertos");
const abaEncerrados = document.getElementById("abaEncerrados");
const avisoMigracao = document.getElementById("avisoMigracao");
const textoMigracao = document.getElementById("textoMigracao");
const btnMigrar = document.getElementById("btnMigrar");

let abaAtiva = "abertos";

// ---------------- DADOS ----------------

function carregarMovimentacoes() {
    return JSON.parse(localStorage.getItem("movimentacoes")) || [];
}

function carregarLembretes() {
    return JSON.parse(localStorage.getItem("lembretes")) || [];
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

function escapar(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function hojeISO() {
    return new Date().toLocaleDateString("en-CA");
}

// Grava as movimentações e deixa os lembretes de cobrança em dia.
async function salvarTudo(movimentacoes) {

    await localStorage.setItem("movimentacoes", JSON.stringify(movimentacoes));

    await localStorage.setItem(
        "lembretes",
        JSON.stringify(sincronizarLembretesEmprestimo(movimentacoes, carregarLembretes()))
    );
}

// ---------------- RENDERIZAÇÃO ----------------

function textoStatus(emprestimo) {

    if (emprestimo.status === "quitado") return { classe: "quitado", texto: "Quitado" };
    if (emprestimo.status === "perdoado") return { classe: "perdoado", texto: "Perdoado" };

    return emprestimo.direcao === "dado"
        ? { classe: "te-deve", texto: "Te deve" }
        : { classe: "voce-deve", texto: "Você deve" };
}

function renderizarResumo(movimentacoes) {

    const totais = totaisEmprestimos(movimentacoes);

    document.getElementById("totalAReceber").textContent = formatarMoeda(totais.aReceber);
    document.getElementById("totalAPagar").textContent = formatarMoeda(totais.aPagar);
}

function renderizarAvisoMigracao(movimentacoes) {

    const antigos = acharEmprestimosAntigos(movimentacoes);

    if (antigos.length === 0) {
        avisoMigracao.style.display = "none";
        return;
    }

    avisoMigracao.style.display = "flex";

    textoMigracao.textContent = antigos.length === 1
        ? "Encontrei 1 empréstimo antigo lançado como despesa. Quer convertê-lo? Ele deixa de contar como gasto e passa a aparecer aqui, com a devolução."
        : `Encontrei ${antigos.length} empréstimos antigos lançados como despesa. Quer convertê-los? Eles deixam de contar como gasto e passam a aparecer aqui, com as devoluções.`;
}

function renderizar() {

    const movimentacoes = carregarMovimentacoes();

    renderizarResumo(movimentacoes);
    renderizarAvisoMigracao(movimentacoes);

    const todos = listarEmprestimos(movimentacoes);

    const lista = todos
        .filter(e => abaAtiva === "abertos" ? e.saldo > 0 : e.saldo === 0)
        .sort((a, b) => {
            // em aberto: quem vence primeiro aparece antes; encerrados: mais novos primeiro
            if (abaAtiva === "abertos") {
                return (a.dataPrevista || "9999").localeCompare(b.dataPrevista || "9999");
            }
            return String(b.data).localeCompare(String(a.data));
        });

    const opcoesBancos = carregarBancos()
        .map(b => `<option value="${escapar(b.nome)}">${b.emoji} ${escapar(b.nome)}</option>`)
        .join("");

    listaEmprestimos.innerHTML = "";

    if (lista.length === 0) {
        listaEmprestimos.innerHTML = `
            <div class="vazio">
                <h2>${abaAtiva === "abertos" ? "Nenhum empréstimo em aberto." : "Nenhum empréstimo encerrado."}</h2>
                <p>${abaAtiva === "abertos" ? "Quando você emprestar ou pegar emprestado, aparece aqui." : "Os quitados e perdoados ficam aqui."}</p>
            </div>
        `;
        return;
    }

    const hoje = hojeISO();

    lista.forEach(emprestimo => {

        const status = textoStatus(emprestimo);
        const dado = emprestimo.direcao === "dado";

        const abatido = emprestimo.devolvido + emprestimo.perdoado;
        const percentual = emprestimo.valor > 0 ? Math.min(100, (abatido / emprestimo.valor) * 100) : 0;

        const atrasado = emprestimo.saldo > 0 && emprestimo.dataPrevista && emprestimo.dataPrevista < hoje;

        const card = document.createElement("div");
        card.className = "emprestimo";

        const linhasDevolucoes = emprestimo.devolucoes
            .slice()
            .sort((a, b) => String(a.data).localeCompare(String(b.data)))
            .map(mov => `
                <div class="devolucoes-linha">
                    <span>${formatarDataBR(mov.data)} · ${escapar(mov.banco)}</span>
                    <strong>${formatarMoeda(mov.valor)}</strong>
                </div>
            `)
            .join("");

        card.innerHTML = `
            <div class="emprestimo-topo">
                <div>
                    <div class="emprestimo-pessoa">${dado ? "🤝" : "🙋"} ${escapar(emprestimo.pessoa)}</div>
                    <span class="chip ${status.classe}">${status.texto}</span>
                </div>
                <div>${formatarMoeda(emprestimo.valor)}</div>
            </div>

            <div class="emprestimo-valores">
                <span>${dado ? "Recebido" : "Pago"}: <strong>${formatarMoeda(emprestimo.devolvido)}</strong></span>
                <span>${percentual.toFixed(0)}%</span>
            </div>

            <div class="barra">
                <div class="progresso ${dado ? "" : "voce-deve"} ${emprestimo.saldo === 0 ? "completo" : ""}" style="width:${percentual}%"></div>
            </div>

            ${emprestimo.perdoado > 0 ? `<p class="emprestimo-prazo">Perdoado: ${formatarMoeda(emprestimo.perdoado)}</p>` : ""}

            ${emprestimo.saldo > 0 ? `
                <p class="emprestimo-saldo">Falta <strong>${formatarMoeda(emprestimo.saldo)}</strong></p>
                <p class="emprestimo-prazo ${atrasado ? "atrasado" : ""}">
                    ${emprestimo.dataPrevista
                        ? `${atrasado ? "Atrasado desde" : "Previsto para"} ${formatarDataBR(emprestimo.dataPrevista)}`
                        : "Sem data prevista"}
                </p>
            ` : ""}

            ${emprestimo.saldo > 0 ? `
                <div class="emprestimo-acao">
                    <div class="emprestimo-acao-linha">
                        <select class="selectBanco" data-id="${emprestimo.id}">
                            <option value="">${dado ? "Que conta recebeu?" : "De qual conta?"}</option>
                            ${opcoesBancos}
                        </select>
                        <input type="number" step="0.01" min="0.01" class="inputValor" data-id="${emprestimo.id}"
                            placeholder="Valor" value="${emprestimo.saldo}">
                    </div>
                    <button type="button" class="btnRegistrar" data-id="${emprestimo.id}">
                        ${dado ? "💵 Registrar recebimento" : "💸 Registrar pagamento"}
                    </button>
                    ${dado ? `<button type="button" class="btnPerdoar" data-id="${emprestimo.id}">🙏 Perdoar o que falta</button>` : ""}
                </div>
            ` : ""}

            ${linhasDevolucoes ? `<div class="devolucoes">${linhasDevolucoes}</div>` : ""}
        `;

        const selectBanco = card.querySelector(".selectBanco");

        if (selectBanco && emprestimo.banco) {
            selectBanco.value = emprestimo.banco;
        }

        listaEmprestimos.appendChild(card);
    });

    listaEmprestimos.querySelectorAll(".btnRegistrar").forEach(botao => {
        botao.addEventListener("click", () => registrarDevolucao(botao.dataset.id));
    });

    listaEmprestimos.querySelectorAll(".btnPerdoar").forEach(botao => {
        botao.addEventListener("click", () => perdoar(botao.dataset.id));
    });
}

// ---------------- AÇÕES ----------------

async function registrarDevolucao(id) {

    const movimentacoes = carregarMovimentacoes();

    const emprestimo = listarEmprestimos(movimentacoes).find(e => String(e.id) === String(id));

    if (!emprestimo || emprestimo.saldo <= 0) return;

    const selectBanco = listaEmprestimos.querySelector(`.selectBanco[data-id="${id}"]`);
    const inputValor = listaEmprestimos.querySelector(`.inputValor[data-id="${id}"]`);

    const valor = Math.round(Number(inputValor.value) * 100) / 100;

    if (!selectBanco.value) {
        alert(emprestimo.direcao === "dado" ? "Escolha a conta que recebeu o dinheiro." : "Escolha de qual conta o dinheiro vai sair.");
        return;
    }

    if (!valor || valor <= 0) {
        alert("Digite um valor válido.");
        return;
    }

    if (valor > emprestimo.saldo + 0.004) {
        alert(`O valor é maior que o que falta (${formatarMoeda(emprestimo.saldo)}).`);
        return;
    }

    movimentacoes.push({
        id: Date.now(),
        tipo: emprestimo.direcao === "dado" ? "Entrada" : "Saída",
        natureza: NATUREZA_DEVOLUCAO,
        emprestimoId: emprestimo.id,
        banco: selectBanco.value,
        categoria: categoriaDaDevolucao(emprestimo.direcao, emprestimo.pessoa),
        valor,
        data: hojeISO(),
        descricao: emprestimo.direcao === "dado"
            ? `Recebimento de ${emprestimo.pessoa}`
            : `Pagamento a ${emprestimo.pessoa}`
    });

    await salvarTudo(movimentacoes);

    renderizar();
}

// Perdão: só para quem te deve. O que faltava vira perda (despesa) e o
// empréstimo é encerrado. Não mexe em nenhuma conta.
async function perdoar(id) {

    const movimentacoes = carregarMovimentacoes();

    const emprestimo = listarEmprestimos(movimentacoes).find(e => String(e.id) === String(id));

    if (!emprestimo || emprestimo.saldo <= 0 || emprestimo.direcao !== "dado") return;

    const confirmar = confirm(
        `Perdoar ${formatarMoeda(emprestimo.saldo)} que ${emprestimo.pessoa} ainda te deve?\n\n` +
        "Esse valor passa a contar como perda (despesa) e o empréstimo é encerrado."
    );

    if (!confirmar) return;

    movimentacoes.push({
        id: Date.now(),
        tipo: "Saída",
        natureza: NATUREZA_PERDAO,
        emprestimoId: emprestimo.id,
        banco: "",
        categoria: categoriaDoPerdao(emprestimo.pessoa),
        valor: emprestimo.saldo,
        data: hojeISO(),
        descricao: `Perdão do que ${emprestimo.pessoa} devia`
    });

    await salvarTudo(movimentacoes);

    renderizar();
}

btnMigrar.addEventListener("click", async () => {

    const movimentacoes = carregarMovimentacoes();

    const antigos = acharEmprestimosAntigos(movimentacoes);

    if (antigos.length === 0) return;

    const confirmar = confirm(
        `Converter ${antigos.length} empréstimo(s) antigo(s)?\n\n` +
        "Eles deixam de contar como despesa e passam a ser empréstimos de verdade. " +
        "As devoluções que você já marcou no Calendário também são convertidas."
    );

    if (!confirmar) return;

    const resultado = converterEmprestimosAntigos(movimentacoes, carregarLembretes());

    await localStorage.setItem("movimentacoes", JSON.stringify(resultado.movimentacoes));
    await localStorage.setItem("lembretes", JSON.stringify(resultado.lembretes));

    renderizar();
});

// ---------------- ABAS ----------------

function trocarAba(aba) {

    abaAtiva = aba;

    abaAbertos.classList.toggle("ativa", aba === "abertos");
    abaEncerrados.classList.toggle("ativa", aba === "encerrados");

    renderizar();
}

abaAbertos.addEventListener("click", () => trocarAba("abertos"));
abaEncerrados.addEventListener("click", () => trocarAba("encerrados"));

// ---------------- INICIALIZAÇÃO ----------------

renderizar();
