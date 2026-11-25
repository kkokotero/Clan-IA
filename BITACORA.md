# Bitácora del proyecto — Ritchie AI

Registro cronológico y técnico de cómo se construyó el asistente educativo **Ritchie AI**: qué se pidió, qué se fue haciendo, por qué se tomaron ciertas decisiones y cómo se conectó la interfaz con un modelo de IA gratuito. Todo se reconstruyó a partir del historial real de Git (15 commits, del 24 al 25 de noviembre de 2026) y de la documentación del repositorio.

Última actualización: 25 de noviembre de 2026.

---

## Mapa de documentación

Esta bitácora no sustituye a los documentos del proyecto: los enlaza y los conecta con el historial de cambios.

| Documento | Qué contiene | Conexión con esta bitácora |
|---|---|---|
| [docs/prompt.md](docs/prompt.md) | Brief original del encargo: identidad, Material 3 Expressive, estructura de la app, requisitos técnicos y resultado esperado. | Es el **punto de partida**. La sección 1 resume qué se pidió y la sección 6 indica qué se cumplió, qué se adaptó y qué quedó pendiente. |
| [README.md](README.md) | Guía de uso, proveedores y modelos, comportamiento de las respuestas, privacidad y lista de archivos. | Es el **estado actual** del producto. La sección 3 explica cómo se llegó a ese funcionamiento y la sección 4 describe la arquitectura resultante. |
| [HALLAZGOS.md](HALLAZGOS.md) | Prueba con otro equipo, revisión propia con 18 preguntas, fallas corregidas y temas abiertos. | Es el **cierre del ciclo de validación**. La sección 6 retoma sus pendientes y los conecta con los últimos commits. |
| [index.html](index.html) | Estructura de la SPA: barra lateral, chat, modales de documento y configuración. | Se mantuvo en la raíz tras la reorganización de assets (`d13c4bb`). |
| [static/app.js](static/app.js) | Chat, historial, conexión con la IA, prompt, intérprete de respuestas y motor local. | Es el núcleo del flujo descrito en la sección 3. |
| [static/styles.css](static/styles.css) | Sistema visual Material 3 Expressive y estilos de los componentes generados por la IA. | Materializa la dirección visual pedida en [docs/prompt.md](docs/prompt.md). |
| [static/site.webmanifest](static/site.webmanifest) | Manifiesto PWA con los iconos del conejo. | Se añadió junto al favicon en `f2efb49` y se ajustó en `d13c4bb`. |

> Nota de trazabilidad: `docs/prompt.md` es el documento de entrada del encargo. Antes de esta bitácora no aparecía en el historial de Git; se versiona junto con ella para conservar el brief original al lado del código.

---

## 1. El punto de partida: el brief

El archivo [docs/prompt.md](docs/prompt.md) define a Ritchie AI como el asistente educativo del Clan Ritchie, con personalidad cercana, inteligente, motivadora y confiable, dirigido a estudiantes y en español. Entre sus exigencias principales:

- **Identidad visual**: Material Design 3 Expressive, paleta azul violeta/lavanda/coral, fondos cálidos, bordes muy redondeados (20–32 px), botones tipo pill, tipografía Inter/Google Sans, iconografía Material Symbols y microinteracciones.
- **Estructura**: SPA con barra lateral plegable (logo, «Nueva conversación», historial, Ayuda y TL), área principal de chat, bienvenida, cuatro tarjetas de sugerencias y compositor flotante.
- **Conversación**: mensajes alineados, indicador de escritura, copiar/rehacer, hora, scroll automático y aviso de verificación de fuentes.
- **Configuración local de IA**: proveedor, endpoint, key, modelo y persistencia en el navegador, cuidando no exponer credenciales.
- **Extras**: nuevas conversaciones, historial, búsqueda, estados de conexión, responsive y accesibilidad.
- **Requisitos técnicos propuestos**: React, TypeScript, Tailwind, arquitectura modular y una capa de abstracción para conectar proveedores de modelos.
- **Regla importante**: no simular una conexión real si no hay API configurada; mostrar claramente el modo demostración.

