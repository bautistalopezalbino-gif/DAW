import type { JSONContent } from '@tiptap/react'
import type { NotebookSlug } from './notebooks'

export interface Template {
  id: string
  name: string
  description: string
  notebooks: NotebookSlug[] | 'all'
  title: () => string
  content: () => JSONContent
}

// ---------- Constructores de bloques ----------
const text = (t: string): JSONContent => ({ type: 'text', text: t })
const p = (t = ''): JSONContent => (t ? { type: 'paragraph', content: [text(t)] } : { type: 'paragraph' })
const h = (level: number, t: string): JSONContent => ({ type: 'heading', attrs: { level }, content: [text(t)] })
const list = (type: 'bulletList' | 'orderedList', items: string[]): JSONContent => ({
  type,
  content: items.map((i) => ({ type: 'listItem', content: [p(i)] })),
})
const ul = (...items: string[]) => list('bulletList', items.length ? items : [''])
const ol = (...items: string[]) => list('orderedList', items.length ? items : [''])
const tasks = (...items: string[]): JSONContent => ({
  type: 'taskList',
  content: (items.length ? items : ['']).map((i) => ({ type: 'taskItem', attrs: { checked: false }, content: [p(i)] })),
})
const code = (language: string, t = ''): JSONContent =>
  t ? { type: 'codeBlock', attrs: { language }, content: [text(t)] } : { type: 'codeBlock', attrs: { language } }
const table = (header: string[], rows: number | string[][]): JSONContent => {
  const body = typeof rows === 'number' ? Array.from({ length: rows }, () => header.map(() => '')) : rows
  return {
    type: 'table',
    content: [
      { type: 'tableRow', content: header.map((c) => ({ type: 'tableHeader', content: [p(c)] })) },
      ...body.map((r) => ({ type: 'tableRow', content: r.map((c) => ({ type: 'tableCell', content: [p(c)] })) })),
    ],
  }
}
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })

const longDate = () =>
  new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const shortDate = () => new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

