import { protegerPagina, carregarDados, criarArmazenamento, sair } from "./utils.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

// ---------------- ELEMENTOS ----------------

const tituloMes = document.getElementById("tituloMes");
const botaoHoje = document.getElementById("botaoHoje");
const mesAnterior = document.getElementById("mesAnterior");
const mesProximo = document.getElementById("mesProximo");

const gradeCalendario = document.getElementById("gradeCalendario");

const totalEntradasMes = document.getElementById("totalEntradasMes");
const totalSaidasMes = document.getElementById("totalSaidasMes");

const tituloDiaSelecionado = document.getElementById("tituloDiaSelecionado");
const listaDia = document.getElementById("listaDia");
const btnAdicionarDia = document.getElementById("btnAdicionarDia");

// ---------------- DADOS ----------------

let movimentacoes = JSON.parse(localStorage.getItem("movimentacoes")) || [];

const NOMES_MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// ---------------- DATAS (sem fuso horário, sempre local) ----------------

function formatarISO(data) {

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
}

function paraDataLocal(dataISO) {

    const [ano, mes, dia] = dataISO.split("-").map(Number);
    return new Date(ano, mes - 1, dia);
}

const hoje = new Date();
const hojeISO = formatarISO(hoje);

let referencia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
let diaSelecionadoISO = hojeISO;

// ---------------- FORMATAÇÃO ----------------

function formatarMoeda(valor) {

    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

// Classifica a movimentação do mesmo jeito que o Histórico, pra manter
// os rótulos e cores consistentes em todo o app.
function classificarMovimentacao(mov) {

    if (mov.natureza === "Transferência") {

        return mov.tipo === "Entrada"
            ? { classe: "entrada", sinal: "⬇️", texto: "Transferência recebida" }
            : { classe: "despesa", sinal: "⬆️", texto: "Transferência enviada" };
    }

    if (mov.tipo === "Entrada") {
        return { classe: "entrada", sinal: "+", texto: "Entrada" };
    }

    if (mov.natureza === "Despesa") {
        return { classe: "despesa", sinal: "-", texto: "Despesa" };
    }

    if (mov.natureza === "Reserva") {
        return { classe: "reserva", sinal: "🏦", texto: "Reserva" };
    }

    if (mov.natureza === "Rendimento") {
        return { classe: "reserva", sinal: "🌱", texto: "Rendimento da Reserva" };
    }

    if (mov.natureza === "Resgate") {
        return { classe: "despesa", sinal: "🏧", texto: "Retirada da Reserva" };
    }

    return { classe: "investimento", sinal: "📈", texto: "Investimento" };
}

function movimentacoesDoDia(dataISO) {
    return movimentacoes.filter(mov => mov.data === dataISO);
}

// ---------------- GRADE DO CALENDÁRIO ----------------

function renderizarCalendario() {

    const ano = referencia.getFullYear();
    const mes = referencia.getMonth();

    tituloMes.textContent = `${NOMES_MESES[mes]} ${ano}`;

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const diasMesAnterior = new Date(ano, mes, 0).getDate();

    const totalCelulas = Math.ceil((primeiroDiaSemana + diasNoMes) / 7) * 7;

    gradeCalendario.innerHTML = "";

    for (let i = 0; i < totalCelulas; i++) {

        let dia;
        let mesOffset = 0;
        let anoCelula = ano;
        let mesCelula = mes;

        if (i < primeiroDiaSemana) {
            dia = diasMesAnterior - (primeiroDiaSemana - 1 - i);
            mesOffset = -1;
        } else if (i >= primeiroDiaSemana + diasNoMes) {
            dia = i - (primeiroDiaSemana + diasNoMes) + 1;
            mesOffset = 1;
        } else {
            dia = i - primeiroDiaSemana + 1;
        }

        if (mesOffset === -1) {
            mesCelula = mes - 1;
            if (mesCelula < 0) { mesCelula = 11; anoCelula = ano - 1; }
        } else if (mesOffset === 1) {
            mesCelula = mes + 1;
            if (mesCelula > 11) { mesCelula = 0; anoCelula = ano + 1; }
        }

        const dataCelula = new Date(anoCelula, mesCelula, dia);
        const dataISO = formatarISO(dataCelula);

        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "dia-cel";
        botao.dataset.data = dataISO;
        botao.dataset.offset = String(mesOffset);

        if (mesOffset !== 0) botao.classList.add("outro-mes");
        if (dataISO === hojeISO) botao.classList.add("dia-hoje");
        if (dataISO === diaSelecionadoISO) botao.classList.add("dia-selecionado");

        const movsDoDia = movimentacoesDoDia(dataISO);
        const tiposPresentes = [...new Set(movsDoDia.map(mov => mov.tipo))];

        const pontosHtml = tiposPresentes.map(tipo => {
            const classePonto =
                tipo === "Entrada" ? "entrada" :
                tipo === "Rendimento" ? "rendimento" : "despesa";
            return `<span class="ponto ${classePonto}"></span>`;
        }).join("");

        botao.innerHTML = `
            <span class="numero-dia">${dia}</span>
            <span class="pontos">${pontosHtml}</span>
        `;

        botao.addEventListener("click", () => selecionarDia(dataISO, mesOffset));

        gradeCalendario.appendChild(botao);
    }
}

// ---------------- RESUMO DO MÊS ----------------

function calcularResumoMes() {

    const ano = referencia.getFullYear();
    const mes = String(referencia.getMonth() + 1).padStart(2, "0");
    const prefixo = `${ano}-${mes}`;

    let entradas = 0;
    let saidas = 0;

    movimentacoes
        .filter(mov => (mov.data || "").startsWith(prefixo))
        .forEach(mov => {

            if (mov.tipo === "Entrada") {
                entradas += Number(mov.valor);
            } else if (mov.tipo === "Saída" && mov.natureza !== "Resgate") {
                saidas += Number(mov.valor);
            }
        });

    totalEntradasMes.textContent = formatarMoeda(entradas);
    totalSaidasMes.textContent = formatarMoeda(saidas);
}

// ---------------- DIA SELECIONADO ----------------

function renderizarDia() {

    const dataLocal = paraDataLocal(diaSelecionadoISO);

    const textoData = dataLocal.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long"
    });

    tituloDiaSelecionado.textContent =
        diaSelecionadoISO === hojeISO ? `Hoje, ${textoData}` : textoData;

    const movsDoDia = movimentacoesDoDia(diaSelecionadoISO)
        .sort((a, b) => b.id - a.id);

    listaDia.innerHTML = "";

    if (movsDoDia.length === 0) {

        listaDia.innerHTML = `
            <div class="vazioDia">
                Nenhuma movimentação agendada para esse dia.
            </div>
        `;

        return;
    }

    movsDoDia.forEach(mov => {

        const { classe, sinal, texto } = classificarMovimentacao(mov);

        const card = document.createElement("div");
        card.className = "movimentacaoDia";

        card.innerHTML = `
            <div class="info">
                <h3>${mov.categoria}</h3>
                <p>${mov.descricao || "Sem descrição"}</p>
                <p>${mov.banco || "Direto na reserva"} · ${texto}</p>
            </div>
            <div class="valor ${classe}">
                ${sinal} ${formatarMoeda(mov.valor)}
            </div>
            <div class="acoesMovDia">
                <button class="btnEditarDia" data-id="${mov.id}" title="Editar">✏️</button>
                <button class="btnExcluirDia" data-id="${mov.id}" title="Excluir">🗑️</button>
            </div>
        `;

        listaDia.appendChild(card);
    });

    listaDia.querySelectorAll(".btnEditarDia").forEach(btn => {
        btn.addEventListener("click", () => {
            window.location.href = `adicionar.html?id=${btn.dataset.id}&origem=calendario&data=${diaSelecionadoISO}`;
        });
    });

    listaDia.querySelectorAll(".btnExcluirDia").forEach(btn => {
        btn.addEventListener("click", async () => {

            const confirmar = confirm("Tem certeza que deseja excluir essa movimentação?");
            if (!confirmar) return;

            const id = Number(btn.dataset.id);
            movimentacoes = movimentacoes.filter(mov => mov.id !== id);

            await localStorage.setItem("movimentacoes", JSON.stringify(movimentacoes));

            atualizarTudo();
        });
    });
}

