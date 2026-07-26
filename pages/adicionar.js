const formulario = document.getElementById("formMovimentacao");

const btnEntrada = document.getElementById("btnEntrada");
const btnSaida = document.getElementById("btnSaida");

const tipo = document.getElementById("tipo");
const categoria = document.getElementById("categoria");
const banco = document.getElementById("banco");

const saldoBanco = document.getElementById("saldoBanco");

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

    if (categorias === null) {

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

tipo.value = "Entrada";

btnEntrada.addEventListener("click", () => {
    tipo.value = "Entrada";

    btnEntrada.classList.add("ativo");
    btnSaida.classList.remove("ativo");

    atualizarCategorias();
});

btnSaida.addEventListener("click", () => {
    tipo.value = "Saída";

    btnSaida.classList.add("ativo");
    btnEntrada.classList.remove("ativo");

    atualizarCategorias();
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
                ${item}
            </option>
        `;
    });
}

// ---------------- SALDO DO BANCO ----------------

function atualizarSaldoBanco() {

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

// ---------------- MODO EDIÇÃO ----------------

const params = new URLSearchParams(window.location.search);
const idEdicao = params.get("id");
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
        } else {
            btnSaida.click();
        }

        popularBancos();
        banco.value = movimentacaoEditando.banco;
        atualizarSaldoBanco();

        atualizarCategorias();
        categoria.value = movimentacaoEditando.categoria;

        document.getElementById("valor").value = movimentacaoEditando.valor;
        document.getElementById("data").value = movimentacaoEditando.data;
        document.getElementById("descricao").value = movimentacaoEditando.descricao || "";
    }
}

btnExcluirMov.addEventListener("click", () => {

    if (!movimentacaoEditando) return;

    const confirmar = confirm("Tem certeza que deseja excluir essa movimentação?");
    if (!confirmar) return;

    let movimentacoes =
        JSON.parse(localStorage.getItem("movimentacoes")) || [];

    movimentacoes = movimentacoes.filter(
        mov => String(mov.id) !== String(idEdicao)
    );

    localStorage.setItem("movimentacoes", JSON.stringify(movimentacoes));

    window.location.href = "historico.html";
});

// ---------------- SALVAR ----------------

formulario.addEventListener("submit", function (e) {

    e.preventDefault();

    if (categoria.value === "") {
        alert("Selecione uma categoria.");
        return;
    }

    const valor = Number(document.getElementById("valor").value);

    let natureza = "Despesa";

    if (tipo.value === "Entrada") {
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
            if (mov.natureza === "Resgate") totalReservas -= Number(mov.valor);
        });

        if (valor > totalReservas) {
            alert(
                `Saldo insuficiente na reserva. Você tem ${totalReservas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} guardado.`
            );
            return;
        }
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
                banco: banco.value,
                categoria: categoria.value,
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
            banco: banco.value,
            categoria: categoria.value,
            valor,
            data: document.getElementById("data").value,
            descricao: document.getElementById("descricao").value
        };

        movimentacoes.push(movimentacao);
    }

    localStorage.setItem(
        "movimentacoes",
        JSON.stringify(movimentacoes)
    );

    window.location.href = movimentacaoEditando ? "historico.html" : "dashboard.html";
});