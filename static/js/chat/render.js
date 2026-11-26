import { cleanResponse } from '../ai/providers.js';
import { ask } from './flow.js';
import { initDropdowns } from './components/dropdown.js';
import { initPlayers } from './components/player.js';
import { initCharts } from './components/charts.js';
import { initCalendars } from './components/visual.js';
import { branchSiblings } from './model.js';
import { $, LOGO_MINI, chat, escapeHTML, form, icon, input, messagesEl } from '../core/dom.js';
import { S, busy, conversations, currentId, editingId, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from '../core/state.js';
import {
  actionText,
  anchorHTML,
  asArray,
  normalizeHref,
  renderButtons,
  renderNode,
  richText,
  uiId,
  valText,
} from './components/index.js';
export {
  actionText,
  anchorHTML,
  asArray,
  normalizeHref,
  renderButtons,
  renderNode,
  richText,
  uiId,
  valText,
};


/* Acciones de los formularios: el estado se devuelve a la IA como contexto oculto */
export function handleUIAction(action) {
  if (!action || action.type !== "continue_conversation") return;
  const state = action.formState;
  const hasJSON = Boolean(
    state && typeof state === "object" && Object.keys(state).length,
  );
  /* El mensaje visible es solo la intención de la persona; los datos viajan aparte */
  ask(action.humanFriendlyMessage || "Continuar", {
    data: hasJSON ? state : null,
  });
}

/* Texto legible si el modelo entrega un programa que no se puede dibujar */
export function programToText(program) {
  const strings = program.match(/"((?:\\.|[^"\\])*)"/g) || [];
  if (strings.length)
    return strings.map((s) => s.slice(1, -1).replace(/\\"/g, '"')).join(" · ");
  return program
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[A-Za-z_$][\w$]*\s*=\s*/, "").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 600);
}

