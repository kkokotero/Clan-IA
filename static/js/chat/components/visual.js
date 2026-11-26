/* Componentes de visualización: calendario, kanban y línea de tiempo. */
import { escapeHTML } from '../../core/dom.js';
import { asArray, safeIconHTML, valText } from './primitives.js';
import { register } from './registry.js';

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const fechaClave = (valor) => String(valText(valor) || "").slice(0, 10);

register("Calendar", (a) => {
  const actual = new Date();
  const mesTexto = valText(a[0]);
  const m = /^(\d{4})-(\d{1,2})/.exec(mesTexto);
  const anio = m ? Number(m[1]) : actual.getFullYear();
  const mes = m ? Number(m[2]) - 1 : actual.getMonth();
  const eventos = asArray(a[1]).map((e) => ({
    fecha: fechaClave(e?.args?.[0]),
    titulo: valText(e?.args?.[1]),
    detalle: valText(e?.args?.[2]),
    icono: safeIconHTML(e?.args?.[3]),
  }));
  const primero = new Date(anio, mes, 1);
  const inicio = (primero.getDay() + 6) % 7;
  const total = new Date(anio, mes + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < inicio; i++) celdas.push('<div class="ui-cal-dia vacio"></div>');
  for (let d = 1; d <= total; d++) {
    const clave = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const delDia = eventos.filter((e) => e.fecha === clave);
    celdas.push(`<div class="ui-cal-dia"><span class="ui-cal-num">${d}</span>${delDia
      .map(
        (e) =>
          `<span class="ui-cal-evento">${e.icono}<b>${escapeHTML(e.titulo)}</b>${e.detalle ? `<small>${escapeHTML(e.detalle)}</small>` : ""}</span>`,
      )
      .join("")}</div>`);
  }
  const nombre = new Date(anio, mes, 1).toLocaleString("es-CO", { month: "long", year: "numeric" });
  return `<div class="ui-calendar">
    <div class="ui-cal-head"><b>${escapeHTML(nombre)}</b></div>
    <div class="ui-cal-semana">${DIAS.map((d) => `<span>${d}</span>`).join("")}</div>
    <div class="ui-cal-grid">${celdas.join("")}</div>
  </div>`;
});

register("Kanban", (a) => {
  const columnas = asArray(a[0]);
  return `<div class="ui-kanban">${columnas
    .map(
      (col) => `<section class="ui-kan-col">
        <h4>${safeIconHTML(col?.args?.[2])}${escapeHTML(valText(col?.args?.[0]))}</h4>
        ${asArray(col?.args?.[1])
          .map(
            (t) => `<article class="ui-kan-card"><b>${escapeHTML(valText(t?.args?.[0]))}</b>${t?.args?.[1] ? `<p>${escapeHTML(valText(t.args[1]))}</p>` : ""}${t?.args?.[2] ? `<span class="ui-kan-tag">${escapeHTML(valText(t.args[2]))}</span>` : ""}</article>`,
          )
          .join("")}
      </section>`,
    )
    .join("")}</div>`;
});

register("Timeline", (a) => {
  const items = asArray(a[0]);
  return `<div class="ui-timeline">${items
    .map(
      (it) => `<div class="ui-tl-item">
        <span class="ui-tl-punto">${safeIconHTML(it?.args?.[3] || "event")}</span>
        <div class="ui-tl-body"><span class="ui-tl-fecha">${escapeHTML(valText(it?.args?.[0]))}</span><b>${escapeHTML(valText(it?.args?.[1]))}</b>${it?.args?.[2] ? `<p>${escapeHTML(valText(it.args[2]))}</p>` : ""}</div>
      </div>`,
    )
    .join("")}</div>`;
});
