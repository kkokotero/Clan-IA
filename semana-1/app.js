/* =========================================================
   Ritchie AI · Clan IA — Lógica (demostración)
   Todas las respuestas son simuladas con datos FICTICIOS.
   ========================================================= */
const $ = (sel) => document.querySelector(sel);
const app = $("#app");
const chat = $("#chat");
const welcome = $("#welcome");
const messagesEl = $("#messages");
const form = $("#form");
const input = $("#input");
const sendBtn = $("#send");
const historyEl = $("#history");

const STORAGE_KEY = "ritchie-ia-historial";
const SOURCE_FILE = "calendario-cohorte-demo.pdf";

const icon = (name, cls = "") => `<span class="ic ${cls}">${name}</span>`;
const LOGO_MINI = `<div class="logo-tile mini" aria-hidden="true"><span class="logo">cruelty_free</span></div>`;

const facts = (rows) =>
  `<ul class="facts">${rows.map(([ic, label, value]) =>
    `<li><span class="fi">${icon(ic)}</span><span class="ft"><b>${label}</b><span>${value}</span></span></li>`).join("")}</ul>`;

/* ---------- Base de conocimiento DEMO (datos ficticios) ---------- */
const KNOWLEDGE = [
  {
    keywords: ["sesion", "clase de ia", "proxima clase", "proxima sesion", "horario", "cuando es la clase"],
    html: `<h3>Próxima sesión de IA</h3>` + facts([
      ["calendar_month", "Fecha", "Jueves 26 de noviembre de 2026"],
      ["schedule", "Hora", "6:00 p. m. (hora de Colombia)"],
      ["monitor", "Modalidad", "Virtual"],
      ["lightbulb", "Tema", "Introducción a los modelos de lenguaje"],
    ]),
  },
  {
    keywords: ["proyecto", "entrega", "fecha de entrega", "entregar", "deadline"],
    html: `<h3>Entrega del proyecto</h3>` + facts([
      ["flag", "Fecha límite", "Viernes 4 de diciembre de 2026"],
      ["schedule", "Hora", "Hasta las 11:59 p. m."],
      ["upload", "Cómo entregar", "Carga el enlace de tu repositorio en la plataforma de la cohorte"],
    ]),
  },
  {
    keywords: ["actividad", "pendiente", "tarea", "taller", "reto"],
    html: `<h3>Actividades pendientes</h3>` + facts([
      ["check_circle", "Taller de prompts", "Vence el 27 de noviembre"],
      ["check_circle", "Reflexión de la sesión 8", "Vence el 29 de noviembre"],
      ["check_circle", "Avance del proyecto", "Vence el 1 de diciembre"],
    ]),
  },
  {
    keywords: ["material", "recurso", "estudio", "documento", "apuntes", "diapositiva", "grabacion", "donde encuentro"],
    html: `<h3>Materiales de estudio</h3><p class="muted">Encuentras todo en la carpeta de la cohorte:</p>` + facts([
      ["layers", "Presentaciones", "De cada sesión"],
      ["videocam", "Grabaciones", "De las clases"],
      ["description", "Guías y plantillas", "Para el proyecto"],
    ]),
  },
  {
    keywords: ["hola", "buenas", "buenos dias", "buenas tardes", "gracias"],
    html: `<h3>¡Hola!</h3><p>Con gusto te ayudo. Puedes preguntarme por sesiones, actividades, fechas de entrega, proyectos o materiales de estudio.</p>`,
    noSource: true,
  },
];

/* Temas sensibles: se derivan a una persona */
const SENSITIVE = [
  "salud", "enfermo", "enferma", "enfermedad", "medic", "depres", "ansiedad", "estres", "triste", "suicid",
  "calificacion", "nota ", "notas", "promedio", "aprobar", "reprob", "perder el curso",
  "personal", "familia", "problema con", "acoso", "maltrato", "abuso", "violencia",
  "expulsar", "sancionar", "despedir", "castigar", "mi compañero", "mi companero", "decidir sobre",
];

/* ---------- Estado ---------- */
let conversations = [];
let currentId = null;
let busy = false;

/* ---------- Utilidades ---------- */
const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + " ";
const escapeHTML = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const current = () => conversations.find((c) => c.id === currentId);

function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations)); } catch (e) {} }
function load() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) conversations = JSON.parse(raw); }
  catch (e) { conversations = []; }
}

