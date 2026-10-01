import { protegerPagina, carregarDados, criarArmazenamento, sair, iconeCategoria, iconeCategoriaTexto, iconeMovimentacao } from "./utils.js";

const usuarioLogado = await protegerPagina();
const dadosUsuario = await carregarDados(usuarioLogado.uid);
const localStorage = criarArmazenamento(dadosUsuario, usuarioLogado.uid);
window.sair = sair;

// Carregado uma vez só pra resolver os ícones personalizados das categorias.
const categoriasSalvas = JSON.parse(localStorage.getItem("categorias")) || {};

// Metas (pra mostrar o ícone escolhido nos lançamentos de meta).
const metasParaIcone = JSON.parse(localStorage.getItem("metas")) || [];

const lista = document.getElementById("listaMovimentacoes");

// Acha a meta ligada a um lançamento: pelo id e, se não achar, pelo nome
// escrito na categoria (ex.: "Retirada da meta: CNH").
function acharMetaDoLancamento(mov, metas) {

    let meta = mov.metaId != null
        ? metas.find(m => String(m.id) === String(mov.metaId))
        : null;

    if (!meta) {
        const partes = /^(?:Retirada da meta|Meta|Rendimento da meta): (.+)$/.exec(mov.categoria || "");

        if (partes) {
            meta = metas.find(m => m.nome === partes[1]);
        }
    }

    return meta || null;
}

// Retirada devolve o valor à meta; aporte e rendimento tiram o valor da
// meta. Devolve um resumo pra avisar a pessoa (ou null se o lançamento
// não tem meta ligada).
async function devolverValorParaMeta(mov) {

    if (!mov || !["Transferência", "Meta", "RendimentoMeta"].includes(mov.natureza)) return null;

    const metas = JSON.parse(localStorage.getItem("metas")) || [];
    const meta = acharMetaDoLancamento(mov, metas);

    if (!meta) return null;

    const sentido = ["Meta", "RendimentoMeta"].includes(mov.natureza) ? -1 : 1;

    meta.valorAtual = Math.round((Number(meta.valorAtual) + sentido * Number(mov.valor)) * 100) / 100;

    await localStorage.setItem("metas", JSON.stringify(metas));

    return { nome: meta.nome, valor: Number(mov.valor), sentido, valorAtual: meta.valorAtual };
}

function avisoMetaAtualizada(resultado, mov) {

    if (!resultado) {

        const pareceMeta = mov && (
            mov.metaId != null ||
            /^(Retirada da meta|Meta|Rendimento da meta): /.test(mov.categoria || "")
        );

        if (pareceMeta) {
            alert("Esse lançamento era de uma meta, mas não encontrei a meta para devolver o valor. Acerte o valor em Metas (✏️).");
        }

        return;
    }

    const texto = resultado.sentido === 1
        ? `${formatarMoeda(resultado.valor)} devolvido(s) à meta "${resultado.nome}".`
        : `${formatarMoeda(resultado.valor)} retirado(s) da meta "${resultado.nome}".`;

    alert(`${texto}\nAgora ela tem ${formatarMoeda(resultado.valorAtual)}.`);
}

const pesquisa = document.getElementById("pesquisa");

const filtroBanco = document.getElementById("filtroBanco");

const filtroTipo = document.getElementById("filtroTipo");

const filtroCategoria = document.getElementById("filtroCategoria");

// ---------------- BANCOS (para o filtro) ----------------

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

function popularFiltroBanco() {

    const bancos = carregarBancos();

    bancos.forEach(item => {
        filtroBanco.innerHTML += `<option>${item.nome}</option>`;
    });
}

popularFiltroBanco();

let movimentacoes =
    JSON.parse(localStorage.getItem("movimentacoes")) || [];

// ---------------- CATEGORIAS (para o filtro) ----------------

function popularFiltroCategoria() {

    const categoriasUsadas = movimentacoes
        .map(mov => mov.categoria)
        .filter(categoria => !!categoria);

    const categoriasUnicas = [...new Set(categoriasUsadas)]
        .sort((a, b) => a.localeCompare(b, "pt-BR"));

    categoriasUnicas.forEach(categoria => {
        filtroCategoria.innerHTML += `<option value="${categoria}">${iconeCategoriaTexto(categoria, categoriasSalvas)} ${categoria}</option>`;
    });
}

popularFiltroCategoria();

function formatarMoeda(valor){

    return valor.toLocaleString("pt-BR",{

        style:"currency",

        currency:"BRL"

    });

}

