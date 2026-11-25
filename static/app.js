/* =========================================================
   Ritchie AI — Lógica (demostración)
   Todas las respuestas son simuladas con datos FICTICIOS.
   ========================================================= */
const $ = (sel) => document.querySelector(sel);
const app = $("#app");
const main = $(".main");
const chat = $("#chat");
const welcome = $("#welcome");
const messagesEl = $("#messages");
const form = $("#form");
const input = $("#input");
const sendBtn = $("#send");
const historyEl = $("#history");

const STORAGE_KEY = "ritchie-ia-historial";
const SETTINGS_KEY =
  "ritchie-ia-config-ia"; /* la key vive SOLO en este navegador */
const MOODLE_KEY = "ritchie-ia-moodle"; /* sesión de Moodle, SOLO en este navegador */
const MOODLE_DEFAULT_BASE = "https://moodle.riwi.io";
const MOODLE_SERVICE = "moodle_mobile_app";
let moodleMemory = null;
let moodleUser = "";
let moodleUserId = 0;
let moodleCourses = [];
let moodleMaterials = [];
let moodleContext = "";

/* El usuario ingresa con usuario y contraseña; Moodle devuelve un token que se
   guarda en este navegador ( igual que la key de la IA ) para no volver a pedir
   la contraseña. La contraseña nunca se almacena. */
function normalizeMoodle(s) {
  const rawBase = typeof s?.base === "string" ? s.base.trim() : "";
  return {
    token: typeof s?.token === "string" ? s.token.trim() : "",
    base: /^https:\/\//i.test(rawBase)
      ? rawBase.replace(/\/+$/, "")
      : MOODLE_DEFAULT_BASE,
  };
}
function getMoodle() {
  if (moodleMemory) return normalizeMoodle(moodleMemory);
  try {
    const raw = localStorage.getItem(MOODLE_KEY);
    return normalizeMoodle(raw ? JSON.parse(raw) : null);
  } catch (e) {
    return normalizeMoodle(null);
  }
}
function saveMoodle(s) {
  moodleMemory = normalizeMoodle(s);
  try {
    localStorage.setItem(MOODLE_KEY, JSON.stringify(moodleMemory));
  } catch (e) {}
}
function clearMoodle() {
  moodleMemory = null;
  moodleUser = "";
  moodleUserId = 0;
  moodleCourses = [];
  moodleMaterials = [];
  moodleContext = "";
  try {
    localStorage.removeItem(MOODLE_KEY);
  } catch (e) {}
}

/* Web services REST de Moodle. El endpoint responde con CORS abierto, así que
   el navegador puede llamarlo directamente: no hace falta servidor propio. */
async function moodleRequest(fn, params = {}) {
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
  if (!res.ok) throw new Error(`Moodle respondió HTTP ${res.status}`);
  const data = await res.json().catch(() => ({}));
  if (data && data.exception)
    throw new Error(data.message || String(data.exception));
  return data;
}

/* Único ingreso: usuario y contraseña. Moodle canjea las credenciales por un
   token en /login/token.php. La contraseña NO se guarda: se descarta en cuanto
   llega el token. */
