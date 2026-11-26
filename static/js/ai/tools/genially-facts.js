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
const CLANES_BARRANQUILLA = {
  Tayrona: "TypeScript",
  Macondo: "NodeJs",
  Manglar: "Analítica",
  Sierra: "C# .NET",
  Caimán: "Java SB",
};

const extraerClanes = (texto, sede) => {
  const inicio = texto.indexOf(`entrenamiento en Riwi ${sede}`);
  if (inicio < 0) return [];
  const resto = texto.slice(inicio + `entrenamiento en Riwi ${sede}`.length);
  const fin = resto.search(/Estos son los clanes|conforman el entrenamiento en Riwi|Prueba -/i);
  const bloque = fin > 0 ? resto.slice(0, fin) : resto.slice(0, 1500);
  const pares = [...bloque.matchAll(/##\s*([^\n]+)\n\s*([^\n#]+)/g)];
  return pares
    .map((m) => ({ clan: m[1].trim(), enfoque: m[2].trim() }))
    .filter((c) => c.clan.length < 40 && c.enfoque.length > 4);
};

/* Horarios de la Cohorte 8 en Medellín: confirmados por el usuario; el
   boletín no los expone en el texto consultable. */
const HORARIO_COH8 = {
  sede: "Medellín",
  cohortes: [8],
  manana: ["Ritchie", "Van Rossum", "Turing", "Tesla"],
  tarde: ["Nakamoto", "Ubuntu", "Gosling"],
  tiempos: [],
};

const extraerHorarios = (texto) => {
  const salida = [];
  const re = /HORARIOS - (MED|BAQ) COh ([\d y]+) - 2026([\s\S]*?)(?=## HORARIOS - |HORARIOS - |$)/gi;
  for (const m of texto.matchAll(re)) {
    const sede = m[1] === "MED" ? "Medellín" : "Barranquilla";
    const cohortes = (m[2].match(/\d+/g) || []).map(Number);
    const cuerpo = m[3];
    const manana = [];
    const tarde = [];
    const iManana = cuerpo.search(/mAÑANA/i);
    const iTarde = cuerpo.search(/TARDE/i);
    const nombres = (bloque) =>
      [...bloque.matchAll(/##\s*([A-Za-zÁÉÍÓÚÑ][\wÁÉÍÓÚÑ ]{2,24})/g)]
        .map((n) => n[1].trim())
        .filter((n) => !/^(HORARIOS|Lunes|Martes|Miércoles|Jueves|Viernes)$/i.test(n));
    if (iManana >= 0) {
      const fin = iTarde > iManana ? iTarde : cuerpo.length;
      manana.push(...nombres(cuerpo.slice(iManana, fin)));
    }
    if (iTarde >= 0) tarde.push(...nombres(cuerpo.slice(iTarde)));
    const tiempos = [...cuerpo.matchAll(/\d{1,2}\s*(?:a\.?m?\.?|p\.?m\.?)?\s*-\s*\d{1,2}\s*(?:a\.m\.|p\.m\.)?/gi)].map((t) => t[0].trim());
    if (manana.length || tarde.length)
      salida.push({ sede, cohortes, manana, tarde, tiempos });
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
  const inicial = await info({ limit: 500 }, ctx);
  if (!inicial.startsWith('Contenido del boletín')) return inicial;
  const texto = cachedText() || '';
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
      clanes: Object.entries(CLANES_BARRANQUILLA).map(([clan, tecnologia]) => ({
        clan,
        tecnologia,
      })),
      horario: extraerHorarios(texto).filter((h) => h.sede === "Barranquilla"),
    };
  });
  const nota =
    'Los 12 clanes de Medellín llevan nombres de figuras de la computación y todos son actuales. En el bloque horarios, la jornada (mañana/tarde) depende de la cohorte; para la Cohorte 8 de Medellín: mañana Ritchie, Van Rossum, Turing y Tesla; tarde Nakamoto, Ubuntu y Gosling. Tayrona, Manglar, Ciénaga, Sierra y Caimán son de Barranquilla. No mezcles las sedes.';
  return `Hechos del boletín:\n${JSON.stringify(datos)}\n${nota}`;
}
