/* Galería temporal: dibuja todos los componentes que la IA puede devolver. */
import { renderProgramInto } from '../chat/render.js';
import { $, escapeHTML } from '../core/dom.js';

const MUESTRAS = [
  ['Reproductor de vídeo personalizado', `root = Card([v])
v = Video("https://www.youtube.com/watch?v=aqz-KE-bpKQ", "Reproductor listo para usar de YouTube (sin configuración)")`],
  ['Grid de contenido', `root = Card([g])
g = Grid("2", [Card([CardHeader("Columna uno", "Texto", "school")]), Card([CardHeader("Columna dos", "Texto", "chat")])])`],
  ['Código con copiar/descargar', `root = Card([code])
code = CodeBlock("javascript", "const saludo = \"Hola Clan IA\";\nconsole.log(saludo);")`],
  ['Imagen, vídeo y botón-enlace', `root = Card([img, vid, lb])
img = Image("/static/favicons/favicon.svg", "Isotipo de Clan IA", "Imagen local de ejemplo")
vid = Video("https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", "Vídeo de ejemplo")
lb = LinkButton("Abrir chat", "/chat/", "primary", "arrow_forward")`],
  ['Tarjeta, encabezado y texto con iconos', `root = Card([h, t, t2])
h = CardHeader("Encabezado con icono", "Subtítulo", "school")
t = TextContent("Texto con icono", "default", "info")
t2 = TextContent("Texto pequeño", "small", "bolt")`],
  ['Encabezado en línea, callouts y separador', `root = Card([ih, c1, c2, sep])
ih = InlineHeader("Título en línea", "Detalle", "star")
c1 = Callout("neutral", "Aviso", "Contenido del aviso", "info")
c2 = Callout("danger", "Error", "No se pudo completar", "error")
sep = Separator()`],
  ['Pasos', `root = Card([s])
s = Steps([StepsItem("Primer paso", "Descripción del paso", "check_circle"), StepsItem("Segundo paso", "Otra descripción", "schedule")])`],
  ['Tabla', `root = Card([tb])
tb = Table([Col("Curso", ["IA", "Datos"]), Col("Estado", ["Activo", "Pendiente"])])`],
  ['Lista de entidades', `root = Card([e])
e = EntityList([{"left":"Nota","right":"4.5","rightVariant":"number"},{"left":"Curso","right":"Análisis de datos"}])`],
  ['Lista con iconos', `root = Card([l])
l = ListBlock([ListItem("Tarea 1", "Entrega viernes", "assignment"), ListItem("Material", "Guía de estudio", "description")])`],
  ['Etiquetas', `root = Card([tb])
tb = TagBlock([Tag("IA", "bolt"), Tag("Proyecto", "flag"), Tag("Pendiente")])`],
  ['Pestañas', `root = Card([tabs])
tabs = Tabs([Tab("a", "Resumen", [TextContent("Contenido del resumen")], "description"), Tab("b", "Detalles", [TextContent("Contenido de detalles")], "info")])`],
  ['Secciones plegables', `root = Card([acc])
acc = SectionBlock([AccordionItem("a", "Sección uno", [TextContent("Contenido uno")], "school"), AccordionItem("b", "Sección dos", [TextContent("Contenido dos")], "chat")])`],
  ['Bloque de código', `root = Card([code])
code = CodeBlock("json", "{\\"clave\\": \\"valor\\"}")`],
  ['Formulario completo', `root = Card([f])
f = Form("demo", [Button("Enviar", @ToAssistant("Enviar formulario"), "primary", "send")], [FormControl("Nombre", Input("nombre", "Tu nombre", "text", {"required":true}), "Escribe tu nombre", "person"), FormControl("Comentario", TextArea("comentario", "Tu mensaje", 3), "", "chat"), FormControl("Opción", Select("opcion", [Option("a", "Opción A"), Option("b", "Opción B")], "Elige una opción"), "", "link")])`],
  ['Selección y grupos', `root = Card([ch, oc, cb, sw, rg])
ch = Chips("tema", "single", [Option("ia", "IA", "bolt"), Option("datos", "Datos", "table_chart")])
oc = OptionCards("formato", "single", [Option("resumen", "Resumen", "Breve", "description"), Option("detalle", "Detalle", "Extenso", "expand_more")])
cb = CheckBoxGroup("extras", [Check("uno", "Descripción uno", "1", "school"), Check("dos", "Descripción dos", "2", "flag")])
sw = SwitchGroup("avisos", [Check("activo", "Recibir avisos", "1", "notifications")])
rg = RadioGroup("nivel", [Option("bajo", "Bajo", "1", "arrow_downward"), Option("alto", "Alto", "2", "arrow_upward")])`],
  ['Botones, enlaces y sugerencias', `root = Card([b, link, fu])
b = Buttons([Button("Primario", @ToAssistant("Ver"), "primary", "check_circle"), Button("Secundario", "https://moodle.riwi.io", "secondary", "open_in_new"), Button("Terciario", @ToAssistant("Más"), "tertiary")], "column")
link = Link("Abrir Moodle", "https://moodle.riwi.io/my/")
fu = FollowUpBlock([FollowUpItem("¿Qué tareas tengo?", "assignment"), FollowUpItem("¿Qué eventos hay?", "calendar_month")])`],
  ['Texto enriquecido y enlace interno', `root = Card([md, tl])
md = MarkDownRenderer("Texto con **negrita** y enlace [Moodle](https://moodle.riwi.io)", "large", "description")
tl = TextLink("Configurar IA", "/settings/ai/")`],
];

const root = $('#galeria');
if (root)
  root.innerHTML = MUESTRAS.map(
    ([titulo, programa], i) => `
      <section class="galeria-item">
        <h2>${escapeHTML(titulo)}</h2>
        <div class="card"><div class="ui-render" data-muestra="${i}"></div></div>
      </section>`,
  ).join('');

MUESTRAS.forEach(([, programa], i) => {
  const mount = document.querySelector(`[data-muestra="${i}"]`);
  if (mount) renderProgramInto(mount, programa);
});