function carregarMovimentacoes(){

    lista.innerHTML = "";

    const textoPesquisa = pesquisa.value.toLowerCase();

    const bancoSelecionado = filtroBanco.value;

    const tipoSelecionado = filtroTipo.value;

    const categoriaSelecionada = filtroCategoria.value;

    const resultado = movimentacoes.filter(mov =>{

        const descricao =
            (mov.descricao || "").toLowerCase();

        const categoria =
            (mov.categoria || "").toLowerCase();

        const pesquisaOk =

            descricao.includes(textoPesquisa) ||

            categoria.includes(textoPesquisa);

        const bancoOk =

            bancoSelecionado === "" ||

            mov.banco === bancoSelecionado;

        const tipoOk =

            tipoSelecionado === "" ||

            mov.tipo === tipoSelecionado;

        const categoriaOk =

            categoriaSelecionada === "" ||

            mov.categoria === categoriaSelecionada;

        return pesquisaOk && bancoOk && tipoOk && categoriaOk;

    });

    if(resultado.length === 0){

        lista.innerHTML =

        `<div class="vazio">

            <h2>Nenhuma movimentação encontrada.</h2>

            <p>Cadastre uma movimentação para começar.</p>

        </div>`;

        return;

    }

    resultado.sort((a,b)=>b.id-a.id);

    resultado.forEach(mov=>{

        let classe = "";

        let sinal = "";

        let textoNatureza = "";

        if(mov.natureza==="Transferência"){

            classe = mov.tipo==="Entrada" ? "entrada" : "despesa";

            sinal = mov.metaId ? "🎯" : (mov.tipo==="Entrada" ? "⬇️" : "⬆️");

            textoNatureza = mov.metaId
                ? "Retirada da meta"
                : (mov.tipo==="Entrada" ? "Transferência recebida" : "Transferência enviada");

        }

        else if(mov.natureza==="RendimentoMeta"){

            classe="reserva";

            sinal="🌱";

            textoNatureza="Rendimento da meta";

        }

        else if(mov.natureza==="Meta"){

            classe="reserva";

            sinal="🎯";

            textoNatureza="Aporte na meta";

        }

        else if(mov.natureza==="Resgate"){

            classe="entrada";

            sinal="🏧";

            textoNatureza="Retirada da Reserva";

        }

        else if(mov.tipo==="Entrada"){

            classe="entrada";

            sinal="+";

            textoNatureza="Entrada";

        }

        else if(mov.natureza==="Despesa"){

            classe="despesa";

            sinal="-";

            textoNatureza="Despesa";

        }

        else if(mov.natureza==="Reserva"){

            classe="reserva";

            sinal="🏦";

            textoNatureza="Reserva";

        }

        else if(mov.natureza==="Rendimento"){

            classe="reserva";

            sinal="🌱";

            textoNatureza="Rendimento da Reserva";

        }

        else{

            classe="investimento";

            sinal="📈";

            textoNatureza="Investimento";

        }

        const card = document.createElement("div");

        card.className="movimentacao";

        card.innerHTML=`

            <div class="info">

                <h3>${iconeMovimentacao(mov, categoriasSalvas, metasParaIcone)} ${mov.categoria}</h3>

                <p>${mov.descricao || "Sem descrição"}</p>

                <p>${mov.banco || "Direto na reserva"}</p>

                <p>${mov.data}</p>

                <p>${textoNatureza}</p>

            </div>

            <div class="valor ${classe}">

                ${sinal} ${formatarMoeda(mov.valor)}

            </div>

            <div class="acoesMov">

                <button class="btnEditar" data-id="${mov.id}" title="Editar">✏️</button>

                <button class="btnExcluir" data-id="${mov.id}" title="Excluir">🗑️</button>

            </div>

        `;

        lista.appendChild(card);

    });

    lista.querySelectorAll(".btnEditar").forEach(btn=>{

        btn.addEventListener("click", ()=>{

            window.location.href = `adicionar.html?id=${btn.dataset.id}`;

        });

    });

    lista.querySelectorAll(".btnExcluir").forEach(btn=>{

        btn.addEventListener("click", async ()=>{

            const confirmar = confirm("Tem certeza que deseja excluir essa movimentação?");

            if(!confirmar) return;

            const id = Number(btn.dataset.id);

            // Excluir uma retirada de meta devolve o valor para a meta.
            const movExcluida = movimentacoes.find(mov => mov.id === id);

            const resultadoMeta = await devolverValorParaMeta(movExcluida);

            movimentacoes = movimentacoes.filter(mov => mov.id !== id);

            await localStorage.setItem("movimentacoes", JSON.stringify(movimentacoes));

            // apaga o lembrete de empréstimo ligado a esse lançamento
            const lembretesAtuais = JSON.parse(localStorage.getItem("lembretes")) || [];
            const lembretesRestantes = lembretesAtuais.filter(l => String(l.movimentacaoId) !== String(id));

            if (lembretesRestantes.length !== lembretesAtuais.length) {
                await localStorage.setItem("lembretes", JSON.stringify(lembretesRestantes));
            }

            carregarMovimentacoes();

            avisoMetaAtualizada(resultadoMeta, movExcluida);

        });

    });

}

pesquisa.addEventListener("input",carregarMovimentacoes);

filtroBanco.addEventListener("change",carregarMovimentacoes);

filtroTipo.addEventListener("change",carregarMovimentacoes);

filtroCategoria.addEventListener("change",carregarMovimentacoes);

document
.getElementById("voltarDashboard")
.addEventListener("click",()=>{

    window.location.href="dashboard.html";

});

carregarMovimentacoes();

// Selo de versão: serve só pra conferir que este arquivo está atualizado.
document.body.insertAdjacentHTML(
    "beforeend",
    '<p style="text-align:center;font-size:11px;color:#aaa;margin:20px 0 90px;">histórico v31</p>'
);