**Adaptación decisiva**: la implementación final eligió **HTML + CSS + JavaScript puro, sin servidor, sin `package.json` y sin build** (documentado en [README.md](README.md)). Se conservaron la experiencia visual, el chat y la conexión directa con modelos gratuitos, pero se descartó el stack React/TypeScript/Tailwind para que la app se abra con doble clic en `index.html`. La capa de abstracción de proveedores se resolvió dentro de `app.js`.

---

## 2. Cronología del trabajo

Los hashes se pueden inspeccionar con `git show <hash>`. Las fechas y los mensajes son los registrados en el repositorio.

### Día 1 — 24 de noviembre: de la maqueta a la app con IA

| Hora | Commit | Qué se hizo | Por qué / resultado |
|---|---|---|---|
| 07:18 | `be14fe8` | Primera estructura HTML, CSS y JS en `semana-1/`. | Nace la interfaz base: barra lateral, chat y estilos iniciales. El JS ya guardaba conversaciones en `localStorage`. |
| 13:58 | `a67d60d` | Refactor de componentes y cambio de marca de «Clan IA» a «Ritchie AI». | Gran salto funcional: se integra el historial, el motor local y **la conexión directa con Gemini y OpenRouter**, con streaming y renderizado vía OpenUI. Se crean `README.md` y `HALLAZGOS.md`. |
| 21:10 | `c13552c` | Movimiento de `semana-1/` a la raíz. | El proyecto deja de ser una carpeta de entrega semanal y pasa a ser la app principal. |
| 21:23 | `76356b6` | Pie del menú móvil fijo y aviso de IA desconectada en la página. | Se corrige que el historial tapara el perfil en móvil y se hace visible la falta de conexión sin mensajes intrusivos en el lateral. |
| 21:30 | `d31b46d` | Retirada de textos de estado de la IA. | El estado pasa a comunicarse de forma visual (interfaz monocromática / avatar con borde verde) en lugar de chips y etiquetas. |
| 21:39 | `d4e53ad` | Renovación del estado vacío del chat. | Bienvenida y cuatro sugerencias aleatorias por conversación; el campo se centra y el aviso de errores se acorta al final del historial. |
| 21:45 | `d1e9d66` | Ajuste del historial y simplificación del estado vacío. | Se corrige el icono que ocupaba el texto del historial y se retira el logo del hero. |
| 22:08 | `d63e5ac` | Mensajes de formulario condicionados y UI de OpenUI unificada. | Los datos de un formulario viajan a la IA como contexto sin mostrar un mensaje de usuario extra; se aplica la paleta y el tema claro desde la raíz, incluidos desplegables y popovers. |
| 22:22 | `f2efb49` | Configuración ampliada y favicon del conejo. | Aparecen las pestañas de IA y de chats/historial (estadísticas, exportación JSON y borrado), además de `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, iconos PWA y `site.webmanifest`. |

### Día 2 — 25 de noviembre: madurez funcional y organización

| Hora | Commit | Qué se hizo | Por qué / resultado |
|---|---|---|---|
| 06:30 | `ffb75b7` | Configuración reorganizada en secciones verticales, más Ayuda y TL. | El modal pasa a cuatro secciones (IA, chats, ayuda y TL). Se renombra «coach» por «TL (Team Leader)» en interfaz, respuestas y documentación. |
| 06:58 | `9530bac` | «Rehacer» sustituye la respuesta y las acciones pasan a iconos. | Al rehacer, el mensaje anterior se reemplaza de inmediato por un estado pendiente y la nueva respuesta ocupa el mismo lugar. Las acciones son iconos grandes con etiqueta accesible y, en escritorio, aparecen al pasar el cursor o enfocar. |
| 07:22 | `056c563` | Secciones de configuración en barra superior en móvil. | En pantallas pequeñas las cuatro secciones se muestran como pestañas horizontales con desplazamiento lateral. |
| 07:37 | `8e321db` | Ampliación de la UI generada por la IA y mejoras en formularios. | Más componentes en las respuestas (tarjetas, pasos, tablas, pestañas, entidades, avisos), formularios más cuidados y tipografía acorde a Material 3 Expressive. |
| 08:06 | `b6c3d88` | Refactor importante de estructura y legibilidad. | Cambio arquitectónico clave: se deja de usar el `Renderer` oficial de OpenUI y se adopta un **renderizador propio** en `app.js` + `styles.css`. El bundle de OpenUI se conserva solo para construir el prompt. |
| 08:10 | `d13c4bb` | Assets movidos a `static/` y `static/favicons/`. | Organización final: `index.html` permanece en la raíz; CSS, JS y manifiesto van a `static/`, y los iconos a `static/favicons/`. Se actualizan todas las rutas. |

### Lectura rápida de la evolución

1. **Maqueta con persistencia** (`be14fe8`).
2. **Identidad Ritchie AI + conexión real con IA** (`a67d60d`).
3. **Traslado a la raíz y pulido responsive** (`c13552c` → `d1e9d66`).
4. **Formularios, privacidad visual y PWA** (`d63e5ac`, `f2efb49`).
5. **Configuración completa, Ayuda y TL** (`ffb75b7`, `056c563`).
6. **Interacciones de mensaje y riqueza de respuestas** (`9530bac`, `8e321db`).
7. **Independencia del renderer externo y orden de carpetas** (`b6c3d88`, `d13c4bb`).

---

## 3. Cómo se conectó con la IA

Esta sección resume el flujo implementado, detallado en [README.md](README.md) y en el código de [static/app.js](static/app.js).

### 3.1 Decisión de arquitectura: sin backend

La key se escribe en el modal de configuración y viaja **directamente desde el navegador hasta el proveedor**. No hay servidor propio, por lo que la credencial nunca pasa por él ni está escrita en el código. El detalle de privacidad está en [README.md](README.md), sección «Privacidad (importante)».

- Configuración persistida en `localStorage` bajo la clave `ritchie-ia-config-ia` (`proveedor`, `apiKey`, `modelo`). Un modelo inválido vuelve al predeterminado del proveedor y un proveedor inválido vuelve a Gemini (`normalizeSettings`, `app.js:203-214`).
- Si el navegador bloquea `localStorage` (ocurre con algunos `file://`), se mantiene en memoria durante la sesión (`memorySettings`, `app.js:200-201`).
- Perfil → «Configurar IA» permite probar la conexión antes de guardar (`aiTest`, `app.js:2030-2054`) y «Quitar key» para borrarla (`app.js:2021-2028`). El estado conectado se refleja con clases y en el avatar, no con un texto de «IA activa» (`refreshAIStatus`, `app.js:1760-1775`).

