import { protegerPagina, carregarDados, criarArmazenamento, sair, iconeCategoria } from "./utils.js";

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

function atualizarCategorias() {

    const categorias = carregarCategorias();

    const lista =
        tipo.value === "Entrada"
            ? categorias.entrada
            : categorias.saida.map(item => item.nome);

    categoria.innerHTML = '<option value="">Selecione</option>';

    lista.forEach(item => {
        categoria.innerHTML += `
            <option value="${item}">
                ${iconeCategoria(item)} ${item}
            </option>
        `;
    });
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

        if (mov.natureza === "Resgate") return;

        if (mov.tipo === "Entrada") {
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

    if (movimentacaoEditando) {

        document.getElementById("tituloAba").textContent = "Editar Movimentação";
        document.getElementById("tituloTela").textContent = "Editar movimentação";
        document.getElementById("subtituloTela").textContent = "Altere os dados e salve";
        btnSalvar.textContent = "💾 Salvar alterações";
        btnExcluirMov.style.display = "block";

        if (movimentacaoEditando.tipo === "Entrada") {
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
            categoria.value = movimentacaoEditando.categoria;
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

    let natureza = "Despesa";

    if (ehRendimento) {
        natureza = "Rendimento";
    } else if (tipo.value === "Entrada") {
        natureza = "Entrada";
    } else {

        const categorias = carregarCategorias();
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

    const categoriaSalva = ehRendimento ? "Rendimento da Reserva" : categoria.value;
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
            valor,
            data: document.getElementById("data").value,
            descricao: document.getElementById("descricao").value
        };

        movimentacoes.push(movimentacao);
    }

    // espera o Firestore confirmar o salvamento antes de trocar de
    // página — antes disso, a navegação cancelava o envio no meio do
    // caminho e o lançamento nunca chegava a ser gravado
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
