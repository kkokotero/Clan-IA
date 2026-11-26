import { cleanResponse } from '../ai/providers.js';
import { ask } from './flow.js';
import { branchSiblings } from './model.js';
import { $, LOGO_MINI, chat, escapeHTML, form, icon, input, messagesEl } from '../core/dom.js';
import { S, busy, conversations, currentId, editingId, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from '../core/state.js';
export let uiSeq = 0;
export const uiId = (prefix) => `${prefix}-${++uiSeq}`;

/* Acciones de los formularios: el estado se devuelve a la IA como contexto oculto */
export function handleOpenUIAction(action) {
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
export function programToText(program) {
  const strings = program.match(/"((?:\\.|[^"\\])*)"/g) || [];
  return strings.map((s) => s.slice(1, -1).replace(/\\"/g, '"')).join(" · ");
}

/* --- Intérprete mínimo del lenguaje de componentes --- */
export function splitArgs(src) {
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
export function closeIndex(src, open, close) {
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
export function parseValue(src) {
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
export function parseProgram(src) {
  const env = {};
  src.split(/\r?\n/).forEach((line) => {
    const m = line.trim().match(/^([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+)$/);
    if (m) env[m[1]] = parseValue(m[2]);
  });
  return env;
}
export function resolveValue(v, env, seen = new Set()) {
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
export const valText = (v) =>
  v == null ? "" : typeof v === "object" ? "" : String(v);
export const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

/* Enlaces en el texto de la IA: markdown [etiqueta](https://...) o URLs sueltas.
   El texto ya está escapado, así que solo se aceptan esquemas http/https. */
export const MD_LINK = /\[([^\]\n]+)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)/gi;
export const BARE_URL = /(^|[\s(])((?:https?:\/\/|www\.)[^\s<>()]+)/gi;
export const formatInline = (s) =>
  s
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>");
export const normalizeHref = (raw) => {
  const s = String(raw).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^www\./i.test(s)) return `https://${s}`;
  return null;
};
export const anchorHTML = (label, href) =>
  `<a class="ui-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
export function richText(v) {
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
export function actionText(v) {
  if (!v) return "";
  if (Array.isArray(v)) return actionText(v[0]);
  return v.step === "ToAssistant" ? valText(v.args?.[0]) : "";
}

/* --- Dibujo de los componentes soportados --- */
export function renderButtons(node, inForm = false) {
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
export function renderNode(node) {
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
export function renderProgramInto(mount, program) {
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
export function repairProgram(src) {
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
export function renderPartialProgram(mount, program) {
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
export function cardHTML(msg) {
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
  const looksLikeAIFailure =
    msg.kind && ["quota", "key", "model", "connection", "empty"].includes(msg.kind);
  const errorLook = {
    quota: ["is-quota", "schedule"],
    key: ["is-key", "key"],
    model: ["is-model", "smart_toy"],
    connection: ["is-connection", "wifi_off"],
    empty: ["is-empty", "smart_toy"],
    error: ["is-error", "error"],
  }[msg.kind] || ["is-error", "error"];
  const questionAttr = escapeHTML(msg.question || "");
  const retryButton = `<button class="btn btn-filled" data-action="retry-ai" data-q="${questionAttr}">${icon("refresh")}Reintentar</button>`;
  const settingsButton = `<button class="btn btn-tonal" data-action="open-ai-settings">${icon("settings")}Configurar IA</button>`;
  const actions = looksLikeAIFailure
    ? msg.kind === "key" || msg.kind === "model"
      ? settingsButton + retryButton
      : retryButton + settingsButton
    : `<button class="btn btn-filled" data-action="rephrase" data-q="${questionAttr}">${icon("edit")}Reformular la pregunta</button>
       <button class="btn btn-tonal" data-action="tl">${icon("groups")}Hablar con el TL (Team Leader)</button>`;
  return `${preamble}<div class="card ${errorLook[0]}">
    <div class="status-row">
      <span class="status-ico">${icon(errorLook[1], "lg")}</span>
      <div>
        <h3>${escapeHTML(msg.title || "No encontré una respuesta")}</h3>
        <p>${escapeHTML(msg.message || "No tengo información suficiente para responder esa pregunta con seguridad. Puedes reformularla con otras palabras o hablar con una persona.")}</p>
      </div>
    </div>
    <div class="actions">${actions}</div>
  </div>`;
}

export function piiWarningHTML() {
  return `<div class="pii-warning">${icon("security", "lg")} <div><b>Protección de datos personales</b><p>Hemos detectado datos personales en tu mensaje. Por tu seguridad, fueron ocultados automáticamente. Ritchie AI nunca solicita ni almacena datos personales.</p></div></div>`;
}

export function msgActionsHTML(node) {
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

export function branchBarHTML(node) {
  const siblings = branchSiblings(node);
  if (siblings.length < 2) return "";
  const index = siblings.findIndex((n) => n.id === node.id);
  return `<div class="branch-bar" role="group" aria-label="Ramas del mensaje">
    <button class="branch-btn" type="button" data-action="branch-prev" data-msg-id="${node.id}" aria-label="Rama anterior">${icon("chevron_left", "sm")}</button>
    <span class="branch-count">Rama ${index + 1}/${siblings.length}</span>
    <button class="branch-btn" type="button" data-action="branch-next" data-msg-id="${node.id}" aria-label="Rama siguiente">${icon("chevron_right", "sm")}</button>
  </div>`;
}

export function editFormHTML(text) {
  return `<form class="edit-form" data-edit-form>
    <textarea rows="2" aria-label="Editar mensaje">${escapeHTML(text)}</textarea>
    <div class="edit-actions">
      <button class="edit-btn" type="button" data-action="cancel-edit">Cancelar</button>
      <button class="edit-btn is-primary" type="submit">Guardar</button>
    </div>
  </form>`;
}

export function appendMessage(msg, animate = true) {
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

export function showThinking() {
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
export const hideThinking = () => {
  const t = $("#thinking");
  if (t) t.remove();
};
export const scrollDown = (instant = false) =>
  requestAnimationFrame(() => {
    if (instant) {
      /* El desplazamiento suave puede dejar la vista arriba cuando la
         respuesta crece de golpe: al terminar queremos verla completa. */
      const previous = chat.style.scrollBehavior;
      chat.style.scrollBehavior = "auto";
      chat.scrollTop = chat.scrollHeight;
      chat.style.scrollBehavior = previous;
    } else {
      chat.scrollTop = chat.scrollHeight;
    }
  });
export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const STREAM_TAIL = `<span class="stream-ring" aria-hidden="true"></span>`;

/* Mientras llega el texto decidimos si es un programa OpenUI o prosa. En el
   primer caso dibujamos componentes reales con lo que ya viene; en el segundo,
   mostramos el texto como siempre. Nunca se ve el código fuente del programa. */
export const PARTIAL_PROGRAM = /(^|\n)\s*[A-Za-z_$][\w$]*\s*=\s*\S/;
export const PARTIAL_TOOL = /MOODLE_(?:TOOL|OPEN|VERIFY)\s*\(/i;
export const PARTIAL_VERIFY = /MOODLE_VERIFY\s*\(/i;
export const PARTIAL_WRITE = /MOODLE_WRITE\s*\(/i;
export const PARTIAL_CHAT = /CHAT_(?:LIST|READ|WRITE)\s*\(/i;
export const PARTIAL_DEVICE = /DEVICE_INFO\s*\(/i;

/* El fragmento que está llegando termina con un círculo que late */
export function renderStream(partial, card) {
  const clean = cleanResponse(partial);
  card.classList.add("card-ui");
  let mount = card.querySelector(".ui-render");
  if (!mount) {
    card.innerHTML = `<div class="ui-render"></div>`;
    mount = card.querySelector(".ui-render");
  }
  if (PARTIAL_DEVICE.test(clean)) {
    mount.innerHTML = `<p class="stream-placeholder">Consultando fecha, hora y dispositivo${STREAM_TAIL}</p>`;
    return;
  }
  if (PARTIAL_VERIFY.test(clean)) {
    mount.innerHTML = `<p class="stream-placeholder">Verificando nombres en Moodle${STREAM_TAIL}</p>`;
    return;
  }
  if (PARTIAL_WRITE.test(clean)) {
    mount.innerHTML = `<p class="stream-placeholder">Preparando cambio en Moodle${STREAM_TAIL}</p>`;
    return;
  }
  if (PARTIAL_CHAT.test(clean)) {
    mount.innerHTML = `<p class="stream-placeholder">Consultando tus chats${STREAM_TAIL}</p>`;
    return;
  }
  if (PARTIAL_TOOL.test(clean)) {
    mount.innerHTML = `<p class="stream-placeholder">Recorriendo Moodle${STREAM_TAIL}</p>`;
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
