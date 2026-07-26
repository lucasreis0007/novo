// ---------------- HASH DE SENHA ----------------
// A senha nunca é guardada em texto puro: vira um hash (SHA-256)
// antes de ser salva no localStorage.

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

// ---------------- ELEMENTOS ----------------

const formLogin = document.getElementById("formLogin");
const formCadastro = document.getElementById("formCadastro");
const erroLogin = document.getElementById("erroLogin");
const erroCadastro = document.getElementById("erroCadastro");
const linkResetar = document.getElementById("linkResetar");

// ---------------- DECIDE QUAL TELA MOSTRAR ----------------

if (usuarioCadastrado()) {
    formLogin.classList.remove("oculto");
} else {
    formCadastro.classList.remove("oculto");
}

// ---------------- CADASTRO ----------------

formCadastro.addEventListener("submit", async (evento) => {

    evento.preventDefault();
    erroCadastro.textContent = "";

    const usuario = document.getElementById("cadUsuario").value.trim();
    const senha = document.getElementById("cadSenha").value;
    const confirmar = document.getElementById("cadConfirmar").value;

    if (senha !== confirmar) {
        erroCadastro.textContent = "As senhas não coincidem.";
        return;
    }

    const senhaHash = await gerarHash(senha);

    localStorage.setItem("financas_usuario", JSON.stringify({
        usuario,
        senhaHash
    }));

    sessionStorage.setItem("financas_logado", "true");
    window.location.href = "pages/dashboard.html";

});

// ---------------- LOGIN ----------------

formLogin.addEventListener("submit", async (evento) => {

    evento.preventDefault();
    erroLogin.textContent = "";

    const usuario = document.getElementById("loginUsuario").value.trim();
    const senha = document.getElementById("loginSenha").value;

    const salvo = usuarioCadastrado();
    const senhaHash = await gerarHash(senha);

    if (!salvo || salvo.usuario !== usuario || salvo.senhaHash !== senhaHash) {
        erroLogin.textContent = "Usuário ou senha incorretos.";
        return;
    }

    sessionStorage.setItem("financas_logado", "true");
    window.location.href = "pages/dashboard.html";

});

// ---------------- ESQUECI A SENHA / TROCAR DE CONTA ----------------

linkResetar.addEventListener("click", (evento) => {

    evento.preventDefault();

    const confirmou = confirm(
        "Isso vai apagar o usuário e senha salvos neste navegador " +
        "(seus dados financeiros continuam guardados). Deseja continuar?"
    );

    if (confirmou) {
        localStorage.removeItem("financas_usuario");
        window.location.reload();
    }

});
