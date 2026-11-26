/* Busca un término dentro del Genially ya consultado (sin volver a descargar). */
import { cachedText, run as info } from './genially-info.js';

export const meta = { id: 'genially-search' };

export async function run(order, ctx) {
  const q = String(order.q || order.query || order.text || '').trim().toLowerCase();
  if (!q) return 'Indica qué quieres buscar en el Genially.';
  const inicial = await info({ limit: 500 }, ctx);
  if (!inicial.startsWith('Contenido del Genially')) return inicial;
  const texto = cachedText() || '';
  const partes = [];
  let desde = 0;
  while (partes.length < 8) {
    const i = texto.toLowerCase().indexOf(q, desde);
    if (i < 0) break;
    partes.push(texto.slice(Math.max(0, i - 160), i + q.length + 220));
    desde = i + q.length;
  }
  if (!partes.length) return `No encontré «${q}» en el contenido del Genially.`;
  return `Coincidencias en el Genially:\n${partes.join('\n---\n')}`;
}
