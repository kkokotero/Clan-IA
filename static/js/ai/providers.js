import { buildSystemPrompt } from './prompt.js';
import { load } from '../chat/model.js';
import { richText } from '../chat/render.js';
import { $, chat } from '../core/dom.js';
import { redactPII } from '../core/privacy.js';
import { S, busy, conversations, currentId, editingId, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from '../core/state.js';
export const PROVIDERS = {
  gemini: {
    label: "Google Gemini",
    defaultModel: "gemini-4-hydrogen",
    help: "Consigue tu key en aistudio.google.com/apikey. Los modelos 3.8/3.6 Flash daban 503 y ya no se ofrecen.",
    models: [
      {
        value: "gemini-4-hydrogen",
        label: "Gemini 4 Hydrogen (recomendado)",
      },
      {
        value: "gemini-3.5-flash-lite",
        label: "Gemini 3.5 Flash-Lite (rápido)",
      },
    ],
  },
  openrouter: {
    label: "OpenRouter",
    defaultModel: "openrouter/free",
    help: "Consigue tu key en openrouter.ai/keys. Modelos disponibles vigentes (nov 2026); 'openrouter/free' elige uno disponible.",
    models: [
      { value: "openrouter/free", label: "OpenRouter (recomendado)" },
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

/* Los errores del proveedor se convierten en tarjetas comprensibles: nunca se
   muestra al usuario el texto técnico completo (URLs, límites, modelos…). */
export function aiErrorInfo(err, providerLabel, model) {
  const raw = String((err && err.message) || err || "error desconocido");
  const lower = raw.toLowerCase();
  const provider = providerLabel || "El proveedor de IA";
  const retry = raw.match(
    /retry in\s+(\d+(?:[.,]\d+)?)\s*(s|seg|segundos|seconds?|m|min|minutes?)?/i,
  );
  let wait = "";
  if (retry) {
    const amount = Number(String(retry[1]).replace(",", "."));
    const unit = (retry[2] || "s").toLowerCase();
    const seconds = /m|min/.test(unit) ? amount * 60 : amount;
    wait = seconds < 60
      ? ` en unos ${Math.max(1, Math.ceil(seconds))} segundos`
      : ` en unos ${Math.ceil(seconds / 60)} minutos`;
  }
  if (
    /quota|rate.?limit|too many requests|429|resource_exhausted|exceeded|per minute|per day|please retry/i.test(
      lower,
    )
  )
    return {
      kind: "quota",
      title: "Límite de uso alcanzado",
      message: `${provider} agotó temporalmente su cuota${wait}. No es un problema de tu clave: espera un momento o cambia de modelo/proveedor en Configurar IA.`,
    };
  if (/invalid|unauthor|401|403|api key|expired|credential/i.test(lower))
    return {
      kind: "key",
      title: "La clave no fue aceptada",
      message: `${provider} rechazó la clave guardada. Abre Configurar IA y pega una clave válida, o elige otro proveedor.`,
    };
  if (/model.*not found|404|does not exist|unsupported model/i.test(lower))
    return {
      kind: "model",
      title: "El modelo no está disponible",
      message: `${provider} no encontró el modelo ${model || "elegido"}. Abre Configurar IA y selecciona otro de la lista.`,
    };
  if (
    /fetch|network|load failed|cors|offline|timeout|aborted|socket|failed to connect/i.test(
      lower,
    )
  )
    return {
      kind: "connection",
      title: "No se pudo conectar",
      message: `No hubo respuesta de ${provider}. Revisa tu conexión e inténtalo de nuevo; si continúa, cambia de proveedor en Configurar IA.`,
    };
  if (/vacía|empty/i.test(lower))
    return {
      kind: "empty",
      title: "El modelo no devolvió texto",
      message: `${provider} terminó la respuesta sin contenido. Vuelve a intentarlo o cambia de modelo en Configurar IA.`,
    };
  return {
    kind: "error",
    title: "No encontré una respuesta",
    message: `${provider}: ${raw.length > 180 ? `${raw.slice(0, 180)}…` : raw}`,
  };
}

export function aiErrorResult(err, question, settings) {
  const info = aiErrorInfo(
    err,
    PROVIDERS[settings.provider]?.label,
    settings.model,
  );
  return { type: "error", kind: info.kind, title: info.title, question, message: info.message };
}

/* El prompt de Moodle es la única fuente: no hay documentos de demostración. */
export const DEVICE_QUESTION =
  /hora|fecha (actual|de hoy)|qu[eé] (fecha|d[ií]a)|zona horaria|dispositivo|equipo|pantalla|bater[ií]a|conexi[oó]n|sistema operativo|idioma del navegador|memoria|procesador/i;
/* ---------- IA gratuita: el navegador llama directamente al proveedor ---------- */
export async function callGemini(question, settings, system) {
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

export async function callOpenRouter(question, settings, system) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`,
      "HTTP-Referer":
        (typeof location !== "undefined" && location.origin) ||
        "https://localhost",
      "X-Title": "Clan IA",
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

export function cleanResponse(raw) {
  // Algunos modelos envuelven el programa en bloques ```; los quitamos antes de renderizar.
  return redactPII(raw, true)
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

export function resultFromText(clean, question) {
  const notFound =
    "No encontré esa información en tu Moodle con los datos disponibles. Prueba a pedirla con otro nombre o consulta tus cursos y materiales.";
  if (/^\s*(NO_SE|MOODLE_NOT_FOUND)\s*$/i.test(clean))
    return { type: "error", question, message: notFound };
  const isProgram = /(^|\n)\s*[A-Za-z_$][\w$]*\s*=\s*[A-Za-z_$]/.test(clean);
  if (isProgram) return { type: "ui", response: clean };
  /* Respuesta en texto: se muestra con el mismo estilo que el resto del chat */
  const lines = clean
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

export async function askAI(question, settings, context = "") {
  const system = buildSystemPrompt();
  const q = question + context;
  const models = PROVIDERS[settings.provider].models.map((m) => m.value);
  const ordered = [
    settings.model,
    ...models.filter((m) => m !== settings.model),
  ].filter(Boolean);
  let raw = "";
  let lastError = null;

  /* Si el modelo está saturado (503/429) probamos con el siguiente de la lista */
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
        /503|429|quota|rate.?limit|exceeded|UNAVAILABLE|RESOURCE_EXHAUSTED|overload|high demand/i.test(
          err.message || "",
        );
      if (!retryable) break;
    }
  }
  if (lastError) throw lastError;
  /* Devuelve texto crudo: el bucle de herramientas lo inspecciona y el
     llamado final lo convierte con resultFromText(). */
  return cleanResponse(raw);
}

/* ---------- Respuesta en tiempo real (SSE) ---------- */
export async function readSSE(res, onData) {
  if (!res.body || !res.body.getReader) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const handleLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    try {
      onData(JSON.parse(payload));
    } catch (e) {
      /* evento incompleto */
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) handleLine(line);
  }
  /* El último evento puede llegar sin salto de línea: sin esto se pierde el
     final de la respuesta y la tarjeta se queda a medias. */
  buffer += decoder.decode();
  if (buffer.trim()) handleLine(buffer);
}

export async function streamGemini(question, settings, system, onChunk) {
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

export async function streamOpenRouter(question, settings, system, onChunk) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`,
      "HTTP-Referer":
        (typeof location !== "undefined" && location.origin) ||
        "https://localhost",
      "X-Title": "Clan IA",
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

export async function streamAI(question, settings, onChunk, context = "") {
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
        /503|429|quota|rate.?limit|exceeded|UNAVAILABLE|RESOURCE_EXHAUSTED|overload|high demand/i.test(
          err.message || "",
        );
      if (!retryable) break;
      onChunk(""); // descarta el partial del modelo caído
    }
  }
  /* Si el streaming terminó sin texto, repetimos la pregunta sin streaming
     para no dejar la respuesta cortada a mitad. */
  const respuesta = await askAI(question, settings, context);
  if (respuesta) return respuesta;
  if (lastError) throw lastError;
  return "";
}

/* El historial de navegación se limita para no agotar la ventana del modelo */