### 3.2 Proveedores y modelos

| Proveedor | Endpoint | Modelos |
|---|---|---|
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key=…` (y `:streamGenerateContent?alt=sse&key=…` para streaming) | Por defecto `gemini-4-hydrogen` (recomendado); también `gemini-3.5-flash-lite` (rápido). Se retiraron modelos deprecados o saturados con 503. |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` con cabecera `Authorization: Bearer <key>` | Por defecto `openrouter/free`; también modelos `:free` como Nemotron 3 Ultra, ERNIE 5.5 Flash, Gemma 4 26B y Ling 3.2 Flash. El catálogo exacto de IDs está en `PROVIDERS` ([static/app.js](static/app.js), líneas 21-63). |

Si un modelo responde **503/429** (alta demanda o cuota), la app reintenta automáticamente con el siguiente modelo gratuito de la lista antes de mostrar el error (comportamiento descrito en [README.md](README.md)). El reintento solo se activa si el mensaje coincide con `/503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|overload|high demand/i` (`askAI`, líneas 777-807; `streamAI`, líneas 901-929); en streaming se descarta el texto parcial del modelo caído antes de probar el siguiente. Las peticiones usan `temperature: 0.3` y un máximo de 2500 tokens de salida; Gemini envía la key en la URL y OpenRouter en la cabecera `Bearer`, con `HTTP-Referer` y `X-Title` (líneas 680-725 y 835-899).

La cadena de resiliencia es: **streaming → llamada normal → tarjeta de error honesta** (con proveedor y motivo), o **motor local** directamente si no hay key.

### 3.3 El prompt: OpenUI solo para construirlo

