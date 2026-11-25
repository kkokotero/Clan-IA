Ritchie AI — Interfaz de asistente educativo del Clan Ritchie

Diseña y desarrolla una interfaz web moderna, atractiva, intuitiva y completamente responsive para Ritchie AI, el asistente educativo oficial del Clan Ritchie.

La interfaz debe estar inspirada profundamente en la filosofía visual de Material Design 3 Expressive (Material You Expressive), utilizando formas orgánicas, contenedores con esquinas muy redondeadas, colores expresivos, jerarquías visuales dinámicas, tipografía moderna y microinteracciones fluidas.

El resultado debe sentirse como un producto tecnológico premium, amigable, educativo y humano. Evita la apariencia de un dashboard administrativo tradicional o de un chatbot genérico.

1. Identidad del producto
Nombre: Ritchie AI.
Organización: Clan Ritchie.
Descripción: Asistente educativo.
Personalidad: Cercana, inteligente, motivadora, confiable y colaborativa.
Audiencia: Estudiantes y miembros del Clan Ritchie.
Idioma principal: Español.
Enfoque: Centralizar el acompañamiento educativo y facilitar el acceso a información sobre clases, sesiones, actividades, fechas de entrega, proyectos y comunicación con el Team Leader.
2. Dirección visual: Material 3 Expressive

Aplicar los principios de Material Design 3 Expressive:

Paleta de colores:

Color primario: Azul violeta expresivo.
Color secundario: Lavanda.
Color terciario: Coral o naranja suave.
Fondo principal: Tonos neutros ligeramente cálidos.
Superficies: Capas tonales diferenciadas.
Modo oscuro: Variante completa con superficies profundas y acentos expresivos.

Características visuales:

Bordes muy redondeados (20px–32px).
Botones tipo pill.
Tarjetas con formas suaves y orgánicas.
Tipografía moderna, preferiblemente Google Sans o Inter.
Iconografía Material Symbols Rounded.
Espaciado generoso y composición limpia.
Sombras sutiles y profundidad mediante tonalidades.
Animaciones naturales y transiciones fluidas.
Estados hover, focus, active y disabled bien definidos.

La interfaz debe priorizar la legibilidad, accesibilidad y una experiencia visual equilibrada.

3. Estructura principal de la aplicación

Crear una aplicación tipo SPA con un diseño de dos áreas principales:

A. Sidebar de navegación

Una barra lateral izquierda que pueda expandirse o contraerse.

Debe contener:

Encabezado:

Logotipo o isotipo de Ritchie AI.
Nombre Ritchie AI.
Subtítulo: Asistente educativo.
Identificador visual del Clan Ritchie.

Navegación:

Botón destacado: + Nueva conversación.
Sección Historial.
Estado vacío cuando no existan conversaciones: "Aún no hay conversaciones".
Botón Ayuda.
Botón Hablar con el TL (Team Leader).

Perfil inferior:

Avatar con iniciales ED.
Nombre: Estudiante Demo.
Etiqueta: Estudiante.
Acceso a Configurar IA (local).
Icono de configuración.
B. Área principal de conversación

Debe ser el espacio central y protagonista de la aplicación.

Pantalla de bienvenida:

Mostrar un saludo personalizado y visualmente atractivo:

"¡Hola! Soy Ritchie AI"

"Tu asistente virtual del Clan Ritchie. ¿En qué puedo ayudarte hoy?"

Debajo, mostrar:

"Pregúntame sobre tus clases, sesiones, actividades, fechas de entrega y proyectos."

Incluir un elemento gráfico expresivo que represente inteligencia artificial, aprendizaje y colaboración. Puede ser un símbolo abstracto, una figura orgánica o una ilustración minimalista.

4. Sugerencias de conversación

Mostrar cuatro tarjetas interactivas de preguntas frecuentes, organizadas en una cuadrícula adaptable:

Tarjeta 1

Icono: assignment.
Pregunta: ¿Qué tareas debo entregar esta semana?
Descripción: Consulta tus actividades pendientes.

Tarjeta 2

Icono: groups.
Pregunta: ¿Cómo puedo hablar con el TL (Team Leader)?
Descripción: Encuentra los canales de comunicación.

Tarjeta 3

Icono: calendar_month.
Pregunta: ¿Cuándo es la próxima sesión de IA?
Descripción: Consulta tus próximas sesiones.

