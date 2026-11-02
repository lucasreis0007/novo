import { protegerPagina, carregarDados, criarArmazenamento, sair, iconeCategoriaTexto } from "./utils.js";
import {
    garantirCategoriaEmprestimo,
    listarEmprestimos,
    acharEmprestimo,
    ehMovEmprestimo,
    categoriaDoEmprestimo,
    categoriaDaDevolucao,
    categoriaDoPerdao,
    idsParaExcluir,
    sincronizarLembretesEmprestimo,
    formatarMoeda as moedaEmprestimo,
    NATUREZA_EMPRESTIMO,
    NATUREZA_DEVOLUCAO,
    NATUREZA_PERDAO
} from "./emprestimos-core.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

const formulario = document.getElementById("formMovimentacao");

const btnEntrada = document.getElementById("btnEntrada");
const btnSaida = document.getElementById("btnSaida");
const btnRendimento = document.getElementById("btnRendimento");

const tipo = document.getElementById("tipo");
const categoria = document.getElementById("categoria");
const banco = document.getElementById("banco");

const saldoBanco = document.getElementById("saldoBanco");
const linhaSaldoBanco = document.getElementById("linhaSaldoBanco");

const campoBanco = document.getElementById("campoBanco");
const campoCategoria = document.getElementById("campoCategoria");
const avisoRendimento = document.getElementById("avisoRendimento");
const btnVoltar = document.getElementById("btnVoltar");

// ---------------- PARÂMETROS DA URL ----------------
// "id" = está editando uma movimentação existente (vindo do Histórico
// ou do Calendário). "data" = veio do Calendário com um dia já
// escolhido, então pré-preenchemos o campo de data. "origem" indica de
// qual tela o usuário veio, pra saber pra onde voltar depois.

const params = new URLSearchParams(window.location.search);
const idEdicao = params.get("id");
const dataPreSelecionada = params.get("data");
const origem = params.get("origem");

function destinoAoVoltar() {

    if (idEdicao !== null) return "historico.html";
    if (origem === "calendario") {
        return dataPreSelecionada
            ? `calendario.html?data=${dataPreSelecionada}`
            : "calendario.html";
    }
    return "dashboard.html";
}

btnVoltar.addEventListener("click", () => {
    window.location.href = destinoAoVoltar();
});

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

function popularBancos() {

    const bancos = carregarBancos();

    banco.innerHTML = '<option value="">Selecione</option>';

    bancos.forEach(item => {
        banco.innerHTML += `
            <option value="${item.nome}">
                ${item.emoji} ${item.nome}
            </option>
        `;
    });
}

// ---------------- CATEGORIAS ----------------

function carregarCategorias() {

    let categorias = JSON.parse(localStorage.getItem("categorias"));

    // Conta recém-criada salva "categorias" como {} (objeto vazio, de
    // propósito). Antes só checávamos "=== null", então esse {} passava
    // direto e o código quebrava lá embaixo ao tentar ler categorias.saida.
    // Agora tratamos qualquer formato incompleto (null, {}, ou faltando
    // entrada/saida) como "ainda sem categorias" e preenchemos os padrões.
    const semDadosValidos =
        categorias === null ||
        !Array.isArray(categorias.entrada) ||
        !Array.isArray(categorias.saida);

    if (semDadosValidos) {

        categorias = {
            entrada: ["Salário", "Renda Extra", "Presente", "Outros"],
            saida: [
                { nome: "Alimentação", natureza: "Despesa" },
                { nome: "Mercado", natureza: "Despesa" },
                { nome: "Uber", natureza: "Despesa" },
                { nome: "Lazer", natureza: "Despesa" },
                { nome: "Futebol", natureza: "Despesa" },
                { nome: "Gympass", natureza: "Despesa" },
                { nome: "Streaming", natureza: "Despesa" },
                { nome: "Telefone", natureza: "Despesa" },
                { nome: "CNH", natureza: "Reserva" },
                { nome: "Reserva", natureza: "Reserva" },
                { nome: "Consórcio", natureza: "Despesa" },
                { nome: "Casa", natureza: "Despesa" },
                { nome: "Outros", natureza: "Despesa" },
                { nome: "Retirada da Reserva", natureza: "Resgate" }
            ]
        };

        localStorage.setItem("categorias", JSON.stringify(categorias));
    }

    // Migração: garante a categoria de retirada mesmo pra quem já tinha dados salvos
    const temRetirada = categorias.saida.some(c => c.natureza === "Resgate");

    if (!temRetirada) {
        categorias.saida.push({ nome: "Retirada da Reserva", natureza: "Resgate" });
        localStorage.setItem("categorias", JSON.stringify(categorias));
    }

    // Categoria de empréstimo: converte as antigas e garante uma padrão.
    if (garantirCategoriaEmprestimo(categorias)) {
        localStorage.setItem("categorias", JSON.stringify(categorias));
    }

    return categorias;
}

// ---------------- BOTÕES ----------------

btnEntrada.classList.add("entrada", "ativo");
btnSaida.classList.add("saida");
btnRendimento.classList.add("rendimento");

tipo.value = "Entrada";

