import {
    auth,
    db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    doc,
    setDoc
} from "./firebase-config.js";

const formLogin = document.getElementById("formLogin");
const formCadastro = document.getElementById("formCadastro");
const erroLogin = document.getElementById("erroLogin");
const erroCadastro = document.getElementById("erroCadastro");
const linkTrocarTela = document.getElementById("linkTrocarTela");

let telaAtual = "login";

function mostrarTela(tela) {
    telaAtual = tela;
    formLogin.classList.toggle("oculto", tela !== "login");
    formCadastro.classList.toggle("oculto", tela !== "cadastro");
    erroLogin.textContent = "";
    erroCadastro.textContent = "";
}

mostrarTela("login");

// ---------------- CADASTRO ----------------

formCadastro.addEventListener("submit", async (evento) => {

    evento.preventDefault();
    erroCadastro.textContent = "";

    const email = document.getElementById("cadEmail").value.trim();
    const senha = document.getElementById("cadSenha").value;
    const confirmar = document.getElementById("cadConfirmar").value;

    if (senha !== confirmar) {
        erroCadastro.textContent = "As senhas não coincidem.";
        return;
    }

    try {

        const credencial = await createUserWithEmailAndPassword(auth, email, senha);

        // cria o documento de dados do usuário, já com as listas vazias.
        // "categorias" começa como objeto vazio (não array!) — cada página
        // sabe preencher com as categorias padrão na primeira vez que abre.
        await setDoc(doc(db, "usuarios", credencial.user.uid), {
            movimentacoes: [],
            bancos: [],
            metas: [],
            categorias: {},
            orcamentos: []
        });

        window.location.href = "pages/dashboard.html";

    } catch (erro) {
        erroCadastro.textContent = traduzirErro(erro);
    }

});

// ---------------- LOGIN ----------------

formLogin.addEventListener("submit", async (evento) => {

    evento.preventDefault();
    erroLogin.textContent = "";

    const email = document.getElementById("loginEmail").value.trim();
    const senha = document.getElementById("loginSenha").value;

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        window.location.href = "pages/dashboard.html";
    } catch (erro) {
        erroLogin.textContent = traduzirErro(erro);
    }

});

// ---------------- MOSTRAR/OCULTAR SENHA ----------------

document.querySelectorAll(".toggle-senha").forEach(botao => {

    botao.addEventListener("click", () => {

        const campo = document.getElementById(botao.dataset.alvo);
        const oculta = campo.type === "password";

        campo.type = oculta ? "text" : "password";
        botao.textContent = oculta ? "🙈" : "👁️";
        botao.setAttribute("aria-label", oculta ? "Ocultar senha" : "Mostrar senha");
    });

});

// ---------------- ALTERNAR ENTRE TELAS ----------------

linkTrocarTela.addEventListener("click", (evento) => {
    evento.preventDefault();
    mostrarTela(telaAtual === "login" ? "cadastro" : "login");
});

// ---------------- MENSAGENS DE ERRO EM PT-BR ----------------

function traduzirErro(erro) {

    const mapa = {
        "auth/email-already-in-use": "Esse e-mail já está cadastrado.",
        "auth/invalid-email": "E-mail inválido.",
        "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
        "auth/user-not-found": "Usuário ou senha incorretos.",
        "auth/wrong-password": "Usuário ou senha incorretos.",
        "auth/invalid-credential": "Usuário ou senha incorretos.",
        "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente de novo."
    };

    return mapa[erro.code] || "Não foi possível concluir. Tente novamente.";
}
