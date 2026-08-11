import { protegerPagina, carregarDados, criarArmazenamento, sair, iconeCategoria } from "./utils.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

// Carregado uma vez só pra resolver os ícones personalizados das categorias.
const categoriasSalvas = JSON.parse(localStorage.getItem("categorias")) || {};

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

const btnAdicionarLembrete = document.getElementById("btnAdicionarLembrete");
const painelLembrete = document.getElementById("painelLembrete");
const listaLembretesDia = document.getElementById("listaLembretesDia");

const lembreteTitulo = document.getElementById("lembreteTitulo");
const lembreteValor = document.getElementById("lembreteValor");
const lembreteRecorrente = document.getElementById("lembreteRecorrente");
const lembreteObservacao = document.getElementById("lembreteObservacao");
const btnSalvarLembrete = document.getElementById("btnSalvarLembrete");
const btnCancelarLembrete = document.getElementById("btnCancelarLembrete");

// ---------------- DADOS ----------------

let movimentacoes = JSON.parse(localStorage.getItem("movimentacoes")) || [];
let lembretes = JSON.parse(localStorage.getItem("lembretes")) || [];

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

// ---------------- LEMBRETES ----------------
// Um lembrete é diferente de uma movimentação: ele não mexe no saldo,
// é só um aviso de "nesse dia eu preciso pagar tal coisa". Pode ser
// mensal (repete todo mês no mesmo dia, tipo aluguel) ou único (só
// naquela data específica).

function diasNoMesDe(ano, mesIndex) {
    return new Date(ano, mesIndex + 1, 0).getDate();
}

// Se o lembrete é mensal no dia 31 e o mês só tem 30 dias (ou é
// fevereiro), ele "escorrega" pro último dia do mês, igual boleto.
function diaEfetivoLembrete(lembrete, ano, mesIndex) {
    return Math.min(lembrete.diaDoMes, diasNoMesDe(ano, mesIndex));
}

// Chave usada pra saber se ESSA ocorrência específica já foi paga.
// Lembrete mensal: uma chave por mês ("2026-08"). Lembrete único: a
// própria data, já que só existe uma ocorrência.
function chaveOcorrencia(lembrete, dataISO) {

    if (!lembrete.recorrente) return lembrete.data;

    const [ano, mes] = dataISO.split("-");
    return `${ano}-${mes}`;
}

function lembretesDoDia(dataISO) {

    const dataLocal = paraDataLocal(dataISO);
    const ano = dataLocal.getFullYear();
    const mesIndex = dataLocal.getMonth();
    const dia = dataLocal.getDate();

    return lembretes.filter(lembrete => {

        if (lembrete.recorrente) {
            return diaEfetivoLembrete(lembrete, ano, mesIndex) === dia;
        }

        return lembrete.data === dataISO;
    });
}

function lembreteEstaPago(lembrete, dataISO) {

    if (!lembrete.pagamentos) return false;

    return !!lembrete.pagamentos[chaveOcorrencia(lembrete, dataISO)];
}

