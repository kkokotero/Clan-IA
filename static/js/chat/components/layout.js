/* Componentes de estructura y contenido: tarjetas, encabezados, texto,
   avisos, pestañas y bloques plegables. */
import { escapeHTML } from '../../core/dom.js';
import { register, renderChildren } from './registry.js';
import { asArray, richText, safeIconHTML, uiId, valText } from './primitives.js';

register("Card", (a) => `<div class="ui-card">${renderChildren(a)}</div>`);
register("CardHeader", (a) =>
  `<div class="ui-header">${safeIconHTML(a[2], "lg")}<div><b>${richText(a[0])}</b>${a[1] ? `<span>${richText(a[1])}</span>` : ""}</div></div>`);
register("InlineHeader", (a) =>
  `<div class="ui-inline-header">${safeIconHTML(a[2])}<b>${richText(a[0])}</b>${a[1] ? `<span>${richText(a[1])}</span>` : ""}</div>`);
const textKind = (value) =>
  ["small", "large", "small-heavy", "large-heavy"].includes(value) ? value : "default";
register("TextContent", (a) =>
  `<p class="ui-text ui-text-${textKind(a[1])}">${safeIconHTML(a[2])}${richText(a[0])}</p>`);
register("MarkDownRenderer", (a) =>
  `<p class="ui-text ui-text-${textKind(a[1])}">${safeIconHTML(a[2])}${richText(a[0])}</p>`);
register("Callout", (a) => {
  const variant = a[0] === "danger" ? "error" : a[0] || "neutral";
  return `<div class="ui-callout ui-callout-${escapeHTML(variant)}">${safeIconHTML(a[3], "lg")}<div><b>${richText(a[1])}</b>${a[2] ? `<p>${richText(a[2])}</p>` : ""}</div></div>`;
});
register("TextCallout", (a) => {
  const variant = a[0] === "danger" ? "error" : a[0] || "neutral";
  return `<div class="ui-callout ui-callout-${escapeHTML(variant)}">${safeIconHTML(a[3], "lg")}<div><b>${richText(a[1])}</b>${a[2] ? `<p>${richText(a[2])}</p>` : ""}</div></div>`;
});
register("Separator", () => "<hr class=\"ui-sep\">");
register("Tabs", (a) => {
  const gid = uiId("ui-tabs");
  const items = asArray(a[0]);
  return `<div class="ui-tabs"><div class="ui-tablist" role="tablist">${items
    .map(
      (it, i) =>
        `<button type="button" role="tab" class="ui-tab${i === 0 ? " active" : ""}" data-ui-tab="${gid}-${i}">${safeIconHTML(it?.args?.[3])}${escapeHTML(valText(it?.args?.[1]))}</button>`,
    )
    .join("")}</div>${items
    .map(
      (it, i) =>
        `<div class="ui-tabpanel" role="tabpanel" data-panel="${gid}-${i}"${i ? " hidden" : ""}>${renderChildren(it?.args?.[2])}</div>`,
    )
    .join("")}</div>`;
});
register("SectionBlock", (a) =>
  `<div class="ui-accordion">${asArray(a[0])
    .map(
      (it) =>
        `<details class="ui-accordion-item"><summary>${safeIconHTML(it?.args?.[3])}${escapeHTML(valText(it?.args?.[1]))}</summary><div>${renderChildren(it?.args?.[2])}</div></details>`,
    )
    .join("")}</div>`);
register("Accordion", (a) =>
  `<div class="ui-accordion">${asArray(a[0])
    .map(
      (it) =>
        `<details class="ui-accordion-item"><summary>${safeIconHTML(it?.args?.[3])}${escapeHTML(valText(it?.args?.[1]))}</summary><div>${renderChildren(it?.args?.[2])}</div></details>`,
    )
    .join("")}</div>`);
const resaltar = (codigo, lenguaje) => {
  let out = escapeHTML(codigo);
  const tokens = [];
  const guardar = (re, cls) => {
    out = out.replace(re, (m) => {
      const t = `\u0000T${tokens.length}\u0000`;
      tokens.push(`<span class="${cls}">${m}</span>`);
      return t;
    });
  };
  guardar(/\/\/[^\n]*/g, "tok-com");
  guardar(/#[^\n]*/g, "tok-com");
  guardar(/&quot;(?:[^&]|&(?!quot;))*&quot;/g, "tok-str");
  guardar(/'(?:[^'\\]|\\.)*'/g, "tok-str");
  guardar(/`(?:[^`\\]|\\.)*`/g, "tok-str");
  guardar(/\b\d+(?:\.\d+)?\b/g, "tok-num");
  const palabras = ["false","true","null","const","let","var","function","return","if","else","for","while","class","new","import","from","export","def","print","await","async","try","catch"];
  guardar(new RegExp(`\\b(${palabras.join("|")})\\b`, "g"), "tok-key");
  return out.replace(/\u0000T(\d+)\u0000/g, (_, i) => tokens[Number(i)] || "");
};
register("CodeBlock", (a) => {
  const lang = valText(a[0]) || "text";
  const code = valText(a[1]);
  return `<div class="ui-code-block">
    <div class="ui-code-head"><span class="ui-code-lang">${escapeHTML(lang)}</span>
      <div class="ui-code-actions">
        <button type="button" data-code-copy aria-label="Copiar código" title="Copiar"><span class="ic sm">content_copy</span></button>
        <button type="button" data-code-download aria-label="Descargar código" title="Descargar"><span class="ic sm">download</span></button>
      </div>
    </div>
    <pre class="ui-code"><code class="language-${escapeHTML(lang)}">${resaltar(code, lang)}</code></pre>
  </div>`;
});
