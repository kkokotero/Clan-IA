/* =========================================================
   Ritchie AI — Lógica (demostración)
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
const SETTINGS_KEY = "ritchie-ia-config-ia"; /* la key vive SOLO en este navegador */

/* ---------- Proveedores gratuitos (llamada directa desde el navegador) ---------- */
const PROVIDERS = {
  gemini: {
    label: "Google Gemini",
    defaultModel: "gemini-4-hydrogen",
    help: "Key gratis en aistudio.google.com/apikey. Estos dos modelos están en el plan gratuito; 3.8/3.6 Flash daban 503 y ya no se ofrecen.",
    models: [
      { value: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen (recomendado, gratis)" },
      { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (rápido, gratis)" },
    ],
  },
  openrouter: {
    label: "OpenRouter",
    defaultModel: "openrouter/free",
    help: "Key gratis en openrouter.ai/keys. Lista de modelos :free vigente (nov 2026); 'openrouter/free' elige uno disponible.",
    models: [
      { value: "openrouter/free", label: "OpenRouter Free (recomendado)" },
      { value: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra" },
      { value: "baidu/ernie-5.5-flash-preview:free", label: "ERNIE 5.5 Flash Preview" },
      { value: "nvidia/nemotron-3.5-super-vl:free", label: "Nemotron 3.5 Super VL" },
      { value: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning" },
      { value: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B" },
      { value: "inclusionai/ling-3.2-flash:free", label: "Ling 3.2 Flash" },
    ],
  },
};

const SYSTEM_PROMPT = `Eres Ritchie AI, el asistente educativo de la cohorte Ritchie en Riwi.
Responde SOLO con información de los siguientes documentos de la cohorte.
Si la respuesta no está en estos documentos, responde exactamente con la palabra: NO_SE

FORMATO DE RESPUESTA (OpenUI Lang):
1. Responde SOLO con un programa válido de OpenUI Lang: sentencias "nombre = Componente(...)",
   una por línea, con "root" como entrada. No escribas markdown ni texto fuera del programa.
2. Usa Card como raíz. TextContent para el resumen; Steps, Table o ListBlock para el detalle.
   No añadas bloques de fuente ni notas de autonomía: muestra solo la respuesta desarrollada.
3. Si la respuesta no está en los documentos, responde exactamente con la palabra: NO_SE.
4. Nunca inventes datos. Nunca menciones APIs, claves ni tecnología interna.

REGLAS DE ÉTICA Y PRIVACIDAD (obligatorias):
5. PRIVACIDAD: Nunca solicites datos personales (correo, celular, cédula, datos de salud). Si el usuario los comparte, ignóralos y no los repitas. Nunca incluyas correos, teléfonos, números de identificación ni datos médicos en tu respuesta.
6. SESGOS: Responde de manera equitativa. Ante casos iguales, da respuestas iguales sin importar quién pregunte. Si tu respuesta difiere para un caso similar, explica claramente la razón.
7. SIN FUENTES: No menciones los nombres de los documentos, sus archivos ni ninguna sección "Sources"/"Fuente". No uses los componentes Sources ni CardSourceProvider. Usa la información sin citarla.
8. TRANSPARENCIA IA: No lo aclares en el texto; la interfaz ya lo indica.
9. AUTONOMÍA: Tu rol es INFORMAR, nunca decidir por el usuario. No añadas notas sobre quién decide.

DOCUMENTOS DE LA COHORTE:

--- Calendario de la cohorte ---
Próxima sesión de IA: Jueves 26 de noviembre de 2026, 6:00 p.m., virtual. Tema: Introducción a los modelos de lenguaje.
Actividades pendientes:
  - Taller de prompts: vence el 27 de noviembre
  - Reflexión de la sesión 8: vence el 29 de noviembre
  - Avance del proyecto: vence el 1 de diciembre

--- Guía del proyecto ---
Fecha límite de entrega del proyecto: viernes 4 de diciembre de 2026, hasta las 11:59 p.m.
Cómo entregar: cargar el enlace del repositorio en la plataforma de la cohorte.

--- Carpeta de materiales ---
Contenido disponible: presentaciones de cada sesión, grabaciones de las clases, guías y plantillas para el proyecto.
Acceso: carpeta compartida de la cohorte.`;

/* El bundle de OpenUI genera la especificación completa del lenguaje a partir de su librería.
   Si el CDN no cargó, usamos una versión mínima para que la app siga funcionando. */
function buildSystemPrompt() {
  const lib = window.__OpenUI && window.__OpenUI.openuiChatLibrary;
  if (lib && typeof lib.prompt === "function") {
    return lib.prompt({
      preamble: SYSTEM_PROMPT,
      examples: [
        `root = Card([title, detail, steps])
title = TextContent("Próxima sesión de IA", "large-heavy")
detail = TextContent("Jueves 26 de noviembre de 2026, 6:00 p.m. (hora de Colombia), virtual.", "default")
steps = Steps([s1, s2])
s1 = StepsItem("Tema", "Introducción a los modelos de lenguaje")
s2 = StepsItem("Modalidad", "Virtual, con materiales en la carpeta de la cohorte")`,
        `root = Card([title, tbl])
title = TextContent("Actividades pendientes", "large-heavy")
tbl = Table([Col("Actividad", acts), Col("Vencimiento", dates)])
acts = ["Taller de prompts", "Reflexión de la sesión 8", "Avance del proyecto"]
dates = ["27 de noviembre", "29 de noviembre", "1 de diciembre"]`,
      ],
      additionalRules: [
        "Responde en español neutro con detalle y claridad: desarrolla cada dato con contexto útil, no des solo una frase. Objetivo: 120 a 250 palabras cuando el tema lo permita.",
        "Usa siempre OpenUI Lang con varios componentes: Card como raíz, TextContent para el resumen y Steps, Table o ListBlock para el detalle. Aprovecha todos los datos disponibles del documento.",
        "Nunca pidas datos personales ni los repitas en el programa.",
        "No uses Sources, CardSourceProvider ni ninguna lista de fuentes. No escribas la palabra 'Fuente' ni nombres de archivos PDF. Usa los datos sin citarlos.",
        "No uses acciones, formularios ni consultas: solo componentes de contenido.",
        "No incluyas bloques de código markdown: devuelve únicamente el programa OpenUI Lang.",
      ],
    });
  }
  return SYSTEM_PROMPT + "\n\nFormato OpenUI Lang: una sentencia por línea; root = Card([...]); usa TextContent, Steps, ListBlock y Callout. Desarrolla la respuesta con detalle (120-250 palabras) y no incluyas fuentes.";
}

const SOURCE_MAP = {
  "calendario de la cohorte": { label: "Calendario de la cohorte", file: "calendario-cohorte-demo.pdf" },
  "guia del proyecto": { label: "Guía del proyecto", file: "guia-proyecto-demo.pdf" },
  "carpeta de materiales": { label: "Carpeta de materiales", file: "materiales-cohorte-demo.pdf" },
};

/* Si el navegador bloquea localStorage (algunos file://), la key al menos dura la sesión */
let memorySettings = null;

function normalizeSettings(s) {
  const provider = PROVIDERS[s && s.provider] ? s.provider : "gemini";
  const model = typeof s?.model === "string" && s.model.trim()
    ? s.model.trim() : PROVIDERS[provider].defaultModel;
  return { provider, apiKey: typeof s?.apiKey === "string" ? s.apiKey.trim() : "", model };
}
function getSettings() {
  const fallback = normalizeSettings({});
  if (memorySettings) return normalizeSettings(memorySettings);
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : fallback;
  } catch (e) { return fallback; }
}
function saveSettings(s) {
  memorySettings = normalizeSettings(s);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(memorySettings)); } catch (e) {}
}
function clearSettings() {
  memorySettings = null;
  try { localStorage.removeItem(SETTINGS_KEY); } catch (e) {}
}

const icon = (name, cls = "") => `<span class="ic ${cls}">${name}</span>`;
const LOGO_MINI = `<div class="logo-tile mini" aria-hidden="true"><span class="logo">cruelty_free</span></div>`;

const facts = (rows) =>
  `<ul class="facts">${rows.map(([ic, label, value]) =>
    `<li><span class="fi">${icon(ic)}</span><span class="ft"><b>${label}</b><span>${value}</span></span></li>`).join("")}</ul>`;

/* ---------- PII: detección y redacción de datos personales ---------- */
const PII_PATTERNS = [
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, label: "[correo oculto]" },
  { regex: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g, label: "[teléfono oculto]" },
  { regex: /\b\d{6,10}\b/g, label: "[documento oculto]" },
];
function redactPII(text) {
  let cleaned = text;
  PII_PATTERNS.forEach(({ regex, label }) => { cleaned = cleaned.replace(new RegExp(regex.source, regex.flags), label); });
  return cleaned;
}
function containsPII(text) {
  return PII_PATTERNS.some(({ regex }) => new RegExp(regex.source, regex.flags).test(text));
}

/* ---------- Base de conocimiento DEMO (datos ficticios) ---------- */
const KNOWLEDGE = [
  {
    short: "Jueves 26 de noviembre, 6:00 p. m., virtual.",
source: { label: "Calendario de la cohorte", file: "calendario-cohorte-demo.pdf" },
keywords: ["sesion", "clase de ia", "proxima clase", "proxima sesion", "horario", "cuando es la clase"],
    html: `<h3>Próxima sesión de IA</h3>` + facts([
      ["calendar_month", "Fecha", "Jueves 26 de noviembre de 2026"],
      ["schedule", "Hora", "6:00 p. m. (hora de Colombia)"],
      ["monitor", "Modalidad", "Virtual"],
      ["lightbulb", "Tema", "Introducción a los modelos de lenguaje"],
    ]),
  },
  {
    short: "Hasta el viernes 4 de diciembre, 11:59 p. m.",
source: { label: "Guía del proyecto", file: "guia-proyecto-demo.pdf" },
keywords: ["proyecto", "entrega", "fecha de entrega", "fecha limite", "entregar", "deadline"],
    html: `<h3>Entrega del proyecto</h3>` + facts([
      ["flag", "Fecha límite", "Viernes 4 de diciembre de 2026"],
      ["schedule", "Hora", "Hasta las 11:59 p. m."],
      ["upload", "Cómo entregar", "Carga el enlace de tu repositorio en la plataforma de la cohorte"],
    ]),
  },
  {
    short: "Tienes 3 pendientes; la más próxima vence el 27 de noviembre.",
source: { label: "Calendario de la cohorte", file: "calendario-cohorte-demo.pdf" },
keywords: ["actividad", "pendiente", "tarea", "taller", "reto"],
    html: `<h3>Actividades pendientes</h3>` + facts([
      ["check_circle", "Taller de prompts", "Vence el 27 de noviembre"],
      ["check_circle", "Reflexión de la sesión 8", "Vence el 29 de noviembre"],
      ["check_circle", "Avance del proyecto", "Vence el 1 de diciembre"],
    ]),
  },
  {
    short: "En la carpeta de la cohorte: presentaciones, grabaciones y guías.",
source: { label: "Carpeta de materiales", file: "materiales-cohorte-demo.pdf" },
keywords: ["material", "recurso", "estudio", "documento", "apuntes", "diapositiva", "grabacion", "donde encuentro"],
    html: `<h3>Materiales de estudio</h3><p class="muted">Encuentras todo en la carpeta de la cohorte:</p>` + facts([
      ["layers", "Presentaciones", "De cada sesión"],
      ["videocam", "Grabaciones", "De las clases"],
      ["description", "Guías y plantillas", "Para el proyecto"],
    ]),
  },
  {
    keywords: ["coach", "contacto", "hablar con una persona"],
    html: `<h3>Hablar con una persona</h3><p>Un coach puede ayudarte con lo que Ritchie AI no puede resolver. Usa el botón <b>Hablar con un coach</b> de la barra lateral.</p>`,
    noSource: true,
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
  "calificacion", "mis notas", "mi nota", "promedio", "aprobar", "reprob", "perder el curso",
  "situacion personal", "problema personal", "asunto personal", "familia", "problema con mi", "acoso", "maltrato", "abuso", "violencia",
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
  // Gana el tema con la palabra clave más específica (más larga), no el primero de la lista.
  let hit = null, best = 0;
  KNOWLEDGE.forEach((k) => k.keywords.forEach((kw) => { if (q.includes(kw) && kw.length > best) { best = kw.length; hit = k; } }));
  if (hit) return { type: "answer", html: hit.html, short: hit.short, source: hit.source, noSource: hit.noSource };
  return { type: "error" };
}

/* ---------- IA gratuita: el navegador llama directamente al proveedor ---------- */
async function callGemini(question, settings, system) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: question }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2500 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("") || "";
  if (!text.trim()) throw new Error("el modelo devolvió una respuesta vacía");
  return text;
}