async function salvarLembretes() {
    await localStorage.setItem("lembretes", JSON.stringify(lembretes));
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

        const lembretesCelula = lembretesDoDia(dataISO);
        const temLembretePendente = lembretesCelula.some(lembrete => !lembreteEstaPago(lembrete, dataISO));

        let badgeLembreteHtml = "";
        if (lembretesCelula.length > 0) {
            badgeLembreteHtml = `<span class="badge-lembrete">${temLembretePendente ? "🔔" : "✅"}</span>`;
        }

        botao.innerHTML = `
            ${badgeLembreteHtml}
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
                <h3>${iconeCategoria(mov.categoria, categoriasSalvas)} ${mov.categoria}</h3>
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

// ---------------- LEMBRETES DO DIA ----------------

let lembreteEditandoId = null;

function abrirPainelLembrete() {
    painelLembrete.classList.remove("oculto");
    btnAdicionarLembrete.classList.add("ativo");
    lembreteTitulo.focus();
}

function fecharPainelLembrete() {
    painelLembrete.classList.add("oculto");
    btnAdicionarLembrete.classList.remove("ativo");
    lembreteEditandoId = null;
    lembreteTitulo.value = "";
    lembreteValor.value = "";
    lembreteObservacao.value = "";
    lembreteRecorrente.checked = true;
    btnSalvarLembrete.textContent = "💾 Salvar lembrete";
}

function abrirEdicaoLembrete(lembrete) {

    lembreteEditandoId = lembrete.id;

    lembreteTitulo.value = lembrete.titulo;
    lembreteValor.value = lembrete.valor || "";
    lembreteObservacao.value = lembrete.observacao || "";
    lembreteRecorrente.checked = lembrete.recorrente;

    btnSalvarLembrete.textContent = "💾 Salvar alterações";

    abrirPainelLembrete();
}

function renderizarLembretesDia() {

    const lembretesHoje = lembretesDoDia(diaSelecionadoISO);

    listaLembretesDia.innerHTML = "";

    if (lembretesHoje.length === 0) return;

    lembretesHoje.forEach(lembrete => {

        const pago = lembreteEstaPago(lembrete, diaSelecionadoISO);

        const card = document.createElement("div");
        card.className = `cardLembrete${pago ? " pago" : ""}`;

        card.innerHTML = `
            <div class="infoLembrete">
                <h3>🔔 ${lembrete.titulo}</h3>
                ${lembrete.valor ? `<p>${formatarMoeda(lembrete.valor)}</p>` : ""}
                <p>${lembrete.recorrente ? "Repete todo mês" : "Lembrete único"}</p>
                ${lembrete.observacao ? `<p>${lembrete.observacao}</p>` : ""}
                <span class="selo ${pago ? "pago" : "pendente"}">${pago ? "Pago" : "Pendente"}</span>
            </div>
            <div class="acoesLembreteCard">
                <div class="linhaBotoes">
                    <button class="icone btnEditarLembrete" data-id="${lembrete.id}" title="Editar">✏️</button>
                    <button class="icone btnExcluirLembrete" data-id="${lembrete.id}" title="Excluir">🗑️</button>
                </div>
                <button class="btnPagarLembrete${pago ? " desfazer" : ""}" data-id="${lembrete.id}">
                    ${pago ? "Desfazer" : "✅ Marcar como pago"}
                </button>
            </div>
        `;

        listaLembretesDia.appendChild(card);
    });

    listaLembretesDia.querySelectorAll(".btnPagarLembrete").forEach(btn => {
        btn.addEventListener("click", async () => {

            const lembrete = lembretes.find(l => l.id === Number(btn.dataset.id));
            if (!lembrete) return;

            lembrete.pagamentos = lembrete.pagamentos || {};
            const chave = chaveOcorrencia(lembrete, diaSelecionadoISO);
            lembrete.pagamentos[chave] = !lembrete.pagamentos[chave];

            await salvarLembretes();
            atualizarTudo();
        });
    });

    listaLembretesDia.querySelectorAll(".btnEditarLembrete").forEach(btn => {
        btn.addEventListener("click", () => {

            const lembrete = lembretes.find(l => l.id === Number(btn.dataset.id));
            if (!lembrete) return;

            abrirEdicaoLembrete(lembrete);
        });
    });

    listaLembretesDia.querySelectorAll(".btnExcluirLembrete").forEach(btn => {
        btn.addEventListener("click", async () => {

            const confirmar = confirm("Tem certeza que deseja excluir esse lembrete?");
            if (!confirmar) return;

            const id = Number(btn.dataset.id);
            lembretes = lembretes.filter(l => l.id !== id);

            await salvarLembretes();
            fecharPainelLembrete();
            atualizarTudo();
        });
    });
}

btnAdicionarLembrete.addEventListener("click", () => {

    if (!painelLembrete.classList.contains("oculto")) {
        fecharPainelLembrete();
        return;
    }

    abrirPainelLembrete();
});

btnCancelarLembrete.addEventListener("click", fecharPainelLembrete);

btnSalvarLembrete.addEventListener("click", async () => {

    const titulo = lembreteTitulo.value.trim();

    if (!titulo) {
        alert("Dê um título para o lembrete.");
        return;
    }

    const valor = lembreteValor.value ? Number(lembreteValor.value) : null;
    const recorrente = lembreteRecorrente.checked;
    const observacao = lembreteObservacao.value.trim();

    const diaDaSelecao = paraDataLocal(diaSelecionadoISO).getDate();

    if (lembreteEditandoId !== null) {

        const lembrete = lembretes.find(l => l.id === lembreteEditandoId);

        if (lembrete) {
            lembrete.titulo = titulo;
            lembrete.valor = valor;
            lembrete.observacao = observacao;
            lembrete.recorrente = recorrente;

            if (recorrente) {
                lembrete.diaDoMes = lembrete.diaDoMes || diaDaSelecao;
                delete lembrete.data;
            } else {
                lembrete.data = lembrete.data || diaSelecionadoISO;
                delete lembrete.diaDoMes;
            }
        }

    } else {

        const novoLembrete = {
            id: Date.now(),
            titulo,
            valor,
            observacao,
            recorrente,
            pagamentos: {}
        };

        if (recorrente) {
            novoLembrete.diaDoMes = diaDaSelecao;
        } else {
            novoLembrete.data = diaSelecionadoISO;
        }

        lembretes.push(novoLembrete);
    }

    await salvarLembretes();
    fecharPainelLembrete();
    atualizarTudo();
});

// ---------------- NAVEGAÇÃO ----------------

function selecionarDia(dataISO, mesOffset) {

    fecharPainelLembrete();

    if (mesOffset !== 0) {
        referencia = new Date(paraDataLocal(dataISO).getFullYear(), paraDataLocal(dataISO).getMonth(), 1);
    }

    diaSelecionadoISO = dataISO;

    atualizarTudo();
}

function mudarMes(delta) {

    fecharPainelLembrete();

    referencia = new Date(referencia.getFullYear(), referencia.getMonth() + delta, 1);
    diaSelecionadoISO = formatarISO(referencia);

    atualizarTudo();
}

function irParaHoje() {

    fecharPainelLembrete();

    referencia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    diaSelecionadoISO = hojeISO;

    atualizarTudo();
}

function atualizarTudo() {
    renderizarCalendario();
    calcularResumoMes();
    renderizarDia();
    renderizarLembretesDia();
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
