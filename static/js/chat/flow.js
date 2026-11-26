import { PROVIDERS, aiErrorResult, cleanResponse, resultFromText } from '../ai/providers.js';
import { runAIWithTools } from '../ai/tools-loop.js';
import { activePath, addNode, branchSiblings, current, lastLeaf, nodeById, renderWelcome, save } from './model.js';
import { appendMessage, hideThinking, piiWarningHTML, renderProgramInto, renderStream, scrollDown, showThinking } from './render.js';
import { $, chat, escapeHTML, form, historyEl, icon, input, main, messagesEl, normalize, sendBtn, uid, welcome } from '../core/dom.js';
import { pause } from '../core/helpers.js';
import { SENSITIVE, containsPII, redactPII } from '../core/privacy.js';
import { getSettings } from '../core/settings-store.js';
import { S, busy, conversations, currentId, editingId, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from '../core/state.js';
import { moodleSessionActive, syncChatAccess } from '../moodle/session.js';
export function renderHistory() {
  if (!historyEl) return;
  if (!S.conversations.length) {
    historyEl.innerHTML = `<p class="history-empty">Aún no hay conversaciones.</p>`;
    return;
  }
  historyEl.innerHTML = "";
  [...S.conversations].reverse().forEach((c) => {
    const item = document.createElement("div");
    item.className = "history-item" + (c.id === S.currentId ? " active" : "");
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", c.title);
    item.classList.add("tip-r");
    item.dataset.tip = c.title;
    item.tabIndex = 0;
    item.dataset.id = c.id;
    item.innerHTML = `${icon("chat", "sm")}<span class="history-title">${escapeHTML(c.title)}</span><button class="history-del" data-del="${c.id}" aria-label="Eliminar conversación">${icon("delete", "sm")}</button>`;
    historyEl.appendChild(item);
  });
}

export function renderChat() {
  if (!messagesEl || !main || !chat || !welcome) return;
  /* Sin sesión de Moodle el inicio es la introducción al repo y el registro. */
  syncChatAccess();
  messagesEl.innerHTML = "";
  if (!moodleSessionActive()) return;
  const conv = current();
  const path = activePath(conv);
  const empty = path.length === 0;
  welcome.hidden = !empty;
  main.classList.toggle("is-empty", empty);
  if (!empty) path.forEach((m) => appendMessage(m, false));
  else {
    chat.scrollTop = 0;
    renderWelcome();
  }
}

/* ---------- Flujo principal ---------- */
/* `data` viaja a la IA como contexto oculto; el chat muestra solo el mensaje de la persona */
export function ask(question, options = {}) {
  const opts =
    typeof options === "object" && options !== null
      ? options
      : { hidden: Boolean(options) };
  const hidden = Boolean(opts.hidden);
  const data = opts.data || null;
  question = String(question).trim();
  if (!question || S.busy) return;
  if (!moodleSessionActive()) {
    /* Sin ingreso a Moodle no se puede entrar al chat. */
    renderChat();
    return;
  }
  if (!current()) {
    const title = hidden ? "Encuesta respondida" : question.slice(0, 40);
    const conv = { id: uid(), title, nodes: [], activeLeafId: null };
    S.conversations.push(conv);
    S.currentId = conv.id;
    try {
      if (window.location.pathname === '/chat/')
        window.history.pushState(null, '', `/chat/?chat=${encodeURIComponent(conv.id)}`);
    } catch (e) {}
  }
  const conv = current();
  welcome.hidden = true;
  main.classList.remove("is-empty");
  /* Redactar datos personales del input del usuario antes de mostrar */
  const safeQuestion = redactPII(question);
  let parentId = conv.activeLeafId ?? null;
  if (!hidden) {
    const userNode = addNode({ role: "user", text: safeQuestion }, parentId);
    parentId = userNode.id;
    appendMessage(userNode);
  }
  renderHistory();
  const preamble = !hidden && containsPII(question) ? piiWarningHTML() : "";
  const fullQuestion = data
    ? `${safeQuestion} · Datos del formulario: ${JSON.stringify(data)}`
    : safeQuestion;
  respond(fullQuestion, { parentId, preamble });
}

export function finishResponse(
  result,
  { node = null, parentId = null, preamble = "", question = "" } = {},
) {
  /* El texto ya se redactó antes de convertirlo en HTML; no volvamos a
     tocar enlaces generados (un redactado tardío rompería su href). */
  if (typeof result.short === "string" && !/<[a-z]/i.test(result.short))
    result.short = redactPII(result.short);
  if (typeof result.html === "string" && !/<a\s/i.test(result.html))
    result.html = redactPII(result.html);
  const botNode =
    node || addNode({ role: "bot", ...result, preamble, question }, parentId);
  if (node) Object.assign(botNode, result, { role: "bot", preamble, question });
  delete botNode.pending;
  const conv = current();
  conv.activeLeafId = botNode.id;
  save();
  renderChat();
  /* La respuesta definitiva se vuelve a pintar desde el nodo guardado: así
     ningún fragmento tardío del streaming puede dejar la tarjeta incompleta. */
  const finalWrap = messagesEl.querySelector(`.msg[data-id="${botNode.id}"]`);
  if (finalWrap) {
    finalWrap.classList.remove("is-streaming");
    if (botNode.type === "ui") {
      const mount = finalWrap.querySelector(".ui-render");
      if (mount) renderProgramInto(mount, botNode.response);
    }
  }
  scrollDown(true);
  S.busy = false;
  updateSend();
  input.focus();
}

export async function respond(
  question,
  { parentId = null, preamble = "", node = null } = {},
) {
  S.busy = true;
  updateSend();
  if (node) {
    /* Al rehacer, el mensaje anterior se reemplaza en el acto por este estado pendiente */
    current().activeLeafId = node.id;
    renderChat();
  } else {
    showThinking();
  }
  let result;
  let streamingNode = null;
  let finished = false;
  try {
    const settings = getSettings();
    const q = normalize(question);
    if (SENSITIVE.some((k) => q.includes(k))) {
      result = { type: "safety" };
    } else if (settings.apiKey) {
      hideThinking();
      streamingNode =
        node ||
        addNode(
          {
            role: "bot",
            type: "answer",
            response: "",
            short: "",
            html: "",
            preamble,
            question,
          },
          parentId,
        );
      const wrap = node
        ? messagesEl.querySelector(`.msg[data-id="${streamingNode.id}"]`)
        : appendMessage(streamingNode);
      if (wrap) wrap.classList.add("is-streaming");
      try {
        /* Los fragmentos van dibujando el texto; si la IA pide consultar Moodle,
           ejecutamos la herramienta y le devolvemos el resultado antes de pintar. */
        const text = await runAIWithTools(question, settings, (partial) => {
          if (finished) return;
          const card = wrap.querySelector(".card");
          if (card) renderStream(partial, card);
        });
        const complete = cleanResponse(text);
        /*Último repintado con el texto íntegro: si algún fragmento no llegó a
          dibujarse, la tarjeta no se queda cortada antes de finalizar. */
        const card = wrap.querySelector(".card");
        if (card) renderStream(complete, card, true);
        result = resultFromText(complete, question);
      } catch (err) {
        /* Si el proveedor no soporta streaming, usamos la llamada normal */
        try {
          const text = await runAIWithTools(question, settings, () => {}, false);
          const complete = cleanResponse(text);
          const card = wrap.querySelector(".card");
          if (card) renderStream(complete, card, true);
          result = resultFromText(complete, question);
        } catch (e2) {
          result = aiErrorResult(e2, question, settings);
        }
      }
    } else {
      /* Sin proveedor conectado no hay respuestas: se necesita una IA real. */
      result = {
        type: "error",
        kind: "key",
        title: "Conecta tu asistente con una IA",
        question,
        message:
          "Falta la API key. Pídele a Clan IA una key gratuita de Google Gemini o OpenRouter y guárdala en tu perfil para empezar a preguntar.",
      };
    }
  } catch (err) {
    result = aiErrorResult(err, question, getSettings());
  }
  finished = true;
  hideThinking();
  finishResponse(result, {
    node: node || streamingNode,
    parentId,
    preamble,
    question,
  });
}

/* ---------- Acciones de mensajes: copiar, editar, rehacer y ramas ---------- */
export function nodeText(node) {
  if (node.role === "user") return node.text || "";
  const wrap = messagesEl.querySelector(`.msg[data-id="${node.id}"]`);
  const card = wrap && wrap.querySelector(".card");
  if (!card) return node.short || node.message || "";
  const clone = card.cloneNode(true);
  clone.querySelectorAll(".actions, .actions *").forEach((el) => el.remove());
  return clone.innerText.trim() || node.short || "";
}

export async function copyText(text) {
  const modern = async () => {
    if (
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    )
      return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  };
  /* En algunos navegadores la API espera permiso: si no responde, usamos el método clásico */
  try {
    if (await Promise.race([modern(), pause(600)])) return true;
  } catch (e) {}
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (err) {}
  area.remove();
  return ok;
}

export function flashCopied(btn, ok) {
  const originalHTML = btn.innerHTML;
  const originalLabel = btn.getAttribute("aria-label") || btn.title;
  btn.innerHTML = icon(ok ? "check" : "error");
  const label = ok ? "Copiado" : "No se pudo copiar";
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.classList.add("is-copied");
  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.title = originalLabel;
    btn.setAttribute("aria-label", originalLabel);
    btn.classList.remove("is-copied");
  }, 1200);
}

