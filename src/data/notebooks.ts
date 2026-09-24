export type NotebookSlug = 'si' | 'pro' | 'ed' | 'bd' | 'lmsgi' | 'ing' | 'pi'

export interface Notebook {
  slug: NotebookSlug
  code: string
  name: string
  color: string
  description: string
}

export const NOTEBOOKS: Notebook[] = [
  { slug: 'si', code: 'SI', name: 'Sistemas Informáticos', color: '#e8590c',
    description: 'Hardware, sistemas operativos, redes y scripts.' },
  { slug: 'pro', code: 'PRO', name: 'Programación', color: '#3b5bdb',
    description: 'Java, POO, estructuras de datos y ejercicios.' },
  { slug: 'ed', code: 'ED', name: 'Entornos de Desarrollo', color: '#0ca678',
    description: 'IDEs, Git, pruebas, depuración y UML.' },
  { slug: 'bd', code: 'BD', name: 'Bases de Datos', color: '#f08c00',
    description: 'Modelo E/R, normalización y SQL.' },
  { slug: 'lmsgi', code: 'LMSGI', name: 'Lenguajes de Marcas y SGI', color: '#c2255c',
    description: 'HTML, CSS, XML, XSD, XPath, XSLT y JSON.' },
  { slug: 'ing', code: 'ING', name: 'Inglés', color: '#7048e8',
    description: 'Vocabulario técnico, gramática y expresiones.' },
  { slug: 'pi', code: 'PI', name: 'Proyecto Intermodular', color: '#1098ad',
    description: 'Ideas, requisitos, diario y entregas.' },
]

export function getNotebook(slug: string | undefined): Notebook | undefined {
  return NOTEBOOKS.find((n) => n.slug === slug)
}
