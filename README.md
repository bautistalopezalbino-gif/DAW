# Cuadernos DAW

Plataforma web para tomar apuntes del Ciclo Superior de Desarrollo de Aplicaciones Web,
accesible desde cualquier ordenador. Siete cuadernos (uno por módulo), cada uno dividido en
temas, con un editor de texto enriquecido pensado para informática.

El plan completo está en [`docs/plan-plataforma-daw.pdf`](docs/plan-plataforma-daw.pdf).

## Qué puedes hacer

- Iniciar sesión con email y contraseña (Supabase Auth).
- 7 cuadernos: Sistemas Informáticos, Programación, Entornos de Desarrollo, Bases de Datos,
  Lenguajes de Marcas y SGI, Inglés y Proyecto Intermodular.
- Crear, renombrar, ordenar y borrar temas; crear, fijar y borrar apuntes.
- Escribir con títulos, negrita, cursiva, subrayado, resaltado, enlaces, listas, listas de
  tareas, citas, tablas y **bloques de código con resaltado** (Java, SQL, HTML/XML, CSS,
  JavaScript, Bash, PowerShell…). Atajos Markdown: `#`, `-`, `1.`, `[ ]`, `>`, ```` ```java ````.
- Guardado automático (y `Ctrl+S`).
- Buscador en todos los cuadernos (`Ctrl+K`).
- Modo claro/oscuro y diseño adaptado a móvil.

## Tecnologías

React + TypeScript + Vite · Tailwind CSS · TipTap · Supabase (PostgreSQL + Auth) · Vercel.

## Puesta en marcha

1. **Crear las tablas (solo una vez):** en Supabase → *SQL Editor* → *New query*, pega el
   contenido de [`supabase/migrations/001_esquema_inicial.sql`](supabase/migrations/001_esquema_inicial.sql)
   y pulsa *Run*.
2. **Instalar y arrancar en local:**
   ```bash
   npm install
   npm run dev
   ```
   Abre http://localhost:5173.

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