[index.html](index.html) carga desde jsDelivr el bundle `@openuidev/browser-bundle@0.2`, que expone `openuiChatLibrary` en `window.__OpenUI`. [static/app.js](static/app.js) usa `openuiChatLibrary.prompt({...})` para generar el system prompt y añade como `preamble` las reglas de la cohorte y de privacidad. Así el modelo conoce la sintaxis y los componentes permitidos sin que la app dependa del renderizador externo.

El `SYSTEM_PROMPT` (líneas 65-105) fija la personalidad, exige responder solo con los documentos de la cohorte (o devolver `NO_SE` si no están), prohíbe markdown y fuentes, e incrusta el calendario, la guía del proyecto y los materiales. `buildSystemPrompt()` (líneas 109-183) añade cuatro programas de ejemplo, reglas adicionales (español neutro, 120-250 palabras, argumentos posicionales, formularios, prohibición de PII) y se ejecuta **en cada petición**, por lo que un `defer` lento del CDN no rompe la construcción.

Si el CDN no responde, se usa un **prompt mínimo** (líneas 179-182) y las respuestas se siguen dibujando con la interfaz propia. Es decir, la dependencia de red se limita a la construcción del prompt; la key sigue siendo local y gratuita.

### 3.4 Streaming y renderizado de la respuesta

1. La petición usa streaming: `streamGenerateContent` en Gemini o `stream: true` en OpenRouter. `readSSE()` (líneas 810-833) lee el cuerpo con `getReader()`, guarda el fragmento incompleto en un búfer e ignora `[DONE]`. Cada proveedor extrae el texto y `renderStream()` decide: si el fragmento es prosa lo dibuja escapado con un anillo pulsante; si es un programa OpenUI, `repairProgram()` cierra comillas/paréntesis abiertos y `renderPartialProgram()` dibuja **componentes reales** con lo que ya llegó. El código fuente del lenguaje nunca se muestra; mientras no hay nada renderizable aparece solo un aviso con el anillo. Las consultas `MOODLE_TOOL` se sustituyen por «Consultando Moodle».
2. Si el streaming falla, se hace la llamada normal (`generateContent` / completions sin `stream`).
3. El texto en streaming es **transitorio**: al terminar, `finishResponse()` (líneas 1517-1534) sustituye la tarjeta por la respuesta definitiva. Si es OpenUI, el programa empieza con `root = Card(...)` y un **intérprete propio** en [static/app.js](static/app.js) (parser en líneas 957-1079 y `renderNode` en 1114-1291), con las clases de [static/styles.css](static/styles.css), lo convierte en tarjetas, encabezados, callouts, separadores, pasos, tablas, listas, entidades, pestañas, etiquetas, botones, formularios y sugerencias de seguimiento.
4. El prompt prohíbe `Sources`/`CardSourceProvider` y evita mostrar nombres de documentos, PDFs o notas de autonomía: los documentos de la cohorte son ficticios, como advierte [README.md](README.md). Si el programa no se puede interpretar, `programToText()` extrae los textos y los une con `·` para no dejar un mensaje vacío.

El cambio de `Renderer` oficial a renderizador propio ocurrió en `b6c3d88`: así la respuesta usa exactamente la paleta, la tipografía y los componentes del resto de la app, en lugar del estilo por defecto de OpenUI.

### 3.5 Sin key: modo demostración

Cuando no hay API key, la app no finge una conexión: usa un **motor local de respaldo** con datos ficticios de la cohorte y muestra en el área principal el aviso «Sin conexión con la IA. Las respuestas son de demostración; configura una key en tu perfil para conectar», con acceso directo a «Configurar IA». Esta decisión respeta la regla del brief en [docs/prompt.md](docs/prompt.md) y se ajustó en `76356b6`.

`resolveAnswer()` (líneas 643-676) decide entre resumen de formulario, encuesta de demostración, derivación al TL, respuesta de `KNOWLEDGE` o error. La coincidencia se resuelve por **keyword más larga**, no por la primera de la lista (líneas 656-666): así se corrigió el fallo registrado en [HALLAZGOS.md](HALLAZGOS.md) donde «actividades pendientes del proyecto» respondía con la entrega del proyecto.

