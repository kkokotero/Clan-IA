/* Bucle genérico de herramientas: detecta los markers presentes en la respuesta
   del modelo, carga solo esos módulos y los ejecuta. No importa ninguna
   herramienta por adelantado. */
import { DEVICE_QUESTION, askAI, cleanResponse, streamAI } from './providers.js';
import { stripCalls } from './protocol.js';
import { normalize } from '../core/dom.js';
import { compactMoodleResult } from '../core/helpers.js';
import { S, getMoodle } from '../core/state.js';
import { MARKERS, TOOLS, detect, hasCalls, run, toolForMarker } from './tools/index.js';
import { maybe as autoDiscover } from './tools/auto-discover.js';
import { demand as verifyDemand } from './tools/verify-policy.js';

const MOODLE_MAX_STEPS = 12;
const MOODLE_MAX_LOG_ENTRIES = 8;
const MOODLE_MAX_CONTEXT = 24000;

export function buildMoodleToolLog(entries, step) {
  if (!entries.length) return "";
  const blocks = entries.map(
    (e, i) =>
      `--- Herramienta (${i + 1}) ---\n` +
      `Consulta: ${e.fn}${Object.keys(e.params || {}).length ? ` ${JSON.stringify(e.params)}` : ""}\n` +
      `Resultado: ${compactMoodleResult(e.data)}`,
  );
  let log = "";
  while (blocks.length) {
    log =
      "\n\n" +
      blocks.join("\n\n") +
      `\n\nPuedes seguir escribiendo y consultando (paso ${step}/${MOODLE_MAX_STEPS}) o devolver el programa final de componentes. Si una consulta falló, corrige los parámetros.`;
    if (log.length <= MOODLE_MAX_CONTEXT) break;
    blocks.shift();
  }
  return log;
}

async function ejecutarConHerramientas(question, settings, onChunk, useStream = true) {
  const emit = typeof onChunk === "function" ? onChunk : () => {};
  const ctx = {
    question,
    settings,
    emit,
    entries: [],
    rejectedNames: [],
    verifiedAny: false,
    autoDescubierto: false,
    verificacionPedida: false,
    moodleData: S.moodleCourses.length > 0 || S.moodleMaterials.length > 0,
  };
  S.lastMoodleError = "";
  const toolNotes = [];
  const contenidoPrevio = [];
  const ejecutadas = new Set();
  let cola = Promise.resolve();

  /* Ejecutamos cada herramienta en cuanto su llamada queda completa, incluso
     mientras el modelo sigue escribiendo. El texto ya mostrado se conserva. */
  const ejecutarLlamadas = (llamadas) => {
    for (const [marker, orders] of Object.entries(llamadas)) {
      const tool = toolForMarker(marker);
      if (!tool) continue;
      for (const order of orders) {
        const clave = `${marker}::${JSON.stringify(order)}`;
        if (ejecutadas.has(clave)) continue;
        ejecutadas.add(clave);
        const nombre = TOOLS.find((t) => t.marker === marker)?.nombre || marker;
        emit(`TOOL_STATUS:: ${nombre}`);
        cola = cola.then(async () => {
          const nota = await run(tool.id, order, ctx);
          if (nota) toolNotes.push(nota);
        });
      }
    }
  };

  const alFragmento = (partial) => {
    if (!partial) return; // streamAI usa "" para descartar un modelo caído
    const visible = stripCalls(cleanResponse(partial), MARKERS).trim();
    emit(`TEXT:: ${visible}`);
    if (useStream) ejecutarLlamadas(detect(partial));
  };

  const hablar = async (contexto, paso) => {
    emit(`STEP:: ${paso}`);
    if (!useStream) return askAI(question, settings, contexto);
    return streamAI(question, settings, alFragmento, contexto);
  };

  let text = await hablar("", 1);
  await cola;

  for (let step = 1; step <= MOODLE_MAX_STEPS; step++) {
    const termino = /FINISH\s*\(\s*\)/i.test(text);
    const clean = cleanResponse(text);
    const llamadas = detect(clean);

    if (!hasCalls(clean)) {
      if (termino) break;
      const esPrograma = /(^|\n)\s*[A-Za-z_$][\w$]*\s*=\s*[A-Za-z_$]/.test(clean);
      const esMoodle = !DEVICE_QUESTION.test(question) && Boolean(getMoodle().token);
      const nota =
        !esPrograma && esMoodle
          ? await autoDiscover(question, ctx)
          : esPrograma && esMoodle && !ctx.verifiedAny
            ? verifyDemand(ctx)
            : null;
      if (nota) {
        toolNotes.push(nota);
        const escrito = stripCalls(clean, MARKERS).trim();
        if (escrito) contenidoPrevio.push(escrito);
        text = await hablar("\n\n" + nota, step + 1);
        await cola;
        continue;
      }
      break;
    }

    /* Sin streaming no hubo fragmentos: ejecutamos aquí las llamadas leídas. */
    const escrito = stripCalls(clean, MARKERS).trim();
    if (escrito) contenidoPrevio.push(escrito);
    ejecutarLlamadas(llamadas);
    await cola;

    if (ctx.entries.length > MOODLE_MAX_LOG_ENTRIES)
      ctx.entries.splice(0, ctx.entries.length - MOODLE_MAX_LOG_ENTRIES);
    const registro = buildMoodleToolLog(ctx.entries, step);
    const notas = toolNotes.length
      ? "\n\n--- Herramientas ejecutadas (paso " +
        step +
        "/" +
        MOODLE_MAX_STEPS +
        ") ---\n" +
        toolNotes.slice(-6).join("\n\n")
      : "";
    text = await hablar(registro + notas, step + 1);
    await cola;
  }

  const final = cleanResponse(text);
  if (hasCalls(final)) return "MOODLE_NOT_FOUND";
  if (getMoodle().token) {
    const plano = normalize(final);
    if (
      ctx.rejectedNames.some((nombre) => plano.includes(normalize(nombre).trim()))
    )
      return "MOODLE_NOT_FOUND";
  }
  const especial = /^\s*(NO_SE|MOODLE_NOT_FOUND)\s*$/i.test(final);
  if (contenidoPrevio.length && final && !especial)
    return [...contenidoPrevio, final].join("\n\n");
  return text;
}

/* Guardia: si el proveedor o una herramienta no responde, devolvemos un error
   en vez de dejar la tarjeta en "Escribiendo" indefinidamente. */
export async function runAIWithTools(question, settings, onChunk, useStream = true) {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(
      () => rechazar(new Error("La respuesta tardó demasiado. Inténtalo de nuevo.")),
      90000,
    );
  });
  try {
    return await Promise.race([
      ejecutarConHerramientas(question, settings, onChunk, useStream),
      limite,
    ]);
  } finally {
    clearTimeout(temporizador);
  }
}
