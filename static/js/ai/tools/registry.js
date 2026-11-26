/* Catálogo declarativo de herramientas. Cada entrada describe la herramienta
   al modelo y carga su implementación solo cuando se usa.Para agregar una:
   crea el módulo y añade una entrada aquí. */

export const TOOLS = [
  {
    id: 'moodle-tool',
    marker: 'MOODLE_TOOL',
    nombre: 'Consultas REST de Moodle',
    descripcion:
      'Consulta cualquier función de solo lectura del catálogo real. Descubre primero tus cursos con core_enrol_get_users_courses y usa esos ids.',
    ejemplo: 'MOODLE_TOOL({"fn":"core_enrol_get_users_courses","params":{"userid":X}})',
    necesita: 'moodle',
    load: () => import('./moodle-tool.js'),
  },
  {
    id: 'moodle-profile',
    marker: 'MOODLE_PROFILE',
    nombre: 'Perfil completo de Moodle',
    descripcion:
      'Lee todos los campos reales de tu cuenta de Moodle (nombre, correo, ciudad, país, zona horaria, institución, teléfonos, etc.). Para editarlos usa MOODLE_WRITE.',
    ejemplo: 'MOODLE_PROFILE({})',
    necesita: 'moodle',
    load: () => import('./moodle-profile.js'),
  },
  {
    id: 'moodle-assignments',
    marker: 'MOODLE_ASSIGNMENTS',
    nombre: 'Todos los trabajos',
    descripcion:
      'Lista todos los trabajos de tus cursos con nombre, curso, fecha límite, instrucciones y enlace para abrirlos.',
    ejemplo: 'MOODLE_ASSIGNMENTS({})',
    necesita: 'moodle',
    load: () => import('./moodle-assignments.js'),
  },
  {
    id: 'moodle-media',
    marker: 'MOODLE_MEDIA',
    nombre: 'Imágenes y vídeos de Moodle',
    descripcion:
      'Obtiene la URL directa de una imagen o vídeo de Moodle para compartirlo con Image(...) o Video(...).',
    ejemplo: 'MOODLE_MEDIA({"name":"nombre del archivo"})',
    necesita: 'moodle',
    load: () => import('./moodle-media.js'),
  },
  {
    id: 'moodle-open',
    marker: 'MOODLE_OPEN',
    nombre: 'Abrir enlaces de Moodle',
    descripcion:
      'Sigue un enlace real de Moodle por url, nombre o cmid para leer cursos, actividades y archivos.',
    ejemplo: 'MOODLE_OPEN({"url":"https://..."})',
    necesita: 'moodle',
    load: () => import('./moodle-open.js'),
  },
  {
    id: 'moodle-verify',
    marker: 'MOODLE_VERIFY',
    nombre: 'Verificar nombres',
    descripcion:
      'Comprueba que cada curso, material o actividad que vayas a nombrar existe realmente en la cuenta.',
    ejemplo: 'MOODLE_VERIFY({"names":["Nombre exacto"]})',
    necesita: 'moodle',
    load: () => import('./moodle-verify.js'),
  },
  {
    id: 'moodle-write',
    marker: 'MOODLE_WRITE',
    nombre: 'Cambios en Moodle',
    descripcion:
      'Actualiza tu perfil o envía mensajes. Requiere confirmación de la persona antes de ejecutarse.',
    ejemplo: 'MOODLE_WRITE({"fn":"core_user_update_users","params":{...},"reason":"..."})',
    necesita: 'moodle',
    load: () => import('./moodle-write.js'),
  },
  {
    id: 'moodle-grades',
    marker: 'MOODLE_GRADES',
    nombre: 'Calificaciones',
    descripcion: 'Consulta las notas reales de tus cursos con gradereport_user_get_grade_items.',
    ejemplo: 'MOODLE_GRADES({})',
    necesita: 'moodle',
    load: () => import('./moodle-grades.js'),
  },
  {
    id: 'moodle-courses',
    marker: 'MOODLE_COURSES',
    nombre: 'Cursos y secciones',
    descripcion: 'Lista tus cursos matriculados y sus secciones, materiales y actividades.',
    ejemplo: 'MOODLE_COURSES({})',
    necesita: 'moodle',
    load: () => import('./moodle-courses.js'),
  },
  {
    id: 'moodle-calendar',
    marker: 'MOODLE_CALENDAR',
    nombre: 'Calendario de Moodle',
    descripcion: 'Lee los eventos próximos de tu calendario en Moodle. Puedes indicar days.',
    ejemplo: 'MOODLE_CALENDAR({"days":60})',
    necesita: 'moodle',
    load: () => import('./moodle-calendar.js'),
  },
  {
    id: 'moodle-messages',
    marker: 'MOODLE_MESSAGES',
    nombre: 'Mensajes de Moodle',
    descripcion: 'Lista tus conversaciones y, con conversationid, lee los mensajes.',
    ejemplo: 'MOODLE_MESSAGES({"conversationid":X})',
    necesita: 'moodle',
    load: () => import('./moodle-messages.js'),
  },
  {
    id: 'moodle-search',
    marker: 'MOODLE_SEARCH',
    nombre: 'Buscar en datos ya leídos',
    descripcion: 'Busca cursos, materiales, tareas, eventos y enlaces entre los datos ya consultados, sin nuevas llamadas.',
    ejemplo: 'MOODLE_SEARCH({"q":"proyecto"})',
    necesita: 'moodle',
    load: () => import('./moodle-search.js'),
  },
  {
    id: 'genially-facts',
    marker: 'GENIALLY_FACTS',
    nombre: 'Datos del boletín',
    descripcion:
      'Devuelve clanes y horarios ya estructurados por sede. Úsalo para preguntas de clanes u horarios en lugar de leer texto plano.',
    ejemplo: 'GENIALLY_FACTS({"sede":"Medellín"})',
    necesita: null,
    load: () => import('./genially-facts.js'),
  },
  {
    id: 'genially-info',
    marker: 'GENIALLY_INFO',
    nombre: 'Boletín de Riwi',
    descripcion:
      'Lee el contenido público del Genially de Riwi: cronograma por clan, clanes, horarios semanales, salas, TL y novedades.',
    ejemplo: 'GENIALLY_INFO({})',
    necesita: null,
    load: () => import('./genially-info.js'),
  },
  {
    id: 'genially-search',
    marker: 'GENIALLY_SEARCH',
    nombre: 'Buscar en el boletín',
    descripcion:
      'Busca un término dentro del contenido del Genially ya consultado, con contexto.',
    ejemplo: 'GENIALLY_SEARCH({"q":"Cronograma"})',
    necesita: null,
    load: () => import('./genially-search.js'),
  },
  {
    id: 'device-info',
    marker: 'DEVICE_INFO',
    nombre: 'Fecha, hora y dispositivo',
    descripcion:
      'Lee datos reales del navegador: fecha, hora, zona horaria, idioma, pantalla, red y batería.',
    ejemplo: 'DEVICE_INFO({"keys":["date","time","timezone"]})',
    necesita: null,
    load: () => import('./device-info.js'),
  },
  {
    id: 'chat-list',
    marker: 'CHAT_LIST',
    nombre: 'Listar chats guardados',
    descripcion: 'Enumera las conversaciones guardadas en este navegador.',
    ejemplo: 'CHAT_LIST({"limit":10})',
    necesita: 'chat',
    load: () => import('./chat-list.js'),
  },
  {
    id: 'chat-read',
    marker: 'CHAT_READ',
    nombre: 'Leer un chat guardado',
    descripcion: 'Lee los mensajes de una conversación de este navegador.',
    ejemplo: 'CHAT_READ({"id":"...","limit":30})',
    necesita: 'chat',
    load: () => import('./chat-read.js'),
  },
  {
    id: 'chat-write',
    marker: 'CHAT_WRITE',
    nombre: 'Modificar chats guardados',
    descripcion: 'Renombra, borra o limpia conversaciones. Las acciones destructivas piden confirmación.',
    ejemplo: 'CHAT_WRITE({"action":"rename","id":"...","title":"..."})',
    necesita: 'chat',
    load: () => import('./chat-write.js'),
  },
];

export const POR_MARKER = new Map(TOOLS.map((t) => [t.marker.toUpperCase(), t]));
export const MARKERS = TOOLS.map((t) => t.marker);

export function generatePrompt() {
  const lineas = TOOLS.map(
    (t) => `- ${t.marker}: ${t.descripcion} Ej.: ${t.ejemplo}`,
  );
  return `HERRAMIENTAS DISPONIBLES (se cargan solo cuando las usas):\n${lineas.join("\n")}`;
}
