import { save } from '../chat/model.js';
import { $, form, normalize } from '../core/dom.js';
import { MOODLE_DEFAULT_BASE, MOODLE_SERVICE, S, busy, conversations, currentId, editingId, getMoodle, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId, normalizeMoodle } from '../core/state.js';
export async function moodleRequest(fn, params = {}) {
  const { token, base } = getMoodle();
  if (!token) throw new Error("Ingresa a Moodle desde «Mi Moodle»");
  const body = new URLSearchParams({
    wstoken: token,
    wsfunction: fn,
    moodlewsrestformat: "json",
    ...params,
  });
  const res = await fetch(`${base}/webservice/rest/server.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    credentials: "omit",
  });
  const sesionVencida = () => {
    clearMoodle();
    try { window.location.assign('/?moodle=renovar'); } catch (e) {}
    return new Error('Tu sesión de Moodle venció. Vuelve a ingresar para renovarla.');
  };
  if (res.status === 401) throw sesionVencida();
  if (!res.ok) throw new Error(`Moodle respondió HTTP ${res.status}`);
  const data = await res.json().catch(() => ({}));
  if (data && data.exception) {
    const code = String(data.errorcode || data.exception || '');
    if (/invalidtoken|expired|accessexception|token.*invalid|invalid.*token/i.test(code))
      throw sesionVencida();
    throw new Error(data.message || String(data.exception));
  }
  return data;
}

/* Único ingreso: usuario y contraseña. Moodle canjea las credenciales por un
   token en /login/token.php. La contraseña NO se guarda: se descarta en cuanto
   llega el token. */
export async function moodleLogin(
  username,
  password,
  service = MOODLE_SERVICE,
  base = MOODLE_DEFAULT_BASE,
) {
  const target = normalizeMoodle({ base }).base;
  const body = new URLSearchParams({
    username: String(username || ""),
    password: String(password || ""),
    service: String(service || MOODLE_SERVICE),
  });
  const res = await fetch(`${target}/login/token.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    credentials: "omit",
  });
  if (!res.ok) throw new Error(`Moodle respondió HTTP ${res.status}`);
  const data = await res.json().catch(() => ({}));
  if (data.error || data.exception)
    throw new Error(data.error || data.message || String(data.exception));
  if (!data.token) throw new Error("Moodle no devolvió un token");
  return data.token;
}