async function callOpenRouter(question, settings, system) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`,
      "HTTP-Referer": (typeof location !== "undefined" && location.origin) || "https://localhost",
      "X-Title": "Ritchie AI",
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
      ],
      temperature: 0.3,
      max_tokens: 2500,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text.trim()) throw new Error("el modelo devolvió una respuesta vacía");
  return text;
}

/* Detecta el documento citado en la respuesta OpenUI Lang */
function detectSource(text) {
  const key = normalize(text);
  for (const [pattern, val] of Object.entries(SOURCE_MAP)) {
    if (key.includes(pattern)) return val;
  }
  return null;
}

function cleanResponse(raw) {
  // Algunos modelos envuelven el programa en bloques ```; los quitamos antes de renderizar.
  return redactPII(raw)
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

function resultFromText(clean, question) {
  if (/^\s*NO_SE\s*$/i.test(clean)) {
    return { type: "error", question,
      message: "No tengo información suficiente en los documentos de la cohorte para responder eso. Prueba a reformular la pregunta." };
  }
  const isProgram = /(^|\n)\s*[A-Za-z_$][\w$]*\s*=\s*[A-Za-z_$]/.test(clean);
  if (isProgram && window.__OpenUI && window.__OpenUI.Renderer && window.__OpenUI.createRoot) {
    return { type: "openui", response: clean };
  }
  /* Sin CDN: respuesta legible en texto para no perder funcionalidad */
  const sourceMatch = clean.match(/FUENTE:\s*(.+)$/im);
  const bodyText = sourceMatch ? clean.slice(0, sourceMatch.index).trim() : clean;
  const lines = bodyText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const short = lines[0] || "";
  const detailHTML = lines.slice(1)
    .map((l) => `<p>${escapeHTML(l.replace(/^[-•*]\s*/, ""))}</p>`).join("");
  return { type: "answer", short, html: `<div class="api-answer">${detailHTML}</div>` };
}

