import { $ } from '../core/dom.js';
import { S, busy, conversations, currentId, editingId, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from '../core/state.js';
import { extractProtocolCalls } from '../moodle/client.js';
export const DEVICE_INFO_FIELDS = [
  "datetime",
  "date",
  "time",
  "timezone",
  "language",
  "platform",
  "device",
  "screen",
  "viewport",
  "pixelratio",
  "online",
  "network",
  "battery",
  "memory",
  "cpu",
  "preferences",
];
export const DEVICE_FIELD_SET = new Set(DEVICE_INFO_FIELDS);
export const DEVICE_LABELS = {
  datetime: "Fecha y hora ISO",
  date: "Fecha local",
  time: "Hora local",
  timezone: "Zona horaria",
  language: "Idioma del navegador",
  platform: "Plataforma",
  device: "Tipo de dispositivo",
  screen: "Pantalla",
  viewport: "Ventana visible",
  pixelratio: "Densidad de píxeles",
  online: "Conectado a internet",
  network: "Tipo de conexión",
  battery: "Batería",
  memory: "Memoria aproximada",
  cpu: "Procesador",
  preferences: "Preferencias visuales",
};
export const DEVICE_ICONS = {
  datetime: "calendar_month",
  date: "event",
  time: "schedule",
  timezone: "public",
  language: "translate",
  platform: "computer",
  device: "smartphone",
  screen: "monitor",
  viewport: "crop_free",
  pixelratio: "gradient",
  online: "wifi",
  network: "network_check",
  battery: "battery_full",
  memory: "memory",
  cpu: "developer_board",
  preferences: "visibility",
};
export const extractDeviceCalls = (text) => extractProtocolCalls(text, "DEVICE_INFO");
export function deviceRequestedKeys(order) {
  const raw =
    order && (order.keys || order.fields || order.key || order.field);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const keys = list
    .map((k) => String(k).trim().toLowerCase())
    .filter((k) => DEVICE_FIELD_SET.has(k));
  return keys.length ? [...new Set(keys)] : [...DEVICE_INFO_FIELDS];
}
export const twoDigits = (n) => String(n).padStart(2, "0");
export function deviceClock() {
  const d = new Date();
  return {
    datetime: d.toISOString(),
    date: d.toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
  };
}
export function withTimeout(promise, ms) {
  return Promise.race([
    Promise.resolve(promise).catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}
export async function deviceInfoSnapshot(keys = DEVICE_INFO_FIELDS) {
  const want = new Set(keys);
  const out = {};
  const nav = typeof navigator !== "undefined" ? navigator : {};
  const win = typeof window !== "undefined" ? window : {};
  const clock = deviceClock();
  ["datetime", "date", "time"].forEach((k) => {
    if (want.has(k)) out[k] = clock[k];
  });
  if (want.has("timezone")) {
    let zone = "";
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (e) {}
    const minutes = -new Date().getTimezoneOffset();
    const sign = minutes >= 0 ? "+" : "-";
    const offset = `${sign}${twoDigits(Math.floor(Math.abs(minutes) / 60))}:${twoDigits(Math.abs(minutes) % 60)}`;
    out.timezone = `${zone || "zona local"} (UTC${offset})`;
  }
  if (want.has("language")) out.language = nav.language || "no disponible";
  const ua = nav.userAgent || "";
  const rawPlatform =
    (nav.userAgentData && nav.userAgentData.platform) || nav.platform || "";
  if (want.has("platform")) out.platform = rawPlatform || "no disponible";
  if (want.has("device")) {
    const touch = nav.maxTouchPoints || 0;
    out.device = /iPad|Tablet/i.test(ua)
      ? "tableta"
      : /Android|iPhone|iPod|Mobile/i.test(ua) || (touch > 1 && /Mac/i.test(rawPlatform))
        ? "móvil"
        : "computador";
  }
  const screen = win.screen || {};
  if (want.has("screen"))
    out.screen =
      screen.width && screen.height
        ? `${screen.width} x ${screen.height} px`
        : "no disponible";
  if (want.has("viewport"))
    out.viewport = `${win.innerWidth || 0} x ${win.innerHeight || 0} px`;
  if (want.has("pixelratio")) out.pixelratio = win.devicePixelRatio || 1;
  if (want.has("online"))
    out.online =
      typeof nav.onLine === "boolean" ? nav.onLine : "no disponible";
  if (want.has("network")) {
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};
    out.network = conn.effectiveType || conn.type || "no disponible";
  }
  if (want.has("battery")) {
    const battery =
      typeof nav.getBattery === "function"
        ? await withTimeout(nav.getBattery(), 500)
        : null;
    out.battery = battery
      ? `${Math.round((Number(battery.level) || 0) * 100)}% · ${battery.charging ? "cargando" : "sin cargar"}`
      : "no disponible";
  }
  if (want.has("memory"))
    out.memory = nav.deviceMemory
      ? `${nav.deviceMemory} GB (aprox.)`
      : "no disponible";
  if (want.has("cpu"))
    out.cpu = nav.hardwareConcurrency
      ? `${nav.hardwareConcurrency} núcleos`
      : "no disponible";
  if (want.has("preferences")) {
    const matches = (query) =>
      typeof win.matchMedia === "function" && win.matchMedia(query).matches;
    out.preferences = `${matches("(prefers-color-scheme: dark)") ? "tema oscuro" : "tema claro"} · ${matches("(prefers-reduced-motion: reduce)") ? "movimiento reducido" : "movimiento normal"}`;
  }
  return out;
}
export async function applyDeviceInfo(order) {
  const data = await deviceInfoSnapshot(deviceRequestedKeys(order));
  return (
    `Datos reales del dispositivo consultados ahora: ${JSON.stringify(data)}. ` +
    "Usa estos valores literales; no asumas otra fecha, hora ni equipo."
  );
}

/* ---------- Navegación por las URLs que aparecen en Moodle ----------
   Los servicios REST devuelven enlaces reales (course/view.php,
   mod/.../view.php, pluginfile.php...). El modelo los "abre" con
   MOODLE_OPEN: validamos el enlace, sacamos sus identificadores y traemos los
   datos asociados para llegar hasta el material concreto. Solo lectura. */
