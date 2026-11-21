const CACHE_NOME = "financas-cache-v45";

const ARQUIVOS_PARA_CACHE = [
    "./",
    "./index.html",
    "./css/style.css",
    "./js/script.js",
    "./js/utils.js",
    "./js/firebase-config.js",
    "./js/pwa.js",
    "./js/nav-lateral.js",
    "./css/nav-lateral.css",
    "./manifest.json",

    "./pages/dashboard.html",
    "./css/dashboard.css",
    "./js/dashboard.js",

    "./pages/adicionar.html",
    "./css/adicionar.css",
    "./js/adicionar.js",

    "./pages/historico.html",
    "./css/historico.css",
    "./js/historico.js",

    "./pages/metas.html",
    "./css/metas.css",
    "./js/metas.js",

    "./pages/emprestimos.html",
    "./css/emprestimos.css",
    "./js/emprestimos.js",
    "./js/emprestimos-core.js",

    "./pages/controles.html",
    "./css/controles.css",
    "./js/controles.js",

    "./pages/bancos.html",
    "./css/bancos.css",
    "./js/bancos.js",

    "./pages/categorias.html",
    "./css/categorias.css",
    "./js/categorias.js",

    "./pages/orcamentos.html",
    "./css/orcamentos.css",
    "./js/orcamentos.js",

    "./pages/relatorios.html",
    "./css/relatorios.css",
    "./js/relatorios.js",

    "./pages/calendario.html",
    "./css/calendario.css",
    "./js/calendario.js",

    "./pages/configuracoes.html",
    "./css/configuracoes.css",
    "./js/configuracoes.js",

    "./pages/notificacoes.html",
    "./css/notificacoes.css",
    "./js/notificacoes.js",
    "./js/notificacoes-core.js",
    "./js/notificacoes-push.js",
    "./js/notificacoes-config.js",

    "./pages/transferencia.html",
    "./css/transferencia.css",
    "./js/transferencia.js",

    "./img/logo.png",
    "./img/icons/icon-192.png",
    "./img/icons/icon-512.png"
];

// Instala o service worker e guarda os arquivos em cache.
// Cada arquivo é guardado separadamente: se um falhar, os outros
// continuam (com addAll, um único erro cancelava a instalação inteira
// e o app ficava preso numa versão antiga).
self.addEventListener("install", (evento) => {

    evento.waitUntil(
        caches.open(CACHE_NOME).then((cache) => {
            return Promise.all(
                ARQUIVOS_PARA_CACHE.map((arquivo) =>
                    cache.add(arquivo).catch(() => {})
                )
            );
        })
    );

    self.skipWaiting();
});

// Remove caches antigos quando uma nova versão é instalada
self.addEventListener("activate", (evento) => {

    evento.waitUntil(
        caches.keys().then(async (nomes) => {

            const caches_antigos = nomes.filter((nome) => nome !== CACHE_NOME);

            await Promise.all(caches_antigos.map((nome) => caches.delete(nome)));

            await self.clients.claim();

            // O app instalado na tela inicial (iPhone) tem cache próprio e
            // ficava preso numa versão velha. Se havia uma versão anterior,
            // recarrega as telas abertas pra já pegar a nova.
            if (caches_antigos.length > 0) {

                const telas = await self.clients.matchAll({ type: "window" });

                telas.forEach((tela) => {
                    try { tela.navigate(tela.url); } catch (erro) {}
                });
            }
        })
    );
});

// Rede primeiro, cache como reserva (offline).
// Antes era "cache primeiro": o app instalado ficava preso em arquivos
// antigos mesmo depois de atualizar o site. Agora sempre tenta pegar a
// versão mais nova e só usa o cache se estiver sem internet.
// Pedidos para outros sites (Firebase, Google) não passam pelo service
// worker: o navegador cuida deles normalmente.
self.addEventListener("fetch", (evento) => {

    const pedido = evento.request;

    if (pedido.method !== "GET") return;

    const url = new URL(pedido.url);

    if (url.origin !== self.location.origin) return;

    evento.respondWith(
        fetch(pedido, { cache: "no-cache" })
            .then((resposta) => {

                if (resposta && resposta.ok) {
                    const copia = resposta.clone();
                    caches.open(CACHE_NOME).then((cache) => cache.put(pedido, copia));
                }

                return resposta;
            })
            .catch(() =>
                caches.match(pedido).then((respostaCache) =>
                    respostaCache || caches.match("./index.html")
                )
            )
    );
});

// ---------------- NOTIFICAÇÕES (lembretes) ----------------
// Há dois caminhos:
//  1. Notificação local: o dashboard.js chama registration.showNotification
//     quando o app está aberto (sem servidor).
//  2. Push agendado: o Worker (pasta worker/) envia um Web Push no horário
//     escolhido e este service worker o exibe — funciona com o app fechado.
// O clique é tratado igual nos dois: abre (ou foca) a tela indicada.

// Push recebido do servidor. SEMPRE exibe a notificação na hora: o Safari
// do iPhone revoga a permissão se um push chegar e nada for mostrado.
self.addEventListener("push", (evento) => {

    let dados = {};

    try {
        dados = evento.data ? evento.data.json() : {};
    } catch (erro) {
        dados = { body: evento.data ? evento.data.text() : "" };
    }

    evento.waitUntil(
        self.registration.showNotification(dados.title || "🔔 Finanças", {
            body: dados.body || "",
            icon: "./img/icons/icon-192.png",
            badge: "./img/icons/icon-192.png",
            tag: dados.tag || undefined,
            data: { url: dados.url || "pages/dashboard.html" }
        })
    );
});

// O sistema às vezes troca a inscrição de push (principalmente no iPhone).
// Tenta renovar aqui; se não der, o app regrava a inscrição na próxima
// vez que for aberto (js/notificacoes-push.js).
self.addEventListener("pushsubscriptionchange", (evento) => {

    const opcoes = evento.oldSubscription && evento.oldSubscription.options;
    if (!opcoes) return;

    evento.waitUntil(
        self.registration.pushManager.subscribe(opcoes).catch(() => {})
    );
});

self.addEventListener("notificationclick", (evento) => {

    evento.notification.close();

    const destino = new URL(
        (evento.notification.data && evento.notification.data.url) || "pages/dashboard.html",
        self.registration.scope
    ).href;

    const nomeArquivo = destino.split("/").pop().split("?")[0];

    evento.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((listaClients) => {

            for (const cliente of listaClients) {
                if (cliente.url.includes(nomeArquivo) && "focus" in cliente) {
                    return cliente.focus();
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(destino);
            }
        })
    );
});
