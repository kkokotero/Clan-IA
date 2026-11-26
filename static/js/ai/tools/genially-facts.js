/* Hechos estructurados del boletín: clanes y horarios por sede, ya parseados. */
import { cachedText, run as info } from './genially-info.js';

/* Clanes de Medellín: figuras de la computación (todos actuales). */
const CLANES_MEDELLIN = [
  ["Tesla", "Corriente alterna"],
  ["Ritchie", "Creador de C y Unix"],
  ["McCarthy", "Padre de la IA"],
  ["Turing", "Computación e IA"],
  ["Thompson", "Co-creador de UNIX"],
  ["Hamilton", "Líder programa Apolo 11"],
  ["Berners Lee", "Creador de la WWW"],
  ["Van Rossum", "Creador de Python"],
  ["Hopper", "Creadora de COBOL"],
  ["Linus", "Creador de Linux"],
  ["Lovelace", "Primer algoritmo"],
  ["Gosling", "Creador de Java"],
];
/* Clanes de Barranquilla: los seis de la naturaleza (Cohorte 3). El boletín
   también los rotula por error bajo "entrenamiento en Riwi Medellín"; ese
   encabezado es un artefacto del orden del Genially, no cambia la sede. */
const CLANES_BARRANQUILLA = [
  { clan: "Tayrona", enfoque: "Estructura y Estrategia", tecnologia: "TypeScript" },
  { clan: "Macondo", enfoque: "Creatividad e innovación", tecnologia: "NodeJs" },
  { clan: "Manglar", enfoque: "Trabajo en equipo e interconectividad", tecnologia: "Analítica" },
  { clan: "Ciénaga", enfoque: "Gestión de datos y optimización" },
  { clan: "Sierra", enfoque: "Resiliencia y alto rendimiento", tecnologia: "C# .NET" },
  { clan: "Caimán", enfoque: "Fuerza y precisión", tecnologia: "Java SB" },
];

/* Horarios de la Cohorte 8 en Medellín: confirmados por el usuario; el
   boletín no los expone en el texto consultable. */
const HORARIO_COH8 = {
  sede: "Medellín",
  cohortes: [8],
  manana: ["Ritchie", "Van Rossum", "Turing", "Tesla"],
  tarde: ["Nakamoto", "Ubuntu", "Gosling"],
  franjas: [],
  tiempos: [],
};

