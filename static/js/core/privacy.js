import { $ } from './dom.js';
import { S, busy, conversations, currentId, editingId, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from './state.js';
export const PII_PATTERNS = [
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
/* Las llamadas a herramientas viajan como parámetros: redactar su contenido
   rompería una escritura (por ejemplo, un correo en MOODLE_WRITE). */
export function protocolSpans(text) {
  const markers = [
    "MOODLE_WRITE",
    "MOODLE_TOOL",
    "MOODLE_VERIFY",
    "MOODLE_OPEN",
    "DEVICE_INFO",
    "CHAT_LIST",
    "CHAT_READ",
    "CHAT_WRITE",
  ];
  const re = new RegExp(`(?:${markers.join("|")})\\s*\\(`, "gi");
  const spans = [];
  let match;
  while ((match = re.exec(text))) {
    let i = re.lastIndex;
    let depth = 1;
    let quote = false;
    let esc = false;
    for (; i < text.length && depth > 0; i++) {
      const c = text[i];
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
    if (depth === 0) spans.push([match.index, i]);
    re.lastIndex = i;
  }
  return spans;
}
export function redactSegment(text) {
  let cleaned = text;
  PII_PATTERNS.forEach(({ regex, label }) => {
    cleaned = cleaned.replace(new RegExp(regex.source, regex.flags), label);
  });
  return cleaned;
}
export function redactPII(text, keepTools = false) {
  const src = String(text == null ? "" : text);
  const spans = keepTools ? protocolSpans(src) : [];
  if (!spans.length) return redactSegment(src);
  let out = "";
  let pos = 0;
  spans.forEach(([start, end]) => {
    out += redactSegment(src.slice(pos, start)) + src.slice(start, end);
    pos = end;
  });
  return out + redactSegment(src.slice(pos));
}
export function containsPII(text) {
  return PII_PATTERNS.some(({ regex }) =>
    new RegExp(regex.source, regex.flags).test(text),
  );
}

/* Temas sensibles: se derivan a una persona */
export const SENSITIVE = [
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
  /* Calificaciones y compañeros ya se responden con datos reales de Moodle. */
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
  "decidir sobre",
];

/* ---------- Estado ---------- */
