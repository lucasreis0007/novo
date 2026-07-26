// ---------------- ELEMENTOS ----------------

const formMeta = document.getElementById("formMeta");
const emojiInput = document.getElementById("emoji");
const nomeInput = document.getElementById("nomeMeta");
const valorObjetivoInput = document.getElementById("valorObjetivo");
const listaMetas = document.getElementById("listaMetas");

// ---------------- DADOS ----------------

function carregarMetas() {
    return JSON.parse(localStorage.getItem("metas")) || [];
}

function salvarMetas(metas) {
    localStorage.setItem("metas", JSON.stringify(metas));
}

// Na primeira vez que a página é aberta, cria as duas metas
// que já apareciam (fixas) no dashboard, para não perder o que já existia.
function seedMetasIniciais() {
    const jaExiste = localStorage.getItem("metas");

    if (jaExiste === null) {
        const metasIniciais = [
            {
                id: Date.now(),
                emoji: "🚗",
                nome: "CNH",
                valorObjetivo: 3000,
                valorAtual: 0
            },
            {
                id: Date.now() + 1,
                emoji: "🛡️",
                nome: "Reserva",
                valorObjetivo: 5000,
                valorAtual: 0
            }
        ];

        salvarMetas(metasIniciais);
    }
}

// ---------------- FORMATAÇÃO ----------------

function moeda(valor) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

// ---------------- RENDERIZAÇÃO ----------------

function renderizarMetas() {

    const metas = carregarMetas();

    listaMetas.innerHTML = "";

    if (metas.length === 0) {
        listaMetas.innerHTML = `
            <div class="vazio">
                <h2>Nenhuma meta cadastrada.</h2>
                <p>Crie uma meta acima para começar.</p>
            </div>
        `;
        return;
    }

    metas.forEach(meta => {

        const percentual = meta.valorObjetivo > 0
            ? Math.min(100, (meta.valorAtual / meta.valorObjetivo) * 100)
            : 0;

        const completa = percentual >= 100;

        const card = document.createElement("div");
        card.className = "meta";

        card.innerHTML = `
            <div class="meta-topo">
                <div class="meta-titulo">
                    <span>${meta.emoji}</span>
                    <span>${meta.nome}</span>
                </div>
                <button class="meta-excluir" data-id="${meta.id}" title="Excluir meta">
                    🗑️
                </button>
            </div>

            <div class="meta-valores">
                <span><strong>${moeda(meta.valorAtual)}</strong> de ${moeda(meta.valorObjetivo)}</span>
                <span>${percentual.toFixed(0)}%</span>
            </div>

            <div class="barra">
                <div class="progresso ${completa ? "completa" : ""}" style="width:${percentual}%"></div>
            </div>

            ${completa
                ? `<p class="meta-parabens">🎉 Meta concluída!</p>`
                : `
                <div class="meta-aporte">
                    <input type="number" step="0.01" min="0.01" placeholder="Valor do aporte" data-id="${meta.id}" class="inputAporte">
                    <button type="button" data-id="${meta.id}" class="btnAporte">💰 Adicionar</button>
                </div>
                `
            }
        `;

        listaMetas.appendChild(card);
    });

    // Botões de excluir
    document.querySelectorAll(".meta-excluir").forEach(botao => {
        botao.addEventListener("click", () => {
            excluirMeta(Number(botao.dataset.id));
        });
    });

    // Botões de aporte
    document.querySelectorAll(".btnAporte").forEach(botao => {
        botao.addEventListener("click", () => {
            adicionarAporte(Number(botao.dataset.id));
        });
    });
}

// ---------------- AÇÕES ----------------

function excluirMeta(id) {

    if (!confirm("Deseja realmente excluir esta meta?")) return;

    const metas = carregarMetas().filter(meta => meta.id !== id);

    salvarMetas(metas);
    renderizarMetas();
}

function adicionarAporte(id) {

    const input = document.querySelector(`.inputAporte[data-id="${id}"]`);
    const valor = Number(input.value);

    if (!valor || valor <= 0) {
        alert("Digite um valor válido para o aporte.");
        return;
    }

    const metas = carregarMetas();

    const meta = metas.find(m => m.id === id);

    if (meta) {
        meta.valorAtual += valor;
    }

    salvarMetas(metas);
    renderizarMetas();
}

// ---------------- CRIAR NOVA META ----------------

formMeta.addEventListener("submit", (e) => {

    e.preventDefault();

    const novaMeta = {
        id: Date.now(),
        emoji: emojiInput.value,
        nome: nomeInput.value.trim(),
        valorObjetivo: Number(valorObjetivoInput.value),
        valorAtual: 0
    };

    if (!novaMeta.nome || !novaMeta.valorObjetivo) {
        alert("Preencha o nome e o valor objetivo da meta.");
        return;
    }

    const metas = carregarMetas();

    metas.push(novaMeta);

    salvarMetas(metas);

    formMeta.reset();

    renderizarMetas();
});

// ---------------- INICIALIZAÇÃO ----------------

seedMetasIniciais();
renderizarMetas();
