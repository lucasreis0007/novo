import { protegerPagina, carregarDados, criarArmazenamento } from "./utils.js";
import {
    FUSO_PADRAO, calcularAvisos, avisosEfetivos, avisosDaOcorrencia,
    proximaOcorrenciaPendente, somarDiasISO
} from "./notificacoes-core.js";
import {
    ehIOS, instaladoNaTela, suportaPush, chaveConfigurada,
    inscricaoAtual, ativarNeste, desativarNeste, idDoAparelho
} from "./notificacoes-push.js";

const usuario = await protegerPagina();
const dados = await carregarDados(usuario.uid);
const armazenamento = criarArmazenamento(dados, usuario.uid);

// ---------------- ESTADO ----------------

const fusoDoAparelho = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || FUSO_PADRAO; }
    catch (e) { return FUSO_PADRAO; }
})();

function novoId() {
    return "a" + Math.random().toString(36).slice(2, 8);
}

function avisosIniciais() {
    const agora = Date.now();
    return [
        { id: novoId(), diasAntes: 7, hora: "09:00", ativo: false, criadoEm: agora },
        { id: novoId(), diasAntes: 3, hora: "10:00", ativo: false, criadoEm: agora },
        { id: novoId(), diasAntes: 1, hora: "18:00", ativo: true, criadoEm: agora },
        { id: novoId(), diasAntes: 0, hora: "08:00", ativo: true, criadoEm: agora }
    ];
}

let config = (dados.notifConfig && typeof dados.notifConfig === "object" && !Array.isArray(dados.notifConfig))
    ? { ...dados.notifConfig }
    : { ativo: false, aplicarPadrao: true, padrao: avisosIniciais() };

config.fuso = fusoDoAparelho;
if (!Array.isArray(config.padrao)) config.padrao = avisosIniciais();
if (config.aplicarPadrao === undefined) config.aplicarPadrao = true;

let lembretes = JSON.parse(armazenamento.getItem("lembretes")) || [];
let padraoEmEdicao = config.padrao.map(a => ({ ...a }));
let editando = null;                   // id do lembrete com o editor aberto
let avisosEmEdicao = [];
let usarPadraoEmEdicao = true;

const el = id => document.getElementById(id);

function mostrar(idEl, texto) {
    const e = el(idEl);
    e.textContent = texto;
    e.classList.remove("oculto");
}

function esconder(...ids) {
    ids.forEach(i => el(i).classList.add("oculto"));
}

