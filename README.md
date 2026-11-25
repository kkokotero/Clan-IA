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
- **Navegación por la IA:** el modelo puede pedir una o varias consultas por turno, por ejemplo
  `MOODLE_TOOL({"fn":"core_course_get_contents","params":{"courseid":7}})`. El catálogo se lee del
  propio Moodle (`core_webservice_get_site_info`) y se filtra a funciones de **solo lectura** —no
  solo cursos y materiales, también tareas, calificaciones, foros y demás módulos que el sitio
  exponga—. La app valida los parámetros (`userid` siempre el tuyo, cursos y actividades descubiertas
  solo los tuyos), ejecuta todas las consultas de la respuesta y devuelve los resultados al modelo
  para que siga avanzando **hasta 12 pasos** antes de dibujar la interfaz final. Si una consulta
  falla, el modelo puede cambiar de función y reintentar. Es un bucle de herramientas en texto,
  compatible con Gemini y OpenRouter.
- Sin API key, el motor local despliega los materiales en acordeones. Si no hay conexión, una
  pregunta sobre Moodle explica cómo ingresar.

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
