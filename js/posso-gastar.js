import { protegerPagina, carregarDados, criarArmazenamento, sair } from "./utils.js";

import {
    NIVEL,
    GRUPO_LAZER,
    calcularSituacao,
    analisarGasto,
    limiteSeguro,
    interpretarPergunta,
    planejamentoPadrao,
    categoriasDeSaida,
    lerValor,
    normalizar,
    arredondar
} from "./posso-gastar-core.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const armazenamento = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

// ---------------- DADOS DO APP ----------------

const movimentacoes = JSON.parse(armazenamento.getItem("movimentacoes")) || [];
const metas = JSON.parse(armazenamento.getItem("metas")) || [];
const orcamentos = JSON.parse(armazenamento.getItem("orcamentos")) || [];
const categorias = JSON.parse(armazenamento.getItem("categorias")) || { entrada: [], saida: [] };

const nomesSaida = categoriasDeSaida(categorias);
const nomesEntrada = Array.isArray(categorias.entrada) ? categorias.entrada.map(c => (typeof c === "string" ? c : c.nome)) : [];

// Planejamento salvo; se ainda não existe, usa os valores sugeridos
// (só são gravados quando a pessoa toca em "Salvar planejamento").
let plano = JSON.parse(armazenamento.getItem("planejamento"));

if (!plano || typeof plano !== "object") {
    plano = planejamentoPadrao(metas, categorias);
}

// ---------------- UTILITÁRIOS DE TELA ----------------

const el = id => document.getElementById(id);