### 3.6 Privacidad y derivación al TL

- Los datos personales detectados en la pregunta se ocultan antes de enviarlos al modelo y también se redactan en la respuesta. `PII_PATTERNS` (líneas 249-260) cubre correo, teléfono y documentos de 6-10 dígitos; la redacción se aplica al enviar, al limpiar la respuesta, a cada fragmento del streaming y al guardar ediciones.
- El texto de la IA se escapa antes de insertarse en el DOM (`richText`, líneas 1083-1088; `renderStream`, líneas 1432-1444).
- Los temas sensibles (salud, calificaciones, situaciones personales o decisiones sobre otras personas) **nunca se envían a la IA**: se comprueban antes de la rama con key (`respond`, líneas 1553-1555) y también en el motor local. Se derivan al TL (Team Leader), cuyos datos de contacto de demostración están en el modal de configuración. La terminología pasó de «coach» a «TL» en `ffb75b7`. El listado de marcadores está en `SENSITIVE` (líneas 452-487).

### 3.7 Historial y mensajes

- Las conversaciones se guardan en `localStorage` bajo la clave `ritchie-ia-historial`, con opciones de exportar a JSON (`ritchie-ia-historial.json`) y borrar (parcial o total) en la pestaña «Chats e historial», añadida en `f2efb49`.
- El historial es un **árbol de nodos** (`{id, parentId, role, …}`) con `activeLeafId`, no una lista plana (`app.js:489-553`). `load()` migra conversaciones antiguas con `messages` a ese formato (líneas 620-641).
- Cada respuesta tiene **Copiar** y **Rehacer**; cada mensaje del usuario, **Copiar** y **Editar**. `regenerate()` crea un nodo hermano pendiente (`1677-1700`), `saveEdit()` crea un nuevo nodo usuario hermano (`1714-1728`) y `switchBranch()` alterna entre ramas (`1702-1712`).
- Los formularios generados por la IA envían sus datos como contexto oculto (`Datos del formulario: {...}`): el chat muestra solo el mensaje de la persona y la respuesta resume las preferencias en una lista con etiquetas legibles (`d63e5ac`, `8e321db`).

### 3.8 Integración con Moodle

**Mi Moodle** dejó de ser un modal: ahora es una pestaña de **Configuración** y el único formulario
pide **usuario y contraseña**. Las credenciales se canjean por un token en
`/login/token.php` (servicio `moodle_mobile_app`) y la contraseña se descarta; solo el token se
guarda en `localStorage` (`ritchie-ia-moodle`). No se automatiza
`https://moodle.riwi.io/login/index.php` porque sus cookies no son legibles desde otro origen.

El fallo reportado «No puede ejecutar funciones en el contexto de curso (course id: 2)… Curso o
actividad no accesible» no venía del login, sino de `core_course_get_courses`: Moodle valida el
contexto de **todos** los cursos del sitio y falla si la cuenta no tiene acceso a alguno. La carga
ahora usa `core_enrol_get_users_courses` con el `userid` devuelto por
`core_webservice_get_site_info`, es decir, solo los cursos matriculados; el listado global queda
como respaldo silenciado. La misma restricción se aplicó a la navegación de la IA: el tool
`core_course_get_courses` se sustituyó por `core_enrol_get_users_courses` y el `userid` siempre se
fija al de la sesión.

El bucle de herramientas se amplió después de que el modelo se quedara corto al pedir más datos.
Ahora `core_webservice_get_site_info` aporta el catálogo real de funciones del sitio;
`safeMoodleFunctions()` solo admite nombres con el segmento `_get` (de cualquier plugin: `core`,
`mod`, `block`, `badges`, `report`…) y descarta los verbos de escritura, mientras
`moodleToolAllowed()` bloquea `core_course_get_courses`. Eso permite consultar también tareas,
calificaciones, foros y demás módulos que el servicio habilite, sin abrir funciones que modifiquen
Moodle. `extractMoodleCalls()` acepta **varias** líneas `MOODLE_TOOL(...)` por respuesta y
`sanitizeMoodleParams()` limita `userid`, `courseid`, `cmid` y los arrays a valores ya descubiertos;
si el modelo omite el `userid` de `core_enrol_get_users_courses`, se completa con el de la sesión.
El modelo tiene hasta 12 pasos, puede reintentar si una consulta falla y recibe un historial
compactado (máximo 8 entradas y 24.000 caracteres) para no agotar su ventana de contexto.

