import { protegerPagina, carregarDados, criarArmazenamento, sair } from "./utils.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

// ---------------- DADOS ----------------

const movimentacoes =
    JSON.parse(localStorage.getItem("movimentacoes")) || [];

const filtroMes = document.getElementById("filtroMes");

function moeda(valor) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

// data no formato "YYYY-MM-DD" (input type=date) -> chave "YYYY-MM"
function chaveMes(dataStr) {
    return (dataStr || "").slice(0, 7);
}

const nomesMes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function rotuloMes(chave) {
    const [ano, mes] = chave.split("-");
    const indice = Number(mes) - 1;
    return `${nomesMes[indice] || mes} de ${ano}`;
}

// ---------------- FILTRO DE MÊS ----------------

function popularFiltroMes() {

    const chaves = [...new Set(
        movimentacoes
            .map(mov => chaveMes(mov.data))
            .filter(chave => chave.length === 7)
    )].sort().reverse();

    chaves.forEach(chave => {
        const option = document.createElement("option");
        option.value = chave;
        option.textContent = rotuloMes(chave);
        filtroMes.appendChild(option);
    });
}

popularFiltroMes();

// ---------------- EXPORTAR PDF ----------------

const pdfDataInicio = document.getElementById("pdfDataInicio");
const pdfDataFim = document.getElementById("pdfDataFim");
const pdfBanco = document.getElementById("pdfBanco");
const pdfCategoria = document.getElementById("pdfCategoria");
const pdfTipo = document.getElementById("pdfTipo");
const btnExportarPdf = document.getElementById("btnExportarPdf");
const pdfAviso = document.getElementById("pdfAviso");

const textoNaturezaPdf = {
    Reserva: "Reserva",
    Resgate: "Retirada da Reserva",
    Investimento: "Investimento"
};

function rotuloNatureza(mov) {
    if (mov.natureza === "Transferência") {
        return mov.tipo === "Entrada" ? "Transferência recebida" : "Transferência enviada";
    }
    if (mov.tipo === "Entrada") return "Entrada";
    if (mov.natureza === "Despesa") return "Despesa";
    return textoNaturezaPdf[mov.natureza] || "Despesa";
}

// bancos cadastrados (mesma lógica usada em bancos.html/historico.html)
function carregarBancosParaFiltro() {

    let bancos = JSON.parse(localStorage.getItem("bancos"));

    if (!Array.isArray(bancos) || bancos.length === 0) {
        bancos = [
            { nome: "Nubank" }, { nome: "Inter" },
            { nome: "Mercado Pago" }, { nome: "Dinheiro" }
        ];
    }

    return bancos;
}

function popularFiltrosExportacao() {

    carregarBancosParaFiltro().forEach(banco => {
        const option = document.createElement("option");
        option.value = banco.nome;
        option.textContent = banco.nome;
        pdfBanco.appendChild(option);
    });

    const categorias = [...new Set(
        movimentacoes.map(mov => mov.categoria).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "pt-BR"));

    categorias.forEach(categoria => {
        const option = document.createElement("option");
        option.value = categoria;
        option.textContent = categoria;
        pdfCategoria.appendChild(option);
    });
}

popularFiltrosExportacao();

function movimentacoesFiltradasParaPdf() {

    const inicio = pdfDataInicio.value; // "YYYY-MM-DD" ou ""
    const fim = pdfDataFim.value;
    const banco = pdfBanco.value;
    const categoria = pdfCategoria.value;
    const tipo = pdfTipo.value;

    return movimentacoes
        .filter(mov => !inicio || mov.data >= inicio)
        .filter(mov => !fim || mov.data <= fim)
        .filter(mov => banco === "todos" || mov.banco === banco)
        .filter(mov => categoria === "todos" || mov.categoria === categoria)
        .filter(mov => {
            if (tipo === "todos") return true;
            if (tipo === "Entrada") return mov.tipo === "Entrada" && mov.natureza !== "Transferência";
            if (tipo === "Despesa") return mov.tipo !== "Entrada" && mov.natureza === "Despesa";
            if (tipo === "Transferência") return mov.natureza === "Transferência";
            return mov.tipo !== "Entrada" && mov.natureza === tipo;
        })
        .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
}

function formatarDataBr(dataStr) {
    if (!dataStr) return "";
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
}

