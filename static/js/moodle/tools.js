import { renderChat, renderHistory } from '../chat/flow.js';
import { activePath, current, nodesOf, save } from '../chat/model.js';
import { $, app, chat, normalize } from '../core/dom.js';
import { compactMoodleResult, moodleCleanText } from '../core/helpers.js';
import { askConfirmation } from '../core/modals.js';
import { S, busy, conversations, currentId, editingId, getMoodle, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from '../core/state.js';
import { collectMoodleCMIds, collectMoodleURLs, moodleAllModules, moodleAllowedCourseIds, moodleCourseName, moodleDirectURL, moodleEventSummary, moodleFindModule, moodleId, moodleModuleLink, moodleRequest, moodleScalar, rememberMoodleURL } from './client.js';
import { ingestMoodleResult } from './session.js';
import { updateHistoryStats } from '../settings/settings.js';
export function moodleVerifyIndex() {
  const items = [];
  const push = (type, name, alt, url) => {
    if (!name) return;
    items.push({
      type,
      name: String(name),
      alt: (Array.isArray(alt) ? alt : []).filter(Boolean).map(String),
      url: url ? String(url) : "",
    });
  };
  S.moodleCourses.forEach((c) =>
    push("curso", c.fullname || c.shortname, [c.shortname], c.url),
  );
  S.moodleMaterials.forEach((m) =>
    push(m.kind === "actividad" ? "actividad" : "material", m.title, [m.filename], m.url),
  );
  moodleAllModules().forEach((m) =>
    push("actividad", m.name, [m.modname], moodleModuleLink(m)),
  );
  S.moodleEvents.forEach((e) =>
    push("evento", e.name, [], e.url || e.viewurl),
  );
  return items;
}
export function moodleVerifyName(query, index) {
  const q = normalize(String(query || "")).trim();
  if (!q) return null;
  const exact = index.find(
    (x) =>
      normalize(x.name) === q ||
      x.alt.some((a) => normalize(a) === q),
  );
  if (exact) return exact;
  /* Solo aceptamos coincidencias parciales si la búsqueda es suficientemente
     específica; así "IA" no se valida contra "T1.3 - IA" por azar. */
  if (q.length < 6) return null;
  return (
    index.find(
      (x) =>
        normalize(x.name).includes(q) ||
        x.alt.some((a) => normalize(a).includes(q)) ||
        (normalize(x.name).length >= 6 && q.includes(normalize(x.name))),
    ) || null
  );
}
export function moodleVerifyResult(order) {
  if (!(S.moodleContext || getMoodle().token))
    return {
      note: "Moodle no está conectado: no se pueden verificar nombres.",
      valid: [],
      invalid: [],
    };
  const raw =
    order && (order.names || order.items || order.name || order.item);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const index = moodleVerifyIndex();
  const valid = [];
  const invalid = [];
  list.slice(0, 40).forEach((value) => {
    if (typeof value !== "string" || !value.trim()) return;
    const found = moodleVerifyName(value, index);
    if (found)
      valid.push({
        pedido: value.trim(),
        real: found.name,
        tipo: found.type,
        url: found.url,
      });
    else invalid.push(value.trim());
  });
  return {
    note:
      `Verificación Moodle: válidos=${JSON.stringify(valid)}; ` +
      `NO ENCONTRADOS=${JSON.stringify(invalid)}. ` +
      "Usa solo los nombres exactos del campo 'real' y sus URLs literales. " +
      "Los NO ENCONTRADOS no existen en esta cuenta: no los nombres ni los pongas en preguntas relacionadas. " +
      "Si la pregunta depende de ellos, responde exactamente MOODLE_NOT_FOUND.",
    valid,
    invalid,
  };
}
export const applyMoodleVerify = (order) => moodleVerifyResult(order).note;

/* ---------- Chats guardados en este navegador ---------- */
export function findChatRef(ref) {
  const key = String(ref || "").trim();
  if (!key || /^(current|actual|este|this)$/i.test(key)) return current() || null;
  return (
    S.conversations.find((c) => c.id === key) ||
    S.conversations.find(
      (c) => normalize(c.title).trim() === normalize(key).trim(),
    ) ||
    S.conversations.find((c) => normalize(c.title).includes(normalize(key).trim())) ||
    null
  );
}
export function chatListResult(order) {
  const limit = Math.min(Math.max(Number(order && order.limit) || 10, 1), 30);
  const items = S.conversations.slice(-limit).map((c) => ({
    id: c.id,
    title: c.title,
    mensajes: (c.nodes || []).length,
  }));
  return `Chats de esta app: ${JSON.stringify(items).slice(0, 3000)}`;
}
export function chatReadResult(order) {
  const conv = findChatRef(order && (order.id || order.chat || order.title));
  if (!conv) return "No encontré ese chat en este navegador.";
  const path = activePath(conv);
  const limit = Math.min(Math.max(Number(order && order.limit) || 30, 1), 50);
  const nodes = (path.length ? path : nodesOf(conv)).slice(-limit);
  const lines = nodes.map((n) => {
    const text = n.text || n.response || n.short || n.message || "";
    return `${n.role || "bot"}: ${String(text).slice(0, 500)}`;
  });
  return `Chat "${conv.title}" (${conv.id}):\n${lines.join("\n").slice(0, 5000)}`;
}
export async function applyChatWrite(order) {
  const action = String((order && order.action) || "").toLowerCase();
  const conv = findChatRef(order && (order.id || order.chat || order.title));
  if (!conv) return "No encontré ese chat en este navegador.";
  if (!["rename", "delete", "clear"].includes(action))
    return "Acción de chat no permitida. Usa rename, delete o clear.";
  if (action === "delete" && conv.id === S.currentId)
    return "No puedo borrar la conversación activa mientras respondo.";
  const label = `Chat: ${conv.title || conv.id}`;
  const result =
    action === "rename"
      ? `Cambiar el título de "${conv.title}" a "${String(order.title || order.value || "").trim().slice(0, 80)}"`
      : action === "delete"
        ? `Eliminar la conversación "${conv.title}"`
        : `Borrar todos los mensajes de "${conv.title}"`;
  if (!(await askConfirmation(`${result}\n${label}`)))
    return "Cambio cancelado: no se modificó ningún chat.";
  if (action === "rename") {
    const title = String(order.title || order.value || "").trim().slice(0, 80);
    if (!title) return "No se indicó el nuevo título.";
    conv.title = title;
  } else if (action === "delete") {
    S.conversations = S.conversations.filter((c) => c.id !== conv.id);
  } else {
    conv.nodes = [];
    conv.activeLeafId = null;
    if (conv.id === S.currentId) {
      S.currentId = null;
      S.editingId = null;
    }
  }
  save();
  renderHistory();
  renderChat();
  updateHistoryStats();
  return `Chat actualizado (${action}): ${conv.title || label}`;
}

/* ---------- Escrituras en Moodle (siempre con confirmación) ---------- */
export const MOODLE_WRITABLE = new Set([
  "core_user_update_users",
  "core_message_send_instant_messages",
]);
export function moodleWriteParams(fn, order) {
  const p =
    order && order.params && typeof order.params === "object" ? order.params : {};
  if (fn === "core_user_update_users") {
    const user = Array.isArray(p.users) ? p.users[0] : p.user || p;
    if (!user || typeof user !== "object") return null;
    const fields = [
      "firstname",
      "lastname",
      "email",
      "city",
      "country",
      "timezone",
      "description",
      "phone1",
      "phone2",
      "url",
      "alternatename",
    ];
    const out = { "users[0][id]": S.moodleUserId };
    fields.forEach((k) => {
      if (typeof user[k] === "string" && user[k].trim())
        out[`users[0][${k}]`] = moodleScalar(user[k].trim().slice(0, 300));
    });
    return Object.keys(out).length > 1 ? out : null;
  }
  if (fn === "core_message_send_instant_messages") {
    const recipientid = moodleId(
      p.recipientid ?? p.userid ?? p.to,
      S.moodlePeopleIds.size ? [...S.moodlePeopleIds] : null,
    );
    const message =
      typeof p.message === "string" ? p.message.trim().slice(0, 2000) : "";
    if (!recipientid || !message) return null;
    const out = { recipientid, message };
    if (typeof p.subject === "string" && p.subject.trim())
      out.subject = p.subject.trim().slice(0, 200);
    return out;
  }
  return null;
}
export async function applyMoodleWrite(order) {
  if (!getMoodle().token)
    return "Moodle no está conectado: no se puede escribir nada.";
  const fn = String((order && (order.fn || order.function)) || "");
  if (!MOODLE_WRITABLE.has(fn) || !S.moodleAllFunctions.includes(fn))
    return `Esa escritura no está permitida: ${fn || "sin función"}. Solo se pueden actualizar tu perfil y enviar mensajes.`;
  const params = moodleWriteParams(fn, order);
  if (!params) return `Faltan datos válidos para ejecutar ${fn}.`;
  const reason =
    typeof order.reason === "string" ? order.reason.slice(0, 300) : "";
  const detail = `El modelo quiere ejecutar ${fn} en Moodle.\n${reason}\nDatos: ${JSON.stringify(params).slice(0, 900)}`;
  if (!(await askConfirmation(detail)))
    return "Cambio cancelado: no se envió nada a Moodle.";
  try {
    const data = await moodleRequest(fn, params);
    return `Cambio realizado en Moodle (${fn}): ${compactMoodleResult(data)}`;
  } catch (err) {
    return `No se pudo realizar el cambio en Moodle: ${err.message || err}`;
  }
}

export async function moodleOpenURL(raw) {
  const safe = rememberMoodleURL(raw);
  if (!safe) return "Enlace no válido: solo se aceptan URLs http/https.";
  let u;
  try {
    u = new URL(safe);
  } catch (e) {
    return "Enlace no válido.";
  }
  let originOk = false;
  try {
    originOk = u.origin === new URL(getMoodle().base).origin;
  } catch (e) {}
  if (!originOk)
    return `El enlace ${safe} no pertenece a tu Moodle; no lo seguimos.`;

  const ids = {};
  ["id", "courseid", "cmid", "eventid", "eid", "c", "a", "b"].forEach((k) => {
    if (u.searchParams.has(k)) ids[k] = u.searchParams.get(k);
  });
  let detail = "";
  try {
    if (/\/course\/view\.php/i.test(u.pathname) && ids.id) {
      const courseid = moodleId(ids.id, moodleAllowedCourseIds());
      if (courseid == null) detail = "Ese curso no está entre tus cursos matriculados.";
      else {
        const data = await moodleRequest("core_course_get_contents", { courseid });
        S.moodleContents[courseid] = data;
        collectMoodleCMIds(data);
        collectMoodleURLs(data);
        ingestMoodleResult("core_course_get_contents", data);
        detail = `Contenido del curso ${moodleCourseName(courseid)}: ${compactMoodleResult(data)}`;
      }
    } else if (/\/mod\/[a-z]+\/view\.php/i.test(u.pathname) && ids.id) {
      const mod = moodleAllModules().find((m) => Number(m.id) === Number(ids.id));
      detail = mod
        ? `Actividad "${moodleCleanText(mod.name, 120)}" (${mod.modname || "material"}) en ${moodleCourseName(mod.courseid)}`
        : "No hay una actividad con ese id entre los materiales descubiertos.";
      const link = moodleModuleLink(mod);
      if (link) detail += `\nEnlace directo: ${link}`;
    } else if (/\/pluginfile\.php/i.test(u.pathname)) {
      detail = `Archivo: ${moodleDirectURL(safe)}`;
    } else if (/\/calendar\//i.test(u.pathname)) {
      const key = ids.eventid || ids.eid || ids.id;
      const wantedName = u.searchParams.get("name") || "";
      const event = S.moodleEvents.find(
        (e) =>
          String(e.id) === String(key) ||
          (wantedName &&
            normalize(String(e.name || "")).includes(normalize(wantedName))),
      );
      detail = event
        ? `Evento del calendario: ${moodleEventSummary(event)}`
        : "No hay un evento con ese id en el calendario consultado de Moodle.";
    } else {
      detail = `Página de Moodle ${u.pathname}${ids.id ? ` (id ${ids.id})` : ""}`;
    }
  } catch (err) {
    detail = `No se pudo leer ese enlace: ${err.message || err}`;
  }
  return (
    `Enlace seguido: ${safe}\n${detail}\n` +
    `Enlaces disponibles: ${S.moodleURLs.length}. Sigue otro enlace o devuelve el programa OpenUI Lang final.`
  );
}

/* MOODLE_OPEN acepta una URL o un nombre/id de actividad ya descubierto. */
export async function applyMoodleOpen(order) {
  if (!order || typeof order !== "object")
    return "Orden MOODLE_OPEN no válida.";
  let raw = order.url || order.href || order.link;
  if (!raw) {
    const key = order.cmid ?? order.id ?? order.name ?? order.query ?? order.activity;
    const mod = moodleFindModule(key);
    raw = mod ? moodleModuleLink(mod) || mod.url : null;
    if (!raw) return "No encontré esa actividad ni ese enlace entre tus materiales de Moodle.";
  }
  return moodleOpenURL(raw);
}

/* Calendario real: las fechas se leen de Moodle, nunca se inventan. */
