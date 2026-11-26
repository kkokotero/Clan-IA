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

/* Compatibilidad con el detector antiguo. */
export const extractProtocolCalls = (text, marker) => extractCalls(text, marker);
