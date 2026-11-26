/* Política: pide una sola vez que se verifiquen los nombres antes del programa final. */
export function demand(ctx) {
  if (ctx.verifiedAny || ctx.verificacionPedida) return null;
  ctx.verificacionPedida = true;
  return 'Aún no verificaste los nombres. Antes de responder, llama a MOODLE_VERIFY({"names":[...]}) con TODOS los cursos, materiales, actividades y preguntas que vayas a nombrar; usa solo los que devuelva como válidos. Si no puedes verificar lo que piden, responde exactamente MOODLE_NOT_FOUND.';
}