Después se descartó la idea de un panel de vista previa: al ser una app estática no se puede
incrustar Moodle y controlarlo desde fuera (política same-origin), y añadir Playwright habría
requerido un backend. En su lugar el modelo **sigue las URLs que aparecen en los propios datos de
Moodle** con `MOODLE_OPEN({"url":"..."})`. `collectMoodleURLs()` guarda los enlaces que devuelven las
consultas REST; `moodleOpenURL()` exige que pertenezcan al sitio conectado, extrae `id`/`courseid`/
`cmid` y trae el contenido asociado (`core_course_get_contents` para `course/view.php`, resolución de
actividades para `mod/.../view.php` y enlace con token para `pluginfile.php`). `applyMoodleOpen()`
también permite abrir por nombre o `cmid` ya descubierto. Si tras los 12 pasos el modelo sigue
pidiendo herramientas, se devuelve `MOODLE_NOT_FOUND` para no mostrar el protocolo ni inventar datos.

### 3.9 Mapa rápido del código

| Bloque | Líneas de [static/app.js](static/app.js) | Responsabilidad |
|---|---|---|
| `PROVIDERS`, `SYSTEM_PROMPT`, `buildSystemPrompt` | 21-183 | Catálogo de modelos, reglas y construcción del prompt con OpenUI |
| Configuración y PII | 200-272 | `localStorage`, memoria de respaldo, redacción de datos |
| `KNOWLEDGE`, `SENSITIVE`, motor local | 274-676 | Respuestas de demostración, derivación al TL y scoring de intenciones |
| Llamadas a IA y streaming | 679-929 | Gemini/OpenRouter, SSE, reintentos y fallback |
| Parser y renderizador OpenUI | 931-1304 | De `root = Card(...)` a HTML con las clases de la app |
| Flujo principal | 1483-1614 | `ask` → `respond` → `finishResponse` |
| Ramas y acciones | 1622-1775 | Copiar, rehacer, editar, cambiar rama, estado de conexión |
| Eventos y configuración | 1809-2117 | Envío, formularios, pestañas, key y gestión del historial |
| Arranque | 2191-2196 | `load → render → refreshAIStatus` |

---

## 4. Arquitectura resultante

```
Ritchie AI/
├── index.html                 # SPA: sidebar, chat, modales, enlaces a los assets
├── BITACORA.md                # este documento
├── README.md                  # guía de uso y estado actual
├── HALLAZGOS.md               # validación con otro equipo y pendientes
├── docs/
│   └── prompt.md              # brief original del encargo
└── static/
    ├── app.js                 # chat, historial, IA, prompt, renderer propio, motor local
    ├── styles.css             # Material 3 Expressive + componentes de respuesta
    ├── site.webmanifest       # PWA (iconos relativos a favicons/)
    └── favicons/
        ├── favicon.svg
        ├── favicon.ico
        ├── apple-touch-icon.png
        ├── icon-192.png
        └── icon-512.png
```

La separación entre interfaz (`index.html` + `styles.css`), lógica (`app.js`), configuración (`localStorage`) y servicio de IA (`fetch` a Gemini/OpenRouter) responde al requisito del brief de separar responsabilidades, adaptado a un proyecto sin build (`d13c4bb` ordenó físicamente esas responsabilidades en carpetas).

---

