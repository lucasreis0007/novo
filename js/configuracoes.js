import {
    protegerPagina,
    carregarDados,
    criarArmazenamento,
    sair
} from "./utils.js";

import {
    auth,
    db,
    doc,
    setDoc,
    deleteDoc,
    signOut,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword,
    deleteUser
} from "./firebase-config.js";

window.sair = sair;

const usuario = await protegerPagina();
const dados = await carregarDados(usuario.uid);
const armazenamento = criarArmazenamento(dados, usuario.uid);

document.getElementById("emailConta").textContent = usuario.email;

// ---------------- FORMATAÇÃO ----------------

function moeda(valor) {
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function baixarArquivo(nomeArquivo, conteudo, tipo) {

    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    link.rel = "noopener";
    // Alguns navegadores (principalmente no iPhone) ignoram o atributo
    // "download" e abrem o link normalmente — com target="_blank" isso
    // vira uma aba nova com o conteúdo, que ainda dá pra salvar, em vez
    // de simplesmente não acontecer nada.
    link.target = "_blank";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ---------------- EXPORTAR PDF ----------------

document.getElementById("btnExportarPdf").addEventListener("click", () => {

    try {

        if (!window.jspdf) {
            alert("Não foi possível carregar o gerador de PDF. Verifique sua conexão com a internet e tente novamente.");
            return;
        }

        const movimentacoes = JSON.parse(armazenamento.getItem("movimentacoes")) || [];

        if (movimentacoes.length === 0) {
            alert("Você ainda não tem movimentações para exportar.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const documento = new jsPDF();

    const ordenadas = [...movimentacoes].sort((a, b) => new Date(a.data) - new Date(b.data));

    let totalEntradas = 0;
    let totalSaidas = 0;

    ordenadas.forEach(mov => {
        if (mov.tipo === "Entrada") totalEntradas += Number(mov.valor);
        else totalSaidas += Number(mov.valor);
    });

    documento.setFontSize(16);
    documento.text("Relatório de Movimentações", 14, 18);

    documento.setFontSize(10);
    documento.setTextColor(120);
    documento.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, 25);

    documento.setFontSize(11);
    documento.setTextColor(20);
    documento.text(`Total de entradas: ${moeda(totalEntradas)}`, 14, 34);
    documento.text(`Total de saídas: ${moeda(totalSaidas)}`, 14, 40);
    documento.text(`Saldo do período: ${moeda(totalEntradas - totalSaidas)}`, 14, 46);

    let y = 58;

    documento.setFontSize(9);
    documento.setTextColor(90);
    documento.text("Data", 14, y);
    documento.text("Categoria", 42, y);
    documento.text("Banco", 92, y);
    documento.text("Descrição", 130, y);
    documento.text("Valor", 190, y, { align: "right" });

    y += 4;
    documento.setDrawColor(210);
    documento.line(14, y, 196, y);
    y += 6;

    documento.setTextColor(30);

    ordenadas.forEach(mov => {

        if (y > 280) {
            documento.addPage();
            y = 20;
        }

        const sinal = mov.tipo === "Entrada" ? "+" : "-";

        documento.text(mov.data || "", 14, y);
        documento.text(String(mov.categoria || "").slice(0, 22), 42, y);
        documento.text(String(mov.banco || "").slice(0, 16), 92, y);
        documento.text(String(mov.descricao || "-").slice(0, 22), 130, y);
        documento.text(`${sinal} ${moeda(mov.valor)}`, 190, y, { align: "right" });

        y += 7;
    });

        documento.save("relatorio-financas.pdf");

    } catch (erro) {
        console.error("Erro ao exportar PDF:", erro);
        alert("Não foi possível gerar o PDF. Tente novamente.");
    }
});

// ---------------- EXPORTAR BACKUP (JSON) ----------------

document.getElementById("btnExportarBackup").addEventListener("click", () => {

    try {

        const backup = {
            exportadoEm: new Date().toISOString(),
            movimentacoes: JSON.parse(armazenamento.getItem("movimentacoes")) || [],
            bancos: JSON.parse(armazenamento.getItem("bancos")) || [],
            metas: JSON.parse(armazenamento.getItem("metas")) || [],
            orcamentos: JSON.parse(armazenamento.getItem("orcamentos")) || [],
            categorias: JSON.parse(armazenamento.getItem("categorias")) || {}
        };

        baixarArquivo(
            "backup-financas.json",
            JSON.stringify(backup, null, 2),
            "application/json"
        );

    } catch (erro) {
        console.error("Erro ao exportar backup:", erro);
        alert("Não foi possível gerar o backup. Tente novamente.");
    }
});

// ---------------- IMPORTAR BACKUP ----------------

const inputBackup = document.getElementById("inputBackup");
const erroBackup = document.getElementById("erroBackup");
const sucessoBackup = document.getElementById("sucessoBackup");

document.getElementById("btnImportarBackup").addEventListener("click", () => {
    inputBackup.click();
});

inputBackup.addEventListener("change", async () => {

    const arquivo = inputBackup.files[0];
    if (!arquivo) return;

    erroBackup.classList.add("oculto");
    sucessoBackup.classList.add("oculto");

    try {

        const texto = await arquivo.text();
        const backup = JSON.parse(texto);

        const chavesEsperadas = ["movimentacoes", "bancos", "metas", "orcamentos", "categorias"];
        const temAlgumaChave = chavesEsperadas.some(chave => chave in backup);

        if (!temAlgumaChave) {
            throw new Error("Esse arquivo não parece ser um backup válido do Finanças.");
        }

        const confirmar = confirm(
            "Restaurar esse backup vai substituir TODOS os seus dados atuais. Deseja continuar?"
        );

        if (!confirmar) {
            inputBackup.value = "";
            return;
        }

        if (Array.isArray(backup.movimentacoes)) {
            await armazenamento.setItem("movimentacoes", JSON.stringify(backup.movimentacoes));
        }
        if (Array.isArray(backup.bancos)) {
            await armazenamento.setItem("bancos", JSON.stringify(backup.bancos));
        }
        if (Array.isArray(backup.metas)) {
            await armazenamento.setItem("metas", JSON.stringify(backup.metas));
        }
        if (Array.isArray(backup.orcamentos)) {
            await armazenamento.setItem("orcamentos", JSON.stringify(backup.orcamentos));
        }
        if (backup.categorias && typeof backup.categorias === "object") {
            await armazenamento.setItem("categorias", JSON.stringify(backup.categorias));
        }

        sucessoBackup.textContent = "Backup restaurado com sucesso! Redirecionando...";
        sucessoBackup.classList.remove("oculto");

        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1500);

    } catch (erro) {
        erroBackup.textContent = erro.message || "Não foi possível ler esse arquivo.";
        erroBackup.classList.remove("oculto");
    } finally {
        inputBackup.value = "";
    }
});

// ---------------- ALTERAR SENHA ----------------

const formSenha = document.getElementById("formSenha");
const btnMostrarSenha = document.getElementById("btnMostrarSenha");
const erroSenha = document.getElementById("erroSenha");
const sucessoSenha = document.getElementById("sucessoSenha");

btnMostrarSenha.addEventListener("click", () => {
    formSenha.classList.toggle("oculto");
});

formSenha.addEventListener("submit", async (e) => {

    e.preventDefault();

    erroSenha.classList.add("oculto");
    sucessoSenha.classList.add("oculto");

    const senhaAtual = document.getElementById("senhaAtual").value;
    const senhaNova = document.getElementById("senhaNova").value;

    try {

        const credencial = EmailAuthProvider.credential(usuario.email, senhaAtual);
        await reauthenticateWithCredential(usuario, credencial);
        await updatePassword(usuario, senhaNova);

        sucessoSenha.textContent = "Senha alterada com sucesso!";
        sucessoSenha.classList.remove("oculto");
        formSenha.reset();

    } catch (erro) {

        let mensagem = "Não foi possível alterar a senha.";

        if (erro.code === "auth/invalid-credential" || erro.code === "auth/wrong-password") {
            mensagem = "Senha atual incorreta.";
        } else if (erro.code === "auth/weak-password") {
            mensagem = "A nova senha precisa ter pelo menos 6 caracteres.";
        }

        erroSenha.textContent = mensagem;
        erroSenha.classList.remove("oculto");
    }
});

// ---------------- EXCLUIR CONTA ----------------

document.getElementById("btnExcluirConta").addEventListener("click", async () => {

    const confirmar1 = confirm(
        "Isso vai apagar sua conta e TODOS os seus dados permanentemente. Essa ação não pode ser desfeita. Deseja continuar?"
    );

    if (!confirmar1) return;

    const senha = prompt("Pra confirmar, digite sua senha atual:");

    if (!senha) return;

    try {

        const credencial = EmailAuthProvider.credential(usuario.email, senha);
        await reauthenticateWithCredential(usuario, credencial);

        await deleteDoc(doc(db, "usuarios", usuario.uid));
        await deleteUser(usuario);

        alert("Sua conta foi excluída.");
        window.location.href = "../index.html";

    } catch (erro) {

        if (erro.code === "auth/invalid-credential" || erro.code === "auth/wrong-password") {
            alert("Senha incorreta. Sua conta não foi excluída.");
        } else {
            alert("Não foi possível excluir a conta. Tente novamente.");
        }
    }
});