/* --- Intérprete mínimo del lenguaje de componentes --- */
export function splitArgs(src) {
  const out = [];
  let depth = 0,
    quote = false,
    esc = false,
    start = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') quote = false;
      continue;
    }
    if (c === '"') {
      quote = true;
      continue;
    }
    if ("[({".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === "," && depth === 0) {
      out.push(src.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = src.slice(start).trim();
  if (last) out.push(last);
  return out;
}
export function closeIndex(src, open, close) {
  let depth = 0,
    quote = false,
    esc = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') quote = false;
      continue;
    }
    if (c === '"') {
      quote = true;
      continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return i;
  }
  return -1;
}
export function parseValue(src) {
  const s = String(src).trim();
  if (!s) return null;
  if (s[0] === '"') {
    try {
      return JSON.parse(s);
    } catch (e) {
      return s.slice(1, -1);
    }
  }
  if (s[0] === "[") {
    const end = closeIndex(s, "[", "]");
    return splitArgs(s.slice(1, end < 0 ? s.length : end)).map(parseValue);
  }
  if (s[0] === "{") {
    const end = closeIndex(s, "{", "}");
    const obj = {};
    splitArgs(s.slice(1, end < 0 ? s.length : end)).forEach((pair) => {
      const m = pair.match(
        /^(?:"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*([\s\S]+)$/,
      );
      if (m) obj[m[1] || m[2]] = parseValue(m[3]);
    });
    return obj;
  }
  if (s[0] === "@") {
    const m = s.slice(1).match(/^([A-Za-z_$][\w$]*)\s*\(([\s\S]*)\)$/);
    return m
      ? { __step: m[1], args: splitArgs(m[2]).map(parseValue) }
      : { __step: s.slice(1), args: [] };
  }
  const call = s.match(/^([A-Za-z_$][\w$]*)\s*\(([\s\S]*)\)$/);
  if (call)
    return { __call: call[1], args: splitArgs(call[2]).map(parseValue) };
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return { __ref: s };
}
export function parseProgram(src) {
  const env = {};
  src.split(/\r?\n/).forEach((line) => {
    const m = line.trim().match(/^([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+)$/);
    if (m) env[m[1]] = parseValue(m[2]);
  });
  return env;
}
export function resolveValue(v, env, seen = new Set()) {
  if (Array.isArray(v)) return v.map((x) => resolveValue(x, env, seen));
  if (v && typeof v === "object") {
    if (v.__ref) {
      if (seen.has(v.__ref)) return null;
      return resolveValue(env[v.__ref], env, new Set([...seen, v.__ref]));
    }
    if (v.__call)
      return {
        type: v.__call,
        args: v.args.map((x) => resolveValue(x, env, seen)),
      };
    if (v.__step)
      return {
        step: v.__step,
        args: v.args.map((x) => resolveValue(x, env, seen)),
      };
    const out = {};
    Object.entries(v).forEach(([k, x]) => {
      out[k] = resolveValue(x, env, seen);
    });
    return out;
  }
  return v;
}
export function renderProgramInto(mount, program) {
  if (!mount || typeof program !== "string") return false;
  try {
    const env = parseProgram(program);
    const root = resolveValue(env.root, env);
    if (!root) throw new Error("sin root");
    /* El modelo a veces devuelve un componente suelto como raíz (por ejemplo
       solo un Link): lo envolvemos en una Card en vez de perder la respuesta. */
    const card = root.type === "Card" ? root : { type: "Card", args: [root] };
    mount.innerHTML = renderNode(card);
    initDropdowns(mount);
    initPlayers(mount);
    initCharts(mount);
    initCalendars(mount);
    return true;
  } catch (err) {
    mount.innerHTML = `<p class="ui-fallback">${escapeHTML(programToText(program) || "No se pudo mostrar la interfaz.")}</p>`;
    return false;
  }
}

/* Durante el streaming el programa está a medio escribir. Cerramos comillas y
   paréntesis abiertos solo para previsualizarlo: nunca se guarda ni se usa como
   respuesta definitiva. Así se dibujan componentes reales desde el primer
   fragmento, sin mostrar el código fuente del lenguaje. */
export function repairProgram(src) {
  let quote = false,
    esc = false;
  const stack = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') quote = false;
      continue;
    }
    if (c === '"') {
      quote = true;
      continue;
    }
    if ("[({".includes(c)) stack.push(c);
    else if (")]}".includes(c)) {
      const top = stack[stack.length - 1];
      const expected = top === "(" ? ")" : top === "[" ? "]" : "}";
      if (top && c === expected) stack.pop();
    }
  }
  let out = src;
  if (quote) out += '"';
  while (stack.length) {
    const c = stack.pop();
    out += c === "(" ? ")" : c === "[" ? "]" : "}";
  }
  return out;
}
export function renderPartialProgram(mount, program) {
  if (!mount || typeof program !== "string") return false;
  try {
    const env = parseProgram(repairProgram(program));
    let root = resolveValue(env.root, env);
    if (Array.isArray(root) && root.length)
      root = { type: "Card", args: root };
    if (!root || !root.type) {
      for (const key of Object.keys(env)) {
        if (key === "root") continue;
        const candidate = resolveValue(env[key], env);
        if (candidate && candidate.type) {
          root = candidate;
          break;
        }
      }
    }
    if (!root || !root.type) return false;
    const card = root.type === "Card" ? root : { type: "Card", args: [root] };
    const html = renderNode(card);
    if (!html) return false;
    mount.innerHTML = html;
    initDropdowns(mount);
    initPlayers(mount);
    initCharts(mount);
    initCalendars(mount);
    return true;
  } catch (err) {
    return false;
  }
}

/* ---------- Plantillas ---------- */
export function cardHTML(msg) {
  const preamble = msg.preamble
    ? `<div class="preamble">${msg.preamble}</div>`
    : "";
  if (msg.pending) {
    return `${preamble}<div class="card card-pending"><div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span class="thinking-label">Clan IA está escribiendo<span class="thinking-ring" aria-hidden="true"></span></span></div></div>`;
  }
  if (msg.type === "ui") {
    return `${preamble}<div class="card card-ui"><div class="ui-render"></div></div>`;
  }
  if (msg.type === "answer") {
    return `${preamble}<div class="card">${msg.short ? `<p class="short">${msg.short}</p>` : ""}${msg.html || ""}</div>`;
  }
  if (msg.type === "safety") {
    return `${preamble}<div class="card is-safety">
      <div class="status-row">
        <span class="status-ico">${icon("shield", "lg")}</span>
        <div>
          <h3>Este tema requiere atención personal</h3>
          <p>Las preguntas sobre salud, calificaciones, situaciones personales delicadas o decisiones sobre otras personas no deben resolverse con un asistente de IA.</p>
          <p>Por favor, <b>consulta directamente con el TL (Team Leader) o una persona responsable</b>. Ellos podrán ayudarte con el cuidado y la confidencialidad que mereces.</p>
        </div>
      </div>
      <div class="actions"><button class="btn btn-filled" data-action="tl">${icon("groups")}Hablar con el TL (Team Leader)</button></div>
    </div>`;
  }
  const looksLikeAIFailure =
    msg.kind && ["quota", "key", "model", "connection", "empty"].includes(msg.kind);
  const errorLook = {
    quota: ["is-quota", "schedule"],
    key: ["is-key", "key"],
    model: ["is-model", "smart_toy"],
    connection: ["is-connection", "wifi_off"],
    empty: ["is-empty", "smart_toy"],
    error: ["is-error", "error"],
  }[msg.kind] || ["is-error", "error"];
  const questionAttr = escapeHTML(msg.question || "");
  const retryButton = `<button class="btn btn-filled" data-action="retry-ai" data-q="${questionAttr}">${icon("refresh")}Reintentar</button>`;
  const settingsButton = `<button class="btn btn-tonal" data-action="open-ai-settings">${icon("settings")}Configurar IA</button>`;
  const actions = looksLikeAIFailure
    ? msg.kind === "key" || msg.kind === "model"
      ? settingsButton + retryButton
      : retryButton + settingsButton
    : `<button class="btn btn-filled" data-action="rephrase" data-q="${questionAttr}">${icon("edit")}Reformular la pregunta</button>
       <button class="btn btn-tonal" data-action="tl">${icon("groups")}Hablar con el TL (Team Leader)</button>`;
  return `${preamble}<div class="card ${errorLook[0]}">
    <div class="status-row">
      <span class="status-ico">${icon(errorLook[1], "lg")}</span>
      <div>
        <h3>${escapeHTML(msg.title || "No encontré una respuesta")}</h3>
        <p>${escapeHTML(msg.message || "No tengo información suficiente para responder esa pregunta con seguridad. Puedes reformularla con otras palabras o hablar con una persona.")}</p>
      </div>
    </div>
    <div class="actions">${actions}</div>
  </div>`;
}