// Alterna a exibição dos campos Banco/Categoria e do aviso conforme o
// tipo escolhido. No modo "Rendimento" não existe banco de origem nem
// categoria: o dinheiro nunca esteve no saldo disponível, então não faz
// sentido descontar de conta nenhuma.
function alternarCamposPorTipo() {

    const ehRendimento = tipo.value === "Rendimento";

    campoBanco.style.display = ehRendimento ? "none" : "flex";
    campoCategoria.style.display = ehRendimento ? "none" : "flex";
    avisoRendimento.style.display = ehRendimento ? "block" : "none";

    banco.required = !ehRendimento;
    categoria.required = !ehRendimento;
}

btnEntrada.addEventListener("click", () => {
    tipo.value = "Entrada";

    btnEntrada.classList.add("ativo");
    btnSaida.classList.remove("ativo");
    btnRendimento.classList.remove("ativo");

    alternarCamposPorTipo();
    atualizarCategorias();
});

btnSaida.addEventListener("click", () => {
    tipo.value = "Saída";

    btnSaida.classList.add("ativo");
    btnEntrada.classList.remove("ativo");
    btnRendimento.classList.remove("ativo");

    alternarCamposPorTipo();
    atualizarCategorias();
});

btnRendimento.addEventListener("click", () => {
    tipo.value = "Rendimento";

    btnRendimento.classList.add("ativo");
    btnEntrada.classList.remove("ativo");
    btnSaida.classList.remove("ativo");

    alternarCamposPorTipo();
});

// ---------------- CATEGORIAS ----------------

// ---------------- METAS (Retirada da meta) ----------------
// Cada meta cadastrada aparece nas opções de Entrada como
// "Retirada da meta: <nome>". O valor da opção é "meta:<id>".

const PREFIXO_META = "meta:";

// ---------------- EMPRÉSTIMO ----------------
// Dois jeitos de começar um empréstimo:
//  - Saída numa categoria de natureza "Empréstimo": você emprestou para alguém;
//  - Entrada em "Peguei emprestado": alguém emprestou para você.
// Nos dois pedimos a pessoa e a data prevista de pagamento, e criamos um
// lembrete (Calendário/Dashboard) que acompanha o saldo em aberto.
// Para devolver (parte do) valor, escolha "Devolução de ..." (Entrada) ou
// "Pagar empréstimo ..." (Saída) na lista de categorias.

const PREFIXO_DEVOLUCAO = "emp:dev:";
const VALOR_NOVO_RECEBIDO = "emp:novo";

const campoEmprestimo = document.getElementById("campoEmprestimo");
const devedorInput = document.getElementById("devedor");
const dataPagamentoEmprestimo = document.getElementById("dataPagamentoEmprestimo");
const rotuloDevedor = document.getElementById("rotuloDevedor");
const rotuloDataEmprestimo = document.getElementById("rotuloDataEmprestimo");
const avisoEmprestimo = document.getElementById("avisoEmprestimo");
const avisoDevolucao = document.getElementById("avisoDevolucao");

function movimentacoesAtuais() {
    return JSON.parse(localStorage.getItem("movimentacoes")) || [];
}

function categoriaEhEmprestimo(nome) {
    return carregarCategorias().saida.some(
        c => c.natureza === NATUREZA_EMPRESTIMO && c.nome === nome
    );
}

// "dado" (emprestei), "recebido" (peguei emprestado) ou null
function direcaoNovoEmprestimo() {

    if (tipo.value === "Saída" && categoriaEhEmprestimo(categoria.value)) return "dado";
    if (tipo.value === "Entrada" && categoria.value === VALOR_NOVO_RECEBIDO) return "recebido";

    return null;
}

function emprestimoAtivo() {
    return direcaoNovoEmprestimo() !== null;
}

// Empréstimo em aberto escolhido para devolver/pagar (ou null)
function devolucaoSelecionada() {

    if (!categoria.value.startsWith(PREFIXO_DEVOLUCAO)) return null;

    return acharEmprestimo(
        movimentacoesAtuais(),
        categoria.value.slice(PREFIXO_DEVOLUCAO.length)
    );
}

function carregarLembretes() {
    return JSON.parse(localStorage.getItem("lembretes")) || [];
}

