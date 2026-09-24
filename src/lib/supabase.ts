import { createClient } from '@supabase/supabase-js'

// La anon key es pública por diseño; la seguridad la dan las políticas RLS.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://blddhijulwlzvvtwzzlo.supabase.co'
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZGRoaWp1bHdsenZ2dHd6emxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzA5NzUsImV4cCI6MjEwNTgwNjk3NX0.K9nhlsQ5OHomM8qT61P3Vkw1wHJEoxaqXFrgCdVuLo8'

export const supabase = createClient(url, anonKey)
