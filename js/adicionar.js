import { protegerPagina, carregarDados, criarArmazenamento, sair, iconeCategoriaTexto } from "./utils.js";

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

const btnExcluirMov = document.getElementById("btnExcluirMov");
const btnSalvar = document.getElementById("btnSalvar");

if (idEdicao !== null) {

    const movimentacoesExistentes =
        JSON.parse(localStorage.getItem("movimentacoes")) || [];

    movimentacaoEditando = movimentacoesExistentes.find(
        mov => String(mov.id) === String(idEdicao)
    );

    // Aportes de meta são feitos na tela de Metas; aqui só dá pra excluir.
    if (movimentacaoEditando && movimentacaoEditando.natureza === "Meta") {
        alert("Aportes de meta são feitos na tela de Metas. Para desfazer, exclua o lançamento no Histórico.");
        movimentacaoEditando = null;
        window.location.href = destinoAoVoltar();
    }

    if (movimentacaoEditando) {

        document.getElementById("tituloAba").textContent = "Editar Movimentação";
        document.getElementById("tituloTela").textContent = "Editar movimentação";
        document.getElementById("subtituloTela").textContent = "Altere os dados e salve";
        btnSalvar.textContent = "💾 Salvar alterações";
        btnExcluirMov.style.display = "block";

        if (movimentacaoEditando.natureza === "Resgate") {
            btnEntrada.click();
        } else if (movimentacaoEditando.tipo === "Entrada") {
            btnEntrada.click();
        } else if (movimentacaoEditando.tipo === "Rendimento") {
            btnRendimento.click();
        } else {
            btnSaida.click();
        }

        popularBancos();
        banco.value = movimentacaoEditando.banco;
        atualizarSaldoBanco();

        if (movimentacaoEditando.tipo !== "Rendimento") {
            atualizarCategorias();
            categoria.value = movimentacaoEditando.metaId
                ? PREFIXO_META + movimentacaoEditando.metaId
                : movimentacaoEditando.categoria;
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
                Number(metaOrigem.valorAtual) + (movimentacaoEditando.natureza === "Meta" ? -1 : 1) * Number(movimentacaoEditando.valor)
            );
            await salvarMetas(metasAtuais);
        }
    }

    let movimentacoes =
        JSON.parse(localStorage.getItem("movimentacoes")) || [];

    movimentacoes = movimentacoes.filter(
        mov => String(mov.id) !== String(idEdicao)
    );

    // espera o Firestore confirmar antes de trocar de página, senão a
    // navegação cancela o salvamento antes dele terminar
    await localStorage.setItem("movimentacoes", JSON.stringify(movimentacoes));

    window.location.href = "historico.html";
});

// ---------------- SALVAR ----------------

formulario.addEventListener("submit", async function (e) {

    e.preventDefault();

    const ehRendimento = tipo.value === "Rendimento";

    if (!ehRendimento && categoria.value === "") {
        alert("Selecione uma categoria.");
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

    const categoriaSalva = metaSelecionada
        ? `Retirada da meta: ${metaSelecionada.nome}`
        : ehRendimento ? "Rendimento da Reserva" : categoria.value;
    const bancoSalvo = ehRendimento ? "" : banco.value;

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
                metaId: metaSelecionada ? metaSelecionada.id : undefined,
                valor,
                data: document.getElementById("data").value,
                descricao: document.getElementById("descricao").value
            };
        }

    } else {

        const movimentacao = {
            id: Date.now(),
            tipo: tipo.value,
            natureza,
            banco: bancoSalvo,
            categoria: categoriaSalva,
            metaId: metaSelecionada ? metaSelecionada.id : undefined,
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

    if (metaSelecionada || (movimentacaoEditando && movimentacaoEditando.metaId)) {
        await salvarMetas(metas);
    }

    await localStorage.setItem(
        "movimentacoes",
        JSON.stringify(movimentacoes)
    );

    if (movimentacaoEditando) {
        window.location.href = "historico.html";
    } else if (origem === "calendario") {
        window.location.href = `calendario.html?data=${document.getElementById("data").value}`;
    } else {
        window.location.href = "dashboard.html";
    }
});