/* Componentes de datos: pasos, tablas, entidades, listas y etiquetas. */
import { escapeHTML, icon } from '../../core/dom.js';
import { register } from './registry.js';
import { actionText, asArray, richText, safeIconHTML, valText } from './primitives.js';

register("Steps", (a) =>
  `<ol class="ui-steps">${asArray(a[0])
    .map(
      (s, i) =>
        `<li><span class="ui-step-num">${i + 1}</span><div><b>${safeIconHTML(s?.args?.[2])}${richText(s?.args?.[0])}</b><p>${richText(s?.args?.[1])}</p></div></li>`,
    )
    .join("")}</ol>`);
register("Table", (a) => {
  const cols = asArray(a[0]).filter((c) => c?.type === "Col");
  const rows = Math.max(0, ...cols.map((c) => asArray(c.args?.[1]).length));
  return `<div class="ui-table-wrap"><table class="ui-table"><thead><tr>${cols
    .map((c) => `<th>${richText(c.args?.[0])}</th>`)
    .join("")}</tr></thead><tbody>${Array.from(
    { length: rows },
    (_, r) =>
      `<tr>${cols.map((c) => `<td>${richText(asArray(c.args?.[1])[r])}</td>`).join("")}</tr>`,
  ).join("")}</tbody></table></div>`;
});
register("EntityList", (a) => {
  const rows = asArray(a[0]).filter((row) => row && typeof row === "object");
  return `<div class="ui-entity">${rows
    .map(
      (row) =>
        `<div><span>${richText(row.left)}</span><b class="${row.rightVariant === "number" ? "ui-num" : ""}">${richText(row.right)}</b></div>`,
    )
    .join("")}</div>`;
});
register("ListBlock", (a) =>
  `<div class="ui-list">${asArray(a[0])
    .map((it, i) => {
      const action = actionText(it?.args?.[4]);
      const label = valText(it?.args?.[3]);
      return `<div class="ui-list-item"><span class="ui-list-num">${a[1] === "image" ? icon("image", "sm") : safeIconHTML(it?.args?.[2]) || i + 1}</span><div><b>${richText(it?.args?.[0])}</b>${it?.args?.[1] ? `<p>${richText(it.args[1])}</p>` : ""}</div>${
        action
          ? `<button type="button" class="ui-list-action" data-toassistant="${escapeHTML(action)}" aria-label="${escapeHTML(label || action)}">${icon("chevron_right", "sm")}</button>`
          : ""
      }</div>`;
    })
    .join("")}</div>`);
register("TagBlock", (a) =>
  `<div class="ui-tags">${asArray(a[0])
    .map((t) =>
      t?.type === "Tag"
        ? `<span class="ui-tag">${richText(t.args?.[0])}</span>`
        : `<span class="ui-tag">${richText(t)}</span>`,
    )
    .join("")}</div>`);
register("Tag", (a) => `<span class="ui-tag">${safeIconHTML(a[1])}${richText(a[0])}</span>`);
