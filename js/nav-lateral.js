// Menu lateral compartilhado por todas as páginas internas do app.
// Em vez de duplicar o HTML do menu em cada página, esse script injeta
// tudo sozinho: o botão de hambúrguer no cabeçalho e o painel lateral
// com a lista de seções, um embaixo do outro (em vez de espalhar os
// atalhos entre uma fileira no topo e a barra inferior).

(function () {

    const PAGINAS = [
        { arquivo: "dashboard.html", icone: "🏠", nome: "Início" },
        { arquivo: "adicionar.html", icone: "➕", nome: "Adicionar" },
        { arquivo: "historico.html", icone: "📜", nome: "Histórico" },
        { arquivo: "metas.html", icone: "🎯", nome: "Metas" },
        { arquivo: "bancos.html", icone: "🏦", nome: "Bancos" },
        { arquivo: "categorias.html", icone: "🏷️", nome: "Categorias" },
        { arquivo: "orcamentos.html", icone: "📊", nome: "Orçamentos" },
        { arquivo: "relatorios.html", icone: "📈", nome: "Relatórios" },
        { arquivo: "configuracoes.html", icone: "⚙️", nome: "Configurações" }
    ];

    function iniciar() {

        const cabecalho = document.querySelector("header");
        if (!cabecalho) return;

        const paginaAtual = window.location.pathname.split("/").pop();

        // ---------------- BOTÃO HAMBÚRGUER ----------------

        const botaoMenu = document.createElement("button");
        botaoMenu.type = "button";
        botaoMenu.className = "botao-menu";
        botaoMenu.setAttribute("aria-label", "Abrir menu");
        botaoMenu.innerHTML =
            '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';

        cabecalho.appendChild(botaoMenu);

        // ---------------- PAINEL LATERAL ----------------

        const overlay = document.createElement("div");
        overlay.className = "overlay-menu";

        const drawer = document.createElement("aside");
        drawer.className = "drawer-menu";

        const itensHtml = PAGINAS.map(pg => {
            const ativo = pg.arquivo === paginaAtual ? " ativo" : "";
            return (
                '<a href="' + pg.arquivo + '" class="item-drawer' + ativo + '">' +
                    '<span>' + pg.icone + '</span>' +
                    '<span>' + pg.nome + '</span>' +
                '</a>'
            );
        }).join("");

        drawer.innerHTML =
            '<div class="drawer-topo">' +
                '<h2>💰 Finanças</h2>' +
                '<button type="button" class="fechar-drawer" aria-label="Fechar menu">✕</button>' +
            '</div>' +
            '<nav class="drawer-lista">' + itensHtml + '</nav>' +
            '<button type="button" class="item-drawer item-sair" id="botaoSairDrawer">' +
                '<span>⏻</span><span>Sair</span>' +
            '</button>';

        document.body.appendChild(overlay);
        document.body.appendChild(drawer);

        function abrirMenu() {
            drawer.classList.add("aberto");
            overlay.classList.add("aberto");
        }

        function fecharMenu() {
            drawer.classList.remove("aberto");
            overlay.classList.remove("aberto");
        }

        botaoMenu.addEventListener("click", abrirMenu);
        overlay.addEventListener("click", fecharMenu);
        drawer.querySelector(".fechar-drawer").addEventListener("click", fecharMenu);

        drawer.querySelector("#botaoSairDrawer").addEventListener("click", () => {
            fecharMenu();
            if (typeof window.sair === "function") {
                window.sair();
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }

})();
