import { MSG_ACTIONS, ask, autoGrow, handleMsgAction, refreshAIStatus, renderChat, renderHistory, saveEdit, updateSend } from '../chat/flow.js';
import { load, save } from '../chat/model.js';
import { handleOpenUIAction } from '../chat/render.js';
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
  
  messagesEl.addEventListener("click", (e) => {
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
    /* Botones y sugerencias de las respuestas generadas */
    const uiAction = e.target.closest("[data-toassistant]");
    if (uiAction) {
      const form = uiAction.closest("form[data-ui-form]");
      if (form && uiAction.type === "submit")
        return; /* lo recoge el evento submit */
      e.preventDefault();
      handleOpenUIAction({
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
    handleOpenUIAction({
      type: "continue_conversation",
      humanFriendlyMessage: message,
      formState: state,
    });
  });
  
  $("#tlBtnSide").addEventListener("click", () => {
    closeMenu();
    window.location.assign('/settings/tl/');
  });
  $("#moodleBtnSide")?.addEventListener("click", () => {
    closeMenu();
    if (!moodleSessionActive()) {
      window.location.assign('/');
      return;
    }
    const pw = $("#moodlePassword"); if (pw) pw.value = "";
    updateMoodleUI();
    window.open(`${getMoodle().base}/my/`, '_blank', 'noopener');
  });
  $("#logoutBtnSide")?.addEventListener("click", () => {
    closeMenu();
    moodleLogout();
  });
  $("#profileBtn").addEventListener("click", () => {
    closeMenu();
    window.location.assign('/settings/ai/');
  });
  function startNewChat() {
    if (S.busy) return;
    S.currentId = null;
    S.editingId = null;
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
      if (S.currentId === del.dataset.del) S.currentId = null;
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
        window.history.replaceState(null, '', `/chat/?chat=${encodeURIComponent(S.currentId)}`);
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
initChat();
initModals();