async function askAI(question, settings) {
  const system = buildSystemPrompt();
  const models = PROVIDERS[settings.provider].models.map((m) => m.value);
  const ordered = [settings.model, ...models.filter((m) => m !== settings.model)].filter(Boolean);
  let raw = "";
  let lastError = null;

  /* Si el modelo está saturado (503/429) probamos con el siguiente gratuito de la lista */
  for (const model of ordered) {
    try {
      raw = settings.provider === "openrouter"
        ? await callOpenRouter(question, { ...settings, model }, system)
        : await callGemini(question, { ...settings, model }, system);
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      const retryable = /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|overload|high demand/i.test(err.message || "");
      if (!retryable) break;
    }
  }
  if (lastError) throw lastError;
  return resultFromText(cleanResponse(raw), question);
}

/* ---------- Respuesta en tiempo real (SSE) ---------- */
async function readSSE(res, onData) {
  if (!res.body || !res.body.getReader) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try { onData(JSON.parse(payload)); } catch (e) { /* evento incompleto */ }
    }
  }
}

async function streamGemini(question, settings, system, onChunk) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(settings.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: question }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2500 },
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  let text = "";
  await readSSE(res, (data) => {
    const chunk = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("") || "";
    if (chunk) { text += chunk; onChunk(text); }
  });
  return text;
}