## 5. Decisiones y aprendizajes

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| HTML/CSS/JS sin build | React + TypeScript + Tailwind pedidos en [docs/prompt.md](docs/prompt.md) | Abrir `index.html` sin servidor ni dependencias de instalación; simplicidad de entrega. |
| Llamada directa al proveedor | Backend con la key | No hay servidor; la key queda en el navegador y viaja solo a Gemini/OpenRouter. Consecuencia: usar key de prueba y restringida. |
| CDN solo para el prompt | CSS y `Renderer` de OpenUI en producción (`a67d60d` → `b6c3d88`) | Evitar estilos ajenos y lograr que las respuestas se vean como el resto de la app; el CDN deja de ser crítico para el dibujo. |
| Estado de conexión visual | Chips y textos «IA activa» / «Modo demostración» (`d31b46d`) | Menos ruido; aviso explícito solo cuando falta la key (`76356b6`). |
| Rehacer en el mismo lugar | Insertar una respuesta nueva | Evita duplicados y conserva el hilo legible (`9530bac`). |
| Pestañas horizontales en móvil | Columna vertical también en móvil | Aprovechar el ancho disponible y mantener las cuatro secciones accesibles (`056c563`). |
| Assets en `static/` | Archivos sueltos en la raíz | Organización y rutas claras sin cambiar el funcionamiento (`d13c4bb`). |

---

## 6. Estado actual y pendientes

**Ya funcionando:** interfaz responsive con barra lateral y barra superior móvil, chat con historial y ramas, sugerencias, modales de documento y configuración en cuatro secciones, conexión con Gemini/OpenRouter con streaming y reintentos, renderizador propio de OpenUI Lang, formularios interactivos, motor local sin key, exportación/borrado de historial, PWA con favicon del conejo.

**Validación:** la revisión propia en [HALLAZGOS.md](HALLAZGOS.md) cubrió 18 preguntas, el error y el botón de reformular. Se corrigieron los falsos desvíos al TL, los errores en preguntas de fecha límite y «quién es el TL», y el solapamiento de temas en actividades del proyecto. Queda una plantilla abierta para la prueba con otro equipo.

**Pendientes y diferencias respecto al brief:**

- [HALLAZGOS.md](HALLAZGOS.md): decidir la temática de «¿Hasta qué horas abren?» y «¿Puedo renovar un libro?» (la demo es de cohorte, pero esas preguntas suponen una biblioteca).
- Completar la tabla de [HALLAZGOS.md](HALLAZGOS.md) con el equipo probador, la fecha y las observaciones.
- Funciones del brief [docs/prompt.md](docs/prompt.md) que no forman parte de la versión actual: adjuntar archivos, búsqueda en el historial, renombrar conversaciones, selector de tema claro/oscuro/sistema y notificaciones tipo Snackbar. El botón «Consultar documento» abre un aviso porque el documento es de ejemplo.

**Deuda técnica detectada al revisar el código:**

- `SOURCE_MAP` y `detectSource()` (líneas 185-198 y 728-734) quedaron sin uso tras eliminar las fuentes de las respuestas; también hay un handler `[data-doc]` sin productores actuales. Es reminiscencia de la versión descrita en [HALLAZGOS.md](HALLAZGOS.md) con «fuente debajo».
- El disclaimer de [index.html](index.html) dice «verifica siempre las fuentes» mientras el prompt prohíbe mostrar fuentes: conviene armonizar el texto.
- El estado del perfil muestra siempre «Configurar IA (local)» (`app.js:1770`), aunque [README.md](README.md) menciona un indicador «IA activa · …»; la conexión se comunica por color y avatar.
- Los datos de un formulario se concatenan al prompt **después** de la redacción de PII (líneas 1511-1513): la mitigación actual es que el prompt prohíbe pedir datos personales y los formularios de ejemplo solo piden tema, ritmo, formato y comentario.
- `msg.short` se inserta sin `escapeHTML` en `cardHTML` (línea 1318) en la ruta de texto plano del modelo; el resto de las rutas sí escapan el contenido.

---

## 7. Cómo verificar lo documentado

1. Abre [index.html](index.html) directamente en el navegador: no requiere servidor ni instalación.
2. Sin key, confirma el aviso de modo demostración y las respuestas del motor local.
3. Perfil → «Configurar IA» → elige proveedor y modelo → pega una key gratuita → «Probar conexión» → «Guardar».
4. Compara el resultado con la guía de [README.md](README.md) y con los componentes pedidos en [docs/prompt.md](docs/prompt.md).
5. Para revisar cualquier paso del proceso: `git log --reverse` y `git show <hash>` usando los commits de la sección 2.
