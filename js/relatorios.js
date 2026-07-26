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
            .filter(mov => chaveMes(mov.data) === chave && mov.tipo === "Entrada")
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