// ---------- Plantillas ----------
export const TEMPLATES: Template[] = [
  // Específicas de cada cuaderno
  {
    id: 'comandos',
    name: 'Comandos',
    description: 'Tabla de comandos con ejemplos y un script.',
    notebooks: ['si'],
    title: () => 'Comandos: ',
    content: () =>
      doc(
        table(['Comando', 'Qué hace', 'Ejemplo'], 4),
        h(2, 'Script'),
        code('bash', '#!/bin/bash\n\n'),
        h(2, 'Notas'),
        ul(),
      ),
  },
  {
    id: 'ejercicio',
    name: 'Ejercicio resuelto',
    description: 'Enunciado, solución en Java, explicación y pruebas.',
    notebooks: ['pro', 'ed'],
    title: () => 'Ejercicio: ',
    content: () =>
      doc(
        h(2, 'Enunciado'),
        p(),
        h(2, 'Solución'),
        code('java', 'public class Main {\n    public static void main(String[] args) {\n        \n    }\n}'),
        h(2, 'Explicación'),
        p(),
        h(2, 'Pruebas'),
        table(['Entrada', 'Salida esperada', '¿Correcto?'], 3),
      ),
  },
  {
    id: 'practica-git',
    name: 'Práctica guiada',
    description: 'Objetivo, pasos, comandos y problemas encontrados.',
    notebooks: ['ed'],
    title: () => 'Práctica: ',
    content: () =>
      doc(
        h(2, 'Objetivo'),
        p(),
        h(2, 'Pasos'),
        ol(),
        h(2, 'Comandos'),
        code('bash', 'git status\n'),
        h(2, 'Problemas y soluciones'),
        table(['Problema', 'Solución'], 2),
      ),
  },
  {
    id: 'sql',
    name: 'Consulta SQL',
    description: 'Enunciado, consulta, resultado esperado y explicación.',
    notebooks: ['bd'],
    title: () => 'Consulta: ',
    content: () =>
      doc(
        h(2, 'Enunciado'),
        p(),
        h(2, 'Consulta'),
        code('sql', 'SELECT \nFROM \nWHERE ;'),
        h(2, 'Resultado esperado'),
        table(['columna1', 'columna2', 'columna3'], 2),
        h(2, 'Explicación'),
        ul(),
      ),
  },
  {
    id: 'modelo-er',
    name: 'Modelo E/R',
    description: 'Entidades, relaciones, diagrama a mano y paso a tablas.',
    notebooks: ['bd'],
    title: () => 'Modelo E/R: ',
    content: () =>
      doc(
        h(2, 'Enunciado'),
        p(),
        h(2, 'Entidades'),
        table(['Entidad', 'Atributos', 'Clave primaria'], 3),
        h(2, 'Relaciones'),
        table(['Relación', 'Entidades', 'Cardinalidad'], 2),
        h(2, 'Diagrama'),
        { type: 'drawing' },
        h(2, 'Paso a tablas'),
        code('sql', 'CREATE TABLE  (\n    id INT PRIMARY KEY,\n    \n);'),
      ),
  },
  {
    id: 'marcado',
    name: 'Ejemplo de marcado',
    description: 'Concepto con código HTML/XML, CSS y explicación.',
    notebooks: ['lmsgi'],
    title: () => 'Ejemplo: ',
    content: () =>
      doc(
        h(2, 'Concepto'),
        p(),
        h(2, 'Código'),
        code(
          'xml',
          '<!DOCTYPE html>\n<html lang="es">\n  <head>\n    <meta charset="UTF-8">\n    <title></title>\n  </head>\n  <body>\n    \n  </body>\n</html>',
        ),
        h(2, 'CSS'),
        code('css', 'body {\n  \n}'),
        h(2, 'Resultado y explicación'),
        p(),
      ),
  },
  {
    id: 'vocabulario',
    name: 'Vocabulary',
    description: 'Tabla de palabras con traducción y ejemplo.',
    notebooks: ['ing'],
    title: () => 'Vocabulary: ',
    content: () =>
      doc(
        table(['Word', 'Traducción', 'Example sentence'], 6),
        h(2, 'Expressions & phrasal verbs'),
        table(['Expression', 'Significado'], 3),
      ),
  },
  {
    id: 'grammar',
    name: 'Grammar',
    description: 'Regla, estructura, ejemplos y excepciones.',
    notebooks: ['ing'],
    title: () => 'Grammar: ',
    content: () =>
      doc(
        h(2, 'Rule'),
        p(),
        h(2, 'Structure'),
        p(),
        h(2, 'Examples'),
        ul(),
        h(2, 'Exceptions'),
        ul(),
        h(2, 'Practice'),
        tasks(),
      ),
  },
  {
    id: 'diario',
    name: 'Entrada de diario',
    description: 'Qué he hecho, problemas, decisiones y próximos pasos.',
    notebooks: ['pi'],
    title: () => `Diario ${shortDate()}`,
    content: () =>
      doc(
        p(`📅 ${longDate()}`),
        h(2, 'Qué he hecho'),
        ul(),
        h(2, 'Problemas encontrados'),
        ul(),
        h(2, 'Decisiones técnicas'),
        ul(),
        h(2, 'Próximos pasos'),
        tasks(),
        h(2, 'Horas dedicadas'),
        p('0 h'),
      ),
  },
  {
    id: 'requisito',
    name: 'Requisito',
    description: 'Ficha de requisito con criterios de aceptación.',
    notebooks: ['pi'],
    title: () => 'Requisito: ',
    content: () =>
      doc(
        table(
          ['Campo', 'Valor'],
          [
            ['ID', 'RF-'],
            ['Descripción', ''],
            ['Prioridad', 'Alta / Media / Baja'],
            ['Estado', 'Pendiente'],
          ],
        ),
        h(2, 'Criterios de aceptación'),
        tasks(),
        h(2, 'Notas'),
        p(),
      ),
  },
  // Generales
  {
    id: 'clase',
    name: 'Apunte de clase',
    description: 'Fecha, ideas clave, explicación, dudas y resumen.',
    notebooks: 'all',
    title: () => `Clase ${shortDate()}`,
    content: () =>
      doc(
        p(`📅 ${longDate()}`),
        h(2, 'Ideas clave'),
        ul(),
        h(2, 'Explicación'),
        p(),
        h(2, 'Dudas para preguntar'),
        tasks(),
        h(2, 'Resumen'),
        p(),
      ),
  },
  {
    id: 'resumen',
    name: 'Resumen para el examen',
    description: 'Conceptos clave, esquema, preguntas típicas y errores.',
    notebooks: 'all',
    title: () => 'Resumen: ',
    content: () =>
      doc(
        h(2, 'Conceptos clave'),
        table(['Concepto', 'Definición'], 4),
        h(2, 'Esquema'),
        ul(),
        h(2, 'Preguntas típicas'),
        ol(),
        h(2, 'Errores que no debo cometer'),
        ul(),
      ),
  },
  {
    id: 'esquema',
    name: 'Esquema a mano',
    description: 'Hoja con un bloque de dibujo para esquemas y diagramas.',
    notebooks: 'all',
    title: () => 'Esquema: ',
    content: () => doc({ type: 'drawing' }, p()),
  },
]

export function templatesFor(notebook: NotebookSlug): { specific: Template[]; general: Template[] } {
  return {
    specific: TEMPLATES.filter((t) => t.notebooks !== 'all' && t.notebooks.includes(notebook)),
    general: TEMPLATES.filter((t) => t.notebooks === 'all'),
  }
}
