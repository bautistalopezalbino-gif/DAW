# Cuadernos DAW

Plataforma web para tomar apuntes del Ciclo Superior de Desarrollo de Aplicaciones Web,
accesible desde cualquier ordenador. Siete cuadernos (uno por módulo), cada uno dividido en
temas, con un editor de texto enriquecido pensado para informática.

El plan completo está en [`docs/plan-plataforma-daw.pdf`](docs/plan-plataforma-daw.pdf).

## Qué puedes hacer

- **7 cuadernos** (Sistemas Informáticos, Programación, Entornos de Desarrollo, Bases de Datos,
  Lenguajes de Marcas y SGI, Inglés y Proyecto Intermodular), cada uno dividido en temas.
- **Editor** con títulos, listas, tareas, tablas, enlaces y **bloques de código con resaltado**
  (Java, SQL, HTML/XML, CSS, Bash, PowerShell…). Atajos Markdown: `#`, `-`, `[ ]`, ```` ```java ````.
- **Imágenes y archivos**: pega capturas con Ctrl+V, arrástralas o súbelas; adjunta PDF (con vista previa).
- **Dibujo a mano** (ratón, lápiz o dedo) para esquemas, diagramas E/R o UML, con **texto** dentro del
  dibujo (se puede mover y editar) y tamaño ajustable a lo **ancho** y a lo alto (hasta ocupar toda la
  pantalla ocultando los paneles laterales).
- **Plantillas** por cuaderno: ejercicio resuelto, consulta SQL, modelo E/R, vocabulario, diario del proyecto…
- **Etiquetas** (#examen, #duda…) con filtro por etiqueta.
- **Compartir cuadernos por email** (editor o lector) y **edición en tiempo real**: varias personas
  escriben a la vez en el mismo apunte y se ven los cursores de los demás.
- **Tarjetas de repaso** con repetición espaciada (se crean también desde un apunte).
- **Calendario** de exámenes y entregas, con los próximos en la página de inicio.
- **Exportar**: apunte a Markdown, apunte o tema a PDF (imprimir), cuaderno entero a Markdown y
  copia de seguridad JSON (importable).
- **Escuchar en voz alta**: un apunte, un tema entero o un resumen hablado hecho por la IA, con
  reproductor (pausa, saltar, velocidad, voces) que sigue sonando al cambiar de página y resalta lo que
  lee. Detecta español e inglés frase a frase (tablas y listas de vocabulario incluidas), lee la
  selección para oír la pronunciación y puede leer las tarjetas de repaso. Usa las voces del navegador.
- **Asistente IA (Gemini)** en toda la web (`Ctrl+J`): dudas, explicaciones, resúmenes, mejorar o
  traducir texto, ejercicios, tarjetas y tests generados desde tus apuntes, planes de estudio y
  preguntas que buscan en todos tus apuntes. Las respuestas se pueden insertar en el apunte.
- **Papelera**: los apuntes y temas borrados se pueden recuperar durante 30 días (con «Deshacer» al momento).
- Guardado automático, buscador global (`Ctrl+K`), modo oscuro y versión móvil.

## Tecnologías

React + TypeScript + Vite · Tailwind CSS · TipTap + Yjs · Supabase (PostgreSQL, Auth, Storage,
Realtime) · Vercel.

La seguridad está en la base de datos (políticas RLS): cada cuaderno solo lo ven su propietario y las
personas invitadas; los lectores no pueden modificar nada, tampoco archivos ni cambios en tiempo real.

## Puesta en marcha

1. **Base de datos (una vez, en orden):** en Supabase → *SQL Editor* → *New query*, pega y ejecuta
   (*Run*) cada archivo de [`supabase/migrations/`](supabase/migrations/):
   `001_esquema_inicial.sql`, `002_compartir_etiquetas_tarjetas_calendario.sql` y `003_papelera.sql`. Si el editor corta
   el texto al pegar, ejecuta el 002 por partes (marcadas con `-- @parte N`), en orden; la propia web
   ofrece un botón para copiar cada parte cuando detecta que falta.
2. **Instalar y arrancar en local:**
   ```bash
   npm install
   npm run dev
   ```
   Abre http://localhost:5173.

3. **Asistente IA:** en Vercel → *Settings → Environment Variables*, crea `GEMINI_API_KEY` con tu clave
   de Google AI Studio y vuelve a desplegar. La clave solo la usa la función de servidor `api/ai.ts`
   (nunca llega al navegador), que exige sesión iniciada y limita el uso por persona. Opcional:
   `GEMINI_MODEL` para cambiar el modelo principal.

La URL y la *anon key* de Supabase están en `src/lib/supabase.ts` (son públicas; la seguridad
la dan las políticas RLS). Para usar otro proyecto, copia `.env.example` a `.env.local`.

## Estructura

```
docs/                    plan del proyecto (PDF) y su generador
supabase/migrations/     esquema SQL y políticas de seguridad
src/
  components/            Layout, editor, barra de herramientas, buscador…
  pages/                 Login, Inicio, Cuaderno
  lib/                   cliente Supabase, acceso a datos, configuración del editor
  data/notebooks.ts      definición de los 7 cuadernos
```
