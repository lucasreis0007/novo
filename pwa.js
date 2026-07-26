// Registra o service worker pra funcionar como PWA (instalável + offline).
// Funciona tanto na index.html (raiz) quanto nas páginas dentro de /pages/.

(function registrarServiceWorker() {

    if (!("serviceWorker" in navigator)) return;

    const estaEmPages = window.location.pathname.includes("/pages/");

    const caminhoSW = estaEmPages ? "../service-worker.js" : "service-worker.js";
    const escopo = estaEmPages ? "../" : "./";

    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register(caminhoSW, { scope: escopo })
            .catch((erro) => {
                console.log("Erro ao registrar service worker:", erro);
            });

    });

})();