export const moodleSafeURL = (raw) => {
  try {
    const u = new URL(String(raw || ""));
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch (e) {
    return null;
  }
};
/* Los archivos de Moodle se abren con el token para no depender de la sesión */
export function moodleDirectURL(raw) {
  const safe = moodleSafeURL(raw);
  if (!safe) return null;
  const { token, base } = getMoodle();
  if (!token || !safe.startsWith(base)) return safe;
  try {
    const u = new URL(safe);
    if (/\/pluginfile\.php(?:\/|$)/i.test(u.pathname))
      u.searchParams.set("token", token);
    return u.href;
  } catch (e) {
    return safe;
  }
}
export const moodleIdsParam = (ids, name) =>
  ids.reduce((acc, id, i) => ({ ...acc, [`${name}[${i}]`]: id }), {});

/* Bucle de herramientas: la IA puede recorrer Moodle con varias consultas de
   lectura por turno. El catálogo real se toma de core_webservice_get_site_info
   y se filtra para excluir cualquier función que pueda escribir. */
export const MOODLE_MAX_STEPS = 12;
export const MOODLE_MAX_LOG_ENTRIES = 8;
export const MOODLE_MAX_CONTEXT = 24000;
/* Lista todos los cursos del sitio y falla si alguno no es accesible */
export const MOODLE_BLOCKED = new Set(["core_course_get_courses"]);
export const MOODLE_READ_NAME = /^[a-z][a-z0-9_]*_get(?:_[a-z0-9_]+)?$/i;
export const MOODLE_WRITE_VERB =
  /\b(create|update|delete|submit|set|save|edit|mark|send|post|add|remove|move|copy|import|upload|enrol|unenrol|grade|complete|subscribe|unsubscribe|hide|show|lock|unlock|reset|restore|backup|evaluate|invite)\b/i;
export const MOODLE_ARRAY_PARAMS = new Set([
  "courseids",
  "userids",
  "cmids",
  "ids",
  "activityids",
  "groupids",
]);

export function safeMoodleFunctions(list) {
  const names = (Array.isArray(list) ? list : [])
    .map((f) => (typeof f === "string" ? f : f && f.name))
    .filter(
      (n) =>
        typeof n === "string" &&
        MOODLE_READ_NAME.test(n) &&
        !MOODLE_WRITE_VERB.test(n) &&
        !MOODLE_BLOCKED.has(n),
    );
  return [...new Set(names)].sort().slice(0, 120);
}
export function moodleToolAllowed(fn) {
  if (!fn || MOODLE_BLOCKED.has(fn)) return false;
  if (S.moodleFunctions.length) return S.moodleFunctions.includes(fn);
  return MOODLE_READ_NAME.test(fn) && !MOODLE_WRITE_VERB.test(fn);
}
export function moodleAllowedCourseIds() {
  return S.moodleCourses.map((c) => c.id);
}
export function moodleId(value, allowed) {
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) return null;
  if (allowed && allowed.length && !allowed.includes(id)) return null;
  return id;
}
export function moodleScalar(value) {
  if (Array.isArray(value)) return value.slice(0, 20).map(moodleScalar);
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value)
      .slice(0, 20)
      .forEach(([k, v]) => {
        if (/^[A-Za-z][A-Za-z0-9_]*$/.test(k)) out[k] = moodleScalar(v);
      });
    return out;
  }
  return typeof value === "string" && value.length > 800
    ? value.slice(0, 800) + "…"
    : value;
}
/* Funciones que siempre deben usar el id del usuario conectado, aunque el
   modelo omita el parámetro (lo hacía con core_enrol_get_users_courses). */
export const MOODLE_SELF_USER_FNS = new Set([
  "core_enrol_get_users_courses",
  "core_calendar_get_calendar_events",
  "core_calendar_get_action_events_by_timesort",
  "core_calendar_get_action_events_by_course",
  "mod_assign_get_submission_status",
  "core_message_get_conversations",
  "core_message_get_messages",
  "core_message_get_contact_messages",
  "core_message_get_unread_conversations_count",
]);
export function sanitizeMoodleParams(fn, rawObj) {
  const source =
    rawObj && typeof rawObj === "object"
      ? rawObj.params && typeof rawObj.params === "object"
        ? rawObj.params
        : rawObj
      : {};
  /* El calendario documented events[0][userid]; lo aceptamos también escrito
     así y lo dejamos como parámetros anidados de URLSearchParams. */
  const raw = {};
  Object.entries(source).forEach(([key, value]) => {
    const nested = /^events\[(\d+)\]\[([A-Za-z][A-Za-z0-9_]*)\]$/.exec(key);
    if (!nested) {
      raw[key] = value;
      return;
    }
    const i = Number(nested[1]);
    if (!Array.isArray(raw.events)) raw.events = [];
    while (raw.events.length <= i) raw.events.push(null);
    raw.events[i] = { ...(raw.events[i] || {}), [nested[2]]: value };
  });
  const courseIds = moodleAllowedCourseIds();
  const ownId = S.moodleUserId ? [S.moodleUserId] : null;
  const params = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (["fn", "function", "name", "tool", "params"].includes(key)) return;
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) return;
    if (/userid/i.test(key)) {
      if (Array.isArray(value) || key.endsWith("s")) {
        const ids = (Array.isArray(value) ? value : [value])
          .map((v) => moodleId(v, ownId))
          .filter((v) => v != null)
          .slice(0, 20);
        if (ids.length) Object.assign(params, moodleIdsParam(ids, key));
      } else {
        const id = moodleId(value, ownId);
        if (id != null) params[key] = id;
      }
      return;
    }
    if (/courseid/i.test(key)) {
      if (Array.isArray(value) || key.endsWith("s")) {
        const ids = (Array.isArray(value) ? value : [value])
          .map((v) => moodleId(v, courseIds))
          .filter((v) => v != null)
          .slice(0, 20);
        if (ids.length) Object.assign(params, moodleIdsParam(ids, key));
      } else {
        const id = moodleId(value, courseIds);
        if (id != null) params[key] = id;
      }
      return;
    }
    if (/cmid|activityid/i.test(key)) {
      if (Array.isArray(value) || key.endsWith("s")) {
        const ids = (Array.isArray(value) ? value : [value])
          .map((v) => moodleId(v, S.moodleCMIds))
          .filter((v) => v != null)
          .slice(0, 20);
        if (ids.length) Object.assign(params, moodleIdsParam(ids, key));
      } else {
        const id = moodleId(value, S.moodleCMIds);
        if (id != null) params[key] = id;
      }
      return;
    }
    /* core_user_get_users_by_field(field="id") solo puede mirar tu propio id. */
    if (/^values(?:\[\d+\])?$/.test(key)) {
      const id = moodleId(value, ownId);
      if (id != null) params[key] = id;
      return;
    }
    /* Los estados de entrega solo se consultan para trabajos ya descubiertos. */
    if (/^assign(?:ment)?id$/i.test(key)) {
      const id = moodleId(
        value,
        S.moodleTasks.map((t) => t.id),
      );
      if (id != null) params[key] = id;
      return;
    }
    if (key === "events" && Array.isArray(value)) {
      value
        .slice(0, 10)
        .map((item) => sanitizeMoodleParams(fn, item))
        .filter((event) => Object.keys(event).length)
        .forEach((event, i) =>
          Object.entries(event).forEach(
            ([k, v]) => (params[`events[${i}][${k}]`] = v),
          ),
        );
      return;
    }
    if (MOODLE_ARRAY_PARAMS.has(key) && Array.isArray(value)) {
      const ids = value
        .map((v) => moodleId(v, null))
        .filter((v) => v != null)
        .slice(0, 20);
      if (ids.length) Object.assign(params, moodleIdsParam(ids, key));
      return;
    }
    params[key] = moodleScalar(value);
  });
  /* Estas funciones exigen userid: si el modelo lo omitió, usamos el de la sesión. */
  if (
    params.userid === undefined &&
    S.moodleUserId &&
    MOODLE_SELF_USER_FNS.has(fn)
  )
    params.userid = S.moodleUserId;
  return params;
}