export function piiWarningHTML() {
  return `<div class="pii-warning">${icon("security", "lg")} <div><b>Protección de datos personales</b><p>Hemos detectado datos personales en tu mensaje. Por tu seguridad, fueron ocultados automáticamente. Clan IA nunca solicita ni almacena datos personales.</p></div></div>`;
}

export function msgActionsHTML(node) {
  if (node.role === "user") {
    return `<div class="msg-actions">
      <button class="msg-action" type="button" data-action="copy" data-msg-id="${node.id}" title="Copiar" aria-label="Copiar mensaje">${icon("content_copy")}</button>
      <button class="msg-action" type="button" data-action="edit" data-msg-id="${node.id}" title="Editar" aria-label="Editar mensaje">${icon("edit")}</button>
    </div>`;
  }
  return `<div class="msg-actions">
    <button class="msg-action" type="button" data-action="copy" data-msg-id="${node.id}" title="Copiar" aria-label="Copiar respuesta">${icon("content_copy")}</button>
    <button class="msg-action" type="button" data-action="redo" data-msg-id="${node.id}" title="Rehacer" aria-label="Rehacer respuesta">${icon("refresh")}</button>
  </div>`;
}

export function branchBarHTML(node) {
  const siblings = branchSiblings(node);
  if (siblings.length < 2) return "";
  const index = siblings.findIndex((n) => n.id === node.id);
  return `<div class="branch-bar" role="group" aria-label="Ramas del mensaje">
    <button class="branch-btn" type="button" data-action="branch-prev" data-msg-id="${node.id}" aria-label="Rama anterior">${icon("chevron_left", "sm")}</button>
    <span class="branch-count">Rama ${index + 1}/${siblings.length}</span>
    <button class="branch-btn" type="button" data-action="branch-next" data-msg-id="${node.id}" aria-label="Rama siguiente">${icon("chevron_right", "sm")}</button>
  </div>`;
}

export function editFormHTML(text) {
  return `<form class="edit-form" data-edit-form>
    <textarea rows="2" aria-label="Editar mensaje">${escapeHTML(text)}</textarea>
    <div class="edit-actions">
      <button class="edit-btn" type="button" data-action="cancel-edit">Cancelar</button>
      <button class="edit-btn is-primary" type="submit">Guardar</button>
    </div>
  </form>`;
}

export function appendMessage(msg, animate = true) {
  const wrap = document.createElement("div");
  wrap.dataset.id = msg.id || "";
  if (msg.role === "user") {
    wrap.className = "msg user";
    wrap.innerHTML =
      msg.id === editingId
        ? `<div class="msg-body">${editFormHTML(msg.text)}</div>`
        : `<div class="msg-body"><div class="user-bubble">${escapeHTML(msg.text)}</div>${msgActionsHTML(msg)}${branchBarHTML(msg)}</div>`;
  } else {
    wrap.className = "msg bot";
    wrap.innerHTML =
      LOGO_MINI +
      `<div class="msg-stack">${cardHTML(msg)}${msgActionsHTML(msg)}${branchBarHTML(msg)}</div>`;
  }
  if (!animate) wrap.style.animation = "none";
  messagesEl.appendChild(wrap);
  if (msg.type === "ui")
    renderProgramInto(wrap.querySelector(".ui-render"), msg.response);
  scrollDown();
  return wrap;
}

