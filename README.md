# Ritchie AI — asistente con IA **gratuita** (solo frontend)

Asistente educativo de la cohorte que llama **directamente desde el navegador** a modelos
gratuitos de [Google Gemini](https://aistudio.google.com/apikey) u
[OpenRouter](https://openrouter.ai/keys).

**No hay servidor, ni Node, ni `package.json`, ni build.** Abre `index.html` y funciona.

Las respuestas de la IA se generan en **OpenUI Lang**, pero se dibujan con un **renderizador
propio** (`static/app.js` + `static/styles.css`) que usa los mismos colores, formas y
componentes que el resto de la app: tarjetas, pasos, tablas, pestañas, avisos y formularios en lugar
de texto plano. El
bundle de [OpenUI](https://openui.com/) se carga desde CDN **solo para construir el prompt**; si
no carga, se usa un prompt mínimo y las respuestas siguen viéndose con la estética de la app.

> Los documentos de la cohorte son ficticios (de demostración). Sin una API key configurada,
> la app responde con su motor local de respaldo y lo indica en la barra lateral.

## Cómo usarlo

1. Abre **`index.html`** en tu navegador (doble clic; no necesitas servidor).
2. Haz clic en tu **perfil** (abajo en la barra lateral; en móvil, tu avatar en la barra
   superior) → se abre **Configurar IA**.
3. Elige proveedor, selecciona un modelo de la **lista desplegable** y pega tu API key
   gratuita. Puedes pulsar **Probar conexión** antes de guardar:
   - **Google Gemini** → crea una key en https://aistudio.google.com/apikey.
     Modelos gratuitos vigentes: `gemini-4-hydrogen` (recomendado) y
     `gemini-3.5-flash-lite` (rápido). Los antiguos `gemini-3.8-flash`, `3.6-flash`,
     `3.5-flash`, `2.5-flash` y `2.0-flash` están deprecados o saturados (503) y se
     eliminaron de la lista.
   - **OpenRouter** → crea una key en https://openrouter.ai/keys. Por defecto
     `openrouter/free`; también Nemotron 3 Ultra, ERNIE 5.5 Flash, Nemotron 3.5
     Super VL/Lightning, Gemma 4 26B y Ling 3.2 Flash (todos `:free`).
4. Guarda. El indicador debe pasar a **"IA activa · Google Gemini"** (u OpenRouter).
5. Cada respuesta de la IA tiene **Copiar** y **Rehacer**; cada mensaje tuyo tiene **Copiar**
   y **Editar**. Al editar se crea una rama nueva: usa el selector **Rama 1/2** para
   cambiar entre versiones dentro del mismo chat.

La clave se guarda en `localStorage` de tu navegador (en tu máquina, sin servidor), bajo la
clave `ritchie-ia-config-ia`. El perfil muestra el estado (`IA activa · …` o `Configurar IA
(local)`). Puedes quitarla cuando quieras con **Quitar key**.

## Conectar con Moodle (material académico real)

**Mi Moodle** (barra lateral) abre la pestaña **Moodle** dentro de **Configuración**. El único método
de ingreso es **usuario y contraseña**; el sitio de la cohorte tiene web services REST activos y
responde con `Access-Control-Allow-Origin: *`, así que **no hace falta backend**: el navegador llama
directamente a `moodle.riwi.io`.

- Las credenciales se canjean por un token mediante `/login/token.php` (servicio fijo
  `moodle_mobile_app`). La contraseña **se envía directamente a Moodle y se borra del campo** en
  cuanto llega el token; nunca se guarda ni pasa por un servidor propio.
- El token devuelto se guarda en `localStorage` bajo `ritchie-ia-moodle`, solo en este navegador,
  para no volver a pedir la contraseña en cada visita. **Desconectar** lo borra.
- Al ingresar se descargan **solo tus cursos matriculados** (con
  `core_enrol_get_users_courses` usando el `userid` de `core_webservice_get_site_info`), archivos y
  actividades. No se usa `core_course_get_courses`: esa función valida **todos** los cursos del sitio
  y Moodle lanza «Curso o actividad no accesible» si tu cuenta no tiene acceso a alguno (por ejemplo
  el curso 2). Ese contenido se añade al system prompt y se muestra en **Acceso directo a tus
  materiales** con enlaces `pluginfile.php?...&token=...` que abren en pestaña nueva.
- **Navegación por URLs de Moodle:** la IA "abre" los enlaces reales que aparecen en los datos:
  `MOODLE_OPEN({"url":"https://moodle.riwi.io/course/view.php?id=7"})`. Al abrir un enlace de curso
  consulta sus secciones; al abrir una actividad resuelve el material; al abrir un `pluginfile.php`
  obtiene el enlace directo. También puede abrir por `name` o `cmid`. Las URLs ajenas al sitio se
  rechazan.
- **Consultas REST libres:** con `MOODLE_TOOL({"fn":"...","params":{...}})` el modelo consulta
  cualquier función de **solo lectura** del catálogo real que expone el sitio (cursos, tareas,
  calificaciones, foros…), sin una lista fija de comandos. La app valida los parámetros (`userid`
  siempre el tuyo, cursos y actividades solo los descubiertos), ejecuta **todas** las llamadas de la
  respuesta y se las devuelve para que siga avanzando **hasta 12 pasos** antes de dibujar la interfaz.
  Si algo no existe en tu cuenta, lo dice en lugar de inventarlo. Es un bucle de herramientas en
  texto, compatible con Gemini y OpenRouter.
- **Verificación de nombres:** antes de nombrar cursos, materiales, actividades o preguntas
  relacionadas, el modelo debe llamar a
  `MOODLE_VERIFY({"names":["Nombre 1","Nombre 2"]})`. La app comprueba cada nombre contra los cursos,
  materiales, actividades y eventos realmente leídos, y devuelve los nombres exactos válidos junto
  con los `NO ENCONTRADOS`. El modelo no puede extrapolar nombres (por ejemplo, suponer un `T2.1`
  porque existe un `T1.1`) ni incluir lo marcado como no encontrado: si la respuesta depende de eso,
  responde `MOODLE_NOT_FOUND`. La app exige la verificación antes de dibujar la interfaz y descarta
  las respuestas que cuelan nombres no verificados.
- **Detalle de todos los trabajos:** al conectar se consulta `mod_assign_get_assignments` para tus
  cursos y se guardan el nombre, el curso, la fecha límite, las instrucciones, la calificación
  máxima, la modalidad y el enlace de cada tarea. Ese bloque entra en el system prompt y el modelo
  debe copiarlo al responder «qué tengo que hacer», «trabajos», «pendientes» o una semana concreta;
  ya no se limita a decir «revisa la actividad registrada». Si una etiqueta aparece solo dentro de
  las instrucciones (por ejemplo «semana 2»), esa tarea también cuenta. Las actividades que no son
  `assign` se completan con la fecha límite y la descripción de `core_course_get_contents`. Sin key de
  IA, la respuesta local muestra los mismos detalles con enlace a Moodle.
- **Perfil, compañeros y mensajes:** al conectar se guarda tu perfil real de
  `core_webservice_get_site_info`, se consultan los compañeros matriculados en tus cursos con
  `core_enrol_get_enrolled_users` (todos los campos que Moodle expone) y el modelo puede leer tus
  conversaciones con `core_message_get_conversations` y `core_message_get_messages` mediante
  `MOODLE_TOOL`. Las contraseñas nunca se piden ni se guardan.
- **Chats de la app:** `CHAT_LIST`, `CHAT_READ` y `CHAT_WRITE` permiten al modelo listar, leer,
  renombrar, vaciar o eliminar conversaciones. Los cambios de chat muestran el mismo diálogo de
  confirmación que las escrituras en Moodle.
- **Escritura en Moodle con confirmación:** `MOODLE_WRITE` solo acepta
  `core_user_update_users` (siempre con tu `userid`) y `core_message_send_instant_messages`
  (destinatarios ya descubiertos). Antes de enviar cualquier cambio, la app muestra un diálogo con
  la función y los datos; si cancelas, no se envía nada. `MOODLE_TOOL` sigue siendo solo de lectura.
- **Calendario real:** al conectar se consulta `core_calendar_get_calendar_events` (con respaldo de
  `core_calendar_get_action_events_by_timesort`) y sus eventos, con fechas y URLs, se incluyen en el
  contexto. Con Moodle conectado el prompt ya **no incluye los documentos de demostración** ni sus
  ejemplos con fechas inventadas: si la fecha no está en Moodle, el modelo responde
  `MOODLE_NOT_FOUND`. Hay una red de seguridad que descarta respuestas con datos del calendario demo.
- **Fecha, hora y dispositivo:** el modelo consulta el equipo con
  `DEVICE_INFO({"keys":["date","time","timezone","battery"]})`. Campos disponibles: `datetime`,
  `date`, `time`, `timezone`, `language`, `platform`, `device`, `screen`, `viewport`, `pixelratio`,
  `online`, `network`, `battery`, `memory`, `cpu` y `preferences` (sin `keys` consulta todos). Todo se
  lee del navegador al momento; no hay backend ni permisos especiales. Se puede combinar con
  `MOODLE_OPEN` y `MOODLE_TOOL` en la misma respuesta.
- Sin API key, el motor local responde solo con datos reales del dispositivo o con los cursos,
  materiales, tareas y eventos leídos de Moodle; nunca cae en los datos ficticios. Si no hay conexión,
  una pregunta sobre Moodle explica cómo ingresar.

> No se automatiza el formulario de `https://moodle.riwi.io/login/index.php`: sus cookies no son
> legibles desde otro origen. Usamos el mismo usuario y contraseña, pero enviados al endpoint oficial
> `/login/token.php`, que devuelve el token usado por la API REST. Si el servicio
> `moodle_mobile_app` no está habilitado para tu cuenta, pide al TL que lo active.

## Cambiar de proveedor o modelo

Vuelve a tu perfil → **Configurar IA**. Al cambiar de proveedor, la lista de modelos se
actualiza automáticamente y se selecciona el recomendado. Si necesitas un modelo que no
aparece, elige **Otro (escribir ID)** en la lista y escribe el ID exacto; el campo aparece
solo en ese caso.

Si un modelo responde **503/429** (alta demanda o cuota), la app reintenta automáticamente
con el siguiente modelo gratuito de la lista antes de mostrar el error.

Cuando ningún modelo funciona, el error se muestra como una tarjeta según su causa:

- **Límite de uso alcanzado** (cuota o demasiadas peticiones): indica cuándo reintentar y
  sugiere cambiar de modelo/proveedor. No muestra el texto técnico del proveedor.
- **La clave no fue aceptada**: invita a corregir la key en **Configurar IA**.
- **El modelo no está disponible**, **No se pudo conectar** o **El modelo no devolvió texto**:
  cada uno tiene su propio mensaje y color.
- Las tarjetas de error de IA ofrecen **Reintentar** y **Configurar IA**; el error genérico
  conserva **Reformular la pregunta** y **Hablar con el TL**.

No se añadió la API de OpenCode como proveedor: su API de Console no habilita CORS para el
navegador y sus modelos gratuitos devuelven `403` fuera de OpenCode. Si se quiere usar,
tendría que ser desde un servidor propio o desde una instancia local de OpenCode.

## Respuestas con interfaz propia

- `index.html` carga solo el bundle de `@openuidev/browser-bundle@0.2` desde jsDelivr, que
  expone `openuiChatLibrary` en `window.__OpenUI`. Ya **no se carga su CSS ni su Renderer**.
- `static/app.js` usa `openuiChatLibrary.prompt({...})` para generar el system prompt: así el
  modelo conoce la sintaxis y los componentes permitidos. Las reglas de la cohorte y de privacidad
  se pasan como `preamble`.
- La IA devuelve un programa (siempre empieza con `root = Card(...)`) y un intérprete propio en
  `static/app.js` lo convierte en HTML con las clases de la app. El prompt incluye ejemplos y
  reglas
  para combinar **tarjetas, encabezados, callouts, separadores, pasos, tablas, listas, entidades,
  pestañas, etiquetas, botones y sugerencias de seguimiento**, eligiendo la vista según el
  contenido; no inventa cifras para gráficas.
- La respuesta llega **en tiempo real**: se usa `streamGenerateContent` (Gemini) o `stream: true`
  (OpenRouter). Los fragmentos se dibujan **como interfaz mientras llegan** —tarjetas, encabezados,
  textos y enlaces aparecen progresivamente— sin mostrar nunca el código `root = Card(...)`. Si aún
  no hay nada renderizable se ve solo un aviso con el anillo; las consultas internas a Moodle se
  muestran como «Consultando Moodle». Al terminar se sustituye por la interfaz definitiva. Si el
  streaming falla, se usa la llamada normal.
- El prompt pide respuestas desarrolladas (120–250 palabras) con varios componentes,
  prohíbe `Sources`/`CardSourceProvider` y **no muestra nombres de documentos, PDFs, bloques de
  fuente ni notas de autonomía** en los mensajes.
- Los **formularios personalizados** son los mismos componentes en las respuestas de la IA y en
  **Configuración de IA** (`index.html` usa `.ui-form`, `.ui-field`, `.ui-input`, `.ui-select` y
  `.ui-btn`). Usan `Form` con `FormControl`, pistas, `Select`, `Chips`, `OptionCards`, `TextArea`,
  casillas y botones primarios/secundarios: campos tonales de 56 px, estados seleccionados con
  marca de verificación, botones de 48 px y una columna en móvil. Si el formulario tiene un solo
  botón, ese botón ocupa todo el ancho disponible.
- Los **acordeones** (`SectionBlock`/`Accordion`) muestran una flecha Material a la derecha del
  `summary`, que cambia al abrir, y las listas tienen una acción circular con borde para avanzar.
- La IA puede incluir **enlaces** como `Link("Etiqueta", "https://...")`, como
  `[Etiqueta](https://...)` en cualquier campo de texto (títulos, tablas, listas, pistas…) o como
  un `Button` con URL. Se pintan con el color de la app y **se abren en una pestaña nueva**
  (`target="_blank"` y `rel="noopener noreferrer"`). Se aceptan `http`, `https` y `www.` (se
  convierte a `https`); el prompt pide no inventar URLs. Si el modelo devuelve un componente suelto
  como raíz, por ejemplo solo un `Link`, se envuelve en una tarjeta en vez de perder la respuesta.
- La tipografía sigue la escala **Material 3 Expressive** y la del resto de la página: títulos
  22/28, cuerpo 16/24, texto secundario 14/20 y etiquetas 15/20; los textos grandes de las
  respuestas ya no se reducen.
- Al enviar un formulario, el chat muestra solo el **mensaje de la persona** (por ejemplo,
  «Guardar mis preferencias»); los datos del formulario viajan ocultos como contexto para la IA
  y se resumen después en una **lista de datos con etiquetas legibles**.
- Si no hay conexión con el CDN, se usa un prompt mínimo, pero las respuestas siguen
  dibujándose con la interfaz propia. Requiere internet solo para cargar el bundle del prompt;
  la API key sigue siendo gratuita y local.

## En móvil

La interfaz usa una **barra superior** (logo, menú, nueva conversación y avatar), no un menú
lateral. El botón de menú despliega el historial y las opciones hacia abajo; el avatar abre la
misma configuración de IA. En el modal de Configuración, las secciones (IA, Chats e historial,
Ayuda y TL) se muestran como una **barra horizontal arriba**, con desplazamiento lateral si no
caben todas en la pantalla.

## Privacidad (importante)

- La API key **no está en el código** y no se envía a ningún servidor propio: viaja
  directamente del navegador a Gemini/OpenRouter.
- Cualquier persona con acceso a ese navegador podría ver la key guardada. Usa una key
  **de prueba y restringida** (en Google AI Studio puedes limitarla por sitio web), y nunca
  una key de producción. Para un despliegue público real, la key debería vivir en un backend.
- La contraseña de Moodle **no se guarda**: se envía directamente a `/login/token.php` y se borra
  del campo al recibir el token. Solo se conserva el token en este navegador.
- Los datos personales detectados en la pregunta se ocultan antes de enviarlos al modelo y
  también se redactan en la respuesta. El texto de la IA se escapa antes de insertarse en el DOM.
- Los temas sensibles (salud, calificaciones, situaciones personales) se derivan al
  TL (Team Leader) y nunca se envían a la IA.

## Archivos

- `index.html`: interfaz, modales (documento y **Configuración**, con secciones de IA,
  chats, ayuda y TL (Team Leader)).
- `static/styles.css`: estilos, incluido el indicador de conexión y el formulario de IA.
- `static/app.js`: chat, historial, motor local de respaldo y llamada directa a Gemini/OpenRouter.
- `HALLAZGOS.md`: resultados de la prueba con otro equipo.