async function streamOpenRouter(question, settings, system, onChunk) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`,
      "HTTP-Referer": (typeof location !== "undefined" && location.origin) || "https://localhost",
      "X-Title": "Ritchie AI",
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
      ],
      temperature: 0.3,
      max_tokens: 2500,
      stream: true,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  let text = "";
  await readSSE(res, (data) => {
    const chunk = data?.choices?.[0]?.delta?.content || "";
    if (chunk) { text += chunk; onChunk(text); }
  });
  return text;
}

async function streamAI(question, settings, onChunk) {
  const system = buildSystemPrompt();
  const models = PROVIDERS[settings.provider].models.map((m) => m.value);
  const ordered = [settings.model, ...models.filter((m) => m !== settings.model)].filter(Boolean);
  let lastError = null;
  for (const model of ordered) {
    try {
      const s = { ...settings, model };
      const raw = settings.provider === "openrouter"
        ? await streamOpenRouter(question, s, system, onChunk)
        : await streamGemini(question, s, system, onChunk);
      if (raw) return raw;
    } catch (err) {
      lastError = err;
      const retryable = /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|overload|high demand/i.test(err.message || "");
      if (!retryable) break;
      onChunk(""); // descarta el partial del modelo caído
    }
  }
  if (lastError) throw lastError;
  return "";
}

/* ---------- Render de OpenUI (bundle oficial cargado por CDN) ---------- */
const openUIRoots = new Map();

function mountOpenUI(wrap, response) {
  const sdk = window.__OpenUI;
  const mount = wrap && wrap.querySelector(".openui-mount");
  if (!sdk || !mount || typeof response !== "string") return false;
  try {
    const root = sdk.createRoot(mount);
    root.render(sdk.React.createElement(sdk.Renderer, {
      response,
      library: sdk.openuiChatLibrary,
    }));
    openUIRoots.set(mount, root);
    return true;
  } catch (err) {
    console.error("OpenUI no pudo renderizar:", err);
    mount.textContent = "No se pudo dibujar la interfaz generada.";
    return false;
  }
}

/* Vuelve a dibujar la interfaz mientras llegan tokens del stream */
function updateOpenUI(wrap, response) {
  const sdk = window.__OpenUI;
  const mount = wrap && wrap.querySelector(".openui-mount");
  const root = mount && openUIRoots.get(mount);
  if (!sdk || !root) return false;
  root.render(sdk.React.createElement(sdk.Renderer, {
    response,
    library: sdk.openuiChatLibrary,
  }));
  return true;
}

function unmountWrap(wrap) {
  const mount = wrap && wrap.querySelector(".openui-mount");
  const root = mount && openUIRoots.get(mount);
  if (root) {
    try { root.unmount(); } catch (e) {}
    openUIRoots.delete(mount);
  }
}

function unmountOpenUI() {
  openUIRoots.forEach((root) => { try { root.unmount(); } catch (e) {} });
  openUIRoots.clear();
}

/* ---------- Plantillas ---------- */
function cardHTML(msg) {
  if (msg.type === "openui") {
    return `<div class="card card-openui"><div class="card-head"><span class="who">Ritchie AI</span></div><div class="openui-mount"></div></div>`;
  }
  if (msg.type === "answer") {
    const badge = msg.noSource ? "" : `<span class="badge badge-demo">Datos ficticios de ejemplo · no es información oficial</span>`;
    const aiBadge = `<span class="badge badge-ia">Esta información fue generada por IA — puede contener errores. Verifica siempre con fuentes oficiales.</span>`;
    return `<div class="card"><div class="card-head"><span class="who">Ritchie AI</span>${badge}${aiBadge}</div>${msg.short ? `<p class="short">${msg.short}</p>` : ""}${msg.html}</div>`;
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
        <p>${escapeHTML(msg.message || "No tengo información suficiente para responder esa pregunta con seguridad. Puedes reformularla con otras palabras o hablar con una persona.")}</p>
      </div>
    </div>
    <div class="actions">
      <button class="btn btn-filled" data-action="rephrase" data-q="${escapeHTML(msg.question || "")}">${icon("edit")}Reformular la pregunta</button>
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
  if (msg.type === "openui") mountOpenUI(wrap, msg.response);
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
  unmountOpenUI();
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
  // Redactar datos personales del input del usuario antes de mostrar
  const safeQuestion = redactPII(question);
  const userMsg = { role: "user", text: safeQuestion };
  conv.messages.push(userMsg);
  appendMessage(userMsg);
  renderHistory();
  // Avisar si se detectaron datos personales
  if (containsPII(question)) {
    const piiWarn = { role: "bot", type: "answer", noSource: true,
      html: `<div class="pii-warning">${icon("security", "lg")} <div><b>Protección de datos personales</b><p>Hemos detectado datos personales en tu mensaje. Por tu seguridad, fueron ocultados automáticamente. Ritchie AI nunca solicita ni almacena datos personales.</p></div></div>` };
    conv.messages.push(piiWarn);
    appendMessage(piiWarn);
  }
  respond(safeQuestion);
}

function finishResponse(result, wrap, question) {
  if (typeof result.short === "string") result.short = redactPII(result.short);
  if (typeof result.html === "string") result.html = redactPII(result.html);
  const botMsg = { role: "bot", ...result, question };
  if (wrap) {
    unmountWrap(wrap);
    wrap.innerHTML = LOGO_MINI + cardHTML(result);
    if (result.type === "openui") mountOpenUI(wrap, result.response);
  } else {
    appendMessage(botMsg);
  }
  current().messages.push(botMsg);
  save();
  busy = false;
  updateSend();
  input.focus();
}

async function respond(question) {
  busy = true;
  updateSend();
  showThinking();
  let result;
  let wrap = null;
  try {
    const settings = getSettings();
    const q = normalize(question);
    if (SENSITIVE.some((k) => q.includes(k))) {
      result = { type: "safety" };
    } else if (settings.apiKey) {
      hideThinking();
      const useOpenUI = !!(window.__OpenUI && window.__OpenUI.Renderer && window.__OpenUI.createRoot);
      wrap = appendMessage({ role: "bot",
        type: useOpenUI ? "openui" : "answer", response: "", short: "", html: "" });
      try {
        /* La interfaz se va dibujando con cada token que llega */
        const text = await streamAI(question, settings, (partial) => {
          if (useOpenUI) {
            updateOpenUI(wrap, partial);
          } else {
            const card = wrap.querySelector(".card");
            if (card) {
              const lines = cleanResponse(partial).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
              card.innerHTML = `<p class="short">${escapeHTML(lines[0] || "Pensando...")}</p><div class="api-answer">${lines.slice(1).map((l) => `<p>${escapeHTML(l)}</p>`).join("")}</div>`;
            }
          }
        });
        result = resultFromText(cleanResponse(text), question);
      } catch (err) {
        /* Si el proveedor no soporta streaming, usamos la llamada normal */
        try { result = await askAI(question, settings); }
        catch (e2) {
          result = { type: "error", question,
            message: `No se pudo conectar con ${PROVIDERS[settings.provider].label}: ${e2.message || "error desconocido"}. Revisa la key y el modelo en Configurar IA.` };
        }
      }
    } else {
      // Sin key: el asistente responde con el motor local de demostración
      result = resolveAnswer(question);
    }
  } catch (err) {
    result = { type: "error", question,
      message: `No se pudo conectar con ${PROVIDERS[getSettings().provider].label}: ${err.message || "error desconocido"}. Revisa la key y el modelo en Configurar IA.` };
  }
  hideThinking();
  finishResponse(result, wrap, question);
}

function updateSend() { sendBtn.disabled = busy || !input.value.trim(); }

/* ---------- Estado de conexión con la IA (según la key guardada) ---------- */
function refreshAIStatus() {
  const settings = getSettings();
  const status = $("#aiStatus");
  const text = $("#aiStatusText");
  const profileStatus = $("#profileStatus");
  const mobileAvatar = $("#mobileAvatar");
  const notice = $("#aiOffNotice");
  const label = PROVIDERS[settings.provider].label;
  if (settings.apiKey) {
    if (status) status.hidden = false;
    if (status && text) {
      status.dataset.state = "online";
      text.textContent = `IA activa · ${label}`;
      status.title = `Modelo ${settings.model}. La key se guarda solo en este navegador.`;
    }
    if (notice) notice.hidden = true;
    if (profileStatus) profileStatus.textContent = `IA activa · ${label}`;
    if (mobileAvatar) { mobileAvatar.dataset.online = "true"; mobileAvatar.title = `IA activa · ${label}`; }
  } else {
    /* Sin key: se retira el estado del lateral y el aviso vive en la página */
    if (status) status.hidden = true;
    if (notice) notice.hidden = false;
    if (profileStatus) profileStatus.textContent = "Configurar IA (local)";
    if (mobileAvatar) { mobileAvatar.dataset.online = "false"; mobileAvatar.title = "Configurar IA (local)"; }
  }
}

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
  [menuToggle, $("#mobileMenuBtn")].forEach((btn) => {
    if (!btn) return;
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  });
}

/* En escritorio el panel permanece; en móvil se cierra el desplegable superior. */
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
  if (act.dataset.action === "rephrase") {
    input.value = act.dataset.q;
    autoGrow(); updateSend();
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
});

$("#coachBtnSide").addEventListener("click", () => { closeMenu(); openModal("coachModal"); });
$("#helpBtn").addEventListener("click", () => { closeMenu(); openModal("helpModal"); });
$("#helpToCoach").addEventListener("click", () => { closeModals(); openModal("coachModal"); });

/* ---------- Configuración de la IA gratuita ---------- */
const providerSel = $("#aiProvider");
const keyInput = $("#aiKey");
const modelSelect = $("#aiModel");
const customInput = $("#aiModelCustom");
const customField = $("#customModelField");
const helpText = $("#aiHelp");

/* Llena el desplegable con los modelos gratuitos del proveedor elegido */
function populateModels(provider, selected) {
  const p = PROVIDERS[provider] || PROVIDERS.gemini;
  modelSelect.innerHTML = p.models
    .map((m) => `<option value="${escapeHTML(m.value)}">${escapeHTML(m.label)}</option>`)
    .join("") + `<option value="__custom__">Otro (escribir ID)</option>`;
  const known = p.models.some((m) => m.value === selected);
  modelSelect.value = known ? selected : "__custom__";
  customInput.value = known ? "" : (selected || "");
  customField.hidden = known;
}

function readModel() {
  const provider = PROVIDERS[providerSel.value] ? providerSel.value : "gemini";
  return modelSelect.value === "__custom__"
    ? (customInput.value.trim() || PROVIDERS[provider].defaultModel)
    : modelSelect.value;
}

function openSettings() {
  const s = getSettings();
  providerSel.value = s.provider;
  keyInput.value = s.apiKey;
  populateModels(s.provider, s.model);
  helpText.textContent = PROVIDERS[s.provider].help;
  openModal("settingsModal");
}
/* El perfil del usuario es la entrada a la configuración local de la IA */
$("#profileBtn").addEventListener("click", () => { closeMenu(); openSettings(); });

providerSel.addEventListener("change", () => {
  const provider = PROVIDERS[providerSel.value] ? providerSel.value : "gemini";
  populateModels(provider, PROVIDERS[provider].defaultModel);
  helpText.textContent = PROVIDERS[provider].help;
});

modelSelect.addEventListener("change", () => {
  customField.hidden = modelSelect.value !== "__custom__";
  if (!customField.hidden) customInput.focus();
});

$("#settingsForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const provider = PROVIDERS[providerSel.value] ? providerSel.value : "gemini";
  saveSettings({ provider, apiKey: keyInput.value.trim(), model: readModel() });
  refreshAIStatus();
  closeModals();
});

$("#aiClear").addEventListener("click", () => {
  clearSettings();
  keyInput.value = "";
  providerSel.value = "gemini";
  populateModels("gemini", PROVIDERS.gemini.defaultModel);
  helpText.textContent = PROVIDERS.gemini.help;
  refreshAIStatus();
});

/* Prueba rápida: usa la key escrita sin guardarla todavía */
$("#aiTest").addEventListener("click", async () => {
  const provider = PROVIDERS[providerSel.value] ? providerSel.value : "gemini";
  const settings = {
    provider,
    apiKey: keyInput.value.trim(),
    model: readModel(),
  };
  if (!settings.apiKey) {
    helpText.textContent = "Pega una API key gratuita para probar la conexión.";
    return;
  }
  const btn = $("#aiTest");
  btn.disabled = true;
  helpText.textContent = "Probando conexión…";
  try {
    await askAI("¿Cuándo es la próxima sesión de IA?", settings);
    helpText.textContent = "✔ Conexión correcta. Guarda para usarla en este navegador.";
  } catch (err) {
    helpText.textContent = `✘ ${err.message || "No se pudo conectar"}`;
  } finally {
    btn.disabled = false;
  }
});

document.querySelectorAll(".modal").forEach((m) =>
  m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-close]")) closeModals(); })
);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModals(); closeMenu(); } });

function startNewChat() {
  if (busy) return;
  currentId = null;
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
$("#mobileMenuBtn").addEventListener("click", () => setMenu(app.dataset.menu !== "open"));
$("#mobileProfileBtn").addEventListener("click", () => { closeMenu(); openSettings(); });
$("#aiOffConfigBtn").addEventListener("click", () => { closeMenu(); openSettings(); });
$("#scrim").addEventListener("click", () => setMenu(false));
menuQuery.addEventListener("change", (e) => setMenu(!e.matches));

/* ---------- Inicio ---------- */
setMenu(!menuQuery.matches);
load();
renderHistory();
renderChat();
refreshAIStatus();
