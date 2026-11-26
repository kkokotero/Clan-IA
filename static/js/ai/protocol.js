/* Protocolo ligero: detecta llamadas del modelo sin importar ninguna herramienta. */

export function extractCalls(text, marker) {
  const src = String(text || "");
  const calls = [];
  const re = new RegExp(marker + "\\s*\\(", "gi");
  let match;
  while ((match = re.exec(src))) {
    let i = re.lastIndex;
    let depth = 1;
    let quote = false;
    let esc = false;
    const start = i;
    for (; i < src.length && depth > 0; i++) {
      const c = src[i];
      if (quote) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') quote = false;
        continue;
      }
      if (c === '"') quote = true;
      else if (c === "(") depth++;
      else if (c === ")") depth--;
    }
    if (depth !== 0) break;
    const raw = src.slice(start, i - 1).trim();
    re.lastIndex = i;
    try {
      const obj = JSON.parse(raw || "{}");
      if (obj && typeof obj === "object") calls.push(obj);
    } catch (e) {}
  }
  return calls;
}

/* Quita del texto las llamadas completas y oculta una llamada a medio escribir.
   Así el usuario ve solo el contenido, nunca el marcador del protocolo. */
export function stripCalls(text, markers = []) {
  const src = String(text || "");
  const salida = [];
  let i = 0;
  while (i < src.length) {
    let mejor = null;
    for (const marker of markers) {
      const idx = src.toLowerCase().indexOf(String(marker).toLowerCase(), i);
      if (idx >= 0 && (!mejor || idx < mejor.idx)) mejor = { idx, marker };
    }
    if (!mejor) {
      salida.push(src.slice(i));
      break;
    }
    salida.push(src.slice(i, mejor.idx));
    let j = mejor.idx + String(mejor.marker).length;
    while (/\s/.test(src[j] || "")) j++;
    if (src[j] !== "(") {
      salida.push(mejor.marker);
      i = mejor.idx + String(mejor.marker).length;
      continue;
    }
    let depth = 0;
    let quote = false;
    let esc = false;
    let k = j;
    for (; k < src.length; k++) {
      const c = src[k];
      if (quote) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') quote = false;
        continue;
      }
      if (c === '"') quote = true;
      else if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) {
          k++;
          break;
        }
      }
    }
    if (depth !== 0) break; // llamada incompleta: no mostramos el resto
    i = k;
  }
  return salida.join("").replace(/[ \t]{2,}/g, " ");
}

/* Compatibilidad con el detector antiguo. */
export const extractProtocolCalls = (text, marker) => extractCalls(text, marker);