function somarDiasISO(dataISO, dias) {

    const [ano, mes, dia] = (dataISO || "").split("-").map(Number);

    const base = ano ? new Date(ano, mes - 1, dia) : new Date();

    base.setDate(base.getDate() + dias);

    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

function textosDoCampoEmprestimo(direcao) {

    const dado = direcao === "dado";

    rotuloDevedor.textContent = dado ? "Quem vai te pagar?" : "De quem você pegou emprestado?";
    rotuloDataEmprestimo.textContent = dado ? "Quando ele vai pagar?" : "Quando você vai pagar?";
    avisoEmprestimo.textContent = dado
        ? "🔔 Vai aparecer um lembrete no Calendário e no Dashboard para você cobrar."
        : "🔔 Vai aparecer um lembrete no Calendário e no Dashboard para você pagar.";
}

function atualizarCampoEmprestimo() {

    const direcao = direcaoNovoEmprestimo();
    const ativo = direcao !== null;

    campoEmprestimo.style.display = ativo ? "flex" : "none";

    devedorInput.required = ativo;
    dataPagamentoEmprestimo.required = ativo;

    if (ativo) {
        textosDoCampoEmprestimo(direcao);
    }

    // sugestão: 30 dias depois da data do lançamento
    if (ativo && !dataPagamentoEmprestimo.value) {
        dataPagamentoEmprestimo.value = somarDiasISO(document.getElementById("data").value, 30);
    }

    atualizarAvisoDevolucao();
}

function atualizarAvisoDevolucao() {

    const emprestimo = devolucaoSelecionada();

    if (!emprestimo) {
        avisoDevolucao.style.display = "none";
        return;
    }

    avisoDevolucao.style.display = "block";
    avisoDevolucao.textContent =
        `Valor original ${moedaEmprestimo(emprestimo.valor)} · já devolvido ${moedaEmprestimo(emprestimo.devolvido)} · falta ${moedaEmprestimo(emprestimo.saldo)}. Pode ser pagamento parcial.`;
}

categoria.addEventListener("change", atualizarCampoEmprestimo);

function carregarMetas() {
    return JSON.parse(localStorage.getItem("metas")) || [];
}

function salvarMetas(metas) {
    return localStorage.setItem("metas", JSON.stringify(metas));
}

function arredondar(valor) {
    return Math.round(Number(valor) * 100) / 100;
}

function atualizarCategorias() {

    const categorias = carregarCategorias();

    // "Retirada da Reserva" continua guardada junto das categorias de
    // saída (natureza "Resgate"), mas agora aparece nas opções de
    // Entrada — é dinheiro que sai da reserva e entra no saldo.
    const nomesResgate = categorias.saida
        .filter(item => item.natureza === "Resgate")
        .map(item => item.nome);

    const lista =
        tipo.value === "Entrada"
            ? categorias.entrada.concat(nomesResgate)
            : categorias.saida
                .filter(item => item.natureza !== "Resgate")
                .map(item => item.nome);

    categoria.innerHTML = '<option value="">Selecione</option>';

    lista.forEach(item => {
        categoria.innerHTML += `
            <option value="${item}">
                ${iconeCategoriaTexto(item, categorias)} ${item}
            </option>
        `;
    });

    // Uma opção por meta (só em Entrada): o dinheiro sai da meta e entra
    // na conta escolhida, sem contar como receita.
    if (tipo.value === "Entrada") {

        const metas = carregarMetas();

        if (metas.length > 0) {

            const grupo = document.createElement("optgroup");
            grupo.label = "Retirada da meta";

            metas.forEach(meta => {
                const opcao = document.createElement("option");
                opcao.value = PREFIXO_META + meta.id;
                opcao.textContent = `${meta.emoji || "🎯"} Retirada da meta: ${meta.nome}`;
                grupo.appendChild(opcao);
            });

            categoria.appendChild(grupo);
        }
    }

    // Empréstimos: peguei emprestado / devoluções recebidas (Entrada) e
    // pagamentos do que eu devo (Saída).
    const emprestimosAbertos = listarEmprestimos(movimentacoesAtuais()).filter(e => e.saldo > 0);

    const criarOpcaoEmprestimo = (valor, texto) => {
        const opcao = document.createElement("option");
        opcao.value = valor;
        opcao.textContent = texto;
        return opcao;
    };

    if (tipo.value === "Entrada") {

        const grupo = document.createElement("optgroup");
        grupo.label = "Empréstimos";

        grupo.appendChild(criarOpcaoEmprestimo(VALOR_NOVO_RECEBIDO, "🤝 Peguei emprestado"));

        emprestimosAbertos
            .filter(e => e.direcao === "dado")
            .forEach(e => {
                grupo.appendChild(criarOpcaoEmprestimo(
                    PREFIXO_DEVOLUCAO + e.id,
                    `💵 Devolução de ${e.pessoa} (falta ${moedaEmprestimo(e.saldo)})`
                ));
            });

        categoria.appendChild(grupo);

    } else if (tipo.value === "Saída") {

        const aPagar = emprestimosAbertos.filter(e => e.direcao === "recebido");

        if (aPagar.length > 0) {

            const grupo = document.createElement("optgroup");
            grupo.label = "Pagar empréstimo";

            aPagar.forEach(e => {
                grupo.appendChild(criarOpcaoEmprestimo(
                    PREFIXO_DEVOLUCAO + e.id,
                    `💸 Pagar ${e.pessoa} (falta ${moedaEmprestimo(e.saldo)})`
                ));
            });

            categoria.appendChild(grupo);
        }
    }

    atualizarCampoEmprestimo();
}

// ---------------- SALDO DO BANCO ----------------

function atualizarSaldoBanco() {

    if (!banco.value) {
        linhaSaldoBanco.style.display = "none";
        return;
    }

    linhaSaldoBanco.style.display = "block";

    const movimentacoes =
        JSON.parse(localStorage.getItem("movimentacoes")) || [];

    let saldo = 0;

    movimentacoes.forEach(mov => {

        if (mov.banco !== banco.value) return;

        // Retirada da reserva entra nessa conta, então soma como entrada.
        if (mov.tipo === "Entrada" || mov.natureza === "Resgate") {
            saldo += Number(mov.valor);
        } else {
            saldo -= Number(mov.valor);
        }

    });

    saldoBanco.textContent = saldo.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

banco.addEventListener("change", atualizarSaldoBanco);

popularBancos();
atualizarCategorias();
atualizarSaldoBanco();

// ---------------- DATA PRÉ-SELECIONADA (vinda do Calendário) ----------------

if (idEdicao === null && dataPreSelecionada) {
    document.getElementById("data").value = dataPreSelecionada;
}

// ---------------- MODO EDIÇÃO ----------------

let movimentacaoEditando = null;
let editandoAporteMeta = false;
let editandoEmprestimo = false;

const btnExcluirMov = document.getElementById("btnExcluirMov");
const btnSalvar = document.getElementById("btnSalvar");

if (idEdicao !== null) {

    const movimentacoesExistentes =
        JSON.parse(localStorage.getItem("movimentacoes")) || [];

    movimentacaoEditando = movimentacoesExistentes.find(
        mov => String(mov.id) === String(idEdicao)
    );

    // Aporte/rendimento de meta: tela simplificada (valor, data,
    // descrição e, no aporte, a conta de origem).
    editandoAporteMeta = Boolean(
        movimentacaoEditando &&
        ["Meta", "RendimentoMeta"].includes(movimentacaoEditando.natureza)
    );

    // Empréstimo, devolução ou perdão: tela simplificada (o tipo e a
    // pessoa/empréstimo ligados não mudam aqui).
    editandoEmprestimo = Boolean(
        movimentacaoEditando && ehMovEmprestimo(movimentacaoEditando)
    );

    if (movimentacaoEditando) {

        document.getElementById("tituloAba").textContent = "Editar Movimentação";
        document.getElementById("tituloTela").textContent = "Editar movimentação";
        document.getElementById("subtituloTela").textContent = "Altere os dados e salve";
        btnSalvar.textContent = "💾 Salvar alterações";
        btnExcluirMov.style.display = "block";

        if (editandoAporteMeta) {

            const ehRendimentoMeta = movimentacaoEditando.natureza === "RendimentoMeta";

            document.getElementById("tituloAba").textContent = ehRendimentoMeta ? "Editar rendimento" : "Editar aporte";
            document.getElementById("tituloTela").textContent = ehRendimentoMeta ? "Editar rendimento da meta" : "Editar aporte na meta";
            document.getElementById("subtituloTela").textContent = movimentacaoEditando.categoria || "";

            // sem escolha de tipo nem de categoria: o tipo e a meta não mudam
            btnEntrada.closest(".campo").style.display = "none";
            campoCategoria.style.display = "none";
            categoria.required = false;

            if (ehRendimentoMeta) {
                // rendimento não sai de conta nenhuma
                campoBanco.style.display = "none";
                banco.required = false;
            } else {
                popularBancos();
                banco.value = movimentacaoEditando.banco;
                atualizarSaldoBanco();
            }

        } else if (editandoEmprestimo) {

            const natu = movimentacaoEditando.natureza;
            const dado = movimentacaoEditando.direcao
                ? movimentacaoEditando.direcao === "dado"
                : movimentacaoEditando.tipo === "Saída";

            const rotulo = natu === NATUREZA_EMPRESTIMO
                ? (dado ? "empréstimo que fiz" : "empréstimo que peguei")
                : natu === NATUREZA_DEVOLUCAO ? "devolução" : "perdão";

            document.getElementById("tituloAba").textContent = `Editar ${rotulo}`;
            document.getElementById("tituloTela").textContent = `Editar ${rotulo}`;
            document.getElementById("subtituloTela").textContent = movimentacaoEditando.categoria || "";

            btnEntrada.closest(".campo").style.display = "none";
            campoCategoria.style.display = "none";
            categoria.required = false;

            if (natu === NATUREZA_PERDAO) {
                // perdão não mexe em nenhuma conta
                campoBanco.style.display = "none";
                banco.required = false;
            } else {
                popularBancos();
                banco.value = movimentacaoEditando.banco;
                atualizarSaldoBanco();
            }

            if (natu === NATUREZA_EMPRESTIMO) {

                campoEmprestimo.style.display = "flex";
                devedorInput.required = true;
                dataPagamentoEmprestimo.required = true;
                textosDoCampoEmprestimo(dado ? "dado" : "recebido");

                devedorInput.value = movimentacaoEditando.pessoa || "";
                dataPagamentoEmprestimo.value = movimentacaoEditando.dataPrevista || "";
            }

        } else if (movimentacaoEditando.natureza === "Resgate") {
            btnEntrada.click();
        } else if (movimentacaoEditando.tipo === "Entrada") {
            btnEntrada.click();
        } else if (movimentacaoEditando.tipo === "Rendimento") {
            btnRendimento.click();
        } else {
            btnSaida.click();
        }

        if (!editandoAporteMeta && !editandoEmprestimo) {
            popularBancos();
            banco.value = movimentacaoEditando.banco;
            atualizarSaldoBanco();
        }

        if (!editandoAporteMeta && !editandoEmprestimo && movimentacaoEditando.tipo !== "Rendimento") {
            atualizarCategorias();
            categoria.value = movimentacaoEditando.metaId
                ? PREFIXO_META + movimentacaoEditando.metaId
                : movimentacaoEditando.categoria;

            atualizarCampoEmprestimo();

            const lembreteVinculado = carregarLembretes().find(
                l => String(l.movimentacaoId) === String(movimentacaoEditando.id)
            );

            if (lembreteVinculado) {
                devedorInput.value = lembreteVinculado.devedor || "";
                dataPagamentoEmprestimo.value = lembreteVinculado.data || dataPagamentoEmprestimo.value;
            }
        }

        document.getElementById("valor").value = movimentacaoEditando.valor;
        document.getElementById("data").value = movimentacaoEditando.data;
        document.getElementById("descricao").value = movimentacaoEditando.descricao || "";
    }
}

btnExcluirMov.addEventListener("click", async () => {

    if (!movimentacaoEditando) return;

    const confirmar = confirm("Tem certeza que deseja excluir essa movimentação?");
    if (!confirmar) return;

    // Excluir uma retirada de meta devolve o valor para a meta.
    if (movimentacaoEditando.metaId) {

        const metasAtuais = carregarMetas();
        const metaOrigem = metasAtuais.find(
            m => String(m.id) === String(movimentacaoEditando.metaId)
        );

        if (metaOrigem) {
            metaOrigem.valorAtual = arredondar(
                Number(metaOrigem.valorAtual) + (["Meta", "RendimentoMeta"].includes(movimentacaoEditando.natureza) ? -1 : 1) * Number(movimentacaoEditando.valor)
            );
            await salvarMetas(metasAtuais);
        }
    }

    let movimentacoes =
        JSON.parse(localStorage.getItem("movimentacoes")) || [];

    // Excluir um empréstimo leva junto as devoluções e perdões dele.
    const idsExcluir = idsParaExcluir(movimentacaoEditando, movimentacoes).map(String);

    if (idsExcluir.length > 1) {

        const ligados = idsExcluir.length - 1;

        if (!confirm(`Esse empréstimo tem ${ligados} devolução(ões)/perdão registrado(s). Eles também serão excluídos. Continuar?`)) return;
    }

    movimentacoes = movimentacoes.filter(
        mov => !idsExcluir.includes(String(mov.id))
    );

    // espera o Firestore confirmar antes de trocar de página, senão a
    // navegação cancela o salvamento antes dele terminar
    await localStorage.setItem("movimentacoes", JSON.stringify(movimentacoes));

    // apaga o lembrete de empréstimo ligado a esse lançamento
    const lembretesAtuais = carregarLembretes();
    const lembretesRestantes = lembretesAtuais.filter(
        l => String(l.movimentacaoId) !== String(idEdicao)
    );

    let lembretesMudaram = lembretesRestantes.length !== lembretesAtuais.length;

    // lançamento criado ao marcar um lembrete como pago: o lembrete volta a ficar pendente
    if (movimentacaoEditando.lembreteId != null) {

        const origem = lembretesRestantes.find(l => l.id === movimentacaoEditando.lembreteId);

        if (origem && origem.pagamentos && origem.pagamentos[movimentacaoEditando.lembreteChave]) {
            delete origem.pagamentos[movimentacaoEditando.lembreteChave];
            lembretesMudaram = true;
        }
    }

    // empréstimo: o lembrete acompanha o saldo (reabre se uma devolução
    // foi excluída, some se o empréstimo foi excluído)
    const lembretesFinais = sincronizarLembretesEmprestimo(movimentacoes, lembretesRestantes);

    if (lembretesMudaram || JSON.stringify(lembretesFinais) !== JSON.stringify(lembretesRestantes)) {
        await localStorage.setItem("lembretes", JSON.stringify(lembretesFinais));
    }

    window.location.href = "historico.html";
});

// ---------------- SALVAR ----------------

// Edição de aporte/rendimento de meta: muda valor, data, descrição e
// (no aporte) a conta. A meta é ajustada pela diferença de valor.
async function salvarEdicaoAporteMeta() {

    const ehRendimentoMeta = movimentacaoEditando.natureza === "RendimentoMeta";

    const valor = Number(document.getElementById("valor").value);
    const data = document.getElementById("data").value;
    const descricao = document.getElementById("descricao").value;

    if (!valor || valor <= 0) {
        alert("Digite um valor válido.");
        return;
    }

    if (!ehRendimentoMeta && !banco.value) {
        alert("Escolha a conta de onde o dinheiro saiu.");
        return;
    }

    const metas = carregarMetas();

    const meta = metas.find(
        m => String(m.id) === String(movimentacaoEditando.metaId)
    );

    const diferenca = arredondar(valor - Number(movimentacaoEditando.valor));

    if (meta && diferenca !== 0) {

        const novoValorMeta = arredondar(Number(meta.valorAtual) + diferenca);

        if (novoValorMeta < 0) {
            alert(
                `Essa alteração deixaria a meta "${meta.nome}" negativa, porque parte desse valor já foi retirada. Retire menos, ou ajuste a retirada antes.`
            );
            return;
        }

        meta.valorAtual = novoValorMeta;
    }

    const movimentacoes =
        JSON.parse(localStorage.getItem("movimentacoes")) || [];

    const index = movimentacoes.findIndex(
        mov => String(mov.id) === String(idEdicao)
    );

    if (index === -1) return;

    movimentacoes[index] = {
        ...movimentacoes[index],
        banco: ehRendimentoMeta ? "" : banco.value,
        valor,
        data,
        descricao
    };

    await localStorage.setItem("movimentacoes", JSON.stringify(movimentacoes));

    if (meta && diferenca !== 0) {
        await salvarMetas(metas);
    }

    window.location.href = "historico.html";
}

// Edição de empréstimo, devolução ou perdão: muda valor, data, descrição
// e (quando existem) conta, pessoa e data prevista. O saldo é recalculado
// a partir dos lançamentos, então só validamos os limites.
async function salvarEdicaoEmprestimo() {

    const mov = movimentacaoEditando;

    const valor = Number(document.getElementById("valor").value);
    const data = document.getElementById("data").value;
    const descricao = document.getElementById("descricao").value;

    if (!valor || valor <= 0) {
        alert("Digite um valor válido.");
        return;
    }

    if (mov.natureza !== NATUREZA_PERDAO && !banco.value) {
        alert("Escolha a conta.");
        return;
    }

    const movimentacoes = movimentacoesAtuais();

    const emprestimo = acharEmprestimo(movimentacoes, mov.emprestimoId);

    const alteracoes = {
        valor,
        data,
        descricao,
        banco: mov.natureza === NATUREZA_PERDAO ? "" : banco.value
    };

    if (mov.natureza === NATUREZA_EMPRESTIMO) {

        const pessoa = devedorInput.value.trim();

        if (!pessoa) {
            alert("Diga o nome da pessoa.");
            return;
        }

        const jaAbatido = emprestimo ? emprestimo.devolvido + emprestimo.perdoado : 0;

        if (valor < jaAbatido - 0.004) {
            alert(`Esse empréstimo já teve ${moedaEmprestimo(jaAbatido)} devolvido ou perdoado. O valor não pode ser menor que isso.`);
            return;
        }

        const direcao = emprestimo ? emprestimo.direcao : (mov.tipo === "Saída" ? "dado" : "recebido");

        alteracoes.pessoa = pessoa;
        alteracoes.dataPrevista = dataPagamentoEmprestimo.value;
        alteracoes.categoria = categoriaDoEmprestimo(direcao, pessoa);

        // devoluções e perdões carregam o nome da pessoa na categoria
        movimentacoes.forEach(m => {
            if (m.emprestimoId == null || String(m.emprestimoId) !== String(mov.emprestimoId)) return;
            if (m.natureza === NATUREZA_DEVOLUCAO) m.categoria = categoriaDaDevolucao(direcao, pessoa);
            if (m.natureza === NATUREZA_PERDAO) m.categoria = categoriaDoPerdao(pessoa, m.direcao);
        });

    } else {

        const maximo = emprestimo ? emprestimo.saldo + Number(mov.valor) : valor;

        if (valor > maximo + 0.004) {
            alert(`O valor passa do que falta no empréstimo. O máximo é ${moedaEmprestimo(maximo)}.`);
            return;
        }
    }

    const indice = movimentacoes.findIndex(m => String(m.id) === String(idEdicao));

    if (indice === -1) return;

    movimentacoes[indice] = { ...movimentacoes[indice], ...alteracoes };

    await localStorage.setItem("movimentacoes", JSON.stringify(movimentacoes));

    await localStorage.setItem(
        "lembretes",
        JSON.stringify(sincronizarLembretesEmprestimo(movimentacoes, carregarLembretes()))
    );

    window.location.href = "historico.html";
}

// Novo empréstimo (emprestei / peguei emprestado) ou devolução de um
// empréstimo em aberto. Se estava editando um lançamento comum, ele é
// substituído por este.
async function salvarFluxoEmprestimo(direcaoNovo, devolucao) {

    const valor = Number(document.getElementById("valor").value);
    const data = document.getElementById("data").value;
    const descricao = document.getElementById("descricao").value;

    if (!valor || valor <= 0) {
        alert("Digite um valor válido.");
        return;
    }

    if (!banco.value) {
        alert("Escolha a conta.");
        return;
    }

    if (movimentacaoEditando && movimentacaoEditando.metaId) {
        alert("Uma retirada de meta não pode virar empréstimo. Exclua e lance de novo.");
        return;
    }

    const id = movimentacaoEditando ? movimentacaoEditando.id : Date.now();

    let nova;

    if (direcaoNovo) {

        const pessoa = devedorInput.value.trim();

        if (!pessoa) {
            alert(direcaoNovo === "dado" ? "Diga quem vai te pagar." : "Diga de quem você pegou emprestado.");
            return;
        }

        nova = {
            id,
            tipo: direcaoNovo === "dado" ? "Saída" : "Entrada",
            natureza: NATUREZA_EMPRESTIMO,
            emprestimoId: id,
            direcao: direcaoNovo,
            pessoa,
            dataPrevista: dataPagamentoEmprestimo.value,
            banco: banco.value,
            categoria: categoriaDoEmprestimo(direcaoNovo, pessoa),
            valor,
            data,
            descricao
        };

    } else {

        if (valor > devolucao.saldo + 0.004) {
            alert(`O valor é maior que o que falta (${moedaEmprestimo(devolucao.saldo)}).`);
            return;
        }

        nova = {
            id,
            tipo: devolucao.direcao === "dado" ? "Entrada" : "Saída",
            natureza: NATUREZA_DEVOLUCAO,
            emprestimoId: devolucao.id,
            banco: banco.value,
            categoria: categoriaDaDevolucao(devolucao.direcao, devolucao.pessoa),
            valor,
            data,
            descricao
        };
    }

    const movimentacoes = movimentacoesAtuais();

    if (movimentacaoEditando) {

        const indice = movimentacoes.findIndex(m => String(m.id) === String(idEdicao));

        if (indice !== -1) movimentacoes[indice] = nova;
        else movimentacoes.push(nova);

    } else {
        movimentacoes.push(nova);
    }

    await localStorage.setItem("movimentacoes", JSON.stringify(movimentacoes));

    await localStorage.setItem(
        "lembretes",
        JSON.stringify(sincronizarLembretesEmprestimo(movimentacoes, carregarLembretes()))
    );

    if (movimentacaoEditando) {
        window.location.href = "historico.html";
    } else if (origem === "calendario") {
        window.location.href = `calendario.html?data=${data}`;
    } else {
        window.location.href = "dashboard.html";
    }
}

formulario.addEventListener("submit", async function (e) {

    e.preventDefault();

    if (editandoAporteMeta) {
        await salvarEdicaoAporteMeta();
        return;
    }

    if (editandoEmprestimo) {
        await salvarEdicaoEmprestimo();
        return;
    }

    const ehRendimento = tipo.value === "Rendimento";

    if (!ehRendimento && categoria.value === "") {
        alert("Selecione uma categoria.");
        return;
    }

    // Empréstimo novo ou devolução: fluxo próprio
    const direcaoEmprestimoNovo = direcaoNovoEmprestimo();
    const emprestimoDevolvido = devolucaoSelecionada();

    if (direcaoEmprestimoNovo || emprestimoDevolvido) {
        await salvarFluxoEmprestimo(direcaoEmprestimoNovo, emprestimoDevolvido);
        return;
    }

    const valor = Number(document.getElementById("valor").value);

    // ---- Retirada da meta ----
    // Ao editar uma retirada antiga, o valor dela volta pra meta antes
    // de aplicar o novo (senão seria descontado duas vezes).
    const metas = carregarMetas();

    if (movimentacaoEditando && movimentacaoEditando.metaId) {

        const metaAntiga = metas.find(
            m => String(m.id) === String(movimentacaoEditando.metaId)
        );

        if (metaAntiga) {
            metaAntiga.valorAtual = arredondar(
                Number(metaAntiga.valorAtual) + Number(movimentacaoEditando.valor)
            );
        }
    }

    const metaSelecionada =
        !ehRendimento &&
        tipo.value === "Entrada" &&
        categoria.value.startsWith(PREFIXO_META)
            ? metas.find(m => String(m.id) === categoria.value.slice(PREFIXO_META.length))
            : null;

    if (metaSelecionada && valor > Number(metaSelecionada.valorAtual) + 0.001) {
        alert(
            `Saldo insuficiente na meta "${metaSelecionada.nome}". Você tem ${Number(metaSelecionada.valorAtual).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} guardado.`
        );
        return;
    }

    let natureza = "Despesa";

    const categorias = carregarCategorias();

    // Categoria com natureza "Meta": a saída vira um aporte na meta
    // ligada a ela (mesmo lançamento que o botão "Adicionar" da tela Metas).
    const categoriaMeta = tipo.value === "Saída"
        ? categorias.saida.find(c => c.natureza === "Meta" && c.nome === categoria.value)
        : null;

    const metaDaCategoria = categoriaMeta
        ? metas.find(m => String(m.id) === String(categoriaMeta.metaId))
        : null;

    if (categoriaMeta && !metaDaCategoria) {
        alert(`A meta ligada à categoria "${categoriaMeta.nome}" não existe mais. Edite a categoria e escolha outra meta.`);
        return;
    }

    // "Retirada da Reserva" aparece nas opções de Entrada, mas continua
    // com natureza "Resgate" (é isso que faz ela descontar da reserva
    // em vez de contar como uma entrada comum).
    const categoriaResgate = categorias.saida.find(
        c => c.natureza === "Resgate" && c.nome === categoria.value
    );

    if (metaSelecionada) {
        // Não é receita nem despesa: o dinheiro só muda de lugar
        // (meta → conta). Mesma natureza das transferências entre contas,
        // que já ficam fora dos totais de receita/despesa.
        natureza = "Transferência";
    } else if (metaDaCategoria) {
        natureza = "Meta";
    } else if (ehRendimento) {
        natureza = "Rendimento";
    } else if (categoriaResgate) {
        natureza = "Resgate";
    } else if (tipo.value === "Entrada") {
        natureza = "Entrada";
    } else {

        const categoriaEncontrada = categorias.saida.find(c => c.nome === categoria.value);

        natureza = categoriaEncontrada ? categoriaEncontrada.natureza : "Despesa";
    }

    const movimentacoes =
        JSON.parse(localStorage.getItem("movimentacoes")) || [];

    if (natureza === "Resgate") {

        let totalReservas = 0;

        movimentacoes.forEach(mov => {

            // Ao editar, ignora o próprio lançamento antigo na conta,
            // senão ele seria descontado duas vezes.
            if (movimentacaoEditando && String(mov.id) === String(idEdicao)) return;

            if (mov.natureza === "Reserva") totalReservas += Number(mov.valor);
            if (mov.natureza === "Rendimento") totalReservas += Number(mov.valor);
            if (mov.natureza === "Resgate") totalReservas -= Number(mov.valor);
        });

        if (valor > totalReservas) {
            alert(
                `Saldo insuficiente na reserva. Você tem ${totalReservas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} guardado.`
            );
            return;
        }
    }

    const metaIdSalvo = metaSelecionada
        ? metaSelecionada.id
        : (metaDaCategoria ? metaDaCategoria.id : undefined);

    const categoriaSalva = metaSelecionada
        ? `Retirada da meta: ${metaSelecionada.nome}`
        : metaDaCategoria
            ? `Meta: ${metaDaCategoria.nome}`
            : ehRendimento ? "Rendimento da Reserva" : categoria.value;
    const bancoSalvo = ehRendimento ? "" : banco.value;

    const idMovSalva = movimentacaoEditando ? movimentacaoEditando.id : Date.now();

    const criarLembreteEmprestimo = emprestimoAtivo();
    const nomeDevedor = devedorInput.value.trim();

    if (criarLembreteEmprestimo && !nomeDevedor) {
        alert("Diga quem vai te pagar esse empréstimo.");
        return;
    }

    if (movimentacaoEditando) {

        const index = movimentacoes.findIndex(
            mov => String(mov.id) === String(idEdicao)
        );

        if (index !== -1) {

            movimentacoes[index] = {
                ...movimentacoes[index],
                tipo: tipo.value,
                natureza,
                banco: bancoSalvo,
                categoria: categoriaSalva,
                metaId: metaIdSalvo,
                valor,
                data: document.getElementById("data").value,
                descricao: document.getElementById("descricao").value
            };
        }

    } else {

        const movimentacao = {
            id: idMovSalva,
            tipo: tipo.value,
            natureza,
            banco: bancoSalvo,
            categoria: categoriaSalva,
            metaId: metaIdSalvo,
            valor,
            data: document.getElementById("data").value,
            descricao: document.getElementById("descricao").value
        };

        movimentacoes.push(movimentacao);
    }

    // espera o Firestore confirmar o salvamento antes de trocar de
    // página — antes disso, a navegação cancelava o envio no meio do
    // caminho e o lançamento nunca chegava a ser gravado
    if (metaSelecionada) {
        metaSelecionada.valorAtual = arredondar(
            Number(metaSelecionada.valorAtual) - valor
        );
    }

    if (metaDaCategoria) {
        metaDaCategoria.valorAtual = arredondar(
            Number(metaDaCategoria.valorAtual) + valor
        );
    }

    if (metaSelecionada || metaDaCategoria || (movimentacaoEditando && movimentacaoEditando.metaId)) {
        await salvarMetas(metas);
    }

    await localStorage.setItem(
        "movimentacoes",
        JSON.stringify(movimentacoes)
    );

    // Lembrete de quem deve pagar o empréstimo (criado, atualizado ou,
    // se a categoria deixou de ser Empréstimo, removido).
    const lembretes = carregarLembretes();
    const indiceLembrete = lembretes.findIndex(
        l => String(l.movimentacaoId) === String(idMovSalva)
    );
    let lembretesMudaram = false;

    if (criarLembreteEmprestimo) {

        const dataEmprestimo = document.getElementById("data").value.split("-").reverse().join("/");

        const dadosLembrete = {
            titulo: `Receber de ${nomeDevedor}`,
            devedor: nomeDevedor,
            valor,
            recorrente: false,
            data: dataPagamentoEmprestimo.value,
            observacao: `Empréstimo de ${valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} feito em ${dataEmprestimo}`,
            tipoLembrete: "receber",
            movimentacaoId: idMovSalva
        };

        if (indiceLembrete === -1) {
            lembretes.push({ id: Date.now() + 1, pagamentos: {}, ...dadosLembrete });
        } else {
            lembretes[indiceLembrete] = { ...lembretes[indiceLembrete], ...dadosLembrete };
        }

        lembretesMudaram = true;

    } else if (indiceLembrete !== -1) {

        lembretes.splice(indiceLembrete, 1);
        lembretesMudaram = true;
    }

    if (lembretesMudaram) {
        await localStorage.setItem("lembretes", JSON.stringify(lembretes));
    }

    if (movimentacaoEditando) {
        window.location.href = "historico.html";
    } else if (origem === "calendario") {
        window.location.href = `calendario.html?data=${document.getElementById("data").value}`;
    } else {
        window.location.href = "dashboard.html";
    }
});