Tarjeta 4

Icono: videocam.
Pregunta: ¿Dónde están las grabaciones de las clases?
Descripción: Accede al material de tus sesiones.

Cada tarjeta debe tener un diseño expresivo, un color tonal diferente y una animación sutil al pasar el cursor. Al seleccionarla, debe enviar automáticamente la pregunta al chat.

5. Experiencia de conversación

Diseñar un sistema de chat moderno que incluya:

Mensajes del usuario alineados a la derecha.
Mensajes de Ritchie AI alineados a la izquierda.
Avatares diferenciados.
Contenedores con esquinas redondeadas.
Indicador animado de escritura.
Respuestas con soporte para Markdown.
Listas, enlaces, tablas y bloques de código.
Botón para copiar respuestas.
Opción para volver a generar respuestas.
Hora de los mensajes.
Scroll automático al último mensaje.

El asistente debe tener una identidad visual propia, no limitarse a mostrar burbujas de texto.

6. Barra de entrada de mensajes

Ubicar el compositor de mensajes en la parte inferior del área principal.

Debe incluir:

Campo de texto multilinea con placeholder: "Escribe tu pregunta aquí..."
Botón de enviar con icono send.
Botón para adjuntar archivos.
Diseño flotante con esquinas muy redondeadas.
Efectos visuales al recibir el foco.
Envío mediante Enter y salto de línea mediante Shift + Enter.
Deshabilitar el envío cuando el mensaje esté vacío.

Debajo del compositor mostrar un aviso discreto:

"Ritchie AI puede cometer errores. Verifica siempre las fuentes."

7. Configuración de IA (local)

Crear una ventana modal o panel lateral con configuración local:

Nombre del estudiante.
Personalización del asistente.
Preferencias visuales.
Selector de tema claro, oscuro y sistema.
Configuración de comportamiento.
Parámetros de conexión a un proveedor de IA.
Campo para configurar API endpoint.
Campo para configurar API key.
Selección de modelo.
Botón para guardar configuración.

La configuración debe persistir localmente en el navegador cuando sea apropiado. No exponer credenciales en el frontend ni almacenar claves sensibles en texto plano.

8. Funcionalidades adicionales
Crear nuevas conversaciones.
Guardar conversaciones en el historial.
Renombrar conversaciones.
Eliminar conversaciones.
Recuperar conversaciones anteriores.
Búsqueda en el historial.
Estado de conexión del asistente.
Diseño responsive para escritorio, tablet y móvil.
Sidebar adaptable a navegación móvil.
Accesibilidad mediante teclado.
Notificaciones tipo Snackbar.
Confirmaciones para acciones destructivas.
9. Experiencia de usuario

La interfaz debe sentirse como una combinación entre:

Google Gemini.
ChatGPT.
Material Design 3 Expressive.
Una plataforma educativa moderna.

Sin copiar directamente ninguna de estas interfaces.

Priorizar:

Minimalismo funcional.
Personalidad visual.
Claridad en la navegación.
Sensación de cercanía.
Jerarquía visual marcada.
Interacciones intuitivas.
10. Requisitos técnicos

Desarrollar con:

React.
TypeScript.
Tailwind CSS.
Componentes reutilizables.
Lucide Icons o Material Symbols Rounded.
Arquitectura modular.
Diseño responsive.
Persistencia local para historial y preferencias.

Separar claramente:

Interfaz visual.
Gestión de conversaciones.
Configuración del usuario.
Servicio de comunicación con el modelo de IA.

Crear una capa de abstracción para conectar posteriormente diferentes proveedores de modelos de lenguaje mediante API.

No simular una conexión real con IA si no existe una API configurada. En su lugar, mostrar un estado de configuración pendiente o una respuesta de demostración claramente identificada.

11. Resultado esperado

Entregar una aplicación funcional, no solamente un mockup.

La primera pantalla debe mostrar el sidebar, la bienvenida de Ritchie AI, las cuatro tarjetas de sugerencias y el compositor de mensajes.

El diseño debe ser visualmente memorable, con una identidad reconocible del Clan Ritchie y una implementación fiel a Material Design 3 Expressive.

Concepto central: Ritchie AI no es simplemente un chatbot; es el compañero digital de aprendizaje de toda la comunidad del Clan Ritchie.