async function moodleLogin(
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

const moodleSafeURL = (raw) => {
  try {
    const u = new URL(String(raw || ""));
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch (e) {
    return null;
  }
};
/* Los archivos de Moodle se abren con el token para no depender de la sesión */
function moodleDirectURL(raw) {
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
const moodleIdsParam = (ids, name) =>
  ids.reduce((acc, id, i) => ({ ...acc, [`${name}[${i}]`]: id }), {});

/* La IA puede "navegar" Moodle pidiendo una herramienta por turno. Solo se
   exponen funciones de lectura, con parámetros validados. */
const MOODLE_MAX_STEPS = 4;
const MOODLE_TOOLS = {
  core_webservice_get_site_info: "none",
  core_enrol_get_users_courses: "userid",
  core_course_get_contents: "courseid",
  mod_resource_get_resources_by_courses: "courseids",
  mod_folder_get_folders_by_courses: "courseids",
  mod_page_get_pages_by_courses: "courseids",
  mod_url_get_urls_by_courses: "courseids",
};
function parseMoodleTool(text) {
  const m = String(text || "")
    .trim()
    .match(/^MOODLE_TOOL\s*\(?\s*(\{[\s\S]*\})\s*\)?$/i);
  if (!m) return null;
  let obj;
  try {
    obj = JSON.parse(m[1]);
  } catch (e) {
    return null;
  }
  const fn = obj.fn || obj.function;
  const kind = MOODLE_TOOLS[fn];
  if (!kind) return null;
  const params = {};
  if (kind === "courseid") {
    const id = Number(obj.courseid ?? obj.params?.courseid);
    if (!Number.isFinite(id)) return null;
    params.courseid = id;
  } else if (kind === "userid") {
    /* Solo el propio usuario; nunca consultamos a otras personas */
    const raw = obj.userid ?? obj.params?.userid;
    const id = raw === undefined ? moodleUserId : Number(raw);
    if (!Number.isFinite(id) || id <= 0 || (moodleUserId && id !== moodleUserId))
      return null;
    params.userid = id;
  } else if (kind === "courseids") {
    const raw = obj.courseids ?? obj.params?.courseids;
    const ids = (Array.isArray(raw) ? raw : [])
      .map(Number)
      .filter(Number.isFinite)
      .slice(0, 10);
    if (!ids.length) return null;
    Object.assign(params, moodleIdsParam(ids, "courseids"));
  }
  return { fn, params };
}

/* Descarga cursos y materiales reales y prepara el contexto de la IA */
async function moodleConnect(token, base) {
  saveMoodle({ token, base });
  const info = await moodleRequest("core_webservice_get_site_info");
  moodleUser = info.fullname || info.username || "Estudiante";
  moodleUserId = Number(info.userid) || 0;

  /* core_course_get_courses valida TODOS los cursos del sitio y falla si la
     cuenta no tiene acceso a alguno (p. ej. "course id: 2"). Pedimos solo los
     cursos en los que el usuario está matriculado. */
  let courses = [];
  if (moodleUserId) {
    try {
      const enrolled = await moodleRequest("core_enrol_get_users_courses", {
        userid: moodleUserId,
      });
      if (Array.isArray(enrolled)) courses = enrolled;
    } catch (err) {
      /* Si el servicio no está habilitado, seguimos con el token y sin cursos */
    }
  }
  if (!courses.length) {
    try {
      const all = await moodleRequest("core_course_get_courses");
      if (Array.isArray(all)) courses = all;
    } catch (err) {
      /* Algunos sitios lanzan "Curso o actividad no accesible" al listar todos */
    }
  }
  moodleCourses = courses
    .filter(
      (c) =>
        c &&
        c.id &&
        (c.visible ?? 1) &&
        !/^site$/i.test(c.shortname || "") &&
        String(c.format || "").toLowerCase() !== "site",
    )
    .slice(0, 20);
  const ids = moodleCourses.map((c) => c.id);
  const courseName = (id) =>
    moodleCourses.find((c) => c.id === id)?.fullname || "Curso";
  const materials = [];
  const addMaterial = (kind, item, courseId) => {
    if (!item || !item.name) return;
    const content = Array.isArray(item.content) ? item.content : [];
    const file = content.find((f) => f && f.fileurl) || {};
    materials.push({
      kind,
      title: String(item.name),
      courseId,
      course: courseName(courseId),
      filename: file.filename || "",
      url: moodleDirectURL(file.fileurl || item.url || item.externalurl || ""),
    });
  };

  if (ids.length) {
    const params = moodleIdsParam(ids, "courseids");
    const results = await Promise.allSettled([
      moodleRequest("mod_resource_get_resources_by_courses", params),
      moodleRequest("mod_folder_get_folders_by_courses", params),
      moodleRequest("mod_page_get_pages_by_courses", params),
      moodleRequest("mod_url_get_urls_by_courses", params),
    ]);
    [
      ["archivo", "resources"],
      ["carpeta", "folders"],
      ["página", "pages"],
      ["enlace", "urls"],
    ].forEach(([kind, key], i) => {
      const r = results[i];
      if (r.status !== "fulfilled") return;
      (r.value?.[key] || []).forEach((item) =>
        addMaterial(kind, item, item.course),
      );
    });
  }

  /* Si el sitio no expone esos módulos, al menos tomamos las actividades. */
  const contents = await Promise.allSettled(
    moodleCourses
      .slice(0, 6)
      .map((c) => moodleRequest("core_course_get_contents", { courseid: c.id })),
  );
  contents.forEach((r, i) => {
    if (r.status !== "fulfilled" || !Array.isArray(r.value)) return;
    r.value.forEach((section) =>
      (section.modules || []).forEach((m) => {
        if (m.name && !materials.some((x) => x.title === m.name))
          addMaterial("actividad", m, moodleCourses[i].id);
      }),
    );
  });
  moodleMaterials = materials;

  const lines = [
    `Sitio Moodle: ${info.sitename || base}`,
    `Usuario: ${moodleUser}`,
    "",
    "Cursos del usuario:",
    ...moodleCourses.map((c) => `- ${c.fullname}`),
    "",
    "Materiales académicos reales (URLs literales):",
    ...moodleMaterials
      .slice(0, 80)
      .map(
        (m) =>
          `- ${m.title} [${m.kind}] · ${m.course}${m.url ? ` · ${m.url}` : ""}`,
      ),
  ];
  moodleContext = lines.join("\n").slice(0, 14000);
  updateMoodleUI();
  return info;
}

function moodleDemoHTML() {
  if (!moodleContext) return "";
  const byCourse = new Map();
  moodleMaterials.forEach((m) => {
    if (!byCourse.has(m.courseId)) byCourse.set(m.courseId, []);
    byCourse.get(m.courseId).push(m);
  });
  const accordions = moodleCourses
    .slice(0, 8)
    .map((c) => {
      const items = (byCourse.get(c.id) || [])
        .slice(0, 10)
        .map((m) =>
          m.url
            ? `<li><a class="ui-link" href="${escapeHTML(m.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(m.title)}</a></li>`
            : `<li>${escapeHTML(m.title)}</li>`,
        )
        .join("");
      return `<details class="ui-accordion-item" open><summary>${escapeHTML(c.fullname)}</summary><div><ul class="ui-list">${items || "<li>Sin materiales expuestos por la API</li>"}</ul></div></details>`;
    })
    .join("");
  return (
    `<h3>Mis materiales de Moodle</h3>` +
    `<p>Conectado como <b>${escapeHTML(moodleUser)}</b>: ${moodleCourses.length} cursos y ${moodleMaterials.length} materiales disponibles.</p>` +
    `<div class="ui-accordion">${accordions}</div>`
  );
}

/* ---------- Proveedores gratuitos (llamada directa desde el navegador) ---------- */
const PROVIDERS = {
  gemini: {
    label: "Google Gemini",
    defaultModel: "gemini-4-hydrogen",
    help: "Key gratis en aistudio.google.com/apikey. Estos dos modelos están en el plan gratuito; 3.8/3.6 Flash daban 503 y ya no se ofrecen.",
    models: [
      {
        value: "gemini-4-hydrogen",
        label: "Gemini 4 Hydrogen (recomendado, gratis)",
      },
      {
        value: "gemini-3.5-flash-lite",
        label: "Gemini 3.5 Flash-Lite (rápido, gratis)",
      },
    ],
  },
  openrouter: {
    label: "OpenRouter",
    defaultModel: "openrouter/free",
    help: "Key gratis en openrouter.ai/keys. Lista de modelos :free vigente (nov 2026); 'openrouter/free' elige uno disponible.",
    models: [
      { value: "openrouter/free", label: "OpenRouter Free (recomendado)" },
      {
        value: "nvidia/nemotron-3-ultra-550b-a55b:free",
        label: "Nemotron 3 Ultra",
      },
      {
        value: "baidu/ernie-5.5-flash-preview:free",
        label: "ERNIE 5.5 Flash Preview",
      },
      {
        value: "nvidia/nemotron-3.5-super-vl:free",
        label: "Nemotron 3.5 Super VL",
      },
      {
        value: "nvidia/nemotron-3.5-lightning:free",
        label: "Nemotron 3.5 Lightning",
      },
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
   una por línea, con "root = Card(...)" como PRIMERA línea. No escribas markdown ni texto fuera del programa.
2. Compón la respuesta con variedad: CardHeader o InlineHeader para títulos, TextContent para el
   resumen y Steps, Table, EntityList, ListBlock, Tabs o Callout para el detalle. Usa Separator
   para agrupar y FollowUpBlock o Buttons con @ToAssistant("...") para sugerir siguientes pasos.
3. Si el usuario pide una encuesta, formulario o elegir preferencias, usa Form con FormControl y
   Buttons explícitos. Cada control lleva una etiqueta breve y una pista (hint) útil; elige Select,
   Chips, OptionCards, TextArea, CheckBoxGroup o RadioGroup según corresponda, sin pedir datos personales.
   StepsItem siempre lleva dos argumentos: título y detalles. Toda variable definida debe usarse.
   No añadas bloques de fuente ni notas de autonomía: muestra solo la respuesta desarrollada.
4. Si la respuesta no está en los documentos, responde exactamente con la palabra: NO_SE.
5. Nunca inventes datos (ni cifras para gráficas). Nunca menciones APIs, claves ni tecnología interna.

REGLAS DE ÉTICA Y PRIVACIDAD (obligatorias):
6. PRIVACIDAD: Nunca solicites datos personales (correo, celular, cédula, datos de salud). Si el usuario los comparte, ignóralos y no los repitas. Nunca incluyas correos, teléfonos, números de identificación ni datos médicos en tu respuesta.
7. SESGOS: Responde de manera equitativa. Ante casos iguales, da respuestas iguales sin importar quién pregunte. Si tu respuesta difiere para un caso similar, explica claramente la razón.
8. SIN FUENTES: No menciones los nombres de los documentos, sus archivos ni ninguna sección "Sources"/"Fuente". No uses los componentes Sources ni CardSourceProvider. Usa la información sin citarla.
9. TRANSPARENCIA IA: No lo aclares en el texto; la interfaz ya lo indica.
10. AUTONOMÍA: Tu rol es INFORMAR, nunca decidir por el usuario. No añadas notas sobre quién decide.
11. ENLACES: Solo incluye un enlace si su URL aparece literalmente en los documentos; nunca inventes ni completes una URL. Escríbelo como componente Link("texto del enlace", "https://...") o dentro de un texto como [texto](https://...). Los enlaces se abren en una pestaña nueva. No los presentes como "Fuente" ni los uses en lugar de la respuesta desarrollada.

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
  /* Si el usuario conectó Moodle, sus materiales reales pasan a ser la fuente
     principal; los documentos de demostración quedan como respaldo. */
  const moodleSection = moodleContext
    ? `\n\n--- MATERIAL ACADÉMICO REAL DE MOODLE (conectado por el usuario) ---\n${moodleContext}\n\nEste bloque prevalece sobre los documentos de demostración cuando el usuario pregunte por sus cursos o materiales. Sus URLs están autorizadas: puedes usarlas tal cual en Link("Etiqueta", "URL") o [Etiqueta](URL). Nunca inventes otras URLs de Moodle ni cursos que no aparezcan aquí.\n\nNAVEGACIÓN POR MOODLE: si necesitas explorar más, responde EXACTAMENTE con una línea (nada más):\nMOODLE_TOOL({"fn":"core_course_get_contents","courseid":7})\nFunciones permitidas: core_webservice_get_site_info (sin parámetros); core_enrol_get_users_courses (userid, usa el tuyo, nunca el de otra persona); core_course_get_contents (courseid numérico de tus cursos); mod_resource_get_resources_by_courses, mod_folder_get_folders_by_courses, mod_page_get_pages_by_courses y mod_url_get_urls_by_courses (courseids: [id]). NO uses core_course_get_courses: lista todos los cursos del sitio y falla si tu cuenta no tiene acceso a alguno. Después del resultado puedes pedir otra consulta o devolver el programa OpenUI Lang final. Máximo ${MOODLE_MAX_STEPS} consultas. No mezcles MOODLE_TOOL con un programa OpenUI en la misma respuesta.`
    : "";
  const preamble = SYSTEM_PROMPT + moodleSection;
  const lib = window.__OpenUI && window.__OpenUI.openuiChatLibrary;
  if (lib && typeof lib.prompt === "function") {
    return lib.prompt({
      preamble,
      examples: [
        `root = Card([head, summary, note, sep, agenda, next])
head = CardHeader("Próxima sesión de IA", "Jueves 26 de noviembre de 2026")
summary = TextContent("Sesión virtual a las 6:00 p. m. (hora de Colombia). Tema: Introducción a los modelos de lenguaje.", "default")
note = Callout("info", "Modalidad", "Virtual, con materiales en la carpeta de la cohorte.")
sep = Separator("horizontal", true)
agenda = Steps([s1, s2])
s1 = StepsItem("Tema", "Introducción a los modelos de lenguaje")
s2 = StepsItem("Modalidad", "Virtual")
next = FollowUpBlock([q1, q2])
q1 = FollowUpItem("¿Qué actividades tengo pendientes?")
q2 = FollowUpItem("¿Dónde encuentro los materiales?")`,
        `root = Card([head, tbl, keyFact, tags, actions])
head = CardHeader("Actividades pendientes")
tbl = Table([colAct, colDate])
colAct = Col("Actividad", ["Taller de prompts", "Reflexión de la sesión 8", "Avance del proyecto"])
colDate = Col("Vencimiento", ["27 de noviembre", "29 de noviembre", "1 de diciembre"])
keyFact = EntityList([{left: "Más próxima", right: "Taller de prompts", rightVariant: "text"}])
tags = TagBlock(["27 nov", "29 nov", "1 dic"], "sm")
actions = Buttons([ask1])
ask1 = Button("Ver materiales", @ToAssistant("¿Dónde encuentro los materiales de estudio?"), "secondary")`,
        `root = Card([head, views])
head = CardHeader("Entrega del proyecto")
views = Tabs([tabDate, tabSteps])
tabDate = TabItem("fecha", "Fecha límite", [deadline, deliveryNote])
deadline = TextContent("Viernes 4 de diciembre de 2026, hasta las 11:59 p. m.", "large-heavy")
deliveryNote = Callout("warning", "Forma de entrega", "Carga el enlace del repositorio en la plataforma de la cohorte.")
tabSteps = TabItem("pasos", "Cómo entregar", [stepsHead, stepsList])
stepsHead = InlineHeader("Pasos", "Sigue estos pasos")
stepsList = ListBlock([li1, li2])
li1 = ListItem("Prepara el repositorio", "Con tu proyecto final")
li2 = ListItem("Carga el enlace", "En la plataforma de la cohorte")`,
        `root = Card([head, intro, survey, follow])
head = CardHeader("¿Cómo prefieres tu seguimiento?")
intro = TextContent("Elige tus preferencias para adaptar las próximas respuestas.", "default")
survey = Form("preferencias", buttons, [fTema, fRitmo, fDetalle, fFormato])
buttons = Buttons([sendBtn, skipBtn])
sendBtn = Button("Enviar respuestas", @ToAssistant("Guardar mis preferencias"), "primary")
skipBtn = Button("Omitir", @ToAssistant("Continuar sin preferencias"), "secondary")
fTema = FormControl("Tema de interés", Select("tema", [t1, t2], "Elige un tema"), "¿Qué quieres ver primero?")
t1 = SelectItem("sesiones", "Sesiones y calendario")
t2 = SelectItem("proyecto", "Entrega del proyecto")
fRitmo = FormControl("Ritmo", Chips("ritmo", "single", [c1, c2]), "Elige una opción")
c1 = ChipItem("breve", "Breve y directo")
c2 = ChipItem("detallado", "Con detalle")
fDetalle = FormControl("Mejoras sugeridas", TextArea("comentario", "Escribe tus ideas (opcional)", 3), "Opcional")
fFormato = FormControl("Formato", OptionCards("formato", "single", [oc1, oc2]), "Elige cómo ver la información")
oc1 = OptionCard("pasos", "Paso a paso", "Con instrucciones ordenadas")
oc2 = OptionCard("tabla", "Tabla", "Comparativa rápida")
follow = FollowUpBlock([q1])
q1 = FollowUpItem("Ver el calendario de la cohorte")`,
      ],
      additionalRules: [
        "Responde en español neutro con detalle y claridad: desarrolla cada dato con contexto útil, no des solo una frase. Objetivo: 120 a 250 palabras cuando el tema lo permita.",
        "Escribe root = Card(...) como primera línea y define cada variable en su propia línea; toda variable definida debe aparecer dentro de otra componente (si no, no se renderiza). Usa argumentos posicionales, nunca 'clave: valor'.",
        'Aprovecha todos los datos del documento y elige la vista que mejor los represente: Table o EntityList para datos sueltos, Steps o ListBlock para procesos, Tabs para alternativas, Callout para avisos y FollowUpBlock o Buttons con @ToAssistant("...") para invitar a seguir preguntando. Usa Separator o InlineHeader para organizar bloques largos.',
        'Cuando el usuario pida una encuesta, formulario, preferencias o una selección, usa Form como hijo de Card. Define cada FormControl en su propia línea con Input, TextArea, Select, Chips, OptionCards, RadioGroup, CheckBoxGroup o DatePicker, añade una pista breve como tercer argumento y pasa Buttons([Button(...)]) como segundo argumento de Form con @ToAssistant("Enviar"). Nunca pidas datos personales.',
        'StepsItem exige dos argumentos posicionales: título y detalles, por ejemplo StepsItem("Tema", "Introducción a los modelos de lenguaje"). Nunca lo escribas con un solo argumento. No inventes cifras para charts: los documentos solo tienen fechas y texto.',
        "Los datos enviados en un formulario te llegan como 'Datos del formulario: {...}' en el siguiente mensaje: úsalos para adaptar la respuesta, sin repetir datos personales.",
        "Nunca pidas datos personales ni los repitas en el programa.",
        "No uses Sources, CardSourceProvider ni ninguna lista de fuentes. No escribas la palabra 'Fuente' ni nombres de archivos PDF. Usa los datos sin citarlos.",
        "No incluyas bloques de código markdown: devuelve únicamente el programa OpenUI Lang.",
        'Los enlaces son parte del contenido, no citas: usa Link("Etiqueta", "https://...") o [Etiqueta](https://...) dentro de TextContent solo con URLs que aparezcan literalmente en los documentos; nunca inventes una URL ni escribas "Fuente". Se abren en una pestaña nueva.',
      ],
    });
  }
  return (
    preamble +
    "\n\nFormato OpenUI Lang: una sentencia por línea; primera línea root = Card([...]); usa CardHeader, TextContent, Callout, Separator, Steps, Table, EntityList, ListBlock, Tabs, FollowUpBlock y Form con FormControl/Buttons (@ToAssistant) según corresponda. Desarrolla la respuesta con detalle (120-250 palabras) y no incluyas fuentes. Para enlaces usa Link(\"Etiqueta\", \"https://...\") o [Etiqueta](https://...) solo con URLs presentes en los documentos; se abren en pestaña nueva."
  );
}

const SOURCE_MAP = {
  "calendario de la cohorte": {
    label: "Calendario de la cohorte",
    file: "calendario-cohorte-demo.pdf",
  },
  "guia del proyecto": {
    label: "Guía del proyecto",
    file: "guia-proyecto-demo.pdf",
  },
  "carpeta de materiales": {
    label: "Carpeta de materiales",
    file: "materiales-cohorte-demo.pdf",
  },
};

/* Si el navegador bloquea localStorage (algunos file://), la key al menos dura la sesión */
let memorySettings = null;

function normalizeSettings(s) {
  const provider = PROVIDERS[s && s.provider] ? s.provider : "gemini";
  const model =
    typeof s?.model === "string" && s.model.trim()
      ? s.model.trim()
      : PROVIDERS[provider].defaultModel;
  return {
    provider,
    apiKey: typeof s?.apiKey === "string" ? s.apiKey.trim() : "",
    model,
  };
}
function getSettings() {
  const fallback = normalizeSettings({});
  if (memorySettings) return normalizeSettings(memorySettings);
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveSettings(s) {
  memorySettings = normalizeSettings(s);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(memorySettings));
  } catch (e) {}
}
function clearSettings() {
  memorySettings = null;
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch (e) {}
}

const icon = (name, cls = "") => `<span class="ic ${cls}">${name}</span>`;
const LOGO_MINI = `<div class="logo-tile mini" aria-hidden="true"><span class="logo">cruelty_free</span></div>`;

const facts = (rows) =>
  `<ul class="facts">${rows
    .map(
      ([ic, label, value]) =>
        `<li><span class="fi">${icon(ic)}</span><span class="ft"><b>${label}</b><span>${value}</span></span></li>`,
    )
    .join("")}</ul>`;

/* ---------- PII: detección y redacción de datos personales ---------- */
const PII_PATTERNS = [
  {
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    label: "[correo oculto]",
  },
  {
    regex: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,
    label: "[teléfono oculto]",
  },
  { regex: /\b\d{6,10}\b/g, label: "[documento oculto]" },
];
function redactPII(text) {
  let cleaned = text;
  PII_PATTERNS.forEach(({ regex, label }) => {
    cleaned = cleaned.replace(new RegExp(regex.source, regex.flags), label);
  });
  return cleaned;
}
function containsPII(text) {
  return PII_PATTERNS.some(({ regex }) =>
    new RegExp(regex.source, regex.flags).test(text),
  );
}

/* ---------- Base de conocimiento DEMO (datos ficticios) ---------- */
const KNOWLEDGE = [
  {
    short: "Jueves 26 de noviembre, 6:00 p. m., virtual.",
    source: {
      label: "Calendario de la cohorte",
      file: "calendario-cohorte-demo.pdf",
    },
    keywords: [
      "sesion",
      "clase de ia",
      "proxima clase",
      "proxima sesion",
      "horario",
      "cuando es la clase",
    ],
    html:
      `<h3>Próxima sesión de IA</h3>` +
      facts([
        ["calendar_month", "Fecha", "Jueves 26 de noviembre de 2026"],
        ["schedule", "Hora", "6:00 p. m. (hora de Colombia)"],
        ["monitor", "Modalidad", "Virtual"],
        ["lightbulb", "Tema", "Introducción a los modelos de lenguaje"],
      ]),
  },
  {
    short: "Hasta el viernes 4 de diciembre, 11:59 p. m.",
    source: { label: "Guía del proyecto", file: "guia-proyecto-demo.pdf" },
    keywords: [
      "proyecto",
      "entrega",
      "fecha de entrega",
      "fecha limite",
      "entregar",
      "deadline",
    ],
    html:
      `<h3>Entrega del proyecto</h3>` +
      facts([
        ["flag", "Fecha límite", "Viernes 4 de diciembre de 2026"],
        ["schedule", "Hora", "Hasta las 11:59 p. m."],
        [
          "upload",
          "Cómo entregar",
          "Carga el enlace de tu repositorio en la plataforma de la cohorte",
        ],
      ]),
  },
  {
    short: "Tienes 3 pendientes; la más próxima vence el 27 de noviembre.",
    source: {
      label: "Calendario de la cohorte",
      file: "calendario-cohorte-demo.pdf",
    },
    keywords: ["actividad", "pendiente", "tarea", "taller", "reto"],
    html:
      `<h3>Actividades pendientes</h3>` +
      facts([
        ["check_circle", "Taller de prompts", "Vence el 27 de noviembre"],
        [
          "check_circle",
          "Reflexión de la sesión 8",
          "Vence el 29 de noviembre",
        ],
        ["check_circle", "Avance del proyecto", "Vence el 1 de diciembre"],
      ]),
  },
  {
    short: "En la carpeta de la cohorte: presentaciones, grabaciones y guías.",
    source: {
      label: "Carpeta de materiales",
      file: "materiales-cohorte-demo.pdf",
    },
    keywords: [
      "material",
      "recurso",
      "estudio",
      "documento",
      "apuntes",
      "diapositiva",
      "grabacion",
      "donde encuentro",
    ],
    html:
      `<h3>Materiales de estudio</h3><p class="muted">Encuentras todo en la carpeta de la cohorte:</p>` +
      facts([
        ["layers", "Presentaciones", "De cada sesión"],
        ["videocam", "Grabaciones", "De las clases"],
        ["description", "Guías y plantillas", "Para el proyecto"],
      ]),
  },
  {
    keywords: ["tl", "team leader", "contacto", "hablar con una persona"],
    html: `<h3>Hablar con una persona</h3><p>Un TL (Team Leader) puede ayudarte con lo que Ritchie AI no puede resolver. Usa el botón <b>Hablar con el TL (Team Leader)</b> de la barra lateral.</p>`,
    noSource: true,
  },
  {
    keywords: ["hola", "buenas", "buenos dias", "buenas tardes", "gracias"],
    html: `<h3>¡Hola!</h3><p>Con gusto te ayudo. Puedes preguntarme por sesiones, actividades, fechas de entrega, proyectos o materiales de estudio.</p>`,
    noSource: true,
  },
];

/* Encuesta interactiva de demostración (programa validado con el bundle de OpenUI) */
const DEMO_SURVEY = `root = Card([head, intro, survey, follow])
head = CardHeader("¿Cómo prefieres tu seguimiento?", "Tus respuestas se usan solo en este chat")
intro = TextContent("Elige tus preferencias para adaptar las próximas respuestas.", "default")
survey = Form("preferencias", buttons, [fTema, fRitmo, fFormato, fDetalle])
buttons = Buttons([sendBtn, skipBtn])
sendBtn = Button("Enviar respuestas", @ToAssistant("Guardar mis preferencias"), "primary")
skipBtn = Button("Omitir", @ToAssistant("Continuar sin preferencias"), "secondary")
fTema = FormControl("Tema de interés", Select("tema", [t1, t2, t3], "Elige un tema"), "¿Qué quieres ver primero?")
t1 = SelectItem("sesiones", "Sesiones y calendario")
t2 = SelectItem("proyecto", "Entrega del proyecto")
t3 = SelectItem("materiales", "Materiales de estudio")
fRitmo = FormControl("Ritmo de las respuestas", Chips("ritmo", "single", [c1, c2, c3]), "Elige una sola opción")
c1 = ChipItem("breve", "Breve y directo")
c2 = ChipItem("detallado", "Con detalle")
c3 = ChipItem("ejemplos", "Con ejemplos")
fFormato = FormControl("Formato preferido", OptionCards("formato", "single", [oc1, oc2]), "Elige cómo ver la información")
oc1 = OptionCard("pasos", "Paso a paso", "Instrucciones ordenadas")
oc2 = OptionCard("tabla", "Tabla", "Comparativa rápida")
fDetalle = FormControl("Mejoras sugeridas", TextArea("comentario", "Escribe tus ideas (opcional)", 3), "Opcional")
follow = FollowUpBlock([q1])
q1 = FollowUpItem("Ver el calendario de la cohorte")`;

function formatFormValue(value) {
  if (Array.isArray(value)) return value.map(formatFormValue).join(", ");
  if (value && typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "value"))
      return formatFormValue(value.value);
    return Object.entries(value)
      .filter(([k]) => k !== "componentType")
      .map(([k, v]) => `${k}: ${formatFormValue(v)}`)
      .join(" · ");
  }
  return String(value);
}
const FORM_LABELS = {
  tema: "Tema",
  ritmo: "Ritmo",
  formato: "Formato",
  comentario: "Comentario",
};
function formSubmissionAnswer(question) {
  let data = {};
  const match = question.match(/Datos del formulario:\s*(\{[\s\S]*\})/);
  if (match) {
    try {
      data = JSON.parse(match[1]);
    } catch (e) {
      data = {};
    }
  }
  const rows = Object.entries(data)
    .map(([k, v]) => [
      FORM_LABELS[k] ||
        k.replace(/[_-]/g, " ").replace(/^./, (c) => c.toUpperCase()),
      formatFormValue(v),
    ])
    .filter(([, value]) => Boolean(value) && value !== "undefined")
    .map(
      ([label, value]) =>
        `<li><span class="fi">${icon("check_circle")}</span><span class="ft"><b>${escapeHTML(label)}</b><span>${escapeHTML(value)}</span></span></li>`,
    )
    .join("");
  return {
    type: "answer",
    short: "¡Listo! Recibí tus respuestas",
    html:
      `<p>Con esto puedo adaptar las próximas respuestas a tus preferencias.</p>` +
      (rows
        ? `<ul class="facts">${rows}</ul>`
        : `<p class="muted">No se recibieron datos.</p>`),
    noSource: true,
  };
}

/* Temas sensibles: se derivan a una persona */
const SENSITIVE = [
  "salud",
  "enfermo",
  "enferma",
  "enfermedad",
  "medic",
  "depres",
  "ansiedad",
  "estres",
  "triste",
  "suicid",
  "calificacion",
  "mis notas",
  "mi nota",
  "promedio",
  "aprobar",
  "reprob",
  "perder el curso",
  "situacion personal",
  "problema personal",
  "asunto personal",
  "familia",
  "problema con mi",
  "acoso",
  "maltrato",
  "abuso",
  "violencia",
  "expulsar",
  "sancionar",
  "despedir",
  "castigar",
  "mi compañero",
  "mi companero",
  "decidir sobre",
];

/* ---------- Estado ---------- */
let conversations = [];
let currentId = null;
let busy = false;
let editingId = null;

/* ---------- Utilidades ---------- */
const normalize = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") + " ";
const escapeHTML = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const current = () => conversations.find((c) => c.id === currentId);

/* ---------- Mensajes en árbol: cada mensaje puede tener ramas ---------- */
const nodesOf = (conv) => (conv ? conv.nodes || (conv.nodes = []) : []);
const nodeById = (id, conv = current()) =>
  nodesOf(conv).find((n) => n.id === id);
const childNodes = (id, conv = current()) =>
  nodesOf(conv).filter((n) => n.parentId === id);
function branchSiblings(node, conv = current()) {
  if (!node) return [];
  return nodesOf(conv).filter(
    (n) => n.parentId === node.parentId && n.role === node.role,
  );
}
function lastLeaf(node, conv = current()) {
  let leaf = node;
  let kids = childNodes(leaf.id, conv);
  while (kids.length) {
    leaf = kids[kids.length - 1];
    kids = childNodes(leaf.id, conv);
  }
  return leaf;
}
function activePath(conv = current()) {
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
function addNode(node, parentId = undefined) {
  const conv = current();
  const parent =
    parentId === undefined ? (conv?.activeLeafId ?? null) : parentId;
  const n = { id: uid(), parentId: parent, ...node };
  nodesOf(conv).push(n);
  conv.activeLeafId = n.id;
  return n;
}

/* ---------- Estado vacío: saludo y acciones rápidas variables ---------- */
const WELCOMES = [
  "¡Hola! Soy Ritchie AI, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
  "¡Qué gusto verte! Pregúntame lo que necesites saber de la cohorte.",
  "Estoy aquí para ayudarte con sesiones, entregas, actividades y proyectos. ¿Por dónde empezamos?",
  "¡Hola! Cuéntame qué necesitas y lo busco en los materiales de la cohorte.",
  "Listo para ayudarte: tengo a mano el calendario, las actividades y las guías del proyecto.",
];
const QUICK_ACTIONS = [
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
const randomIndex = (n) => Math.floor(Math.random() * n);
function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const welcomePicks = new Map();
function welcomePick() {
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
function renderWelcome() {
  const pick = welcomePick();
  const title = $("#welcomeTitle");
  const suggestions = $("#suggestions");
  if (title) title.textContent = pick.greeting;
  if (suggestions) {
    const actions = moodleContext
      ? [{ q: "Ver mis materiales de Moodle", icon: "school" }, ...pick.actions]
      : pick.actions;
    suggestions.innerHTML = actions
      .map(
        (a) =>
          `<button class="chip" data-q="${escapeHTML(a.q)}"><span class="ico"><span class="ic lg">${a.icon}</span></span>${escapeHTML(a.q)}</button>`,
      )
      .join("");
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (e) {}
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) conversations = JSON.parse(raw);
  } catch (e) {
    conversations = [];
  }
  /* Los chats guardados antes de las ramas se convierten a una sola rama lineal */
  conversations.forEach((c) => {
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

/* ---------- Motor de respuesta simulado ---------- */
function resolveAnswer(question) {
  const q = normalize(question);
  if (/(moodle|mis materiales|material academico|mis cursos|acceso directo)/.test(q)) {
    if (moodleContext)
      return {
        type: "answer",
        html: moodleDemoHTML(),
        short: `Tienes ${moodleCourses.length} cursos y ${moodleMaterials.length} materiales en Moodle.`,
        noSource: true,
      };
    return {
      type: "error",
      question,
      message:
        'Ingresa con tu usuario y contraseña de Moodle desde el botón «Mi Moodle» de la barra lateral para ver tus materiales reales. Tu contraseña viaja directamente a Moodle y no se guarda.',
    };
  }
  if (/datos del formulario/i.test(question))
    return formSubmissionAnswer(question);
  if (
    /(encuesta|formulario|preferencias|prefieres|elegir opciones|valorar|calificar)/.test(
      q,
    )
  ) {
    return { type: "openui", response: DEMO_SURVEY };
  }
  if (SENSITIVE.some((k) => q.includes(k))) return { type: "safety" };
  // Gana el tema con la palabra clave más específica (más larga), no el primero de la lista.
  let hit = null,
    best = 0;
  KNOWLEDGE.forEach((k) =>
    k.keywords.forEach((kw) => {
      if (q.includes(kw) && kw.length > best) {
        best = kw.length;
        hit = k;
      }
    }),
  );
  if (hit)
    return {
      type: "answer",
      html: hit.html,
      short: hit.short,
      source: hit.source,
      noSource: hit.noSource,
    };
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
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("") ||
    "";
  if (!text.trim()) throw new Error("el modelo devolvió una respuesta vacía");
  return text;
}

async function callOpenRouter(question, settings, system) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`,
      "HTTP-Referer":
        (typeof location !== "undefined" && location.origin) ||
        "https://localhost",
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
    return {
      type: "error",
      question,
      message:
        "No tengo información suficiente en los documentos de la cohorte para responder eso. Prueba a reformular la pregunta.",
    };
  }
  const isProgram = /(^|\n)\s*[A-Za-z_$][\w$]*\s*=\s*[A-Za-z_$]/.test(clean);
  if (isProgram) return { type: "openui", response: clean };
  /* Respuesta en texto: se muestra con el mismo estilo que el resto del chat */
  const sourceMatch = clean.match(/FUENTE:\s*(.+)$/im);
  const bodyText = sourceMatch
    ? clean.slice(0, sourceMatch.index).trim()
    : clean;
  const lines = bodyText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const short = richText(lines[0] || "");
  const detailHTML = lines
    .slice(1)
    .map((l) => `<p>${richText(l.replace(/^[-•*]\s*/, ""))}</p>`)
    .join("");
  return {
    type: "answer",
    short,
    html: `<div class="api-answer">${detailHTML}</div>`,
  };
}

async function askAI(question, settings, context = "") {
  const system = buildSystemPrompt();
  const q = question + context;
  const models = PROVIDERS[settings.provider].models.map((m) => m.value);
  const ordered = [
    settings.model,
    ...models.filter((m) => m !== settings.model),
  ].filter(Boolean);
  let raw = "";
  let lastError = null;

  /* Si el modelo está saturado (503/429) probamos con el siguiente gratuito de la lista */
  for (const model of ordered) {
    try {
      raw =
        settings.provider === "openrouter"
          ? await callOpenRouter(q, { ...settings, model }, system)
          : await callGemini(q, { ...settings, model }, system);
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      const retryable =
        /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|overload|high demand/i.test(
          err.message || "",
        );
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
      try {
        onData(JSON.parse(payload));
      } catch (e) {
        /* evento incompleto */
      }
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
    const chunk =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p?.text || "")
        .join("") || "";
    if (chunk) {
      text += chunk;
      onChunk(text);
    }
  });
  return text;
}

async function streamOpenRouter(question, settings, system, onChunk) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`,
      "HTTP-Referer":
        (typeof location !== "undefined" && location.origin) ||
        "https://localhost",
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
    if (chunk) {
      text += chunk;
      onChunk(text);
    }
  });
  return text;
}

async function streamAI(question, settings, onChunk, context = "") {
  const system = buildSystemPrompt();
  const q = question + context;
  const models = PROVIDERS[settings.provider].models.map((m) => m.value);
  const ordered = [
    settings.model,
    ...models.filter((m) => m !== settings.model),
  ].filter(Boolean);
  let lastError = null;
  for (const model of ordered) {
    try {
      const s = { ...settings, model };
      const raw =
        settings.provider === "openrouter"
          ? await streamOpenRouter(q, s, system, onChunk)
          : await streamGemini(q, s, system, onChunk);
      if (raw) return raw;
    } catch (err) {
      lastError = err;
      const retryable =
        /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|overload|high demand/i.test(
          err.message || "",
        );
      if (!retryable) break;
      onChunk(""); // descarta el partial del modelo caído
    }
  }
  if (lastError) throw lastError;
  return "";
}

/* Bucle de herramientas: la IA pide una consulta a Moodle, la ejecutamos y le
   devolvemos el resultado para que siga navegando o dibuje la respuesta final. */
async function runAIWithTools(question, settings, onChunk, useStream = true) {
  const emit = typeof onChunk === "function" ? onChunk : () => {};
  let log = "";
  let text = useStream
    ? await streamAI(question, settings, emit, log)
    : await askAI(question, settings, log);
  for (let step = 0; step < MOODLE_MAX_STEPS && moodleContext; step++) {
    const call = parseMoodleTool(cleanResponse(text));
    if (!call) break;
    emit("");
    let data;
    try {
      data = await moodleRequest(call.fn, call.params);
    } catch (err) {
      data = { error: err.message || String(err) };
    }
    log +=
      `\n\n--- Navegación Moodle (${step + 1}/${MOODLE_MAX_STEPS}) ---\n` +
      `Consulta: ${JSON.stringify(call)}\n` +
      `Resultado: ${JSON.stringify(data).slice(0, 6000)}\n` +
      `Con este resultado, haz otra consulta si hace falta o devuelve SOLO el programa OpenUI Lang final.`;
    text = await askAI(question, settings, log);
  }
  return text;
}

/* ---------- Render propio del lenguaje de la IA (estética de la app) ----------
   Interpretamos "nombre = Componente(...)" y dibujamos HTML con las clases de
   la app: no dependemos del CSS ni del Renderer de OpenUI para mostrar messages. */
let uiSeq = 0;
const uiId = (prefix) => `${prefix}-${++uiSeq}`;

/* Acciones de los formularios: el estado se devuelve a la IA como contexto oculto */
function handleOpenUIAction(action) {
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
function programToText(program) {
  const strings = program.match(/"((?:\\.|[^"\\])*)"/g) || [];
  return strings.map((s) => s.slice(1, -1).replace(/\\"/g, '"')).join(" · ");
}

/* --- Intérprete mínimo del lenguaje de componentes --- */
function splitArgs(src) {
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
function closeIndex(src, open, close) {
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
function parseValue(src) {
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
function parseProgram(src) {
  const env = {};
  src.split(/\r?\n/).forEach((line) => {
    const m = line.trim().match(/^([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+)$/);
    if (m) env[m[1]] = parseValue(m[2]);
  });
  return env;
}
function resolveValue(v, env, seen = new Set()) {
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
const valText = (v) =>
  v == null ? "" : typeof v === "object" ? "" : String(v);
const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

/* Enlaces en el texto de la IA: markdown [etiqueta](https://...) o URLs sueltas.
   El texto ya está escapado, así que solo se aceptan esquemas http/https. */
const MD_LINK = /\[([^\]\n]+)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)/gi;
const BARE_URL = /(^|[\s(])((?:https?:\/\/|www\.)[^\s<>()]+)/gi;
const formatInline = (s) =>
  s
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>");
const normalizeHref = (raw) => {
  const s = String(raw).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^www\./i.test(s)) return `https://${s}`;
  return null;
};
const anchorHTML = (label, href) =>
  `<a class="ui-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
function richText(v) {
  const links = [];
  let out = escapeHTML(valText(v)).replace(MD_LINK, (match, label, href) => {
    const safe = normalizeHref(href);
    if (!safe) return match;
    const token = `\u0000${links.length}\u0000`;
    links.push(anchorHTML(formatInline(label), safe));
    return token;
  });
  out = formatInline(out).replace(/\r?\n/g, "<br>");
  out = out.replace(BARE_URL, (match, before, url) => {
    const clean = url.replace(/[.,;:!?]+$/, "");
    const safe = normalizeHref(clean);
    if (!safe) return match;
    return `${before}${anchorHTML(safe, safe)}${url.slice(clean.length)}`;
  });
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)] || "");
}
function actionText(v) {
  if (!v) return "";
  if (Array.isArray(v)) return actionText(v[0]);
  return v.step === "ToAssistant" ? valText(v.args?.[0]) : "";
}

/* --- Dibujo de los componentes soportados --- */
function renderButtons(node, inForm = false) {
  const list =
    node && node.type === "Buttons" ? asArray(node.args?.[0]) : asArray(node);
  const vertical = node?.args?.[1] === "column";
  const full = inForm && list.length === 1;
  const body = list
    .map((b, i) => {
      if (!b || b.type !== "Button") return renderNode(b);
      const label = valText(b.args?.[0]);
      const action = actionText(b.args?.[1]);
      const variant = ["primary", "secondary", "tertiary"].includes(b.args?.[2])
        ? b.args?.[2]
        : "secondary";
      /* Un botón con URL en lugar de @ToAssistant se dibuja como enlace externo */
      const href = action ? null : normalizeHref(valText(b.args?.[1]));
      if (href)
        return `<a class="ui-btn ui-btn-${variant}" href="${escapeHTML(
          href,
        )}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>`;
      const submit = inForm && i === 0 && action;
      return `<button type="${submit ? "submit" : "button"}" class="ui-btn ui-btn-${variant}"${action ? ` data-toassistant="${escapeHTML(action)}"` : ""}>${escapeHTML(label)}</button>`;
    })
    .join("");
  return `<div class="ui-buttons${vertical ? " ui-buttons-column" : ""}${full ? " ui-buttons-full" : ""}">${body}</div>`;
}
function renderNode(node) {
  if (node == null || node === false) return "";
  if (Array.isArray(node)) return node.map(renderNode).join("");
  if (typeof node !== "object" || !node.type) return richText(node);
  const a = node.args || [];
  const kids = () => a.map(renderNode).join("");
  switch (node.type) {
    case "Card":
      return `<div class="ui-card">${kids()}</div>`;
    case "CardHeader":
      return `<div class="ui-header"><b>${richText(a[0])}</b>${a[1] ? `<span>${richText(a[1])}</span>` : ""}</div>`;
    case "InlineHeader":
      return `<div class="ui-inline-header"><b>${richText(a[0])}</b>${a[1] ? `<span>${richText(a[1])}</span>` : ""}</div>`;
    case "TextContent":
    case "MarkDownRenderer":
      return `<p class="ui-text ui-text-${["small", "large", "small-heavy", "large-heavy"].includes(a[1]) ? a[1] : "default"}">${richText(a[0])}</p>`;
    case "Callout":
    case "TextCallout": {
      const variant = a[0] === "danger" ? "error" : a[0] || "neutral";
      return `<div class="ui-callout ui-callout-${escapeHTML(variant)}"><b>${richText(a[1])}</b>${a[2] ? `<p>${richText(a[2])}</p>` : ""}</div>`;
    }
    case "Separator":
      return `<hr class="ui-sep">`;
    case "Steps":
      return `<ol class="ui-steps">${asArray(a[0])
        .map(
          (s, i) =>
            `<li><span class="ui-step-num">${i + 1}</span><div><b>${richText(s?.args?.[0])}</b><p>${richText(s?.args?.[1])}</p></div></li>`,
        )
        .join("")}</ol>`;
    case "Table": {
      const cols = asArray(a[0]).filter((c) => c?.type === "Col");
      const rows = Math.max(0, ...cols.map((c) => asArray(c.args?.[1]).length));
      return `<div class="ui-table-wrap"><table class="ui-table"><thead><tr>${cols.map((c) => `<th>${richText(c.args?.[0])}</th>`).join("")}</tr></thead><tbody>${Array.from(
        { length: rows },
        (_, r) =>
          `<tr>${cols.map((c) => `<td>${richText(asArray(c.args?.[1])[r])}</td>`).join("")}</tr>`,
      ).join("")}</tbody></table></div>`;
    }
    case "EntityList": {
      const rows = asArray(a[0]).filter(
        (row) => row && typeof row === "object",
      );
      return `<div class="ui-entity">${rows
        .map(
          (row) =>
            `<div><span>${richText(row.left)}</span><b class="${row.rightVariant === "number" ? "ui-num" : ""}">${richText(row.right)}</b></div>`,
        )
        .join("")}</div>`;
    }
    case "ListBlock":
      return `<div class="ui-list">${asArray(a[0])
        .map((it, i) => {
          const action = actionText(it?.args?.[4]);
          const label = valText(it?.args?.[3]);
          return `<div class="ui-list-item"><span class="ui-list-num">${a[1] === "image" ? icon("image", "sm") : i + 1}</span><div><b>${richText(it?.args?.[0])}</b>${it?.args?.[1] ? `<p>${richText(it.args[1])}</p>` : ""}</div>${
            action
              ? `<button type="button" class="ui-list-action" data-toassistant="${escapeHTML(action)}" aria-label="${escapeHTML(label || action)}">${icon("chevron_right", "sm")}</button>`
              : ""
          }</div>`;
        })
        .join("")}</div>`;
    case "TagBlock":
      return `<div class="ui-tags">${asArray(a[0])
        .map((t) =>
          t?.type === "Tag"
            ? `<span class="ui-tag">${richText(t.args?.[0])}</span>`
            : `<span class="ui-tag">${richText(t)}</span>`,
        )
        .join("")}</div>`;
    case "Tag":
      return `<span class="ui-tag">${richText(a[0])}</span>`;
    case "Form":
      return `<form class="ui-form" data-ui-form="${escapeHTML(valText(a[0]))}">${asArray(a[2]).map(renderNode).join("")}${renderButtons(a[1], true)}</form>`;
    case "FormControl": {
      const id = uiId("ui-field");
      const input = renderNode(a[1])
        .replace("<input ", `<input id="${id}" `)
        .replace("<textarea ", `<textarea id="${id}" `)
        .replace("<select ", `<select id="${id}" `);
      return `<div class="ui-field"><label class="ui-label" for="${id}">${richText(a[0])}</label>${input}${a[2] ? `<span class="ui-hint">${richText(a[2])}</span>` : ""}</div>`;
    }
    case "Input": {
      const rules = a[3] && typeof a[3] === "object" ? a[3] : {};
      return `<input class="ui-input" type="${escapeHTML(valText(a[2]) || "text")}" name="${escapeHTML(valText(a[0]))}" placeholder="${escapeHTML(valText(a[1]))}"${rules.required ? " required" : ""}>`;
    }
    case "TextArea": {
      const rules = a[3] && typeof a[3] === "object" ? a[3] : {};
      return `<textarea class="ui-input ui-textarea" name="${escapeHTML(valText(a[0]))}" placeholder="${escapeHTML(valText(a[1]))}" rows="${Number(a[2]) || 3}"${rules.required ? " required" : ""}></textarea>`;
    }
    case "Select":
      return `<select class="ui-select" name="${escapeHTML(valText(a[0]))}"><option value="" disabled selected>${escapeHTML(valText(a[2]) || "Elige una opción")}</option>${asArray(
        a[1],
      )
        .map(
          (it) =>
            `<option value="${escapeHTML(valText(it?.args?.[0]))}">${escapeHTML(valText(it?.args?.[1]))}</option>`,
        )
        .join("")}</select>`;
    case "Chips": {
      const type = a[1] === "multiple" ? "checkbox" : "radio";
      const name = escapeHTML(valText(a[0]));
      return `<div class="ui-chips">${asArray(a[2])
        .map(
          (it) =>
            `<label class="ui-chip"><input type="${type}" name="${name}" value="${escapeHTML(valText(it?.args?.[0]))}"><span>${escapeHTML(valText(it?.args?.[1]))}</span></label>`,
        )
        .join("")}</div>`;
    }
    case "OptionCards": {
      const type = a[1] === "multiple" ? "checkbox" : "radio";
      const name = escapeHTML(valText(a[0]));
      return `<div class="ui-option-cards">${asArray(a[2])
        .map(
          (it) =>
            `<label class="ui-option-card"><input type="${type}" name="${name}" value="${escapeHTML(valText(it?.args?.[0]))}"><span><b>${escapeHTML(valText(it?.args?.[1]))}</b>${it?.args?.[2] ? `<small>${escapeHTML(valText(it.args[2]))}</small>` : ""}</span></label>`,
        )
        .join("")}</div>`;
    }
    case "CheckBoxGroup":
    case "SwitchGroup":
      return `<div class="ui-checks">${asArray(a[1])
        .map(
          (it) =>
            `<label class="ui-check"><input type="checkbox" name="${escapeHTML(valText(a[0]))}" value="${escapeHTML(valText(it?.args?.[2] || valText(it?.args?.[0])))}"><span><b>${escapeHTML(valText(it?.args?.[0]))}</b>${it?.args?.[1] ? `<small>${escapeHTML(valText(it.args[1]))}</small>` : ""}</span></label>`,
        )
        .join("")}</div>`;
    case "RadioGroup":
      return `<div class="ui-checks">${asArray(a[1])
        .map(
          (it) =>
            `<label class="ui-check"><input type="radio" name="${escapeHTML(valText(a[0]))}" value="${escapeHTML(valText(it?.args?.[2]))}"><span><b>${escapeHTML(valText(it?.args?.[0]))}</b>${it?.args?.[1] ? `<small>${escapeHTML(valText(it.args[1]))}</small>` : ""}</span></label>`,
        )
        .join("")}</div>`;
    case "Buttons":
      return renderButtons(node);
    case "Button":
      return renderButtons(node);
    case "Link":
    case "TextLink": {
      const label = richText(a[0]);
      const href = normalizeHref(valText(a[1]));
      return href ? anchorHTML(label, escapeHTML(href)) : label;
    }
    case "FollowUpBlock":
      return `<div class="ui-follow"><span>${"Preguntas relacionadas"}</span>${asArray(
        a[0],
      )
        .map(
          (it) =>
            `<button type="button" class="ui-follow-item" data-toassistant="${escapeHTML(valText(it?.args?.[0]))}">${escapeHTML(valText(it?.args?.[0]))}</button>`,
        )
        .join("")}</div>`;
    case "Tabs": {
      const gid = uiId("ui-tabs");
      const items = asArray(a[0]);
      return `<div class="ui-tabs"><div class="ui-tablist" role="tablist">${items
        .map(
          (it, i) =>
            `<button type="button" role="tab" class="ui-tab${i === 0 ? " active" : ""}" data-ui-tab="${gid}-${i}">${escapeHTML(valText(it?.args?.[1]))}</button>`,
        )
        .join("")}</div>${items
        .map(
          (it, i) =>
            `<div class="ui-tabpanel" role="tabpanel" data-panel="${gid}-${i}"${i ? " hidden" : ""}>${asArray(it?.args?.[2]).map(renderNode).join("")}</div>`,
        )
        .join("")}</div>`;
    }
    case "SectionBlock":
    case "Accordion":
      return `<div class="ui-accordion">${asArray(a[0])
        .map(
          (it) =>
            `<details class="ui-accordion-item"><summary>${escapeHTML(valText(it?.args?.[1]))}</summary><div>${asArray(it?.args?.[2]).map(renderNode).join("")}</div></details>`,
        )
        .join("")}</div>`;
    case "CodeBlock":
      return `<pre class="ui-code"><code>${escapeHTML(valText(a[1]))}</code></pre>`;
    default: {
      const child = a.find((x) => Array.isArray(x));
      return child ? child.map(renderNode).join("") : richText(a[0]);
    }
  }
}
function renderProgramInto(mount, program) {
  if (!mount || typeof program !== "string") return false;
  try {
    const env = parseProgram(program);
    const root = resolveValue(env.root, env);
    if (!root) throw new Error("sin root");
    /* El modelo a veces devuelve un componente suelto como raíz (por ejemplo
       solo un Link): lo envolvemos en una Card en vez de perder la respuesta. */
    const card = root.type === "Card" ? root : { type: "Card", args: [root] };
    mount.innerHTML = renderNode(card);
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
function repairProgram(src) {
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
function renderPartialProgram(mount, program) {
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
    return true;
  } catch (err) {
    return false;
  }
}

/* ---------- Plantillas ---------- */
function cardHTML(msg) {
  const preamble = msg.preamble
    ? `<div class="preamble">${msg.preamble}</div>`
    : "";
  if (msg.pending) {
    return `${preamble}<div class="card card-pending"><div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span class="thinking-label">Ritchie AI está escribiendo<span class="thinking-ring" aria-hidden="true"></span></span></div></div>`;
  }
  if (msg.type === "openui") {
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
  return `${preamble}<div class="card is-error">
    <div class="status-row">
      <span class="status-ico">${icon("error", "lg")}</span>
      <div>
        <h3>No encontré una respuesta</h3>
        <p>${escapeHTML(msg.message || "No tengo información suficiente para responder esa pregunta con seguridad. Puedes reformularla con otras palabras o hablar con una persona.")}</p>
      </div>
    </div>
    <div class="actions">
      <button class="btn btn-filled" data-action="rephrase" data-q="${escapeHTML(msg.question || "")}">${icon("edit")}Reformular la pregunta</button>
      <button class="btn btn-tonal" data-action="tl">${icon("groups")}Hablar con el TL (Team Leader)</button>
    </div>
  </div>`;
}

function piiWarningHTML() {
  return `<div class="pii-warning">${icon("security", "lg")} <div><b>Protección de datos personales</b><p>Hemos detectado datos personales en tu mensaje. Por tu seguridad, fueron ocultados automáticamente. Ritchie AI nunca solicita ni almacena datos personales.</p></div></div>`;
}

function msgActionsHTML(node) {
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

function branchBarHTML(node) {
  const siblings = branchSiblings(node);
  if (siblings.length < 2) return "";
  const index = siblings.findIndex((n) => n.id === node.id);
  return `<div class="branch-bar" role="group" aria-label="Ramas del mensaje">
    <button class="branch-btn" type="button" data-action="branch-prev" data-msg-id="${node.id}" aria-label="Rama anterior">${icon("chevron_left", "sm")}</button>
    <span class="branch-count">Rama ${index + 1}/${siblings.length}</span>
    <button class="branch-btn" type="button" data-action="branch-next" data-msg-id="${node.id}" aria-label="Rama siguiente">${icon("chevron_right", "sm")}</button>
  </div>`;
}

function editFormHTML(text) {
  return `<form class="edit-form" data-edit-form>
    <textarea rows="2" aria-label="Editar mensaje">${escapeHTML(text)}</textarea>
    <div class="edit-actions">
      <button class="edit-btn" type="button" data-action="cancel-edit">Cancelar</button>
      <button class="edit-btn is-primary" type="submit">Guardar</button>
    </div>
  </form>`;
}

function appendMessage(msg, animate = true) {
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
  if (msg.type === "openui")
    renderProgramInto(wrap.querySelector(".ui-render"), msg.response);
  scrollDown();
  return wrap;
}

function showThinking() {
  const wrap = document.createElement("div");
  wrap.className = "msg bot is-thinking";
  wrap.id = "thinking";
  wrap.innerHTML =
    LOGO_MINI +
    `<div class="thinking">
    <span class="dots"><i></i><i></i><i></i></span>
    <span class="thinking-label">Ritchie AI está escribiendo<span class="thinking-ring" aria-hidden="true"></span></span>
  </div>`;
  messagesEl.appendChild(wrap);
  scrollDown();
}
const hideThinking = () => {
  const t = $("#thinking");
  if (t) t.remove();
};
const scrollDown = () =>
  requestAnimationFrame(() => (chat.scrollTop = chat.scrollHeight));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const STREAM_TAIL = `<span class="stream-ring" aria-hidden="true"></span>`;

/* Mientras llega el texto decidimos si es un programa OpenUI o prosa. En el
   primer caso dibujamos componentes reales con lo que ya viene; en el segundo,
   mostramos el texto como siempre. Nunca se ve el código fuente del programa. */
const PARTIAL_PROGRAM = /(^|\n)\s*[A-Za-z_$][\w$]*\s*=\s*\S/;
const PARTIAL_TOOL = /MOODLE_TOOL\s*\(/i;

/* El fragmento que está llegando termina con un círculo que late */
function renderStream(partial, card) {
  const clean = cleanResponse(partial);
  card.classList.add("card-ui");
  let mount = card.querySelector(".ui-render");
  if (!mount) {
    card.innerHTML = `<div class="ui-render"></div>`;
    mount = card.querySelector(".ui-render");
  }
  if (PARTIAL_TOOL.test(clean)) {
    mount.innerHTML = `<p class="stream-placeholder">Consultando Moodle${STREAM_TAIL}</p>`;
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
    item.innerHTML = `${icon("chat", "sm")}<span class="history-title">${escapeHTML(c.title)}</span><button class="history-del" data-del="${c.id}" aria-label="Eliminar conversación">${icon("delete", "sm")}</button>`;
    historyEl.appendChild(item);
  });
}

function renderChat() {
  messagesEl.innerHTML = "";
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
function ask(question, options = {}) {
  const opts =
    typeof options === "object" && options !== null
      ? options
      : { hidden: Boolean(options) };
  const hidden = Boolean(opts.hidden);
  const data = opts.data || null;
  question = String(question).trim();
  if (!question || busy) return;
  if (!current()) {
    const title = hidden ? "Encuesta respondida" : question.slice(0, 40);
    const conv = { id: uid(), title, nodes: [], activeLeafId: null };
    conversations.push(conv);
    currentId = conv.id;
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

function finishResponse(
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
  busy = false;
  updateSend();
  input.focus();
}

async function respond(
  question,
  { parentId = null, preamble = "", node = null } = {},
) {
  busy = true;
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
          const card = wrap.querySelector(".card");
          if (card) renderStream(partial, card);
        });
        result = resultFromText(cleanResponse(text), question);
      } catch (err) {
        /* Si el proveedor no soporta streaming, usamos la llamada normal */
        try {
          const text = await runAIWithTools(question, settings, () => {}, false);
          result = resultFromText(cleanResponse(text), question);
        } catch (e2) {
          result = {
            type: "error",
            question,
            message: `No se pudo conectar con ${PROVIDERS[settings.provider].label}: ${e2.message || "error desconocido"}. Revisa la key y el modelo en Configurar IA.`,
          };
        }
      }
    } else {
      // Sin key: el asistente responde con el motor local de demostración
      await pause(650);
      result = resolveAnswer(question);
    }
  } catch (err) {
    result = {
      type: "error",
      question,
      message: `No se pudo conectar con ${PROVIDERS[getSettings().provider].label}: ${err.message || "error desconocido"}. Revisa la key y el modelo en Configurar IA.`,
    };
  }
  hideThinking();
  finishResponse(result, {
    node: node || streamingNode,
    parentId,
    preamble,
    question,
  });
}

/* ---------- Acciones de mensajes: copiar, editar, rehacer y ramas ---------- */
function nodeText(node) {
  if (node.role === "user") return node.text || "";
  const wrap = messagesEl.querySelector(`.msg[data-id="${node.id}"]`);
  const card = wrap && wrap.querySelector(".card");
  if (!card) return node.short || node.message || "";
  const clone = card.cloneNode(true);
  clone
    .querySelectorAll(".source, .actions, .actions *")
    .forEach((el) => el.remove());
  return clone.innerText.trim() || node.short || "";
}

async function copyText(text) {
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

function flashCopied(btn, ok) {
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

function regenerate(botId) {
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

function switchBranch(id, delta) {
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

function saveEdit(id, text) {
  if (!text) return;
  const old = nodeById(id);
  if (!old || old.role !== "user") return;
  const safe = redactPII(text);
  const newNode = addNode({ role: "user", text: safe }, old.parentId);
  editingId = null;
  save();
  renderChat();
  renderHistory();
  respond(safe, {
    parentId: newNode.id,
    preamble: containsPII(text) ? piiWarningHTML() : "",
  });
}

async function handleMsgAction(btn) {
  const action = btn.dataset.action;
  const node = nodeById(btn.dataset.msgId || btn.closest(".msg")?.dataset.id);
  if (!node) return;
  if (action === "copy") {
    flashCopied(btn, await copyText(nodeText(node)));
    return;
  }
  if (busy) return;
  if (action === "edit") {
    editingId = node.id;
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

function updateSend() {
  sendBtn.disabled = busy || !input.value.trim();
}

/* ---------- Estado de conexión con la IA (según la key guardada) ---------- */
function refreshAIStatus() {
  const settings = getSettings();
  const notice = $("#aiOffNotice");
  const profileStatus = $("#profileStatus");
  const mobileAvatar = $("#mobileAvatar");
  const connected = Boolean(settings.apiKey);

  /* El estado se comunica con el color de la interfaz, sin textos de estado */
  document.body.classList.toggle("ai-off", !connected);
  if (notice) notice.hidden = connected;
  if (profileStatus) profileStatus.textContent = "Configurar IA (local)";
  if (mobileAvatar) {
    mobileAvatar.dataset.online = String(connected);
    mobileAvatar.title = "Configurar IA (local)";
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
  const btn = m.querySelector(".btn-filled, .ui-btn-primary");
  if (btn) btn.focus();
}
function closeModals() {
  document.querySelectorAll(".modal").forEach((m) => (m.hidden = true));
}
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
function closeMenu() {
  if (menuQuery.matches) setMenu(false);
}

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

const MSG_ACTIONS = [
  "copy",
  "edit",
  "redo",
  "branch-prev",
  "branch-next",
  "cancel-edit",
];
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
      editingId = null;
      renderChat();
      return;
    }
    handleMsgAction(act);
    return;
  }
  const doc = e.target.closest("[data-doc]");
  if (doc) {
    e.preventDefault();
    $("#docName").textContent = doc.dataset.doc;
    openModal("docModal");
    return;
  }
  if (!act) return;
  if (act.dataset.action === "tl") openSettings("tl");
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
  openSettings("tl");
});
$("#helpBtn").addEventListener("click", () => {
  closeMenu();
  openSettings("help");
});

/* ---------- Conexión con Moodle (solo usuario y contraseña) ---------- */
function updateMoodleUI() {
  const status = $("#moodleStatus");
  const panel = $("#moodleCourses");
  const cfg = getMoodle();
  if (status) {
    status.textContent = moodleContext
      ? `Conectado como ${moodleUser} · ${moodleCourses.length} cursos · ${moodleMaterials.length} materiales.`
      : "Sin conectar. Ingresa con tu usuario y contraseña de Moodle.";
  }
  if (!panel) return;
  panel.hidden = !moodleContext;
  if (!moodleContext) {
    panel.innerHTML = "";
    return;
  }
  const items = moodleMaterials
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

$("#moodleBtnSide")?.addEventListener("click", () => {
  closeMenu();
  $("#moodlePassword").value = "";
  updateMoodleUI();
  openSettings("moodle");
});
$("#moodleForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("#moodleStatus");
  const btn = e.target.querySelector('[type="submit"]');
  const base = getMoodle().base;
  status.textContent = "Ingresando a Moodle…";
  btn.disabled = true;
  try {
    const token = await moodleLogin(
      $("#moodleUsername").value.trim(),
      $("#moodlePassword").value,
    );
    /* La contraseña se descarta en cuanto obtuvimos el token */
    $("#moodlePassword").value = "";
    const info = await moodleConnect(token, base);
    status.textContent = `Conectado como ${info.fullname || moodleUser}.`;
    renderWelcome();
  } catch (err) {
    const msg = String(err.message || err);
    const detail = /invalidlogin|acceso inválido|contraseña|usuario/i.test(msg)
      ? "Revisa tu usuario y contraseña."
      : /contexto de curso|no accesible/i.test(msg)
        ? "Tu cuenta no tiene acceso a todos los cursos del sitio; ya solo consultamos tus cursos matriculados. Si persiste, pide al TL que active los servicios web."
        : "Revisa tus credenciales y que los servicios web estén activos.";
    status.textContent = `No se pudo ingresar: ${msg} ${detail}`;
  } finally {
    btn.disabled = false;
  }
});
$("#moodleDisconnect")?.addEventListener("click", () => {
  clearMoodle();
  $("#moodlePassword").value = "";
  updateMoodleUI();
  renderWelcome();
});

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
  modelSelect.innerHTML =
    p.models
      .map(
        (m) =>
          `<option value="${escapeHTML(m.value)}">${escapeHTML(m.label)}</option>`,
      )
      .join("") + `<option value="__custom__">Otro (escribir ID)</option>`;
  const known = p.models.some((m) => m.value === selected);
  modelSelect.value = known ? selected : "__custom__";
  customInput.value = known ? "" : selected || "";
  customField.hidden = known;
}

function readModel() {
  const provider = PROVIDERS[providerSel.value] ? providerSel.value : "gemini";
  return modelSelect.value === "__custom__"
    ? customInput.value.trim() || PROVIDERS[provider].defaultModel
    : modelSelect.value;
}

function activateSettingsTab(name) {
  document.querySelectorAll(".settings-tab").forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    const panel = document.getElementById(tab.getAttribute("aria-controls"));
    if (panel) panel.hidden = !active;
  });
}

function updateHistoryStats() {
  const el = $("#historyStats");
  if (!el) return;
  const total = conversations.reduce(
    (n, c) => n + (c.nodes ? c.nodes.length : 0),
    0,
  );
  el.innerHTML =
    `<div class="stat"><b>${conversations.length}</b><span>Conversaciones</span></div>` +
    `<div class="stat"><b>${total}</b><span>Mensajes</span></div>`;
  $("#deleteCurrent").disabled = !current();
}

function openSettings(tab = "ia") {
  const s = getSettings();
  providerSel.value = s.provider;
  keyInput.value = s.apiKey;
  populateModels(s.provider, s.model);
  helpText.textContent = PROVIDERS[s.provider].help;
  activateSettingsTab(tab);
  updateHistoryStats();
  openModal("settingsModal");
}
/* El perfil del usuario es la entrada a la configuración local de la IA */
$("#profileBtn").addEventListener("click", () => {
  closeMenu();
  openSettings();
});

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
    helpText.textContent =
      "✔ Conexión correcta. Guarda para usarla en este navegador.";
  } catch (err) {
    helpText.textContent = `✘ ${err.message || "No se pudo conectar"}`;
  } finally {
    btn.disabled = false;
  }
});

/* ---------- Secciones de configuración ---------- */
const settingsTabs = document.querySelector(".settings-tabs");
const tabsQuery = window.matchMedia("(max-width: 600px)");
/* En móvil las pestañas forman una barra horizontal; en escritorio, una columna */
function syncTabsOrientation() {
  if (settingsTabs)
    settingsTabs.setAttribute(
      "aria-orientation",
      tabsQuery.matches ? "horizontal" : "vertical",
    );
}
tabsQuery.addEventListener("change", syncTabsOrientation);
syncTabsOrientation();

document.querySelectorAll(".settings-tab").forEach((tab) => {
  tab.addEventListener("click", () => activateSettingsTab(tab.dataset.tab));
});
document.querySelectorAll("[data-settings-tab]").forEach((btn) => {
  btn.addEventListener("click", () =>
    activateSettingsTab(btn.dataset.settingsTab),
  );
});

$("#exportHistory").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(conversations, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ritchie-ia-historial.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$("#deleteCurrent").addEventListener("click", () => {
  if (!current() || !confirm("¿Borrar la conversación actual?")) return;
  conversations = conversations.filter((c) => c.id !== currentId);
  currentId = null;
  save();
  renderHistory();
  renderChat();
  updateHistoryStats();
});

$("#clearHistory").addEventListener("click", () => {
  if (
    !conversations.length ||
    !confirm(
      "¿Borrar todas las conversaciones? Esta acción no se puede deshacer.",
    )
  )
    return;
  conversations = [];
  currentId = null;
  save();
  renderHistory();
  renderChat();
  updateHistoryStats();
});

document.querySelectorAll(".modal").forEach((m) =>
  m.addEventListener("click", (e) => {
    if (e.target === m || e.target.closest("[data-close]")) closeModals();
  }),
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModals();
    closeMenu();
  }
});

function startNewChat() {
  if (busy) return;
  currentId = null;
  editingId = null;
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
    save();
    renderChat();
    renderHistory();
    return;
  }
  const item = e.target.closest(".history-item");
  if (item && !busy) {
    currentId = item.dataset.id;
    editingId = null;
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
  openSettings();
});
$("#aiOffConfigBtn").addEventListener("click", () => {
  closeMenu();
  openSettings();
});
$("#scrim").addEventListener("click", () => setMenu(false));
menuQuery.addEventListener("change", (e) => setMenu(!e.matches));

/* ---------- Inicio ---------- */
setMenu(!menuQuery.matches);
load();
renderHistory();
renderChat();
refreshAIStatus();
updateMoodleUI();

/* Si ya hay un token guardado, recuperamos los materiales al abrir la app. */
(() => {
  const cfg = getMoodle();
  if (cfg.token)
    moodleConnect(cfg.token, cfg.base)
      .then(() => renderWelcome())
      .catch(() => {});
})();
