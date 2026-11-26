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
        horario: extraerHorario(texto, s),
      };
    return {
      sede: s,
      clanes: Object.entries(CLANES_BARRANQUILLA).map(([clan, tecnologia]) => ({
        clan,
        tecnologia,
      })),
      horario: extraerHorario(texto, s),
    };
  });
  const nota =
    'Los 12 clanes de Medellín llevan nombres de figuras de la computación y todos son actuales. Tayrona, Manglar, Ciénaga, Sierra y Caimán son de Barranquilla. No mezcles las sedes.';
  return `Hechos del boletín:\n${JSON.stringify(datos)}\n${nota}`;
}