export function regenerate(botId) {
  const bot = nodeById(botId);
  if (!bot || bot.role !== "bot") return;
  const parent = bot.parentId ? nodeById(bot.parentId) : null;
  const question = bot.question || parent?.text || "";
  const newNode = addNode(
    {
      role: "bot",
      type: "answer",
      response: "",
      short: "",
      html: "",
      preamble: bot.preamble || "",
      question,
      pending: true,
    },
    bot.parentId,
  );
  respond(question, {
    parentId: bot.parentId,
    preamble: bot.preamble || "",
    node: newNode,
  });
}

export function switchBranch(id, delta) {
  const conv = current();
  const node = nodeById(id);
  const siblings = branchSiblings(node, conv);
  if (siblings.length < 2) return;
  const index = siblings.findIndex((n) => n.id === id);
  const target = siblings[(index + delta + siblings.length) % siblings.length];
  conv.activeLeafId = lastLeaf(target, conv).id;
  save();
  renderChat();
}

export function saveEdit(id, text) {
  if (!text) return;
  const old = nodeById(id);
  if (!old || old.role !== "user") return;
  const safe = redactPII(text);
  const newNode = addNode({ role: "user", text: safe }, old.parentId);
  S.editingId = null;
  save();
  renderChat();
  renderHistory();
  respond(safe, {
    parentId: newNode.id,
    preamble: containsPII(text) ? piiWarningHTML() : "",
  });
}

