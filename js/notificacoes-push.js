// Inscrição de Web Push deste aparelho (Android e iPhone).
// A inscrição é guardada no seu documento do Firestore (notifInscricoes),
// de onde o Worker a lê para enviar os avisos com o app fechado.

import { db, doc, setDoc } from "./firebase-config.js";
import { deleteField } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { VAPID_PUBLIC_KEY } from "./notificacoes-config.js";

export function ehIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function instaladoNaTela() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

export function suportaPush() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function chaveConfigurada() {
    return typeof VAPID_PUBLIC_KEY === "string" && VAPID_PUBLIC_KEY.length > 40;
}

function chaveParaBytes(texto) {
    let s = texto.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
}

// Identificador deste aparelho (só letras e números — vira nome de campo no Firestore).
export function idDoAparelho() {
    let id = window.localStorage.getItem("financas_push_id");
    if (!id) {
        id = "d" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        window.localStorage.setItem("financas_push_id", id);
    }
    return id;
}

export async function inscricaoAtual() {
    const registro = await navigator.serviceWorker.ready;
    return registro.pushManager.getSubscription();
}

async function salvarInscricao(uid, inscricao) {
    const json = inscricao.toJSON();
    await setDoc(doc(db, "usuarios", uid), {
        notifInscricoes: {
            [idDoAparelho()]: {
                endpoint: json.endpoint,
                keys: json.keys,
                plataforma: ehIOS() ? "iphone" : "outro",
                atualizadoEm: Date.now()
            }
        }
    }, { merge: true });
}

// Precisa ser chamada a partir de um toque do usuário (exigência do iPhone).
export async function ativarNeste(uid) {

    const permissao = await Notification.requestPermission();
    if (permissao !== "granted") return { ok: false, motivo: permissao };

    const registro = await navigator.serviceWorker.ready;
    let inscricao = await registro.pushManager.getSubscription();

    if (!inscricao) {
        inscricao = await registro.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: chaveParaBytes(VAPID_PUBLIC_KEY)
        });
    }

    await salvarInscricao(uid, inscricao);
    window.localStorage.setItem("financas_push_ativo", "1");
    return { ok: true };
}

export async function desativarNeste(uid) {
    const inscricao = await inscricaoAtual();
    if (inscricao) await inscricao.unsubscribe().catch(() => {});
    await setDoc(doc(db, "usuarios", uid), {
        notifInscricoes: { [idDoAparelho()]: deleteField() }
    }, { merge: true });
    window.localStorage.removeItem("financas_push_ativo");
}

// Chamada ao abrir o Dashboard: se este aparelho já tinha ativado os avisos,
// confere se a inscrição continua válida e regrava se o sistema a trocou
// (isso acontece de vez em quando, principalmente no iPhone). Silenciosa.
export async function renovarSeNecessario(uid, dadosUsuario) {

    if (!suportaPush() || !chaveConfigurada()) return;
    if (Notification.permission !== "granted") return;
    if (window.localStorage.getItem("financas_push_ativo") !== "1") return;

    const registro = await navigator.serviceWorker.ready;
    let inscricao = await registro.pushManager.getSubscription();

    if (!inscricao) {
        inscricao = await registro.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: chaveParaBytes(VAPID_PUBLIC_KEY)
        });
    }

    const guardada = dadosUsuario && dadosUsuario.notifInscricoes &&
        dadosUsuario.notifInscricoes[idDoAparelho()];

    if (!guardada || guardada.endpoint !== inscricao.endpoint) {
        await salvarInscricao(uid, inscricao);
    }
}
