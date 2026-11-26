import { $, escapeHTML, icon, uid } from '../core/dom.js';
import { S, STORAGE_KEY, busy, conversations, currentId, editingId, getMoodle, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from '../core/state.js';
export const current = () => S.conversations.find((c) => c.id === S.currentId);

/* ---------- Mensajes en árbol: cada mensaje puede tener ramas ---------- */
export const nodesOf = (conv) => (conv ? conv.nodes || (conv.nodes = []) : []);
export const nodeById = (id, conv = current()) =>
  nodesOf(conv).find((n) => n.id === id);
export const childNodes = (id, conv = current()) =>
  nodesOf(conv).filter((n) => n.parentId === id);
export function branchSiblings(node, conv = current()) {
  if (!node) return [];
  return nodesOf(conv).filter(
    (n) => n.parentId === node.parentId && n.role === node.role,
  );
}
export function lastLeaf(node, conv = current()) {
  let leaf = node;
  let kids = childNodes(leaf.id, conv);
  while (kids.length) {
    leaf = kids[kids.length - 1];
    kids = childNodes(leaf.id, conv);
  }
  return leaf;
}
export function activePath(conv = current()) {
  if (!conv) return [];
  const byId = new Map(nodesOf(conv).map((n) => [n.id, n]));
  const path = [];
  let node = byId.get(conv.activeLeafId);
  while (node) {
    path.unshift(node);
    node = node.parentId ? byId.get(node.parentId) : null;
  }
  return path;
}
export function addNode(node, parentId = undefined) {
  const conv = current();
  const parent =
    parentId === undefined ? (conv?.activeLeafId ?? null) : parentId;
  const n = { id: uid(), parentId: parent, ...node };
  nodesOf(conv).push(n);
  conv.activeLeafId = n.id;
  return n;
}

/* ---------- Estado vacío: saludo y acciones rápidas variables ---------- */
export const WELCOMES = [
  "¡Hola! Soy Clan IA, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
  "¡Qué gusto verte! Pregúntame lo que necesites saber de la cohorte.",
  "Estoy aquí para ayudarte con sesiones, entregas, actividades y proyectos. ¿Por dónde empezamos?",
  "¡Hola! Cuéntame qué necesitas y lo busco en los materiales de la cohorte.",
  "Listo para ayudarte: tengo a mano el calendario, las actividades y las guías del proyecto.",
];
export const MOODLE_QUICK_ACTIONS = [
  { q: "¿Qué hora es y en qué zona horaria estoy?", icon: "schedule" },
  { q: "¿Qué dispositivo estoy usando?", icon: "smartphone" },
  { q: "¿Qué eventos tengo en el calendario de Moodle?", icon: "calendar_month" },
  { q: "¿Cuál es mi próxima actividad en Moodle?", icon: "schedule" },
  { q: "¿Qué tareas tengo pendientes en Moodle?", icon: "assignment" },
  { q: "Ver mis materiales de Moodle", icon: "school" },
];
export const QUICK_ACTIONS = [
  { q: "¿Qué hora es y en qué zona horaria estoy?", icon: "schedule" },
  { q: "¿Qué dispositivo estoy usando?", icon: "smartphone" },
  { q: "¿Cuándo es la próxima sesión de IA?", icon: "calendar_month" },
  { q: "¿Cuándo es la próxima clase de IA?", icon: "schedule" },
  { q: "¿Cuándo se entrega el proyecto?", icon: "flag" },
  { q: "¿Cuál es la fecha límite del proyecto?", icon: "event" },
  { q: "¿Qué actividades tengo pendientes?", icon: "check_circle" },
  { q: "¿Qué tareas debo entregar esta semana?", icon: "assignment" },
  { q: "¿Dónde encuentro los materiales de estudio?", icon: "menu_book" },
  { q: "¿Dónde están las grabaciones de las clases?", icon: "videocam" },
  { q: "¿Cómo puedo hablar con el TL (Team Leader)?", icon: "groups" },
];
export const randomIndex = (n) => Math.floor(Math.random() * n);
export function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export const welcomePicks = new Map();
export function welcomePick() {
  const conv = current();
  /* Cada conversación nueva estrena saludo y acciones; las existentes conservan los suyos */
  if (conv && !welcomePicks.has(conv.id)) {
    welcomePicks.set(conv.id, {
      greeting: WELCOMES[randomIndex(WELCOMES.length)],
      actions: shuffled(QUICK_ACTIONS).slice(0, 4),
    });
  }
  return conv
    ? welcomePicks.get(conv.id)
    : {
        greeting: WELCOMES[randomIndex(WELCOMES.length)],
        actions: shuffled(QUICK_ACTIONS).slice(0, 4),
      };
}
export function renderWelcome() {
  const pick = welcomePick();
  const title = $("#welcomeTitle");
  const suggestions = $("#suggestions");
  if (title)
    title.textContent = getMoodle().token
      ? "¡Hola! Pregúntame por tus cursos, materiales o fechas en Moodle."
      : pick.greeting;
  if (suggestions) {
    const actions = getMoodle().token ? MOODLE_QUICK_ACTIONS : pick.actions;
    suggestions.innerHTML = actions
      .map(
        (a) =>
          `<button class="chip" data-q="${escapeHTML(a.q)}"><span class="ico"><span class="ic lg">${a.icon}</span></span>${escapeHTML(a.q)}</button>`,
      )
      .join("");
  }
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S.conversations));
  } catch (e) {}
}
export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) S.conversations = JSON.parse(raw);
  } catch (e) {
    S.conversations = [];
  }
  /* Los chats guardados antes de las ramas se convierten a una sola rama lineal */
  S.conversations.forEach((c) => {
    if (!Array.isArray(c.nodes) && Array.isArray(c.messages)) {
      let parentId = null;
      c.nodes = c.messages.map((m) => {
        const n = { ...m, id: uid(), parentId };
        parentId = n.id;
        return n;
      });
      c.activeLeafId = parentId;
      delete c.messages;
    }
    if (!Array.isArray(c.nodes)) c.nodes = [];
  });
}
