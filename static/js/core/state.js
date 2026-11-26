import { $ } from './dom.js';
export const STORAGE_KEY = "ritchie-ia-historial";
export const SETTINGS_KEY =
  "ritchie-ia-config-ia"; /* la key vive SOLO en este navegador */
export const MOODLE_KEY = "ritchie-ia-moodle"; /* sesión de Moodle, SOLO en este navegador */
export const MOODLE_DEFAULT_BASE = "https://moodle.riwi.io";
export const MOODLE_SERVICE = "moodle_mobile_app";
export let moodleMemory = null;
export let moodleUser = "";
export let moodleUserId = 0;
export let moodleCourses = [];
export let moodleMaterials = [];
/* Detalles reales de los trabajos/tareas (instrucciones, entrega y enlace). */
export let moodleTasks = [];
export let moodleContext = "";
export let moodleFunctions = [];
/* Catálogo sin filtrar: las funciones de escritura no entran en moodleFunctions
   pero sí se necesitan para validar MOODLE_WRITE. */
export let moodleAllFunctions = [];
export let moodlePeople = [];
export let moodlePeopleIds = new Set();
export let moodleCMIds = [];
/* Memoria de la navegación por URLs: el modelo sigue los enlaces que aparecen
   en los datos de Moodle para llegar al contenido concreto. */
export let moodleContents = {};
export let moodleURLs = [];
export let moodleEvents = [];
/* El token se guarda al ingresar; el resto de datos de Moodle NO se descarga
   en bloque: se consulta bajo demanda con MOODLE_TOOL / MOODLE_OPEN. */
export let moodleSessionReady = false;
export let moodleSessionPromise = null;
export let moodleProfileContext = "";
export let lastMoodleError = "";
export function normalizeMoodle(s) {
  const rawBase = typeof s?.base === "string" ? s.base.trim() : "";
  return {
    token: typeof s?.token === "string" ? s.token.trim() : "",
    name: typeof s?.name === "string" ? s.name.trim() : "",
    base: /^https:\/\//i.test(rawBase)
      ? rawBase.replace(/\/+$/, "")
      : MOODLE_DEFAULT_BASE,
  };
}
export function getMoodle() {
  if (moodleMemory) return normalizeMoodle(moodleMemory);
  try {
    const raw = localStorage.getItem(MOODLE_KEY);
    return normalizeMoodle(raw ? JSON.parse(raw) : null);
  } catch (e) {
    return normalizeMoodle(null);
  }
}
export function saveMoodle(s) {
  moodleMemory = normalizeMoodle(s);
  try {
    localStorage.setItem(MOODLE_KEY, JSON.stringify(moodleMemory));
  } catch (e) {}
}
/* Quita todo lo leído de Moodle sin tocar el token: permite cambiar de cuenta
   sin arrastrar cursos ni materiales de la sesión anterior. */
export function resetMoodleData() {
  moodleSessionReady = false;
  moodleSessionPromise = null;
  moodleUser = "";
  moodleUserId = 0;
  moodleCourses = [];
  moodleMaterials = [];
  moodleTasks = [];
  moodleContext = "";
  moodleProfileContext = "";
  moodleFunctions = [];
  moodleAllFunctions = [];
  moodlePeople = [];
  moodlePeopleIds = new Set();
  moodleCMIds = [];
  moodleContents = {};
  moodleURLs = [];
  moodleEvents = [];
  lastMoodleError = "";
}
export function clearMoodle() {
  moodleMemory = null;
  resetMoodleData();
  try {
    localStorage.removeItem(MOODLE_KEY);
  } catch (e) {}
}

/* Web services REST de Moodle. El endpoint responde con CORS abierto, así que
   el navegador puede llamarlo directamente: no hace falta servidor propio. */
export let memorySettings = null;
export let conversations = [];
export let currentId = null;
export let busy = false;
export let editingId = null;
/* Estado compartido: los imports son bindings de solo lectura */
export const S = {
  get moodleMemory() { return moodleMemory; },
  set moodleMemory(v) { moodleMemory = v; },
  get moodleUser() { return moodleUser; },
  set moodleUser(v) { moodleUser = v; },
  get moodleUserId() { return moodleUserId; },
  set moodleUserId(v) { moodleUserId = v; },
  get moodleCourses() { return moodleCourses; },
  set moodleCourses(v) { moodleCourses = v; },
  get moodleMaterials() { return moodleMaterials; },
  set moodleMaterials(v) { moodleMaterials = v; },
  get moodleTasks() { return moodleTasks; },
  set moodleTasks(v) { moodleTasks = v; },
  get moodleContext() { return moodleContext; },
  set moodleContext(v) { moodleContext = v; },
  get moodleFunctions() { return moodleFunctions; },
  set moodleFunctions(v) { moodleFunctions = v; },
  get moodleAllFunctions() { return moodleAllFunctions; },
  set moodleAllFunctions(v) { moodleAllFunctions = v; },
  get moodlePeople() { return moodlePeople; },
  set moodlePeople(v) { moodlePeople = v; },
  get moodlePeopleIds() { return moodlePeopleIds; },
  set moodlePeopleIds(v) { moodlePeopleIds = v; },
  get moodleCMIds() { return moodleCMIds; },
  set moodleCMIds(v) { moodleCMIds = v; },
  get moodleContents() { return moodleContents; },
  set moodleContents(v) { moodleContents = v; },
  get moodleURLs() { return moodleURLs; },
  set moodleURLs(v) { moodleURLs = v; },
  get moodleEvents() { return moodleEvents; },
  set moodleEvents(v) { moodleEvents = v; },
  get moodleSessionReady() { return moodleSessionReady; },
  set moodleSessionReady(v) { moodleSessionReady = v; },
  get moodleSessionPromise() { return moodleSessionPromise; },
  set moodleSessionPromise(v) { moodleSessionPromise = v; },
  get moodleProfileContext() { return moodleProfileContext; },
  set moodleProfileContext(v) { moodleProfileContext = v; },
  get lastMoodleError() { return lastMoodleError; },
  set lastMoodleError(v) { lastMoodleError = v; },
  get memorySettings() { return memorySettings; },
  set memorySettings(v) { memorySettings = v; },
  get conversations() { return conversations; },
  set conversations(v) { conversations = v; },
  get currentId() { return currentId; },
  set currentId(v) { currentId = v; },
  get busy() { return busy; },
  set busy(v) { busy = v; },
  get editingId() { return editingId; },
  set editingId(v) { editingId = v; },
};

