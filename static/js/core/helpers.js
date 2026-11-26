import { $ } from './dom.js';
import { S, busy, conversations, currentId, editingId, getMoodle, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from './state.js';
import { moodleDirectURL } from '../moodle/client.js';
export function compactMoodleValue(value, depth = 0) {
  if (typeof value === "string")
    return value.length > 700 ? value.slice(0, 700) + "…" : value;
  if (Array.isArray(value)) {
    const head = value.slice(0, 20).map((v) => compactMoodleValue(v, depth + 1));
    return value.length > 20
      ? [...head, `… (+${value.length - 20} elementos)`]
      : head;
  }
  if (value && typeof value === "object" && depth < 8) {
    const out = {};
    Object.entries(value)
      .slice(0, 40)
      .forEach(([k, v]) => {
        out[k] = compactMoodleValue(v, depth + 1);
      });
    return out;
  }
  return value;
}
export function compactMoodleResult(data) {
  let text = JSON.stringify(compactMoodleValue(data));
  if (text && text.length > 8000) text = text.slice(0, 8000) + "… (recortado)";
  return text;
}
export function withTimeout(promise, ms) {
  return Promise.race([
    Promise.resolve(promise).catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}
export const moodleCleanText = (v, max = 400) =>
  String(v == null ? "" : v)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/* ---------- Trabajos/tareas: detalle real, no un aviso genérico ---------- */
export function moodleTaskURL(a) {
  const direct = moodleDirectURL(a && a.url);
  if (direct) return direct;
  const cmid = Number(a && a.cmid);
  if (cmid > 0) return `${getMoodle().base}/mod/assign/view.php?id=${cmid}`;
  return "";
}
export function moodleTaskSummary(t) {
  const parts = [`- ${t.name} [trabajo] · ${t.course}`];
  if (t.due) parts.push(`Fecha límite: ${t.due}`);
  if (t.intro) parts.push(`Instrucciones: ${t.intro}`);
  if (t.grade) parts.push(`Nota máxima: ${t.grade}`);
  if (t.types) parts.push(`Modalidad: ${t.types}`);
  if (t.url) parts.push(`Enlace: ${t.url}`);
  return parts.join(" · ");
}
export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