function gerarPdf() {

    pdfAviso.textContent = "";

    if (typeof window.jspdf === "undefined") {
        pdfAviso.textContent = "Não foi possível carregar a biblioteca de PDF. Verifique sua conexão.";
        return;
    }

    const resultado = movimentacoesFiltradasParaPdf();

    if (resultado.length === 0) {
        pdfAviso.textContent = "Nenhuma movimentação encontrada para os filtros escolhidos.";
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Relatório de Movimentações", 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(100);

    const filtrosTexto = [
        `Período: ${pdfDataInicio.value ? formatarDataBr(pdfDataInicio.value) : "início"} a ${pdfDataFim.value ? formatarDataBr(pdfDataFim.value) : "hoje"}`,
        `Banco: ${pdfBanco.value === "todos" ? "Todos" : pdfBanco.value}`,
        `Categoria: ${pdfCategoria.value === "todos" ? "Todas" : pdfCategoria.value}`,
        `Tipo: ${pdfTipo.options[pdfTipo.selectedIndex].textContent}`
    ];

    doc.text(filtrosTexto, 14, 26);

    let entradas = 0;
    let despesas = 0;

    resultado.forEach(mov => {
        if (mov.natureza === "Transferência") return;
        if (mov.tipo === "Entrada") {
            entradas += Number(mov.valor);
        } else {
            despesas += Number(mov.valor);
        }
    });

    const linhas = resultado.map(mov => [
        formatarDataBr(mov.data),
        mov.categoria || "-",
        mov.descricao || "-",
        mov.banco || "-",
        rotuloNatureza(mov),
        (mov.tipo === "Entrada" ? "+ " : "- ") + moeda(Number(mov.valor))
    ]);

    doc.autoTable({
        head: [["Data", "Categoria", "Descrição", "Banco", "Tipo", "Valor"]],
        body: linhas,
        startY: 48,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [79, 70, 229] }
    });

    const finalY = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(`Entradas: ${moeda(entradas)}`, 14, finalY);
    doc.text(`Despesas: ${moeda(despesas)}`, 14, finalY + 7);
    doc.text(`Saldo do período: ${moeda(entradas - despesas)}`, 14, finalY + 14);

    const nomeArquivo = `relatorio-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(nomeArquivo);
}

btnExportarPdf.addEventListener("click", gerarPdf);

// ---------------- RESUMO DO PERÍODO ----------------

function movimentacoesDoPeriodo() {

    const mesSelecionado = filtroMes.value;

    if (mesSelecionado === "todos") return movimentacoes;

    return movimentacoes.filter(mov => chaveMes(mov.data) === mesSelecionado);
}

function atualizarResumo() {

    const periodo = movimentacoesDoPeriodo();

    let entradas = 0;
    let despesas = 0;

    periodo.forEach(mov => {

        // Transferência entre contas não é receita nem despesa de verdade
        if (mov.natureza === "Transferência") return;

        if (mov.tipo === "Entrada") {
            entradas += Number(mov.valor);
        } else if (mov.natureza === "Despesa" || mov.natureza === "Resgate") {
            despesas += Number(mov.valor);
        }

    });

    document.getElementById("resumoEntradas").textContent = moeda(entradas);
    document.getElementById("resumoDespesas").textContent = moeda(despesas);
    document.getElementById("resumoSaldo").textContent = moeda(entradas - despesas);
}

// ---------------- GRÁFICO DE BARRAS (6 meses) ----------------

function ultimosMeses(qtd) {

    const hoje = new Date();
    const lista = [];

    for (let i = qtd - 1; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        lista.push(chave);
    }

    return lista;
}

function prepararDadosBarras() {

    const meses = ultimosMeses(6);

    const entradasPorMes = meses.map(chave =>
        movimentacoes
            .filter(mov => chaveMes(mov.data) === chave && mov.tipo === "Entrada" && mov.natureza !== "Transferência")
            .reduce((total, mov) => total + Number(mov.valor), 0)
    );

    const despesasPorMes = meses.map(chave =>
        movimentacoes
            .filter(mov => chaveMes(mov.data) === chave && (mov.natureza === "Despesa" || mov.natureza === "Resgate"))
            .reduce((total, mov) => total + Number(mov.valor), 0)
    );

    const rotulos = meses.map(chave => {
        const [, mes] = chave.split("-");
        return nomesMes[Number(mes) - 1].slice(0, 3);
    });

    return { rotulos, entradasPorMes, despesasPorMes };
}

function ajustarCanvas(canvas) {

    const dpr = window.devicePixelRatio || 1;
    const largura = canvas.parentElement.clientWidth - 44; // padding do bloco

    canvas.width = largura * dpr;
    canvas.style.width = largura + "px";

    // guarda a altura original apenas uma vez: setar canvas.height mais
    // abaixo também sobrescreve o atributo "height", então reler o
    // atributo a cada chamada faria a altura crescer sem parar a cada
    // resize (isso acontecia bastante no celular ao rolar a página)
    if (!canvas.dataset.alturaBase) {
        canvas.dataset.alturaBase = canvas.getAttribute("height");
    }
    const alturaCss = Number(canvas.dataset.alturaBase);
    canvas.height = alturaCss * dpr;
    canvas.style.height = alturaCss + "px";

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return ctx;
}

function desenharBarras() {

    const canvas = document.getElementById("graficoBarras");
    const ctx = ajustarCanvas(canvas);

    const largura = canvas.clientWidth;
    const altura = canvas.clientHeight;

    ctx.clearRect(0, 0, largura, altura);

    const { rotulos, entradasPorMes, despesasPorMes } = prepararDadosBarras();

    const maiorValor = Math.max(1, ...entradasPorMes, ...despesasPorMes);

    const margemBaixo = 30;
    const margemTopo = 15;
    const areaAltura = altura - margemBaixo - margemTopo;

    const grupoLargura = largura / rotulos.length;
    const barraLargura = Math.min(26, grupoLargura / 4);

    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#777";

    rotulos.forEach((rotulo, i) => {

        const centroX = grupoLargura * i + grupoLargura / 2;

        const alturaEntrada = (entradasPorMes[i] / maiorValor) * areaAltura;
        const alturaDespesa = (despesasPorMes[i] / maiorValor) * areaAltura;

        // barra de entrada
        ctx.fillStyle = "#16a34a";
        ctx.fillRect(
            centroX - barraLargura - 4,
            margemTopo + areaAltura - alturaEntrada,
            barraLargura,
            alturaEntrada
        );

        // barra de despesa
        ctx.fillStyle = "#dc2626";
        ctx.fillRect(
            centroX + 4,
            margemTopo + areaAltura - alturaDespesa,
            barraLargura,
            alturaDespesa
        );

        // rótulo do mês
        ctx.fillStyle = "#777";
        ctx.fillText(rotulo, centroX, altura - 10);
    });

    // linha de base
    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.moveTo(0, margemTopo + areaAltura);
    ctx.lineTo(largura, margemTopo + areaAltura);
    ctx.stroke();
}

// ---------------- GRÁFICO DE ROSCA (categorias) ----------------

const coresRosca = [
    "#4F46E5", "#DC2626", "#16A34A", "#D97706", "#0EA5E9",
    "#DB2777", "#7C3AED", "#65A30D", "#EA580C", "#0891B2"
];

function prepararDadosRosca() {

    const periodo = movimentacoesDoPeriodo();

    const totais = {};

    periodo
        .filter(mov => mov.natureza === "Despesa" || mov.natureza === "Resgate")
        .forEach(mov => {
            const chave = mov.categoria || "Outros";
            totais[chave] = (totais[chave] || 0) + Number(mov.valor);
        });

    const entradas = Object.entries(totais).sort((a, b) => b[1] - a[1]);

    return {
        categorias: entradas.map(item => item[0]),
        valores: entradas.map(item => item[1])
    };
}

function desenharRosca() {

    const canvas = document.getElementById("graficoRosca");
    const legenda = document.getElementById("legendaRosca");
    const ctx = ajustarCanvas(canvas);

    const largura = canvas.clientWidth;
    const altura = canvas.clientHeight;

    ctx.clearRect(0, 0, largura, altura);
    legenda.innerHTML = "";

    const { categorias, valores } = prepararDadosRosca();

    const total = valores.reduce((soma, v) => soma + v, 0);

    if (total === 0) {
        ctx.font = "14px Arial";
        ctx.fillStyle = "#777";
        ctx.textAlign = "center";
        ctx.fillText("Sem despesas nesse período.", largura / 2, altura / 2);
        return;
    }

    const cx = largura / 2;
    const cy = altura / 2;
    const raioExterno = Math.min(largura, altura) / 2 - 10;
    const raioInterno = raioExterno * 0.6;

    let anguloAtual = -Math.PI / 2;

    categorias.forEach((cat, i) => {

        const fatia = (valores[i] / total) * Math.PI * 2;
        const cor = coresRosca[i % coresRosca.length];

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, raioExterno, anguloAtual, anguloAtual + fatia);
        ctx.closePath();
        ctx.fillStyle = cor;
        ctx.fill();

        anguloAtual += fatia;

        const item = document.createElement("div");
        item.className = "legenda-item";

        const percentual = ((valores[i] / total) * 100).toFixed(0);

        item.innerHTML = `
            <span class="legenda-bolinha" style="background:${cor}"></span>
            <span>${cat} — ${moeda(valores[i])} (${percentual}%)</span>
        `;

        legenda.appendChild(item);
    });

    // buraco do meio (efeito rosca)
    ctx.beginPath();
    ctx.arc(cx, cy, raioInterno, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
}

// ---------------- INICIALIZAÇÃO ----------------

function renderizarTudo() {
    atualizarResumo();
    desenharBarras();
    desenharRosca();
}

filtroMes.addEventListener("change", renderizarTudo);
window.addEventListener("resize", () => {
    desenharBarras();
    desenharRosca();
});

renderizarTudo();
