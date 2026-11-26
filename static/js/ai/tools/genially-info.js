/* Información pública del Genially de Riwi (cronograma, clanes, horarios...).
   La página publica transcripciones HTML estructuradas en window.INITIAL_DATA. */
const URL_DEFAULT = 'https://view.genially.com/66da105683d3400c85f30f74';
let cache = null;

const extraerTranscripcion = (html) => {
  const inicio = html.indexOf('window.INITIAL_DATA=');
  if (inicio < 0) return '';
  let i = html.indexOf('{', inicio);
  let depth = 0;
  let quote = false;
  let esc = false;
  for (; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') quote = false;
      continue;
    }
    if (c === '"') quote = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        const data = JSON.parse(html.slice(html.indexOf('{', inicio), i + 1));
        return String(data?.socialViewProps?.transcriptions || '');
      } catch (e) {
        return '';
      }
    }
  }
  return '';
};

function aTexto(markup) {
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(markup, 'text/html');
    const out = [];
    doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,br,div').forEach((nodo) => {
      if (nodo.tagName === 'BR') {
        out.push('\n');
        return;
      }
      const texto = (nodo.textContent || '').replace(/\s+/g, ' ').trim();
      if (!texto) return;
      const nivel = /^H([1-6])$/.exec(nodo.tagName);
      out.push(nivel ? `\n## ${texto}\n` : `\n${texto}`);
    });
    return out.join('').replace(/\n{3,}/g, '\n\n').trim();
  }
  return String(markup)
    .replace(/<h[1-6][^>]*>/gi, '\n## ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|div)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const extraerJSONLD = (html) => {
  const bloques = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const bloque of bloques) {
    try {
      const data = JSON.parse(bloque[1]);
      if (data && data.text) return String(data.text);
    } catch (e) {}
  }
  return '';
};

/* Un encabezado puede contener otra sede (p. ej. "Estos son los clanes ... en
   Riwi Medellín" seguido de los clanes de Barranquilla). Por eso no descartamos
   bloques por ciudad: tomamos una ventana de contexto alrededor de cada
   encabezado que coincide con la sección pedida. */
const filtrarSeccion = (texto, seccion) => {
  const q = String(seccion || "").trim().toLowerCase();
  if (!q) return texto;
  const bloques = texto.split(/\n## /);
  const indices = new Set();
  bloques.forEach((bloque, indice) => {
    const cabecera = bloque.split("\n")[0].toLowerCase();
    if (!cabecera.includes(q)) return;
    for (let j = indice; j < Math.min(indice + 12, bloques.length); j++) {
      indices.add(j);
    }
  });
  if (!indices.size) return texto;
  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => bloques[i])
    .join("\n## ");
};

export const meta = { id: 'genially-info' };
export const cachedText = () => cache?.texto || null;

export async function run(order, ctx) {
  const url = String(order.url || URL_DEFAULT).trim();
  if (!/^https?:\/\//i.test(url)) return 'La URL del Genially no es válida.';
  try {
    if (!cache || cache.url !== url) {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) return `No se pudo abrir el Genially (HTTP ${res.status}).`;
      const html = await res.text();
      const transcripcion = extraerTranscripcion(html);
      const texto = transcripcion ? aTexto(transcripcion) : extraerJSONLD(html);
      if (!texto) return 'El Genially no expone texto consultable.';
      cache = { url, texto };
    }
    const limite = Math.min(Math.max(Number(order.limit) || 20000, 500), 24000);
    const texto = filtrarSeccion(cache.texto, order.seccion || order.section);
    return `Contenido del boletín de Riwi (${texto.length} caracteres, sección ${order.seccion || "completa"}):\n${texto.slice(0, limite)}${texto.length > limite ? '\n… (usa GENIALLY_SEARCH para buscar dentro)' : ''}`;
  } catch (err) {
    return `No se pudo consultar el Genially: ${err.message || err}`;
  }
}
