/* Información pública del Genially de Riwi (cronograma, clanes, horarios...).
   La página publica su contenido en un bloque JSON-LD y permite CORS. */
const URL_DEFAULT = 'https://view.genially.com/66da105683d3400c85f30f74';
let cache = null;

const extraerTexto = (html) => {
  const bloques = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const bloque of bloques) {
    try {
      const data = JSON.parse(bloque[1]);
      if (data && data.text) return String(data.text);
    } catch (e) {}
  }
  return '';
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
      const texto = extraerTexto(await res.text());
      if (!texto) return 'El Genially no expone texto consultable.';
      cache = { url, texto };
    }
    const limite = Math.min(Math.max(Number(order.limit) || 18000, 500), 24000);
    const texto = cache.texto;
    const corte = texto.slice(0, limite);
    return `Contenido del Genially de Riwi (${texto.length} caracteres):\n${corte}${texto.length > limite ? '\n… (recorta; usa GENIALLY_SEARCH para buscar dentro)' : ''}`;
  } catch (err) {
    return `No se pudo consultar el Genially: ${err.message || err}`;
  }
}
