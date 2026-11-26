import { MSG_ACTIONS, ask, autoGrow, handleMsgAction, refreshAIStatus, renderChat, renderHistory, saveEdit, updateSend } from '../chat/flow.js';
import { load, save } from '../chat/model.js';
import { handleUIAction } from '../chat/render.js';
import { $, app, closeMenu, form, historyEl, input, menuQuery, menuToggle, messagesEl, setMenu } from '../core/dom.js';
import { initModals } from '../core/modals.js';
import { getMoodle } from '../core/state.js';
import { S, busy, conversations, currentId, editingId, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from '../core/state.js';
import { moodleLogout, moodleSessionActive, updateMoodleUI } from '../moodle/session.js';
import { openSettings } from '../settings/settings.js';
const paramsChat = new URLSearchParams(window.location.search);
const chatSolicitado = paramsChat.get('chat');
if (!getMoodle().token) {
  if (chatSolicitado) localStorage.setItem('ritchie-ia-chat-pendiente', chatSolicitado);
  window.location.replace('/');
}
setMenu(!menuQuery.matches);
load();
/* Enlace directo (también tras iniciar sesión): abre la conversación elegida. */
const chatId =
  chatSolicitado || localStorage.getItem('ritchie-ia-chat-pendiente');
if (chatId && S.conversations.some((c) => c.id === chatId)) {
  S.currentId = chatId;
  localStorage.removeItem('ritchie-ia-chat-pendiente');
}
renderHistory();
renderChat();
refreshAIStatus();
updateMoodleUI();
export function initChat() {
  /* ---------- Eventos ---------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value;
    input.value = "";
    autoGrow();
    updateSend();
    ask(q);
  });
  input.addEventListener("input", () => {
    autoGrow();
    updateSend();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  
  $("#suggestions").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (chip) ask(chip.dataset.q);
  });
  
  messagesEl.addEventListener("click", async (e) => {
    /* Pestañas de las respuestas generadas */
    const tab = e.target.closest("[data-ui-tab]");
    if (tab) {
      const group = tab.closest(".ui-tabs");
      group
        .querySelectorAll(".ui-tab")
        .forEach((b) => b.classList.toggle("active", b === tab));
      group.querySelectorAll(".ui-tabpanel").forEach((p) => {
        p.hidden = p.dataset.panel !== tab.dataset.uiTab;
      });
      return;
    }
    /* Bloques de código: copiar y descargar. */
    const copiar = e.target.closest("[data-code-copy]");
    if (copiar) {
      const bloque = copiar.closest(".ui-code-block");
      const texto = bloque?.querySelector("code")?.textContent || "";
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(texto);
        else {
          const tmp = document.createElement("textarea");
          tmp.value = texto;
          document.body.appendChild(tmp);
          tmp.select();
          document.execCommand("copy");
          tmp.remove();
        }
        copiar.innerHTML = '<span class="ic sm">check</span>';
        copiar.setAttribute("aria-label", "Copiado");
        setTimeout(() => {
          copiar.innerHTML = '<span class="ic sm">content_copy</span>';
          copiar.setAttribute("aria-label", "Copiar código");
        }, 1400);
      } catch (err) {}
      return;
    }
    const descargar = e.target.closest("[data-code-download]");
    if (descargar) {
      const bloque = descargar.closest(".ui-code-block");
      const texto = bloque?.querySelector("code")?.textContent || "";
      const lang = bloque?.querySelector(".ui-code-lang")?.textContent || "txt";
      const url = URL.createObjectURL(new Blob([texto], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `codigo-${lang}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    /* Mostrar/ocultar contraseña en los formularios generados. */
    const verPwd = e.target.closest("[data-toggle-pwd]");
    if (verPwd) {
      const wrap = verPwd.closest(".ui-input-wrap");
      const pwd = wrap?.querySelector('input[type="password"], input[type="text"]');
      if (!pwd) return;
      const visible = pwd.type === "password";
      pwd.type = visible ? "text" : "password";
      verPwd.setAttribute("aria-pressed", String(visible));
      verPwd.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
      const icono = verPwd.querySelector(".ic");
      if (icono) icono.textContent = visible ? "visibility_off" : "visibility";
      pwd.focus();
      return;
    }
    /* Botones y sugerencias de las respuestas generadas */
    const uiAction = e.target.closest("[data-toassistant]");
    if (uiAction) {
      const form = uiAction.closest("form[data-ui-form]");
      if (form && uiAction.type === "submit")
        return; /* lo recoge el evento submit */
      e.preventDefault();
      handleUIAction({
        type: "continue_conversation",
        humanFriendlyMessage: uiAction.dataset.toassistant,
      });
      return;
    }
    const act = e.target.closest("[data-action]");
    if (act && MSG_ACTIONS.includes(act.dataset.action)) {
      e.preventDefault();
      if (act.dataset.action === "cancel-edit") {
        S.editingId = null;
        window.location.assign('/');
        return;
      }
      handleMsgAction(act);
      return;
    }
    if (!act) return;
    if (act.dataset.action === "tl") window.location.assign('/settings/tl/');
    if (act.dataset.action === "open-ai-settings") {
      closeMenu();
      openSettings("ia");
      return;
    }
    if (act.dataset.action === "retry-ai") {
      const q = String(act.dataset.q || "").trim();
      if (!q || S.busy) return;
      input.value = q;
      autoGrow();
      updateSend();
      ask(q);
      return;
    }
    if (act.dataset.action === "rephrase") {
      input.value = act.dataset.q;
      autoGrow();
      updateSend();
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });
  
  messagesEl.addEventListener("submit", (e) => {
    if (e.target.matches("[data-edit-form]")) {
      e.preventDefault();
      const text = e.target.querySelector("textarea").value.trim();
      saveEdit(e.target.closest(".msg").dataset.id, text);
      return;
    }
    if (!e.target.matches("form[data-ui-form]")) return;
    e.preventDefault();
    const form = e.target;
    const button = form.querySelector('button[type="submit"]');
    const message = button?.dataset.toassistant || "Enviar respuestas";
    const state = {};
    new FormData(form).forEach((value, key) => {
      if (!String(value).trim()) return;
      if (state[key] === undefined) state[key] = value;
      else if (Array.isArray(state[key])) state[key].push(value);
      else state[key] = [state[key], value];
    });
    handleUIAction({
      type: "continue_conversation",
      humanFriendlyMessage: message,
      formState: state,
    });
  });
  
  $("#tlBtnSide").addEventListener("click", () => closeMenu());
  $("#moodleBtnSide")?.addEventListener("click", (e) => {
    closeMenu();
    if (!moodleSessionActive()) {
      e.preventDefault();
      window.location.assign('/');
    }
  });
  $("#logoutBtnSide")?.addEventListener("click", (e) => {
    e.preventDefault();
    closeMenu();
    moodleLogout();
  });
  $("#profileBtn").addEventListener("click", () => closeMenu());
  function startNewChat() {
    if (S.busy) return;
    S.currentId = null;
    S.editingId = null;
    try { window.history.replaceState(null, '', '/chat/'); } catch (e) {}
    renderChat();
    renderHistory();
    closeMenu();
    input.focus();
  }
  $("#newChat").addEventListener("click", startNewChat);
  $("#mobileNewChat").addEventListener("click", startNewChat);
  
  historyEl.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      if (S.busy) return;
      S.conversations = S.conversations.filter((c) => c.id !== del.dataset.del);
      if (S.currentId === del.dataset.del) {
        S.currentId = null;
        try { window.history.replaceState(null, '', '/chat/'); } catch (e) {}
      }
      save();
      renderChat();
      renderHistory();
      return;
    }
    const item = e.target.closest(".history-item");
    if (item && !S.busy) {
      S.currentId = item.dataset.id;
      S.editingId = null;
      try {
        window.history.pushState(null, '', `/chat/?chat=${encodeURIComponent(S.currentId)}`);
      } catch (e) {}
      renderChat();
      renderHistory();
      closeMenu();
    }
  });
  historyEl.addEventListener("keydown", (e) => {
    if (
      (e.key === "Enter" || e.key === " ") &&
      e.target.classList.contains("history-item")
    ) {
      e.preventDefault();
      e.target.click();
    }
  });
  
  menuToggle.addEventListener("click", () =>
    setMenu(app.dataset.menu !== "open"),
  );
  $("#mobileMenuBtn").addEventListener("click", () =>
    setMenu(app.dataset.menu !== "open"),
  );
  $("#mobileProfileBtn").addEventListener("click", () => {
    closeMenu();
    window.location.assign('/settings/ai/');
  });
  $("#scrim").addEventListener("click", () => setMenu(false));
  menuQuery.addEventListener("change", (e) => setMenu(!e.matches));
}
/* El botón atrás/adelante del navegador también cambia de conversación. */
window.addEventListener('popstate', () => {
  const id = new URLSearchParams(window.location.search).get('chat');
  S.currentId = id && S.conversations.some((c) => c.id === id) ? id : null;
  S.editingId = null;
  renderChat();
  renderHistory();
});
const enlaceMoodle = $('#moodleBtnSide');
if (enlaceMoodle) enlaceMoodle.href = `${getMoodle().base}/my/`;
initChat();
initModals();

