import { renderChat } from '../chat/flow.js';
import { $, app, chat, composerWrap, escapeHTML, landing, main } from '../core/dom.js';
import { compactMoodleValue, moodleCleanText, moodleTaskSummary, moodleTaskURL } from '../core/helpers.js';
import { closeModals } from '../core/modals.js';
import { S, busy, clearMoodle, conversations, currentId, editingId, getMoodle, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId, saveMoodle } from '../core/state.js';
import { MOODLE_MAX_CONTEXT, moodleCourseName, moodleDirectURL, moodleEventDate, moodleEventSummary, moodleRequest, safeMoodleFunctions } from './client.js';
export const moodleSessionActive = () => Boolean(getMoodle().token);
export function syncChatAccess() {
  if (!app || !main || !chat || !composerWrap || !landing) return;
  const active = moodleSessionActive();
  /* En la pantalla de registro no hay barra lateral ni barra superior: el
     formulario ocupa toda la interfaz. */
  app.classList.toggle("landing", !active);
  main.classList.toggle("landing", !active);
  if (!active) main.classList.remove("is-empty");
  chat.hidden = !active;
  composerWrap.hidden = !active;
  landing.hidden = active;
  /* «Cerrar sesión» solo tiene sentido con una sesión activa. */
  const logoutBtn = $("#logoutBtnSide");
  if (logoutBtn) logoutBtn.hidden = !active;
}

/* El usuario ingresa con usuario y contraseña; Moodle devuelve un token que se
   guarda en este navegador ( igual que la key de la IA ) para no volver a pedir
   la contraseña. La contraseña nunca se almacena. */
export async function ensureMoodleSession() {
  if (!getMoodle().token) return false;
  if (S.moodleSessionReady) return true;
  if (S.moodleSessionPromise) return S.moodleSessionPromise;
  S.moodleSessionPromise = (async () => {
    let info = {};
    try {
      info = await moodleRequest("core_webservice_get_site_info");
    } catch (err) {
      /* Sin site_info seguimos: la IA puede consultar igual con MOODLE_TOOL. */
      S.lastMoodleError = String(err.message || err);
    }
    if (info.userid) S.lastMoodleError = "";
    S.moodleUser = info.fullname || info.username || "Estudiante";
    S.moodleUserId = Number(info.userid) || 0;
    S.moodleFunctions = safeMoodleFunctions(info.functions);
    S.moodleAllFunctions = (Array.isArray(info.functions) ? info.functions : [])
      .map((f) => (typeof f === "string" ? f : f && f.name))
      .filter(Boolean);
    const profile = compactMoodleValue({
      userid: S.moodleUserId,
      fullname: info.fullname,
      username: info.username,
      email: info.useremail || info.email,
      city: info.city,
      country: info.country,
      timezone: info.timezone,
      language: info.lang,
    });
    if (S.moodleUser !== "Estudiante" && S.moodleUser !== getMoodle().name)
      saveMoodle({ ...getMoodle(), name: S.moodleUser });
    S.moodleProfileContext = [
      "Mi perfil real (de Moodle; para más campos usa core_user_get_users_by_field):",
      `- ${JSON.stringify(profile)}`,
    ].join("\n");
    S.moodleSessionReady = true;
    refreshMoodleContext();
    updateMoodleUI();
    return true;
  })();
  return S.moodleSessionPromise;
}

/* El contexto de la IA crece solo con lo que se ha consultado de verdad. */
export function refreshMoodleContext() {
  const lines = [S.moodleProfileContext].filter(Boolean);
  if (S.lastMoodleError)
    lines.push(`Último error al conectar con Moodle: ${S.lastMoodleError}`);
  if (S.moodleCourses.length)
    lines.push(
      "Cursos consultados de Moodle:",
      ...S.moodleCourses.slice(0, 20).map((c) => `- ${c.fullname || c.shortname}`),
    );
  if (S.moodleMaterials.length)
    lines.push(
      "Materiales consultados de Moodle:",
      ...S.moodleMaterials.slice(0, 40).map(
        (m) =>
          `- ${m.title} [${m.kind}] · ${m.course}` +
          (m.url ? ` · ${m.url}` : ""),
      ),
    );
  if (S.moodleEvents.length)
    lines.push(
      "Eventos consultados del calendario:",
      ...S.moodleEvents.slice(0, 15).map(moodleEventSummary),
    );
  S.moodleContext = lines.join("\n").slice(0, MOODLE_MAX_CONTEXT);
}

/* Cada respuesta de una herramienta alimenta la verificación de nombres y el
   panel de materiales; no hay descarga previa de todo el curso. */
