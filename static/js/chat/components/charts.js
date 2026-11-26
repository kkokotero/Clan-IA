/* Gráficos con Chart.js (CDN). Si no carga, se dibuja un fallback en texto. */
import { escapeHTML } from '../../core/dom.js';
import { asArray, valText } from './primitives.js';
import { register } from './registry.js';

const PALETA = ["#6750A4", "#5266B8", "#B8A4E8", "#2F7D5C", "#C8453F", "#9A5B12"];

register("Chart", (a) => {
  const tipo = ["bar", "line", "pie", "doughnut"].includes(valText(a[0])) ? valText(a[0]) : "bar";
  const titulo = valText(a[2]) || "";
  const datos = asArray(a[1]).map((d) => ({
    etiqueta: valText(d?.args?.[0]),
    valor: Number(d?.args?.[1]) || 0,
  }));
  const config = {
    type: tipo,
    data: {
      labels: datos.map((d) => d.etiqueta),
      datasets: [{
        label: titulo || "Datos",
        data: datos.map((d) => d.valor),
        backgroundColor: datos.map((_, i) => PALETA[i % PALETA.length]),
        borderColor: PALETA[0],
        borderWidth: 2,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: tipo === "pie" || tipo === "doughnut" }, title: { display: Boolean(titulo), text: titulo } },
      scales: tipo === "pie" || tipo === "doughnut" ? {} : { y: { beginAtZero: true } },
    },
  };
  return `<div class="ui-chart" data-chart="${escapeHTML(JSON.stringify(config))}">
    <div class="ui-chart-fallback">${datos.map((d) => `<span><b>${escapeHTML(d.etiqueta)}</b> ${d.valor}</span>`).join("")}</div>
  </div>`;
});

export function initCharts(root = document) {
  root.querySelectorAll("[data-chart]").forEach((holder) => {
    if (holder.dataset.ready) return;
    holder.dataset.ready = "1";
    if (typeof window.Chart !== "function") return;
    try {
      let cfg;
      try { cfg = JSON.parse(holder.dataset.chart); } catch (e) { return; }
      const canvas = document.createElement("canvas");
      holder.replaceChildren(canvas);
      new window.Chart(canvas, cfg);
      holder.classList.add("listo");
    } catch (e) {}
  });
}
