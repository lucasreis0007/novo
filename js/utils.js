// ---------------- AUTENTICAÇÃO ----------------
// Sistema simples de usuário/senha para uso local (sem servidor).
// A senha nunca é guardada em texto puro: é transformada em hash
// (SHA-256) antes de ir para o localStorage.

async function gerarHash(texto) {
    const dados = new TextEncoder().encode(texto);
    const buffer = await crypto.subtle.digest("SHA-256", dados);
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

function usuarioCadastrado() {
    return JSON.parse(localStorage.getItem("financas_usuario"));
}

function estaLogado() {
    return sessionStorage.getItem("financas_logado") === "true";
}

function sair() {
    sessionStorage.removeItem("financas_logado");
    window.location.href = "../index.html";
}

// Executa assim que o <script> é lido (colocado no topo do <head>,
// antes de qualquer conteúdo da página ser exibido) para impedir que
// alguém sem login veja a página, mesmo que por um instante.
(function protegerPagina() {
    if (!estaLogado()) {
        window.location.href = "../index.html";
    }
})();