/* ---------- Motor de respuesta simulado ---------- */
function resolveAnswer(question) {
  const q = normalize(question);
  if (SENSITIVE.some((k) => q.includes(k))) return { type: "safety" };
  const hit = KNOWLEDGE.find((k) => k.keywords.some((kw) => q.includes(kw)));
  if (hit) return { type: "answer", html: hit.html, noSource: hit.noSource };
  return { type: "error" };
}

/* ---------- Plantillas ---------- */
function cardHTML(msg) {
  if (msg.type === "answer") {
    const badge = msg.noSource ? "" : `<span class="badge badge-demo">Datos ficticios de ejemplo · no es información oficial</span>`;
    const source = msg.noSource ? "" : `
      <div class="source">
        <span class="src-ico">${icon("description")}</span>
        <span class="src-meta">
          <span class="src-label">Fuente: Calendario de la cohorte</span>
          <span class="src-file">${SOURCE_FILE}</span>
        </span>
        <a href="#" class="btn btn-outlined" data-doc="${SOURCE_FILE}">Consultar documento</a>
      </div>`;
    return `<div class="card"><div class="card-head"><span class="who">Ritchie AI</span>${badge}</div>${msg.html}${source}</div>`;
  }
  if (msg.type === "safety") {
    return `<div class="card is-safety">
      <div class="status-row">
        <span class="status-ico">${icon("shield", "lg")}</span>
        <div>
          <h3>Este tema requiere atención personal</h3>
          <p>Las preguntas sobre salud, calificaciones, situaciones personales delicadas o decisiones sobre otras personas no deben resolverse con un asistente de IA.</p>
          <p>Por favor, <b>consulta directamente con un coach o una persona responsable</b>. Ellos podrán ayudarte con el cuidado y la confidencialidad que mereces.</p>
        </div>
      </div>
      <div class="actions"><button class="btn btn-filled" data-action="coach">${icon("groups")}Hablar con un coach</button></div>
    </div>`;
  }
  return `<div class="card is-error">
    <div class="status-row">
      <span class="status-ico">${icon("error", "lg")}</span>
      <div>
        <h3>No encontré una respuesta</h3>
        <p>No tengo información suficiente para responder esa pregunta con seguridad.</p>
      </div>
    </div>
    <div class="actions">
      <button class="btn btn-filled" data-action="retry" data-q="${escapeHTML(msg.question || "")}">${icon("refresh")}Intentar de nuevo</button>
      <button class="btn btn-tonal" data-action="coach">${icon("groups")}Hablar con un coach</button>
    </div>
  </div>`;
}

function appendMessage(msg, animate = true) {
  const wrap = document.createElement("div");
  if (msg.role === "user") {
    wrap.className = "msg user";
    wrap.innerHTML = `<div class="user-bubble">${escapeHTML(msg.text)}</div>`;
  } else {
    wrap.className = "msg bot";
    wrap.innerHTML = LOGO_MINI + cardHTML(msg);
  }
  if (!animate) wrap.style.animation = "none";
  messagesEl.appendChild(wrap);
  scrollDown();
  return wrap;
}

function showThinking() {
  const wrap = document.createElement("div");
  wrap.className = "msg bot";
  wrap.id = "thinking";
  wrap.innerHTML = LOGO_MINI + `<div class="card"><div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span>Pensando...</span></div></div>`;
  messagesEl.appendChild(wrap);
  scrollDown();
}
const hideThinking = () => { const t = $("#thinking"); if (t) t.remove(); };
const scrollDown = () => requestAnimationFrame(() => (chat.scrollTop = chat.scrollHeight));

/* ---------- Render ---------- */
function renderHistory() {
  if (!conversations.length) {
    historyEl.innerHTML = `<p class="history-empty">Aún no hay conversaciones.</p>`;
    return;
  }
  historyEl.innerHTML = "";
  [...conversations].reverse().forEach((c) => {
    const item = document.createElement("div");
    item.className = "history-item" + (c.id === currentId ? " active" : "");
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", c.title);
    item.classList.add("tip-r");
    item.dataset.tip = c.title;
    item.tabIndex = 0;
    item.dataset.id = c.id;
    item.innerHTML = `${icon("chat", "sm")}<span>${escapeHTML(c.title)}</span><button class="history-del" data-del="${c.id}" aria-label="Eliminar conversación">${icon("delete", "sm")}</button>`;
    historyEl.appendChild(item);
  });
}

function renderChat() {
  messagesEl.innerHTML = "";
  const conv = current();
  const empty = !conv || conv.messages.length === 0;
  welcome.hidden = !empty;
  if (!empty) conv.messages.forEach((m) => appendMessage(m, false));
  else chat.scrollTop = 0;
}