export async function handleMsgAction(btn) {
  const action = btn.dataset.action;
  const node = nodeById(btn.dataset.msgId || btn.closest(".msg")?.dataset.id);
  if (!node) return;
  if (action === "copy") {
    flashCopied(btn, await copyText(nodeText(node)));
    return;
  }
  if (S.busy) return;
  if (action === "edit") {
    S.editingId = node.id;
    renderChat();
    requestAnimationFrame(() => {
      const area = messagesEl.querySelector(".edit-form textarea");
      if (area) {
        area.focus();
        area.setSelectionRange(area.value.length, area.value.length);
      }
    });
  }
  if (action === "redo") regenerate(node.id);
  if (action === "branch-prev") switchBranch(node.id, -1);
  if (action === "branch-next") switchBranch(node.id, 1);
}

export function updateSend() {
  sendBtn.disabled = S.busy || !input.value.trim();
}

/* ---------- Estado de conexión con la IA (según la key guardada) ---------- */
export function refreshAIStatus() {
  const connected = Boolean(getSettings().apiKey);
  const mobileAvatar = $("#mobileAvatar");
  if (mobileAvatar) mobileAvatar.dataset.online = String(connected);
}

export function autoGrow() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 140) + "px";
}

/* ---------- Modales y menú ---------- */
export const MSG_ACTIONS = [
  "copy",
  "edit",
  "redo",
  "branch-prev",
  "branch-next",
  "cancel-edit",
];