function moeda(valor) {
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function esc(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function numeroDoCampo(texto) {
    const valor = lerValor(normalizar(texto));
    return valor === null ? null : valor;
}

function numeroOuVazio(texto) {
    const limpo = String(texto ?? "").trim();
    if (limpo === "") return null;
    return numeroDoCampo(limpo);
}

function diaDoCampo(texto) {
    const n = Number(String(texto ?? "").trim());
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
}

function rotuloDia(dia) {
    return dia ? `dia ${dia}` : "sem data";
}

// ---------------- SELETOR DE CATEGORIA ----------------

function montarSeletorCategoria() {

    const select = el("categoriaGasto");
    const anterior = select.value;

    if (nomesSaida.length === 0) {
        select.innerHTML = `<option value="">Cadastre categorias na aba Categorias</option>`;
        return;
    }

    // só aparecem as categorias que você já cadastrou no app
    select.innerHTML = nomesSaida.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");

    if (nomesSaida.includes(anterior)) select.value = anterior;
}

function categoriaSelecionada() {
    return el("categoriaGasto").value;
}

// ---------------- CÁLCULO ----------------

function situacaoAtual() {
    return calcularSituacao({ movimentacoes, planejamento: plano, orcamentos, hoje: new Date() });
}

// ---------------- RESULTADO ----------------

function frasePorMotivo(r, situacao) {

    switch (r.motivo) {

        case "ok":
            return "Dá para gastar sem mexer em conta, aporte ou meta.";

        case "aperta":
            return "Dá para gastar, mas vai sobrar pouco para o resto do período. Se puder, gaste menos.";

        case "estoura-categoria": {
            const teto = Math.max(0, r.categoriaAntes);
            return `Esse valor passa do que ainda resta no orçamento de ${r.categoria}. O máximo seguro agora é ${moeda(teto)}.`;
        }

        case "compromete-contas":
            return `Esse gasto usaria dinheiro de contas ou aportes que ainda vão vencer. O máximo seguro agora é ${moeda(Math.max(0, r.livreAntes))}.`;

        case "sem-folga":
            return "Todo o seu dinheiro até o fim do mês já está comprometido com contas e aportes. Melhor não gastar com isso agora.";

        default:
            return "";
    }
}

function textoCobertura(r) {

    const aportes = (plano.aportes || []).filter(a => Number(a.valor) > 0).map(a => `aporte ${a.nome}`);

    const partes = ["suas obrigações", ...aportes];

    const lista = partes.length > 1
        ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`
        : partes[0];

    return `${lista.charAt(0).toUpperCase()}${lista.slice(1)} continuam cobertos.`;
}

function renderizarResultado(r, situacao) {

    const caixa = el("resultado");
    caixa.classList.remove("oculto");

    // ---- faltam dados ----
    if (r.nivel === NIVEL.FALTAM_DADOS) {

        caixa.innerHTML = `
            <div class="resultado faltam">
                <h2>⚪ Não consigo analisar com segurança</h2>
                <p class="recomendacao">Faltam estas informações:</p>
                <ul class="faltando-lista">
                    ${r.faltando.map(f => `<li>${esc(f)}</li>`).join("")}
                </ul>
            </div>
        `;
        caixa.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
    }

    const valorTxt = moeda(r.valor);

    const titulos = {
        [NIVEL.PODE]: `🟢 Pode gastar ${valorTxt}.`,
        [NIVEL.CUIDADO]: `🟡 Cuidado: ${valorTxt} é possível, mas aperta.`,
        [NIVEL.NAO]: `🔴 Não recomendado gastar ${valorTxt}.`
    };

    const selos = {
        [NIVEL.PODE]: "Pode",
        [NIVEL.CUIDADO]: "Cuidado",
        [NIVEL.NAO]: "Não recomendado"
    };

    const linhas = [];

    linhas.push(["Valor solicitado", moeda(r.valor)]);
    linhas.push(["Disponível antes", moeda(Math.max(0, r.restanteAntes))]);
    linhas.push(["Disponível depois", r.restanteDepois < 0 ? `− ${moeda(Math.abs(r.restanteDepois))}` : moeda(r.restanteDepois)]);

    if (r.temOrcamentoCategoria) {
        linhas.push([
            `Categoria afetada`,
            `${esc(r.categoria)}: ${moeda(Math.max(0, r.categoriaAntes))} de ${moeda(r.orcamento.limite)} restantes`
        ]);
    } else {
        linhas.push(["Categoria afetada", `${esc(r.categoria)} (sem orçamento próprio)`]);
    }

    const prox = r.proximasObrigacoes.map(p => `
        <li class="${p.atrasada ? "atrasada" : ""}">
            <span>${esc(p.nome)} · ${p.atrasada ? "atrasada" : rotuloDia(p.dia)}</span>
            <strong>${moeda(p.pendente)}</strong>
        </li>
    `).join("");

    let limiteHtml = "";

    if (r.limiteSeguro >= 0) {
        limiteHtml = `<p class="recomendacao"><strong>Seu limite seguro para gastar agora é aproximadamente ${moeda(r.limiteSeguro)}.</strong>${
            r.limiteSeguroPorDia !== null && r.limiteSeguro > 0 && situacao.diasAteProximoRecebimento > 0
                ? ` Isso dá cerca de ${moeda(r.limiteSeguroPorDia)} por dia até o próximo recebimento.`
                : ""
        }</p>`;
    }

    const restariam = r.restanteDepois >= 0
        ? `Depois desse gasto, restariam ${moeda(r.restanteDepois)} disponíveis${r.temOrcamentoCategoria ? ` para ${r.categoria}` : ""}. `
        : "";

    const recomendacao = r.nivel === NIVEL.PODE
        ? `${restariam}${textoCobertura(r)}`
        : frasePorMotivo(r, situacao);

    const lazerLinha = r.temOrcamentoCategoria && r.ehLazer
        ? `<p class="recomendacao">Você tem ${moeda(r.orcamento.limite)} destinados ao lazer neste mês e ainda possui ${moeda(Math.max(0, r.categoriaAntes))} disponíveis nessa categoria.</p>`
        : "";

    caixa.innerHTML = `
        <div class="resultado ${r.nivel}">
            <span class="selo">${selos[r.nivel]}</span>
            <h2>${titulos[r.nivel]}</h2>
            ${lazerLinha}
            <p class="recomendacao">${esc(recomendacao)}</p>

            <div class="linhas-resultado">
                ${linhas.map(([a, b]) => `<div class="linha-res"><span>${a}</span><strong>${b}</strong></div>`).join("")}
            </div>

            ${prox ? `<h3>Próximas obrigações importantes</h3><ul class="lista-prox">${prox}</ul>` : ""}

            ${limiteHtml}

            ${situacao.avisos.length ? `<div class="avisos">${situacao.avisos.map(a => `<span>ℹ️ ${esc(a)}</span>`).join("")}</div>` : ""}
        </div>
    `;

    caixa.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------- BLOCO "LIMITE SEGURO" ----------------

function renderizarLimite(categoria = categoriaSelecionada()) {

    const situacao = situacaoAtual();
    const l = limiteSeguro(situacao, categoria);
    const bloco = el("blocoLimite");

    if (l.faltando.length > 0) {
        bloco.innerHTML = `
            <p class="rotulo">Seu limite seguro para gastar agora</p>
            <p class="detalhe">Para calcular, preciso de: ${l.faltando.map(esc).join(", ")}.</p>
        `;
        return;
    }

    const detalhes = [];

    detalhes.push(`Já descontei contas, aportes de metas e o orçamento de ${esc(l.categoria)}.`);

    if (l.porDia !== null && l.limite > 0 && situacao.diasAteProximoRecebimento > 0) {
        detalhes.push(`Até o próximo recebimento (${situacao.diasAteProximoRecebimento} dia${situacao.diasAteProximoRecebimento > 1 ? "s" : ""}): cerca de ${moeda(l.porDia)} por dia.`);
    }

    bloco.innerHTML = `
        <p class="rotulo">Seu limite seguro para gastar agora é aproximadamente</p>
        <p class="valor">${moeda(l.limite)}</p>
        <p class="detalhe">${detalhes.join("<br>")}</p>
    `;
}

function mostrarLimiteComoResposta(pergunta) {

    const situacao = situacaoAtual();
    const l = limiteSeguro(situacao, pergunta.categoria);

    const caixa = el("resultado");
    caixa.classList.remove("oculto");

    if (l.faltando.length > 0) {
        renderizarResultado({ nivel: NIVEL.FALTAM_DADOS, faltando: l.faltando }, situacao);
        return;
    }

    const textoMes = pergunta.periodo === "mes"
        ? `Considerando tudo o que ainda entra e sai até o fim do mês, você ainda pode gastar aproximadamente ${moeda(l.limite)} (${esc(l.categoria)}).`
        : `Seu limite seguro para gastar agora é aproximadamente ${moeda(l.limite)} (${esc(l.categoria)}).${
            l.porDia !== null && l.limite > 0 && situacao.diasAteProximoRecebimento > 0
                ? ` Isso dá cerca de ${moeda(l.porDia)} por dia até o próximo recebimento.`
                : ""
        }`;

    caixa.innerHTML = `
        <div class="resultado ${l.limite > 0 ? "pode" : "nao"}">
            <h2>${l.limite > 0 ? "💰" : "🔴"} ${l.limite > 0 ? moeda(l.limite) : "Nada livre por enquanto"}</h2>
            <p class="recomendacao">${textoMes}</p>
            ${situacao.avisos.length ? `<div class="avisos">${situacao.avisos.map(a => `<span>ℹ️ ${esc(a)}</span>`).join("")}</div>` : ""}
        </div>
    `;

    caixa.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------- AÇÕES ----------------

function analisar(valor, categoria) {

    const situacao = situacaoAtual();
    const resultado = analisarGasto(situacao, valor, categoria);

    renderizarResultado(resultado, situacao);
}

el("formPergunta").addEventListener("submit", evento => {

    evento.preventDefault();

    const valor = numeroDoCampo(el("valorGasto").value);

    analisar(valor || 0, categoriaSelecionada());
});

function perguntar() {

    const texto = el("textoPergunta").value.trim();

    if (!texto) return;

    const pergunta = interpretarPergunta(texto, nomesSaida);

    // categoria sugerida pelas palavras da frase: só vale se for uma das
    // categorias cadastradas; senão, mantém a que já está escolhida na tela
    let categoria = categoriaSelecionada();

    if (pergunta.categoria === GRUPO_LAZER) {
        const lazer = (plano.categoriasLazer || []).find(n => nomesSaida.includes(n));
        if (lazer) categoria = lazer;
    } else if (pergunta.categoria && nomesSaida.includes(pergunta.categoria)) {
        categoria = pergunta.categoria;
    }

    el("categoriaGasto").value = categoria;

    if (pergunta.tipo === "limite") {
        mostrarLimiteComoResposta({ ...pergunta, categoria });
        return;
    }

    if (pergunta.tipo === "sem-valor") {

        const caixa = el("resultado");
        caixa.classList.remove("oculto");
        caixa.innerHTML = `
            <div class="resultado faltam">
                <h2>⚪ Qual é o valor?</h2>
                <p class="recomendacao">Para avaliar esse gasto eu preciso saber quanto ele custa. Digite o valor no campo acima ou escreva algo como "Posso gastar 30?".</p>
            </div>
        `;
        return;
    }

    el("valorGasto").value = String(pergunta.valor).replace(".", ",");

    analisar(pergunta.valor, categoria);
}

el("btnPerguntar").addEventListener("click", perguntar);

el("textoPergunta").addEventListener("keydown", evento => {
    if (evento.key === "Enter") {
        evento.preventDefault();
        perguntar();
    }
});

el("categoriaGasto").addEventListener("change", () => {
    renderizarLimite();
});

// ======================================================================
// EDITOR DO PLANEJAMENTO
// ======================================================================

function opcoesCategoria(lista, selecionada, rotuloVazio) {
    return `<option value="">${rotuloVazio}</option>` +
        lista.map(n => `<option value="${esc(n)}" ${n === selecionada ? "selected" : ""}>${esc(n)}</option>`).join("");
}

function renderizarEditor() {

    el("planoRenda").value = plano.rendaMensal ?? "";
    el("planoLazer").value = plano.limiteLazer ?? "";

    // categorias de lazer
    el("planoCategoriasLazer").innerHTML = nomesSaida.map(nome => `
        <label>
            <input type="checkbox" class="chkLazer" value="${esc(nome)}" ${(plano.categoriasLazer || []).includes(nome) ? "checked" : ""}>
            ${esc(nome)}
        </label>
    `).join("") || `<p class="descricao">Você ainda não tem categorias de despesa.</p>`;

    // aportes: uma linha por meta
    el("planoAportes").innerHTML = metas.map(meta => {

        const atual = (plano.aportes || []).find(a => String(a.metaId) === String(meta.id));

        return `
            <div class="linha-plano" data-meta-id="${esc(meta.id)}" data-meta-nome="${esc(meta.nome)}">
                <span class="nome-fixo">${esc(meta.emoji || "🎯")} ${esc(meta.nome)}</span>
                <input type="text" class="apValor" inputmode="decimal" placeholder="R$ por mês" value="${atual ? esc(atual.valor) : ""}">
                <input type="text" class="apDia" inputmode="numeric" placeholder="Dia (opcional)" value="${atual && atual.dia ? esc(atual.dia) : ""}">
            </div>
        `;
    }).join("") || `<p class="descricao">Você ainda não tem metas.</p>`;

    // obrigações
    el("planoObrigacoes").innerHTML = (plano.obrigacoes || []).map((o, i) => linhaObrigacao(o, i)).join("");

    // recebimentos
    el("planoRecebimentos").innerHTML = (plano.recebimentos || []).map((r, i) => linhaRecebimento(r, i)).join("");
}

function linhaObrigacao(o, i) {
    return `
        <div class="linha-plano linhaObrigacao" data-id="${esc(o.id ?? i + 1)}">
            <input type="text" class="obNome cheia" placeholder="Nome (ex.: Consórcio)" value="${esc(o.nome)}">
            <input type="text" class="obValor" inputmode="decimal" placeholder="Valor (R$)" value="${esc(o.valor)}">
            <input type="text" class="obDia" inputmode="numeric" placeholder="Dia do mês (opcional)" value="${o.dia ? esc(o.dia) : ""}">
            <select class="obCategoria cheia">${opcoesCategoria(nomesSaida, o.categoria, "Categoria (para saber se já pagou)")}</select>
            <button type="button" class="btnRemover" data-remover="obrigacao">Remover</button>
        </div>
    `;
}

function linhaRecebimento(r, i) {
    return `
        <div class="linha-plano linhaRecebimento" data-id="${esc(r.id ?? i + 1)}">
            <input type="text" class="rcNome cheia" placeholder="Nome (ex.: Salário)" value="${esc(r.nome)}">
            <input type="text" class="rcValor" inputmode="decimal" placeholder="Valor (R$)" value="${esc(r.valor)}">
            <input type="text" class="rcDia" inputmode="numeric" placeholder="Dia do mês" value="${r.dia ? esc(r.dia) : ""}">
            <select class="rcCategoria cheia">${opcoesCategoria(nomesEntrada, r.categoria, "Qualquer entrada")}</select>
            <button type="button" class="btnRemover" data-remover="recebimento">Remover</button>
        </div>
    `;
}

// Lê o que está escrito no editor e devolve um planejamento novo.
function lerEditor() {

    const erros = [];

    const renda = numeroOuVazio(el("planoRenda").value);
    const lazer = numeroOuVazio(el("planoLazer").value);

    if (lazer === null) erros.push("Informe o orçamento mensal de lazer.");

    const categoriasLazer = [...document.querySelectorAll(".chkLazer:checked")].map(c => c.value);

    const aportes = [];

    document.querySelectorAll("#planoAportes .linha-plano").forEach(linha => {

        const valor = numeroOuVazio(linha.querySelector(".apValor").value);

        if (valor === null) return;

        const rawId = linha.dataset.metaId;
        const metaOriginal = metas.find(m => String(m.id) === String(rawId));

        aportes.push({
            metaId: metaOriginal ? metaOriginal.id : rawId,
            nome: linha.dataset.metaNome,
            valor,
            dia: diaDoCampo(linha.querySelector(".apDia").value)
        });
    });

    const obrigacoes = [];

    document.querySelectorAll(".linhaObrigacao").forEach((linha, i) => {

        const nome = linha.querySelector(".obNome").value.trim();
        const valor = numeroOuVazio(linha.querySelector(".obValor").value);

        if (!nome && valor === null) return;

        if (!nome || valor === null) {
            erros.push("Toda obrigação precisa de nome e valor.");
            return;
        }

        obrigacoes.push({
            id: i + 1,
            nome,
            valor,
            categoria: linha.querySelector(".obCategoria").value,
            dia: diaDoCampo(linha.querySelector(".obDia").value)
        });
    });

    const recebimentos = [];

    document.querySelectorAll(".linhaRecebimento").forEach((linha, i) => {

        const nome = linha.querySelector(".rcNome").value.trim();
        const valor = numeroOuVazio(linha.querySelector(".rcValor").value);

        if (!nome && valor === null) return;

        if (!nome || valor === null) {
            erros.push("Todo recebimento precisa de nome e valor.");
            return;
        }

        recebimentos.push({
            id: i + 1,
            nome,
            valor,
            categoria: linha.querySelector(".rcCategoria").value,
            dia: diaDoCampo(linha.querySelector(".rcDia").value)
        });
    });

    return {
        erros: [...new Set(erros)],
        plano: {
            confirmado: true,
            rendaMensal: renda,
            limiteLazer: lazer,
            categoriasLazer,
            aportes,
            obrigacoes,
            recebimentos
        }
    };
}

// Mantém o que foi digitado quando a pessoa adiciona/remove uma linha.
function sincronizarListasComEditor() {

    const lido = lerEditor().plano;

    plano = { ...plano, ...lido, confirmado: plano.confirmado };
}

el("btnAddObrigacao").addEventListener("click", () => {

    sincronizarListasComEditor();

    plano.obrigacoes.push({ id: Date.now(), nome: "", valor: "", categoria: "", dia: null });

    renderizarEditor();
});

el("btnAddRecebimento").addEventListener("click", () => {

    sincronizarListasComEditor();

    plano.recebimentos.push({ id: Date.now(), nome: "", valor: "", categoria: "", dia: null });

    renderizarEditor();
});

el("detalhesPlano").addEventListener("click", evento => {

    const botao = evento.target.closest(".btnRemover");

    if (!botao) return;

    // tira a linha da tela primeiro; depois relê o que sobrou no editor
    botao.closest(".linha-plano").remove();

    sincronizarListasComEditor();

    renderizarEditor();
});

el("btnSalvarPlano").addEventListener("click", async () => {

    const { erros, plano: novo } = lerEditor();

    const caixaErro = el("erroPlano");

    if (erros.length > 0) {
        caixaErro.textContent = erros.join(" ");
        caixaErro.classList.remove("oculto");
        return;
    }

    caixaErro.classList.add("oculto");

    plano = novo;

    await armazenamento.setItem("planejamento", JSON.stringify(plano));

    montarSeletorCategoria();
    atualizarAvisoPlano();
    renderizarEditor();
    renderizarLimite();

    el("resultado").classList.add("oculto");
    el("detalhesPlano").open = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------------- AVISO "REVISE O PLANEJAMENTO" ----------------

function atualizarAvisoPlano() {

    const aviso = el("avisoPlano");

    if (plano.confirmado) {
        aviso.classList.add("oculto");
        return;
    }

    aviso.textContent =
        "Seu planejamento ainda não foi configurado. Abra \"Ajustar meu planejamento\", preencha o que quiser (lazer, obrigações, metas, recebimentos) e toque em Salvar.";

    aviso.classList.remove("oculto");
}

// ---------------- INICIAR ----------------

montarSeletorCategoria();
renderizarEditor();
atualizarAvisoPlano();
renderizarLimite();