/* Escáner con paréntesis balanceados: sirve para MOODLE_TOOL, MOODLE_OPEN y
   DEVICE_INFO, incluso si el modelo escribe varias llamadas en una respuesta. */
export function extractProtocolCalls(text, marker = "MOODLE_TOOL") {
  const src = String(text || "");
  const calls = [];
  const re = new RegExp(marker + "\\s*\\(", "gi");
  let match;
  while ((match = re.exec(src))) {
    let i = re.lastIndex;
    let depth = 1;
    let quote = false;
    let esc = false;
    const start = i;
    for (; i < src.length && depth > 0; i++) {
      const c = src[i];
      if (quote) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') quote = false;
        continue;
      }
      if (c === '"') quote = true;
      else if (c === "(") depth++;
      else if (c === ")") depth--;
    }
    if (depth !== 0) break;
    const raw = src.slice(start, i - 1).trim();
    re.lastIndex = i;
    let obj;
    try {
      obj = JSON.parse(raw || "{}");
    } catch (e) {
      continue;
    }
    if (obj && typeof obj === "object") calls.push(obj);
  }
  return calls;
}
export function extractMoodleCalls(text) {
  return extractProtocolCalls(text, "MOODLE_TOOL")
    .map((obj) => {
      const fn = obj.fn || obj.function || obj.name;
      return fn ? { fn, raw: obj, params: sanitizeMoodleParams(fn, obj) } : null;
    })
    .filter(Boolean);
}
/* El modelo sigue un enlace real de Moodle con MOODLE_OPEN({"url":"..."}) */
export const extractOpenCalls = (text) => extractProtocolCalls(text, "MOODLE_OPEN");
/* Se conserva por compatibilidad con el formato de una sola herramienta */
export function parseMoodleTool(text) {
  return extractMoodleCalls(text)[0] || null;
}
export function collectMoodleCMIds(data) {
  if (!Array.isArray(data)) return;
  data.forEach((section) =>
    (section && section.modules ? section.modules : []).forEach((mod) => {
      const id = mod && Number(mod.id);
      if (Number.isFinite(id) && id > 0 && !S.moodleCMIds.includes(id))
        S.moodleCMIds.push(id);
    }),
  );
}
export function rememberMoodleURL(raw) {
  const safe = moodleSafeURL(raw);
  if (!safe) return null;
  if (!S.moodleURLs.includes(safe)) {
    S.moodleURLs.push(safe);
    if (S.moodleURLs.length > 60) S.moodleURLs.shift();
  }
  return safe;
}