function escapar(texto) {
    return String(texto).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function salvarConfig() {
    await armazenamento.setItem("notifConfig", JSON.stringify(config));
}

// ---------------- ESTE APARELHO ----------------

async function atualizarAparelho() {

    esconder("btnAtivar", "btnTeste", "btnDesativar", "guiaAparelho", "erroAparelho", "sucessoAparelho");

    const status = el("statusAparelho");
    const guia = el("guiaAparelho");

    if (!suportaPush()) {
        status.textContent = "Este navegador não permite notificações com o app fechado.";
        if (ehIOS()) {
            guia.textContent = "No iPhone isso exige iOS 16.4 ou mais novo, com o app instalado na tela inicial.";
            guia.classList.remove("oculto");
        }
        return;
    }

    if (ehIOS() && !instaladoNaTela()) {
        status.textContent = "No iPhone, os avisos só funcionam com o app instalado na tela inicial.";
        guia.innerHTML = "1. Abra o app no <b>Safari</b>.<br>2. Toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.<br>3. Abra o app pelo <b>ícone novo</b> e volte a esta página.";
        guia.classList.remove("oculto");
        return;
    }

    if (!chaveConfigurada()) {
        status.textContent = "Os avisos com o app fechado ainda não foram configurados no servidor.";
        guia.textContent = "Falta colocar a chave pública em js/notificacoes-config.js (siga o passo a passo do arquivo LEIA-ME-NOTIFICACOES.md).";
        guia.classList.remove("oculto");
        return;
    }

    if (Notification.permission === "denied") {
        status.textContent = "As notificações estão bloqueadas para este app.";
        guia.textContent = ehIOS()
            ? "Abra Ajustes do iPhone, toque em Notificações, escolha este app e permita as notificações."
            : "Toque no cadeado ao lado do endereço do site (ou nas configurações do app instalado), abra Permissões e permita Notificações.";
        guia.classList.remove("oculto");
        return;
    }

    const inscricao = await inscricaoAtual().catch(() => null);
    const registrado = dados.notifInscricoes && dados.notifInscricoes[idDoAparelho()];

    if (inscricao && registrado && Notification.permission === "granted") {
        status.textContent = "✅ Ativado neste aparelho. Os avisos chegam mesmo com o app fechado e o celular bloqueado.";
        el("btnTeste").classList.remove("oculto");
        el("btnDesativar").classList.remove("oculto");
    } else {
        status.textContent = "Ainda não ativado neste aparelho.";
        el("btnAtivar").classList.remove("oculto");
    }
}

el("btnAtivar").addEventListener("click", async () => {
    esconder("erroAparelho", "sucessoAparelho");
    try {
        const r = await ativarNeste(usuario.uid);
        if (!r.ok) {
            mostrar("erroAparelho", "Permissão não concedida. Sem ela não é possível enviar avisos.");
            await atualizarAparelho();
            return;
        }
        dados.notifInscricoes = dados.notifInscricoes || {};
        dados.notifInscricoes[idDoAparelho()] = { ativo: true };
        config.ativo = true;
        await salvarConfig();
        await atualizarAparelho();
        mostrar("sucessoAparelho", "Pronto! Toque em \"Enviar notificação de teste\" para conferir.");
    } catch (erro) {
        console.error(erro);
        mostrar("erroAparelho", "Não foi possível ativar. Verifique a conexão e tente de novo.");
    }
});

el("btnDesativar").addEventListener("click", async () => {
    esconder("erroAparelho", "sucessoAparelho");
    try {
        await desativarNeste(usuario.uid);
        if (dados.notifInscricoes) delete dados.notifInscricoes[idDoAparelho()];
        if (!dados.notifInscricoes || Object.keys(dados.notifInscricoes).length === 0) {
            config.ativo = false;
            await salvarConfig();
        }
        await atualizarAparelho();
    } catch (erro) {
        console.error(erro);
        mostrar("erroAparelho", "Não foi possível desativar agora. Tente de novo.");
    }
});

el("btnTeste").addEventListener("click", async () => {
    esconder("erroAparelho", "sucessoAparelho");
    try {
        const quando = Date.now() + 60000;
        await armazenamento.setItem("notifTeste", JSON.stringify({ id: Date.now().toString(36), em: quando }));
        const hora = new Date(quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        mostrar("sucessoAparelho", `Teste agendado para ${hora}. Pode fechar o app e bloquear o celular.`);
    } catch (erro) {
        mostrar("erroAparelho", "Não foi possível agendar o teste.");
    }
});

// ---------------- EDITOR DE AVISOS (padrão e por lembrete) ----------------

function htmlLinhaAviso(aviso, indice, prefixo) {
    return `
        <div class="linha-aviso" data-i="${indice}" data-p="${prefixo}">
            <label class="chave" title="Ativar ou desativar este aviso">
                <input type="checkbox" data-campo="ativo" ${aviso.ativo !== false ? "checked" : ""} aria-label="Aviso ativo">
                <span></span>
            </label>
            <input type="number" min="0" max="365" inputmode="numeric" data-campo="dias" value="${Number(aviso.diasAntes)}" aria-label="Dias antes">
            <span class="rotulo-dias">dias antes, às</span>
            <input type="time" data-campo="hora" value="${escapar(aviso.hora || "09:00")}" aria-label="Horário">
            <button type="button" class="btn-remover" data-acao="remover" aria-label="Remover aviso">✕</button>
        </div>`;
}

function lerLinhas(container, lista) {
    container.querySelectorAll(".linha-aviso").forEach(linha => {
        const aviso = lista[Number(linha.dataset.i)];
        if (!aviso) return;
        aviso.ativo = linha.querySelector('[data-campo="ativo"]').checked;
        const dias = parseInt(linha.querySelector('[data-campo="dias"]').value, 10);
        aviso.diasAntes = Number.isInteger(dias) ? Math.min(Math.max(dias, 0), 365) : 0;
        aviso.hora = linha.querySelector('[data-campo="hora"]').value || "09:00";
    });
}

// mudar um aviso (dias/hora) conta como aviso novo: não dispara retroativamente
function marcarCriacao(lista, original) {
    lista.forEach(aviso => {
        const antes = (original || []).find(a => a.id === aviso.id);
        const mudou = !antes || antes.diasAntes !== aviso.diasAntes || antes.hora !== aviso.hora || antes.ativo !== aviso.ativo;
        aviso.criadoEm = mudou ? Date.now() : (antes.criadoEm || Date.now());
    });
}

// ---------------- AVISOS PADRÃO ----------------

function renderizarPadrao() {
    el("usarPadrao").checked = config.aplicarPadrao !== false;
    el("listaPadrao").innerHTML = padraoEmEdicao.map((a, i) => htmlLinhaAviso(a, i, "padrao")).join("");
}

el("listaPadrao").addEventListener("click", evento => {
    const botao = evento.target.closest('[data-acao="remover"]');
    if (!botao) return;
    lerLinhas(el("listaPadrao"), padraoEmEdicao);
    padraoEmEdicao.splice(Number(botao.closest(".linha-aviso").dataset.i), 1);
    renderizarPadrao();
});

el("btnAddPadrao").addEventListener("click", () => {
    lerLinhas(el("listaPadrao"), padraoEmEdicao);
    padraoEmEdicao.push({ id: novoId(), diasAntes: 1, hora: "09:00", ativo: true, criadoEm: Date.now() });
    renderizarPadrao();
});

el("btnSalvarPadrao").addEventListener("click", async () => {
    lerLinhas(el("listaPadrao"), padraoEmEdicao);
    marcarCriacao(padraoEmEdicao, config.padrao);
    config.padrao = padraoEmEdicao.map(a => ({ ...a }));
    config.aplicarPadrao = el("usarPadrao").checked;
    await salvarConfig();
    renderizarProgramados();
    mostrar("sucessoPadrao", "Avisos padrão salvos.");
    setTimeout(() => esconder("sucessoPadrao"), 3000);
});

// ---------------- LEMBRETES PROGRAMADOS ----------------

function moeda(valor) {
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function rotuloDataHora(iso, hora) {
    const [a, m, d] = iso.split("-").map(Number);
    const dia = new Date(Date.UTC(a, m - 1, d, 12)).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
    return `${dia} às ${hora}`;
}

function rotuloDias(n) {
    return n === 0 ? "No dia" : n === 1 ? "1 dia antes" : `${n} dias antes`;
}

function renderizarProgramados() {

    const agora = Date.now();
    const enviados = dados.notifEnviados || {};
    const caixa = el("listaProgramados");

    const itens = [];

    lembretes.forEach(lembrete => {
        const iso = proximaOcorrenciaPendente(lembrete, agora, config.fuso);
        if (iso) itens.push({ lembrete, iso });
    });

    itens.sort((a, b) => a.iso.localeCompare(b.iso));

    if (itens.length === 0) {
        caixa.innerHTML = `<p class="vazio">Nenhum lembrete com vencimento pela frente. Crie um no <a href="calendario.html">Calendário</a>.</p>`;
        return;
    }

    caixa.innerHTML = itens.map(({ lembrete, iso }) => {

        const receber = lembrete.tipoLembrete === "receber";
        const proprios = Array.isArray(lembrete.avisos);
        const avisos = avisosDaOcorrencia(lembrete, iso, config, config.fuso);
        const [, mes, dia] = iso.split("-");

        const linhas = avisosEfetivos(lembrete, config).map(av => {
            const calculado = avisos.find(x => x.avisoId === String(av.id).replace(/[^A-Za-z0-9]/g, ""));
            const dataAviso = somarDiasISO(iso, -Number(av.diasAntes));
            const texto = `${rotuloDias(Number(av.diasAntes))} — ${rotuloDataHora(dataAviso, av.hora)}`;
            if (av.ativo === false) return `<li class="pausado"><span>${texto}</span><span>desligado</span></li>`;
            if (!calculado) return `<li class="pausado"><span>${texto}</span><span>não se aplica</span></li>`;
            if (enviados[calculado.chave]) return `<li class="enviado"><span>${texto}</span><span>✓ enviado</span></li>`;
            if (calculado.disparoMs < agora - 60000) return `<li class="pausado"><span>${texto}</span><span>já passou</span></li>`;
            return `<li><span>${texto}</span><span>⏳ programado</span></li>`;
        }).join("");

        return `
            <article class="cartao-lembrete ${receber ? "receber" : "pagar"}" data-id="${escapar(lembrete.id)}">
                <div class="cartao-topo">
                    <div>
                        <h3>${receber ? "💰" : "🔔"} ${escapar(lembrete.titulo || "Lembrete")}</h3>
                        <p class="sub">${lembrete.valor ? moeda(lembrete.valor) + " · " : ""}vence ${dia}/${mes}${lembrete.recorrente ? " · todo mês" : ""} · ${proprios ? "avisos próprios" : "avisos padrão"}</p>
                    </div>
                    <button type="button" class="btn-pequeno" data-acao="editar">Personalizar</button>
                </div>
                <ul class="programacao">${linhas || `<li class="pausado"><span>Nenhum aviso configurado</span><span></span></li>`}</ul>
                <div class="editor-lembrete oculto" id="editor-${escapar(lembrete.id)}"></div>
            </article>`;
    }).join("");

    if (editando != null) abrirEditor(editando, true);
}

function abrirEditor(idLembrete, manter) {

    const lembrete = lembretes.find(l => String(l.id) === String(idLembrete));
    const area = document.getElementById(`editor-${idLembrete}`);
    if (!lembrete || !area) { editando = null; return; }

    if (!manter) {
        editando = idLembrete;
        usarPadraoEmEdicao = !Array.isArray(lembrete.avisos);
        avisosEmEdicao = (Array.isArray(lembrete.avisos) ? lembrete.avisos : config.padrao).map(a => ({ ...a }));
    }

    area.innerHTML = `
        <label class="linha-opcao">
            <input type="checkbox" id="usarPadraoLembrete" ${usarPadraoEmEdicao ? "checked" : ""}>
            <span>Usar os avisos padrão neste lembrete</span>
        </label>
        <div class="lista-avisos ${usarPadraoEmEdicao ? "oculto" : ""}" id="listaProprios">
            ${avisosEmEdicao.map((a, i) => htmlLinhaAviso(a, i, "proprio")).join("")}
        </div>
        <button type="button" class="botao-secundario ${usarPadraoEmEdicao ? "oculto" : ""}" id="btnAddProprio">+ Adicionar aviso</button>
        <div class="acoes-editor">
            <button type="button" class="botao-primario" data-acao="salvar-lembrete">Salvar</button>
            <button type="button" class="botao-secundario" data-acao="cancelar-lembrete">Cancelar</button>
        </div>`;
    area.classList.remove("oculto");
}

el("listaProgramados").addEventListener("click", async evento => {

    const alvo = evento.target;
    const cartao = alvo.closest(".cartao-lembrete");
    if (!cartao) return;

    const id = cartao.dataset.id;

    if (alvo.closest('[data-acao="editar"]')) {
        editando = null;
        document.querySelectorAll(".editor-lembrete").forEach(e => e.classList.add("oculto"));
        abrirEditor(id, false);
        return;
    }

    if (alvo.closest('[data-acao="cancelar-lembrete"]')) {
        editando = null;
        cartao.querySelector(".editor-lembrete").classList.add("oculto");
        return;
    }

    const listaProprios = cartao.querySelector("#listaProprios");

    if (alvo.closest('[data-acao="remover"]') && listaProprios) {
        lerLinhas(listaProprios, avisosEmEdicao);
        avisosEmEdicao.splice(Number(alvo.closest(".linha-aviso").dataset.i), 1);
        abrirEditor(id, true);
        return;
    }

    if (alvo.id === "btnAddProprio") {
        lerLinhas(listaProprios, avisosEmEdicao);
        avisosEmEdicao.push({ id: novoId(), diasAntes: 1, hora: "09:00", ativo: true, criadoEm: Date.now() });
        abrirEditor(id, true);
        return;
    }

    if (alvo.id === "usarPadraoLembrete") {
        if (listaProprios) lerLinhas(listaProprios, avisosEmEdicao);
        usarPadraoEmEdicao = alvo.checked;
        abrirEditor(id, true);
        return;
    }

    if (alvo.closest('[data-acao="salvar-lembrete"]')) {

        const lembrete = lembretes.find(l => String(l.id) === String(id));
        if (!lembrete) return;

        if (usarPadraoEmEdicao) {
            delete lembrete.avisos;
        } else {
            if (listaProprios) lerLinhas(listaProprios, avisosEmEdicao);
            marcarCriacao(avisosEmEdicao, Array.isArray(lembrete.avisos) ? lembrete.avisos : config.padrao);
            lembrete.avisos = avisosEmEdicao.map(a => ({ ...a }));
        }

        await armazenamento.setItem("lembretes", JSON.stringify(lembretes));
        editando = null;
        renderizarProgramados();
    }
});

// ---------------- INÍCIO ----------------

renderizarPadrao();
renderizarProgramados();
await atualizarAparelho();
