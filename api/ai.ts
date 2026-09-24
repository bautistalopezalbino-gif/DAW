/**
 * Función de servidor (Vercel) que habla con Gemini.
 * La clave de Gemini vive solo aquí, en la variable de entorno GEMINI_API_KEY de Vercel;
 * el navegador nunca la ve. Solo responde a usuarios con sesión iniciada en Supabase.
 */

declare const process: { env: Record<string, string | undefined> }

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://blddhijulwlzvvtwzzlo.supabase.co'
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZGRoaWp1bHdsenZ2dHd6emxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzA5NzUsImV4cCI6MjEwNTgwNjk3NX0.K9nhlsQ5OHomM8qT61P3Vkw1wHJEoxaqXFrgCdVuLo8'

// Si un modelo está saturado o no disponible se prueba el siguiente
const MODELS: { name: string; thinking: 'minimal' | 'low' }[] = [
  { name: process.env.GEMINI_MODEL || 'gemini-3.5-flash', thinking: 'low' },
  { name: 'gemini-flash-latest', thinking: 'low' },
  { name: 'gemini-3.1-flash-lite', thinking: 'minimal' },
  { name: 'gemini-flash-lite-latest', thinking: 'minimal' },
]

const MAX_INPUT_CHARS = 250_000 // ~60.000 tokens: da para un tema entero de apuntes
const MAX_MESSAGES = 40
const RATE_LIMIT = { requests: 60, windowMs: 60 * 60 * 1000 } // por usuario y hora

export const maxDuration = 60

interface Message {
  role: 'user' | 'model'
  text: string
}

interface AiRequest {
  messages: Message[]
  system?: string
  json?: boolean
  schema?: unknown
  stream?: boolean
}

const sessions = new Map<string, { id: string; expires: number }>()
const usage = new Map<string, number[]>()

function reply(status: number, data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

async function authenticate(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const cached = sessions.get(token)
  if (cached && cached.expires > Date.now()) return cached.id
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const user = (await res.json()) as { id?: string }
  if (!user.id) return null
  sessions.set(token, { id: user.id, expires: Date.now() + 5 * 60_000 })
  return user.id
}

function overLimit(userId: string): boolean {
  const now = Date.now()
  const recent = (usage.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs)
  if (recent.length >= RATE_LIMIT.requests) return true
  recent.push(now)
  usage.set(userId, recent)
  return false
}

function validate(body: unknown): AiRequest | string {
  const b = body as AiRequest
  if (!b || !Array.isArray(b.messages) || b.messages.length === 0) return 'Falta el mensaje.'
  if (b.messages.length > MAX_MESSAGES) return 'La conversación es demasiado larga; empieza una nueva.'
  let chars = typeof b.system === 'string' ? b.system.length : 0
  for (const m of b.messages) {
    if ((m.role !== 'user' && m.role !== 'model') || typeof m.text !== 'string') return 'Mensaje no válido.'
    chars += m.text.length
  }
  if (chars > MAX_INPUT_CHARS) return 'El texto es demasiado largo para la IA. Prueba con un apunte o un tema más corto.'
  return b
}

async function callGemini(key: string, body: AiRequest, stream: boolean) {
  let last: Response | null = null
  for (const model of MODELS) {
    const action = stream ? 'streamGenerateContent?alt=sse' : 'generateContent'
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.name}:${action}`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: body.system ? { parts: [{ text: body.system }] } : undefined,
        contents: body.messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: body.json ? 0.5 : 0.7,
          thinkingConfig: { thinkingLevel: model.thinking },
          ...(body.json ? { responseMimeType: 'application/json', responseSchema: body.schema } : {}),
        },
      }),
    })
    if (res.ok) return { res, model: model.name }
    last = res
    if (res.status === 401 || res.status === 403) break // clave inválida: no sirve probar otro modelo
  }
  return { res: last!, model: null }
}

async function geminiError(res: Response): Promise<Response> {
  const detail = await res.text().catch(() => '')
  console.error('Gemini', res.status, detail.slice(0, 500))
  if (res.status === 401 || res.status === 403) {
    return reply(502, { error: 'La clave de Gemini no es válida o no tiene permisos. Revisa GEMINI_API_KEY en Vercel.' })
  }
  if (res.status === 429) {
    return reply(429, { error: 'Se ha alcanzado el límite de uso de Gemini. Espera un minuto y vuelve a probar.' })
  }
  return reply(503, { error: 'La IA está saturada ahora mismo. Vuelve a probar en unos segundos.' })
}

/** Convierte el flujo SSE de Gemini en texto plano que va llegando poco a poco. */
function textStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = upstream.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  return new ReadableStream({
    async pull(controller) {
      try {
        // Sigue leyendo hasta tener algo que enviar (un trozo puede no traer ninguna línea completa)
        for (;;) {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            return
          }
          buffer += decoder.decode(value, { stream: true })
          let sent = false
          let nl: number
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).trim()
            buffer = buffer.slice(nl + 1)
            if (!line.startsWith('data:')) continue
            try {
              const data = JSON.parse(line.slice(5))
              const parts: { text?: string; thought?: boolean }[] = data.candidates?.[0]?.content?.parts ?? []
              const text = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('')
              if (text) {
                controller.enqueue(encoder.encode(text))
                sent = true
              }
            } catch {
              // línea sin contenido de texto
            }
          }
          if (sent) return
        }
      } catch {
        controller.enqueue(encoder.encode('\n\n_(La respuesta se ha cortado. Vuelve a intentarlo.)_'))
        controller.close()
      }
    },
    cancel() {
      void reader.cancel()
    },
  })
}

export async function GET(): Promise<Response> {
  return reply(200, { ok: true, configured: Boolean(process.env.GEMINI_API_KEY) })
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return reply(500, { error: 'Falta configurar la clave de Gemini (GEMINI_API_KEY) en Vercel.', code: 'not_configured' })

  const userId = await authenticate(request)
  if (!userId) return reply(401, { error: 'Tienes que iniciar sesión para usar el asistente.' })
  if (overLimit(userId)) return reply(429, { error: 'Has hecho muchas peticiones en poco tiempo. Espera un rato y vuelve a probar.' })

  let body: AiRequest | string
  try {
    body = validate(await request.json())
  } catch {
    body = 'Petición no válida.'
  }
  if (typeof body === 'string') return reply(400, { error: body })

  const stream = body.stream !== false && !body.json
  const { res, model } = await callGemini(key, body, stream)
  if (!model) return geminiError(res)

  if (stream && res.body) {
    return new Response(textStream(res.body), {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-model': model },
    })
  }

  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
  if (!text) return reply(503, { error: 'La IA no ha devuelto respuesta. Vuelve a intentarlo.' })
  return reply(200, { text, model })
}
