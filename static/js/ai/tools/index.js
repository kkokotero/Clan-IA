/* API del sistema de herramientas: detección, carga perezosa y ejecución. */
import { extractCalls } from '../protocol.js';
import { MARKERS, POR_MARKER, TOOLS, generatePrompt } from './registry.js';

const cache = new Map();

export { generatePrompt, TOOLS, MARKERS };

export function detect(text) {
  const encontradas = {};
  MARKERS.forEach((marker) => {
    const calls = extractCalls(text, marker);
    if (calls.length) encontradas[marker] = calls;
  });
  return encontradas;
}

export function hasCalls(text) {
  return MARKERS.some((marker) => extractCalls(text, marker).length > 0);
}

export async function load(id) {
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool) return null;
  if (!cache.has(id)) cache.set(id, tool.load().then((m) => m.default || m));
  return cache.get(id);
}

export async function run(id, order, ctx) {
  const modulo = await load(id);
  if (!modulo || typeof modulo.run !== 'function') return null;
  try {
    return await modulo.run(order, ctx);
  } catch (err) {
    return `La herramienta ${id} falló: ${err.message || err}`;
  }
}

export function toolForMarker(marker) {
  return POR_MARKER.get(String(marker).toUpperCase());
}
