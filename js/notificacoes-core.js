// Lógica PURA dos avisos agendados (sem imports, sem acesso ao Firebase).
// É usada em dois lugares, exatamente igual:
//  1. na página Notificações, para mostrar o que está programado;
//  2. no Worker (pasta worker/), para decidir o que enviar a cada minuto.
// O Worker é gerado a partir deste arquivo (worker/build.mjs), então a
// regra de "quando avisar" nunca fica diferente entre o app e o servidor.
//
// Os avisos NÃO são um segundo cadastro financeiro: cada aviso é só uma
// instrução ("N dias antes, às HH:MM") guardada dentro do próprio lembrete
// (lembrete.avisos) ou nos padrões (notifConfig.padrao). Datas, valores,
// pagamentos e recorrência continuam vindo do lembrete original.

export const FUSO_PADRAO = "America/Sao_Paulo";

const DIA_MS = 86400000;

// ---------------- DATAS ----------------

function limparId(valor) {
    return String(valor == null ? "" : valor).replace(/[^A-Za-z0-9]/g, "");
}

function diasNoMes(ano, mes) {
    return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function isoDeNumeros(ano, mes, dia) {
    return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function somarDiasISO(iso, dias) {
    const [a, m, d] = iso.split("-").map(Number);
    const t = new Date(Date.UTC(a, m - 1, d + dias));
    return isoDeNumeros(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// Criar um Intl.DateTimeFormat é caro; reaproveitamos um por fuso.
const formatadoresPartes = new Map();
const formatadoresData = new Map();
const cacheDeslocamento = new Map();

function formatadorPartes(fuso) {
    let f = formatadoresPartes.get(fuso);
    if (!f) {
        f = new Intl.DateTimeFormat("en-US", {
            timeZone: fuso, hourCycle: "h23",
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
        formatadoresPartes.set(fuso, f);
    }
    return f;
}

// Quanto o relógio do fuso está à frente do UTC naquele instante (em ms).
// O resultado só muda em trocas de horário de verão, que sempre caem em
// múltiplos de 15 minutos; por isso guardamos por faixa de 15 minutos.
function deslocamentoDoFuso(instanteMs, fuso) {
    const faixa = `${fuso}|${Math.floor(instanteMs / 900000)}`;
    const guardado = cacheDeslocamento.get(faixa);
    if (guardado !== undefined) return guardado;
    const p = {};
    formatadorPartes(fuso).formatToParts(new Date(instanteMs)).forEach(x => { p[x.type] = x.value; });
    const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const resultado = comoUtc - Math.floor(instanteMs / 1000) * 1000;
    if (cacheDeslocamento.size > 5000) cacheDeslocamento.clear();
    cacheDeslocamento.set(faixa, resultado);
    return resultado;
}

// "2026-11-27" + "08:00" no fuso do usuário -> instante absoluto (ms UTC).
export function localParaUtcMs(iso, hora, fuso) {
    const [a, m, d] = iso.split("-").map(Number);
    const [h, mi] = hora.split(":").map(Number);
    const palpite = Date.UTC(a, m - 1, d, h, mi);
    let t = palpite - deslocamentoDoFuso(palpite, fuso);
    t = palpite - deslocamentoDoFuso(t, fuso);
    return t;
}

export function hojeISO(agoraMs, fuso) {
    let f = formatadoresData.get(fuso);
    if (!f) {
        f = new Intl.DateTimeFormat("en-CA", {
            timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit"
        });
        formatadoresData.set(fuso, f);
    }
    return f.format(new Date(agoraMs));
}

function fimDoDiaMs(iso, fuso) {
    return localParaUtcMs(somarDiasISO(iso, 1), "00:00", fuso) - 1;
}

// ---------------- OCORRÊNCIAS (mesma regra do calendario.js / utils.js) ----------------

function dataInicioLembrete(lembrete, fuso) {
    if (lembrete.dataInicio) return lembrete.dataInicio;
    const criado = Number(lembrete.id);
    if (!(criado > 1e12)) return "";
    return hojeISO(criado, fuso);
}

function ocorrenciaMensalValida(lembrete, iso, fuso) {
    const [ano, mes] = iso.split("-");
    if (lembrete.pagamentos && lembrete.pagamentos[`${ano}-${mes}`]) return true;
    if (lembrete.dataFim && iso > lembrete.dataFim) return false;
    const inicio = dataInicioLembrete(lembrete, fuso);
    return !inicio || iso >= inicio;
}

function chaveOcorrencia(lembrete, iso) {
    return lembrete.recorrente ? iso.slice(0, 7) : lembrete.data;
}

export function ocorrenciaEstaPaga(lembrete, iso) {
    return !!(lembrete.pagamentos && lembrete.pagamentos[chaveOcorrencia(lembrete, iso)]);
}

// Datas de vencimento relevantes agora: a única (lembrete simples) ou
// do mês passado até 3 meses à frente (lembrete mensal).
export function ocorrenciasDoLembrete(lembrete, agoraMs, fuso) {

    if (!lembrete.recorrente) return lembrete.data ? [lembrete.data] : [];

    const [ano0, mes0] = hojeISO(agoraMs, fuso).split("-").map(Number);
    const lista = [];

    for (let i = -1; i <= 3; i++) {
        const ref = new Date(Date.UTC(ano0, mes0 - 1 + i, 1));
        const ano = ref.getUTCFullYear();
        const mes = ref.getUTCMonth() + 1;
        const dia = Math.min(Number(lembrete.diaDoMes), diasNoMes(ano, mes));
        if (!dia) continue;
        const iso = isoDeNumeros(ano, mes, dia);
        if (ocorrenciaMensalValida(lembrete, iso, fuso)) lista.push(iso);
    }

    return lista;
}

// Primeiro vencimento que ainda não foi pago e não passou (para listar na tela).
export function proximaOcorrenciaPendente(lembrete, agoraMs, fuso) {
    const hoje = hojeISO(agoraMs, fuso);
    return ocorrenciasDoLembrete(lembrete, agoraMs, fuso)
        .find(iso => iso >= hoje && !ocorrenciaEstaPaga(lembrete, iso)) || null;
}

// ---------------- AVISOS ----------------

// Avisos próprios do lembrete, se ele tiver; senão os padrões (se ligados).
export function avisosEfetivos(lembrete, config) {
    if (Array.isArray(lembrete.avisos)) return lembrete.avisos;
    if (config && config.aplicarPadrao === false) return [];
    return Array.isArray(config && config.padrao) ? config.padrao : [];
}

export function avisosDaOcorrencia(lembrete, iso, config, fuso) {

    const saida = [];
    const idLembrete = limparId(lembrete.id);
    const criadoLembrete = Number(lembrete.id) > 1e12 ? Number(lembrete.id) : 0;
    const pago = ocorrenciaEstaPaga(lembrete, iso);

    avisosEfetivos(lembrete, config).forEach(aviso => {

        if (!aviso || aviso.ativo === false) return;

        const idAviso = limparId(aviso.id);
        const dias = Number(aviso.diasAntes);

        if (!idAviso || !idLembrete) return;
        if (!Number.isInteger(dias) || dias < 0 || dias > 365) return;
        if (!/^\d{2}:\d{2}$/.test(String(aviso.hora))) return;

        const disparoMs = localParaUtcMs(somarDiasISO(iso, -dias), aviso.hora, fuso);

        // Não avisa retroativamente: um aviso cujo horário já tinha passado
        // quando o lembrete (ou o próprio aviso) foi criado não é enviado.
        const criadoEm = Math.max(criadoLembrete, Number(aviso.criadoEm) || 0);
        if (criadoEm && disparoMs < criadoEm - 60000) return;

        saida.push({
            chave: `l${idLembrete}_${iso.replace(/-/g, "")}_${idAviso}`,
            lembreteId: lembrete.id,
            titulo: String(lembrete.titulo || "Lembrete"),
            tipo: lembrete.tipoLembrete === "receber" ? "receber" : "pagar",
            valor: Number(lembrete.valor) || 0,
            vencimento: iso,
            diasAntes: dias,
            avisoId: idAviso,
            hora: aviso.hora,
            disparoMs,
            // depois do fim do dia do vencimento (ou 24h) o aviso perde o sentido
            janelaFimMs: Math.min(disparoMs + DIA_MS, fimDoDiaMs(iso, fuso)),
            pago
        });
    });

    return saida;
}

// opcoes.soJanelaAtual (usado pelo Worker): ignora de saída as ocorrências
// cujos avisos não podem estar na hora de disparar agora, o que deixa o
// ciclo de cada minuto bem mais leve. A página usa a lista completa.
export function calcularAvisos(lembretes, config, agoraMs, opcoes) {

    const fuso = (config && config.fuso) || FUSO_PADRAO;
    const soJanelaAtual = !!(opcoes && opcoes.soJanelaAtual);
    const hoje = hojeISO(agoraMs, fuso);
    const saida = [];

    (Array.isArray(lembretes) ? lembretes : []).forEach(lembrete => {

        if (!lembrete || lembrete.id == null) return;

        let maiorAntecedencia = 0;
        if (soJanelaAtual) {
            const lista = avisosEfetivos(lembrete, config);
            if (lista.length === 0) return;
            lista.forEach(a => { maiorAntecedencia = Math.max(maiorAntecedencia, Number(a && a.diasAntes) || 0); });
        }

        ocorrenciasDoLembrete(lembrete, agoraMs, fuso).forEach(iso => {
            if (soJanelaAtual) {
                if (iso < hoje) return;                                        // vencimento já terminou
                if (somarDiasISO(iso, -(maiorAntecedencia + 1)) > hoje) return; // ainda longe demais
                if (ocorrenciaEstaPaga(lembrete, iso)) return;
            }
            saida.push(...avisosDaOcorrencia(lembrete, iso, config, fuso));
        });
    });

    return saida.sort((a, b) => a.disparoMs - b.disparoMs);
}

// O que deve ser enviado AGORA: já chegou a hora, ainda está dentro da
// janela, não foi pago e ainda não consta como enviado.
export function avisosVencidos(lista, enviados, agoraMs) {
    return lista.filter(a =>
        !a.pago &&
        a.disparoMs <= agoraMs &&
        agoraMs <= a.janelaFimMs &&
        !(enviados && enviados[a.chave])
    );
}

// ---------------- TEXTO DA NOTIFICAÇÃO ----------------

function moedaBR(valor) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

export function montarMensagem(aviso) {

    const receber = aviso.tipo === "receber";
    const [, mes, dia] = aviso.vencimento.split("-");

    let quando;
    if (aviso.diasAntes === 0) quando = receber ? "Recebe hoje" : "Vence hoje";
    else if (aviso.diasAntes === 1) quando = receber ? "Recebe amanhã" : "Vence amanhã";
    else quando = `${receber ? "Recebe" : "Vence"} em ${aviso.diasAntes} dias (${dia}/${mes})`;

    return {
        title: `${receber ? "💰" : "🔔"} ${aviso.titulo}`,
        body: aviso.valor > 0 ? `${quando} — ${moedaBR(aviso.valor)}` : quando
    };
}
