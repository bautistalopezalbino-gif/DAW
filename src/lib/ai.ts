import { supabase } from './supabase'

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

export class AIError extends Error {}

export const SYSTEM_PROMPT = `Eres el asistente de estudio de «Cuadernos DAW», una plataforma de apuntes del Ciclo Formativo de Grado Superior de Desarrollo de Aplicaciones Web (DAW) en España.
Módulos de primer curso: Sistemas Informáticos, Programación (Java), Entornos de Desarrollo, Bases de Datos (SQL), Lenguajes de Marcas y Sistemas de Gestión de Información (HTML, CSS, XML, JSON…), Inglés técnico y Proyecto Intermodular.
Normas:
- Responde en español de España salvo que te pidan otro idioma. Sé claro, didáctico y ve al grano.
- Usa Markdown: títulos cortos, listas y tablas cuando ayuden. Pon el código en bloques con su lenguaje (\`\`\`java, \`\`\`sql, \`\`\`html, \`\`\`bash…).
- Si te dan apuntes como contexto, básate en ellos y di claramente si la respuesta no está en los apuntes.
- No inventes datos del curso (fechas, notas, criterios del profesor).`

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new AIError('Tienes que iniciar sesión para usar el asistente.')
  return data.session.access_token
}

async function post(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  let res: Response
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new AIError('No se pudo conectar con el asistente. Revisa tu conexión.')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new AIError(data?.error ?? `El asistente no está disponible (error ${res.status}).`)
  }
  return res
}

/** Respuesta en streaming: `onText` recibe el texto acumulado cada vez que llega un trozo. */
export async function streamChat(
  messages: ChatMessage[],
  onText: (text: string) => void,
  opts: { system?: string; signal?: AbortSignal } = {},
): Promise<string> {
  const res = await post({ messages, system: opts.system ?? SYSTEM_PROMPT, stream: true }, opts.signal)
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
    onText(text)
  }
  return text
}

/** Respuesta estructurada (JSON) según un esquema de Gemini. */
export async function askJson<T>(prompt: string, schema: unknown, opts: { system?: string; signal?: AbortSignal } = {}): Promise<T> {
  const res = await post(
    { messages: [{ role: 'user', text: prompt }], system: opts.system ?? SYSTEM_PROMPT, json: true, schema },
    opts.signal,
  )
  const data = (await res.json()) as { text: string }
  try {
    return JSON.parse(data.text) as T
  } catch {
    throw new AIError('La IA ha devuelto una respuesta que no se entiende. Vuelve a intentarlo.')
  }
}

/** Recorta textos largos para no pasarse del límite de la IA. */
export function clip(text: string, max = 60_000): string {
  return text.length > max ? `${text.slice(0, max)}\n\n[… texto recortado …]` : text
}

// ---------- Esquemas ----------

export interface GeneratedCard {
  front: string
  back: string
}

export const CARDS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    cards: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { front: { type: 'STRING' }, back: { type: 'STRING' } },
        required: ['front', 'back'],
      },
    },
  },
  required: ['cards'],
}

export interface QuizQuestion {
  question: string
  options: string[]
  correct: number
  explanation: string
}

export const QUIZ_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          correct: { type: 'INTEGER' },
          explanation: { type: 'STRING' },
        },
        required: ['question', 'options', 'correct', 'explanation'],
      },
    },
  },
  required: ['questions'],
}
