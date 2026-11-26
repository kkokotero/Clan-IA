import { buildSystemPrompt } from './prompt.js';
import { load } from '../chat/model.js';
import { richText } from '../chat/render.js';
import { $, chat } from '../core/dom.js';
import { redactPII } from '../core/privacy.js';
import { S, busy, conversations, currentId, editingId, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from '../core/state.js';
export const PROVIDERS = {
  gemini: {
    label: "Google Gemini",
    keyUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-4-hydrogen",
    help: "Consigue tu key en aistudio.google.com/apikey. Los modelos 3.8/3.6/3.5 Flash y 2.5 daban 503 o están deprecados; se ofrecen los Gemini 4 vigentes.",
    models: [
      {
        value: "gemini-4-hydrogen",
        label: "Gemini 4 Hydrogen (recomendado)",
      },
      { value: "gemini-4-carbon", label: "Gemini 4 Carbon (avanzado)" },
      { value: "gemini-4-neon", label: "Gemini 4 Neon (rápido)" },
      { value: "gemini-4-argon", label: "Gemini 4 Argon" },
      {
        value: "gemini-3.5-flash-lite",
        label: "Gemini 3.5 Flash-Lite (económico)",
      },
    ],
  },
  openrouter: {
    label: "OpenRouter",
    keyUrl: "https://openrouter.ai/keys",
    defaultModel: "openrouter/free",
    help: "Consigue tu key en openrouter.ai/keys. 'openrouter/free' elige uno disponible; la lista se amplía con los modelos gratuitos vigentes del catálogo público.",
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
      {
        value: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        label: "Nemotron 3 Nano Omni",
      },
      { value: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B" },
      { value: "google/gemma-4-31b-it:free", label: "Gemma 4 31B" },
      { value: "inclusionai/ling-3.2-flash:free", label: "Ling 3.2 Flash" },
      { value: "liquid/lfm-3-1.7b:free", label: "LFM 3 1.7B" },
      { value: "particle-ai/particle-1:free", label: "Particle 1" },
      { value: "recursive/flint-v1.0:free", label: "Flint v1.0" },
    ],
  },
  groq: {
    label: "Groq",
    keyUrl: "https://console.groq.com/keys",
    defaultModel: "openai/gpt-oss-120b",
    help: "Key gratuita en console.groq.com/keys. Plan free: 30 peticiones/minuto y 1.000/día por modelo.",
    models: [
      { value: "openai/gpt-oss-120b", label: "GPT-OSS 120B (recomendado)" },
      { value: "openai/gpt-oss-20b", label: "GPT-OSS 20B (rápido)" },
      { value: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B" },
      { value: "qwen/qwen3.6-27b", label: "Qwen 3.6 27B" },
      { value: "groq/compound", label: "Groq Compound" },
      { value: "groq/compound-mini", label: "Groq Compound Mini" },
    ],
  },
  cerebras: {
    label: "Cerebras",
    keyUrl: "https://cloud.cerebras.ai/",
    defaultModel: "gpt-oss-120b",
    help: "Key gratuita en cloud.cerebras.ai. Capa free permanente: 1M tokens/día y 30 peticiones/minuto.",
    models: [
      { value: "gpt-oss-120b", label: "GPT-OSS 120B (recomendado)" },
      { value: "qwen-3.8-27b", label: "Qwen 3.8 27B" },
      { value: "llama-4-scout", label: "Llama 4 Scout" },
      { value: "llama3.1-8b", label: "Llama 3.1 8B (rápido)" },
      { value: "qwen-3-32b", label: "Qwen 3 32B" },
    ],
  },
  mistral: {
    label: "Mistral AI",
    keyUrl: "https://console.mistral.ai/api-keys",
    defaultModel: "mistral-small-latest",
    help: "Key en console.mistral.ai. La Plateforme tiene capa gratuita experimental con límites de uso.",
    models: [
      { value: "mistral-small-latest", label: "Mistral Small (recomendado)" },
      { value: "mistral-medium-latest", label: "Mistral Medium" },
      { value: "mistral-large-latest", label: "Mistral Large" },
      { value: "ministral-8b-latest", label: "Ministral 8B" },
      { value: "ministral-3b-latest", label: "Ministral 3B" },
      { value: "codestral-latest", label: "Codestral" },
    ],
  },
  huggingface: {
    label: "Hugging Face",
    keyUrl: "https://huggingface.co/settings/tokens",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct",
    help: "Token read en huggingface.co/settings/tokens. Cuenta free incluye $0.10/mes de crédito en Inference Providers.",
    models: [
      {
        value: "meta-llama/Llama-3.3-70B-Instruct",
        label: "Llama 3.3 70B Instruct (recomendado)",
      },
      { value: "Qwen/Qwen3.8-27B", label: "Qwen 3.8 27B" },
      { value: "Qwen/Qwen3-32B", label: "Qwen 3 32B" },
      {
        value: "deepseek-ai/DeepSeek-V4.1-Flash",
        label: "DeepSeek V4.1 Flash",
      },
      { value: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
      { value: "zai-org/GLM-5.3-Flash", label: "GLM 5.3 Flash" },
    ],
  },
};

/* Proveedores que hablan el protocolo de chat de OpenAI. Todos permiten CORS
   desde el navegador, así que la key viaja directamente al proveedor. */
const OPENAI_COMPATIBLE = {
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    headers: () => ({
      "HTTP-Referer": (typeof location !== "undefined" && location.origin) || "https://localhost",
      "X-Title": "Clan IA",
    }),
  },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions" },
  cerebras: { url: "https://api.cerebras.ai/v1/chat/completions" },
  mistral: { url: "https://api.mistral.ai/v1/chat/completions" },
  huggingface: { url: "https://router.huggingface.co/v1/chat/completions" },
};

/* El catálogo de OpenRouter es público y admite CORS. Lo consultamos sin key
   para añadir modelos gratuitos nuevos sin tener que tocar el código. Si falla,
   seguimos con la lista incluida arriba. */
const OPENROUTER_CATALOG = 'https://openrouter.ai/api/v1/models';
let catalogPromise = null;

export function refreshOpenRouterModels() {
  if (!catalogPromise) {
    catalogPromise = fetch(OPENROUTER_CATALOG, { credentials: 'omit' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        const productos = PROVIDERS.openrouter.models;
        const vistos = new Set(productos.map((m) => m.value));
        const nuevos = (data?.data || [])
          .filter(
            (m) =>
              String(m?.pricing?.prompt) === '0' &&
              String(m?.pricing?.completion) === '0' &&
              !String(m?.id || '').includes(':batch') &&
              (m?.architecture?.output_modalities || []).join(',') === 'text' &&
              (m?.endpoints || []).includes('/api/v1/chat/completions') &&
              !vistos.has(m.id),
          )
          .map((m) => {
            const nombre = String(m.name || m.id);
            return {
              value: m.id,
              label: `${nombre.includes(': ') ? nombre.split(': ').slice(1).join(': ') : nombre} (gratis)`,
            };
          });
        productos.push(...nuevos);
        return nuevos.length;
      })
      .catch(() => 0);
  }
  return catalogPromise;
}

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

async function callOpenAI(question, settings, system, proveedor = "openrouter") {
  const api = OPENAI_COMPATIBLE[proveedor] || OPENAI_COMPATIBLE.openrouter;
  const res = await fetch(api.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`,
      ...(api.headers ? api.headers() : {}),
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
  if (!res.ok)
    throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text.trim()) throw new Error("el modelo devolvió una respuesta vacía");
  return text;
}

export const callOpenRouter = (question, settings, system) =>
  callOpenAI(question, settings, system, "openrouter");
export const callGroq = (question, settings, system) =>
  callOpenAI(question, settings, system, "groq");
export const callCerebras = (question, settings, system) =>
  callOpenAI(question, settings, system, "cerebras");
export const callMistral = (question, settings, system) =>
  callOpenAI(question, settings, system, "mistral");
export const callHuggingFace = (question, settings, system) =>
  callOpenAI(question, settings, system, "huggingface");

export function cleanResponse(raw) {
  // Algunos modelos envuelven el programa en bloques ```; los quitamos antes de renderizar.
  return redactPII(raw, true)
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```\s*$/, "")
    .replace(/FINISH\s*\(\s*\)/gi, "")
    .trim();
}

export function resultFromText(clean, question) {
  const notFound =
    "No encontré esa información en tu Moodle con los datos disponibles. Prueba a pedirla con otro nombre o consulta tus cursos y materiales.";
  if (/^\s*(NO_SE|MOODLE_NOT_FOUND)\s*$/i.test(clean))
    return { type: "error", question, message: notFound };
  const isProgram = /(^|\n)\s*[A-Za-z_$][\w$]*\s*=\s*[A-Za-z_$]/.test(clean);
  if (isProgram) {
    /* El texto escrito antes de las herramientas se conserva sobre la UI. */
    const intro = clean
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^[A-Za-z_$][\w$]*\s*=/.test(l));
    return { type: "ui", response: clean, intro };
  }
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
      raw = await apiFor(settings.provider).call(q, { ...settings, model }, system);
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

async function streamOpenAI(question, settings, system, onChunk, proveedor = "openrouter") {
  const api = OPENAI_COMPATIBLE[proveedor] || OPENAI_COMPATIBLE.openrouter;
  const res = await fetch(api.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`,
      ...(api.headers ? api.headers() : {}),
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
    throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
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

export const streamOpenRouter = (q, s, system, onChunk) =>
  streamOpenAI(q, s, system, onChunk, "openrouter");
export const streamGroq = (q, s, system, onChunk) =>
  streamOpenAI(q, s, system, onChunk, "groq");
export const streamCerebras = (q, s, system, onChunk) =>
  streamOpenAI(q, s, system, onChunk, "cerebras");
export const streamMistral = (q, s, system, onChunk) =>
  streamOpenAI(q, s, system, onChunk, "mistral");
export const streamHuggingFace = (q, s, system, onChunk) =>
  streamOpenAI(q, s, system, onChunk, "huggingface");

const API = {
  gemini: { call: callGemini, stream: streamGemini },
  openrouter: { call: callOpenRouter, stream: streamOpenRouter },
  groq: { call: callGroq, stream: streamGroq },
  cerebras: { call: callCerebras, stream: streamCerebras },
  mistral: { call: callMistral, stream: streamMistral },
  huggingface: { call: callHuggingFace, stream: streamHuggingFace },
};
const apiFor = (provider) => API[provider] || API.gemini;

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
      const raw = await apiFor(settings.provider).stream(q, s, system, onChunk);
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