/* ---------- Flujo principal ---------- */
function ask(question) {
  question = question.trim();
  if (!question || busy) return;
  if (!current()) {
    const conv = { id: uid(), title: question.slice(0, 40), messages: [] };
    conversations.push(conv);
    currentId = conv.id;
  }
  const conv = current();
  welcome.hidden = true;
  const userMsg = { role: "user", text: question };
  conv.messages.push(userMsg);
  appendMessage(userMsg);
  renderHistory();
  respond(question);
}

function respond(question) {
  busy = true;
  updateSend();
  showThinking();
  const delay = 1100 + Math.random() * 900;
  setTimeout(() => {
    hideThinking();
    const result = resolveAnswer(question);
    const botMsg = { role: "bot", ...result, question };
    current().messages.push(botMsg);
    appendMessage(botMsg);
    save();
    busy = false;
    updateSend();
    input.focus();
  }, delay);
}

function updateSend() { sendBtn.disabled = busy || !input.value.trim(); }
function autoGrow() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 140) + "px";
}

/* ---------- Modales y menú ---------- */
function openModal(id) {
  const m = document.getElementById(id);
  m.hidden = false;
  const btn = m.querySelector(".btn-filled");
  if (btn) btn.focus();
}
function closeModals() { document.querySelectorAll(".modal").forEach((m) => (m.hidden = true)); }
const menuQuery = window.matchMedia("(max-width: 900px)");
const menuToggle = $("#menuToggle");

function setMenu(open) {
  app.dataset.menu = open ? "open" : "closed";
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Plegar menú lateral" : "Desplegar menú lateral");
}

/* En escritorio solo se cierra el panel si se pidió explícitamente; en móvil vuelve al raíl. */
function closeMenu() { if (menuQuery.matches) setMenu(false); }

/* ---------- Eventos ---------- */
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = input.value;
  input.value = "";
  autoGrow();
  updateSend();
  ask(q);
});
input.addEventListener("input", () => { autoGrow(); updateSend(); });
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
});

$("#suggestions").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (chip) ask(chip.dataset.q);
});

messagesEl.addEventListener("click", (e) => {
  const doc = e.target.closest("[data-doc]");
  if (doc) {
    e.preventDefault();
    $("#docName").textContent = doc.dataset.doc;
    openModal("docModal");
    return;
  }
  const act = e.target.closest("[data-action]");
  if (!act) return;
  if (act.dataset.action === "coach") openModal("coachModal");
  if (act.dataset.action === "retry" && !busy) {
    const conv = current();
    const last = conv.messages[conv.messages.length - 1];
    if (last && last.role === "bot" && last.type === "error") {
      conv.messages.pop();
      messagesEl.lastElementChild.remove();
    }
    respond(act.dataset.q);
  }
});

$("#coachBtnSide").addEventListener("click", () => { closeMenu(); openModal("coachModal"); });
$("#helpBtn").addEventListener("click", () => { closeMenu(); openModal("helpModal"); });
$("#helpToCoach").addEventListener("click", () => { closeModals(); openModal("coachModal"); });

document.querySelectorAll(".modal").forEach((m) =>
  m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-close]")) closeModals(); })
);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModals(); closeMenu(); } });

$("#newChat").addEventListener("click", () => {
  if (busy) return;
  currentId = null;
  renderChat();
  renderHistory();
  closeMenu();
  input.focus();
});

historyEl.addEventListener("click", (e) => {
  const del = e.target.closest("[data-del]");
  if (del) {
    e.stopPropagation();
    if (busy) return;
    conversations = conversations.filter((c) => c.id !== del.dataset.del);
    if (currentId === del.dataset.del) currentId = null;
    save(); renderChat(); renderHistory();
    return;
  }
  const item = e.target.closest(".history-item");
  if (item && !busy) {
    currentId = item.dataset.id;
    renderChat(); renderHistory(); closeMenu();
  }
});
historyEl.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("history-item")) {
    e.preventDefault();
    e.target.click();
  }
});

menuToggle.addEventListener("click", () => setMenu(app.dataset.menu !== "open"));
$("#scrim").addEventListener("click", () => setMenu(false));
menuQuery.addEventListener("change", (e) => setMenu(!e.matches));

/* ---------- Inicio ---------- */
setMenu(!menuQuery.matches);
load();
renderHistory();
renderChat();
