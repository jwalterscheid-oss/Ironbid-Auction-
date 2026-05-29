// lib/supabase.ts — Supabase client factory (SSR-safe)
import { createClient } from '@supabase/supabase-js'
import { createServerClient, createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── Browser client — use in 'use client' components ──
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// ── Server client — use in Server Components & Route Handlers ──
export function createSupabaseServerClient(cookieStore: {
  get: (name: string) => { value?: string } | undefined
  set: (input: { name: string; value: string } & Record<string, unknown>) => void
}) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set(name: string, value: string, options: Record<string, unknown>) {
        try { cookieStore.set({ name, value, ...options }) } catch {}
      },
      remove(name: string, options: Record<string, unknown>) {
        try { cookieStore.set({ name, value: '', ...options }) } catch {}
      },
    },
  })
}

// ── Admin/service-role client — bypasses RLS, server-only ──
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Storage helpers ──
export const BUCKETS = {
  listingPhotos: 'listing-photos',
  documents: 'documents',
  inspectionReports: 'inspection-reports',
  bolDocuments: 'bol-documents',
} as const

export async function uploadFile(bucket: string, path: string, file: File) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file, { upsert: true })
  if (error) throw error
  return supabaseAdmin.storage.from(bucket).getPublicUrl(data.path).data.publicUrl
}

// Mint a short-lived URL the browser can PUT directly to. Used to bypass the
// Vercel serverless function body limit for large media (e.g. 50MB photos).
export async function createSignedUploadUrl(bucket: string, path: string) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUploadUrl(path)
  if (error) throw error
  return { signedUrl: data.signedUrl, token: data.token, path: data.path }
}

export function getPublicUrl(bucket: string, path: string) {
  return supabaseAdmin.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

// Range-fetches the first N bytes of a storage object so callers can verify
// magic bytes without downloading the whole file. Server-only.
export async function readObjectHead(bucket: string, path: string, bytes = 12): Promise<Uint8Array> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, 60)
  if (error) throw error
  const res = await fetch(data.signedUrl, { headers: { Range: `bytes=0-${bytes - 1}` } })
  if (!res.ok && res.status !== 206) {
    throw new Error(`Failed to read object head (${res.status})`)
  }
  return new Uint8Array(await res.arrayBuffer())
}

export async function getObjectSize(bucket: string, path: string): Promise<number> {
  const slash = path.lastIndexOf('/')
  const dir = slash >= 0 ? path.slice(0, slash) : ''
  const name = slash >= 0 ? path.slice(slash + 1) : path
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(dir, { search: name })
  if (error) throw error
  const match = data?.find((entry) => entry.name === name)
  const size = match?.metadata?.size
  if (typeof size !== 'number') throw new Error(`Object not found: ${path}`)
  return size
}