export function showThinking() {
  const wrap = document.createElement("div");
  wrap.className = "msg bot is-thinking";
  wrap.id = "thinking";
  wrap.innerHTML =
    LOGO_MINI +
    `<div class="thinking">
    <span class="dots"><i></i><i></i><i></i></span>
    <span class="thinking-label">Clan IA está escribiendo<span class="thinking-ring" aria-hidden="true"></span></span>
  </div>`;
  messagesEl.appendChild(wrap);
  scrollDown();
}
export const hideThinking = () => {
  const t = $("#thinking");
  if (t) t.remove();
};
export const scrollDown = (instant = false) =>
  requestAnimationFrame(() => {
    if (instant) {
      /* El desplazamiento suave puede dejar la vista arriba cuando la
         respuesta crece de golpe: al terminar queremos verla completa. */
      const previous = chat.style.scrollBehavior;
      chat.style.scrollBehavior = "auto";
      chat.scrollTop = chat.scrollHeight;
      chat.style.scrollBehavior = previous;
    } else {
      chat.scrollTop = chat.scrollHeight;
    }
  });
export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const STREAM_TAIL = `<span class="stream-ring" aria-hidden="true"></span>`;

/* Mientras llega el texto decidimos si es un programa de componentes o prosa. En el
   primer caso dibujamos componentes reales con lo que ya viene; en el segundo,
   mostramos el texto como siempre. Nunca se ve el código fuente del programa. */
export const PARTIAL_PROGRAM = /(^|\n)\s*[A-Za-z_$][\w$]*\s*=\s*\S/;
export const PARTIAL_TOOL = /MOODLE_(?:TOOL|OPEN|VERIFY)\s*\(/i;
export const PARTIAL_VERIFY = /MOODLE_VERIFY\s*\(/i;
export const PARTIAL_WRITE = /MOODLE_WRITE\s*\(/i;
export const PARTIAL_CHAT = /CHAT_(?:LIST|READ|WRITE)\s*\(/i;
export const PARTIAL_DEVICE = /DEVICE_INFO\s*\(/i;

/* El fragmento que está llegando termina con un círculo que late */
export function renderStream(partial, card) {
  const clean = cleanResponse(partial);
  card.classList.add("card-ui");
  let mount = card.querySelector(".ui-render");
  if (!mount) {
    card.innerHTML = `<div class="ui-render"></div>`;
    mount = card.querySelector(".ui-render");
  }
  if (PARTIAL_DEVICE.test(clean)) {
    mount.innerHTML = `<p class="stream-placeholder">Consultando fecha, hora y dispositivo${STREAM_TAIL}</p>`;
    return;
  }
  if (PARTIAL_VERIFY.test(clean)) {
    mount.innerHTML = `<p class="stream-placeholder">Verificando nombres en Moodle${STREAM_TAIL}</p>`;
    return;
  }
  if (PARTIAL_WRITE.test(clean)) {
    mount.innerHTML = `<p class="stream-placeholder">Preparando cambio en Moodle${STREAM_TAIL}</p>`;
    return;
  }
  if (PARTIAL_CHAT.test(clean)) {
    mount.innerHTML = `<p class="stream-placeholder">Consultando tus chats${STREAM_TAIL}</p>`;
    return;
  }
  if (PARTIAL_TOOL.test(clean)) {
    mount.innerHTML = `<p class="stream-placeholder">Recorriendo Moodle${STREAM_TAIL}</p>`;
    return;
  }
  if (PARTIAL_PROGRAM.test(clean)) {
    if (renderPartialProgram(mount, clean)) return;
    mount.innerHTML = `<p class="stream-placeholder">Diseñando la respuesta${STREAM_TAIL}</p>`;
    return;
  }
  card.classList.remove("card-ui");
  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const marked = lines.map(
    (l, i) => escapeHTML(l) + (i === lines.length - 1 ? STREAM_TAIL : ""),
  );
  card.innerHTML = `<p class="short">${marked[0] || `Escribiendo${STREAM_TAIL}`}</p><div class="api-answer">${marked
    .slice(1)
    .map((l) => `<p>${l}</p>`)
    .join("")}</div>`;
}

/* ---------- Render ---------- */