export function ingestMoodleResult(fn, data) {
  if (data == null) return;
  if (/^core_enrol_get_users_courses$/.test(fn) && Array.isArray(data))
    S.moodleCourses = data
      .filter((c) => c && c.id)
      .slice(0, 20)
      .map((c) => ({
        id: Number(c.id),
        fullname: String(c.fullname || c.shortname || `Curso ${c.id}`),
        shortname: String(c.shortname || ""),
      }));
  if (/calendar/i.test(fn)) {
    const list = Array.isArray(data)
      ? data
      : (data && (data.events || data.items)) || [];
    list.slice(0, 30).forEach((event) => {
      if (!event || typeof event !== "object") return;
      const key = (e) =>
        `${e.id || ""}|${e.name || e.title || ""}|${e.timestart || ""}`;
      if (!S.moodleEvents.some((e) => key(e) === key(event))) S.moodleEvents.push(event);
    });
    S.moodleEvents.sort((a, b) => Number(a.timestart || 0) - Number(b.timestart || 0));
    S.moodleEvents = S.moodleEvents.slice(0, 30);
  }
  if (/^mod_assign_get_assignments$/.test(fn) && data && Array.isArray(data.courses))
    data.courses.slice(0, 20).forEach((c) => {
      (Array.isArray(c && c.assignments) ? c.assignments : [])
        .slice(0, 20)
        .forEach((a) => {
          if (!a || !a.name) return;
          const t = {
            id: Number(a.id) || 0,
            cmid: Number(a.cmid) || 0,
            courseid: Number(a.course || c.id) || 0,
            course: moodleCourseName(a.course || c.id),
            name: String(a.name),
            due: moodleEventDate({ timestart: Number(a.duedate) }),
            intro: moodleCleanText(a.intro || a.instructions || "", 260),
            grade: a.grade == null || a.grade === "" ? "" : String(a.grade),
            types: Array.isArray(a.submissiontypes)
              ? a.submissiontypes.filter(Boolean).join(", ")
              : "",
            url: moodleTaskURL(a),
          };
          if (!S.moodleTasks.some((x) => x.id === t.id && t.id)) S.moodleTasks.push(t);
          if (!S.moodleMaterials.some((m) => m.title === t.name))
            S.moodleMaterials.push({
              kind: "trabajo",
              title: t.name,
              courseId: t.courseid,
              course: t.course,
              filename: "",
              url: t.url,
              detail: moodleTaskSummary(t),
            });
        });
    });
  /* Cualquier objeto con nombre y enlace se recuerda como material consultado. */
  const walk = (value, depth) => {
    if (depth > 5 || S.moodleMaterials.length >= 120) return;
    if (Array.isArray(value)) {
      value.slice(0, 60).forEach((v) => walk(v, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    const title = value.name || value.title || value.fullname;
    const url = moodleDirectURL(
      value.fileurl || value.url || value.urlweb || value.viewurl || "",
    );
    if (typeof title === "string" && title.trim() && title.length < 200 && url) {
      const name = title.trim();
      if (!S.moodleMaterials.some((m) => m.title === name && m.url === url))
        S.moodleMaterials.push({
          kind: "material",
          title: name,
          courseId: Number(value.course || value.courseid) || 0,
          course: moodleCourseName(value.course || value.courseid),
          filename: String(value.filename || ""),
          url,
          detail: moodleCleanText(value.intro || value.description || "", 260),
        });
    }
    Object.values(value).slice(0, 50).forEach((v) => walk(v, depth + 1));
  };
  walk(data, 0);
  refreshMoodleContext();
  updateMoodleUI();
}

/* ---------- Proveedores gratuitos (llamada directa desde el navegador) ---------- */
export function setMoodleStatus(text, isError = false) {
  const status = $("#moodleStatus");
  if (!status) return;
  const message = String(text || "");
  status.textContent = message;
  status.hidden = !message;
  status.classList.toggle("is-error", Boolean(message && isError));
}

export function updateMoodleUI() {
  const panel = $("#moodleCourses");
  const cfg = getMoodle();
  /* El perfil muestra la cuenta real de Moodle, nunca un estudiante de ejemplo. */
  const name = S.moodleUser || cfg.name || "Estudiante";
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "ES";
  const profileName = $("#profileName");
  if (profileName) profileName.textContent = name;
  [$("#userAvatar"), $("#mobileAvatar")].forEach((avatar) => {
    if (avatar) avatar.textContent = initials;
  });
  if (!panel) return;
  panel.hidden = !S.moodleContext;
  if (!S.moodleContext) {
    panel.innerHTML = "";
    return;
  }
  const items = S.moodleMaterials
    .filter((m) => m.url)
    .slice(0, 12)
    .map(
      (m) =>
        `<a class="moodle-material" href="${escapeHTML(m.url)}" target="_blank" rel="noopener noreferrer"><span class="ic sm">description</span><span><b>${escapeHTML(m.title)}</b><small>${escapeHTML(m.course)} · ${escapeHTML(m.kind)}</small></span></a>`,
    )
    .join("");
  panel.innerHTML =
    `<h3>Acceso directo a tus materiales</h3>` +
    `<p class="ui-hint">Se abren sin recorrer Moodle.</p>` +
    (items || `<p class="ui-hint">El sitio no expone archivos descargables para tu cuenta.</p>`) +
    `<a class="ui-btn ui-btn-secondary" href="${escapeHTML(cfg.base)}/my/" target="_blank" rel="noopener noreferrer">Abrir mi Moodle</a>`;
}
export function moodleLogout() {
  if (!moodleSessionActive()) return;
  clearMoodle();
  const pw = $("#moodlePassword"); if (pw) pw.value = "";
  setMoodleStatus("");
  updateMoodleUI();
  closeModals();
  renderChat();
  window.location.assign('/');
}
