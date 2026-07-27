const CACHE_NOME = "financas-cache-v10";

const ARQUIVOS_PARA_CACHE = [
    "./index.html",
    "./css/style.css",
    "./js/script.js",
    "./js/utils.js",
    "./js/firebase-config.js",
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

    "./img/icons/icon-192.png",
    "./img/icons/icon-512.png"
];

// Instala o service worker e guarda os arquivos em cache
self.addEventListener("install", (evento) => {

    evento.waitUntil(
        caches.open(CACHE_NOME).then((cache) => {
            return cache.addAll(ARQUIVOS_PARA_CACHE);
        })
    );

    self.skipWaiting();
});

// Remove caches antigos quando uma nova versão é instalada
self.addEventListener("activate", (evento) => {

    evento.waitUntil(
        caches.keys().then((nomes) => {
            return Promise.all(
                nomes
                    .filter((nome) => nome !== CACHE_NOME)
                    .map((nome) => caches.delete(nome))
            );
        })
    );

    self.clients.claim();
});

// Serve pelo cache primeiro; se não tiver, busca na rede
self.addEventListener("fetch", (evento) => {

    evento.respondWith(
        caches.match(evento.request).then((respostaCache) => {
            return respostaCache || fetch(evento.request);
        })
    );
});