// ---------------- NAVEGAÇÃO ----------------

function selecionarDia(dataISO, mesOffset) {

    if (mesOffset !== 0) {
        referencia = new Date(paraDataLocal(dataISO).getFullYear(), paraDataLocal(dataISO).getMonth(), 1);
    }

    diaSelecionadoISO = dataISO;

    atualizarTudo();
}

function mudarMes(delta) {

    referencia = new Date(referencia.getFullYear(), referencia.getMonth() + delta, 1);
    diaSelecionadoISO = formatarISO(referencia);

    atualizarTudo();
}

function irParaHoje() {

    referencia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    diaSelecionadoISO = hojeISO;

    atualizarTudo();
}

function atualizarTudo() {
    renderizarCalendario();
    calcularResumoMes();
    renderizarDia();
}

mesAnterior.addEventListener("click", () => mudarMes(-1));
mesProximo.addEventListener("click", () => mudarMes(1));
botaoHoje.addEventListener("click", irParaHoje);

btnAdicionarDia.addEventListener("click", () => {
    window.location.href = `adicionar.html?data=${diaSelecionadoISO}&origem=calendario`;
});

// Se voltamos da tela de adicionar já sabendo o dia usado, seleciona ele.
const parametros = new URLSearchParams(window.location.search);
const dataDaUrl = parametros.get("data");

if (dataDaUrl) {
    const dataValida = paraDataLocal(dataDaUrl);
    referencia = new Date(dataValida.getFullYear(), dataValida.getMonth(), 1);
    diaSelecionadoISO = dataDaUrl;
}

atualizarTudo();
