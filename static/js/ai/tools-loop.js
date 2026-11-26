import { applyDeviceInfo, extractDeviceCalls } from './device.js';
import { DEVICE_QUESTION, askAI, cleanResponse, streamAI } from './providers.js';
import { $, app, normalize } from '../core/dom.js';
import { compactMoodleResult } from '../core/helpers.js';
import { S, busy, conversations, currentId, editingId, getMoodle, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from '../core/state.js';
import { MOODLE_MAX_CONTEXT, MOODLE_MAX_LOG_ENTRIES, MOODLE_MAX_STEPS, collectMoodleCMIds, collectMoodleURLs, extractMoodleCalls, extractOpenCalls, extractProtocolCalls, moodleRequest, moodleToolAllowed } from '../moodle/client.js';
import { ensureMoodleSession, ingestMoodleResult } from '../moodle/session.js';
import { applyChatWrite, applyMoodleOpen, applyMoodleWrite, chatListResult, chatReadResult, moodleVerifyResult } from '../moodle/tools.js';
export function buildMoodleToolLog(entries, step) {
  if (!entries.length) return "";
  const blocks = entries.map(
    (e, i) =>
      `--- Navegación Moodle (${i + 1}) ---\n` +
      `Consulta: ${e.fn}${Object.keys(e.params).length ? ` ${JSON.stringify(e.params)}` : ""}\n` +
      `Resultado: ${compactMoodleResult(e.data)}`,
  );
  let log = "";
  while (blocks.length) {
    log =
      "\n\n" +
      blocks.join("\n\n") +
      `\n\nPuedes seguir consultando (paso ${step}/${MOODLE_MAX_STEPS}) o devolver SOLO el programa final de componentes. Si una consulta falló, prueba otra función o corrige los parámetros.`;
    if (log.length <= MOODLE_MAX_CONTEXT) break;
    blocks.shift();
  }
  return log;
}

/* Bucle de herramientas: la IA puede consultar fecha/hora/dispositivo con
   DEVICE_INFO, abrir enlaces con MOODLE_OPEN y consultar REST con MOODLE_TOOL. */
export async function runAIWithTools(question, settings, onChunk, useStream = true) {
  /* Una sola llamada ligera para saber quién pregunta y qué funciones hay.
     El resto de Moodle se pide con herramientas, nunca al registrarse. */
  if (getMoodle().token) await ensureMoodleSession().catch(() => {});
  const emit = typeof onChunk === "function" ? onChunk : () => {};
  const entries = [];
  const toolNotes = [];
  const rejectedNames = [];
  let verifiedAny = false;
  S.lastMoodleError = "";
  let autoDescubierto = false;
  let verificacionPedida = false;
  let text = useStream
    ? await streamAI(question, settings, emit, "")
    : await askAI(question, settings, "");
  for (let step = 1; step <= MOODLE_MAX_STEPS; step++) {
    const clean = cleanResponse(text);
    const deviceCalls = extractDeviceCalls(clean);
    const verifyCalls = extractProtocolCalls(clean, "MOODLE_VERIFY");
    const openCalls = extractOpenCalls(clean);
    const calls = extractMoodleCalls(clean);
    const chatListCalls = extractProtocolCalls(clean, "CHAT_LIST");
    const chatReadCalls = extractProtocolCalls(clean, "CHAT_READ");
    const chatWriteCalls = extractProtocolCalls(clean, "CHAT_WRITE");
    const writeCalls = extractProtocolCalls(clean, "MOODLE_WRITE");
    if (
      !deviceCalls.length &&
      !verifyCalls.length &&
      !openCalls.length &&
      !calls.length &&
      !chatListCalls.length &&
      !chatReadCalls.length &&
      !chatWriteCalls.length &&
      !writeCalls.length
    ) {
      /* La IA respondió sin consultar nada: antes de rendirse, se descubren
         los cursos con UNA llamada. Sigue siendo bajo demanda: no se descarga
         el paquete completo, solo lo mínimo para poder responder. */
      const preguntaMoodle =
        !DEVICE_QUESTION.test(question) &&
        !(getMoodle().token && S.moodleCourses.length) &&
        !(getMoodle().token && S.moodleMaterials.length);
      if (preguntaMoodle && !autoDescubierto && getMoodle().token && S.moodleUserId) {
        autoDescubierto = true;
        try {
          const data = await moodleRequest("core_enrol_get_users_courses", {
            userid: S.moodleUserId,
          });
          ingestMoodleResult("core_enrol_get_users_courses", data);
          const nota =
            "Descubrí tus cursos reales en Moodle: " +
            compactMoodleResult(data) +
            ". Usa SOLO estos datos para responder y verifícalos con MOODLE_VERIFY.";
          toolNotes.push(nota);
          text = await askAI(question, settings, "\n\n" + nota);
          continue;
        } catch (err) {
          const nota = "No pude consultar tus cursos en Moodle con esos datos. Si no puedes responder con información real, responde exactamente MOODLE_NOT_FOUND.";
          toolNotes.push(nota);
          text = await askAI(question, settings, "\n\n" + nota);
          continue;
        }
      }
      /* Con Moodle conectado, ningún nombre se da por válido sin verificarlo. */
      const isProgram = /(^|\n)\s*[A-Za-z_$][\w$]*\s*=\s*[A-Za-z_$]/.test(clean);
      if (
        (S.moodleContext || getMoodle().token) &&
        !verifiedAny &&
        isProgram &&
        !verificacionPedida &&
        !DEVICE_QUESTION.test(question)
      ) {
        verificacionPedida = true;
        const demand =
          'Aún no verificaste los nombres. Antes de responder, llama a MOODLE_VERIFY({"names":[...]}) con TODOS los cursos, materiales, actividades y preguntas relacionadas que vayas a nombrar; usa solo los que devuelva como válidos. Si no puedes verificar lo que piden, responde exactamente MOODLE_NOT_FOUND.';
        toolNotes.push(demand);
        text = await askAI(question, settings, "\n\n" + demand);
        continue;
      }
      break;
    }
    emit("");
    for (const order of deviceCalls)
      toolNotes.push(await applyDeviceInfo(order));
    if (S.moodleContext || getMoodle().token) {
      for (const order of verifyCalls) {
        const check = moodleVerifyResult(order);
        toolNotes.push(check.note);
        check.invalid.forEach((name) => {
          if (name.length >= 5 && !rejectedNames.includes(name))
            rejectedNames.push(name);
        });
        verifiedAny = true;
      }
      for (const order of openCalls)
        toolNotes.push(await applyMoodleOpen(order));
      const sinParametros = new Set([
        "core_webservice_get_site_info",
        "core_country_get_countries",
      ]);
      for (const call of calls) {
        let data;
        if (!moodleToolAllowed(call.fn)) {
          data = { error: `Función no disponible o no permitida: ${call.fn}` };
        } else if (
          !Object.keys(call.params || {}).length &&
          !sinParametros.has(call.fn)
        ) {
          data = { error: `Faltan parámetros válidos para ${call.fn}` };
        } else {
          try {
            data = await moodleRequest(call.fn, call.params);
            if (call.fn === "core_course_get_contents") collectMoodleCMIds(data);
            collectMoodleURLs(data);
          } catch (err) {
            data = { error: String(err.message || err) };
          }
        }
        entries.push({ fn: call.fn, params: call.params, data });
        /* Lo consultado se recuerda: sirve para verificar nombres y para el
           contexto de los siguientes pasos sin volver a descargarlo. */
        ingestMoodleResult(call.fn, data);
        if (call.fn === "core_course_get_contents" && Array.isArray(data))
          S.moodleContents[call.params.courseid] = data;
        /* Los compañeros descubiertos sirven como destinatarios válidos de mensajes. */
        if (call.fn === "core_enrol_get_enrolled_users" && Array.isArray(data))
          data.forEach((u) => {
            const id = Number(u && u.id);
            if (id) S.moodlePeopleIds.add(id);
          });
      }
      for (const order of writeCalls)
        toolNotes.push(await applyMoodleWrite(order));
    }
    for (const order of chatListCalls) toolNotes.push(chatListResult(order));
    for (const order of chatReadCalls) toolNotes.push(chatReadResult(order));
    for (const order of chatWriteCalls)
      toolNotes.push(await applyChatWrite(order));
    if (entries.length > MOODLE_MAX_LOG_ENTRIES)
      entries.splice(0, entries.length - MOODLE_MAX_LOG_ENTRIES);
    const toolLog = toolNotes.length
      ? "\n\n--- Herramientas ejecutadas (paso " +
        step +
        "/" +
        MOODLE_MAX_STEPS +
        ") ---\n" +
        toolNotes.slice(-6).join("\n\n") +
        "\nCon estos datos puedes seguir consultando o devolver SOLO el programa final de componentes."
      : "";
    text = await askAI(question, settings, buildMoodleToolLog(entries, step) + toolLog);
  }
  const finalClean = cleanResponse(text);
  /* Si el modelo se queda pidiendo herramientas, nunca mostramos el protocolo. */
  if (
    extractDeviceCalls(finalClean).length ||
    extractProtocolCalls(finalClean, "MOODLE_VERIFY").length ||
    extractOpenCalls(finalClean).length ||
    extractMoodleCalls(finalClean).length ||
    extractProtocolCalls(finalClean, "MOODLE_WRITE").length ||
    extractProtocolCalls(finalClean, "CHAT_LIST").length ||
    extractProtocolCalls(finalClean, "CHAT_READ").length ||
    extractProtocolCalls(finalClean, "CHAT_WRITE").length
  )
    return "MOODLE_NOT_FOUND";
  /* Última red de seguridad: nada de lo marcado como NO ENCONTRADO puede
     aparecer en la respuesta, y los nombres sin verificar no se muestran. */
  if (S.moodleContext || getMoodle().token) {
    const flat = normalize(finalClean);
    if (rejectedNames.some((name) => flat.includes(normalize(name).trim())))
      return "MOODLE_NOT_FOUND";
  }
  return text;
}

/* ---------- Render propio del lenguaje de la IA (estética de la app) ----------
   Interpretamos "nombre = Componente(...)" y dibujamos HTML con las clases de
   la app: el dibujo es 100% propio de la app. */