/* Guarda los enlaces que van apareciendo en las respuestas de Moodle. */
export function collectMoodleURLs(value, depth = 0) {
  if (value == null || depth > 8) return;
  if (typeof value === "string") {
    const found = value.match(/https?:\/\/[^\s"'<>\\]+/g) || [];
    found.forEach(rememberMoodleURL);
    rememberMoodleURL(value);
    return;
  }
  if (Array.isArray(value)) {
    value.slice(0, 100).forEach((v) => collectMoodleURLs(v, depth + 1));
    return;
  }
  if (typeof value === "object")
    Object.values(value)
      .slice(0, 60)
      .forEach((v) => collectMoodleURLs(v, depth + 1));
}

export function moodleAllModules() {
  const out = [];
  Object.entries(moodleContents).forEach(([cid, sections]) => {
    (sections || []).forEach((s, i) =>
      (s.modules || []).forEach((m) =>
        out.push({
          ...m,
          courseid: Number(cid),
          sectionid: i,
          sectionname: s.name || s.title || `Sección ${i + 1}`,
        }),
      ),
    );
  });
  return out;
}
export function moodleCourseName(id) {
  const c = moodleCourses.find((x) => x.id === Number(id));
  return c ? c.fullname || c.shortname || `Curso ${id}` : `Curso ${id}`;
}
export function moodleFindModule(key) {
  if (key == null || key === "") return null;
  const all = moodleAllModules();
  const id = Number(key);
  if (Number.isFinite(id) && id > 0) {
    const exact = all.find((m) => Number(m.id) === id);
    if (exact) return exact;
  }
  const q = normalize(String(key)).trim();
  if (!q) return null;
  return (
    all.find((m) => normalize(String(m.name || "")).includes(q)) ||
    all.find((m) => normalize(String(m.modname || "")).includes(q)) ||
    null
  );
}
/* Verificación de nombres: la IA no debe extrapolar materiales (por ejemplo,
   suponer un "T2.1" porque existe un "T1.1"). Solo son válidos los que aparecen
   literalmente en los datos leídos de Moodle. */
export function moodleModuleLink(mod) {
  const direct = [mod && mod.url, mod && mod.urlweb].find(
    (v) => typeof v === "string" && /^https?:\/\//i.test(v),
  );
  const embedded =
    !direct && typeof (mod && mod.content) === "string"
      ? (mod.content.match(/https?:\/\/[^\s"'<>]+/) || [])[0]
      : null;
  return moodleDirectURL(direct || embedded || "");
}
export function moodleEventDate(event) {
  const seconds = Number(event && (event.timestart ?? event.timeStart));
  if (!Number.isFinite(seconds) || seconds <= 0) return "sin fecha";
  return new Date(seconds * 1000).toLocaleString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function moodleEventSummary(event) {
  const name =
    (event && (event.name || event.title || event.eventname)) || "Evento";
  const course = event && event.coursefullname ? ` · ${event.coursefullname}` : "";
  const url = moodleDirectURL(
    (event && (event.url || event.viewurl || event.eventurl)) || "",
  );
  return `- ${name} · ${moodleEventDate(event)}${course}${url ? ` · ${url}` : ""}`;
}
/* ---------- Sesión ligera de Moodle + datos bajo demanda ----------
   Registrarse solo pide el token. Con site_info se obtiene lo mínimo para
   consultar (userid, nombre y catálogo de funciones); cursos, materiales,
   tareas, compañeros y calendario los pide la IA con MOODLE_TOOL o MOODLE_OPEN. */
