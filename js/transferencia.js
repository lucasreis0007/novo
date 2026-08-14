import { protegerPagina, carregarDados, criarArmazenamento, sair } from "./utils.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

// ---------------- ELEMENTOS ----------------

const formulario = document.getElementById("formTransferencia");

const contaOrigem = document.getElementById("contaOrigem");
const contaDestino = document.getElementById("contaDestino");
const saldoOrigem = document.getElementById("saldoOrigem");
const saldoDestino = document.getElementById("saldoDestino");
const avisoTransferencia = document.getElementById("avisoTransferencia");

// ---------------- BANCOS ----------------

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

function popularContas() {

    const bancos = carregarBancos();

    const opcoes = bancos.map(item =>
        `<option value="${item.nome}">${item.emoji} ${item.nome}</option>`
    ).join("");

    contaOrigem.innerHTML = '<option value="">Selecione</option>' + opcoes;
    contaDestino.innerHTML = '<option value="">Selecione</option>' + opcoes;
}

popularContas();

// ---------------- SALDO DA CONTA DE ORIGEM ----------------

function moeda(valor) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function calcularSaldo(nomeBanco) {

    const movimentacoes = JSON.parse(localStorage.getItem("movimentacoes")) || [];

    let saldo = 0;

    movimentacoes.forEach(mov => {

        if (mov.banco !== nomeBanco) return;

        // Retirada da reserva entra nessa conta, então soma como entrada.
        if (mov.tipo === "Entrada" || mov.natureza === "Resgate") {
            saldo += Number(mov.valor);
        } else {
            saldo -= Number(mov.valor);
        }

    });

    return saldo;
}

function atualizarSaldoOrigem() {

    if (!contaOrigem.value) {
        saldoOrigem.textContent = moeda(0);
        return;
    }

    saldoOrigem.textContent = moeda(calcularSaldo(contaOrigem.value));
}

function atualizarSaldoDestino() {

    if (!contaDestino.value) {
        saldoDestino.textContent = moeda(0);
        return;
    }

    saldoDestino.textContent = moeda(calcularSaldo(contaDestino.value));
}

contaOrigem.addEventListener("change", () => {
    atualizarSaldoOrigem();
    validarContasIguais();
});

contaDestino.addEventListener("change", () => {
    atualizarSaldoDestino();
    validarContasIguais();
});

// ---------------- VALIDAÇÃO: ORIGEM IGUAL A DESTINO ----------------

function validarContasIguais() {

    const iguais =
        contaOrigem.value !== "" &&
        contaDestino.value !== "" &&
        contaOrigem.value === contaDestino.value;

    if (iguais) {
        avisoTransferencia.textContent = "A conta de destino precisa ser diferente da conta de origem.";
        avisoTransferencia.classList.add("visivel");
    } else {
        avisoTransferencia.textContent = "";
        avisoTransferencia.classList.remove("visivel");
    }

    return iguais;
}

// ---------------- DATA PADRÃO ----------------

document.getElementById("data").value = new Date().toISOString().slice(0, 10);

atualizarSaldoOrigem();
atualizarSaldoDestino();

formulario.addEventListener("submit", async function (e) {

    e.preventDefault();

    if (contaOrigem.value === "" || contaDestino.value === "") {
        alert("Selecione a conta de origem e a conta de destino.");
        return;
    }

    if (validarContasIguais()) {
        return;
    }

    const valor = Number(document.getElementById("valor").value);

    if (!valor || valor <= 0) {
        alert("Digite um valor válido.");
        return;
    }

    const data = document.getElementById("data").value;
    const descricao = document.getElementById("descricao").value;

    const movimentacoes = JSON.parse(localStorage.getItem("movimentacoes")) || [];

    const idTransferencia = Date.now();

    // Duas movimentações ligadas pelo mesmo transferenciaId: uma saída
    // na conta de origem e uma entrada na conta de destino. A natureza
    // "Transferência" é o que faz o dashboard e os relatórios saberem
    // que isso não é uma despesa nem uma receita de verdade, só dinheiro
    // mudando de lugar.
    const saida = {
        id: idTransferencia,
        transferenciaId: idTransferencia,
        tipo: "Saída",
        natureza: "Transferência",
        banco: contaOrigem.value,
        categoria: "Transferência enviada",
        valor,
        data,
        descricao: descricao || `Transferência para ${contaDestino.value}`
    };

    const entrada = {
        id: idTransferencia + 1,
        transferenciaId: idTransferencia,
        tipo: "Entrada",
        natureza: "Transferência",
        banco: contaDestino.value,
        categoria: "Transferência recebida",
        valor,
        data,
        descricao: descricao || `Transferência de ${contaOrigem.value}`
    };

    movimentacoes.push(saida, entrada);

    // espera o Firestore confirmar antes de trocar de página, senão a
    // navegação cancela o salvamento antes dele terminar
    await localStorage.setItem("movimentacoes", JSON.stringify(movimentacoes));

    window.location.href = "dashboard.html";
});