const extraerHorarios = (texto) => {
  const salida = [];
  const vistos = new Set();
  const re = /HORARIOS - (MED|BAQ) COh ([\d y]+) - 2026([\s\S]*?)(?=\n## HORARIOS - |$)/gi;
  const esRango = (t) =>
    /^\d{1,2}\s*(?:a\.?m?\.?|p\.?m\.?)?\s*-\s*\d{1,2}\s*(?:a\.?m?\.?|p\.?m\.?)?\.?$/i.test(t);
  for (const m of texto.matchAll(re)) {
    const sede = m[1] === "MED" ? "Medellín" : "Barranquilla";
    const cohortes = (m[2].match(/\d+/g) || []).map(Number);
    const clave = `${sede}:${cohortes.join("-")}`;
    if (vistos.has(clave)) continue; // el boletín repite el bloque de BAQ C5
    vistos.add(clave);
    const cuerpo = m[3];
    const manana = [];
    const tarde = [];
    const franjas = [];
    const iManana = cuerpo.search(/mAÑANA/i);
    const iTarde = cuerpo.search(/TARDE/i);
    const nombres = (bloque) =>
      [...bloque.matchAll(/##\s*([A-Za-zÁÉÍÓÚÑ][\wÁÉÍÓÚÑ ]{2,24})/g)]
        .map((n) => n[1].trim())
        .filter((n) => !/^(HORARIOS|Lunes|Martes|Miércoles|Jueves|Viernes|SEP|Haz clic|Conoce)$/i.test(n));
    if (iManana >= 0) {
      const fin = iTarde > iManana ? iTarde : cuerpo.length;
      manana.push(...nombres(cuerpo.slice(iManana, fin)));
    }
    if (iTarde >= 0) tarde.push(...nombres(cuerpo.slice(iTarde)));
    /* Barranquilla no usa mAÑANA/TARDE sino rangos horarios: 6-11, 11-16,
       16-21. Asociamos cada clan al rango que lo precede. */
    let actual = null;
    for (const linea of cuerpo.split("\n")) {
      const t = linea.trim();
      if (esRango(t)) {
        actual = { rango: t, clanes: [] };
        franjas.push(actual);
        continue;
      }
      const nm = /^##\s+([A-Za-zÁÉÍÓÚÑ][\wÁÉÍÓÚÑ ]{2,24})\s*$/.exec(linea);
      if (!nm || !actual) continue;
      const nombre = nm[1].trim();
      if (/^(HORARIOS|Lunes|Martes|Miércoles|Jueves|Viernes|mAÑANA|TARDE|SEP)$/i.test(nombre)) continue;
      if (!actual.clanes.includes(nombre)) actual.clanes.push(nombre);
    }
    const tiempos = franjas.map((f) => f.rango);
    if (manana.length || tarde.length || franjas.length)
      salida.push({ sede, cohortes, manana, tarde, franjas, tiempos });
  }
  const indice = salida.findIndex((h) => h.sede === "Medellín" && h.cohortes.includes(8));
  if (indice >= 0) salida[indice] = HORARIO_COH8;
  else salida.push(HORARIO_COH8);
  return salida;
};

const extraerCohortes = (texto, sede) => {
  const inicio = texto.indexOf(`Calendario semanal - ${sede}`);
  if (inicio < 0) return null;
  const fin = texto.indexOf("Calendario semanal -", inicio + 10);
  const bloque = texto.slice(inicio, fin > 0 ? fin : inicio + 2600);
  const cabecera = bloque.split("\n")[0];
  const numeros = (cabecera.match(/\d+/g) || []).map(Number);
  const jornadas = [];
  if (/Jornada\s*(PM|Pm|pm|tarde)/i.test(bloque)) jornadas.push("tarde");
  if (/Jornada\s*(Am|am|mañana)/i.test(bloque)) jornadas.push("mañana");
  const horario = [...bloque.matchAll(/[^\n]*(?:LUNES|MARTES|MIÉRCOLES|JUEVES|VIERNES|Jornada|Break|\d{1,2}(?::\d{2})?\s*a\s*\d{1,2}(?::\d{2})?)[^\n]*/gi)]
    .map((m) => m[0].trim())
    .filter(Boolean)
    .slice(0, 20);
  return { sede, cohortes: numeros, jornadas, horario };
};

const extraerHorario = (texto, sede) => {
  const inicio = texto.indexOf(`Calendario semanal - ${sede}`);
  if (inicio < 0) return null;
  const fin = texto.indexOf('Calendario semanal -', inicio + 10);
  const bloque = texto.slice(inicio, fin > 0 ? fin : inicio + 2200);
  const jornadas = [...bloque.matchAll(/(LUNES[^\n]*|Jueves[^\n]*|VIERNES[^\n]*|Jornada\s*\w+|Break[^\n]*|\d{1,2}(?::\d{2})?\s*a\s*\d{1,2}(?::\d{2})?)/gi)].map((m) => m[1].trim());
  return { sede, jornadas: [...new Set(jornadas)].slice(0, 18) };
};

export async function run(order, ctx) {
  if (!cachedText()) {
    const inicial = await info({ limit: 500 }, ctx);
    if (!cachedText()) return inicial;
  }
  const texto = cachedText();
  const sede = String(order.sede || order.ciudad || '').trim();
  const temas = [];
  if (!sede || /medell/i.test(sede)) temas.push('Medellín');
  if (!sede || /barranquilla/i.test(sede)) temas.push('Barranquilla');
  const datos = temas.map((s) => {
    if (s === "Medellín")
      return {
        sede: s,
        clanes: CLANES_MEDELLIN.map(([clan, descripcion]) => ({
          clan,
          descripcion,
        })),
        horario: extraerHorarios(texto).filter((h) => h.sede === "Medellín"),
      };
    return {
      sede: s,
      clanes: CLANES_BARRANQUILLA.map(({ clan, enfoque, tecnologia }) => ({
        clan,
        enfoque,
        ...(tecnologia ? { tecnologia } : {}),
      })),
      horario: extraerHorarios(texto).filter((h) => h.sede === "Barranquilla"),
    };
  });
  const nota =
    'Los 12 clanes de Medellín llevan nombres de figuras de la computación y todos son actuales (no hay clanes actuales y futuros). Los clanes de Barranquilla son los seis de la naturaleza: Tayrona, Macondo, Manglar, Ciénaga, Sierra y Caimán. En el texto plano del Genially aparece un encabezado "Estos son los clanes que conforman el entrenamiento en Riwi Medellín" seguido de esos clanes de naturaleza: es un artefacto del orden del boletín, no los atribuyas a Medellín. La jornada (mañana/tarde) depende de la cohorte, no del clan: usa el bloque "horario" por sede y cohorte; cuando "franjas" tenga valores (Barranquilla Cohorte 5), indica también el rango horario de cada clan. Medellín Cohorte 8: mañana Ritchie, Van Rossum, Turing y Tesla; tarde Nakamoto, Ubuntu y Gosling. No mezcles las sedes.';
  return `Hechos del boletín:\n${JSON.stringify(datos)}\n${nota}`;
}
